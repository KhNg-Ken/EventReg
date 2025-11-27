import React, { useEffect, useState } from 'react';
import AdminLogin from './pages/AdminLogin.jsx';
import RegisterForm from './pages/RegisterForm/RegisterForm.jsx';
import CreateForm from './pages/CreateForm.jsx';
import EventList from './pages/EventList.jsx';
import { isSignedIn } from './auth/index.js';

function parseHash() {
    const raw = window.location.hash || '#/events';
    const noHash = raw.startsWith('#') ? raw.slice(1) : raw;
    const [path, q] = noHash.split('?');
    const page = (path || '/login').replace(/\//g, '') || 'login';
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
    const [{ page, params }, setRoute] = useState(() => parseHash());
    const [isAdmin, setIsAdmin] = useState(isSignedIn());
    const [selectedEvent, setSelectedEvent] = useState(params.event || null);

    useEffect(() => {
        function onHash() {
            const h = parseHash();
            setRoute(h);
            setSelectedEvent(h.params.event || null);
        }
        window.addEventListener('hashchange', onHash);
        // sync initial: if there's no hash, route to the public events list
        if (!window.location.hash || window.location.hash === '#') {
            navigateTo('/events');
        }
        onHash();
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    function handleSignedIn(signed = true) {
        setIsAdmin(!!signed);
        navigateTo('/events');
    }

    return (
        <div>
            <div style={{ padding: 20 }}>
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
                {page === 'create' && isAdmin && <CreateForm />}
                {page === 'create' && !isAdmin && (
                    <div style={{ padding: 16 }}>
                        <strong>Admin access required</strong>
                        <p>Vui lòng đăng nhập với tài khoản quản trị để tạo sự kiện.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
