import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineString } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';

dotenv.config({ path: '.env' });

// Safe .env accessor
const env =
    typeof globalThis !== 'undefined' && globalThis.process && globalThis.process.env
        ? globalThis.process.env
        : {};

// Import SendGrid API key and From address from environment variables or Firebase params
const sendgridKeyParam = defineString('SENDGRID_API_KEY');
const sendgridFromParam = defineString('SENDGRID_FROM');
const sendgridTemplateIdParam = defineString('SENDGRID_TEMPLATE_ID');

// Runtime getters
const getSendgridKey = () =>
    (typeof sendgridKeyParam?.value === 'function' ? sendgridKeyParam.value() : undefined) ||
    env.SENDGRID_API_KEY ||
    env.VITE_SENDGRID_API_KEY;

const getSendgridFrom = () =>
    (typeof sendgridFromParam?.value === 'function' ? sendgridFromParam.value() : undefined) ||
    env.SENDGRID_FROM ||
    env.VITE_SENDGRID_FROM;

const getSendgridTemplateId = () =>
    (typeof sendgridTemplateIdParam?.value === 'function'
        ? sendgridTemplateIdParam.value()
        : undefined) ||
    env.SENDGRID_TEMPLATE_ID ||
    env.VITE_SENDGRID_TEMPLATE_ID;

/**
 * Firestore trigger: when a document is created in `mail_queue`, send the email via SendGrid
 * and update the document status to 'sent' or 'failed'.
 */
initializeApp();

export const sendQueuedEmail = onDocumentCreated('mail_queue/{docId}', async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const data = snap.data();
    if (!data) return null;

    const docRef = snap.ref;

    if (!data.to) {
        await docRef.update({ status: 'failed', error: 'Missing recipient (to)' });
        return null;
    }

    const apiKey = getSendgridKey();

    if (!apiKey) {
        await docRef.update({ status: 'failed', error: 'SendGrid API key not provided' });
        return null;
    }

    sgMail.setApiKey(apiKey);

    const to = data.to;
    const templateId = data.templateId || getSendgridTemplateId();
    const dynamicData = data.data || null;
    const subject = data.subject || null;
    const bodyText = data.bodyText || null;
    const bodyHtml = data.bodyHtml || null;

    const msg = { to };
    // Ensure 'from' is configured; fail the job early with a clear error if not.
    const from = getSendgridFrom();
    if (!from) {
        await docRef.update({ status: 'failed', error: 'SendGrid from address not provided' });
        return null;
    }
    msg.from = from;

    if (templateId) {
        msg.templateId = templateId;
        // Sanitize dynamic template data to strip undefined/non-serializable values
        if (dynamicData) msg.dynamicTemplateData = sanitizeForFirestore(dynamicData);
    } else {
        msg.subject = subject || 'Notification';
        if (bodyHtml) msg.html = bodyHtml;
        if (bodyText) msg.text = bodyText;
    }

    try {
        const res = await sgMail.send(msg);

        // normalize result, avoid undefined values which Firestore rejects
        let resultData = null;
        if (Array.isArray(res)) {
            resultData = res.map((r) => ({
                status: typeof r?.statusCode !== 'undefined' ? r.statusCode : null,
            }));
        } else if (res && typeof res.statusCode !== 'undefined') {
            resultData = { status: res.statusCode };
        }

        const updatePayload = {
            status: 'sent',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const safeResult = resultData !== null ? sanitizeForFirestore(resultData) : null;
        if (safeResult !== null) updatePayload.result = safeResult;

        await docRef.update(updatePayload);
    } catch (err) {
        console.error('Failed to send queued email', err);
        const errMsg = err && err.message ? err.message : String(err);
        await docRef.update({ status: 'failed', error: errMsg });
    }

    return null;
});

// Helper to sanitize values for Firestore by removing non-serializable parts.
// Attempts a safe JSON round-trip and falls back to the original value on error.
const sanitizeForFirestore = (value) => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (e) {
        return value;
    }
};
