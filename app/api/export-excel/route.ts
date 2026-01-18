import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { adminDb } from '@/lib/firebase-admin';
import { CorrectiveActionRecord } from '@/lib/types';

const COLLECTION_NAME = 'correctiveActions';

function formatDateForExport(date: any): string {
  if (!date) return '';
  if (typeof date === 'string') {
    if (date.includes('T')) {
      return date.split('T')[0];
    }
    return date;
  }
  if (date.toDate) {
    return date.toDate().toISOString().split('T')[0];
  }
  return '';
}

function formatBoolean(value: boolean | string | undefined): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'y' || lower === 'yes' || lower === 'true' || lower === '1') return 'Y';
    if (lower === 'n' || lower === 'no' || lower === 'false' || lower === '0') return 'N';
  }
  return String(value);
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return '';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(value);
}

export async function GET() {
  try {
    // Fetch all records
    const snapshot = await adminDb
      .collection(COLLECTION_NAME)
      .orderBy('internalCarNumber', 'asc')
      .get();
    
    const records: CorrectiveActionRecord[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CorrectiveActionRecord[];
    
    // Sort: by internal CAR # ascending, or received date if missing
    records.sort((a, b) => {
      if (a.internalCarNumber && b.internalCarNumber) {
        return a.internalCarNumber.localeCompare(b.internalCarNumber);
      }
      if (a.internalCarNumber) return -1;
      if (b.internalCarNumber) return 1;
      
      const aDate = a.receivedDate 
        ? (typeof a.receivedDate === 'string' ? new Date(a.receivedDate) : a.receivedDate.toDate())
        : new Date(0);
      const bDate = b.receivedDate 
        ? (typeof b.receivedDate === 'string' ? new Date(b.receivedDate) : b.receivedDate.toDate())
        : new Date(0);
      return aDate.getTime() - bDate.getTime();
    });
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('CAR LOG');
    
    // Define columns
    worksheet.columns = [
      { header: 'Internal CAR #', key: 'internalCarNumber', width: 15 },
      { header: 'Location', key: 'location', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Incidence Type', key: 'incidenceType', width: 18 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Received Date', key: 'receivedDate', width: 15 },
      { header: 'Part Number', key: 'partNumber', width: 18 },
      { header: 'Part Description', key: 'partDescription', width: 30 },
      { header: 'Part Family', key: 'partFamily', width: 18 },
      { header: "Cust. CAR #", key: 'customerCarNumber', width: 15 },
      { header: "Stop Tag #", key: 'stopTagNumber', width: 15 },
      { header: "Audit NC #", key: 'auditNcNumber', width: 15 },
      { header: 'Customer', key: 'customer', width: 20 },
      { header: 'Komatsu Tracking', key: 'komatsuTracking', width: 18 },
      { header: "Work Order #", key: 'workOrderNumber', width: 15 },
      { header: 'Manufacture Date', key: 'manufactureDate', width: 18 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Problem Description', key: 'problemDescription', width: 40 },
      { header: 'Department Responsible', key: 'departmentResponsible', width: 25 },
      { header: 'Defect Category', key: 'defectCategory', width: 20 },
      { header: 'Champion', key: 'champion', width: 20 },
      { header: 'Containment Complete?', key: 'containmentComplete', width: 22 },
      { header: 'Corrective Action Prevention', key: 'correctiveActionPrevention', width: 35 },
      { header: 'Corrective Action Detection', key: 'correctiveActionDetection', width: 35 },
      { header: 'Proposed Cost', key: 'proposedCost', width: 15 },
      { header: 'Cost Approved?', key: 'costApproved', width: 15 },
      { header: 'Initial Resp.', key: 'initialResp', width: 15 },
      { header: 'Final Resp. Due Date', key: 'finalRespDueDate', width: 20 },
      { header: 'Completed Resp. Actual', key: 'completedRespActual', width: 22 },
      { header: '# Days to Close', key: 'daysToClose', width: 18 },
      { header: 'Closed Date', key: 'closedDate', width: 15 },
      { header: 'Employee ID', key: 'employeeId', width: 15 },
      { header: "RMA #", key: 'rmaNumber', width: 15 },
      { header: 'Contact', key: 'followUpContact', width: 20 },
      { header: 'Debit Cost', key: 'followUpDebitCost', width: 15 },
      { header: 'Comments', key: 'followUpComments', width: 40 },
    ];
    
    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    
    // Add data rows
    records.forEach((record) => {
      worksheet.addRow({
        internalCarNumber: record.internalCarNumber || '',
        location: record.location || '',
        status: record.status || '',
        incidenceType: record.incidenceType || '',
        type: record.type || '',
        category: record.category || '',
        receivedDate: formatDateForExport(record.receivedDate),
        partNumber: record.partNumber || '',
        partDescription: record.partDescription || '',
        partFamily: record.partFamily || '',
        customerCarNumber: record.customerCarNumber || '',
        stopTagNumber: record.stopTagNumber || '',
        auditNcNumber: record.auditNcNumber || '',
        customer: record.customer || '',
        komatsuTracking: record.komatsuTracking || '',
        workOrderNumber: record.workOrderNumber || '',
        manufactureDate: formatDateForExport(record.manufactureDate),
        quantity: record.quantity || '',
        problemDescription: record.problemDescription || '',
        departmentResponsible: record.departmentResponsible || '',
        defectCategory: record.defectCategory || '',
        champion: record.champion || '',
        containmentComplete: formatBoolean(record.containmentComplete),
        correctiveActionPrevention: record.correctiveActionPrevention || '',
        correctiveActionDetection: record.correctiveActionDetection || '',
        proposedCost: record.proposedCost || '',
        costApproved: formatBoolean(record.costApproved),
        initialResp: record.initialResp || '',
        finalRespDueDate: formatDateForExport(record.finalRespDueDate),
        completedRespActual: formatDateForExport(record.completedRespActual),
        daysToClose: record.daysToClose || '',
        closedDate: formatDateForExport(record.closedDate),
        employeeId: record.employeeId || '',
        rmaNumber: record.rmaNumber || '',
        followUpContact: record.followUpContact || '',
        followUpDebitCost: record.followUpDebitCost || '',
        followUpComments: record.followUpComments || '',
      });
    });
    
    // Format date columns
    const dateColumns = ['receivedDate', 'manufactureDate', 'finalRespDueDate', 'completedRespActual', 'closedDate'];
    dateColumns.forEach((key) => {
      const colIndex = worksheet.getColumn(key).number;
      worksheet.getColumn(colIndex).numFmt = 'yyyy-mm-dd';
    });
    
    // Format currency columns
    const currencyColumns = ['proposedCost', 'followUpDebitCost'];
    currencyColumns.forEach((key) => {
      const colIndex = worksheet.getColumn(key).number;
      worksheet.getColumn(colIndex).numFmt = '$#,##0.00';
    });
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Generate filename with date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `CAR LOG - Export - ${dateStr}.xlsx`;
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

