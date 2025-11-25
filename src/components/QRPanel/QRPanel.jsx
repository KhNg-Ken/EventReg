import React from 'react';
import './QRPanel.css';

export default function QRPanel({ inviteId, qrSrc }) {
    return (
        <div className="tds-qr-panel">
            {!inviteId ? (
                <div className="tds-qr-placeholder" aria-hidden>
                    <div className="tds-qr-empty">
                        <div className="tds-qr-empty-icon">🔳</div>
                        <div className="tds-qr-empty-text">
                            Mã QR sẽ xuất hiện ở đây khi hoàn tất đăng ký
                        </div>
                    </div>
                </div>
            ) : (
                <div className={`tds-invite ${qrSrc ? 'tds-qr-success' : ''}`}>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent:  "center",
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
                                            justifyContent: 'center',
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
                    <div className="tds-success-note">
                        Đăng ký thành công <br/> Vui lòng lưu mã mời này!
                    </div>
                </div>
            )}
        </div>
    );
}
