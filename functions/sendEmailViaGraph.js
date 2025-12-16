import dotenv from 'dotenv';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define Firebase secrets and environment variables
const azureClientSecret = defineSecret('AZURE_CLIENT_SECRET');
const msalRefreshToken = defineSecret('MSAL_REFRESH_TOKEN');
const azureEmail = defineString('AZURE_ADMIN_EMAIL', { default: 'example@tds.com' });
const azureClientId = defineString('AZURE_CLIENT_ID');
const azureTenantId = defineString('AZURE_TENANT_ID');

/**
 * Cloud Function to send email via Microsoft Graph API using stored refresh token.
 *
 * Expected payload:
 * - to: string (recipient email)
 * - templateName: string (e.g., 'registration-invite')
 * - templateData: object (variables to replace in template: eventName, qrCodeUrl, etc.)
 */
export const sendEmailViaGraph = onCall(
    { secrets: [azureClientSecret, msalRefreshToken] },
    async (req) => {
        const data = req.data || {};

        const to = data.to?.trim()?.toLowerCase();
        const templateName = data.templateName?.trim() || 'ai_application_event';
        const templateData = data.templateData || {};

        if (!to) {
            throw new HttpsError('invalid-argument', 'Missing recipient email (to)');
        }

        // Ensure sender mailbox is configured (default placeholder will fail)
        const adminEmail = azureEmail.value();
        if (!adminEmail || adminEmail === 'example@tds.com') {
            throw new HttpsError(
                'failed-precondition',
                'Azure admin email not configured. Set AZURE_ADMIN_EMAIL secret/param.'
            );
        }

        try {
            // Get refresh token from Firebase Secrets (environment variable)
            const refreshToken = msalRefreshToken.value();

            if (!refreshToken) {
                throw new HttpsError(
                    'failed-precondition',
                    'MSAL_REFRESH_TOKEN secret not configured. Run: firebase functions:secrets:set MSAL_REFRESH_TOKEN'
                );
            }

            // Exchange refresh token for access token via Microsoft Graph OAuth
            const clientId = azureClientId.value();
            const tenantId = azureTenantId.value();
            const clientSecret = azureClientSecret.value();
            const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

            if (!clientSecret) {
                throw new HttpsError('failed-precondition', 'Azure client secret not configured');
            }

            const tokenParams = new URLSearchParams({
                client_id: clientId,
                scope: 'https://graph.microsoft.com/Mail.Send offline_access',
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
                client_secret: clientSecret,
            });

            const tokenResponse = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: tokenParams.toString(),
            });

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                console.error('Token exchange failed:', errorText);
                throw new HttpsError(
                    'internal',
                    'Failed to exchange refresh token for access token'
                );
            }

            const tokenJson = await tokenResponse.json();
            const accessToken = tokenJson.access_token;

            if (!accessToken) {
                throw new HttpsError('internal', 'Access token not returned from Microsoft');
            }

            // Load email template from functions/templates/ folder
            const templatePath = join(__dirname, 'templates', `${templateName}.html`);
            let htmlContent;
            try {
                htmlContent = await readFile(templatePath, 'utf-8');
            } catch (readErr) {
                console.error('Template load failed:', { templatePath, readErr });
                throw new HttpsError('not-found', `Email template not found: ${templateName}.html`);
            }

            // Replace template variables (simple string replacement)
            Object.keys(templateData).forEach((key) => {
                const placeholder = new RegExp(`{{${key}}}`, 'g');
                htmlContent = htmlContent.replace(placeholder, templateData[key] || '');
            });

            // Send email via Microsoft Graph API
            const graphEndpoint = `https://graph.microsoft.com/v1.0/users/${adminEmail}/sendMail`;
            const emailPayload = {
                message: {
                    subject: templateData.subject || 'Mã mời tham dự sự kiện Giải Pháp CNTT Khối Sản Xuất cùng TDSouth',
                    body: {
                        contentType: 'HTML',
                        content: htmlContent,
                    },
                    toRecipients: [
                        {
                            emailAddress: {
                                address: to,
                            },
                        },
                    ],
                },
                saveToSentItems: true,
            };

            const graphResponse = await fetch(graphEndpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(emailPayload),
            });

            if (!graphResponse.ok) {
                const errorText = await graphResponse.text();
                console.error('Graph API send failed:', {
                    status: graphResponse.status,
                    statusText: graphResponse.statusText,
                    body: errorText,
                });
                throw new HttpsError('internal', 'Failed to send email via Graph API');
            }

            console.log(`Email sent successfully to: ${to}`);
            return { success: true, message: 'Email sent successfully' };
        } catch (err) {
            console.error('sendEmailViaGraph failed:', err);
            if (err instanceof HttpsError) throw err;
            throw new HttpsError('internal', 'Failed to send email: ' + err.message);
        }
    }
);
