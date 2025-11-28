export function sanitizeString(name) {
    if (!name) return '';

    return name
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function normalizePhone(phone) {
    if (!phone) return '';
    return phone.toString().replace(/\D/g, '');
}

// Return DD/MM/YYYY HH:MM AM/PM format
export function normalizedDateString(date) {
    if (!(date instanceof Date)) return '';

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    const hour12 = hh % 12 || 12;
    const ampm = hh >= 12 ? 'PM' : 'AM';
    return `${dd}/${mm}/${yyyy}, ${hour12}:${min} ${ampm}`;      
}