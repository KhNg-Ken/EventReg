import crypto from 'crypto';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { initializeApp } from 'firebase-admin/app';
import { defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';

dotenv.config({ path: '.env' });

// Initialize admin SDK (idempotent in Cloud Functions environment)
initializeApp();

// Safe .env accessor
const env = import.meta.env || {};

// Optional reCAPTCHA secret (set as Firebase Functions param or env var)
const recaptchaSecretParam = defineString('RECAPTCHA_SECRET');
const getRecaptchaSecret = () =>
    (typeof recaptchaSecretParam?.value === 'function'
        ? recaptchaSecretParam.value()
        : undefined) || env.RECAPTCHA_SECRET;

// Lightweight validate helpers
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Helper to extract and verify Firebase ID token from Bearer header
 * Returns decoded token with uid, or null if invalid
 */
async function verifyIdToken(authHeader) {
    if (!authHeader?.startsWith('Bearer ')) {
        console.log('No Bearer token in header');
        return null;
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    console.log('Extracted token, length:', token.length);

    try {
        const auth = admin.auth();
        const decodedToken = await auth.verifyIdToken(token);
        console.log('Token verified successfully, uid:', decodedToken.uid);
        return decodedToken;
    } catch (err) {
        console.error('Token verification failed:', err.message);
        return null;
    }
}

/**
 * HTTP request handler to accept public registration submissions and write
 * a validated registrant document using the Admin SDK. Prevents direct
 * client writes to the `registrants` subcollection by design (use Firestore rules).
 *
 * Expects JSON body to contain:
 * - data.eventDoc: string (document id of the event)
 * - data.name: string
 * - data.email: string
 * - data.phone: string (optional)
 * - data.extra: object (optional, will be shallow-merged)
 * - data.recaptchaToken: string (optional, verified if server-side secret is present)
 */
export const registerUser = onRequest(async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    // Only allow POST
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        // Verify ID token from Authorization header
        const authHeader = req.headers.authorization;
        console.log('=== registerUser called ===');
        console.log('Authorization header:', authHeader ? 'PRESENT' : 'MISSING');

        const decodedToken = await verifyIdToken(authHeader);
        if (!decodedToken) {
            console.error('Authentication check FAILED - invalid or missing token');
            res.status(401).json({ error: { message: 'Must be signed in to register' } });
            return;
        }

        console.log('Authentication check PASSED - UID:', decodedToken.uid);

        // Extract and validate request body
        const requestData = req.body?.data || {};

        const eventDoc = isNonEmptyString(requestData.eventDoc)
            ? requestData.eventDoc.trim()
            : null;
        const name = isNonEmptyString(requestData.name) ? requestData.name.trim() : null;
        const email = isNonEmptyString(requestData.email)
            ? requestData.email.trim().toLowerCase()
            : null;
        const phone = isNonEmptyString(requestData.phone) ? requestData.phone.trim() : null;
        const extra =
            requestData.extra && typeof requestData.extra === 'object' ? requestData.extra : {};
        const recaptchaToken = isNonEmptyString(requestData.recaptchaToken)
            ? requestData.recaptchaToken
            : null;

        if (!eventDoc) {
            res.status(400).json({ error: { message: 'Missing eventDoc' } });
            return;
        }
        if (!name) {
            res.status(400).json({ error: { message: 'Missing name' } });
            return;
        }
        if (!email) {
            res.status(400).json({ error: { message: 'Missing email' } });
            return;
        }

        // Optional reCAPTCHA verification when secret is configured
        const recaptchaSecret = getRecaptchaSecret();
        if (recaptchaSecret && recaptchaToken) {
            try {
                const verifyUrl = `https://www.google.com/recaptcha/api/siteverify`;
                const body = `secret=${encodeURIComponent(
                    recaptchaSecret
                )}&response=${encodeURIComponent(recaptchaToken)}`;
                const recaptchaRes = await fetch(verifyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body,
                });
                const json = await recaptchaRes.json();
                if (!json || !json.success) {
                    throw new Error('reCAPTCHA verification failed');
                }
            } catch (err) {
                console.error('reCAPTCHA verification error:', err);
                res.status(403).json({ error: { message: 'reCAPTCHA verification failed' } });
                return;
            }
        }

        const db = admin.firestore();
        const registrantsRef = db.collection('events').doc(eventDoc).collection('registrants');

        // Basic duplicate detection by email
        try {
            const dupQuery = await registrantsRef.where('email', '==', email).limit(1).get();
            if (!dupQuery.empty) {
                res.status(400).json({
                    error: { message: 'A registration with that email already exists' },
                });
                return;
            }
        } catch (err) {
            console.error('Error during duplicate check', err);
            res.status(500).json({ error: { message: 'Failed to validate registration' } });
            return;
        }

        // Generate a compact inviteId (timestamp + random suffix)
        const inviteId = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

        const docRef = registrantsRef.doc(inviteId);

        const registrantPayload = {
            inviteId,
            name,
            email,
            phone: phone || null,
            ...extra,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'http.registerUser',
            uid: decodedToken.uid,
        };

        try {
            await docRef.set(registrantPayload, { merge: true });
        } catch (err) {
            console.error('Failed to write registrant', err);
            res.status(500).json({ error: { message: 'Failed to save registration' } });
            return;
        }

        console.log('Registration successful, inviteId:', inviteId);
        res.status(200).json({ result: { success: true, inviteId } });
    } catch (err) {
        console.error('Unexpected error in registerUser:', err);
        res.status(500).json({ error: { message: 'Internal server error' } });
    }
});
