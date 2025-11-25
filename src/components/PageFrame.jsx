import React from 'react';
import '../styles/DemoForm.css';

export default function PageFrame({ title, subtitle, actions, children, minHeight = 360 }) {
    return (
        <div className="tds-form-wrap">
            <div className="tds-card" style={{ maxWidth: 1400 }}>
                <div className="tds-header">
                    <div>
                        <div className="tds-title">{title}</div>
                        {subtitle ? <div className="tds-subtitle">{subtitle}</div> : null}
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
