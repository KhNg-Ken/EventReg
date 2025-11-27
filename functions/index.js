/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
import { setGlobalOptions } from 'firebase-functions';
setGlobalOptions({ maxInstances: 10 });

// Re-export organized function triggers from separate files.
export { sendQueuedEmail } from './sendQueuedEmail.js';
