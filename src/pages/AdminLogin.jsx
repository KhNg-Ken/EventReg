import { useEffect, useState } from 'react';
import { isSignedIn, loginAndGetToken, logout, msalInstance } from '../auth/index.js';
import PageFrame from '../components/PageFrame/PageFrame.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { exchangeMsalTokenForFirebase, setAdminCustomClaims } from '../utils/firebaseAuthProxy.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AdminLogin');

export default function AdminLogin({ onSignedIn } = {}) {
    const [signedIn, setSignedIn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [accountName, setAccountName] = useState(null);
    const { isAdmin, loading: authLoading } = useAuth();
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
                logger.debug('Checking signed-in accounts:', accounts);
                if (accounts && accounts.length) {
                    logger.debug('Found signed-in account:', accounts[0]);
                    setAccountName(accounts[0].username || accounts[0].name || null);
                }
            } catch {
                // ignore
            }
        })();
    }, []);

    // If auth context shows the staff is already signed in, redirect away from login
    useEffect(() => {
        if (!authLoading && isAdmin) {
            // notify parent and navigate to public events list
            try {
                if (typeof onSignedIn === 'function') onSignedIn(true);
            } catch (e) {
                // ignore notification errors
                console.debug('onSignedIn notify failed', e);
            }
            window.location.hash = '#/events';
        }
    }, [isAdmin, authLoading, onSignedIn]);

    const { showToast } = useToast();

    async function handleSignIn() {
        try {
            setLoading(true);
            const msalToken = await loginAndGetToken();
            setSignedIn(isSignedIn());

            // Get account email from MSAL
            let accountEmail = null;
            try {
                const accounts = msalInstance?.getAllAccounts
                    ? msalInstance.getAllAccounts()
                    : null;
                if (accounts && accounts.length) {
                    accountEmail = accounts[0].username || accounts[0].email || null;
                    setAccountName(accounts[0].username || accounts[0].name || null);
                }
            } catch {
                /* ignore */
            }

            if (!accountEmail) {
                throw new Error('Could not retrieve email from MSAL login');
            }

            // Exchange MSAL token for Firebase custom token and sign in
            logger.log('Exchanging MSAL token for Firebase token...');
            try {
                await exchangeMsalTokenForFirebase(msalToken, accountEmail);
                logger.log('Successfully signed in to Firebase');
            } catch (firebaseErr) {
                logger.warn('Failed to exchange token for Firebase:', firebaseErr);
                showToast(
                    'Cảnh báo: Không thể kết nối Firebase. Một số tính năng có thể không khả dụng.',
                    {
                        type: 'warning',
                    }
                );
                // Don't fail the whole login - MSAL succeeded, Firebase sync is secondary
            }

            // Set admin custom claims
            try {
                logger.log('Setting admin custom claims for:', accountEmail);
                await setAdminCustomClaims(accountEmail);
                logger.log('Admin claims set successfully');
            } catch (claimsErr) {
                logger.warn('Failed to set admin claims:', claimsErr);
                showToast(
                    'Cảnh báo: Không thể thiết lập quyền quản trị viên. Vui lòng liên hệ quản lý.',
                    {
                        type: 'warning',
                    }
                );
            }

            if (typeof onSignedIn === 'function') onSignedIn();
            return msalToken;
        } catch (err) {
            logger.error('Login failed', err);
            showToast('Đăng nhập thất bại. Vui lòng thử lại.', { type: 'error' });
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
            if (typeof onSignedIn === 'function') onSignedIn(false);
        } catch (err) {
            logger.warn('Logout failed', err);
        } finally {
            setLoading(false);
        }
    }

    // While auth is initializing, show a compact loading state to avoid UI flicker
    if (authLoading) {
        return (
            <PageFrame
                title="Quản trị viên / Đăng nhập"
                subtitle="Đang kiểm tra trạng thái đăng nhập…"
                minHeight={360}
            >
                <div style={{ marginTop: 24, textAlign: 'center' }}>
                    <span className="spinner" aria-hidden="true" />
                    <div style={{ marginTop: 12, color: 'var(--tds-gray)' }}>
                        Đang kiểm tra xác thực…
                    </div>
                </div>
            </PageFrame>
        );
    }

    return (
        <PageFrame
            title="Quản trị viên / Đăng nhập"
            subtitle="Đăng nhập bằng Microsoft để quản lý sự kiện"
            minHeight={360}
        >
            <div style={{ marginTop: 12 }}>
                {signedIn ? (
                    <div>
                        <div style={{ marginBottom: 8, fontSize: 14 }}>
                            Đã đăng nhập dưới tên: <strong>{accountName || 'Người dùng'}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                className="ui-btn btn-primary"
                                onClick={() =>
                                    typeof onSignedIn === 'function' ? onSignedIn() : null
                                }
                            >
                                Tiếp tục
                            </button>
                            <button
                                className="ui-btn btn-secondary"
                                onClick={handleSignOut}
                                disabled={loading}
                            >
                                Đăng xuất
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div style={{ marginBottom: 12, color: 'var(--gray)' }}>
                            Đăng nhập bằng tài khoản Microsoft để truy cập trang quản lý sự kiện.
                        </div>
                        <button
                            className="ui-btn btn-primary"
                            onClick={handleSignIn}
                            disabled={loading}
                        >
                            {loading ? 'Đang đăng nhập...' : 'Đăng nhập bằng Microsoft'}
                        </button>
                    </div>
                )}
            </div>
        </PageFrame>
    );
}
