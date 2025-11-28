import React from 'react';
import './EventHeader.css';
import { normalizedDateString } from '../../utils/stringUtils';

export default function EventHeader({ config = {} }) {
    const title = config.eventName || config.name || 'Sự kiện';
    const desc = config.description || config.eventDescription || '';

    return (
        <div className="tds-event-header">
            <div>
                <div className="tds-event-title">{title}</div>
                {desc ? <div className="tds-event-description">{desc}</div> : null}
            </div>

            <div className="tds-event-meta">
                {config.location ? (
                    <div className="tds-meta-item">
                        <div className="tds-meta-label">Địa điểm</div>
                        <div className="tds-meta-value">{config.location}</div>
                    </div>
                ) : null}

                {config.eventDate ? (
                    <div className="tds-meta-item">
                        <div className="tds-meta-label">Ngày sự kiện</div>
                        <div className="tds-meta-value">{normalizedDateString(config.eventDate)}</div>
                    </div>
                ) : null}

                {config.endDate ? (
                    <div className="tds-meta-item">
                        <div className="tds-meta-label">Hết hạn đăng ký</div>
                        <div className="tds-meta-value">{normalizedDateString(config.endDate)}</div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
