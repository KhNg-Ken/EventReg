import { useToast } from '../../contexts/ToastContext.jsx';
import '../../styles/common.css';
import QRLinkButton from '../QRLinkButton/QRLinkButton.jsx';
import './AdminButtonPanel.css';

export default function AdminButtonPanel({ eventId, }) {
    const { showToast } = useToast();

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
                className="ui-btn view-registrants-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    window.location.hash = `#/registrants?event=${encodeURIComponent(eventId)}`;
                }}
                type="button"
            >
                Danh sách Đăng Ký
            </button>
        </>
    );

    return (
        <div className="admin-button-panel">
            <div className="client-actions">{clientActions}</div>
            <div className="change-actions">{changeActions}</div>
        </div>
    );
}
