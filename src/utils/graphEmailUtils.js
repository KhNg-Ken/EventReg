import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config.js';
import { createLogger } from './logger.js';

const logger = createLogger('graphEmailUtils');
const functions = getFunctions(app);

/**
 * Call Cloud Function to store MSAL refresh token in Firestore.
 * Only works for authorized admin email (example@tds.com).
 */
export async function storeRefreshToken(email, refreshToken) {
    try {
        const fn = httpsCallable(functions, 'storeRefreshToken');
        const result = await fn({ email, refreshToken });
        logger.log('Refresh token stored:', result.data);
        return result.data;
    } catch (err) {
        logger.error('Failed to store refresh token:', err);
        throw err;
    }
}

/**
 * Call Cloud Function to send email via Microsoft Graph API.
 * Uses stored refresh token to send emails from admin account.
 */
export async function sendEmailViaGraph({
    to,
    templateName = 'registration-invite',
    templateData = {},
}) {
    try {
        const fn = httpsCallable(functions, 'sendEmailViaGraph');
        const result = await fn({ to, templateName, templateData });
        logger.log('Email sent via Graph API:', result.data);
        return result.data;
    } catch (err) {
        logger.error('Failed to send email via Graph API:', err);
        throw err;
    }
}
