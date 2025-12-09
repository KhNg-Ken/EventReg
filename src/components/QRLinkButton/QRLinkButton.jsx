import { toDataURL } from 'qrcode';
import { useState } from 'react';
import './QRLinkButton.css';

export default function QRLinkButton({ eventId, onError = null }) {
    const [isGenerating, setIsGenerating] = useState(false);

    const generateAndDownloadQR = async () => {
        try {
            setIsGenerating(true);
            // Generate QR code for the registration form link
            const regLink = `${window.location.origin}${
                window.location.pathname
            }#/register?event=${encodeURIComponent(eventId)}`;
            const dataUrl = await toDataURL(regLink, { width: 800 });

            // Convert data URL to blob and download
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `qr-register-${eventId}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('QR generation failed:', error);
            if (typeof onError === 'function') {
                onError('QR code generation failed');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="qr-link-button-group">
            <button
                className="qr-link-button qr-button"
                onClick={(e) => {
                    e.stopPropagation();
                    generateAndDownloadQR();
                }}
                disabled={isGenerating}
                title="Download QR code"
                type="button"
            >
                {isGenerating ? '⏳' : '📱'} QR Code
            </button>
            <div className="qr-link-divider" />
            <button
                className="qr-link-button link-button"
                onClick={(e) => {
                    e.stopPropagation();
                    // Copy registration link to clipboard
                    const regLink = `${window.location.origin}${
                        window.location.pathname
                    }#/register?event=${encodeURIComponent(eventId)}`;
                    navigator.clipboard.writeText(regLink).catch((err) => {
                        console.error('Copy failed:', err);
                        if (typeof onError === 'function') {
                            onError('Failed to copy link');
                        }
                    });
                }}
                title="Copy registration link"
                type="button"
            >
                📋 Link
            </button>
        </div>
    );
}
