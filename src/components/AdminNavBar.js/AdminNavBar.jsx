import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import './AdminNavBar.css';

export default function AdminNavBar({ accountName, handleLogout, navigateTo }) {
    const { isAdmin } = useAuth();
    const [hash, setHash] = useState(
        typeof window !== 'undefined' ? window.location.hash : '#/events'
    );

    useEffect(() => {
        function onHash() {
            setHash(window.location.hash || '#/events');
        }
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    const makeHash = (path) =>
        path.startsWith('#') ? path : '#' + (path.startsWith('/') ? path : '/' + path);
    const isActive = (path) => makeHash(path) === (hash || '#/events');

    return (
        <div className={`admin-nav ${isAdmin ? 'admin-nav-visible' : 'admin-nav-hidden'}`}>
            <div className="admin-nav-left">
                <button
                    className={`admin-nav-btn admin-nav-btn-primary ${
                        isActive('/events') ? 'active' : ''
                    }`}
                    onClick={() => navigateTo('/events')}
                >
                    Events
                </button>
                {isAdmin ? (
                    <>
                        <button
                            className={`admin-nav-btn admin-nav-btn-primary ${
                                isActive('/create') ? 'active' : ''
                            }`}
                            onClick={() => navigateTo('/create')}
                        >
                            Create Event
                        </button>
                        <button
                            className={`admin-nav-btn admin-nav-btn-primary ${
                                isActive('/posterdesign') ? 'active' : ''
                            }`}
                            onClick={() => navigateTo('/posterdesign')}
                        >
                            🎨 Design
                        </button>
                    </>
                ) : null}
            </div>

            <div className="admin-nav-right">
                {isAdmin && accountName ? (
                    <div className="admin-nav-account">
                        Signed in as <strong>{accountName}</strong>
                    </div>
                ) : null}

                {isAdmin ? (
                    <button className="admin-nav-btn admin-nav-logout" onClick={handleLogout}>
                        Logout
                    </button>
                ) : (
                    <button className="admin-nav-btn" onClick={() => navigateTo('/login')}>
                        Admin Login
                    </button>
                )}
            </div>
        </div>
    );
}
