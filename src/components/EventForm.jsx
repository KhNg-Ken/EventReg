import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { formatForDatetimeLocal, toDateObject } from '../utils/dateUtils.js';

export default function EventForm({
    initial = {},
    onSubmit,
    submitting = false,
    qrCodeUrl: propQrCodeUrl,
}) {
    const [name, setName] = useState(initial.name || '');
    const [description, setDescription] = useState(initial.description || '');
    const [location, setLocation] = useState(initial.location || '');
    const [eventDate, setEventDate] = useState(() => {
        const d = toDateObject(initial.eventDate);
        return d ? formatForDatetimeLocal(d) : '';
    });
    const [endDate, setEndDate] = useState(() => {
        const d = toDateObject(initial.endDate);
        return d ? formatForDatetimeLocal(d) : '';
    });
    const [optionalCompany, setOptionalCompany] = useState(
        initial.config?.optionalCompany ? initial.config.optionalCompany : false
    );
    const [optionalPosition, setOptionalPosition] = useState(
        initial.config?.optionalPosition ? initial.config.optionalPosition : false
    );
    const [optionalImage, setOptionalImage] = useState(
        initial.config?.optionalImage ? initial.config.optionalImage : false
    );
    const [status, setStatus] = useState(initial.status || 'ongoing');
    const [bannerUrl, setBannerUrl] = useState(initial.bannerUrl || '');
    const [primaryColor, setPrimaryColor] = useState(initial.colors?.primary || 'var(--primary)');
    const [secondaryColor, setSecondaryColor] = useState(
        initial.colors?.secondary || 'var(--secondary-dark)'
    );
    const [accentColor, setAccentColor] = useState(initial.colors?.accent || 'var(--secondary)');

    function handleSubmit(e) {
        e && e.preventDefault();
        // Convert datetime-local string (YYYY-MM-DDTHH:mm) to Date object to preserve local time
        const eventDateObj = eventDate ? new Date(eventDate) : null;
        const endDateObj = endDate ? new Date(endDate) : null;

        const payload = {
            name: name.trim(),
            description: description || '',
            location: location || '',
            // Send Date objects directly - Firestore will store as Timestamp in local time
            eventDate: eventDateObj,
            endDate: endDateObj,
            optionalCompany,
            optionalPosition,
            optionalImage,
            status,
            bannerUrl: bannerUrl || '',
            colors: {
                primary: primaryColor || 'var(--primary)',
                secondary: secondaryColor || 'var(--secondary-dark)',
                accent: accentColor || 'var(--secondary)',
            },
        };
        // Include optional QR URL when provided (Cloudinary upload result)
        const qr = propQrCodeUrl || initial?.qrCodeUrl || null;
        if (qr) payload.qrCodeUrl = qr;
        if (typeof onSubmit === 'function') onSubmit(payload);
    }

    return (
        <form className="form" onSubmit={handleSubmit}>
            <div className="field">
                <label className="subtitle">Tên sự kiện</label>
                <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
            </div>

            <div className="field">
                <label className="subtitle">Mô tả</label>
                <textarea
                    className="input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            <div className="row">
                <div className="field col-email">
                    <label className="subtitle">Ngày diễn ra</label>
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
                        className="input datepicker-input"
                    />
                </div>
                <div className="field col-phone">
                    <label className="subtitle">Kết thúc đăng ký</label>
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
                        className="input datepicker-input"
                    />
                </div>
            </div>

            <div className="field">
                <label className="subtitle">Địa điểm</label>
                <input
                    className="input"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                />
            </div>

            <div className="field">
                <label className="subtitle">Trường tùy chọn</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="checkbox"
                            checked={optionalCompany}
                            onChange={(e) => setOptionalCompany(e.target.checked)}
                        />{' '}
                        Ẩn công ty
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="checkbox"
                            checked={optionalPosition}
                            onChange={(e) => setOptionalPosition(e.target.checked)}
                        />{' '}
                        Ẩn chức danh
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="checkbox"
                            checked={optionalImage}
                            onChange={(e) => setOptionalImage(e.target.checked)}
                        />{' '}
                        Ẩn ảnh
                    </label>
                </div>
            </div>

            <div className="field">
                <label className="subtitle">Trạng thái</label>
                <select
                    className="select-input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                >
                    <option value="ongoing">Đang diễn ra</option>
                    <option value="hiatus">Tạm dừng</option>
                    <option value="completed">Hoàn thành</option>
                </select>
            </div>

            <div className="field">
                <label className="subtitle">Banner URL</label>
                <input
                    className="input"
                    type="url"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://example.com/banner.jpg"
                />
            </div>

            <div className="field">
                <label className="subtitle">Màu sắc</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                            Primary
                        </label>
                        <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            style={{ width: '100%', height: 40 }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                            Secondary
                        </label>
                        <input
                            type="color"
                            value={secondaryColor}
                            onChange={(e) => setSecondaryColor(e.target.value)}
                            style={{ width: '100%', height: 40 }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                            Accent
                        </label>
                        <input
                            type="color"
                            value={accentColor}
                            onChange={(e) => setAccentColor(e.target.value)}
                            style={{ width: '100%', height: 40 }}
                        />
                    </div>
                </div>
            </div>

            <div className="field actions" style={{ marginTop: 12 }}>
                <button className="ui-btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? 'Đang lưu...' : 'Lưu'}
                </button>
            </div>
        </form>
    );
}
