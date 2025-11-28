/**
 * Client-side Cloudinary uploader helper.
 *
 * Expects the following environment variables (Vite):
 * - VITE_CLOUDINARY_CLOUD_NAME
 * - VITE_CLOUDINARY_UPLOAD_PRESET (unsigned preset)
 *
 * Notes:
 * - Unsigned presets keep your API secret off the client but limit control. Restrict the preset
 *   in the Cloudinary console (folder, allowed formats, max file size).
 * - If you need guaranteed immediate rollback, use a signed server endpoint instead.
 */
/**
 * Upload a file to Cloudinary via unsigned/form-data POST.
 * @param {File|Blob} file - file to upload
 * @param {object} opts
 * @param {string} [opts.cloudName] - override VITE_CLOUDINARY_CLOUD_NAME
 * @param {string} [opts.uploadPreset] - override VITE_CLOUDINARY_UPLOAD_PRESET
 * @param {string} [opts.folder] - folder to place the asset under
 * @param {function(number):void} [opts.onProgress] - progress callback (0-100)
 * @param {boolean} [opts.returnDeleteToken=false] - when true, request a delete token (only supported for signed flows/presets)
 * @param {string} [opts.publicId] - desired public_id (filename) for the uploaded asset (without folder)
 */
export function uploadToCloudinary(
    file,
    { cloudName, uploadPreset, folder, onProgress, returnDeleteToken = false, publicId } = {}
) {
    return new Promise((resolve, reject) => {
        try {
            const cn = cloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
            const up = uploadPreset || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
            if (!cn || !up) {
                return reject(
                    new Error(
                        'Missing Cloudinary configuration (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET)'
                    )
                );
            }

            const url = `https://api.cloudinary.com/v1_1/${cn}/image/upload`;
            const fd = new FormData();
            fd.append('file', file);
            fd.append('upload_preset', up);
            if (folder) fd.append('folder', folder);
            // Only request a delete token when explicitly requested. For unsigned client uploads this
            // should remain false (Cloudinary rejects return_delete_token in unsigned requests).
            if (returnDeleteToken) fd.append('return_delete_token', 'true');
            // Allow caller to suggest a public_id (filename without folder). When used with `folder`,
            // Cloudinary will place the asset under `folder` and use this public_id as the filename.
            if (publicId) fd.append('public_id', publicId);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);

            xhr.upload.onprogress = (ev) => {
                if (ev.lengthComputable && typeof onProgress === 'function') {
                    const pct = Math.round((ev.loaded / ev.total) * 100);
                    try {
                        onProgress(pct);
                    } catch {
                        /* ignore */
                    }
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const json = JSON.parse(xhr.responseText);
                        resolve(json);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(
                        new Error(
                            `Cloudinary upload failed: ${xhr.status} ${xhr.statusText} - ${xhr.responseText}`
                        )
                    );
                }
            };

            xhr.onerror = () => reject(new Error('Network error during Cloudinary upload'));
            xhr.send(fd);
        } catch (err) {
            reject(err);
        }
    });
}

export async function deleteByToken(cloudName, deleteToken) {
    if (!cloudName || !deleteToken) throw new Error('Missing parameters for deleteByToken');
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/delete_by_token`;
    const fd = new FormData();
    fd.append('token', deleteToken);
    const res = await fetch(url, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`Delete by token failed: ${res.status}`);
    return res.json();
}
