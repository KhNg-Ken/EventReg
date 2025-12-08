import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config.js';

const functions = getFunctions(app);

async function call(name, payload) {
    try {
        const fn = httpsCallable(functions, name);
        const res = await fn(payload);
        return res.data;
    } catch (err) {
        // Provide clearer failure hints for missing/unauthorized callables.
        const original = err;
        const message = err?.message || 'Server call failed';
        const code = err?.code || null;
        // If the callable is not deployed or the user is unauthorized, include actionable hints.
        let hint = '';
        if (message && /not found|not exist/i.test(message)) {
            hint = ' The callable was not found. Deploy the function to Firebase Functions.';
        }
        if (code === 'permission-denied' || /permission-denied|unauthorized/i.test(message)) {
            hint =
                ' Permission denied: ensure the signed-in user has the admin custom claim.' + hint;
        }
        throw { message: message + hint, code, original };
    }
}

export async function adminCreateEvent(payload) {
    return call('adminCreateEvent', payload);
}

export async function adminUpdateEvent(payload) {
    return call('adminUpdateEvent', payload);
}

export async function adminDeleteEvent(payload) {
    return call('adminDeleteEvent', payload);
}

export default { adminCreateEvent, adminUpdateEvent, adminDeleteEvent };
