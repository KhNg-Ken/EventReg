import React from 'react';
import '../styles/RegisterForm.css';

export default function PageFrame({
    title,
    subtitle,
    actions,
    children,
    minHeight = 360,
    showBack = false,
    onBack = null,
}) {
    const handleBack = (e) => {
        e && e.stopPropagation();
        if (typeof onBack === 'function') return onBack();
        if (window && window.history && typeof window.history.back === 'function') {
            window.history.back();
        }
    };

    return (
        <div className="tds-form-wrap">
            <div className="tds-card" style={{ maxWidth: 1400 }}>
                <div className="tds-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {showBack ? (
                            <button
                                className="tds-btn tds-btn-secondary tds-back-btn"
                                type="button"
                                onClick={handleBack}
                                aria-label="Quay lại"
                                title="Quay lại"
                            >
                                ←
                            </button>
                        ) : null}

                        <div>
                            <div className="tds-title">{title}</div>
                            {subtitle ? <div className="tds-subtitle">{subtitle}</div> : null}
                        </div>
                    </div>

                    {actions ? <div style={{ marginLeft: 'auto' }}>{actions}</div> : null}
                </div>

                <div
                    style={{
                        padding: 16,
                        minHeight,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
