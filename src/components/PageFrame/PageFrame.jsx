import './PageFrame.css';

export default function PageFrame({
    title,
    subtitle,
    actions,
    children,
    minHeight = 360,
    showBack = false,
    onBack = null,
}) {
    const handleBack = (e) => {
        e && e.stopPropagation();
        if (typeof onBack === 'function') return onBack();
        if (window && window.history && typeof window.history.back === 'function') {
            window.history.back();
        }
    };

    return (
        <div className="page">
            <header className="page-header" role="banner">
                <div className="page-header-inner">
                    {showBack ? (
                        <button
                            className="ui-btn btn-secondary ui-back-btn"
                            type="button"
                            onClick={handleBack}
                            aria-label="Quay lại"
                            title="Quay lại"
                        >
                            ‹
                        </button>
                    ) : null}

                    <div className="page-title-block">
                        <div className="page-title">{title}</div>
                        {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
                    </div>
                </div>

                {actions ? <div className="page-actions">{actions}</div> : null}
            </header>

            <main
                className="page-content"
                role="main"
                style={{
                    padding: 16,
                    minHeight,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                }}
            >
                {children}
            </main>
        </div>
    );
}
