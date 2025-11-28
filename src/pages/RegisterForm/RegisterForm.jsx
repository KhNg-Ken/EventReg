import React, { useState, useEffect } from 'react';
import { queueEmail } from '../../utils/emailUtils.js';
import { registerAttendee } from '../../utils/registrationUtils.js';
import { listEvents, readEventConfig } from '../../utils/firestoreUtils.js';
import PageFrame from '../../components/PageFrame.jsx';
import EventHeader from '../../components/EventHeader/EventHeader.jsx';
import RegistrationFields from '../../components/RegisterField/RegistrationFields.jsx';
import QRPanel from '../../components/QRPanel/QRPanel.jsx';
import './RegisterForm.css';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('RegisterForm');

function RegisterForm({ event: propEvent } = {}) {
    const [formData, setFormData] = useState({
        name: '',
        position: '',
        company: '',
        email: '',
        phone: '',
    });
    const [, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedEventConfig, setSelectedEventConfig] = useState({
        eventName: null,
        imageRequired: false,
    });
    // determine eventID from (1) prop passed by router, (2) URL search, (3) hash fragment
    const [urlEvent, setUrlEvent] = useState(() => {
        try {
            if (propEvent) return propEvent;
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
    });

    // respond to changes in propEventId or hash changes (so browser back/forward works)
    useEffect(() => {
        if (propEvent) setUrlEvent(propEvent);
        function onHashChange() {
            try {
                const raw = window.location.hash || '';
                const parts = raw.split('?');
                if (parts.length > 1) {
                    const sp = new URLSearchParams(parts[1]);
                    setUrlEvent(sp.get('event'));
                }
            } catch {
                // ignore
            }
        }
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, [propEvent]);
    const [qrSrc, setQrSrc] = useState(null);
    const [inviteId, setInviteId] = useState(null);
    const [photoFile, setPhotoFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // QR data will be returned by `registerAttendee` (server-side/Firestore-backed helper)

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { name, position, company, email, phone } = formData;

        // Basic validation (safeguard besides HTML required attrs)
        if (!name.trim() || !position.trim() || !company.trim() || !email.trim() || !phone.trim()) {
            alert('Vui lòng điền tất cả các trường bắt buộc trước khi gửi.');
            return;
        }

        // Enforce selected event
        if (!selectedEvent) {
            alert('Vui lòng chọn sự kiện');
            return;
        }

        // Enforce image requirement from event config
        if (selectedEventConfig.imageRequired && !photoFile) {
            alert('Ảnh là bắt buộc cho sự kiện này. Vui lòng tải ảnh lên.');
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
                        if (selectedEventConfig && selectedEventConfig.eventID) {
                            evt = selectedEventConfig.eventID;
                        } else {
                            const d =
                                selectedEventConfig && selectedEventConfig.eventDate
                                    ? new Date(selectedEventConfig.eventDate)
                                    : new Date();
                            const yy = String(d.getFullYear()).slice(-2);
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const dd = String(d.getDate()).padStart(2, '0');
                            evt = `${yy}${mm}${dd}`;
                        }

                        // Convert eventDate to a locale string (handles Firestore Timestamp-like objects)
                        const formatEventDate = (val) => {
                            if (!val) return '';
                            try {
                                if (typeof val === 'object' && (val.seconds || val._seconds)) {
                                    const seconds = val.seconds || val._seconds;
                                    const nanos = val.nanoseconds || val._nanoseconds || 0;
                                    const ms = seconds * 1000 + Math.floor(nanos / 1e6);
                                    return new Date(ms).toLocaleString();
                                }
                                const d = new Date(val);
                                return isNaN(d) ? String(val) : d.toLocaleString();
                            } catch {
                                return String(val);
                            }
                        };

                        // Prefer a string location; fall back to common object fields or empty string
                        const eventLocation = (() => {
                            const loc =
                                selectedEventConfig?.location ?? selectedEventConfig?.eventLocation;
                            if (!loc) return '';
                            if (typeof loc === 'string') return loc;
                            return (
                                loc.address || loc.name || loc.displayName || JSON.stringify(loc)
                            );
                        })();

                        // Template data (primitives only)
                        const templateData = {
                            name: name || '',
                            eventName: selectedEventConfig?.name || '',
                            eventID: evt,
                            eventDate: formatEventDate(selectedEventConfig?.eventDate),
                            eventLocation: eventLocation,
                            qrCodeUrl: qrCodeUrl,
                        };

                        await queueEmail({ to: email, data: templateData });
                    }
                } catch (mailErr) {
                    logger.warn('Failed to queue invite email (non-fatal):', mailErr);
                }
            })();
            alert('Đã gửi! Mã mời của bạn đã được tạo.');
        } catch (err) {
            logger.error('Registration transaction failed:', err);
            alert('Đăng ký thất bại. Không có dữ liệu nào được lưu. Vui lòng thử lại.');
            return;
        } finally {
            setUploading(false);
            // reset progress after a short delay so users see 100% if it completed
            setTimeout(() => setUploadProgress(0), 800);
        }
    };

    // Load available events
    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const ev = await listEvents();
                if (!mounted) return;
                setEvents(ev);
                if (urlEvent) {
                    // if URL specified an event, try to select it (even if it's not in the list)
                    setSelectedEvent(urlEvent);
                    try {
                        const cfg = await readEventConfig(urlEvent);
                        if (!mounted) return;
                        setSelectedEventConfig(
                            cfg || { eventName: null, imageRequired: false, tableName: null }
                        );
                    } catch (e) {
                        logger.warn('Failed to read config for URL event', e);
                    }
                } else if (ev && ev.length) {
                    setSelectedEvent(ev[0].id);
                    const cfg = await readEventConfig(ev[0].id);
                    if (!mounted) return;
                    setSelectedEventConfig(
                        cfg || { eventName: ev[0].name, imageRequired: false, tableName: null }
                    );
                }
            } catch (err) {
                logger.warn('Failed to load events', err);
            }
        }
        load();
        return () => {
            mounted = false;
        };
    }, [urlEvent]);

    // when selectedEventId changes, reload config
    useEffect(() => {
        let mounted = true;
        if (!selectedEvent) return;
        async function loadCfg() {
            try {
                const cfg = await readEventConfig(selectedEvent);
                if (!mounted) return;
                setSelectedEventConfig(
                    cfg || { eventName: null, imageRequired: false, tableName: null }
                );
            } catch (e) {
                logger.warn('Failed to load event config', e);
            }
        }
        loadCfg();
        return () => {
            mounted = false;
        };
    }, [selectedEvent]);
    return (
        <PageFrame
            title="Đăng ký sự kiện TDSouth"
            subtitle="Đăng ký sự kiện — mã mời của bạn sẽ được tạo ngay lập tức"
            showBack
            onBack={() => (window.location.hash = '#/events')}
            minHeight={420}
        >
            {/* Event title & description (moved to reusable component) */}
            <EventHeader config={selectedEventConfig} />
            <div className="tds-register-grid">
                <form className="tds-form" onSubmit={handleSubmit}>
                    <RegistrationFields
                        formData={formData}
                        handleChange={handleChange}
                        photoFile={photoFile}
                        setPhotoFile={setPhotoFile}
                        uploading={uploading}
                        uploadProgress={uploadProgress}
                    />

                    <div className="tds-field tds-field-full tds-actions">
                        <button
                            className="tds-btn tds-btn-primary"
                            type="submit"
                            disabled={uploading}
                        >
                            Đăng ký & Tạo vé
                        </button>
                    </div>
                </form>

                <QRPanel qrSrc={qrSrc} inviteId={inviteId} />
            </div>
        </PageFrame>
    );
}

export default RegisterForm;
