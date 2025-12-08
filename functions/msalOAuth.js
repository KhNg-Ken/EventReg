import dotenv from 'dotenv';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { Buffer } from 'node:buffer';
import { createHash, randomBytes } from 'node:crypto';

dotenv.config({ path: '.env' });

// Define Firebase Function params/secrets
const azureClientSecret = defineSecret('AZURE_CLIENT_SECRET');
const azureEmail = defineString('AZURE_ADMIN_EMAIL', { default: 'example@tds.com' });
const azureClientId = defineString('AZURE_CLIENT_ID');
const azureTenantId = defineString('AZURE_TENANT_ID');
const azureRedirectUri = defineString('AZURE_REDIRECT_URI');
const azureMainSite = defineString('AZURE_MAIN_SITE');

/**
 * OAuth callback endpoint for MSAL server-side flow.
 * This function receives the authorization code and exchanges it for tokens,
 * including the refresh token which is then stored in Firestore.
 *
 * Flow:
 * 1. Admin clicks login button → redirects to Azure AD
 * 2. Azure AD redirects back to this endpoint with authorization code
 * 3. This function exchanges code for tokens (including refresh token)
 * 4. Stores refresh token in Firestore
 * 5. Redirects user back to app
 */
export const msalCallback = onRequest({ secrets: [azureClientSecret] }, async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;
    const errorDescription = req.query.error_description;
    const state = req.query.state;

    // Handle OAuth errors
    if (error) {
        console.error('OAuth error:', error, errorDescription);
        res.status(400).send(`OAuth Error: ${error}<br>${errorDescription}`);
        return;
    }

    if (!code) {
        res.status(400).send('Missing authorization code');
        return;
    }

    try {
        const clientId = azureClientId.value();
        const tenantId = azureTenantId.value();
        const clientSecret = azureClientSecret.value();

        // Extract PKCE code_verifier from state parameter
        // State format: "verifier|returnUrl"
        let codeVerifier = null;

        if (state) {
            const parts = state.split('|');
            if (parts.length === 2) {
                codeVerifier = parts[0];
            }
        }

        if (!codeVerifier) {
            res.status(400).send('Missing PKCE code verifier. Please restart the login process.');
            return;
        }

        // Determine redirect URI based on environment
        const redirectUri =
            req.query.redirect_uri || azureRedirectUri.value();

        // Exchange authorization code for tokens with PKCE
        const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const tokenParams = new URLSearchParams({
            client_id: clientId,
            scope: 'https://graph.microsoft.com/Mail.Send offline_access openid profile email',
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            client_secret: clientSecret,
            code_verifier: codeVerifier,
        });

        const tokenResponse = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString(),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Token exchange failed:', errorText);
            res.status(500).send(`Failed to exchange authorization code for tokens: ${errorText}`);
            return;
        }

        const tokenData = await tokenResponse.json();
        const refreshToken = tokenData.refresh_token;
        const idToken = tokenData.id_token;

        if (!refreshToken) {
            res.status(500).send('No refresh token returned from Microsoft');
            return;
        }

        // Decode ID token to get user email (simple base64 decode, no verification needed here)
        const idTokenPayload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
        const email =
            idTokenPayload.preferred_username || idTokenPayload.email || idTokenPayload.upn;

        if (!email) {
            res.status(500).send('Could not extract email from ID token');
            return;
        }

        // Only store token for authorized admin email
        const authorizedEmail = azureEmail.value();
        if (email.toLowerCase() !== authorizedEmail.toLowerCase()) {
            res.status(403).send('Unauthorized user');
            return;
        }

        // Display refresh token for manual Firebase secret configuration
        const AZURE_TENANT_ID = azureTenantId.value() || 'unknown';
        const AZURE_CLIENT_ID = azureClientId.value() || 'unknown';

        const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>MSAL Refresh Token</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #0078d4;
            margin-bottom: 10px;
        }
        .success {
            color: #107c10;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .warning {
            background: #fff4ce;
            border-left: 4px solid #ffb900;
            padding: 15px;
            margin: 20px 0;
        }
        .instructions {
            background: #f3f2f1;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .code {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            overflow-x: auto;
            margin: 10px 0;
        }
        textarea {
            width: 100%;
            height: 100px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            resize: vertical;
        }
        button {
            background: #0078d4;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
        }
        button:hover {
            background: #005a9e;
        }
        .info {
            margin-top: 20px;
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ MSAL Authentication Successful</h1>
        <p class="success">Authenticated as: ${email}</p>
        
        <div class="warning">
            <strong>⚠️ Security Notice:</strong> This refresh token grants access to send emails from ${email}. 
            Keep it secure and never share it publicly.
        </div>

        <div class="instructions">
            <h3>📋 Setup Instructions</h3>
            <ol>
                <li>Copy the refresh token below (click "Copy Token" button)</li>
                <li>Open your terminal in the Firebase project directory</li>
                <li>Run the following command to store it as a Firebase secret:</li>
            </ol>
            <div class="code">firebase functions:secrets:set MSAL_REFRESH_TOKEN</div>
            <p style="margin-top: 10px;"><small>You'll be prompted to paste the token. After setting, deploy your functions:</small></p>
            <div class="code">firebase deploy --only functions</div>
        </div>

        <h3>🔑 Refresh Token</h3>
        <textarea id="tokenTextarea" readonly>${refreshToken}</textarea>
        <button onclick="copyToken()">📋 Copy Token</button>
        
        <div class="info">
            <p><strong>Token Details:</strong></p>
            <ul>
                <li>Email: ${email}</li>
                <li>Tenant ID: ${AZURE_TENANT_ID}</li>
                <li>Client ID: ${AZURE_CLIENT_ID}</li>
                <li>Generated: ${new Date().toISOString()}</li>
            </ul>
        </div>
    </div>

    <script>
        function copyToken() {
            const textarea = document.getElementById('tokenTextarea');
            textarea.select();
            document.execCommand('copy');
            alert('✅ Refresh token copied to clipboard!');
        }
    </script>
</body>
</html>
        `;

        res.status(200).send(htmlResponse);
    } catch (err) {
        console.error('OAuth callback error:', err);
        res.status(500).send('Internal server error during OAuth callback');
    }
});

/**
 * Helper endpoint to initiate OAuth flow.
 * Redirects user to Azure AD login page.
 */
export const msalLogin = onRequest(async (req, res) => {
    const clientId = azureClientId.value();
    const tenantId = azureTenantId.value();

    // Redirect URI for OAuth callback
    const redirectUri = azureRedirectUri.value();

    // Generate PKCE code_verifier and code_challenge
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    // Embed code_verifier in state parameter (format: "verifier|returnUrl")
    const returnUrl = req.query.returnUrl || azureMainSite.value();
    const state = `${codeVerifier}|${returnUrl}`;

    const authUrl =
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_mode=query` +
        `&scope=${encodeURIComponent(
            'https://graph.microsoft.com/Mail.Send offline_access openid profile email'
        )}` +
        `&state=${encodeURIComponent(state)}` +
        `&code_challenge=${codeChallenge}` +
        `&code_challenge_method=S256`;

    res.redirect(authUrl);
});
