import { collection, getDocs, getFirestore, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { isSignedIn } from '../auth/index.js';
import EventCard from '../components/EventCard/EventCard.jsx';
import PageFrame from '../components/PageFrame.jsx';
import { app } from '../firebase/config.js';
import createLogger from '../utils/logger.js';

const logger = createLogger('EventList');

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
                logger.error('Failed to load events from Firestore', err);
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
                    {events.map((ev) => {
                        const actions = signedIn ? (
                            <div style={{ display: 'inline-flex', gap: 8 }}>
                                <button
                                    className="tds-btn tds-btn-secondary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const liveHash = `#/liveposter?event=${encodeURIComponent(
                                            ev.id
                                        )}`;
                                        const statsHash = `#/checkin-statistics?event=${encodeURIComponent(
                                            ev.id
                                        )}`;
                                        // open poster in new window and navigate main tab to stats
                                        try {
                                            window.open(
                                                window.location.origin +
                                                    window.location.pathname +
                                                    liveHash,
                                                '_blank',
                                                'noopener'
                                            );
                                        } catch {
                                            window.open(liveHash, '_blank', 'noopener');
                                        }
                                        window.location.hash = statsHash;
                                    }}
                                    type="button"
                                >
                                    Live Checkin
                                </button>
                            </div>
                        ) : null;

                        return (
                            <EventCard
                                key={ev.id}
                                ev={ev}
                                actions={actions}
                                onClick={() =>
                                    typeof onSelectEvent === 'function' ? onSelectEvent(ev) : null
                                }
                            />
                        );
                    })}
                </div>
            )}
        </PageFrame>
    );
}
