import ExcelJS from 'exceljs';
import admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';

/**
 * Format Firestore Timestamp to readable date format
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return '';

    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else if (typeof timestamp === 'object' && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        return '';
    }

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);

    return `${hours}:${minutes} ${day}/${month}/${year}`;
}

/**
 * Cloud Function to export registrants to Excel
 */
export const exportRegistrantsExcel = onCall(async (request) => {
    try {
        const { eventId } = request.data;

        if (!eventId) {
            throw new Error('Event ID is required');
        }

        const db = admin.firestore();

        // Get registrants
        const registrantsSnap = await db
            .collection('events')
            .doc(eventId)
            .collection('registrants')
            .get();
        const registrants = registrantsSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        // Get attendants for check-in data
        const attendantsSnap = await db
            .collection('events')
            .doc(eventId)
            .collection('attendants')
            .get();
        const attendantsMap = {};
        attendantsSnap.docs.forEach((doc) => {
            attendantsMap[doc.data().registrantId] = doc.data();
        });

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Danh sách đăng ký', {
            pageSetup: { paperSize: 9, orientation: 'landscape' },
        });

        // Define columns
        const columns = [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Hình', key: 'photoUrl', width: 12 },
            { header: 'Công ty', key: 'company', width: 20 },
            { header: 'Họ Tên', key: 'name', width: 20 },
            { header: 'Chức vụ', key: 'position', width: 15 },
            { header: 'Số ĐT', key: 'phone', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Thời gian đăng ký', key: 'createdAt', width: 18 },
            { header: 'Thời gian check-in', key: 'checkedInAt', width: 18 },
        ];
        worksheet.columns = columns;

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
        headerRow.height = 25;

        // Add data rows
        registrants.forEach((registrant, index) => {
            const stt = index + 1;
            const attendant = attendantsMap[registrant.id];

            const row = worksheet.addRow({
                stt,
                photoUrl: registrant.photoUrl || '—',
                company: registrant.company || '',
                name: registrant.name || '',
                position: registrant.position || '',
                phone: registrant.phone || registrant.phoneNumber || '',
                email: registrant.email || '',
                createdAt: formatTimestamp(registrant.createdAt),
                checkedInAt: formatTimestamp(attendant?.checkedInAt),
            });

            // Alternate row colors
            if (index % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F2F2' },
                };
            }

            row.alignment = { horizontal: 'left', vertical: 'center', wrapText: true };
            row.height = 20;
        });

        // Add table
        worksheet.addTable({
            name: 'customer_info',
            ref: `A1:I${registrants.length + 1}`,
            headerRow: true,
            style: 'TableStyleMedium2',
            showFilterButton: true,
        });

        // Freeze header row
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const base64 = buffer.toString('base64');

        return {
            success: true,
            fileData: base64,
            fileName: `danh_sach_dang_ky_${new Date().toISOString().split('T')[0]}.xlsx`,
        };
    } catch (error) {
        console.error('Export error:', error);
        throw new Error(`Export failed: ${error.message}`);
    }
});
