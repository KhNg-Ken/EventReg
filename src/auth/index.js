import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest } from './config.js';

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
                    localStorage.setItem('tds_signed_in', '1');
                } catch (e) {
                    console.warn('localStorage unavailable', e);
                }
                return tokenResponse.accessToken;
            } catch (silentErr) {
                // silent acquisition failed - fall through to interactive if required
                // If interaction is required or failed, we'll attempt interactive below
                console.warn(
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
                const tokenResponse = await msalInstance.acquireTokenSilent({
                    account: loginResponse.account,
                    scopes: loginRequest.scopes,
                });
                try {
                    localStorage.setItem('tds_signed_in', '1');
                } catch (e) {
                    console.warn('localStorage unavailable', e);
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
                console.error('Interactive login (shared) failed:', e);
                throw e;
            }
        }

        console.error('Error during login or token acquisition:', err);
        throw err;
    }
}

// Helper to check whether a user is currently signed in (no interactive prompt)
export function isSignedIn() {
    try {
        // quick localStorage hint to survive reloads when msal may not be initialized yet
        try {
            const hint = localStorage.getItem('tds_signed_in');
            if (hint === '1') return true;
        } catch (e) {
            console.debug('localStorage unavailable', e);
        }

        const accounts = msalInstance.getAllAccounts();
        return Array.isArray(accounts) && accounts.length > 0;
    } catch {
        return false;
    }
}

// Sign the current user out using a popup (best-effort). Returns when complete.
export async function logout() {
    try {
        // ensure msal is initialized before calling logout APIs
        try {
            await msalInstance.initialize();
        } catch {
            // initialization failed or already initialized; continue and let specific call throw if needed
        }

        // try popup logout first
        await msalInstance.logoutPopup();
        try {
            localStorage.removeItem('tds_signed_in');
        } catch (e) {
            console.debug('localStorage unavailable', e);
        }
    } catch {
        try {
            // fallback to redirect logout
            await msalInstance.logoutRedirect();
            try {
                localStorage.removeItem('tds_signed_in');
            } catch (e) {
                console.debug('localStorage unavailable', e);
            }
        } catch (e) {
            console.warn('Logout failed', e);
            throw e;
        }
    }
}

// Ensure MSAL is initialized; components can await this before calling instance APIs
export async function ensureMsalInitialized() {
    try {
        await msalInstance.initialize();
        return true;
    } catch (e) {
        console.warn('MSAL initialization failed:', e);
        return false;
    }
}
