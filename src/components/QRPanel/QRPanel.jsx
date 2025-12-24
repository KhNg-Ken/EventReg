import { createLogger } from '../../utils/logger';
import './QRPanel.css';

const logger = createLogger('QRPanel');

export default function QRPanel({ inviteId, qrSrc }) {
    return (
        <div className="qr-panel">
            {!inviteId ? (
                <div className="qr-placeholder" aria-hidden>
                    <div className="qr-empty">
                        <div className="qr-empty-icon">🔳</div>
                        <div className="qr-empty-text">
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
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 14, color: 'var(--gray)' }}>Mã mời của bạn</div>
                        </div>
                        <div className="qr">
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
                                            className="ui-btn btn-secondary"
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch(qrSrc);
                                                    const blob = await res.blob();
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `${inviteId || 'invite'}.jpeg`;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    a.remove();
                                                    URL.revokeObjectURL(url);
                                                } catch (err) {
                                                    logger.error('Failed to download QR:', err);
                                                }
                                            }}
                                        >
                                            Tải QR
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="qr-loading">
                                    <div className="spinner" />
                                    <p>Đang tạo mã QR...</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="success-note">
                        Đăng ký thành công <br /> Vui lòng lưu mã mời này!
                    </div>
                </div>
            )}
        </div>
    );
}
