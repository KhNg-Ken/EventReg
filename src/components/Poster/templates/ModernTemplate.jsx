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
                            src="https://companieslogo.com/img/orig/ZBRA_BIG-f7a54900.png?t=1720244494"
                            alt="Zebra Technologies Logo"
                        />
                        <img
                            className="modern-poster-logo"
                            src="https://s3.amazonaws.com/cms.ipressroom.com/219/files/202512/692f56b83d6332f881bbc58b_nvidia-logo-horiz-blk-16x9+1/nvidia-logo-horiz-blk-16x9+1_3b6e36c5-dc74-4a75-86f4-5faefc2a7f7d-prv.png"
                            alt="Nvidia Logo"
                        />
                        <img
                            className="modern-poster-logo"
                            src="https://images.glints.com/unsafe/glints-dashboard.oss-ap-southeast-1.aliyuncs.com/company-logo/84b2580fc91bc2ee5cfcc4e7618264fd.png"
                            alt="TDS Logo"
                        />
                        <img
                            className="modern-poster-logo"
                            src="https://content.kaspersky-labs.com/se/ru/content/ru-ru/images/homepage/kaspersky-logo/kaspersky-logo-v2.svg"
                            alt="Kaspersky Logo"
                        />
                        <img
                            className="modern-poster-logo"
                            src="https://news.tdsynnex.com/wp-content/uploads/2024/03/Tech-Data-New-Logo.jpg"
                            alt="Tech Data Logo"
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
                    {registrant?.config.showImage !== false && registrant.photoUrl && (
                        <div className="modern-poster-photo-large">
                            <img src={registrant.photoUrl} alt={registrant.name} />
                        </div>
                    )}
                    <div className="modern-poster-attendee-label">KHÁCH MỜI</div>
                    <div className="modern-poster-attendee-info">
                        <div className="modern-poster-name">{registrant.name}</div>

                        <div className="modern-poster-details">
                            {registrant?.config.showPosition !== true && registrant.position && (
                                <div className="modern-poster-position">{registrant.position}</div>
                            )}

                            {registrant?.config.showCompany !== true && registrant.company && (
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
