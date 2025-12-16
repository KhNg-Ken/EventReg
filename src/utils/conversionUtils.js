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


export function toRgba(hex, alpha = 1) {
    if (!hex) return `rgba(211, 47, 47, ${alpha})`;
    const raw = hex.replace('#', '');
    const normalized =
        raw.length === 3
            ? raw
                  .split('')
                  .map((c) => c + c)
                  .join('')
            : raw.padEnd(6, '0');
    const int = parseInt(normalized, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}