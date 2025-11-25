import axios from 'axios';
import { loginAndGetToken } from '../auth/index.js';

// Adjust these to match your file
const EXCEL_FILE_PATH = 'children/EventRegistration/children'; // path in OneDrive
const TABLE_NAME = 'Table1'; // table in your worksheet

// Helper: get access token via MSAL delegated flow
async function getToken() {
    const token = await loginAndGetToken();
    return token;
}

// deterministic 3-digit event code based on fileId (stable per event file)
function generateEventCode(fileId) {
    if (!fileId) return '000';
    let sum = 0;
    for (let i = 0; i < fileId.length; i++) sum = (sum + fileId.charCodeAt(i)) % 1000;
    return String(sum).padStart(3, '0');
}

// Create an HMAC-SHA256 token using a secret from env (VITE_QR_SECRET)
// Runs in browser environment via Web Crypto. If no secret provided, uses crypto.randomUUID() as fallback.
async function generateHmacToken(message) {
    try {
        const secret = import.meta.env.VITE_QR_SECRET;
        if (!secret) {
            console.warn('VITE_QR_SECRET not set — falling back to random token (less secure)');
            if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
            return Math.random().toString(36).slice(2);
        }

        const enc = new TextEncoder();
        const keyData = enc.encode(secret);
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
        // convert signature ArrayBuffer to base64
        const bytes = new Uint8Array(signature);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    } catch (err) {
        console.warn('Failed to generate HMAC token, falling back to random token:', err);
        if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
        return Math.random().toString(36).slice(2);
    }
}

// Utility: remove diacritics and sanitize a string to alphanumerics
function removeDiacriticsAndSanitize(str) {
    if (!str) return '';
    try {
        // remove diacritics
        const base = str.normalize('NFD').replace(/\p{Diacritic}/gu, '');
        // remove spaces/underscores and keep only alphanumerics
        return base.replace(/[_\s]/g, '').replace(/[^a-zA-Z0-9]/g, '');
    } catch {
        // fallback for environments without Unicode property escapes
        const base = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return base.replace(/[_\s]/g, '').replace(/[^a-zA-Z0-9]/g, '');
    }
}

function getExtFromFile(file, fallback = 'jpg') {
    if (!file) return fallback;
    if (file.name && file.name.includes('.')) return file.name.split('.').pop();
    if (file.type) {
        const map = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg' };
        return map[file.type] || fallback;
    }
    return fallback;
}

// Step 1: Check if file exists
// Check for an Excel file id. Accepts optional fileSelector which can be:
// - a fileId (drive item id)
// - a filename (e.g., 'ToBeD.xlsx') to search for under EventRegistration
// If no selector provided, behaves like previous: lists the EXCEL_FILE_PATH and picks a workbook candidate.
export async function checkFileExists(fileSelector) {
    const token = await getToken();
    try {
        // If a fileSelector is provided and looks like an id (no slashes, longer than 8 chars), try GET by id first
        if (fileSelector && typeof fileSelector === 'string' && !fileSelector.includes('/')) {
            try {
                const urlById = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileSelector)}`;
                const res = await axios.get(urlById, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res?.data?.id) return res.data.id;
            } catch {
                // not found by id, continue to search by name
            }
        }

        // If a filename is provided, list children under EventRegistration and match by name
        if (fileSelector && typeof fileSelector === 'string') {
            try {
                const parentFolderId = await getEventRegistrationFolderId();
                if (parentFolderId) {
                    const childrenUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}/children`;
                    const childrenRes = await axios.get(childrenUrl, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const found = (childrenRes.data.value || []).find(
                        (it) => it.name && it.name.toLowerCase() === fileSelector.toLowerCase()
                    );
                    if (found) return found.id;
                }
            } catch {
                // ignore and fall back
            }
        }

        // Default behavior: list EXCEL_FILE_PATH and pick a workbook candidate
        const url = `https://graph.microsoft.com/v1.0/me/drive/root/${EXCEL_FILE_PATH}:`;
        const response = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = response.data || {};

        // response may be a single item or a collection under `value`
        let candidates = [];
        if (Array.isArray(data.value) && data.value.length) {
            candidates = data.value;
        } else if (data.value && typeof data.value === 'object') {
            candidates = [data.value];
        } else if (data && data.id) {
            candidates = [data];
        }

        if (!candidates.length) {
            console.error('No items returned for path', EXCEL_FILE_PATH, data);
            return null;
        }

        // Prefer an actual Excel workbook (file.mimeType) or a .xlsx/.xls name
        const excelItem =
            candidates.find(
                (it) =>
                    it.file &&
                    it.file.mimeType &&
                    /spreadsheet|excel|openxml/i.test(it.file.mimeType)
            ) ||
            candidates.find((it) => typeof it.name === 'string' && /\.xlsx?$/.test(it.name)) ||
            candidates.find(
                (it) =>
                    typeof it.name === 'string' && /attend|attendees|registration/i.test(it.name)
            ) ||
            candidates[0];

        console.log('File found:', excelItem.name || excelItem.id);
        return excelItem.id;
    } catch (err) {
        console.error('File not found:', err.response?.data || err.message);
        return null;
    }
}

