import { useEffect, useState } from 'react';
import EventHeader from '../../components/EventHeader/EventHeader.jsx';
import PageFrame from '../../components/PageFrame/PageFrame.jsx';
import QRPanel from '../../components/QRPanel/QRPanel.jsx';
import RegistrationFields from '../../components/RegisterField/RegistrationFields.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { toRgba } from '../../utils/conversionUtils.js';
import { normalizedDateString } from '../../utils/dateUtils.js';
import { sendGraphEmail } from '../../utils/emailUtils.js';
import { readEventInfo } from '../../utils/firestoreUtils.js';
import { createLogger } from '../../utils/logger.js';
import { registerAttendee } from '../../utils/registrationUtils.js';
import FormDoesNotExist from './FormDoesNotExist.jsx';
import './RegisterForm.css';

const logger = createLogger('RegisterForm');

function RegisterForm() {
    const [formData, setFormData] = useState({
        name: '',
        position: '',
        company: '',
        email: '',
        phone: '',
    });
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedEventInfo, setSelectedEventInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [formDoesNotExist, setFormDoesNotExist] = useState(true);

    // Extract event ID from URL only
    const urlEvent = (() => {
        try {
            const s = new URLSearchParams(window.location.search).get('event');
            if (s) return s;
            const raw = window.location.hash || '';
            const parts = raw.split('?');
            if (parts.length > 1) {
                const sp = new URLSearchParams(parts[1]);
                return sp.get('event');
            }
            return null;
        } catch {
            return null;
        }
    })();
    const [qrSrc, setQrSrc] = useState(null);
    const [inviteId, setInviteId] = useState(null);
    const [photoFile, setPhotoFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [optOutCompany, setOptOutCompany] = useState(false);
    const [optOutPosition, setOptOutPosition] = useState(false);

    // Derive event config flags from selectedEventInfo.config
    const eventConfig = selectedEventInfo?.config || {};
    const allowOptOutCompany = !!eventConfig.optionalCompany;
    const allowOptOutPosition = !!eventConfig.optionalPosition;
    const allowOptOutImage = !!eventConfig.optionalImage;

    // Check if all mandatory fields are filled
    const isFormValid = () => {
        const { name, position, company, email, phone } = formData;

        // Basic required fields
        if (!name.trim() || !email.trim() || !phone.trim()) {
            return false;
        }

        // Position is required unless opted out
        if (!allowOptOutPosition && !position.trim()) {
            return false;
        }
        if (allowOptOutPosition && !optOutPosition && !position.trim()) {
            return false;
        }

        // Company is required unless opted out
        if (!allowOptOutCompany && !company.trim()) {
            return false;
        }
        if (allowOptOutCompany && !optOutCompany && !company.trim()) {
            return false;
        }

        // Image is required if event config demands it
        if (!allowOptOutImage && !photoFile) {
            return false;
        }

        // Event must be selected
        if (!selectedEvent) {
            return false;
        }

        return true;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // QR data will be returned by `registerAttendee` (server-side/Firestore-backed helper)

    const { showToast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { name, position, company, email, phone } = formData;

        // Basic validation (safeguard besides HTML required attrs)
        if (!name.trim() || !position.trim() || !company.trim() || !email.trim() || !phone.trim()) {
            showToast('Vui lòng điền tất cả các trường bắt buộc trước khi gửi.', { type: 'error' });
            return;
        }

        // Enforce selected event
        if (!selectedEvent) {
            showToast('Vui lòng chọn sự kiện', { type: 'error' });
            return;
        }

        // Enforce image requirement from event config
        if (!allowOptOutImage && !photoFile) {
            showToast('Ảnh là bắt buộc cho sự kiện này. Vui lòng tải ảnh lên.', { type: 'error' });
            return;
        }

        // Use transactional operation that uploads optional photo and appends the row atomically
        try {
            setUploading(true);
            setUploadProgress(0);
            const result = await registerAttendee({
                eventDoc: selectedEvent,
                attendee: { name, position, company, email, phone },
                photoFile,
                onProgress: (p) => setUploadProgress(p),
                config: {
                    showCompany: !optOutCompany,
                    showPosition: !optOutPosition,
                    showImage: !!photoFile,
                },
            });
            // registerAttendee now returns a hosted `qrCodeUrl` (falls back to data URI)
            const { inviteId, qrCodeUrl } = result;
            logger.log('Registration successful, QR code URL:', qrCodeUrl);
            setInviteId(inviteId);
            setQrSrc(qrCodeUrl);
            // Queue invite email (best-effort). Do not roll back registration if queuing fails.
            (async () => {
                try {
                    if (email && qrCodeUrl) {
                        // Build event identifier YYMMDD (prefer eventID field, otherwise derive from eventDate or today)
                        let evt;
                        if (selectedEventInfo && selectedEventInfo.eventID) {
                            evt = selectedEventInfo.eventID;
                        } else {
                            const d =
                                selectedEventInfo && selectedEventInfo.eventDate
                                    ? new Date(selectedEventInfo.eventDate)
                                    : new Date();
                            const yy = String(d.getFullYear()).slice(-2);
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const dd = String(d.getDate()).padStart(2, '0');
                            evt = `${yy}${mm}${dd}`;
                        }

                        // Prefer a string location; fall back to common object fields or empty string
                        const eventLocation = (() => {
                            const loc =
                                selectedEventInfo?.location ?? selectedEventInfo?.eventLocation;
                            if (!loc) return '';
                            if (typeof loc === 'string') return loc;
                            return (
                                loc.address || loc.name || loc.displayName || JSON.stringify(loc)
                            );
                        })();

                        // Template data (primitives only)
                        const templateData = {
                            name: name || '',
                            eventName: selectedEventInfo?.name || '',
                            eventID: evt,
                            eventDate: normalizedDateString(selectedEventInfo?.eventDate),
                            eventLocation: eventLocation,
                            qrCodeUrl: qrCodeUrl,
                            subject: `Mã mời tham dự sự kiện Giải Pháp CNTT Khối Sản Xuất cùng TDSouth`,
                        };

                        await sendGraphEmail({
                            to: email,
                            templateName: 'ai_application_event', // path under email templates
                            templateData,
                        });
                    }
                } catch (mailErr) {
                    logger.warn('Failed to queue invite email (non-fatal):', mailErr);
                }
            })();
            showToast('Đã gửi! Mã mời của bạn đã được tạo.', { type: 'success' });
        } catch (err) {
            logger.error('Registration transaction failed:', err);

            // Check for specific error types
            const errorMessage = err?.message || '';
            const errorCode = err?.code || err?.original?.code;

            // Handle duplicate email conflict (409/ALREADY_EXISTS)
            if (
                errorCode === 'already-exists' ||
                errorMessage.toLowerCase().includes('already exists')
            ) {
                showToast('Email này đã được đăng ký cho sự kiện này.', {
                    type: 'error',
                });
            } else {
                showToast('Đăng ký thất bại. Vui lòng thử lại.', {
                    type: 'error',
                });
            }
            return;
        } finally {
            setUploading(false);
            // reset progress after a short delay so users see 100% if it completed
            setTimeout(() => setUploadProgress(0), 800);
        }
    };

    // Load event info from Firestore based on URL parameter
    useEffect(() => {
        let mounted = true;

        async function loadEventInfo() {
            if (!urlEvent) {
                setLoading(false);
                logger.warn('No event ID in URL');
                return;
            }

            setLoading(true);
            setSelectedEvent(urlEvent);

            try {
                const cfg = await readEventInfo(urlEvent);
                if (!mounted) return;

                if (cfg) {
                    if (
                        !(
                            cfg.status === 'completed' ||
                            cfg.status === 'hiatus' ||
                            new Date(cfg.eventDate) < new Date() ||
                            new Date(cfg.endDate) < new Date()
                        )
                    ) {
                        setSelectedEventInfo(cfg);
                        setFormDoesNotExist(false);
                    }
                } else {
                    logger.warn('Event not found:', urlEvent);
                    setSelectedEventInfo(null);
                }
            } catch (e) {
                logger.error('Failed to load event info:', e);
                setSelectedEventInfo(null);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadEventInfo();

        return () => {
            mounted = false;
        };
    }, [urlEvent]);

    // Never show back button - this is a standalone registration page
    const showBackButton = false;

    // Show loading state
    if (loading) {
        return (
            <PageFrame
                title="Đăng ký sự kiện TDSouth"
                subtitle="Đang tải thông tin sự kiện..."
                minHeight={420}
            >
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div className="spinner" />
                </div>
            </PageFrame>
        );
    }

    // Show error if form does not exist
    if (formDoesNotExist) {
        return <FormDoesNotExist />;
    }

    // Show error if no event ID in URL
    if (!urlEvent) {
        return (
            <PageFrame
                title="Đăng ký sự kiện TDSouth"
                subtitle="Thiếu thông tin sự kiện"
                minHeight={420}
            >
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <h3>Không tìm thấy sự kiện</h3>
                    <p style={{ color: 'var(--gray)' }}>
                        Vui lòng sử dụng link đăng ký chính thức từ ban tổ chức.
                    </p>
                </div>
            </PageFrame>
        );
    }

    // Show error if event doesn't exist
    if (!selectedEventInfo) {
        return (
            <PageFrame
                title="Đăng ký sự kiện TDSouth"
                subtitle="Không tìm thấy sự kiện"
                minHeight={420}
            >
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <h3>Sự kiện không tồn tại</h3>
                    <p style={{ color: 'var(--gray)' }}>
                        Sự kiện này có thể đã bị xóa hoặc link không hợp lệ.
                    </p>
                </div>
            </PageFrame>
        );
    }

    return (
        <div className="register-page-shell">
            {selectedEventInfo?.bannerUrl ? (
                <div className="register-banner">
                    <img src={selectedEventInfo.bannerUrl} alt="Event banner" loading="lazy" />
                </div>
            ) : null}

            <PageFrame
                title="Đăng ký sự kiện TDSouth"
                subtitle="Đăng ký sự kiện — mã mời của bạn sẽ được tạo ngay lập tức"
                showBack={showBackButton}
                minHeight={420}
            >
                {/* Event title & description (moved to reusable component) */}
                <EventHeader eventInfo={selectedEventInfo} />
                <div className="register-grid">
                    <form className="register-form" onSubmit={handleSubmit}>
                        <RegistrationFields
                            formData={formData}
                            handleChange={handleChange}
                            photoFile={photoFile}
                            setPhotoFile={setPhotoFile}
                            uploading={uploading}
                            uploadProgress={uploadProgress}
                            optOutCompany={optOutCompany}
                            setOptOutCompany={setOptOutCompany}
                            optOutPosition={optOutPosition}
                            setOptOutPosition={setOptOutPosition}
                            allowOptOutCompany={allowOptOutCompany}
                            allowOptOutPosition={allowOptOutPosition}
                            allowOptOutImage={allowOptOutImage}
                            bannerUrl={selectedEventInfo?.bannerUrl}
                            colors={selectedEventInfo?.colors}
                        />

                        <div className="register-actions field-full actions">
                            <button
                                className="ui-btn-primary"
                                type="submit"
                                disabled={uploading || !isFormValid()}
                                style={{
                                    // Bind to event secondary color (fallback to red)
                                    '--event-secondary':
                                        selectedEventInfo?.colors?.secondary || '#d32f2f',
                                    '--event-secondary-soft': toRgba(
                                        selectedEventInfo?.colors?.secondary || '#d32f2f',
                                        0.12
                                    ),
                                    background: !(uploading || !isFormValid()) ? 'var(--event-secondary)' : undefined,
                                    borderColor: !(uploading || !isFormValid()) ? 'var(--event-secondary)' : undefined,
                                }}
                            >
                                Đăng ký & Tạo vé
                            </button>
                        </div>
                    </form>

                    <QRPanel qrSrc={qrSrc} inviteId={inviteId} />
                </div>
            </PageFrame>
        </div>
    );
}

export default RegisterForm;
