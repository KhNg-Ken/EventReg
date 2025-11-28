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
import Poster from '../components/Poster.jsx';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('LivePoster');
const enablePosterChannel = new BroadcastChannel('enable-live-poster');

export default function LivePoster({ event: propEvent } = {}) {
    const [enablePoster, setEnablePoster] = useState(true);
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

    // Listen to clear poster messages
    useEffect(() => {
        function handleClearMessage(msg) {
            if (msg?.data?.type === 'enable') {
                setEnablePoster(true);
            }
            else if (msg?.data?.type === 'disable') {
                setEnablePoster(false);
            }
        }
        enablePosterChannel.onmessage = handleClearMessage;
        return () => {
            enablePosterChannel.onmessage = null;
        };
    }, []);

    useEffect(() => {
        if (!eventDoc) return;
        const app = getApp();
        const db = getFirestore(app);

        // Listen to the latest attendant.
        const attendeesCol = collection(db, 'events', eventDoc, 'attendants');
        const q = query(attendeesCol, orderBy('checkedInAt', 'desc'), limit(1));

        const unsub = onSnapshot(
            q,
            async (snap) => {
                if (snap.empty) {
                    setRegistrant(null);
                    return;
                }

                const d = snap.docs[0];
                const data = d.data();

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
        <PageFrame title="Live Poster" subtitle="Latest successful registration" showBack={false}>
            <div className="page-centered">
                <div className={enablePoster ? 'poster-visible' : 'poster-hidden'}>
                    <Poster registrant={registrant} />
                </div>
            </div>
        </PageFrame>
    );
}
