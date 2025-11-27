import { sanitizeForId } from './stringUtils.js';

/**
 * Generate an event ID based on event name and date
 * @param {{name: string, eventDate?: Date}} ev
 * @returns {string} eventDoc as Firestore document in format EVTYYMMDD-slug
 */
 
export function makeFirebaseEventDoc(ev) {
    const date = ev && ev.eventDate ? new Date(ev.eventDate) : new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yymmdd = `${yy}${mm}${dd}`;
    const slug = sanitizeForId(ev && ev.name ? ev.name : 'event');
    return `EVT${yymmdd}-${slug}`;
}
