export function sanitizeForId(name) {
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