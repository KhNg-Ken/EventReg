import axios from 'axios';
import { loginAndGetToken } from '../auth/index.js';

async function getToken() {
    return await loginAndGetToken();
}

function dataUrlToBase64(dataUrl) {
    if (!dataUrl) return null;
    const parts = dataUrl.split(',');
    if (parts.length === 2) return parts[1];
    // fallback: strip data:*;base64,
    return dataUrl.replace(/^data:.*;base64,/, '');
}

// Send an email with an embedded QR image using Microsoft Graph /me/sendMail
// to: recipient email address
// subject: email subject
// bodyText: plain-text body
// qrDataUrl: data URL of PNG/QR generated in the browser (data:image/png;base64,...)
export async function sendInviteEmail(to, subject, bodyText, qrDataUrl) {
    const token = await getToken();
    if (!token) throw new Error('No auth token available');

    const base64 = dataUrlToBase64(qrDataUrl);
    const attachments = [];
    if (base64) {
        attachments.push({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: 'invite.png',
            contentType: 'image/png',
            contentBytes: base64,
        });
    }

    const message = {
        subject: subject || 'Your event invite',
        body: {
            contentType: 'Text',
            content: bodyText || '',
        },
        toRecipients: [{ emailAddress: { address: to } }],
        attachments,
    };

    const url = 'https://graph.microsoft.com/v1.0/me/sendMail';
    try {
        await axios.post(
            url,
            { message, saveToSentItems: true },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return true;
    } catch (err) {
        console.error('Failed to send invite email:', err?.response?.data || err?.message || err);
        throw err;
    }
}
