import { useEffect, useState } from 'react';
import { logout, msalInstance } from './auth/index.js';
import AdminNavBar from './components/AdminNavBar.js/AdminNavBar.jsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import CheckInStatistics from './pages/CheckInStatistics.jsx';
import CreateEvent from './pages/CreateEvent/CreateEvent.jsx';
import EventList from './pages/EventList/EventList.jsx';
import LivePoster from './pages/LivePoster/LivePoster.jsx';
import PosterDesign from './pages/PosterDesign/PosterDesign.jsx';
import RegisterForm from './pages/RegisterForm/RegisterForm.jsx';
import RegistrantList from './pages/RegistrantList/RegistrantList.jsx';
import UpdateEvent from './pages/UpdateEvent/UpdateEvent.jsx';
import WorkInProgress from './pages/WorkInProgress.jsx';
import './styles/App.css';
import './styles/common.css';
import { createLogger } from './utils/logger.js';

const logger = createLogger('App');

// Toggle this to switch between WorkInProgress and full app
const SHOW_WIP = import.meta.env.VITE_WIP_MODE === 'true';

function parseHash() {
    const raw = window.location.hash || '#/events';
    const noHash = raw.startsWith('#') ? raw.slice(1) : raw;
    const [path, q] = noHash.split('?');
    const page = (path || '/empty').replace(/\//g, '') || 'empty';
    const params = {};
    if (q) {
        try {
            const sp = new URLSearchParams(q);
            for (const [k, v] of sp.entries()) params[k] = v;
        } catch {
            // ignore
        }
    }
    return { page, params };
}

function navigateTo(hashPath) {
    // ensure a leading #/
    if (!hashPath.startsWith('#'))
        hashPath = '#' + (hashPath.startsWith('/') ? hashPath : '/' + hashPath);
    // don't force a history entry if already there
    if (window.location.hash !== hashPath) window.location.hash = hashPath;
}

function App() {
    // App wraps the inner content with AuthProvider so that inner content can
    // consume auth state using the `useAuth()` hook.
    return (
        <ToastProvider>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </ToastProvider>
    );
}

function AppContent() {
    const [{ page, params }, setRoute] = useState(() => parseHash());
    const { isAdmin, setSignedIn } = useAuth();
    const [selectedEvent, setSelectedEvent] = useState(params.event || null);
    const [accountName, setAccountName] = useState(null);

    useEffect(() => {
        function onHash() {
            const h = parseHash();
            setRoute(h);
            setSelectedEvent(h.params.event || null);
        }
        window.addEventListener('hashchange', onHash);
        // sync initial: if there's no hash, route to the public events list
        if (!window.location.hash || window.location.hash === '#') {
            navigateTo('/');
        }
        onHash();
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    // Update account name when admin state changes
    useEffect(() => {
        try {
            const accounts = msalInstance?.getAllAccounts ? msalInstance.getAllAccounts() : [];
            if (accounts && accounts.length)
                setAccountName(accounts[0].username || accounts[0].name || null);
            else setAccountName(null);
        } catch {
            setAccountName(null);
        }
    }, [isAdmin]);

    // Route-level redirects are now handled by ProtectedRoute so we don't
    // perform ad-hoc navigation here. ProtectedRoute will wait for auth to
    // finish loading before redirecting to login.

    function handleSignedIn(signed = true) {
        setSignedIn(!!signed);
        navigateTo('/events');
    }

    // Apply admin theme site-wide when signed in as admin
    useEffect(() => {
        try {
            if (isAdmin) {
                document.documentElement.classList.add('admin-theme');
                document.documentElement.classList.add('has-admin-nav');
            } else {
                document.documentElement.classList.remove('admin-theme');
                document.documentElement.classList.remove('has-admin-nav');
            }
        } catch {
            // ignore DOM exceptions in SSR or testing
        }
        return () => {
            try {
                document.documentElement.classList.remove('admin-theme');
                document.documentElement.classList.remove('has-admin-nav');
            } catch {
                // ignore
            }
        };
    }, [isAdmin]);

    async function handleLogout() {
        try {
            // attempt to sign out; don't block the UI if logout takes time
            await logout();
        } catch (err) {
            logger.warn('Logout encountered an error', err);
        }

        // update UI state immediately and navigate to public events
        try {
            setSignedIn(false);
        } catch (e) {
            logger.debug('Failed to setSignedIn during logout cleanup', e);
            try {
                localStorage.removeItem('signed_in');
            } catch (e2) {
                logger.debug('Failed to remove session hint during logout', e2);
            }
        }
        navigateTo('/events');
    }

    return (
        <main className={`app-content`}>
            {isAdmin && (
                <AdminNavBar
                    accountName={accountName}
                    handleLogout={handleLogout}
                    navigateTo={navigateTo}
                />
            )}

            <div className={`page-wrapper ${isAdmin ? 'has-admin-nav' : ''}`}>
                {SHOW_WIP ? (
                    <WorkInProgress />
                ) : (
                    <>
                        {page === 'login' && <AdminLogin onSignedIn={handleSignedIn} />}
                        {page === 'events' && (
                            <EventList
                                onSelectEvent={(ev) => {
                                    // navigate with event in hash so RegisterForm can read it from URL
                                    navigateTo(`/register?event=${encodeURIComponent(ev.id)}`);
                                }}
                            />
                        )}
                        {page === 'register' && <RegisterForm event={selectedEvent} />}
                        {page === 'create' && (
                            <ProtectedRoute adminOnly loadingFallback={null}>
                                <CreateEvent />
                            </ProtectedRoute>
                        )}

                        {page === 'update' && (
                            <ProtectedRoute adminOnly loadingFallback={null}>
                                <UpdateEvent event={selectedEvent} />
                            </ProtectedRoute>
                        )}

                        {page === 'liveposter' && <LivePoster />}

                        {page === 'posterdesign' && (
                            <ProtectedRoute adminOnly loadingFallback={null}>
                                <PosterDesign />
                            </ProtectedRoute>
                        )}

                        {page === 'checkin-statistics' && (
                            <ProtectedRoute adminOnly loadingFallback={null}>
                                <CheckInStatistics event={selectedEvent} />
                            </ProtectedRoute>
                        )}

                        {page === 'registrants' && (
                            <ProtectedRoute adminOnly loadingFallback={null}>
                                <RegistrantList />
                            </ProtectedRoute>
                        )}

                        {/* Default fallback for all other routes */}
                        {![
                            'login',
                            'events',
                            'register',
                            'create',
                            'update',
                            'liveposter',
                            'posterdesign',
                            'checkin-statistics',
                            'registrants',
                        ].includes(page) && <div className="empty-page">Page not found.</div>}
                    </>
                )}
            </div>
        </main>
    );
}

export default App;
