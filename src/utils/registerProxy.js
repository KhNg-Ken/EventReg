import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

const functions = getFunctions(app);

/**
 * Call the `registerUser` callable function on the server.
 * Payload should match the server's expected shape (see functions/registerUser.js).
 * Returns the callable result (e.g. { success: true, inviteId }).
 */
export async function registerUserProxy(payload) {
    try {
        const fn = httpsCallable(functions, 'registerUser');
        const res = await fn(payload);
        return res.data;
    } catch (err) {
        // Normalize callable errors for the UI
        const message = err?.message || 'Registration failed';
        const code = err?.code || null;
        throw { message, code, original: err };
    }
}

export default registerUserProxy;
