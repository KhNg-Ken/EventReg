import { createLogger } from '../../utils/logger.js';
import './Poster.css';
import { DEFAULT_POSTER_CONFIG, POSTER_TEMPLATES } from './templates/index.js';

const logger = createLogger('Poster');

export default function Poster({ registrant, config } = {}) {
    const posterConfig = config || DEFAULT_POSTER_CONFIG;
    const Template = POSTER_TEMPLATES[posterConfig.template] || POSTER_TEMPLATES.modern;

    logger.debug('Rendering Poster with template:', posterConfig.template);
    logger.debug('Registrant:', registrant?.name || '(empty)');

    return (
        <div className="page-centered">
            <div className="poster-card poster-visible">
                <Template registrant={registrant} config={posterConfig} />
            </div>
        </div>
    );
}
