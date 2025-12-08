export function toDateObject(value) {
    if (!value) return null;
    // Firestore Timestamp has toDate()
    if (typeof value.toDate === 'function') return value.toDate();
    // Already a Date
    if (value instanceof Date) return value;
    // If it's a numeric seconds-based object (legacy), try to convert
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        try {
            return new Date(value.seconds * 1000);
        } catch {
            return null;
        }
    }
    // Try parsing string or number
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatForDatetimeLocal(date) {
    if (!date) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const YYYY = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const DD = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
}

export function normalizedDateString(date) {
    const d = toDateObject(date);
    if (!d) return '';

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = Number(d.getHours());
    const min = String(d.getMinutes()).padStart(2, '0');

    const hour12 = hh % 12 || 12;
    const ampm = hh >= 12 ? 'PM' : 'AM';
    return `${dd}/${mm}/${yyyy}, ${hour12}:${min} ${ampm}`;
}

export default {
    toDateObject,
    formatForDatetimeLocal,
    normalizedDateString,
};
