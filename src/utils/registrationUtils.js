import QRCode from 'qrcode';
import { createLogger } from '../utils/logger.js';
import { deleteByToken, uploadToCloudinary } from './cloudinaryUtils.js';
import { normalizePhone, sanitizeString } from './conversionUtils.js';
import { registerUserProxy } from './registerProxy.js';

const logger = createLogger('registrationUtils');

/**
 * Generate an invite ID in the format `INV{eventID}-{first8CharsOfToken}`
 */
export function generateInviteId(eventID, token) {
    return `INV${eventID}-${token.slice(0, 8)}`;
}

export function makeEventId({ name, eventDate }) {
    const d = eventDate ? new Date(eventDate) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const datePart = `EVT${yy}${mm}${dd}`;
    const namePart = sanitizeString(name) || 'event';
    return `${datePart}-${namePart}`;
}

/**
 * Create Hmac token using Web Crypto API.
 * Falls back to random UUID or random string if secret is not set or HMAC fails.
 */
export async function generateHmacToken(message) {
    try {
        const secret = import.meta.env.VITE_QR_SECRET;
        if (!secret) {
            if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
            return Math.random().toString(36).slice(2);
        }
        const enc = new TextEncoder();
        const keyData = enc.encode(secret);
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
        const bytes = new Uint8Array(signature);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    } catch (err) {
        logger.warn('HMAC generation failed, using fallback token', err);
        if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
        return Math.random().toString(36).slice(2);
    }
}

/**
 * Generate a QR code data URL encoding eventID + phoneLast4 + token
 * @param {string} eventID
 * @param {string} phoneLast4
 * @param {string} token
 * @returns {Promise<string|null>} data URL of generated QR code
 */
export async function generateRegisterQr(eventID, phoneLast4, token) {
    try {
        let resultStr = eventID + phoneLast4 + token;
        return await QRCode.toDataURL(resultStr);
    } catch (err) {
        logger.error('QR generation failed', err);
        return null;
    }
}

/**
 * Compress an image file to be under maxBytes (default 4MB) by resizing and reducing quality.
 * Returns a new File object or null if compression fails.
 * @param {File} file
 * @param {number} maxBytes
 * @returns {Promise<File|null>}
 */
export async function compressImage(file, maxBytes = 4 * 1024 * 1024) {
    if (!file) return null;
    let imgBitmap;
    try {
        imgBitmap = await createImageBitmap(file);
    } catch {
        await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
        imgBitmap = await createImageBitmap(file);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let { width, height } = imgBitmap;

    const maxDim = 2000;
    if (Math.max(width, height) > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imgBitmap, 0, 0, width, height);

    const mime = 'image/jpeg';
    const qualitySteps = [0.92, 0.85, 0.75, 0.65, 0.55, 0.45];
    for (const q of qualitySteps) {
        const blob = await new Promise((res) => canvas.toBlob(res, mime, q));
        if (!blob) continue;
        if (blob.size <= maxBytes)
            return new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: mime });
    }

    let currWidth = width;
    let currHeight = height;
    while (currWidth > 400 && currHeight > 400) {
        currWidth = Math.round(currWidth * 0.8);
        currHeight = Math.round(currHeight * 0.8);
        canvas.width = currWidth;
        canvas.height = currHeight;
        ctx.drawImage(imgBitmap, 0, 0, currWidth, currHeight);
        const blob = await new Promise((res) => canvas.toBlob(res, mime, 0.7));
        if (!blob) break;
        if (blob.size <= maxBytes)
            return new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: mime });
    }

    const fallbackBlob = await new Promise((res) => canvas.toBlob(res, mime, 0.6));
    if (!fallbackBlob) return null;
    return new File([fallbackBlob], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: mime });
}

/**
 * Register an attendee under events/{eventDoc}/registrants with optional photo upload.
 * Returns { inviteId, token, qrCodeUrl }
 */
