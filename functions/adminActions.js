import admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

export function ensureAdmin(auth) {
    if (!auth || !auth.token) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (!auth.token.admin) {
        throw new HttpsError('permission-denied', 'Admin privileges required');
    }
}

export function slugifyName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

export async function adminCreateEvent(request) {
    ensureAdmin(request.auth);
    const data = request.data;
    const name = data?.name;
    if (!name || !String(name).trim()) {
        throw new HttpsError('invalid-argument', 'Event name required');
    }

    // Handle date for event ID generation
    const eventDateForId = data?.eventDate ? new Date(data.eventDate) : new Date();

    const yy = String(eventDateForId.getFullYear()).slice(-2);
    const mm = String(eventDateForId.getMonth() + 1).padStart(2, '0');
    const dd = String(eventDateForId.getDate()).padStart(2, '0');
    const eventID = `${yy}${mm}${dd}`;
    const docId = `EVT${eventID}-${slugifyName(name)}`;

    const docRef = admin.firestore().doc(`events/${docId}`);
    const snap = await docRef.get();
    if (snap.exists) {
        throw new HttpsError('already-exists', 'Event with this ID already exists');
    }

    // Convert Date objects to Firestore Timestamps
    const eventDateTimestamp = data?.eventDate
        ? admin.firestore.Timestamp.fromDate(new Date(data.eventDate))
        : null;
    const endDateTimestamp = data?.endDate
        ? admin.firestore.Timestamp.fromDate(new Date(data.endDate))
        : null;

    const payload = {
        name: String(name),
        description: data?.description || '',
        // Timestamp fields for querying/sorting - stored in local time
        eventDate: eventDateTimestamp,
        endDate: endDateTimestamp,
        eventID,
        // New structured config object (optionalX = true means the field is optional for users)
        config: {
            optionalCompany: !!data?.config?.optionalCompany,
            optionalPosition: !!data?.config?.optionalPosition,
            optionalImage: !!data?.config?.optionalImage,
        },
        status: data?.status || 'ongoing',
        location: data?.location || '',
        qrCodeUrl: data?.qrCodeUrl || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.set(payload);
    return { docId, eventID };
}

export async function adminUpdateEvent(request) {
    ensureAdmin(request.auth);
    const data = request.data;
    const id = data?.id;
    if (!id) throw new HttpsError('invalid-argument', 'Event id required');

    const docRef = admin.firestore().doc(`events/${id}`);
    const snap = await docRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Event not found');

    const update = {};
    if (data?.name) update.name = String(data.name);
    if (Object.prototype.hasOwnProperty.call(data, 'description'))
        update.description = data.description || '';
    if (Object.prototype.hasOwnProperty.call(data, 'location'))
        update.location = data.location || '';
    if (data?.eventDate)
        update.eventDate = admin.firestore.Timestamp.fromDate(new Date(data.eventDate));
    if (data?.endDate) update.endDate = admin.firestore.Timestamp.fromDate(new Date(data.endDate));
    if (Object.prototype.hasOwnProperty.call(data, 'requireCompany'))
        update.requireCompany = !!data.requireCompany;
    if (Object.prototype.hasOwnProperty.call(data, 'requirePosition'))
        update.requirePosition = !!data.requirePosition;
    if (Object.prototype.hasOwnProperty.call(data, 'requirePhoto'))
        update.requirePhoto = !!data.requirePhoto;
    if (data?.config) {
        update.config = {
            optionalCompany: !!data.config.optionalCompany,
            optionalPosition: !!data.config.optionalPosition,
            optionalImage: !!data.config.optionalImage,
        };
        // keep backward-compatible flags in sync (optional -> require = !optional)
        update.requireCompany = !update.config.optionalCompany;
        update.requirePosition = !update.config.optionalPosition;
        update.requirePhoto = !update.config.optionalImage;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'status')) update.status = data.status;

    update.editedAt = admin.firestore.FieldValue.serverTimestamp();

    await docRef.set(update, { merge: true });
    return { id };
}

export async function adminDeleteEvent(request) {
    ensureAdmin(request.auth);
    const data = request.data;
    const id = data?.id;
    if (!id) throw new HttpsError('invalid-argument', 'Event id required');

    const docRef = admin.firestore().doc(`events/${id}`);
    const snap = await docRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Event not found');

    await docRef.delete();
    return { id };
}
