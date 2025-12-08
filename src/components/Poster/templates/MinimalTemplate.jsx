export default function MinimalTemplate({ registrant, config }) {
    if (!registrant) {
        return (
            <div className="minimal-poster empty">
                <div className="minimal-placeholder">Awaiting first check-in...</div>
            </div>
        );
    }

    const colors = config?.colors || {};
    const posterStyle = {
        '--poster-primary': colors.primary || '#000000',
        '--poster-secondary': colors.secondary || '#666666',
        '--poster-bg': colors.background || '#FFFFFF',
        '--poster-text': colors.text || '#333333',
    };

    return (
        <div className="minimal-poster" style={posterStyle}>
            {config?.backgroundImage && (
                <div
                    className="minimal-poster-bg"
                    style={{ backgroundImage: `url(${config.backgroundImage})` }}
                />
            )}

            <div className="minimal-poster-content">
                {config?.logo && (
                    <div className="minimal-poster-logo">
                        <img src={config.logo} alt="Event Logo" />
                    </div>
                )}

                <div className="minimal-poster-main">
                    {config?.showFields?.photo !== false && registrant.photoUrl && (
                        <div className="minimal-poster-photo">
                            <img src={registrant.photoUrl} alt={registrant.name} />
                        </div>
                    )}

                    <div className="minimal-poster-text">
                        <div className="minimal-poster-name">{registrant.name}</div>

                        {config?.showFields?.company !== false && registrant.company && (
                            <div className="minimal-poster-company">{registrant.company}</div>
                        )}

                        {config?.showFields?.position !== false && registrant.position && (
                            <div className="minimal-poster-position">{registrant.position}</div>
                        )}
                    </div>
                </div>

                {config?.showFields?.qrCode !== false && registrant.qrCode && (
                    <div className="minimal-poster-qr">
                        <img src={registrant.qrCode} alt="QR Code" />
                    </div>
                )}
            </div>
        </div>
    );
}
