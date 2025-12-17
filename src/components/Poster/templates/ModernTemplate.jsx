import './ModernTemplate.css';
import { normalizedDateString } from '../../../utils/dateUtils.js'
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
            <img className="modern-poster-bg" src="src/assets/dark-blue.jpg" alt="Background" />
            <div className="modern-poster-overlay">
                {/* Top Section: 2/9 - Company Logos and Event Name */}
                <div className="modern-poster-top">
                    <div className="modern-poster-logos">
                        <img
                            className="modern-poster-logo"
                            src="https://res.cloudinary.com/danbr3geg/image/upload/v1765871057/Kaspersky_logo_green_CMYK.eps_4EA11AA3_t7u4mc.svg"
                            alt="Kaspersky Logo"
                        />
                        <img
                            className="modern-poster-logo"
                            src="https://res.cloudinary.com/danbr3geg/image/upload/v1765871059/nvidia-logo-vert-pms-wht-no-reg-for-print_p8pymo.svg"
                            alt="Nvidia Logo"
                        />
                        <img
                            className="modern-poster-logo"
                            style={{ minWidth: '500px', height: 'auto' }}
                            src="https://res.cloudinary.com/danbr3geg/image/upload/v1765871058/TDSouth_-_W_jmdsq5.svg"
                            alt="TDS Logo"
                        />

                        <img
                            className="modern-poster-logo"
                            src="https://res.cloudinary.com/danbr3geg/image/upload/v1765871059/Zebra_Logo_W_uxdudh.svg"
                            alt="Zebra Technologies Logo"
                        />

                        <img
                            className="modern-poster-logo"
                            src="https://res.cloudinary.com/danbr3geg/image/upload/v1765871065/Logo_AITC-2_lzrzji.svg"
                            alt="AITC Logo"
                        />
                    </div>
                </div>
                <div className="modern-poster-info">
                    <div className="modern-poster-event-name">{config.name}</div>
                </div>

                {/* DIVIDER */}
                <div
                    style={{
                        width: '65%',
                        height: '1px',
                        backgroundColor: '#E9C457',
                        marginTop: '30px',
                        marginBottom: '40px',
                    }}
                ></div>

                {/* Middle Section: 5/9 - Attendee Info */}
                <div className="modern-poster-middle">
                    <div className="modern-poster-greeting">NHIỆT LIỆT CHÀO MỪNG</div>
                    {registrant?.config.showImage === true && registrant.photoUrl && (
                        <div className="modern-poster-photo-large">
                            <img src={registrant.photoUrl} alt={registrant.name} />
                        </div>
                    )}
                    <div className="modern-poster-attendee-label">KHÁCH MỜI</div>
                    <div className="modern-poster-attendee-info">
                        <div className="modern-poster-name">{registrant.name}</div>

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
                    {config?.location && (
                        <div className="modern-event-location">{config.location}</div>
                    )}
                    {config?.eventDate && (
                        <div className="modern-event-datetime">
                            {normalizedDateString(config.eventDate)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
