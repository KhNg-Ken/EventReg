/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Toast from '../components/Toast/Toast.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((text, options = {}) => {
        const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
        const t = { id, text, type: options.type || 'info' };
        setToasts((s) => [t, ...s]);
        return id;
    }, []);

    const closeToast = useCallback((id) => {
        setToasts((s) => s.filter((t) => t.id !== id));
    }, []);

    const value = useMemo(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="toast-container" aria-live="polite">
                {toasts.map((t) => (
                    <Toast key={t.id} id={t.id} text={t.text} type={t.type} onClose={closeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx;
}
