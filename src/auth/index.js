import { PublicClientApplication } from '@azure/msal-browser';
import { createLogger } from '../utils/logger.js';
import { loginRequest, msalConfig } from './config.js';

const logger = createLogger('auth:index');

const msalInstance = new PublicClientApplication(msalConfig);

// Export instance for components that need direct access (e.g. to list accounts)
export { msalInstance };

// Ensure only one interactive loginPopup runs at a time
let interactivePromise = null;

export async function loginAndGetToken() {
    try {
        await msalInstance.initialize();

        // Try silent acquisition first using any existing account
        const accounts = msalInstance.getAllAccounts();
        if (accounts && accounts.length) {
            try {
                const tokenResponse = await msalInstance.acquireTokenSilent({
                    account: accounts[0],
                    scopes: loginRequest.scopes,
                });
                try {
                    localStorage.setItem('signed_in', '1');
                } catch (e) {
                    logger.warn('localStorage unavailable', e);
                }
                return tokenResponse.accessToken;
            } catch (silentErr) {
                // silent acquisition failed - fall through to interactive if required
                // If interaction is required or failed, we'll attempt interactive below
                logger.warn(
                    'Silent token acquisition failed, will attempt interactive if needed',
                    silentErr?.errorCode || silentErr?.message || silentErr
                );
            }
        }

        // If we're already running an interactive login, await it instead of starting another one
        if (interactivePromise) {
            return await interactivePromise;
        }

        // Start interactive login and keep a shared promise so concurrent callers wait
        interactivePromise = (async () => {
            try {
                const loginResponse = await msalInstance.loginPopup(loginRequest);

                // Store refresh token for Graph API email sending (admin only)
                try {
                    const email = loginResponse.account?.username?.toLowerCase();
                    const idTokenClaims = loginResponse.idTokenClaims || {};

                    // Only store token for authorized admin email
                    if (email === import.meta.env.VITE_ADMIN_EMAIL?.toLowerCase()) {
                        // MSAL doesn't expose refresh token directly in browser for security
                        // We'll need to use the account to get tokens when needed
                        // For now, log that admin logged in successfully
                        logger.log('Admin user logged in:', email);

                        // Note: Browser-based MSAL doesn't expose refresh tokens for security.
                        // The refresh token is stored securely by MSAL and used automatically
                        // for silent token acquisition. We cannot extract it client-side.
                        // Alternative: Use MSAL Node.js in a Cloud Function for server-side flow.
                    }
                } catch (tokenStoreErr) {
                    logger.warn('Failed to process admin login for token storage:', tokenStoreErr);
                    // Don't fail login if token storage fails
                }

                const tokenResponse = await msalInstance.acquireTokenSilent({
                    account: loginResponse.account,
                    scopes: loginRequest.scopes,
                });
                try {
                    localStorage.setItem('signed_in', '1');
                } catch (e) {
                    logger.warn('localStorage unavailable', e);
                }
                return tokenResponse.accessToken;
            } finally {
                // clear the promise so subsequent calls can start a new interaction if needed
                interactivePromise = null;
            }
        })();

        return await interactivePromise;
    } catch (err) {
        // If an interactive call was attempted elsewhere and we got an interaction_in_progress error,
        // wait for the interactivePromise if present.
        const code = err?.errorCode || err?.name || '';
        if (/interaction_in_progress|interaction_required/i.test(code) && interactivePromise) {
            try {
                return await interactivePromise;
            } catch (e) {
                logger.error('Interactive login (shared) failed:', e);
                throw e;
            }
        }

        logger.error('Error during login or token acquisition:', err);
        throw err;
    }
}

// Helper to check whether a user is currently signed in (no interactive prompt)
export function isSignedIn() {
    try {
        // Check MSAL accounts first (source of truth)
        const accounts = msalInstance.getAllAccounts();
        const hasAccounts = Array.isArray(accounts) && accounts.length > 0;
        logger.debug('Accounts found:', accounts);

        // Update localStorage to match MSAL state
        try {
            if (hasAccounts) {
                localStorage.setItem('signed_in', '1');
            } else {
                localStorage.removeItem('signed_in');
            }
        } catch (e) {
            logger.debug('localStorage unavailable', e);
        }

        return hasAccounts;
    } catch {
        return false;
    }
}

// Sign the current user out using a popup (best-effort). Returns when complete.
export async function logout() {
    // ensure msal is initialized before calling logout APIs
    try {
        await msalInstance.initialize();
    } catch {
        // initialization failed or already initialized; continue and let specific call throw if needed
    }

    // try popup logout first
    try {
        await msalInstance.logoutPopup();

        // Verify that MSAL no longer has any accounts; only then consider logout successful.
        try {
            const accounts = msalInstance.getAllAccounts();
            const signedOut = !Array.isArray(accounts) || accounts.length === 0;
            if (signedOut) {
                try {
                    localStorage.removeItem('signed_in');
                } catch (e) {
                    logger.debug('localStorage unavailable', e);
                }
                return true;
            }
            // Popup completed but accounts remain -> user likely cancelled or logout didn't complete
            return false;
        } catch (e) {
            logger.warn('Could not verify accounts after logoutPopup', e);
            return false;
        }
    } catch (popupErr) {
        // If popup path fails, attempt redirect logout as a fallback
        try {
            await msalInstance.logoutRedirect();
            // If redirect returns (rare), try to verify accounts similarly
            try {
                const accounts = msalInstance.getAllAccounts();
                const signedOut = !Array.isArray(accounts) || accounts.length === 0;
                if (signedOut) {
                    try {
                        localStorage.removeItem('signed_in');
                    } catch (e) {
                        logger.debug('localStorage unavailable', e);
                    }
                    return true;
                }
                return false;
            } catch (e) {
                logger.warn('Could not verify accounts after logoutRedirect', e);
                return false;
            }
        } catch (redirectErr) {
            logger.warn('Logout failed via popup and redirect', { popupErr, redirectErr });
            // propagate the redirect error since this is likely a genuine failure
            throw redirectErr;
        }
    }
}

// Ensure MSAL is initialized; components can await this before calling instance APIs
export async function ensureMsalInitialized() {
    try {
        await msalInstance.initialize();
        return true;
    } catch (e) {
        logger.warn('MSAL initialization failed:', e);
        return false;
    }
}
