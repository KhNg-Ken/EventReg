import React, { useRef, useEffect } from 'react';
import './RegistrationFields.css';

export default function RegistrationFields({
    formData,
    handleChange,
    photoFile,
    setPhotoFile,
    uploading,
    uploadProgress,
}) {
    const fileInputRef = useRef(null);

    useEffect(() => {
        // when parent clears photoFile (e.g., after successful registration), reset the file input
        if (!photoFile && fileInputRef.current) {
            try {
                fileInputRef.current.value = '';
            } catch {
                // ignore any DOM exceptions
            }
        }
    }, [photoFile]);
    return (
        <>
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

            <div className="tds-row">
                <div className="tds-field tds-col-email">
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
                <div className="tds-field tds-col-phone">
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
            </div>

            <div className="tds-field tds-field-full">
                <label className="tds-subtitle">Tải ảnh của bản thân (tùy chọn)</label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="tds-input"
                    onChange={(e) => {
                        const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                        setPhotoFile(file);
                    }}
                />
                <div style={{ fontSize: 12, color: 'var(--tds-gray)', marginTop: 6 }}>
                    Nếu tải ảnh, ảnh sẽ được lưu trong thư mục sự kiện và đổi tên theo định dạng
                    Name_Company
                </div>
            </div>

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
        </>
    );
}
