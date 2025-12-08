import { getApp } from 'firebase/app';
import {
    collection,
    doc as firestoreDoc,
    getDoc,
    getDocs,
    getFirestore,
    query,
    setDoc,
    where,
} from 'firebase/firestore';
import { normalizePhone, sanitizeString } from './stringUtils.js';

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

export async function readEventInfo(event) {
    if (!event) return { eventName: null, imageRequired: false, tableName: null };
    try {
        const app = getApp();
        const db = getFirestore(app);
        const dref = firestoreDoc(db, 'events', event);
        const snap = await getDoc(dref);
        console.log('readEventInfo:', snap.data());
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
 * Check for an existing attendee with the same email or phoneNumber in the event's attendees subcollection.
 * @param {import('firebase/firestore').Firestore} db - Firestore database instance
 * @param {string} eventDoc - canonical eventDoc (EVT...)
 * @param {{email?: string, phone?: string}} opts
 * @returns {Promise<{duplicate: boolean, field?: 'email'|'phone', doc?: any}>}
 */
export async function checkDuplicateRegistration(db, eventDoc, { email, phone } = {}) {
    try {
        const registrantsCol = collection(db, 'events', eventDoc, 'registrants');
        const normalizedEmail = email ? email.toString().trim().toLowerCase() : '';
        const normalizedPhone = phone ? normalizePhone(phone) : '';

        // First check by email. If email exists and phone differs -> block.
        if (normalizedEmail) {
            const q = query(registrantsCol, where('email', '==', normalizedEmail));
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

/**
 * Create an event document in `events` collection with a canonical ID `EVTYYMMDD-slug`.
 * @param {import('firebase/app').FirebaseApp} app
 * @param {{name: string, description?: string, endDate?: Date, eventDate?: Date}} opts
 * @returns {Promise<{docId:string, eventID:string}>}
 */
export async function createEvent(
    app,
    { name, description = '', endDate = null, eventDate = null } = {}
) {
    if (!name || !name.toString().trim()) throw new Error('Event name required');
    const db = getFirestore(app);
    // use makeEventId to produce EVTyyMMdd-slug

    // compute eventID as YYMMDD (without EVT prefix)
    const d = eventDate ? new Date(eventDate) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const eventID = `${yy}${mm}${dd}`;

    const docId = eventID + '-' + sanitizeString(name);

    const docRef = firestoreDoc(db, 'events', docId);
    const existing = await getDoc(docRef);
    if (existing.exists()) throw new Error('Event with this ID already exists');

    const payload = {
        name,
        description: description || '',
        endDate: endDate ? new Date(endDate) : null,
        eventDate: eventDate ? new Date(eventDate) : null,
        eventID,
        createdAt: new Date(),
    };

    await setDoc(docRef, payload);
    return { docId, eventID };
}
