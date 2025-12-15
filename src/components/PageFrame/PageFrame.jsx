import './PageFrame.css';
import chevron_left from '../../assets/icons/chevron_left_40.svg';

export default function PageFrame({
    title,
    subtitle,
    actions,
    children,
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
                        <img src={chevron_left} alt="Back" className="page-back-btn" onClick={handleBack} />
                    ) : null}

                    <div className="page-title-block">
                        <div className="page-title">{title}</div>
                        {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
                    </div>
                </div>

                {actions ? <div className="page-actions">{actions}</div> : null}
            </header>

            <main className="page-content" role="main">
                {children}
            </main>
        </div>
    );
}
