import QRCode from 'qrcode';
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
import { uploadFile } from './storageUtils.js';

export function normalizePhone(phone) {
    if (!phone) return '';
    return phone.toString().replace(/\D/g, '');
}

export function validatePhoneNumber(phone) {
    const p = normalizePhone(phone);
    if (!p) return { ok: false, reason: 'Số điện thoại trống.' };
    if (!/^\d+$/.test(p)) return { ok: false, reason: 'Số điện thoại chỉ chứa chữ số.' };
    if (!p.startsWith('0')) return { ok: false, reason: 'Số điện thoại phải bắt đầu bằng 0.' };
    if (p.startsWith('02')) {
        if (p.length !== 11) return { ok: false, reason: 'Số bắt đầu bằng 02 phải có 11 chữ số.' };
    } else {
        if (p.length !== 10) return { ok: false, reason: 'Số điện thoại phải có 10 chữ số.' };
    }
    return { ok: true };
}

export function validateEmailFormat(email) {
    if (!email) return { ok: false, reason: 'Email trống.' };
    const s = email.toString().trim().toLowerCase();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return { ok: re.test(s) };
}

export function sanitizeForId(name) {
    if (!name) return '';
    try {
        name = name.normalize('NFKD').replace(/\p{Diacritic}/gu, '');
    } catch {
        name = name.replace(/[\u0300-\u036f]/g, '');
    }
    return name
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function makeEventId(ev) {
    const date = ev && ev.eventDate ? new Date(ev.eventDate) : new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yymmdd = `${yy}${mm}${dd}`;
    const slug = sanitizeForId(ev && ev.name ? ev.name : 'event');
    return `EVT${yymmdd}-${slug}`;
}

export function generateInviteId() {
    const num = Math.floor(Math.random() * 900000) + 100000; // 6 digits
    const s = String(num).padStart(6, '0');
    return `EVT${s.slice(0, 3)}-${s.slice(3)}`;
}

/**
 * List events from Firestore `events` collection. Falls back to localStorage if Firestore is not available.
 */
export async function listEventWorkbooks() {
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
    return [{ id: 'EVT001-000', name: 'TDSouth - Sample Event' }];
}

export async function readEventConfig(eventId) {
    if (!eventId) return { eventName: null, imageRequired: false, tableName: null };
    try {
        const app = getApp();
        const db = getFirestore(app);
        const dref = firestoreDoc(db, 'events', eventId);
        const snap = await getDoc(dref);
        if (snap.exists()) return snap.data();
    } catch {
        // ignore
    }
    try {
        const raw = localStorage.getItem(`tds_event_config_${eventId}`);
        if (raw) return JSON.parse(raw);
    } catch {
        // ignore
    }
    return { eventName: null, imageRequired: false, tableName: 'registrations' };
}

/**
 * Register an attendee under events/{eventId}/attendees with optional photo upload.
 * Returns { inviteId, token, qrDataUrl }
 */
export async function registerAttendee({ eventId, attendee, photoFile, onProgress } = {}) {
    const inviteId = generateInviteId();
    const token = await generateHmacToken(
        JSON.stringify({ inviteId, email: attendee.email || '' })
    );

    const phoneNormalized = normalizePhone(attendee.phone || '');
    const phoneLast4 = phoneNormalized.slice(-4);

    let photoUrl = null;
    if (photoFile) {
        try {
            const compressed = await compressImage(photoFile);
            const app = getApp();
            const path = `events/${eventId}/attendees/${inviteId}/${compressed.name}`;
            photoUrl = await uploadFile(app, path, compressed, (p) => {
                if (onProgress) onProgress(p / 100);
            });
        } catch (err) {
            console.warn('Photo upload failed', err);
        }
    }

    try {
        const app = getApp();
        const db = getFirestore(app);
        const attendeesCol = collection(db, 'events', eventId, 'attendees');
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
        console.warn('Failed to write attendee to Firestore, falling back to localStorage', err);
        try {
            const key = `tds_registrations_${eventId || 'default'}`;
            const raw = localStorage.getItem(key);
            const list = raw ? JSON.parse(raw) : [];
            list.push({ inviteId, token, attendee, photoUrl, createdAt: new Date().toISOString() });
            localStorage.setItem(key, JSON.stringify(list));
        } catch (e) {
            console.warn('Local fallback failed', e);
        }
    }

    // derive event short id (YYMMDD) from eventId like EVTYYMMDD-slug
    let eventShort = null;
    try {
        const m = (eventId || '').match(/^EVT(\d{6})/);
        if (m) eventShort = m[1];
        else eventShort = new Date().toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
    } catch {
        eventShort = new Date().toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
    }

    const qrDataUrl = await generateQr(eventShort, phoneLast4, token);
    return { inviteId, token, qrDataUrl };
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
        return await QRCode.toDataURL(JSON.stringify({ eventID, phoneLast4, token }));
    } catch (err) {
        console.error('QR generation failed', err);
        return null;
    }
}

/**
 * Check for an existing attendee with the same email or phoneNumber in the event's attendees subcollection.
 * @param {import('firebase/firestore').Firestore} db - Firestore database instance
 * @param {string} eventID - canonical event id (EVT...)
 * @param {{email?: string, phone?: string}} opts
 * @returns {Promise<{duplicate: boolean, field?: 'email'|'phone', doc?: any}>}
 */
export async function checkDuplicateRegistration(db, eventID, { email, phone } = {}) {
    try {
        const attendeesCol = collection(db, 'events', eventID, 'attendees');
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

export function validateImageFile(file) {
    if (!file) return { ok: false, reason: 'No file' };
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type))
        return { ok: false, reason: 'Định dạng ảnh không được hỗ trợ (jpg/png/webp).' };
    if (file.size > 25 * 1024 * 1024)
        return { ok: false, reason: 'Tệp quá lớn (hạn chế 25MB trước khi nén).' };
    return { ok: true };
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
