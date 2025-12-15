import { collection, getDocs, getFirestore, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import AdminButtonPanel from '../../components/AdminButtonPanel/AdminButtonPanel.jsx';
import EventCard from '../../components/EventCard/EventCard.jsx';
import PageFrame from '../../components/PageFrame/PageFrame.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { app } from '../../firebase/config.js';
import keyboard_arrow_down from '../../assets/icons/keyboard_arrow_down_40.svg';

import { createLogger } from '../../utils/logger.js';
import './EventList.css';

const logger = createLogger('EventList');

function SkeletonList({ count = 4 }) {
    return (
        <div className="skeleton-list">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="skeleton-item">
                    <div className="skeleton-content">
                        <div className="skeleton-title" />
                        <div className="skeleton-subtitle" />
                    </div>
                    <div className="skeleton-action">
                        <div className="skeleton-button" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function EventList() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openAccordions, setOpenAccordions] = useState({
        ongoing: true,
        completed: false,
        hiatus: false,
    });
    const { isAdmin, loading: authLoading } = useAuth();
    const statuses = ['ongoing', 'completed', 'hiatus'];
    const vn_status_labels = {
        ongoing: 'Đang diễn ra',
        completed: 'Đã hoàn thành',
        hiatus: 'Tạm ngưng',
    };

    const toggleAccordion = (status) => {
        setOpenAccordions((prev) => ({
            ...prev,
            [status]: !prev[status],
        }));
    };
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

    const subtitle = 'Quản lý các sự kiện của TDSouth';

    // Show loading while checking auth
    if (authLoading) {
        return (
            <PageFrame title="Danh sách sự kiện" subtitle="Đang kiểm tra quyền truy cập...">
                <SkeletonList />
            </PageFrame>
        );
    }

    // Don't render anything if not admin (will redirect)
    if (!isAdmin) {
        return null;
    }

    return (
        <PageFrame title="Danh sách sự kiện" subtitle={subtitle}>
            {loading ? (
                <div>
                    <div className="event-loading-message">Đang tải sự kiện...</div>
                    <SkeletonList />
                </div>
            ) : events.length === 0 ? (
                <div className="event-list-empty">
                    <div className="event-list-empty-title">Chưa có sự kiện</div>
                    <div className="event-list-empty-message">
                        Hiện tại chưa có sự kiện nào được lên lịch. Hãy kiểm tra lại sau.
                    </div>
                    <div className="event-list-empty-action">
                        <button
                            className="ui-btn btn-primary"
                            onClick={() => (window.location.hash = '#/create')}
                        >
                            Tạo sự kiện mới
                        </button>
                    </div>
                </div>
            ) : (
                <div className="event-list-flex">
                    {statuses.map((status) => (
                        <>
                            <button
                                className={`accordion ${openAccordions[status] ? 'active' : ''}`}
                                onClick={() => toggleAccordion(status)}
                            >
                                <span>
                                    {vn_status_labels[status]} (
                                    {events.filter((ev) => ev.status === status).length})
                                </span>
                                <img src={keyboard_arrow_down} alt="Toggle Accordion" className="accordion-icon" />
                            </button>
                            <div
                                className={`events-group ${openAccordions[status] ? 'panel' : ''}`}
                            >
                                {events.map((ev) => {
                                    if (ev.status !== status) return null;

                                    return (
                                        <EventCard ev={ev} setLoading={setLoading} load={load} />
                                    );
                                })}
                            </div>
                        </>
                    ))}
                </div>
            )}
        </PageFrame>
    );
}
