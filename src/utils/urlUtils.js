export function getRegisterBaseUrl() {
    const useProd = import.meta.env.VITE_PROJECT_PROD === 'true';
    const prod = (import.meta.env.VITE_PUBLIC_HOSTING_URL || '').trim();
    const local = (import.meta.env.VITE_LOCAL_REGISTER_BASE || 'http://localhost:5173/').trim();
    const base = useProd ? prod || `${window.location.origin}${window.location.pathname}` : local;
    if (!base) return '/';
    return base.endsWith('/') ? base : `${base}/`;
}

export function buildRegisterUrl(eventId) {
    const base = getRegisterBaseUrl();
    const hash = `#/register?event=${encodeURIComponent(eventId || '')}`;
    return `${base}${hash}`;
}
