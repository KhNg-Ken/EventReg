import { useEffect, useRef } from 'react';
import './RegistrationFields.css';

export default function RegistrationFields({
    formData,
    handleChange,
    photoFile,
    setPhotoFile,
    uploading,
    uploadProgress,
    // opt-out controls (parent manages state)
    optOutCompany,
    setOptOutCompany,
    optOutPosition,
    setOptOutPosition,
    // event config flags (from event document)
    allowOptOutCompany = false,
    allowOptOutPosition = false,
    allowOptOutImage = false,
    colors = {},
}) {
    const fileInputRef = useRef(null);

    const Label = ({ children, required = false }) => (
        <label className="reg-subtitle">
            {children}
            {required ? <span className="reg-required"> *</span> : null}
        </label>
    );

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

    const styleVars = {
        '--reg-primary': colors.primary || '#b40000ff',
        '--reg-secondary': colors.secondary || '#000000ff',
        '--reg-accent': colors.accent || '#000275ff',
    };

    return (
        <>
            <div className="reg-field" style={styleVars}>
                <Label required>Họ và tên</Label>
                <input
                    name="name"
                    className="reg-input"
                    placeholder="Họ và tên"
                    value={formData.name}
                    onChange={handleChange}
                    minLength="2"
                    maxLength="100"
                    pattern="[\\p{L}\\s'-]+"
                    title="Vui lòng nhập tên hợp lệ (từ 2-100 ký tự, chỉ chứa chữ cái, khoảng trắng, gạch ngang hoặc dấu ngoặc kép)"
                    required
                />
            </div>

            <div className="reg-field">
                <Label required>Chức vụ</Label>
                <input
                    name="position"
                    className="reg-input"
                    placeholder="Chức vụ"
                    value={formData.position}
                    onChange={handleChange}
                    minLength="2"
                    maxLength="100"
                    pattern="[\\p{L}\\s0-9'-]+"
                    title="Vui lòng nhập chức vụ hợp lệ (từ 2-100 ký tự)"
                    required
                />
                {allowOptOutPosition && (
                    <div style={{ marginTop: 6 }}>
                        <label
                            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            <input
                                type="checkbox"
                                checked={!!optOutPosition}
                                onChange={(e) =>
                                    setOptOutPosition && setOptOutPosition(e.target.checked)
                                }
                            />
                            Không hiển thị chức vụ trên vé
                        </label>
                    </div>
                )}
            </div>

            <div className="reg-field">
                <Label required>Công ty</Label>
                <input
                    name="company"
                    className="reg-input"
                    placeholder="Công ty"
                    value={formData.company}
                    onChange={handleChange}
                    minLength="2"
                    maxLength="100"
                    pattern="[\\p{L}\\s0-9.&'-]+"
                    title="Vui lòng nhập tên công ty hợp lệ (từ 2-100 ký tự)"
                    required
                />
                {allowOptOutCompany && (
                    <div style={{ marginTop: 6 }}>
                        <label
                            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            <input
                                type="checkbox"
                                checked={!!optOutCompany}
                                onChange={(e) =>
                                    setOptOutCompany && setOptOutCompany(e.target.checked)
                                }
                            />
                            Không hiển thị công ty trên vé
                        </label>
                    </div>
                )}
            </div>

            <div className="reg-row">
                <div className="reg-field reg-col-email">
                    <Label required>Email</Label>
                    <input
                        name="email"
                        className="reg-input"
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                        maxLength="254"
                        title="Vui lòng nhập địa chỉ email hợp lệ (ví dụ: abc@example.com)"
                        required
                    />
                </div>
                <div className="reg-field reg-col-phone">
                    <Label required>Số điện thoại</Label>
                    <input
                        name="phone"
                        className="reg-input"
                        type="tel"
                        placeholder="Số điện thoại"
                        value={formData.phone}
                        onChange={handleChange}
                        pattern="[0-9]{10,11}"
                        title="Vui lòng nhập số điện thoại hợp lệ (10-11 chữ số)"
                        required
                    />
                </div>
            </div>

            <div className="reg-field reg-field-full">
                <Label required={!allowOptOutImage}>
                    Tải ảnh của bản thân {!allowOptOutImage ? '' : '(tùy chọn)'}
                </Label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="reg-input"
                    onChange={(e) => {
                        const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                        setPhotoFile(file);
                    }}
                    required={!allowOptOutImage}
                />
            </div>

            {photoFile && (uploading || uploadProgress > 0) && (
                <div className="reg-field reg-field-full">
                    <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 6 }}>
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
                                background: 'var(--red)',
                                transition: 'width 200ms ease',
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
