import { getFunctions, httpsCallable } from 'firebase/functions';
import { ensureAnonymousAuth } from '../firebase/auth.js';
import { app } from '../firebase/config.js';
import { createLogger } from './logger.js';

const logger = createLogger('registerProxy');

/**
 * Register a user for an event using Firebase Callable function.
 * Automatically ensures user is authenticated (anonymously) before calling.
 *
 * @param {Object} payload - Registration data
 * @param {string} payload.eventDoc - Event document ID
 * @param {string} payload.name - User's name
 * @param {string} payload.email - User's email
 * @param {string} payload.phone - User's phone number
 * @param {string} [payload.company] - User's company (optional)
 * @param {string} [payload.position] - User's position (optional)
 * @param {string} [payload.photoUrl] - User's photo URL (optional)
 * @param {string} [payload.qrCodeUrl] - QR code URL (optional)
 * @returns {Promise<{success: boolean, inviteId: string}>}
 */
export async function registerUserProxy(payload) {
    try {
        // Ensure Firebase authentication (anonymous if not logged in)
        logger.log('Ensuring anonymous authentication...');
        const user = await ensureAnonymousAuth();
        logger.log('User authenticated, UID:', user.uid);

        // Get a fresh ID token to ensure auth state is current
        logger.log('Getting fresh ID token...');
        await user.getIdToken(true); // Force refresh
        logger.log('Token refreshed');

        logger.log('Calling registerUser via httpsCallable...');
        logger.log('Payload:', {
            eventDoc: payload.eventDoc,
            name: payload.name,
            email: payload.email,
            phone: payload.phone ? '***' : null,
        });

        const functions = getFunctions(app);
        const fn = httpsCallable(functions, 'registerUser');

        const result = await fn(payload);
        logger.log('Registration successful:', result.data);
        return result.data;
    } catch (err) {
        logger.error('Registration failed:', err);
        logger.error('Error code:', err.code);
        logger.error('Error message:', err.message);

        // Normalize callable errors for the UI
        const message =
            err?.message ||
            (err?.code === 'functions/unauthenticated'
                ? 'Authentication failed. Please refresh and try again.'
                : 'Registration failed');
        const code = err?.code || null;
        throw { message, code, original: err };
    }
}

export default registerUserProxy;
