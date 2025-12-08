import { getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { createLogger } from '../utils/logger.js';
import { sendEmailViaGraph } from './graphEmailUtils.js';

const logger = createLogger('emailUtils');

/**
 * Queue an email by writing a job document to Firestore `mail_queue` collection.
 * This function is intended to be called from the client app (no SendGrid key here).
 * @param {{to:string, templateId?:string, data?:object, subject?:string, bodyText?:string, bodyHtml?:string}} opts
 */
export async function queueEmail({ to, templateId, data, subject, bodyText, bodyHtml } = {}) {
    try {
        const app = getApp();
        const db = getFirestore(app);
        const col = collection(db, 'mail_queue');
        const payload = {
            to,
            templateId: templateId || null,
            data: data || null,
            subject: subject || null,
            bodyText: bodyText || null,
            bodyHtml: bodyHtml || null,
            status: 'pending',
            queuedAt: serverTimestamp(),
        };
        await addDoc(col, payload);
    } catch (err) {
        logger.warn('queueEmail failed', err);
        throw err;
    }
}

/**
 * Send email via Microsoft Graph API using stored admin refresh token.
 * Alternative to queueEmail that uses Graph API instead of SendGrid.
 * @param {{to:string, templateName?:string, templateData?:object}} opts
 */
export async function sendGraphEmail({ to, templateName = 'registration-invite', templateData = {} } = {}) {
    try {
        return await sendEmailViaGraph({ to, templateName, templateData });
    } catch (err) {
        logger.warn('sendGraphEmail failed', err);
        throw err;
    }
}
