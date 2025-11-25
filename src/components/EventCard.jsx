import React from 'react';
import '../styles/DemoForm.css';

export default function EventCard({ ev, onClick, actions }) {
    const eventDate = ev?.eventDate ? new Date(ev.eventDate) : null;
    const endDate = ev?.endDate ? new Date(ev.endDate) : null;

    return (
        <div
            className="tds-event-card"
            tabIndex={0}
            onClick={(e) => {
                // allow button clicks to bubble separately
                if (e.target.tagName.toLowerCase() === 'button') return;
                if (typeof onClick === 'function') onClick(ev);
            }}
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 14,
                borderRadius: 10,
                border: '1px solid #ccc',
                cursor: typeof onClick === 'function' ? 'pointer' : 'default',
            }}
        >
            <div style={{ flex: '1 1 70%', minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{ev?.name || 'Untitled event'}</div>
                <div style={{ color: 'var(--tds-gray)', fontSize: 13, marginTop: 6 }}>
                    Ngày sự kiện: {eventDate ? eventDate.toLocaleString() : 'TBD'}
                </div>
            </div>

            <div style={{ textAlign: 'right', flex: '0 0 30%', minWidth: 160 }}>
                <div style={{ fontSize: 13, color: 'var(--tds-gray)' }}>
                    Hạn đăng ký: {endDate ? endDate.toLocaleDateString() : '—'}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    {actions}
                    <button
                        className="tds-btn tds-btn-primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (typeof onClick === 'function') onClick(ev);
                        }}
                        type="button"
                    >
                        Đăng ký
                    </button>
                </div>
            </div>
        </div>
    );
}
