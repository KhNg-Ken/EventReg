import { getApp } from 'firebase/app';
import {
    collection,
    doc,
    doc as firestoreDoc,
    getDoc,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { isSignedIn } from '../auth/index.js';
import PageFrame from '../components/PageFrame.jsx';

function Row({ item }) {
    const r = item.registrant || {};
    const ts = item.timestamp
        ? typeof item.timestamp.toDate === 'function'
            ? item.timestamp.toDate()
            : new Date(item.timestamp)
        : null;
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 8,
                borderBottom: '1px solid #eee',
            }}
        >
            <div
                style={{
                    width: 56,
                    height: 56,
                    borderRadius: 6,
                    overflow: 'hidden',
                    background: '#fafafa',
                }}
            >
                <img
                    src={r.photoUrl || ''}
                    alt={r.name || ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{r.name || '—'}</div>
                <div style={{ color: '#666', fontSize: 13 }}>
                    {r.position || ''} {r.company ? `· ${r.company}` : ''}
                </div>
            </div>
            <div style={{ width: 180, textAlign: 'right', color: '#444' }}>
                {ts ? ts.toLocaleString() : '—'}
            </div>
        </div>
    );
}

export default function CheckinStatistics({ event: propEvent } = {}) {
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
                        console.warn('Failed to resolve registrant for statistics', err);
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
                console.error('CheckinStatistics snapshot error', err);
            }
        );

        return () => unsub();
    }, [eventDoc, sortAsc]);

    async function clearPoster() {
        if (!isSignedIn()) return alert('Admin access required');
        try {
            const app = getApp();
            const db = getFirestore(app);
            const ctrlRef = doc(db, 'events', eventDoc, 'attendants_control', 'current');
            await setDoc(ctrlRef, { clearedAt: serverTimestamp() });
        } catch (err) {
            console.error('Failed to clear live poster', err);
            alert('Không thể xóa poster: ' + (err?.message || err));
        }
    }

    return (
        <PageFrame title="Checkin Statistics" subtitle="Attendees and controls" showBack>
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
                                <button className="tds-btn tds-btn-danger" onClick={clearPoster}>
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
                                items.map((it) => <Row key={it.id} item={it} />)
                            )}
                        </div>
                    </>
                )}
            </div>
        </PageFrame>
    );
}
