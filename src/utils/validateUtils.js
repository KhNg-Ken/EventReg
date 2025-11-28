import { normalizePhone } from './stringUtils.js';

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
    if (!re.test(s)) return { ok: false, reason: 'Định dạng email không hợp lệ.' };
    return { ok: true };
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