import { collection, getDocs, getFirestore, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import EventCard from '../components/EventCard/EventCard.jsx';
import PageFrame from '../components/PageFrame/PageFrame.jsx';
import QRLinkButton from '../components/QRLinkButton/QRLinkButton.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { app } from '../firebase/config.js';
import { adminDeleteEvent } from '../utils/adminProxy.js';
import { createLogger } from '../utils/logger.js';

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

export default function EventList() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const { isAdmin, loading: authLoading } = useAuth();
    const { showToast } = useToast();

    // Redirect non-admins to home
    useEffect(() => {
        if (!authLoading && !isAdmin) {
            window.location.hash = '#/';
        }
    }, [isAdmin, authLoading]);

    // load function is defined so other handlers can refresh list
    async function load() {
        setLoading(true);
        try {
            const db = getFirestore(app);
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

    useEffect(() => {
        if (!authLoading && isAdmin) {
            load();
        }
    }, [authLoading, isAdmin]);

    async function handleDeleteEvent(id) {
        if (!confirm('Delete this event? This cannot be undone.')) return;
        try {
            setLoading(true);
            await adminDeleteEvent({ id });
            await load();
        } catch (err) {
            logger.error('Failed to delete event', err);
            showToast(err?.message || 'Delete failed', { type: 'error' });
        } finally {
            setLoading(false);
        }
    }

    const subtitle = 'Quản lý các sự kiện của TDSouth';

    // Show loading while checking auth
    if (authLoading) {
        return (
            <PageFrame
                title="Danh sách sự kiện"
                subtitle="Đang kiểm tra quyền truy cập..."
                minHeight={360}
            >
                <SkeletonList />
            </PageFrame>
        );
    }

    // Don't render anything if not admin (will redirect)
    if (!isAdmin) {
        return null;
    }

    return (
        <PageFrame title="Danh sách sự kiện" subtitle={subtitle} minHeight={360}>
            {loading ? (
                <div>
                    <div style={{ marginBottom: 8, color: 'var(--gray)' }}>Đang tải sự kiện...</div>
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
                    <div style={{ color: 'var(--gray)' }}>
                        Hiện tại chưa có sự kiện nào được lên lịch. Hãy kiểm tra lại sau.
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <button
                            className="ui-btn btn-primary"
                            onClick={() => (window.location.hash = '#/create')}
                        >
                            Tạo sự kiện mới
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                    {events.map((ev) => {
                        const actions = (
                            <div style={{ display: 'inline-flex', gap: 8 }}>
                                <QRLinkButton
                                    eventId={ev.id}
                                    onError={(msg) => showToast(msg, { type: 'error' })}
                                />

                                <button
                                    className="ui-btn btn-secondary"
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
                                    Live
                                </button>

                                <button
                                    className="ui-btn btn-secondary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // navigate to update page for this event
                                        window.location.hash = `#/update?event=${encodeURIComponent(
                                            ev.id
                                        )}`;
                                    }}
                                    type="button"
                                >
                                    Edit
                                </button>
                                <button
                                    className="ui-btn danger btn-secondary "
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteEvent(ev.id);
                                    }}
                                    type="button"
                                >
                                    Delete
                                </button>
                            </div>
                        );

                        return (
                            <EventCard
                                key={ev.id}
                                ev={ev}
                                actions={actions}
                                onClick={() => {
                                    // Admins go to the update page when clicking the card
                                    window.location.hash = `#/update?event=${encodeURIComponent(
                                        ev.id
                                    )}`;
                                }}
                            />
                        );
                    })}
                </div>
            )}
        </PageFrame>
    );
}
