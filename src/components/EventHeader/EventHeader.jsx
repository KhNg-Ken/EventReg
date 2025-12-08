import { normalizedDateString } from '../../utils/dateUtils';
import './EventHeader.css';

export default function EventHeader({ eventInfo = {} }) {
    const title = eventInfo.name;
    const desc = eventInfo.description;

    return (
        <div className="event-header">
            <div>
                <div className="event-title">{title}</div>
                {desc ? <div className="event-description">{desc}</div> : null}
            </div>

            <div className="event-meta">
                {eventInfo.location ? (
                    <div className="meta-item">
                        <div className="meta-label">Địa điểm</div>
                        <div className="meta-value">{eventInfo.location}</div>
                    </div>
                ) : null}

                {eventInfo.eventDate ? (
                    <div className="meta-item">
                        <div className="meta-label">Ngày sự kiện</div>
                        <div className="meta-value">{normalizedDateString(eventInfo.eventDate)}</div>
                    </div>
                ) : null}

                {eventInfo.endDate ? (
                    <div className="meta-item">
                        <div className="meta-label">Hết hạn đăng ký</div>
                        <div className="meta-value">{normalizedDateString(eventInfo.endDate)}</div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
