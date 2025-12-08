import crypto from 'crypto';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

dotenv.config({ path: '.env' });

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
 * Callable Cloud Function to accept public registration submissions and write
 * a validated registrant document using the Admin SDK. Prevents direct
 * client writes to the `registrants` subcollection by design (use Firestore rules).
 *
 * Expects `data` to contain:
 * - eventDoc: string (document id of the event)
 * - name: string
 * - email: string
 * - phone: string (optional)
 * - extra: object (optional, will be shallow-merged)
 * - recaptchaToken: string (optional, verified if server-side secret is present)
 */
export const registerUser = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;

    // Log authentication details for debugging
    console.log('=== registerUser called ===');
    console.log('Auth present:', !!auth);
    console.log('Auth UID:', auth?.uid);
    console.log('Auth provider:', auth?.token?.firebase?.sign_in_provider);
    console.log('Is anonymous:', auth?.token?.firebase?.sign_in_provider === 'anonymous'); // Check authentication
    if (!auth) {
        console.error('Authentication check FAILED - no auth context');
        throw new HttpsError('unauthenticated', 'Must be signed in to register');
    }

    console.log('Authentication check PASSED - UID:', auth.uid);

    // Validate required fields
    const eventDoc = isNonEmptyString(data.eventDoc) ? data.eventDoc.trim() : null;
    const name = isNonEmptyString(data.name) ? data.name.trim() : null;
    const email = isNonEmptyString(data.email) ? data.email.trim().toLowerCase() : null;
    const phone = isNonEmptyString(data.phone) ? data.phone.trim() : null;
    const extra = data.extra && typeof data.extra === 'object' ? data.extra : {};
    const recaptchaToken = isNonEmptyString(data.recaptchaToken) ? data.recaptchaToken : null;

    if (!eventDoc) throw new HttpsError('invalid-argument', 'Missing eventDoc');
    if (!name) throw new HttpsError('invalid-argument', 'Missing name');
    if (!email) throw new HttpsError('invalid-argument', 'Missing email');

    // Optional reCAPTCHA verification when secret is configured
    const recaptchaSecret = getRecaptchaSecret();
    if (recaptchaSecret && recaptchaToken) {
        try {
            const verifyUrl = `https://www.google.com/recaptcha/api/siteverify`;
            const body = `secret=${encodeURIComponent(
                recaptchaSecret
            )}&response=${encodeURIComponent(recaptchaToken)}`;
            const res = await fetch(verifyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
            });
            const json = await res.json();
            if (!json || !json.success) {
                throw new Error('reCAPTCHA verification failed');
            }
        } catch {
            throw new HttpsError('permission-denied', 'reCAPTCHA verification failed');
        }
    }

    const db = admin.firestore();
    const registrantsRef = db.collection('events').doc(eventDoc).collection('registrants');

    // Basic duplicate detection by email
    try {
        const dupQuery = await registrantsRef.where('email', '==', email).limit(1).get();
        if (!dupQuery.empty) {
            throw new HttpsError('already-exists', 'A registration with that email already exists');
        }
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        console.error('Error during duplicate check', err);
        throw new HttpsError('internal', 'Failed to validate registration');
    }

    // Generate a compact inviteId (timestamp + random suffix)
    const inviteId = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

    const docRef = registrantsRef.doc(inviteId);

    const payload = {
        inviteId,
        name,
        email,
        phone: phone || null,
        ...extra,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'callable.registerUser',
        uid: auth.uid,
    };

    try {
        await docRef.set(payload, { merge: true });
    } catch (err) {
        console.error('Failed to write registrant', err);
        throw new HttpsError('internal', 'Failed to save registration');
    }

    console.log('Registration successful, inviteId:', inviteId);
    return { success: true, inviteId };
});
