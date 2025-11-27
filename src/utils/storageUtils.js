import {
    getStorage,
    ref as storageRef,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
} from 'firebase/storage';
import {
    getFirestore,
    doc as firestoreDoc,
    setDoc,
    getDoc
} from 'firebase/firestore';
import { makeEventId } from './registrationUtils.js';

/**
 * Upload a file to Firebase Storage with progress callback and return the download URL.
 * @param {import('firebase/app').FirebaseApp} app - Firebase app instance
 * @param {string} path - Storage path (e.g. `events/${eventID}/attendees/${docId}/photo.jpg`)
 * @param {File|Blob} file - File to upload
 * @param {(progressPercent: number) => void} [onProgress] - optional progress callback
 * @returns {Promise<string>} download URL
 */
export function uploadFile(app, path, file, onProgress) {
    const storage = getStorage(app);
    const ref = storageRef(storage, path);
    const uploadTask = uploadBytesResumable(ref, file);

    return new Promise((resolve, reject) => {
        uploadTask.on(
            'state_changed',
            (snapshot) => {
                if (onProgress && snapshot.totalBytes) {
                    const percent = Math.round(
                        (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    );
                    try {
                        onProgress(percent);
                    } catch {
                        // ignore user callback errors
                    }
                }
            },
            (error) => {
                reject(error);
            },
            async () => {
                try {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(url);
                } catch (e) {
                    reject(e);
                }
            }
        );
    });
}

/**
 * Delete a file from Firebase Storage
 * @param {import('firebase/app').FirebaseApp} app
 * @param {string} path
 * @returns {Promise<void>}
 */
export async function deleteFile(app, path) {
    const storage = getStorage(app);
    const ref = storageRef(storage, path);
    await deleteObject(ref);
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
    const ev = { name, eventDate };
    // use makeEventId to produce EVTyyMMdd-slug
    const docId = makeEventId(ev);

    // compute eventID as YYMMDD (without EVT prefix)
    const d = eventDate ? new Date(eventDate) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const eventID = `${yy}${mm}${dd}`;

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
