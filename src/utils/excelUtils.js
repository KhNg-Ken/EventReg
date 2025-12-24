import ExcelJS from 'exceljs';

/**
 * Format Firestore Timestamp to readable date format
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return '';

    let date;
    if (timestamp && typeof timestamp.toDate === 'function') {
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
 * Export registrant data to Excel file as a formatted table
 * @param {Array} registrants - Array of registrant data
 * @param {Array} attendants - Array of attendant data
 * @param {string} eventName - Name of the event (for filename)
 */
export async function exportRegistrantsToExcel(registrants, attendants, eventName) {
    try {
        console.log('Starting Excel export...');

        // Create attendance map
        const attendanceMap = {};
        attendants.forEach((att) => {
            attendanceMap[att.registrantId] = att;
        });

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Danh sách đăng ký');

        // Add title row
        const titleRow = worksheet.addRow([eventName]);
        titleRow.font = { bold: true, size: 14 };
        worksheet.addRow([]); // Blank row
        worksheet.addRow([]); // Blank row

        // Add header row
        const headerRow = worksheet.addRow([
            'STT',
            'Hình',
            'Công ty',
            'Họ Tên',
            'Chức vụ',
            'Số ĐT',
            'Email',
            'Thời gian đăng ký',
            'Thời gian check-in',
        ]);

        // Style header row
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' },
        };

        // Add data rows
        registrants.forEach((registrant, index) => {
            worksheet.addRow([
                index + 1,
                registrant.photoUrl || '—',
                registrant.company || '',
                registrant.name || '',
                registrant.position || '',
                registrant.phone || registrant.phoneNumber || '',
                registrant.email || '',
                formatTimestamp(registrant.createdAt),
                formatTimestamp(attendanceMap[registrant.id]?.checkedInAt),
            ]);
        });

        // Set column widths
        worksheet.columns = [
            { width: 6 }, // STT
            { width: 12 }, // Hình
            { width: 20 }, // Công ty
            { width: 20 }, // Họ Tên
            { width: 15 }, // Chức vụ
            { width: 15 }, // Số ĐT
            { width: 25 }, // Email
            { width: 18 }, // Thời gian đăng ký
            { width: 18 }, // Thời gian check-in
        ];

        // Apply border styling to all data rows
        for (let i = 4; i <= registrants.length + 3; i++) {
            const row = worksheet.getRow(i);
            row.eachCell({ inclusive: true }, (cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        }

        // Generate file
        const fileName = `${eventName}_danh_sach_dang_ky_${
            new Date().toISOString().split('T')[0]
        }.xlsx`;

        // Write to buffer and trigger download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('Excel export completed successfully');
    } catch (err) {
        console.error('Failed to export to Excel:', err);
        throw err;
    }
}
