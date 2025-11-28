import { createLogger } from '../utils/logger.js';

const logger = createLogger('AdminControls');

export default function AdminControls({ sortAsc = false, onToggleSort, onClearPoster } = {}) {
    return (
        <div style={{ display: 'flex', gap: 8 }}>
            <button
                className="tds-btn"
                onClick={() => {
                    logger.debug('Toggle sort clicked, current:', sortAsc);
                    if (typeof onToggleSort === 'function') onToggleSort();
                }}
            >
                {sortAsc ? 'Sort: Oldest' : 'Sort: Newest'}
            </button>

            <button
                className="tds-btn tds-btn-danger"
                onClick={() => {
                    logger.debug('Clear poster clicked');
                    if (typeof onClearPoster === 'function') onClearPoster();
                }}
            >
                Clear Live Poster
            </button>
        </div>
    );
}
