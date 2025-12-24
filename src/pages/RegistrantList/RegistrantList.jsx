import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import PageFrame from '../../components/PageFrame/PageFrame.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { app } from '../../firebase/config.js';
import { exportRegistrantsToExcel } from '../../utils/excelUtils.js';
import { readEventInfo } from '../../utils/firestoreUtils.js';
import { createLogger } from '../../utils/logger.js';
import './RegistrantList.css';

const logger = createLogger('RegistrantList');

function RegistrantList() {
    const [eventInfo, setEventInfo] = useState(null);
    const [registrants, setRegistrants] = useState([]);
    const [attendants, setAttendants] = useState([]);
    const [newRegistrantIds, setNewRegistrantIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const { isAdmin, loading: authLoading } = useAuth();

    // Handle sort column click
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Sort registrants based on sortConfig
    const sortedRegistrants = [...registrants].sort((a, b) => {
        let aValue, bValue;

        switch (sortConfig.key) {
            case 'name':
                aValue = (a.name || '').toLowerCase();
                bValue = (b.name || '').toLowerCase();
                break;
            case 'company':
                aValue = (a.company || '').toLowerCase();
                bValue = (b.company || '').toLowerCase();
                break;
            case 'createdAt':
                aValue = a.createdAt?.seconds || 0;
                bValue = b.createdAt?.seconds || 0;
                break;
            case 'checkedInAt': {
                const attendantA = attendants.find((att) => att.registrantId === a.id);
                const attendantB = attendants.find((att) => att.registrantId === b.id);
                aValue = attendantA?.checkedInAt?.seconds || 0;
                bValue = attendantB?.checkedInAt?.seconds || 0;
                break;
            }
            default:
                return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

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

                    // Load attendants from Firestore
                    const attendantsCol = collection(db, 'events', urlEvent, 'attendants');
                    const attendantsSnap = await getDocs(attendantsCol);
                    const attendantsList = attendantsSnap.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }));
                    setAttendants(attendantsList);

                    // Get previously seen registrant IDs from localStorage
                    const storageKey = `registrants_seen_${urlEvent}`;
                    const prevSeenStr = localStorage.getItem(storageKey);
                    const prevSeenIds = prevSeenStr ? new Set(JSON.parse(prevSeenStr)) : new Set();

                    // Find new registrants
                    const currentIds = new Set(registrantsList.map((r) => r.id));
                    const newIds = new Set(
                        registrantsList.filter((r) => !prevSeenIds.has(r.id)).map((r) => r.id)
                    );

                    // Sort: new registrants first, then by name
                    const sortedRegistrants = [...registrantsList].sort((a, b) => {
                        const aIsNew = newIds.has(a.id);
                        const bIsNew = newIds.has(b.id);
                        if (aIsNew !== bIsNew) return aIsNew ? -1 : 1;
                        return (a.name || '').localeCompare(b.name || '', 'vi');
                    });

                    setRegistrants(sortedRegistrants);
                    setNewRegistrantIds(newIds);

                    // Update localStorage with current registrant IDs (after rendering to preserve "new" badge on this load)
                    setTimeout(() => {
                        localStorage.setItem(storageKey, JSON.stringify(Array.from(currentIds)));
                    }, 0);
                } catch (err) {
                    logger.error('Failed to load registrants', err);
                    setRegistrants([]);
                } finally {
                    setLoading(false);
                }
            }
            loadRegistrants();
        }
    }, [authLoading, isAdmin, urlEvent]);

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

    const handleExportToExcel = async () => {
        try {
            console.log('Starting export to Excel...');
            await exportRegistrantsToExcel(
                registrants,
                attendants,
                eventInfo?.name || 'Danh sách đăng ký'
            );
            console.log('Export completed successfully');
        } catch (err) {
            logger.error('Failed to export to Excel', err);
            console.error('Export error details:', err);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <PageFrame
                title={`Danh sách đăng ký`}
                subtitle={`${eventInfo?.name || urlEvent}\nTổng cộng: ${
                    registrants.length
                } người đăng ký`}
                showBack
                onBack={() => (window.location.hash = '#/events')}
            >
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <div className="spinner" />
                    </div>
                ) : registrants.length === 0 ? (
                    <div
                        style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--gray)' }}
                    >
                        <p>Chưa có người đăng ký sự kiện này.</p>
                    </div>
                ) : (
                    <div className="registrant-list-wrapper">
                        {registrants.length > 0 && (
                            <div
                                style={{
                                    marginBottom: '1.5rem',
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                }}
                            >
                                <button
                                    onClick={handleExportToExcel}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: 'var(--primary)',
                                        color: 'var(--white)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        fontWeight: '600',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                    }}
                                >
                                    Xuất Excel
                                </button>
                            </div>
                        )}
                        <table className="registrant-table">
                            <thead>
                                <tr>
                                    <th className="col-stt">STT</th>
                                    <th className="col-photo">Hình</th>
                                    <th
                                        className="col-company sortable"
                                        onClick={() => handleSort('company')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Công ty{' '}
                                        {sortConfig.key === 'company' &&
                                            (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        className="col-name sortable"
                                        onClick={() => handleSort('name')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Họ Tên{' '}
                                        {sortConfig.key === 'name' &&
                                            (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="col-position">Chức vụ</th>
                                    <th className="col-phone">Số ĐT</th>
                                    <th className="col-email">Email</th>
                                    <th
                                        className="col-registered sortable"
                                        onClick={() => handleSort('createdAt')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Thời gian đăng ký{' '}
                                        {sortConfig.key === 'createdAt' &&
                                            (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        className="col-checkin sortable"
                                        onClick={() => handleSort('checkedInAt')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        Thời gian check-in{' '}
                                        {sortConfig.key === 'checkedInAt' &&
                                            (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRegistrants.map((registrant, index) => {
                                    const isNew = newRegistrantIds.has(registrant.id);
                                    const stt = index + 1;
                                    const attendant = attendants.find(
                                        (att) => att.registrantId === registrant.id
                                    );
                                    return (
                                        <tr
                                            key={registrant.id}
                                            className={`registrant-row ${isNew ? 'new' : ''} ${
                                                attendant ? 'checkedin' : ''
                                            }`}
                                        >
                                            <td className="col-stt">{stt}</td>
                                            <td className="col-photo">
                                                {registrant.photoUrl ? (
                                                    <img
                                                        src={registrant.photoUrl}
                                                        alt={registrant.name}
                                                        className="registrant-photo"
                                                    />
                                                ) : (
                                                    <div className="no-photo">—</div>
                                                )}
                                            </td>
                                            <td className="col-company">
                                                {registrant.company || '—'}
                                            </td>
                                            <td className="col-name">
                                                <div className="name-with-badge">
                                                    <span className="registrant-name">
                                                        {registrant.name || '—'}
                                                    </span>
                                                    {isNew && (
                                                        <span className="new-badge">Mới</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="col-position">
                                                {registrant.position || '—'}
                                            </td>
                                            <td className="col-phone">{registrant.phone || '—'}</td>
                                            <td className="col-email">{registrant.email || '—'}</td>
                                            <td className="col-registered">
                                                {registrant.createdAt
                                                    ? new Date(
                                                          registrant.createdAt.seconds * 1000
                                                      ).toLocaleString('vi-VN')
                                                    : '—'}
                                            </td>
                                            <td className="col-checkin">
                                                {attendant?.checkedInAt ? (
                                                    <>
                                                        <span className="status-badge checked-in">
                                                            ✓ Check-in
                                                        </span>
                                                        <br />
                                                        <small>
                                                            {new Date(
                                                                attendant.checkedInAt.seconds * 1000
                                                            ).toLocaleString('vi-VN')}
                                                        </small>
                                                    </>
                                                ) : (
                                                    <span className="status-badge not-checked-in">
                                                        Chưa check-in
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </PageFrame>
        </div>
    );
}

export default RegistrantList;
