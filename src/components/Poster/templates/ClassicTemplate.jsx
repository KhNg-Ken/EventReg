export default function ClassicTemplate({ registrant, config }) {
    if (!registrant) {
        return (
            <div className="classic-poster empty">
                <div className="classic-poster-header" />
                <div className="classic-poster-body">
                    <div className="classic-placeholder">Awaiting first check-in...</div>
                </div>
            </div>
        );
    }

    const colors = config?.colors || {};
    const posterStyle = {
        '--poster-primary': colors.primary || '#2C3E50',
        '--poster-secondary': colors.secondary || '#E74C3C',
        '--poster-bg': colors.background || '#ECF0F1',
        '--poster-text': colors.text || '#2C3E50',
    };

    return (
        <div className="classic-poster" style={posterStyle}>
            <div className="classic-poster-header">
                {config?.logo && (
                    <div className="classic-poster-logo">
                        <img src={config.logo} alt="Event Logo" />
                    </div>
                )}
            </div>

            <div className="classic-poster-body">
                <div className="classic-poster-left">
                    {config?.showFields?.photo !== false && registrant.photoUrl && (
                        <div className="classic-poster-photo">
                            <img src={registrant.photoUrl} alt={registrant.name} />
                        </div>
                    )}
                </div>

                <div className="classic-poster-right">
                    <div className="classic-poster-name">{registrant.name}</div>

                    {config?.showFields?.company !== false && registrant.company && (
                        <div className="classic-poster-company">{registrant.company}</div>
                    )}

                    {config?.showFields?.position !== false && registrant.position && (
                        <div className="classic-poster-position">{registrant.position}</div>
                    )}

                    {config?.showFields?.email !== false && registrant.email && (
                        <div className="classic-poster-email">{registrant.email}</div>
                    )}

                    {config?.showFields?.qrCode !== false && registrant.qrCode && (
                        <div className="classic-poster-qr">
                            <img src={registrant.qrCode} alt="QR Code" />
                        </div>
                    )}
                </div>
            </div>

            <div className="classic-poster-footer">
                <div className="classic-footer-line" />
            </div>
        </div>
    );
}
