import React, { useState } from 'react';
import { createEventWorkbook } from '../api/graphApi.js';
import PageFrame from '../components/PageFrame.jsx';

function CreateForm() {
    const [eventName, setEventName] = useState('');
    const [requireImage, setRequireImage] = useState(false);
    const [creating, setCreating] = useState(false);
    const [result, setResult] = useState(null);

    const handleCreate = async () => {
        if (!eventName.trim()) {
            alert('Vui lòng nhập tên sự kiện');
            return;
        }
        try {
            setCreating(true);
            setResult(null);
            const res = await createEventWorkbook(eventName.trim(), {
                imageRequired: requireImage,
            });
            setResult({ success: true, ...res, requireImage });
            alert('Đã tạo form sự kiện: ' + res.fileName);
            // prepare shareable URL
            try {
                const url = new URL(window.location.href);
                url.search = `eventId=${res.fileId}`;
                setResult({ success: true, ...res, requireImage, shareUrl: url.toString() });
            } catch {
                // ignore
            }
        } catch (err) {
            console.error('Create event failed', err);
            alert('Không thể tạo file sự kiện. Kiểm tra quyền và thử lại.');
            setResult({ success: false, error: err });
        } finally {
            setCreating(false);
        }
    };

    return (
        <PageFrame
            title="Create Event Form"
            subtitle="Quản trị: tạo mẫu đăng ký sự kiện"
            showBack
            onBack={() => (window.location.hash = '#/events')}
            minHeight={360}
        >
            <div className="tds-form">
                <div className="tds-field">
                    <label className="tds-subtitle">Tên sự kiện</label>
                    <input
                        className="tds-input"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        placeholder="Tên sự kiện"
                    />
                </div>

                <div className="tds-field">
                    <label className="tds-subtitle">Tùy chọn ảnh</label>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                                type="radio"
                                name="imgopt"
                                checked={!requireImage}
                                onChange={() => setRequireImage(false)}
                            />{' '}
                            Không bắt buộc
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                                type="radio"
                                name="imgopt"
                                checked={requireImage}
                                onChange={() => setRequireImage(true)}
                            />{' '}
                            Bắt buộc
                        </label>
                    </div>
                </div>

                <div className="tds-field tds-actions">
                    <button
                        className="tds-btn tds-btn-primary"
                        onClick={handleCreate}
                        disabled={creating}
                    >
                        Tạo form
                    </button>
                </div>
            </div>

            {result && result.success && (
                <div style={{ marginTop: 12 }}>
                    <div>
                        Đã tạo: <strong>{result.fileName}</strong>
                    </div>
                    <div>File ID: {result.fileId}</div>
                    <div>Table: {result.tableName}</div>
                    <div>Image uploads: {result.requireImage ? 'Bắt buộc' : 'Tùy chọn'}</div>
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
                                    className="tds-btn tds-btn-secondary"
                                    onClick={() => {
                                        navigator.clipboard.writeText(result.shareUrl);
                                    }}
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {result && result.success === false && (
                <div style={{ marginTop: 12, color: 'var(--tds-red)' }}>
                    Lỗi: {String(result.error)}
                </div>
            )}
        </PageFrame>
    );
}

export default CreateForm;
