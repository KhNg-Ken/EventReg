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
import Poster from '../../components/Poster/Poster.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { createLogger } from '../../utils/logger.js';
import './LivePoster.css';

const logger = createLogger('LivePoster');
const enablePosterChannel = new BroadcastChannel('enable-live-poster');

export default function LivePoster() {
    const { isAdmin, loading: authLoading } = useAuth();
    const [enablePoster, setEnablePoster] = useState(true);
    const [registrant, setRegistrant] = useState(null);
    const [eventId, setEventId] = useState(null);
    const [posterConfig, setPosterConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Read event ID from URL
    useEffect(() => {
        try {
            const hash = window.location.hash || '';
            const urlParams = new URLSearchParams(hash.split('?')[1] || '');
            const event = urlParams.get('event');
            if (!event) {
                setError('No event specified in URL');
                setLoading(false);
                return;
            }
            setEventId(event);
            setLoading(false);
        } catch (err) {
            logger.error('Failed to parse URL params', err);
            setError('Invalid URL parameters');
            setLoading(false);
        }
    }, []);

    // Hide admin navbar for fullscreen poster experience
    useEffect(() => {
        try {
            document.documentElement.classList.add('liveposter-fullscreen');
        } catch {
            // ignore
        }
        return () => {
            try {
                document.documentElement.classList.remove('liveposter-fullscreen');
            } catch {
                // ignore
            }
        };
    }, []);

    // Listen to clear poster messages
    useEffect(() => {
        function handleClearMessage(msg) {
            if (msg?.data?.type === 'enable') {
                setEnablePoster(true);
            } else if (msg?.data?.type === 'disable') {
                setEnablePoster(false);
            }
        }
        enablePosterChannel.onmessage = handleClearMessage;
        return () => {
            enablePosterChannel.onmessage = null;
        };
    }, []);

    useEffect(() => {
        if (!eventId) return;
        const app = getApp();
        const db = getFirestore(app);

        // Fetch event document to get poster config
        const eventRef = firestoreDoc(db, 'events', eventId);
        getDoc(eventRef)
            .then((snap) => {
                if (snap.exists()) {
                    const eventData = snap.data();
                    setPosterConfig(eventData || null); 
                    console.log('Fetched event config for LivePoster:', eventData);
                }
            })
            .catch((err) => {
                logger.warn('Failed to fetch event config:', err);
            });

        // Listen to the latest attendant.
        const attendeesCol = collection(db, 'events', eventId, 'attendants');
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
                            eventId,
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
                            eventId,
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
    }, [eventId]);

    // simple guard to hide content if not signed in
    // auth context handles the auth state, no need for separate effect

    if (loading) {
        return (
            <div className="liveposter-fullscreen-container">
                <div style={{ color: 'white', textAlign: 'center', paddingTop: '40vh' }}>
                    Loading event...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="liveposter-fullscreen-container">
                <div style={{ color: 'white', textAlign: 'center', paddingTop: '40vh' }}>
                    Error: {error}
                </div>
            </div>
        );
    }

    if (authLoading) {
        return (
            <div className="liveposter-fullscreen-container">
                <div style={{ color: 'white', textAlign: 'center', paddingTop: '40vh' }}>
                    Checking authentication...
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="liveposter-fullscreen-container">
                <div style={{ color: 'white', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 16 }}>Access Denied</div>
                    <div>Please sign in as admin to view the live poster.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="liveposter-fullscreen-container">
            <div className={enablePoster ? 'poster-visible' : 'poster-hidden'}>
                <Poster registrant={registrant} config={posterConfig} />
            </div>
        </div>
    );
}
