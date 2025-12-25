import './ModernTemplate.css';
export default function ModernTemplate({ registrant, config }) {
    if (!registrant) {
        return (
            <div className="modern-poster empty">
                <div className="modern-poster-top">
                    <div className="modern-placeholder">Awaiting first check-in...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-poster">
            <img className="modern-poster-bg" src="src/assets/KV.png" alt="Background" />
            <div className="modern-poster-overlay" alt="Overlay">
                {/* Top Section: 2/9 - Company Logos and Event Name */}
                <div className="modern-poster-top">
                    <div className="modern-poster-logos">
                        {/* First Row: TDSouth, NVIDIA */}
                        <div className="modern-poster-logos-row">
                            <img
                                className="modern-poster-logo"
                                style={{ minWidth: '300px', height: 'auto' }}
                                src="https://res.cloudinary.com/danbr3geg/image/upload/v1765871058/TDSouth_-_W_jmdsq5.svg"
                                alt="TDS Logo"
                            />
                            <img
                                className="modern-poster-logo"
                                style={{ maxWidth: '150px', height: 'auto' }}
                                src="https://res.cloudinary.com/danbr3geg/image/upload/v1765871059/nvidia-logo-vert-pms-wht-no-reg-for-print_p8pymo.svg"
                                alt="Nvidia Logo"
                            />
                        </div>

                        {/* Second Row: AITC, Kaspersky, Zebra */}
                        <div className="modern-poster-logos-row" style={{ marginTop: '-165px' }}>
                            <img
                                className="modern-poster-logo"
                                style={{ maxWidth: '300px', height: 'auto' }}
                                src="https://res.cloudinary.com/danbr3geg/image/upload/v1765871065/Logo_AITC-2_lzrzji.svg"
                                alt="AITC Logo"
                            />
                            <img
                                className="modern-poster-logo"
                                style={{ maxWidth: '300px', height: 'auto' }}
                                src="https://res.cloudinary.com/danbr3geg/image/upload/v1765871057/Kaspersky_logo_green_CMYK.eps_4EA11AA3_t7u4mc.svg"
                                alt="Kaspersky Logo"
                            />
                            <img
                                className="modern-poster-logo"
                                style={{ maxWidth: '500px', height: 'auto', marginLeft: '-50px' }}
                                src="https://res.cloudinary.com/danbr3geg/image/upload/v1765871059/Zebra_Logo_W_uxdudh.svg"
                                alt="Zebra Technologies Logo"
                            />
                        </div>
                    </div>
                </div>

                {/* DIVIDER */}
                <div
                    style={{
                        width: '65%',
                        height: '410px',
                        backgroundColor: 'transparent',
                        marginTop: '30px',
                        marginBottom: '40px',
                    }}
                ></div>

                {/* Middle Section: 5/9 - Attendee Info */}
                <div className="modern-poster-middle">
                    <div className="modern-poster-greeting">NHIỆT LIỆT CHÀO MỪNG</div>
                    <div className="modern-poster-attendee-label">QUÝ KHÁCH</div>
                    <div className="modern-poster-name">{registrant.name}</div>
                    {registrant?.config.showImage === true && registrant.photoUrl ? (
                        <div className="modern-poster-photo-large">
                            <img src={registrant.photoUrl} alt={registrant.name} />
                        </div>
                    ) : (
                        <div className="modern-poster-photo-large">
                            <img src="src/assets/person1.svg" alt="Default Profile" />
                        </div>
                    )}

                    <div className="modern-poster-attendee-info">
                        <div className="modern-poster-details">
                            {registrant?.config.showPosition === true && registrant.position && (
                                <div className="modern-poster-position">{registrant.position}</div>
                            )}

                            {registrant?.config.showCompany === true && registrant.company && (
                                <div className="modern-poster-company">{registrant.company}</div>
                            )}
                        </div>
                    </div>
                </div>
                {/* Bottom Section: 2/9 - Event Information */}
                <div className="modern-poster-bottom">
                    <div className="modern-poster-checked-in">CHECKED IN</div>
                </div>
            </div>
        </div>
    );
}