// Step 2: List worksheets and tables
export async function listWorksheetsAndTables(fileId) {
    if (!fileId) return;
    const token = await getToken();
    try {
        // List worksheets
        const sheetsUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`;
        const sheetsRes = await axios.get(sheetsUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        console.log(
            'Worksheets:',
            sheetsRes.data.value.map((s) => s.name)
        );

        // List tables
        const tablesUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables`;
        const tablesRes = await axios.get(tablesUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        console.log(
            'Tables:',
            tablesRes.data.value.map((t) => t.name)
        );

        return { sheets: sheetsRes.data.value, tables: tablesRes.data.value };
    } catch (err) {
        console.error('Error listing sheets or tables:', err.response?.data || err.message);
    }
}

// Step 3: Append row safely and generate Invite_ID + token
// Returns an object { inviteId, token } on success
// Append a row to the Excel table and return invite + row index info
// Returns: { inviteId, token, fileId, rowIndex }
export async function appendRowToExcel(rowData, opts = {}) {
    try {
        const fileId = opts.fileId || (await checkFileExists());
        if (!fileId) return null;

        const tableName = opts.tableName || TABLE_NAME;
        const { tables } = await listWorksheetsAndTables(fileId);
        const tableExists = tables && tables.some((t) => t.name === tableName);
        if (!tableExists) {
            console.error(`Table "${tableName}" not found in workbook ${fileId}!`);
            return null;
        }

        const token = await getToken();

        // Determine next registration id by counting current rows in the table
        const rowsListUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${encodeURIComponent(tableName)}/rows`;
        const rowsRes = await axios.get(rowsListUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const currentRowCount = Array.isArray(rowsRes.data.value) ? rowsRes.data.value.length : 0;
        const registrationNumber = currentRowCount + 1;
        const registrationPadded = String(registrationNumber).padStart(3, '0');

        // Generate event-specific 3-digit code
        const eventCode = generateEventCode(fileId);
        const inviteId = `EVT${eventCode}-${registrationPadded}`;

        // Generate token (HMAC or fallback)
        const inviteToken = await generateHmacToken(inviteId);

        // Append the row; include Invite_ID, token, and Attendance_ID (-1 default) at the end of the values array
        // Attendance_ID is managed by the event during check-in and should default to -1 (absent)
        const addRowUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${encodeURIComponent(tableName)}/rows/add`;
        await axios.post(
            addRowUrl,
            { values: [[...rowData, inviteId, inviteToken, -1]] }, // Marking absent as -1, default value
            { headers: { Authorization: `Bearer ${token}` } }
        );

        // Locate appended row index by searching for inviteId
        const newRowsRes = await axios.get(rowsListUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const rows = Array.isArray(newRowsRes.data.value) ? newRowsRes.data.value : [];
        const foundIndex = rows.findIndex(
            (r) => Array.isArray(r.values) && r.values.flat().includes(inviteId)
        );
        const rowIndex = foundIndex >= 0 ? (rows[foundIndex].index ?? foundIndex) : null;

        console.log(`Appended row for ${inviteId} at index`, rowIndex);
        return { inviteId, token: inviteToken, fileId, rowIndex };
    } catch (err) {
        console.error('Error appending row:', err.response?.data || err.message);
        return null;
    }
}

// Helper: get (or create) the EventRegistration folder id at root:/EventRegistration
async function getEventRegistrationFolderId() {
    try {
        const token = await getToken();
        // Try to get the folder by path
        const url = `https://graph.microsoft.com/v1.0/me/drive/root:/EventRegistration:`;
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        return res.data.id;
    } catch (err) {
        console.warn(
            'EventRegistration folder not found by path, attempting to locate among root children...',
            err
        );
        try {
            const token = await getToken();
            const listUrl = `https://graph.microsoft.com/v1.0/me/drive/root/children`;
            const listRes = await axios.get(listUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const folder = listRes.data.value.find((it) => it.name === 'EventRegistration');
            if (folder) return folder.id;
        } catch (e) {
            console.error(
                'Failed to locate EventRegistration folder:',
                e.response?.data || e.message || e
            );
        }
        return null;
    }
}

// Upload a client photo to OneDrive under EventRegistration/EVT###_ClientPhoto
// file: File object from input, name: registrant full name, company: registrant company
// Upload a client photo to OneDrive under EventRegistration/EVT###_ClientPhoto
// file: File object from input, name: registrant full name, company: registrant company
// opts: { fileId } - optional event workbook fileId to derive event code without extra checks
export async function uploadClientPhoto(file, name, company, opts = {}) {
    try {
        const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
        const parentFolderId = await getEventRegistrationFolderId();
        if (!parentFolderId) {
            throw new Error('EventRegistration folder not found in OneDrive');
        }

        // Get the event workbook id to derive event code (use provided fileId if available)
        const fileId = opts.fileId || (await checkFileExists());
        const eventCode = generateEventCode(fileId);
        const folderName = `EVT${eventCode}_ClientPhotos`;

        const token = await getToken();

        // Check if folder exists under EventRegistration
        const childrenUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}/children`;
        const childrenRes = await axios.get(childrenUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        let targetFolder = childrenRes.data.value.find((it) => it.name === folderName && it.folder);

        let folderCreatedId = null;
        if (!targetFolder) {
            // Create folder
            const createUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}/children`;
            const createRes = await axios.post(
                createUrl,
                { name: folderName, folder: {} },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            targetFolder = createRes.data;
            folderCreatedId = targetFolder.id;
        }

        const cleanName = removeDiacriticsAndSanitize(name);
        const cleanCompany = removeDiacriticsAndSanitize(company);
        const ext = getExtFromFile(file, 'jpg');
        const fileName = `${cleanName}_${cleanCompany}.${ext}`;

        // Upload: use simple PUT for small files (< ~4MB), otherwise use an upload session
        const FOUR_MB = 4 * 1024 * 1024;
        if (file.size && file.size > FOUR_MB) {
            // Create an upload session
            const sessionUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${targetFolder.id}:/${encodeURIComponent(fileName)}:/createUploadSession`;
            const sessionRes = await axios.post(
                sessionUrl,
                { item: { '@microsoft.graph.conflictBehavior': 'replace', name: fileName } },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const uploadUrl = sessionRes.data.uploadUrl;

            // Upload in chunks
            const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk
            let start = 0;
            const fileSize = file.size;
            let lastResponse = null;

            while (start < fileSize) {
                const end = Math.min(start + CHUNK_SIZE, fileSize) - 1;
                const chunk = file.slice(start, end + 1);
                const contentRange = `bytes ${start}-${end}/${fileSize}`;
                try {
                    const res = await axios.put(uploadUrl, chunk, {
                        headers: {
                            'Content-Range': contentRange,
                            'Content-Type': file.type || 'application/octet-stream',
                        },
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                    });
                    lastResponse = res;
                    // On final chunk Graph returns 201 or 200 with the uploaded item
                    // Report progress after each successful chunk
                    if (onProgress) {
                        try {
                            onProgress(Math.min((end + 1) / fileSize, 1));
                        } catch (e) {
                            console.warn('onProgress callback error', e);
                        }
                    }
                    if (res.status === 201 || res.status === 200) {
                        if (onProgress) {
                            try {
                                onProgress(1);
                            } catch (e) {
                                console.warn('onProgress callback error', e);
                            }
                        }
                        return { ...(res.data || {}), folderCreatedId };
                    }
                } catch (chunkErr) {
                    // bubble up the error to trigger rollback
                    console.error(
                        'Chunk upload failed',
                        chunkErr?.response?.data || chunkErr?.message || chunkErr
                    );
                    throw chunkErr;
                }
                start = end + 1;
            }

            // If we get here, try to return lastResponse data if present
            if (lastResponse && lastResponse.data) {
                if (onProgress) {
                    try {
                        onProgress(1);
                    } catch (e) {
                        console.warn('onProgress callback error', e);
                    }
                }
                return { ...lastResponse.data, folderCreatedId };
            }
            throw new Error('Upload session did not complete successfully');
        } else {
            const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${targetFolder.id}:/${encodeURIComponent(fileName)}:/content`;
            const uploadRes = await axios.put(uploadUrl, file, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': file.type || 'application/octet-stream',
                },
                onUploadProgress: function (progressEvent) {
                    if (onProgress && progressEvent && progressEvent.total) {
                        try {
                            onProgress(Math.min(progressEvent.loaded / progressEvent.total, 1));
                        } catch (e) {
                            console.warn('onProgress callback error', e);
                        }
                    }
                },
            });
            if (onProgress) {
                try {
                    onProgress(1);
                } catch (e) {
                    console.warn('onProgress callback error', e);
                }
            }
            return { ...(uploadRes.data || {}), folderCreatedId };
        }
    } catch (err) {
        console.error('Error uploading client photo:', err.response?.data || err.message || err);
        throw err;
    }
}

