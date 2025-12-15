import '../../pages/RegisterForm/RegisterForm.css';
import { normalizedDateString } from '../../utils/dateUtils.js';
import AdminButtonPanel from '../AdminButtonPanel/AdminButtonPanel.jsx';
import './EventCard.css';

export default function EventCard({
    ev,
    setLoading,
    load
}) {
    const eventDate = ev?.eventDate ? new Date(ev.eventDate) : null;
    const endDate = ev?.endDate ? new Date(ev.endDate) : null;

    return (
        <div
            className="event-card"
            tabIndex={0}
        >
            <div className="event-card-row">
                <div className="event-card-left">
                    <div className="event-name">{ev?.name || 'Untitled event'}</div>
                    <div className="event-meta">
                        <div>
                            <span className="event-meta-label">Ngày sự kiện:</span>
                            {eventDate ? normalizedDateString(eventDate).split(',')[0] : 'TBD'}
                        </div>
                        <div>
                            <span className="event-meta-label">Hạn đăng ký:</span>
                            {endDate ? normalizedDateString(endDate).split(',')[0] : '—'}
                        </div>
                        <div className="event-location">
                            <span className="event-meta-label">Địa điểm:</span>
                            {ev?.location || 'TBD'}
                        </div>
                    </div>
                </div>
                <AdminButtonPanel
                    eventId={ev?.id}
                    setLoading={setLoading}
                    load={load}
                />
            </div>
        </div>
    );
}
