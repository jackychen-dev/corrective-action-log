import { normalizeHeader, parseExcelDate, parseBoolean, parseNumber } from './utils';
import { ExcelRow, NormalizedRow } from './types';

// Header mapping: Excel column name (normalized) -> field name
const HEADER_MAP: Record<string, keyof NormalizedRow> = {
  'internal car #': 'internalCarNumber',
  'internal car#': 'internalCarNumber',
  'internal car': 'internalCarNumber',
  'location': 'location',
  'location as applicable': 'location',
  'status': 'status',
  'incidence type': 'incidenceType',
  'type': 'type',
  'category': 'category',
  'received date': 'receivedDate',
  'part number': 'partNumber',
  'part description': 'partDescription',
  'part family': 'partFamily',
  'cust. car #': 'customerCarNumber',
  'cust car #': 'customerCarNumber',
  'customer car #': 'customerCarNumber',
  "reference #'s": 'customerCarNumber',
  "reference #s": 'customerCarNumber',
  'stop tag #': 'stopTagNumber',
  'audit nc #': 'auditNcNumber',
  'customer': 'customer',
  'komatsu tracking': 'komatsuTracking',
  'work order #': 'workOrderNumber',
  'manufacture date': 'manufactureDate',
  'quantity': 'quantity',
  'problem description': 'problemDescription',
  'department responsible': 'departmentResponsible',
  'defect category': 'defectCategory',
  'champion': 'champion',
  'containment complete?': 'containmentComplete',
  'containment complete': 'containmentComplete',
  'corrective action prevention': 'correctiveActionPrevention',
  'corrective action detection': 'correctiveActionDetection',
  'proposed cost': 'proposedCost',
  'cost approved?': 'costApproved',
  'cost approved': 'costApproved',
  'initial resp.': 'initialResp',
  'initial resp': 'initialResp',
  'final resp. due date': 'finalRespDueDate',
  'final resp due date': 'finalRespDueDate',
  'completed resp. actual': 'completedRespActual',
  'completed resp actual': 'completedRespActual',
  '# days to close': 'daysToClose',
  'days to close': 'daysToClose',
  'closed date': 'closedDate',
  'employee id': 'employeeId',
  'rma #': 'rmaNumber',
  'rma number': 'rmaNumber',
  'contact': 'followUpContact',
  'follow up items': 'followUpContact',
  'debit cost': 'followUpDebitCost',
  'comments': 'followUpComments',
  'follow up': 'followUpComments',
};

const DATE_FIELDS = new Set([
  'receivedDate',
  'manufactureDate',
  'finalRespDueDate',
  'completedRespActual',
  'closedDate',
]);

const BOOLEAN_FIELDS = new Set([
  'containmentComplete',
  'costApproved',
]);

const NUMBER_FIELDS = new Set([
  'quantity',
  'daysToClose',
  'proposedCost',
  'followUpDebitCost',
]);

export function mapExcelRowToNormalized(
  row: ExcelRow,
  headerMap: Map<string, string>
): NormalizedRow {
  const normalized: NormalizedRow = {};

  console.log('Mapping row with', headerMap.size, 'header mappings');

  for (const [excelHeader, fieldName] of headerMap.entries()) {
    const value = row[excelHeader];
    // Allow empty strings to pass through - only skip undefined/null
    if (value === undefined || value === null) continue;
    
    // Skip empty strings but keep whitespace for now
    const stringValue = String(value).trim();
    if (stringValue === '') continue;

    console.log(`  Field "${excelHeader}" -> "${fieldName}" = "${stringValue.substring(0, 30)}..."`);

    const typedFieldName = fieldName as keyof NormalizedRow;

    if (DATE_FIELDS.has(typedFieldName)) {
      const dateValue = parseExcelDate(value);
      if (dateValue) {
        normalized[typedFieldName] = dateValue as any;
      }
    } else if (BOOLEAN_FIELDS.has(typedFieldName)) {
      const boolValue = parseBoolean(value);
      if (boolValue !== undefined) {
        normalized[typedFieldName] = boolValue as any;
      }
    } else if (NUMBER_FIELDS.has(typedFieldName)) {
      const numValue = parseNumber(value);
      if (numValue !== undefined) {
        normalized[typedFieldName] = numValue as any;
      }
    } else {
      normalized[typedFieldName] = stringValue;
    }
  }

  return normalized;
}

export function buildHeaderMap(excelHeaders: string[]): Map<string, string> {
  const headerMap = new Map<string, string>();
  const normalizedHeaders = excelHeaders.map(normalizeHeader);

  console.log('Building header map...');
  const unmatchedHeaders: string[] = [];

  for (let i = 0; i < excelHeaders.length; i++) {
    const normalized = normalizedHeaders[i];
    const fieldName = HEADER_MAP[normalized];
    if (fieldName) {
      headerMap.set(excelHeaders[i], fieldName);
      console.log(`Matched: "${excelHeaders[i]}" -> "${fieldName}"`);
    } else {
      unmatchedHeaders.push(excelHeaders[i]);
    }
  }

  if (unmatchedHeaders.length > 0) {
    console.log('Unmatched headers:', unmatchedHeaders.slice(0, 10));
  }

  return headerMap;
}

