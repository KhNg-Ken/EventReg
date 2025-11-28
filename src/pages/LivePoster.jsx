import { getApp } from 'firebase/app';
import {
    collection,
    doc as firestoreDoc,
    getDoc,
    getFirestore,
    limit,
    onSnapshot,
    orderBy,
    query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { isSignedIn } from '../auth/index.js';
import PageFrame from '../components/PageFrame.jsx';
import createLogger from '../utils/logger.js';

const logger = createLogger('LivePoster');

function CenteredPoster({ registrant }) {
    const placeholder = {
        photoUrl:
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="%23f5f5f7"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-size="24">No attendee yet</text></svg>',
    };

    const r = registrant || {};
    const photo = r.photoUrl || placeholder.photoUrl;
    const name = r.name || '';
    const position = r.position || '';
    const company = r.company || '';

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
                style={{
                    width: 780,
                    height: 540,
                    borderRadius: 12,
                    background: 'white',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                    textAlign: 'center',
                }}
            >
                <div style={{ width: 320, height: 320, marginBottom: 18 }}>
                    <img
                        src={photo}
                        alt={name}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 8,
                        }}
                    />
                </div>

                <div style={{ fontSize: 42, fontWeight: 700, marginBottom: 6 }}>{name}</div>
                <div style={{ fontSize: 20, color: '#444', marginBottom: 2 }}>{position}</div>
                <div style={{ fontSize: 18, color: '#666' }}>{company}</div>
            </div>
        </div>
    );
}

export default function LivePoster({ event: propEvent } = {}) {
    const [hasAccessChecked, setHasAccessChecked] = useState(false);
    const [registrant, setRegistrant] = useState(null);
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

    useEffect(() => {
        if (!eventDoc) return;
        const app = getApp();
        const db = getFirestore(app);
        // Read control doc to know when the poster was last cleared.
        const controlRef = firestoreDoc(db, 'events', eventDoc, 'attendants_control', 'current');

        // Combined logic: listen to the latest attendee and also listen to control doc.
        const attendeesCol = collection(db, 'events', eventDoc, 'attendants');
        const q = query(attendeesCol, orderBy('checkedInAt', 'desc'), limit(1));

        let latestClearedAt = null;

        const controlUnsub = onSnapshot(
            controlRef,
            (snap) => {
                const d = snap.data ? snap.data() : null;
                if (d && d.clearedAt && typeof d.clearedAt.toMillis === 'function') {
                    latestClearedAt = d.clearedAt.toMillis();
                } else {
                    latestClearedAt = null;
                }
            },
            (err) => {
                // Control doc is optional; log but continue
                logger.debug('attendants_control snapshot error', err);
                latestClearedAt = null;
            }
        );

        const unsub = onSnapshot(
            q,
            async (snap) => {
                if (snap.empty) {
                    setRegistrant(null);
                    return;
                }

                const d = snap.docs[0];
                const data = d.data();

                // If attendant checkedInAt is before or equal to clearedAt, ignore until a newer one appears
                try {
                    const ts = data.checkedInAt || data.timestamp;
                    const tsMillis =
                        ts && typeof ts.toMillis === 'function'
                            ? ts.toMillis()
                            : ts
                            ? new Date(ts).getTime()
                            : null;
                    if (latestClearedAt && tsMillis && tsMillis <= latestClearedAt) {
                        // ignore
                        return;
                    }
                } catch {
                    // ignore timestamp parsing errors
                    logger.debug('LivePoster: checkedInAt parse error');
                }

                // Expecting a reference to the registrant doc
                let reg = null;
                try {
                    if (data.registrantRef && typeof data.registrantRef.get === 'function') {
                        const regSnap = await getDoc(data.registrantRef);
                        if (regSnap.exists()) reg = regSnap.data();
                    } else if (data.registrantId && typeof data.registrantId === 'string') {
                        // registrantId stored as ID string in registrants subcollection
                        const ref = firestoreDoc(
                            db,
                            'events',
                            eventDoc,
                            'registrants',
                            data.registrantId
                        );
                        const regSnap = await getDoc(ref);
                        if (regSnap.exists()) reg = regSnap.data();
                    } else if (data.registrantRef && typeof data.registrantRef === 'string') {
                        // older shape: registrantRef as ID string
                        const ref = firestoreDoc(
                            db,
                            'events',
                            eventDoc,
                            'registrants',
                            data.registrantRef
                        );
                        const regSnap = await getDoc(ref);
                        if (regSnap.exists()) reg = regSnap.data();
                    } else if (
                        data.registrant &&
                        typeof data.registrant === 'object' &&
                        data.registrant.name
                    ) {
                        // If registrant payload embedded directly
                        reg = data.registrant;
                    }
                } catch (err) {
                    logger.warn('Failed to resolve registrant for live poster', err);
                }

                setRegistrant(reg);
            },
            (err) => {
                logger.error('LivePoster snapshot error', err);
            }
        );

        return () => {
            unsub();
            try {
                controlUnsub();
            } catch (err) {
                logger.debug('LivePoster: controlUnsub cleanup failed', err);
            }
        };
    }, [eventDoc]);

    // simple guard to hide content if not signed in
    useEffect(() => {
        try {
            if (!isSignedIn()) {
                setHasAccessChecked(true);
                return;
            }
            setHasAccessChecked(true);
        } catch {
            setHasAccessChecked(true);
        }
    }, []);

    if (!hasAccessChecked) {
        return (
            <PageFrame title="Live Poster" subtitle="Checking access..." showBack>
                <div style={{ padding: 40 }}>Checking access...</div>
            </PageFrame>
        );
    }

    if (!isSignedIn()) {
        return (
            <PageFrame title="Live Poster" subtitle="Access denied" showBack>
                <div style={{ padding: 20 }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>Truy cập bị từ chối</div>
                    <div style={{ marginTop: 8 }}>
                        Bạn cần đăng nhập nhân viên để xem poster trực tiếp.
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <button
                            className="tds-btn tds-btn-primary"
                            onClick={() => (window.location.hash = '#/login')}
                        >
                            Đăng nhập
                        </button>
                    </div>
                </div>
            </PageFrame>
        );
    }

    return (
        <PageFrame title="Live Poster" subtitle="Latest successful registration" showBack>
            <div
                style={{
                    padding: 20,
                    minHeight: 480,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <CenteredPoster registrant={registrant} />
            </div>
        </PageFrame>
    );
}
