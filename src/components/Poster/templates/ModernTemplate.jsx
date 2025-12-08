export default function ModernTemplate({ registrant, config }) {
    if (!registrant) {
        return (
            <div className="modern-poster empty">
                <div className="modern-poster-content">
                    <div className="modern-placeholder">Awaiting first check-in...</div>
                </div>
            </div>
        );
    }

    const colors = config?.colors || {};
    const posterStyle = {
        '--poster-primary': colors.primary || '#FF6B6B',
        '--poster-secondary': colors.secondary || '#4ECDC4',
        '--poster-bg': colors.background || '#1A1A2E',
        '--poster-text': colors.text || '#2c3e50',
    };

    return (
        <div className="modern-poster" style={posterStyle}>
            <div className="modern-poster-content">
                {config?.logo && (
                    <div className="modern-poster-logo">
                        <img src={config.logo} alt="Event Logo" />
                    </div>
                )}

                {config?.showFields?.photo !== false && registrant.photoUrl && (
                    <div className="modern-poster-photo">
                        <img src={registrant.photoUrl} alt={registrant.name} />
                    </div>
                )}

                <div className="modern-poster-info">
                    <div className="modern-poster-name">{registrant.name}</div>

                    {config?.showFields?.company !== false && registrant.company && (
                        <div className="modern-poster-company">{registrant.company}</div>
                    )}

                    {config?.showFields?.position !== false && registrant.position && (
                        <div className="modern-poster-position">{registrant.position}</div>
                    )}

                    {config?.showFields?.email !== false && registrant.email && (
                        <div className="modern-poster-email">{registrant.email}</div>
                    )}
                </div>

                {config?.showFields?.qrCode !== false && registrant.qrCode && (
                    <div className="modern-poster-qr">
                        <img src={registrant.qrCode} alt="QR Code" />
                    </div>
                )}
            </div>

            {config?.backgroundImage && (
                <div
                    className="modern-poster-bg"
                    style={{ backgroundImage: `url(${config.backgroundImage})` }}
                />
            )}
        </div>
    );
}
