export const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
        redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI, // Vite dev server URL
    },
    cache: {
        // Persist tokens and accounts across page reloads so admin remains signed in until logout
        // Note: localStorage is used intentionally here (vs sessionStorage) to survive refreshes.
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
    },
};

export const loginRequest = {
    scopes: ['Files.ReadWrite', 'User.Read', 'Mail.Send'],
};
