import React, { useState, useEffect } from 'react';
import { loginAndGetToken, isSignedIn, logout, msalInstance } from '../auth/index.js';
import '../styles/DemoForm.css';
import tdsLogo from '../assets/tds_logo.png';

export default function AdminLogin({ onSignedIn } = {}) {
    const [signedIn, setSignedIn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [accountName, setAccountName] = useState(null);

    useEffect(() => {
        // async init so we can await msal initialize before calling instance APIs
        (async () => {
            setSignedIn(isSignedIn());
            try {
                await msalInstance.initialize();
            } catch {
                // ignore initialization errors here; getAllAccounts may still throw
            }

            try {
                const accounts = msalInstance?.getAllAccounts
                    ? msalInstance.getAllAccounts()
                    : null;
                console.log('Checking signed-in accounts:', accounts);
                if (accounts && accounts.length) {
                    console.log('Found signed-in account:', accounts[0]);
                    setAccountName(accounts[0].username || accounts[0].name || null);
                }
            } catch {
                // ignore
            }
        })();
    }, []);

    async function handleSignIn() {
        try {
            setLoading(true);
            const token = await loginAndGetToken();
            setSignedIn(isSignedIn());
            // try to read account name from msal instance if available
            try {
                const accounts = msalInstance?.getAllAccounts
                    ? msalInstance.getAllAccounts()
                    : null;
                if (accounts && accounts.length)
                    setAccountName(accounts[0].username || accounts[0].name || null);
            } catch {
                /* ignore */
            }
            if (typeof onSignedIn === 'function') onSignedIn();
            return token;
        } catch (err) {
            console.error('Login failed', err);
            alert('Đăng nhập thất bại. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSignOut() {
        try {
            setLoading(true);
            await logout();
            setSignedIn(false);
            setAccountName(null);
        } catch (err) {
            console.warn('Logout failed', err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="tds-form-wrap">
            <div className="tds-card" style={{ maxWidth: 720 }}>
                <div className="tds-header">
                    <div className="tds-logo">
                        <img src={tdsLogo} alt="TDSouth" />
                    </div>
                    <div>
                        <div className="tds-title">Quản trị viên / Đăng nhập</div>
                        <div className="tds-subtitle">
                            Đăng nhập bằng Microsoft để quản lý sự kiện
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 12 }}>
                    {signedIn ? (
                        <div>
                            <div style={{ marginBottom: 8, fontSize: 14 }}>
                                Đã đăng nhập dưới tên:{' '}
                                <strong>{accountName || 'Người dùng'}</strong>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    className="tds-btn tds-btn-primary"
                                    onClick={() =>
                                        typeof onSignedIn === 'function' ? onSignedIn() : null
                                    }
                                >
                                    Tiếp tục
                                </button>
                                <button
                                    className="tds-btn tds-btn-secondary"
                                    onClick={handleSignOut}
                                    disabled={loading}
                                >
                                    Đăng xuất
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ marginBottom: 12, color: 'var(--tds-gray)' }}>
                                Bạn có thể đăng nhập để quản lý sự kiện, hoặc tiếp tục xem sự kiện
                                nếu không muốn đăng nhập.
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    className="tds-btn tds-btn-primary"
                                    onClick={handleSignIn}
                                    disabled={loading}
                                >
                                    {loading ? 'Đang đăng nhập...' : 'Đăng nhập bằng Microsoft'}
                                </button>
                                <button
                                    className="tds-btn tds-btn-secondary"
                                    onClick={() =>
                                        typeof onSignedIn === 'function' ? onSignedIn(false) : null
                                    }
                                >
                                    Tiếp tục không đăng nhập
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
