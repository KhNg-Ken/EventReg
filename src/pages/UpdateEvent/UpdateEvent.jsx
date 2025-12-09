import { getApp } from 'firebase/app';
import { doc as firestoreDoc, getDoc, getFirestore } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import EventForm from '../../components/EventForm.jsx';
import PageFrame from '../../components/PageFrame/PageFrame.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { adminUpdateEvent } from '../../utils/adminProxy.js';
import { createLogger } from '../../utils/logger.js';
import '../CreateEvent/CreateEvent.css';
import './UpdateEvent.css';

const logger = createLogger('UpdateEvent');

export default function UpdateEvent({ event: propEventDoc } = {}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState(null);
    const { showToast } = useToast();

    useEffect(() => {
        async function load() {
            if (!propEventDoc) return setLoading(false);
            try {
                setLoading(true);
                const app = getApp();
                const db = getFirestore(app);
                const ref = firestoreDoc(db, 'events', propEventDoc);
                const snap = await getDoc(ref);
                logger.log('Loaded event data', snap.exists() ? snap.data() : null);
                if (snap.exists()) {
                    setData(snap.data());
                } else {
                    setData(null);
                }
            } catch (err) {
                logger.error('Load event failed', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [propEventDoc]);

    async function handleSave(payload) {
        if (!propEventDoc) return;
        try {
            setSaving(true);
            // payload already contains ISO/timezone pairs from EventForm
            await adminUpdateEvent({ id: propEventDoc, ...payload });
            showToast('Saved', { type: 'success' });
            window.location.hash = '#/events';
        } catch (err) {
            logger.error('Save failed', err);
            showToast(String(err), { type: 'error' });
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <PageFrame title="Update Event" subtitle="Loading..." />;

    return (
        <PageFrame
            style={{ overflow: 'auto' }}
            title="Update Event"
            subtitle={`Editing ${propEventDoc || ''}`}
            showBack
            onBack={() => (window.location.hash = '#/events')}
            minHeight={360}
        >
            {data ? (
                <div className="create-form">
                    <EventForm initial={data} onSubmit={handleSave} submitting={saving} />

                    {/* feedback delivered via global toasts */}
                </div>
            ) : (
                <div>Event not found.</div>
            )}
        </PageFrame>
    );
}
