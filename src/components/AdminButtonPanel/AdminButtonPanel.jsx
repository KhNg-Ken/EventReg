import { adminDeleteEvent } from '../../utils/adminProxy.js';
import { createLogger } from '../../utils/logger.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import QRLinkButton from '../QRLinkButton/QRLinkButton.jsx';
import './AdminButtonPanel.css';
import '../../styles/common.css'

const logger = createLogger('AdminButtonPanel');

export default function AdminButtonPanel({ eventId, setLoading, load }) {
    const { showToast } = useToast();

    async function handleDeleteEvent(id) {
            if (!confirm('Delete this event? This cannot be undone.')) return;
            try {
                setLoading(true);
                await adminDeleteEvent({ id });
                await load();
            } catch (err) {
                logger.error('Failed to delete event', err);
                showToast(err?.message || 'Delete failed', { type: 'error' });
            } finally {
                setLoading(false);
            }
    }
    
    const clientActions = (
        <>
            <QRLinkButton eventId={eventId} onError={(msg) => showToast(msg, { type: 'error' })} />

            <button
                className="ui-btn btn-secondary event-live-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    const liveHash = `#/liveposter?event=${encodeURIComponent(eventId)}`;
                    const statsHash = `#/checkin-statistics?event=${encodeURIComponent(eventId)}`;
                    // open poster in new window and navigate main tab to stats
                    try {
                        window.open(
                            window.location.origin + window.location.pathname + liveHash,
                            '_blank',
                            'noopener'
                        );
                    } catch {
                        window.open(liveHash, '_blank', 'noopener');
                    }
                    window.location.hash = statsHash;
                }}
                type="button"
            >
                Live
            </button>
        </>
    );

    const changeActions = (
        <>
            <button
                className="ui-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    // navigate to update page for this event
                    window.location.hash = `#/update?event=${encodeURIComponent(eventId)}`;
                }}
                type="button"
            >
                Edit
            </button>

            <button
                className="ui-btn btn-danger"
                onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEvent(eventId);
                }}
                type="button"
            >
                Delete
            </button>
        </>
    );

    return (
        <div className="admin-button-panel">
            <div className="client-actions">{clientActions}</div>
            <div className="change-actions">{changeActions}</div>
        </div>
    )
}