// Delete a drive item by id
async function deleteDriveItemById(itemId) {
    try {
        const token = await getToken();
        const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
        await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
        return true;
    } catch (err) {
        console.warn(
            'Failed to delete drive item',
            itemId,
            err?.response?.data || err?.message || err
        );
        return false;
    }
}

// Delete a table row by index. Returns true on success.
async function deleteTableRowByIndex(fileId, index, tableName) {
    try {
        const token = await getToken();
        const tName = tableName || TABLE_NAME;
        const url = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${encodeURIComponent(tName)}/rows/${index}`;
        await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
        return true;
    } catch (err) {
        console.warn(
            'Failed to delete table row index',
            index,
            err?.response?.data || err?.message || err
        );
        return false;
    }
}

// Transactional registration: upload optional photo and append row, rollback on any failure
export async function performRegistrationTransaction(
    rowData,
    photoFile,
    registrantName,
    registrantCompany,
    opts = {}
) {
    const fileId = opts.fileId || (await checkFileExists());
    if (!fileId) throw new Error('Workbook file not found');

    const token = await getToken();
    // Track resources for rollback
    let uploadedFileId = null;
    let createdFolderId = null; // note: uploadClientPhoto will create folder if needed; we don't have its id here
    let appendedRowIndex = null;

    try {
        // Append the row first (this assigns inviteId and inviteToken)
        const appendResult = await appendRowToExcel(rowData, { fileId, tableName: opts.tableName });
        if (!appendResult) throw new Error('Failed to append row');
        appendedRowIndex = appendResult.rowIndex;

        // If photo provided, upload it now. Pass fileId so uploadClientPhoto can derive the same event code without extra lookups.
        if (photoFile) {
            try {
                const uploadRes = await uploadClientPhoto(
                    photoFile,
                    registrantName,
                    registrantCompany,
                    { fileId, onProgress: opts.onProgress }
                );
                uploadedFileId = uploadRes?.id || null;
                // capture folder id if uploadClientPhoto created it so we can attempt to delete on rollback
                createdFolderId = uploadRes?.folderCreatedId || createdFolderId;
            } catch (uploadErr) {
                // If upload fails after row appended, try to delete the appended row
                try {
                    if (appendedRowIndex !== null)
                        await deleteTableRowByIndex(fileId, appendedRowIndex, opts.tableName);
                } catch (delErr) {
                    console.warn(
                        'Rollback: failed to delete appended row after upload failure',
                        appendedRowIndex,
                        delErr?.response?.data || delErr?.message || delErr
                    );
                }
                throw uploadErr;
            }
        }

        // success
        return { inviteId: appendResult.inviteId, token: appendResult.token };
    } catch (err) {
        // Rollback: if we uploaded a file (rare in this flow since upload happens after append), try to delete it
        try {
            if (uploadedFileId) await deleteDriveItemById(uploadedFileId);
        } catch (e) {
            console.warn(
                'Rollback: failed to delete uploaded file',
                uploadedFileId,
                e?.response?.data || e?.message || e
            );
        }

        // Attempt to delete created folder only if we have its id and it's empty
        try {
            if (createdFolderId) {
                const childrenUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${createdFolderId}/children`;
                const childrenRes = await axios.get(childrenUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const items = childrenRes.data.value || [];
                if (!items.length) {
                    await deleteDriveItemById(createdFolderId);
                }
            }
        } catch (e) {
            console.warn(
                'Rollback: failed to delete created folder',
                createdFolderId,
                e?.response?.data || e?.message || e
            );
        }

        try {
            if (appendedRowIndex !== null) {
                await deleteTableRowByIndex(fileId, appendedRowIndex, opts.tableName);
            }
        } catch (e) {
            console.warn(
                'Rollback: failed to delete appended row',
                appendedRowIndex,
                e?.response?.data || e?.message || e
            );
        }

        throw err;
    }
}

