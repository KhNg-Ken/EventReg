/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { ensureMsalInitialized, isSignedIn } from '../auth/index.js';

const AuthContext = createContext({
    isAdmin: false,
    loading: true,
    setSignedIn: () => {},
});

export function AuthProvider({ children }) {
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        let mounted = true;
        // initialize msal and derive signed-in state
        (async () => {
            try {
                await ensureMsalInitialized();
            } catch {
                // ignore init failures; isSignedIn will handle them
            }
            if (!mounted) return;
            try {
                setIsAdmin(isSignedIn());
            } catch {
                setIsAdmin(false);
            }
            setLoading(false);
        })();

        // listen for storage changes (other tabs) to update auth hint
        function onStorage(e) {
            if (e.key === 'tds_signed_in') {
                try {
                    setIsAdmin(isSignedIn());
                } catch {
                    setIsAdmin(false);
                }
            }
        }
        window.addEventListener('storage', onStorage);

        return () => {
            mounted = false;
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    function setSignedIn(signed = false) {
        setIsAdmin(!!signed);
        try {
            if (signed) localStorage.setItem('signed_in', '1');
            else localStorage.removeItem('signed_in');
        } catch {
            // ignore localStorage failures
        }
    }

    return (
        <AuthContext.Provider value={{ isAdmin, loading, setSignedIn }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

export default AuthContext;
