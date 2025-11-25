import React, { useState, useEffect } from 'react';
import {
    performRegistrationTransaction,
    listEventWorkbooks,
    readEventConfig,
} from '../api/graphApi.js';
import { sendInviteEmail } from '../api/email.js';
import QRCode from 'qrcode';
import PageFrame from './PageFrame.jsx';
import '../styles/RegisterForm.css';

function RegisterForm({ eventId: propEventId } = {}) {
    const [formData, setFormData] = useState({
        name: '',
        position: '',
        company: '',
        email: '',
        phone: '',
    });
    const [events, setEvents] = useState([]);
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

    // Generate a QR code data URL for the invite payload
    async function generateQrDataUrl(inviteId, fileID, token) {
        const payload = { inviteId, fileID, token };
        try {
            const dataUrl = await QRCode.toDataURL(JSON.stringify(payload));
            return dataUrl;
        } catch (err) {
            console.error('Failed to generate QR code:', err);
            return null;
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { name, position, company, email, phone } = formData;

        // Basic validation (safeguard besides HTML required attrs)
        if (!name.trim() || !position.trim() || !company.trim() || !email.trim() || !phone.trim()) {
            alert('Vui lòng điền tất cả các trường bắt buộc trước khi gửi.');
            return;
        }

        // Prepare phone value for Excel (ensure text)
        const phoneForExcel = "'" + phone;

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
            const result = await performRegistrationTransaction(
                [name, position, company, email, phoneForExcel],
                photoFile,
                name,
                company,
                {
                    fileId: selectedEventId,
                    tableName: selectedEventConfig.tableName,
                    onProgress: (p) => {
                        setUploadProgress(p);
                    },
                }
            );
            const { inviteId: newInviteId, token } = result;
            setInviteId(newInviteId);
            const qrDataUrl = await generateQrDataUrl(newInviteId, selectedEventId, token);
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
            <form className="tds-form" onSubmit={handleSubmit}>
                <div className="tds-field">
                    <label className="tds-subtitle">Chọn sự kiện</label>
                    <select
                        className="tds-input"
                        value={selectedEventId || ''}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                    >
                        {events.length === 0 && <option value="">(Không có sự kiện)</option>}
                        {events.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                                {ev.name}
                            </option>
                        ))}
                    </select>
                    <div style={{ fontSize: 12, color: 'var(--tds-gray)', marginTop: 6 }}>
                        {selectedEventConfig.eventName
                            ? `Tên sự kiện: ${selectedEventConfig.eventName}`
                            : ''}
                        {selectedEventConfig.imageRequired ? ' (Yêu cầu ảnh)' : ''}
                    </div>
                </div>
                <div className="tds-field">
                    <label className="tds-subtitle">Họ và tên</label>
                    <input
                        name="name"
                        className="tds-input"
                        placeholder="Họ và tên"
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="tds-field">
                    <label className="tds-subtitle">Chức vụ</label>
                    <input
                        name="position"
                        className="tds-input"
                        placeholder="Chức vụ"
                        value={formData.position}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="tds-field">
                    <label className="tds-subtitle">Công ty</label>
                    <input
                        name="company"
                        className="tds-input"
                        placeholder="Công ty"
                        value={formData.company}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="tds-field">
                    <label className="tds-subtitle">Email</label>
                    <input
                        name="email"
                        className="tds-input"
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="tds-field tds-field-full">
                    <label className="tds-subtitle">Số điện thoại</label>
                    <input
                        name="phone"
                        className="tds-input"
                        placeholder="Số điện thoại"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="tds-field tds-field-full">
                    <label className="tds-subtitle">Tải ảnh (tùy chọn)</label>
                    <input
                        type="file"
                        accept="image/*"
                        className="tds-input"
                        onChange={(e) => {
                            const f =
                                e.target.files && e.target.files[0] ? e.target.files[0] : null;
                            setPhotoFile(f);
                        }}
                    />
                    <div style={{ fontSize: 12, color: 'var(--tds-gray)', marginTop: 6 }}>
                        Nếu tải ảnh, ảnh sẽ được lưu trong thư mục sự kiện và đổi tên theo định dạng
                        Name_Company
                    </div>
                </div>

                {/* Upload progress bar */}
                {(uploading || uploadProgress > 0) && (
                    <div className="tds-field tds-field-full">
                        <div style={{ fontSize: 12, color: 'var(--tds-gray)', marginBottom: 6 }}>
                            Tải ảnh: {Math.round(uploadProgress * 100)}%
                        </div>
                        <div
                            style={{
                                width: '100%',
                                background: '#eee',
                                height: 10,
                                borderRadius: 6,
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    width: `${Math.min(Math.max(uploadProgress * 100, 0), 100)}%`,
                                    height: '100%',
                                    background: 'var(--tds-red)',
                                    transition: 'width 200ms ease',
                                }}
                            />
                        </div>
                    </div>
                )}

                <div className="tds-field tds-field-full tds-actions">
                    <button className="tds-btn tds-btn-primary" type="submit" disabled={uploading}>
                        Đăng ký & Tạo vé
                    </button>
                    <button
                        className="tds-btn tds-btn-secondary"
                        type="button"
                        onClick={() =>
                            setFormData({
                                name: '',
                                position: '',
                                company: '',
                                email: '',
                                phone: '',
                            })
                        }
                    >
                        Đặt lại
                    </button>
                </div>
            </form>

            {inviteId && (
                <div className="tds-invite">
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 14, color: 'var(--tds-gray)' }}>
                                Mã mời của bạn
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 18 }}>{inviteId}</div>
                        </div>
                        <div className="tds-qr">
                            {qrSrc ? (
                                <div>
                                    <img src={qrSrc} alt="Mã QR mời" />
                                    <div
                                        style={{
                                            marginTop: 8,
                                            display: 'flex',
                                            gap: 8,
                                            justifyContent: 'flex-end',
                                        }}
                                    >
                                        <button
                                            className="tds-btn tds-btn-secondary"
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch(qrSrc);
                                                    const blob = await res.blob();
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `${inviteId || 'invite'}.png`;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    a.remove();
                                                    URL.revokeObjectURL(url);
                                                } catch (err) {
                                                    console.error('Failed to download QR:', err);
                                                }
                                            }}
                                        >
                                            Tải QR
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p>Đang tạo mã QR...</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </PageFrame>
    );
}

export default RegisterForm;
