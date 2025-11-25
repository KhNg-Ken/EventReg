import React, { useEffect, useState } from 'react';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { app } from '../firebase/config.js';
import { isSignedIn } from '../auth/index.js';
import PageFrame from './PageFrame.jsx';
import EventCard from './EventCard.jsx';
import '../styles/RegisterForm.css';

function SkeletonList({ count = 3 }) {
    return (
        <div style={{ display: 'grid', gap: 12 }}>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 12,
                        borderRadius: 10,
                        border: '1px solid #eee',
                        background: '#fafafa',
                        minHeight: 64,
                    }}
                >
                    <div style={{ width: '60%' }}>
                        <div
                            style={{
                                height: 14,
                                width: '60%',
                                background: '#eee',
                                borderRadius: 4,
                            }}
                        />
                        <div
                            style={{
                                height: 12,
                                width: '40%',
                                background: '#f2f2f2',
                                borderRadius: 4,
                                marginTop: 8,
                            }}
                        />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div
                            style={{
                                height: 28,
                                width: 84,
                                background: '#eee',
                                borderRadius: 6,
                                display: 'inline-block',
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function EventList({ onSelectEvent } = {}) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [signedIn, setSignedIn] = useState(false);

    useEffect(() => {
        setSignedIn(isSignedIn());
        const db = getFirestore(app);
        async function load() {
            setLoading(true);
            try {
                const q = query(collection(db, 'events'), orderBy('eventDate', 'asc'));
                const snap = await getDocs(q);
                const items = snap.docs.map((d) => {
                    const raw = d.data();
                    // Normalize Firestore Timestamp fields to JS Date for safer rendering.
                    const eventDate = raw.eventDate
                        ? typeof raw.eventDate.toDate === 'function'
                            ? raw.eventDate.toDate()
                            : new Date(raw.eventDate)
                        : null;
                    const endDate = raw.endDate
                        ? typeof raw.endDate.toDate === 'function'
                            ? raw.endDate.toDate()
                            : new Date(raw.endDate)
                        : null;
                    return { id: d.id, ...raw, eventDate, endDate };
                });
                setEvents(items);
            } catch (err) {
                console.error('Failed to load events from Firestore', err);
                setEvents([]);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const subtitle = signedIn
        ? 'Bạn đang đăng nhập là một nhân viên của TDSouth!\nBạn sẽ thấy thêm thao tác quản trị.'
        : 'Xem các sự kiện hiện có tại TDSouth!';

    return (
        <PageFrame title="Danh sách sự kiện" subtitle={subtitle} minHeight={360}>
            {loading ? (
                <div>
                    <div style={{ marginBottom: 8, color: 'var(--tds-gray)' }}>
                        Đang tải sự kiện...
                    </div>
                    <SkeletonList />
                </div>
            ) : events.length === 0 ? (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        height: '100%',
                    }}
                >
                    <div style={{ fontSize: 18, fontWeight: 700 }}>Chưa có sự kiện</div>
                    <div style={{ color: 'var(--tds-gray)' }}>
                        Hiện tại chưa có sự kiện nào được lên lịch. Hãy kiểm tra lại sau.
                    </div>
                    {signedIn ? (
                        <div style={{ marginTop: 12 }}>
                            <button
                                className="tds-btn tds-btn-primary"
                                onClick={() => (window.location.hash = '#/create')}
                            >
                                Tạo sự kiện mới
                            </button>
                        </div>
                    ) : (
                        <div style={{ marginTop: 12 }}>
                            <button
                                className="tds-btn tds-btn-secondary"
                                onClick={() => (window.location.hash = '#/login')}
                            >
                                Đăng nhập để quản lý
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                    {events.map((ev) => (
                        <EventCard
                            key={ev.id}
                            ev={ev}
                            onClick={() =>
                                typeof onSelectEvent === 'function' ? onSelectEvent(ev) : null
                            }
                        />
                    ))}
                </div>
            )}
        </PageFrame>
    );
}
