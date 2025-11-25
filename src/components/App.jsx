import React, { useEffect, useState } from 'react';
import AdminLogin from './AdminLogin.jsx';
import DemoForm from './DemoForm.jsx';
import CreateForm from './CreateForm.jsx';
import EventList from './EventList.jsx';
import { isSignedIn } from '../auth/index.js';

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
    const [selectedEventId, setSelectedEventId] = useState(params.eventId || null);

    useEffect(() => {
        function onHash() {
            const h = parseHash();
            setRoute(h);
            setSelectedEventId(h.params.eventId || null);
        }
        window.addEventListener('hashchange', onHash);
        // sync initial
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
                            // navigate with eventId in hash so DemoForm can read it from URL
                            navigateTo(`/demo?eventId=${encodeURIComponent(ev.id)}`);
                        }}
                    />
                )}
                {page === 'demo' && <DemoForm eventId={selectedEventId} />}
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
