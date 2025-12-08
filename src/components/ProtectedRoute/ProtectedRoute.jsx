import { useAuth } from '../../contexts/AuthContext.jsx';

export default function ProtectedRoute({ adminOnly = false, children, loadingFallback = null }) {
    const { isAdmin, loading } = useAuth();

    // Default loading fallback if none provided: centered inline spinner
    const defaultFallback = (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray)' }}>
            <span className="spinner" aria-hidden="true" />
            <span style={{ marginLeft: 6 }}>Loading…</span>
        </div>
    );

    if (loading) return loadingFallback ?? defaultFallback;

    if (adminOnly && !isAdmin) {
        // redirect to login
        if (window.location.hash !== '#/login') window.location.hash = '#/login';
        return null;
    }

    return <>{children}</>;
}
