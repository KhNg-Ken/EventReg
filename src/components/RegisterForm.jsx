import React, { useState, useEffect } from 'react';
import { sendInviteEmail } from '../api/email.js';
import {
    listEventWorkbooks,
    readEventConfig,
    registerAttendee,
} from '../utils/registrationUtils.js';
import PageFrame from './PageFrame.jsx';
import EventHeader from './EventHeader.jsx';
import RegistrationFields from './RegistrationFields.jsx';
import QRPanel from './QRPanel.jsx';
import '../styles/RegisterForm.css';

function RegisterForm({ eventId: propEventId } = {}) {
    const [formData, setFormData] = useState({
        name: '',
        position: '',
        company: '',
        email: '',
        phone: '',
    });
    const [, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(null);
    const [selectedEventConfig, setSelectedEventConfig] = useState({
        eventName: null,
        imageRequired: false,
    });
    // determine eventId from (1) prop passed by router, (2) URL search, (3) hash fragment
    const [urlEventId, setUrlEventId] = useState(() => {
        try {
            if (propEventId) return propEventId;
            const s = new URLSearchParams(window.location.search).get('eventId');
            if (s) return s;
            const raw = window.location.hash || '';
            const parts = raw.split('?');
            if (parts.length > 1) {
                const sp = new URLSearchParams(parts[1]);
                return sp.get('eventId');
            }
            return null;
        } catch {
            return null;
        }
    });

    // respond to changes in propEventId or hash changes (so browser back/forward works)
    useEffect(() => {
        if (propEventId) setUrlEventId(propEventId);
        function onHashChange() {
            try {
                const raw = window.location.hash || '';
                const parts = raw.split('?');
                if (parts.length > 1) {
                    const sp = new URLSearchParams(parts[1]);
                    setUrlEventId(sp.get('eventId'));
                }
            } catch {
                // ignore
            }
        }
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, [propEventId]);
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

        // Prepare phone value for Excel (ensure text)
        // (kept as raw `phone` for storage; no Excel write here)

        // Enforce selected event
        if (!selectedEventId) {
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
                eventId: selectedEventId,
                attendee: { name, position, company, email, phone },
                photoFile,
                onProgress: (p) => setUploadProgress(p),
            });
            const { inviteId: newInviteId, qrDataUrl } = result;
            setInviteId(newInviteId);
            setQrSrc(qrDataUrl);
            // Send invite email (best-effort). Do not roll back registration if email fails.
            (async () => {
                try {
                    if (email && qrDataUrl) {
                        const subject = `Mã mời sự kiện: ${newInviteId}`;
                        const body = `Chào ${name},\n\nCảm ơn bạn đã đăng ký. Mã mời của bạn là ${newInviteId}.\n\nTrân trọng,\nTDSouth`;
                        await sendInviteEmail(email, subject, body, qrDataUrl);
                    }
                } catch (mailErr) {
                    console.warn('Failed to send invite email (non-fatal):', mailErr);
                }
            })();
            alert('Đã gửi! Mã mời của bạn đã được tạo.');
            setFormData({ name: '', position: '', company: '', email: '', phone: '' });
        } catch (err) {
            console.error('Registration transaction failed:', err);
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
                const ev = await listEventWorkbooks();
                if (!mounted) return;
                setEvents(ev);
                if (urlEventId) {
                    // if URL specified an eventId, try to select it (even if it's not in the list)
                    setSelectedEventId(urlEventId);
                    try {
                        const cfg = await readEventConfig(urlEventId);
                        if (!mounted) return;
                        setSelectedEventConfig(
                            cfg || { eventName: null, imageRequired: false, tableName: null }
                        );
                    } catch (e) {
                        console.warn('Failed to read config for URL eventId', e);
                    }
                } else if (ev && ev.length) {
                    setSelectedEventId(ev[0].id);
                    const cfg = await readEventConfig(ev[0].id);
                    if (!mounted) return;
                    setSelectedEventConfig(
                        cfg || { eventName: ev[0].name, imageRequired: false, tableName: null }
                    );
                }
            } catch (err) {
                console.warn('Failed to load events', err);
            }
        }
        load();
        return () => {
            mounted = false;
        };
    }, [urlEventId]);

    // when selectedEventId changes, reload config
    useEffect(() => {
        let mounted = true;
        if (!selectedEventId) return;
        async function loadCfg() {
            try {
                const cfg = await readEventConfig(selectedEventId);
                if (!mounted) return;
                setSelectedEventConfig(
                    cfg || { eventName: null, imageRequired: false, tableName: null }
                );
            } catch (e) {
                console.warn('Failed to load event config', e);
            }
        }
        loadCfg();
        return () => {
            mounted = false;
        };
    }, [selectedEventId]);
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

                <QRPanel inviteId={inviteId} qrSrc={qrSrc} />
            </div>
        </PageFrame>
    );
}

export default RegisterForm;
