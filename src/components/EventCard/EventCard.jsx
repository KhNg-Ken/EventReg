import { useAuth } from '../../contexts/AuthContext.jsx';
import '../../pages/RegisterForm/RegisterForm.css';
import { normalizedDateString } from '../../utils/dateUtils.js';
import './EventCard.css';

export default function EventCard({ ev, onClick, actions }) {
    const { isAdmin } = useAuth();
    const eventDate = ev?.eventDate ? new Date(ev.eventDate) : null;
    const endDate = ev?.endDate ? new Date(ev.endDate) : null;

    return (
        <div
            className="event-card"
            tabIndex={0}
            onClick={(e) => {
                // allow button clicks to bubble separately
                if (e.target.tagName.toLowerCase() === 'button') return;
                if (typeof onClick === 'function') onClick(ev);
            }}
        >
            <div className="event-card-row">
                <div className="event-card-left">
                    <div className="event-name">{ev?.name || 'Untitled event'}</div>
                    <div className="event-meta">
                        <div>
                            Ngày sự kiện:
                            <br />
                            {eventDate ? normalizedDateString(eventDate) : 'TBD'}
                        </div>
                        <div className="event-location">
                            Địa điểm:
                            <br />
                            {ev?.location || 'TBD'}
                        </div>
                    </div>
                </div>
                <div className="event-card-right">
                    <div className="event-right-meta">
                        Hạn đăng ký:
                        <br />
                        {endDate ? normalizedDateString(endDate) : '—'}
                    </div>
                    <div className="event-actions">
                        {actions}
                        {!isAdmin ? (
                            <button
                                className="ui-btn btn-primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (typeof onClick === 'function') onClick(ev);
                                }}
                                type="button"
                            >
                                Đăng ký
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
