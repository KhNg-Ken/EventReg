import { createLogger } from '../utils/logger.js';

const logger = createLogger('AdminControls');

export default function AdminControls({ sortAsc = false, onToggleSort, onClearPoster } = {}) {
    return (
        <div style={{ display: 'flex', gap: 8 }}>
            <button
                className="ui-btn"
                onClick={() => {
                    logger.debug('Toggle sort clicked, current:', sortAsc);
                    if (typeof onToggleSort === 'function') onToggleSort();
                }}
            >
                {sortAsc ? 'Sort: Oldest' : 'Sort: Newest'}
            </button>

            <button
                className="ui-btn btn-danger"
                onClick={() => {
                    logger.debug('Clear poster clicked');
                    if (typeof onClearPoster === 'function') onClearPoster();
                }}
            >
                Toggle Live Poster
            </button>
        </div>
    );
}
