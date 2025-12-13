import { toDataURL } from 'qrcode';
import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import PageFrame from '../../components/PageFrame/PageFrame.jsx';
import { DEFAULT_POSTER_CONFIG } from '../../components/Poster/templates/index.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { adminCreateEvent, adminUpdateEvent } from '../../utils/adminProxy.js';
import { uploadToCloudinary } from '../../utils/cloudinaryUtils.js';
import { createLogger } from '../../utils/logger.js';
import './CreateEvent.css';

const logger = createLogger('CreateEvent');

function CreateEvent() {
    const [eventName, setEventName] = useState('');
    const [optionalCompany, setOptionalCompany] = useState(false);
    const [optionalPosition, setOptionalPosition] = useState(false);
    const [optionalImage, setOptionalImage] = useState(false);
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [creating, setCreating] = useState(false);
    const [qrUploading, setQrUploading] = useState(false);
    const [result, setResult] = useState(null);

    const { showToast } = useToast();

    const handleCreate = async () => {
        if (!eventName.trim()) {
            showToast('Vui lòng nhập tên sự kiện', { type: 'error' });
            return;
        }
        try {
            setCreating(true);
            setResult(null);

            // Call server callable to create event document
            // Convert YYYY-MM-DDTHH:mm format to Date object to preserve local time
            const eventDateObj = eventDate ? new Date(eventDate) : null;
            const endDateObj = endDate ? new Date(endDate) : null;

            // Format event date/time for poster display
            const eventDateTime = eventDateObj
                ? `${eventDateObj.toLocaleDateString('vi-VN')} - ${eventDateObj.toLocaleTimeString(
                      'vi-VN',
                      { hour: '2-digit', minute: '2-digit' }
                  )}`
                : '';

            // Create posterConfig with event details
            const posterConfigWithDetails = {
                ...DEFAULT_POSTER_CONFIG,
                eventLocation: location || '',
                eventDateTime: eventDateTime,
            };

            const res = await adminCreateEvent({
                name: eventName.trim(),
                description: description || '',
                location: location || '',
                // structured config: optionalX = true means the field is optional for users
                config: {
                    optionalCompany: !!optionalCompany,
                    optionalPosition: !!optionalPosition,
                    optionalImage: !!optionalImage,
                },
                // Poster configuration with event details
                posterConfig: posterConfigWithDetails,
                // Send Date objects directly - Firestore will store as Timestamp in local time
                eventDate: eventDateObj,
                endDate: endDateObj,
                status: 'ongoing',
            });

            setResult({
                success: true,
                ...res,
                config: { optionalCompany, optionalPosition, optionalImage },
            });
            showToast('Đã tạo sự kiện: ' + (res?.docId || res?.eventID || ''), { type: 'success' });

            // prepare shareable URL (include eventId in query string)
            try {
                const url = new URL(window.location.href);
                url.hash = `#/register?event=${encodeURIComponent(res.docId || '')}`;
                const shareUrl = url.toString();
                setResult((prev) => ({ ...prev, shareUrl }));

                // Generate QR image for the register link using local `qrcode` lib,
                // upload to Cloudinary and attach to event. We `await` this so the
                // Create button remains disabled until the QR upload finishes to
                // avoid duplicate submissions.
                async function generateAndAttachQr() {
                    try {
                        setQrUploading(true);
                        // Create a data URL (PNG) for the QR
                        const dataUrl = await toDataURL(shareUrl, { width: 800 });
                        // Convert data URL to Blob for upload
                        const blob = await (await fetch(dataUrl)).blob();

                        // Upload to Cloudinary (folder: form_qr, publicId: docId)
                        const uploadRes = await uploadToCloudinary(blob, {
                            folder: 'form_qr',
                            publicId: res.docId,
                            uploadPreset: 'form_qr',
                        });

                        const qrUrl = uploadRes?.secure_url || uploadRes?.url || null;
                        if (qrUrl) {
                            // Persist QR URL to event document
                            await adminUpdateEvent({ id: res.docId, qrCodeUrl: qrUrl });
                            setResult((prev) => ({ ...prev, qrCodeUrl: qrUrl }));
                        }
                    } catch (e) {
                        // non-fatal: log and continue
                        logger.error('QR generation/upload failed', e);
                        setResult((prev) => ({ ...prev, qrUploadError: String(e) }));
                    } finally {
                        setQrUploading(false);
                    }
                }

                await generateAndAttachQr();
            } catch {
                // ignore
            }
        } catch (err) {
            logger.error('Create event failed', err);
            showToast('Không thể tạo sự kiện. Kiểm tra quyền và thử lại.', { type: 'error' });
            setResult({ success: false, error: err });
        } finally {
            setCreating(false);
        }
    };

    return (
        <PageFrame
            title="Tạo sự kiện"
            subtitle="Quản trị: tạo mẫu đăng ký sự kiện"
            showBack
            onBack={() => (window.location.hash = '#/events')}
            minHeight={360}
        >
            <div className="create-form">
                <div className="create-field">
                    <label className="create-subtitle">Tên sự kiện</label>
                    <input
                        className="create-input"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        placeholder="Tên sự kiện"
                    />
                </div>

                <div className="create-field">
                    <label className="create-subtitle">Mô tả</label>
                    <textarea
                        className="create-input"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Mô tả sự kiện (tùy chọn)"
                    />
                </div>

                <div className="create-field">
                    <label className="create-subtitle">Địa điểm</label>
                    <input
                        className="create-input"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Địa điểm sự kiện"
                    />
                </div>

                <div className="create-row">
                    <div className="create-field create-col-email">
                        <label className="create-subtitle">Ngày diễn ra</label>
                        <DatePicker
                            selected={eventDate ? new Date(eventDate) : null}
                            onChange={(date) => {
                                if (date) {
                                    // Format: YYYY-MM-DDTHH:mm for datetime-local format
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    const hours = String(date.getHours()).padStart(2, '0');
                                    const minutes = String(date.getMinutes()).padStart(2, '0');
                                    const iso = `${year}-${month}-${day}T${hours}:${minutes}`;
                                    setEventDate(iso);
                                } else {
                                    setEventDate('');
                                }
                            }}
                            showTimeSelect
                            timeIntervals={15}
                            dateFormat="dd/MM/yyyy hh:mm a"
                            placeholderText="Chọn ngày diễn ra"
                            className="create-input datepicker-input"
                        />
                    </div>
                    <div className="create-field create-col-phone">
                        <label className="create-subtitle">Hạn đăng ký</label>
                        <DatePicker
                            selected={endDate ? new Date(endDate) : null}
                            onChange={(date) => {
                                if (date) {
                                    // Format: YYYY-MM-DDTHH:mm for datetime-local format
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    const hours = String(date.getHours()).padStart(2, '0');
                                    const minutes = String(date.getMinutes()).padStart(2, '0');
                                    const iso = `${year}-${month}-${day}T${hours}:${minutes}`;
                                    setEndDate(iso);
                                } else {
                                    setEndDate('');
                                }
                            }}
                            showTimeSelect
                            timeIntervals={15}
                            dateFormat="dd/MM/yyyy hh:mm a"
                            placeholderText="Chọn hạn đăng ký"
                            className="create-input datepicker-input"
                        />
                    </div>
                </div>

                <div className="create-field">
                    <label className="create-subtitle">Tùy chọn biểu mẫu đăng ký</label>
                    <div
                        style={{ display: 'flex', gap: 12, flexDirection: 'column', marginTop: 8 }}
                    >
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={optionalCompany}
                                onChange={(e) => setOptionalCompany(e.target.checked)}
                                className="checkbox-label"
                            />{' '}
                            Ẩn công ty
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={optionalPosition}
                                onChange={(e) => setOptionalPosition(e.target.checked)}
                            />{' '}
                            Ẩn chức vụ
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={optionalImage}
                                onChange={(e) => setOptionalImage(e.target.checked)}
                            />{' '}
                            Bắt buộc đăng ảnh cá nhân
                        </label>
                    </div>
                </div>

                <div className="create-field create-actions">
                    <button
                        className="create-btn create-btn-primary"
                        onClick={handleCreate}
                        disabled={creating || qrUploading}
                    >
                        {creating || qrUploading ? (
                            <>
                                <span className="spinner" aria-hidden="true" />
                                Đang xử lý...
                            </>
                        ) : (
                            'Tạo sự kiện'
                        )}
                    </button>
                </div>
            </div>

            {result && result.success && (
                <div style={{ marginTop: 12 }}>
                    <div>
                        Đã tạo sự kiện: <strong>{result.docId || result.eventID || ''}</strong>
                    </div>
                    <div>Mã sự kiện: {result.eventID}</div>
                    {result && result.eventDateISO && (
                        <div>Ngày diễn ra: {result.eventDateISO}</div>
                    )}
                    {result && result.endDateISO && <div>Hạn đăng ký: {result.endDateISO}</div>}
                    <div>
                        Cấu hình:
                        <ul style={{ marginTop: 6 }}>
                            <li>
                                optionalCompany: {result.config?.optionalCompany ? 'true' : 'false'}
                            </li>
                            <li>
                                optionalPosition:{' '}
                                {result.config?.optionalPosition ? 'true' : 'false'}
                            </li>
                            <li>
                                optionalImage: {result.config?.optionalImage ? 'true' : 'false'}
                            </li>
                        </ul>
                    </div>
                    {result.shareUrl && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 13 }}>Shareable link</div>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginTop: 6,
                                    alignItems: 'center',
                                }}
                            >
                                <input
                                    readOnly
                                    value={result.shareUrl}
                                    style={{ flex: 1, padding: 8, border: '1px solid #ddd' }}
                                />
                                <button
                                    className="create-btn create-btn-secondary"
                                    onClick={() => {
                                        navigator.clipboard.writeText(result.shareUrl);
                                    }}
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    )}
                    {(qrUploading || (result && result.qrUploading)) && (
                        <div style={{ marginTop: 8 }}>Đang tải QR lên Cloudinary...</div>
                    )}
                    {result && result.qrCodeUrl && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 13 }}>QR code</div>
                            <div style={{ marginTop: 6 }}>
                                <img
                                    src={result.qrCodeUrl}
                                    alt="Event QR"
                                    style={{
                                        width: 200,
                                        height: 200,
                                        objectFit: 'contain',
                                        border: '1px solid #ddd',
                                        borderRadius: 8,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                    {result && result.qrUploadError && (
                        <div style={{ marginTop: 8, color: 'var(--red)' }}>
                            Lỗi QR: {String(result.qrUploadError)}
                        </div>
                    )}
                </div>
            )}

            {result && result.success === false && (
                <div style={{ marginTop: 12, color: 'var(--red)' }}>
                    Lỗi: {String(result.error)}
                </div>
            )}
        </PageFrame>
    );
}

export default CreateEvent;
