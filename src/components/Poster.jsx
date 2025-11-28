import { createLogger } from '../utils/logger.js';

const logger = createLogger('Poster');

export default function Poster({ registrant } = {}) {
    const placeholder = {
        photoUrl:
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="%23f5f5f7"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-size="24">No attendee yet</text></svg>',
    };

    const r = registrant || {};
    const photo = r.photoUrl || placeholder.photoUrl;
    const name = r.name || '';
    const position = r.position || '';
    const company = r.company || '';

    logger.debug('Rendering Poster for', name || '(empty)');

    if (!registrant) {
        return (
            // TODO: REPLACE DURING PRODUCTION
            <div className="page-centered">
                <div className="poster-card poster-empty">No attendee yet</div>
            </div>
        );
    }

    return (
        <div className="page-centered">
            <div className="poster-card poster-visible">
                <img className="poster-photo" src={photo} alt={name} />

                <div className="poster-name">{name}</div>
                <div className="poster-position">{position}</div>
                <div className="poster-company">{company}</div>
            </div>
        </div>
    );
}
