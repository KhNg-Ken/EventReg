const isProd = import.meta.env.VITE_PROJECT_PROD;
const redirectUri =
    isProd == 'true'
        ? import.meta.env.VITE_AZURE_REDIRECT_URI_PROD
        : import.meta.env.VITE_AZURE_REDIRECT_URI;

export const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
        redirectUri: redirectUri,
    },
    cache: {
        // Use localStorage so auth is shared across windows/tabs.
        // The auth state persists until explicitly logged out.
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
    },
};

export const loginRequest = {
    scopes: ['Files.ReadWrite', 'User.Read', 'Mail.Send'],
};
