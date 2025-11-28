import { getApp } from 'firebase/app';
import {
    collection,
    doc as firestoreDoc,
    getDoc,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { isSignedIn } from '../auth/index.js';
import PageFrame from '../components/PageFrame.jsx';
import { createLogger } from '../utils/logger.js';
import AttendeeRow from '../components/AttendeeRow.jsx';

const logger = createLogger('CheckInStatistics');
const enablePosterChannel = new BroadcastChannel('enable-live-poster');
let posterEnabled = true;

export default function CheckInStatistics({ event: propEvent } = {}) {
    const [eventDoc, setEventDoc] = useState(() => {
        try {
            if (propEvent) return propEvent;
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
    });

    useEffect(() => {
        if (propEvent) setEventDoc(propEvent);
    }, [propEvent]);

    const [items, setItems] = useState([]);
    const [sortAsc, setSortAsc] = useState(false);

    useEffect(() => {
        if (!eventDoc) return;
        const app = getApp();
        const db = getFirestore(app);
        const attendeesCol = collection(db, 'events', eventDoc, 'attendants');
        const q = query(attendeesCol, orderBy('checkedInAt', sortAsc ? 'asc' : 'desc'));

        const unsub = onSnapshot(
            q,
            async (snap) => {
                posterEnabled = true;
                enablePosterChannel.postMessage({ type: 'enable' });
                
                const rows = [];
                for (const d of snap.docs) {
                    const data = d.data();
                    let reg = null;
                    try {
                        if (data.registrantRef && typeof data.registrantRef.get === 'function') {
                            const r = await getDoc(data.registrantRef);
                            if (r.exists()) reg = r.data();
                        } else if (data.registrantId && typeof data.registrantId === 'string') {
                            const ref = firestoreDoc(
                                db,
                                'events',
                                eventDoc,
                                'registrants',
                                data.registrantId
                            );
                            const r = await getDoc(ref);
                            if (r.exists()) reg = r.data();
                        } else if (data.registrantRef && typeof data.registrantRef === 'string') {
                            const ref = firestoreDoc(
                                db,
                                'events',
                                eventDoc,
                                'registrants',
                                data.registrantRef
                            );
                            const r = await getDoc(ref);
                            if (r.exists()) reg = r.data();
                        } else if (data.registrant && typeof data.registrant === 'object') {
                            reg = data.registrant;
                        }
                    } catch (err) {
                        logger.warn('Failed to resolve registrant for statistics', err);
                    }
                    rows.push({
                        id: d.id,
                        timestamp: data.checkedInAt || data.timestamp,
                        registrant: reg,
                    });
                }
                setItems(rows);
            },
            (err) => {
                logger.error('Snapshot error', err);
            }
        );

        return () => unsub();
    }, [eventDoc, sortAsc]);

    async function togglePoster() {
        if (!isSignedIn()) return alert('Admin access required');
        try {
            if (posterEnabled) {
                posterEnabled = false;
                enablePosterChannel.postMessage({ type: 'disable' });
            } else {
                posterEnabled = true;
                enablePosterChannel.postMessage({ type: 'enable' });
            }
        } catch (err) {
            logger.error('Failed to clear live poster', err);
            alert('Không thể xóa poster: ' + (err?.message || err));
        }
    }

    return (
        <PageFrame title="Check-In Statistics" subtitle="Attendees and controls" showBack>
            <div style={{ padding: 16 }}>
                {!eventDoc ? (
                    <div>Không tìm thấy sự kiện. Vui lòng chọn một sự kiện.</div>
                ) : (
                    <>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 12,
                            }}
                        >
                            <div style={{ fontSize: 16, fontWeight: 700 }}>Danh sách check-in</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="tds-btn" onClick={() => setSortAsc((s) => !s)}>
                                    {sortAsc ? 'Sort: Oldest' : 'Sort: Newest'}
                                </button>
                                <button className="tds-btn tds-btn-danger" onClick={togglePoster}>
                                    Clear Live Poster
                                </button>
                            </div>
                        </div>

                        <div
                            style={{
                                border: '1px solid #eee',
                                borderRadius: 8,
                                overflow: 'hidden',
                            }}
                        >
                            {items.length === 0 ? (
                                <div style={{ padding: 20, color: '#666' }}>
                                    Chưa có ai check-in
                                </div>
                            ) : (
                                items.map((it) => <AttendeeRow key={it.id} item={it} />)
                            )}
                        </div>
                    </>
                )}
            </div>
        </PageFrame>
    );
}