export async function registerAttendee({ eventDoc, attendee, photoFile, onProgress, config } = {}) {
    const phoneNormalized = normalizePhone(attendee.phone || '');
    const phoneLast4 = phoneNormalized.slice(-4);

    const token = await generateHmacToken(
        JSON.stringify({ eventDoc: eventDoc, email: attendee.email || '' })
    );

    const eventID = eventDoc ? eventDoc.replace(/^EVT/, '').split('-')[0] : '000000';

    let photoUrl = null;
    let photoUploadInfo = null; // store Cloudinary response for potential rollback
    if (photoFile) {
        // Enforce allowed image types to prevent unexpected uploads
        const allowedMime = ['image/png', 'image/jpeg', 'image/webp'];
        const fileType = (photoFile && photoFile.type) || '';
        // Also allow common jpg extension if MIME is missing
        const fileName = (photoFile && photoFile.name) || '';
        const ext = fileName.split('.').pop() ? fileName.split('.').pop().toLowerCase() : '';
        const allowedExt = ['png', 'jpeg', 'jpg', 'webp'];
        if (!allowedMime.includes(fileType) && !allowedExt.includes(ext)) {
            throw new Error('Unsupported image format. Allowed formats: png, jpeg, jpg, webp.');
        }
        try {
            const compressed = await compressImage(photoFile);
            const folder = eventDoc ? `events/${eventDoc}/photos` : 'events/photos';
            // Build a sanitized filename: {sanitized_name}_{last4}
            const nameSource = (attendee && (attendee.name || attendee.company)) || 'attendee';
            const sanitized = sanitizeString(nameSource) || 'attendee';
            const last4 = phoneLast4 || '0000';
            const publicId = `${sanitized}_${last4}_${eventID}`;

            const cloudRes = await uploadToCloudinary(compressed, {
                folder,
                publicId,
                onProgress: (p) => {
                    if (onProgress) onProgress(p / 100);
                },
            });
            // cloudRes contains secure_url, public_id, delete_token (if returned)
            photoUploadInfo = cloudRes;
            photoUrl = cloudRes?.secure_url || null;
        } catch (err) {
            logger.warn('Photo upload failed', err);
        }
    }

    // Generate QR data URL (used as fallback or for upload)
    const qrDataUrl = await generateRegisterQr(eventID, phoneLast4, token);

    // Try to upload the generated QR (data URI) to Cloudinary using unsigned preset 'reg_qr'
    // so emails receive a public HTTPS URL instead of a data URI which many email clients block.
    let qrCodeUrl = qrDataUrl;
    try {
        if (qrDataUrl && qrDataUrl.startsWith('data:')) {
            // Convert data URI to Blob
            const resp = await fetch(qrDataUrl);
            const blob = await resp.blob();
            const fileName = `qrcode_${token.slice(0, 8)}.png`;
            const file = new File([blob], fileName, { type: blob.type || 'image/png' });
            const folder = eventDoc ? `${eventDoc}/qrcodes` : 'events/qrcodes';
            const publicId = `qrcode_${Date.now().toString(36)}`;
            try {
                const cloudRes = await uploadToCloudinary(file, {
                    folder,
                    publicId,
                    uploadPreset: 'reg_qr',
                });
                if (cloudRes && cloudRes.secure_url) qrCodeUrl = cloudRes.secure_url;
                logger.log('QR code uploaded to Cloudinary', qrCodeUrl);
            } catch (e) {
                logger.warn('QR upload to Cloudinary failed, falling back to data URI', e);
            }
        }
    } catch (err) {
        logger.warn('Failed to convert or upload QR data URI', err);
    }

    // Call server callable to persist registrant via Admin SDK (complies with Firestore rules)
    let serverInviteId = null;
    try {
        const payload = {
            eventDoc,
            name: attendee.name || '',
            email: attendee.email || '',
            phone: attendee.phone || '',
            extra: {
                photoUrl,
                qrCodeUrl,
                token,
                position: attendee.position || null,
                company: attendee.company || null,
                phoneLast4: phoneLast4 || null,
                // include registrant display config (show/hide fields)
                config: config || null,
            },
        };
        const res = await registerUserProxy(payload);
        if (res && res.inviteId) serverInviteId = res.inviteId;
    } catch (err) {
        logger.error('Server registration failed', err);

        // Rollback: Clean up uploaded photo if it exists
        if (photoUploadInfo && photoUploadInfo.delete_token) {
            try {
                const cn = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
                if (cn) {
                    await deleteByToken(cn, photoUploadInfo.delete_token);
                    logger.log('Photo upload rolled back successfully');
                }
            } catch (cleanupErr) {
                logger.warn('Photo cleanup failed during rollback', cleanupErr);
            }
        }

        // Re-throw the error to cancel all subsequent operations (e.g., email sending)
        throw err;
    }

    return { inviteId: serverInviteId, qrCodeUrl };
}
