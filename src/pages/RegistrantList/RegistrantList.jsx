import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import PageFrame from '../../components/PageFrame/PageFrame.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { app } from '../../firebase/config.js';
import { readEventInfo } from '../../utils/firestoreUtils.js';
import { createLogger } from '../../utils/logger.js';
import './RegistrantList.css';

const logger = createLogger('RegistrantList');

function RegistrantList() {
    const [eventInfo, setEventInfo] = useState(null);
    const [registrants, setRegistrants] = useState([]);
    const [newRegistrantIds, setNewRegistrantIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const { isAdmin, loading: authLoading } = useAuth();

    // Extract event ID from URL
    const urlEvent = (() => {
        try {
            const s = new URLSearchParams(window.location.search).get('event');
            if (s) return s;
            const raw = window.location.hash || '';
            const parts = raw.split('?');
            if (parts.length > 1) {
                const sp = new URLSearchParams(parts[1]);
                return sp.get('event');
            }
            return null;
        } catch {
            return null;
        }
    })();

    // Redirect non-admins to home
    useEffect(() => {
        if (!authLoading && !isAdmin) {
            window.location.hash = '#/';
        }
    }, [isAdmin, authLoading]);

    // Load registrants on mount
    useEffect(() => {
        if (!authLoading && isAdmin && urlEvent) {
            loadRegistrants();
        }
    }, [authLoading, isAdmin, urlEvent]);

    async function loadRegistrants() {
        setLoading(true);
        try {
            // Load event info
            const eventCfg = await readEventInfo(urlEvent);
            setEventInfo(eventCfg);

            // Load registrants from Firestore
            const db = getFirestore(app);
            const registrantsCol = collection(db, 'events', urlEvent, 'registrants');
            const snap = await getDocs(registrantsCol);

            const registrantsList = snap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            // Get previously seen registrant IDs from localStorage
            const storageKey = `registrants_seen_${urlEvent}`;
            const prevSeenStr = localStorage.getItem(storageKey);
            const prevSeenIds = prevSeenStr ? new Set(JSON.parse(prevSeenStr)) : new Set();

            // Find new registrants
            const currentIds = new Set(registrantsList.map((r) => r.id));
            const newIds = new Set(
                registrantsList.filter((r) => !prevSeenIds.has(r.id)).map((r) => r.id)
            );

            setRegistrants(registrantsList);
            setNewRegistrantIds(newIds);

            // Update localStorage with current registrant IDs
            localStorage.setItem(storageKey, JSON.stringify(Array.from(currentIds)));
        } catch (err) {
            logger.error('Failed to load registrants', err);
            setRegistrants([]);
        } finally {
            setLoading(false);
        }
    }

    if (authLoading) {
        return (
            <PageFrame title="Danh sách đăng ký" subtitle="Đang kiểm tra quyền truy cập...">
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div className="spinner" />
                </div>
            </PageFrame>
        );
    }

    if (!isAdmin) {
        return null;
    }

    if (!urlEvent) {
        return (
            <PageFrame
                title="Danh sách đăng ký"
                subtitle="Không tìm thấy sự kiện"
                showBack
                onBack={() => (window.location.hash = '#/events')}
            >
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p>Vui lòng chọn một sự kiện để xem danh sách đăng ký.</p>
                </div>
            </PageFrame>
        );
    }

    return (
        <PageFrame
            title={`Danh sách đăng ký`}
            subtitle={`${eventInfo?.name || urlEvent}\nTổng cộng: ${registrants.length} người đăng ký`}
            showBack
            onBack={() => (window.location.hash = '#/events')}
        >
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div className="spinner" />
                </div>
            ) : registrants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--gray)' }}>
                    <p>Chưa có người đăng ký sự kiện này.</p>
                </div>
            ) : (
                <div className="registrant-list-wrapper">
                    <div className="registrant-grid">
                        {registrants.map((registrant) => {
                            const isNew = newRegistrantIds.has(registrant.id);
                            return (
                                <div
                                    key={registrant.id}
                                    className={`registrant-card ${isNew ? 'new' : ''}`}
                                >
                                    <div className="registrant-card-header">
                                        <div className="registrant-photo-wrapper">
                                            {registrant.photoUrl ? (
                                                <img
                                                    src={registrant.photoUrl}
                                                    alt={registrant.name}
                                                    className="registrant-photo-img"
                                                />
                                            ) : (
                                                <div className="no-photo">
                                                    <span>No Photo</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="registrant-header-info">
                                            <div className="registrant-name-wrapper">
                                                <h3 className="registrant-name">
                                                    {registrant.name || '—'}
                                                </h3>
                                                {isNew && <span className="new-badge">Mới</span>}
                                            </div>
                                            <div className="registrant-status-badge">
                                                {registrant.checkedIn ? (
                                                    <span className="badge badge-checkedin">
                                                        Có mặt
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-pending">
                                                        Chưa nhận diện
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="registrant-card-body">
                                        <div className="registrant-field">
                                            <span className="registrant-label">Email</span>
                                            <span className="registrant-value">
                                                {registrant.email || '—'}
                                            </span>
                                        </div>
                                        <div className="registrant-field">
                                            <span className="registrant-label">Số điện thoại</span>
                                            <span className="registrant-value">
                                                {registrant.phone || '—'}
                                            </span>
                                        </div>
                                        <div className="registrant-field">
                                            <span className="registrant-label">Công ty</span>
                                            <span className="registrant-value">
                                                {registrant.company || '—'}
                                            </span>
                                        </div>
                                        <div className="registrant-field">
                                            <span className="registrant-label">Chức vụ</span>
                                            <span className="registrant-value">
                                                {registrant.position || '—'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </PageFrame>
    );
}

export default RegistrantList;
