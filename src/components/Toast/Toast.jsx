import { useEffect } from 'react';
import './Toast.css';

export default function Toast({ id, type = 'info', text = '', onClose }) {
    useEffect(() => {
        const t = setTimeout(() => onClose && onClose(id), 4500);
        return () => clearTimeout(t);
    }, [id, onClose]);

    return (
        <div className={`toast toast-${type}`} role="status">
            <div className="toast-body">{text}</div>
            <button
                className="toast-close"
                onClick={() => onClose && onClose(id)}
                aria-label="Close"
            >
                ×
            </button>
        </div>
    );
}
