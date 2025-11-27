import QRCode from 'qrcode';
import { uploadToCloudinary, deleteByToken } from './cloudinary';
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc as firestoreDoc,
    addDoc,
    serverTimestamp,
    getFirestore,
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { sanitizeForId, normalizePhone } from './stringUtils';

export function generateInviteId(eventID, token) {
    return `INV${eventID}-${token.slice(0, 8)}`;
}

/**
 * List events from Firestore `events` collection. Falls back to localStorage if Firestore is not available.
 */
export async function listEvents() {
    try {
        const app = getApp();
        const db = getFirestore(app);
        const col = collection(db, 'events');
        const snap = await getDocs(col);
        const out = [];
        snap.forEach((d) => {
            const data = d.data();
            out.push({ id: d.id, name: data.name || d.id, ...data });
        });
        if (out.length) return out;
    } catch {
        // ignore - fall back to localStorage
    }
    try {
        const raw = localStorage.getItem('tds_events');
        if (raw) return JSON.parse(raw);
    } catch {
        // ignore
    }
    return [{ id: 'EVT000000', name: 'TDSouth - Sample Event' }];
}

export async function readEventConfig(event) {
    if (!event) return { eventName: null, imageRequired: false, tableName: null };
    try {
        const app = getApp();
        const db = getFirestore(app);
        const dref = firestoreDoc(db, 'events', event);
        const snap = await getDoc(dref);
        if (snap.exists()) return snap.data();
    } catch {
        // ignore
    }
    try {
        const raw = localStorage.getItem(`tds_event_config_${event}`);
        if (raw) return JSON.parse(raw);
    } catch {
        // ignore
    }
    return { eventName: null, imageRequired: false, tableName: 'registrations' };
}

/**
 * Register an attendee under events/{eventDoc}/registrants with optional photo upload.
 * Returns { inviteId, token, qrCodeUrl }
 */
