import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInWithToken } from '../firebase/auth.js';
import { app } from '../firebase/config.js';
import { createLogger } from './logger.js';

const logger = createLogger('firebaseAuthProxy');
const functions = getFunctions(app);

/**
 * Exchange MSAL access token for Firebase custom token and sign in
 * Called after successful MSAL login to connect to Firebase
 *
 * @param {string} msalAccessToken - Access token from MSAL
 * @param {string} email - User's email from MSAL
 * @returns {Promise<{uid: string, email: string}>} Firebase user info
 */
export async function exchangeMsalTokenForFirebase(msalAccessToken, email) {
    try {
        if (!msalAccessToken || !email) {
            throw new Error('msalAccessToken and email are required');
        }

        logger.log('Exchanging MSAL token for Firebase custom token...');

        // Call Cloud Function to exchange tokens
        const fn = httpsCallable(functions, 'exchangeTokenForFirebase');
        const response = await fn({
            msalAccessToken,
            email,
        });

        const { firebaseToken } = response.data;

        if (!firebaseToken) {
            throw new Error('No Firebase token returned from server');
        }

        logger.log('Received Firebase custom token, signing in...');

        // Sign in to Firebase with the custom token
        const user = await signInWithToken(firebaseToken);

        logger.log('Successfully signed in to Firebase:', user.uid, user.email);

        return {
            uid: user.uid,
            email: user.email,
        };
    } catch (err) {
        logger.error('Failed to exchange MSAL token for Firebase:', err);
        throw {
            message: err.message || 'Token exchange failed',
            code: err.code || 'EXCHANGE_FAILED',
            original: err,
        };
    }
}

/**
 * Set admin custom claims for current user
 * Should be called after user logs in via MSAL and is authenticated to Firebase
 *
 * @param {string} email - User's email
 * @returns {Promise<object>} Response from server
 */
export async function setAdminCustomClaims(email) {
    try {
        if (!email) {
            throw new Error('Email is required');
        }

        logger.log('Setting admin custom claims for:', email);

        const fn = httpsCallable(functions, 'setAdminClaims');
        const response = await fn({ email });

        logger.log('Admin claims set successfully');
        return response.data;
    } catch (err) {
        logger.error('Failed to set admin claims:', err);
        throw {
            message: err.message || 'Failed to set admin claims',
            code: err.code || 'CLAIMS_FAILED',
            original: err,
        };
    }
}

export default {
    exchangeMsalTokenForFirebase,
    setAdminCustomClaims,
};
