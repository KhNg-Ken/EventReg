import admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';

const adminEmail = defineString('AZURE_ADMIN_EMAIL');

/**
 * Cloud Function to set admin custom claims for a user after they've successfully
 * logged in via MSAL. This function should be called from the backend or a trusted
 * endpoint after MSAL authentication succeeds.
 *
 * Expected data:
 * - email: string (user's email)
 * - uid?: string (Firebase user ID - if not provided, will look up by email)
 *
 * Returns: { success: true, message: 'Admin claims set' }
 */
export const setAdminClaims = onCall(async (req) => {
    console.log('=== setAdminClaims called ===');
    console.log('Request data:', req.data);
    
    const { email, uid } = req.data || {};
    
    // Get admin email from environment or use default
    const adminEmailValue = adminEmail.value();
    
    console.log('Checking email:', email, 'against admin:', adminEmailValue);

    // Verify email is provided
    if (!email) {
        console.error('No email provided');
        throw new HttpsError('invalid-argument', 'Email is required');
    }
    
    // Verify email matches authorized admin
    if (email.toLowerCase() !== adminEmailValue.toLowerCase()) {
        console.error('Email does not match admin:', email);
        throw new HttpsError('permission-denied', 'Not authorized to set admin claims');
    }

    try {
        let userId = uid;

        // If uid not provided, look up user by email
        if (!userId) {
            try {
                const user = await admin.auth().getUserByEmail(email);
                userId = user.uid;
            } catch (err) {
                if (err.code === 'auth/user-not-found') {
                    // User doesn't exist yet in Firebase Auth
                    // This can happen if they haven't signed in to Firebase yet
                    throw new HttpsError('not-found', 'User not found in Firebase Auth');
                }
                throw err;
            }
        }

        // Set custom claims for admin access
        await admin.auth().setCustomUserClaims(userId, { admin: true });

        return {
            success: true,
            message: 'Admin claims set successfully',
            uid: userId,
            email,
        };
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        console.error('Error setting admin claims:', err);
        throw new HttpsError('internal', 'Failed to set admin claims: ' + err.message);
    }
});

/**
 * Cloud Function to exchange an MSAL access token for a Firebase custom token.
 * This allows users authenticated via MSAL to sign into Firebase.
 *
 * Expected data:
 * - msalAccessToken: string (JWT access token from MSAL)
 * - email: string (user's email from MSAL)
 *
 * Returns: { firebaseToken: string }
 */
export const exchangeTokenForFirebase = onCall(async (req) => {
    console.log('=== exchangeTokenForFirebase called ===');
    console.log('Request data keys:', Object.keys(req.data || {}));
    
    const { msalAccessToken, email } = req.data || {};

    if (!msalAccessToken || !email) {
        console.error('Missing required fields - msalAccessToken:', !!msalAccessToken, 'email:', !!email);
        throw new HttpsError('invalid-argument', 'msalAccessToken and email are required');
    }
    
    console.log('Processing token exchange for email:', email);

    try {
        // Verify the MSAL token is valid by checking its structure
        const tokenParts = msalAccessToken.split('.');
        if (tokenParts.length !== 3) {
            throw new Error('Invalid token format');
        }

        // Decode the payload using atob
        const decodedPayload = atob(tokenParts[1]);
        const payload = JSON.parse(decodedPayload);

        // Basic validation: check email matches
        if (
            payload.preferred_username &&
            payload.preferred_username.toLowerCase() !== email.toLowerCase()
        ) {
            throw new Error('Token email does not match provided email');
        }

        // Get or create Firebase user account
        let userId;
        try {
            const existingUser = await admin.auth().getUserByEmail(email);
            userId = existingUser.uid;
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                // Create new Firebase user
                const newUser = await admin.auth().createUser({
                    email: email,
                    emailVerified: payload.email_verified || false,
                    displayName: payload.name || email.split('@')[0],
                });
                userId = newUser.uid;
                console.log('Created new Firebase user:', userId);
            } else {
                throw err;
            }
        }

        // Create a custom token for this user
        const customToken = await admin.auth().createCustomToken(userId);

        return {
            firebaseToken: customToken,
            uid: userId,
            email,
        };
    } catch (err) {
        console.error('Error exchanging token for Firebase:', err);
        throw new HttpsError('internal', 'Failed to exchange token: ' + err.message);
    }
});

/**
 * Verify if a user is an admin by checking their custom claims.
 * This is a helper function for other Cloud Functions.
 *
 * Expected: context.auth.token.admin === true
 * Returns: boolean
 */
export function isAdmin(context) {
    return context?.auth?.token?.admin === true;
}

/**
 * Verify authentication is present.
 * Returns: boolean
 */
export function isAuthenticated(context) {
    return context?.auth !== null && context?.auth !== undefined;
}