// Create a new event workbook in EventRegistration and initialize a table with headers.
// Returns { fileId, fileName, tableName }
export async function createEventWorkbook(eventName, config = {}) {
    try {
        const token = await getToken();
        const parentFolderId = await getEventRegistrationFolderId();
        if (!parentFolderId) throw new Error('EventRegistration folder not found');

        const cleanEventName = removeDiacriticsAndSanitize(String(eventName || 'Event')) || 'Event';
        // create placeholder file
        const createUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}/children`;
        const tempName = `temp_${Date.now()}.xlsx`;
        const createRes = await axios.post(
            createUrl,
            { name: tempName, file: {} },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const file = createRes.data;
        const fileId = file.id;

        // derive event code from file id
        const eventCode = generateEventCode(fileId);
        const desiredName = `EVT${eventCode}_${cleanEventName}.xlsx`;

        // rename file to desired name
        const renameUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`;
        await axios.patch(
            renameUrl,
            { name: desiredName },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        // ensure there's at least one worksheet and get its name
        const sheetsUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`;
        const sheetsRes = await axios.get(sheetsUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const sheets = sheetsRes.data.value || [];
        const sheet = sheets[0];
        const sheetName = sheet?.name || 'Sheet1';

        // write header row into A1:H1
        const headers = [
            'Name',
            'Position',
            'Company',
            'Email',
            'Phone',
            'Invite_ID',
            'Token',
            'Attendance_ID',
        ];
        const rangeUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets('${encodeURIComponent(sheetName)}')/range(address='A1:H1')`;
        // set header values
        await axios.patch(
            rangeUrl,
            { values: [headers] },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        // create a table on the header row
        const addTableUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/add`;
        const tableRes = await axios.post(
            addTableUrl,
            { address: `${sheetName}!A1:H1`, hasHeaders: true },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const table = tableRes.data;

        // rename the table to EVT###-ClientReg
        // Excel table names must follow Excel naming rules (no spaces, avoid punctuation like '-').
        // Use underscore to be safe.
        const tableName = `EVT${eventCode}_ClientReg`;
        // Graph's tables endpoint accepts the table "name" (e.g., Table1) or id without braces.
        // Prefer the returned table.name; fall back to table.id (stripping braces) if name is missing.
        let tableIdentifier = null;
        if (table) {
            if (table.name) tableIdentifier = table.name;
            else if (table.id) tableIdentifier = String(table.id).replace(/^{|}$/g, '');
        }

        if (tableIdentifier) {
            const tablePatchUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${encodeURIComponent(tableIdentifier)}`;
            try {
                await axios.patch(
                    tablePatchUrl,
                    { name: tableName },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } catch (tblErr) {
                // emit diagnostics to help debug API-format mismatches
                console.error(
                    'Failed to rename table. tableRes.data=',
                    tableRes.data,
                    ' attemptedPatchUrl=',
                    tablePatchUrl,
                    ' error=',
                    tblErr?.response?.data || tblErr?.message || tblErr
                );
                // As a fallback, attempt to PATCH using the raw id (unencoded) if it looks different
                try {
                    const rawId = table.id ? String(table.id).replace(/[{}]/g, '') : null;
                    if (rawId && rawId !== tableIdentifier) {
                        const altUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${rawId}`;
                        await axios.patch(
                            altUrl,
                            { name: tableName },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        console.warn('Renamed table using alternate identifier', rawId);
                    } else {
                        throw tblErr;
                    }
                } catch (altErr) {
                    console.error(
                        'Alternate table rename attempt failed',
                        altErr?.response?.data || altErr?.message || altErr
                    );
                    throw tblErr;
                }
            }
        } else {
            console.warn('No table identifier available to rename table', table);
        }

        // create a small _config worksheet to store event metadata (makes the workbook self-contained)
        try {
            const configSheetUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/add`;
            await axios.post(
                configSheetUrl,
                { name: '_config' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const cfgRangeUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets('_config')/range(address='A1:B5')`;
            const cfgValues = [
                ['key', 'value'],
                ['eventName', String(eventName || desiredName)],
                ['imageRequired', config.imageRequired ? 'true' : 'false'],
                ['tableName', tableName],
                ['createdAt', new Date().toISOString()],
            ];
            await axios.patch(
                cfgRangeUrl,
                { values: cfgValues },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (cfgErr) {
            // non-fatal: config sheet failed to create, but workbook exists
            console.warn(
                'Failed to write _config sheet (non-fatal)',
                cfgErr?.response?.data || cfgErr?.message || cfgErr
            );
        }

        return { fileId, fileName: desiredName, tableName };
    } catch (err) {
        console.error(
            'Failed to create event workbook:',
            err?.response?.data || err?.message || err
        );
        throw err;
    }
}

// List event workbooks under EventRegistration
export async function listEventWorkbooks() {
    try {
        const parentFolderId = await getEventRegistrationFolderId();
        if (!parentFolderId) return [];
        const token = await getToken();
        const listUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}/children`;
        const res = await axios.get(listUrl, { headers: { Authorization: `Bearer ${token}` } });
        const items = res.data.value || [];
        // prefer files that look like workbooks / start with EVT
        const candidates = items
            .filter((it) => {
                if (!it.name) return false;
                if (/^EVT\d{3}.*\.xlsx?$/i.test(it.name)) return true;
                if (
                    it.file &&
                    it.file.mimeType &&
                    /spreadsheet|excel|openxml/i.test(it.file.mimeType)
                )
                    return true;
                return false;
            })
            .map((it) => ({ id: it.id, name: it.name }));
        return candidates;
    } catch (err) {
        console.error(
            'Failed to list event workbooks:',
            err?.response?.data || err?.message || err
        );
        return [];
    }
}

// Read event config from the _config worksheet inside a workbook (if present)
export async function readEventConfig(fileId) {
    try {
        const token = await getToken();
        // Check if _config worksheet exists
        const sheetsUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`;
        const sheetsRes = await axios.get(sheetsUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const sheets = sheetsRes.data.value || [];
        const cfg = sheets.find((s) => s.name === '_config');
        if (!cfg) {
            // fallback: return default config derived from filename
            return { eventName: null, imageRequired: false };
        }

        const cfgRangeUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets('_config')/range(address='A1:B10')`;
        const rangeRes = await axios.get(cfgRangeUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const values = rangeRes.data.values || [];
        const obj = {};
        for (let i = 0; i < values.length; i++) {
            const row = values[i];
            if (row && row.length >= 2) {
                const k = String(row[0] || '').trim();
                const v = String(row[1] || '').trim();
                if (k) obj[k] = v;
            }
        }
        return {
            eventName: obj.eventName || null,
            imageRequired: obj.imageRequired === 'true',
            tableName: obj.tableName || null,
        };
    } catch (err) {
        console.warn(
            'Failed to read event config, returning defaults',
            err?.response?.data || err?.message || err
        );
        return { eventName: null, imageRequired: false, tableName: null };
    }
}
