import admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import * as adminActions from './adminActions.js';
import * as authActions from './authActions.js';
import { exportRegistrantsExcel } from './exportExcel.js';

admin.initializeApp();

export const adminCreateEvent = onCall(adminActions.adminCreateEvent);
export const adminUpdateEvent = onCall(adminActions.adminUpdateEvent);
export const adminDeleteEvent = onCall(adminActions.adminDeleteEvent);
export const setAdminClaims = authActions.setAdminClaims;
export const exchangeTokenForFirebase = authActions.exchangeTokenForFirebase;
export { exportRegistrantsExcel };
/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
functions.setGlobalOptions({
    maxInstances: 10,
    secrets: ['RECAPTCHA_SECRET', 'SENDGRID_API_KEY', 'AZURE_CLIENT_SECRET', 'MSAL_REFRESH_TOKEN'],
});

// Re-export organized function triggers from separate files.
export { msalCallback, msalLogin } from './msalOAuth.js';
export { registerUser } from './registerUser.js';
export { sendEmailViaGraph } from './sendEmailViaGraph.js';
export { sendQueuedEmail } from './sendQueuedEmail.js';
