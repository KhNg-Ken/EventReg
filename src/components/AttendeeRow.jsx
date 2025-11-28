import { createLogger } from '../utils/logger.js';
import Avatar from './Avatar.jsx';

const logger = createLogger('AttendeeRow');

export default function AttendeeRow({ item } = {}) {
    const r = item?.registrant || {};
    const rawTs = item?.timestamp || null;
    let ts = null;
    try {
        if (rawTs) {
            ts =
                typeof rawTs.toDate === 'function'
                    ? rawTs.toDate()
                    : typeof rawTs.toMillis === 'function'
                    ? new Date(rawTs.toMillis())
                    : new Date(rawTs);
        }
    } catch (err) {
        logger.debug('AttendeeRow timestamp parse error', err);
        ts = null;
    }

    return (
        <div className="attendee-row">
            <div className="attendee-avatar">
                <Avatar src={r.photoUrl || ''} name={r.name || ''} size={56} />
            </div>

            <div className="attendee-details">
                <div className="attendee-name">{r.name || '—'}</div>
                <div className="attendee-meta">
                    {r.position || ''} {r.company ? `· ${r.company}` : ''}
                </div>
            </div>

            <div className="attendee-time">{ts ? ts.toLocaleString() : '—'}</div>
        </div>
    );
}
