import { getApp } from 'firebase/app';
import { collection, getDocs, getFirestore, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import PageFrame from '../../components/PageFrame/PageFrame.jsx';
import { DEFAULT_POSTER_CONFIG } from '../../components/Poster/templates/index.js';
import PosterDesignEditor from '../../components/PosterDesignEditor/PosterDesignEditor.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { adminUpdateEvent } from '../../utils/adminProxy.js';
import { createLogger } from '../../utils/logger.js';
import './PosterDesign.css';

const logger = createLogger('PosterDesign');

export default function PosterDesign() {
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(null);
    const [posterConfig, setPosterConfig] = useState(DEFAULT_POSTER_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const { showToast } = useToast();

    // Load all events on mount
    useEffect(() => {
        async function loadEvents() {
            try {
                setLoadingEvents(true);
                const db = getFirestore(getApp());
                const q = query(collection(db, 'events'), orderBy('eventDate', 'asc'));
                const snap = await getDocs(q);
                const eventsList = snap.docs.map((d) => ({
                    id: d.id,
                    name: d.data().name,
                    eventDate: d.data().eventDate,
                    posterConfig: d.data().posterConfig,
                }));
                setEvents(eventsList);
                setLoading(false);
            } catch (err) {
                logger.error('Failed to load events', err);
                showToast('Failed to load events', { type: 'error' });
                setLoading(false);
            } finally {
                setLoadingEvents(false);
            }
        }
        loadEvents();
    }, [showToast]);

    // Load selected event's poster config
    const handleSelectEvent = (eventId) => {
        const event = events.find((e) => e.id === eventId);
        if (event) {
            setSelectedEventId(eventId);
            setPosterConfig(event.posterConfig || DEFAULT_POSTER_CONFIG);
        }
    };

    const handleSave = async () => {
        if (!selectedEventId) {
            showToast('Please select an event first', { type: 'error' });
            return;
        }

        try {
            setSaving(true);
            await adminUpdateEvent({
                id: selectedEventId,
                posterConfig,
            });
            showToast('Poster design saved successfully', { type: 'success' });
            logger.log('Saved poster config for event:', selectedEventId);
        } catch (err) {
            logger.error('Failed to save poster config', err);
            showToast('Failed to save poster design', { type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <PageFrame title="Poster Design" subtitle="Loading..." />;
    }

    return (
        <PageFrame
            title="🎨 Poster Design"
            subtitle="Customize poster templates for each event"
            showBack
            onBack={() => (window.location.hash = '#/events')}
            minHeight={400}
        >
            <div className="poster-design-page">
                {/* Event Selector */}
                <div className="event-selector-section">
                    <label className="selector-label">Select Event</label>
                    <div className="selector-wrapper">
                        <select
                            value={selectedEventId || ''}
                            onChange={(e) => handleSelectEvent(e.target.value)}
                            className="event-dropdown"
                            disabled={loadingEvents}
                        >
                            <option value="">
                                {loadingEvents
                                    ? 'Loading events...'
                                    : 'Choose an event to customize...'}
                            </option>
                            {events.map((event) => (
                                <option key={event.id} value={event.id}>
                                    {event.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Editor Section */}
                {selectedEventId ? (
                    <div className="editor-section">
                        <PosterDesignEditor
                            initialConfig={posterConfig}
                            onConfigChange={setPosterConfig}
                        />

                        {/* Save Button */}
                        <div className="save-section">
                            <button className="save-button" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : '💾 Save Poster Design'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">👇</div>
                        <div className="empty-text">
                            Select an event above to customize its poster
                        </div>
                    </div>
                )}
            </div>
        </PageFrame>
    );
}
