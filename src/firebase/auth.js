import { getAuth, signInAnonymously, signInWithCustomToken, signOut } from 'firebase/auth';
import { createLogger } from '../utils/logger.js';
import { app } from './config.js';

const logger = createLogger('firebase:auth');
const auth = getAuth(app);

/**
 * Ensure user is authenticated (as anonymous if not already logged in)
 * This allows public users to register for events without signing in
 */
export async function ensureAnonymousAuth() {
    try {
        if (auth.currentUser) {
            logger.debug('User already authenticated:', auth.currentUser.uid);
            return auth.currentUser;
        }

        // Check if anonymous auth is enabled
        logger.log('Checking Firebase auth configuration...');

        // Sign in anonymously
        logger.log('Signing in anonymously...');
        const result = await signInAnonymously(auth);
        logger.log('Anonymous sign-in successful:', result.user.uid);

        // Verify we got an ID token
        try {
            const token = await result.user.getIdToken();
            logger.debug('ID token obtained:', token.slice(0, 20) + '...');
        } catch (tokenErr) {
            logger.warn('Could not verify ID token:', tokenErr);
        }

        return result.user;
    } catch (err) {
        // Provide specific error messages for common issues
        if (err.code === 'auth/operation-not-supported-in-this-environment') {
            logger.error('Anonymous Auth NOT ENABLED in Firebase Console');
            throw {
                message: 'Anonymous authentication not available. Please contact administrator.',
                code: 'AUTH_NOT_ENABLED',
                original: err,
            };
        }
        if (err.code === 'auth/network-request-failed') {
            logger.error('Network error during anonymous auth');
            throw {
                message: 'Network error. Please check your connection and try again.',
                code: 'NETWORK_ERROR',
                original: err,
            };
        }

        logger.error('Failed to ensure anonymous auth:', err);
        throw {
            message: err.message || 'Authentication failed',
            code: err.code || 'UNKNOWN_ERROR',
            original: err,
        };
    }
}

/**
 * Sign in user with Firebase custom token (used after MSAL login)
 * @param {string} customToken - Firebase custom token from backend
 */
export async function signInWithToken(customToken) {
    try {
        if (!customToken) {
            throw new Error('Custom token is required');
        }

        logger.log('Signing in with custom token...');
        const result = await signInWithCustomToken(auth, customToken);
        logger.log('Custom token sign-in successful:', result.user.uid, result.user.email);
        return result.user;
    } catch (err) {
        logger.error('Failed to sign in with custom token:', err);
        throw err;
    }
}

/**
 * Sign out current user
 */
export async function firebaseSignOut() {
    try {
        logger.log('Signing out from Firebase...');
        await signOut(auth);
        logger.log('Sign-out successful');
    } catch (err) {
        logger.error('Failed to sign out:', err);
        throw err;
    }
}

/**
 * Get current authenticated user
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Get current user's Firebase ID token (for calling Cloud Functions)
 */
export async function getIdToken() {
    try {
        if (!auth.currentUser) {
            throw new Error('No user authenticated');
        }
        return await auth.currentUser.getIdToken();
    } catch (err) {
        logger.error('Failed to get ID token:', err);
        throw err;
    }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChanged(callback) {
    return auth.onAuthStateChanged((user) => {
        logger.debug('Auth state changed:', user ? user.email : 'no user');
        callback(user);
    });
}

export { auth };