export async function registerAttendee({ eventDoc, attendee, photoFile, onProgress } = {}) {
    const phoneNormalized = normalizePhone(attendee.phone || '');
    const phoneLast4 = phoneNormalized.slice(-4);

    const token = await generateHmacToken(JSON.stringify({ eventDoc: eventDoc, email: attendee.email || '' }));

    const eventID = eventDoc ? eventDoc.replace(/^EVT/, '').split('-')[0] : '000000';
    const inviteId = generateInviteId(eventID, token);

    let photoUrl = null;
    let photoUploadInfo = null; // store Cloudinary response for potential rollback
    if (photoFile) {
        try {
            const compressed = await compressImage(photoFile);
            const folder = eventDoc ? `events/${eventDoc}/photos` : 'events/photos';
            // Build a sanitized filename: {sanitized_name}_{last4}
            const nameSource = (attendee && (attendee.name || attendee.company)) || 'attendee';
            const sanitized = sanitizeForId(nameSource) || 'attendee';
            const last4 = phoneLast4 || '0000';
            const publicId = `${sanitized}_${last4}`;

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
            console.warn('Photo upload failed', err);
        }
    }

    try {
        const app = getApp();
        const db = getFirestore(app);
        const attendeesCol = collection(db, 'events', eventDoc, 'registrants');
        const payload = {
            company: attendee.company || null,
            createdAt: serverTimestamp(),
            email: attendee.email ? attendee.email.toString().trim().toLowerCase() : null,
            name: attendee.name || null,
            phoneLast4: phoneLast4 || null,
            phoneNumber: attendee.phone || null,
            position: attendee.position || null,
            token,
            inviteId,
            photoUrl,
        };
        await addDoc(attendeesCol, payload);
    } catch (err) {
        console.warn(
            'Failed to write attendee to Firestore, attempting rollback/cleanup and falling back to localStorage',
            err
        );
        // Attempt to clean up uploaded photo if possible
        try {
            const cn = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
            if (photoUploadInfo && photoUploadInfo.delete_token && cn) {
                // Try immediate delete by token
                try {
                    await deleteByToken(cn, photoUploadInfo.delete_token);
                } catch (e) {
                    console.warn('Immediate delete_by_token failed', e);
                }
            } else if (photoUploadInfo && photoUploadInfo.public_id) {
                // As a fallback, enqueue a cleanup job in Firestore `media_cleanup`
                try {
                    const app = getApp();
                    const db = getFirestore(app);
                    const col = collection(db, 'media_cleanup');
                    await addDoc(col, {
                        public_id: photoUploadInfo.public_id,
                        eventDoc,
                        queuedAt: serverTimestamp(),
                    });
                } catch (e) {
                    // If we can't write to Firestore either, give up and leave the asset; operator can prune later.
                    console.warn('Failed to enqueue media cleanup', e);
                }
            }
        } catch (cleanupErr) {
            console.warn('Photo cleanup attempt failed', cleanupErr);
        }
        try {
            const key = `tds_registrations_${eventDoc || 'default'}`;
            const raw = localStorage.getItem(key);
            const list = raw ? JSON.parse(raw) : [];
            list.push({ inviteId, token, attendee, photoUrl, createdAt: new Date().toISOString() });
            localStorage.setItem(key, JSON.stringify(list));
        } catch (e) {
            console.warn('Local fallback failed', e);
        }
    }

    const qrDataUrl = await generateQr(eventID, phoneLast4, token);

    // Try to upload the generated QR (data URI) to Cloudinary using unsigned preset 'reg_qr'
    // so emails receive a public HTTPS URL instead of a data URI which many email clients block.
    let qrCodeUrl = qrDataUrl;
    try {
        if (qrDataUrl && qrDataUrl.startsWith('data:')) {
            // Convert data URI to Blob
            const resp = await fetch(qrDataUrl);
            const blob = await resp.blob();
            const fileName = `qrcode_${inviteId}.png`;
            const file = new File([blob], fileName, { type: blob.type || 'image/png' });
            const folder = eventDoc ? `${eventDoc}/qrcodes` : 'events/qrcodes';
            const publicId = `qrcode_${inviteId}`;
            try {
                const cloudRes = await uploadToCloudinary(file, {
                    folder,
                    publicId,
                    uploadPreset: 'reg_qr',
                });
                if (cloudRes && cloudRes.secure_url) qrCodeUrl = cloudRes.secure_url;
                console.log('QR code uploaded to Cloudinary', qrCodeUrl);
            } catch (e) {
                console.warn('QR upload to Cloudinary failed, falling back to data URI', e);
            }
        }
    } catch (err) {
        console.warn('Failed to convert or upload QR data URI', err);
    }

    return { inviteId, qrCodeUrl };
}

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
        console.warn('HMAC generation failed, using fallback token', err);
        if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
        return Math.random().toString(36).slice(2);
    }
}

export async function generateQr(eventID, phoneLast4, token) {
    try {
        let resultStr = eventID + phoneLast4 + token;
        return await QRCode.toDataURL(resultStr);
    } catch (err) {
        console.error('QR generation failed', err);
        return null;
    }
}

/**
 * Check for an existing attendee with the same email or phoneNumber in the event's attendees subcollection.
 * @param {import('firebase/firestore').Firestore} db - Firestore database instance
 * @param {string} eventDoc - canonical eventDoc (EVT...)
 * @param {{email?: string, phone?: string}} opts
 * @returns {Promise<{duplicate: boolean, field?: 'email'|'phone', doc?: any}>}
 */
export async function checkDuplicateRegistration(db, eventDoc, { email, phone } = {}) {
    try {
        const attendeesCol = collection(db, 'events', eventDoc, 'attendees');
        const normalizedEmail = email ? email.toString().trim().toLowerCase() : '';
        const normalizedPhone = phone ? normalizePhone(phone) : '';

        // First check by email. If email exists and phone differs -> block.
        if (normalizedEmail) {
            const q = query(attendeesCol, where('email', '==', normalizedEmail));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const existing = snap.docs[0].data();
                const existingPhone = existing.phoneNumber
                    ? normalizePhone(existing.phoneNumber)
                    : '';
                if (!existingPhone || (normalizedPhone && existingPhone !== normalizedPhone)) {
                    // Email exists but phone is different (or missing) -> block (to prevent mistyped email reuse)
                    return { duplicate: true, field: 'email', doc: existing };
                }
                // exact match on email+phone -> duplicate
                return { duplicate: true, field: 'email', doc: existing };
            }
        }

        // If email not found, allow same phone with different email per requirement.
        return { duplicate: false };
    } catch (err) {
        console.warn('Duplicate check failed', err);
        return { duplicate: false };
    }
}

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
