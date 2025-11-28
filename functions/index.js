/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
import { setGlobalOptions } from 'firebase-functions';
setGlobalOptions({
    maxInstances: 10,
    secrets: ['RECAPTCHA_SECRET', 'SENDGRID_API_KEY'], 
});

// Re-export organized function triggers from separate files.
export { registerUser } from './registerUser.js';
export { sendQueuedEmail } from './sendQueuedEmail.js';
