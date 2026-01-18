import * as XLSX from 'xlsx';
import { ExcelRow, NormalizedRow } from './types';
import { buildHeaderMap, mapExcelRowToNormalized } from './excel-mapper';

export interface ParseResult {
  rows: NormalizedRow[];
  headers: string[];
  errors: string[];
}

export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        console.log('Available sheets:', workbook.SheetNames);

        // Try to find "CAR LOG" sheet first, otherwise use first sheet
        let worksheet;
        let selectedSheetName;
        const carLogSheet = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('car log') || 
          name.toLowerCase() === 'car log'
        );
        
        if (carLogSheet) {
          worksheet = workbook.Sheets[carLogSheet];
          selectedSheetName = carLogSheet;
          console.log('Using CAR LOG sheet:', carLogSheet);
        } else {
          selectedSheetName = workbook.SheetNames[0];
          worksheet = workbook.Sheets[selectedSheetName];
          console.log('Using first sheet:', selectedSheetName);
        }

        if (!worksheet) {
          reject(new Error('No worksheet found in Excel file'));
          return;
        }

        // Get the range to check what data exists
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        console.log('Sheet range:', worksheet['!ref'], 'Rows:', range.e.r + 1);

        // Try parsing from different starting rows (to handle files with title rows)
        let jsonData: ExcelRow[] = [];
        let startRow = 0;
        
        // Try rows 0, 1, 2, 3 (Excel rows 1, 2, 3, 4) to find where headers start
        for (let tryRow = 0; tryRow <= 3 && jsonData.length === 0; tryRow++) {
          console.log(`Trying to parse from row ${tryRow + 1}...`);
          const tempData = XLSX.utils.sheet_to_json(worksheet, {
            defval: '',
            raw: false,
            blankrows: false,
            range: tryRow, // Start from this row
          });
          
          if (tempData.length > 0) {
            console.log(`Found ${tempData.length} rows starting from row ${tryRow + 1}`);
            console.log('First row headers:', Object.keys(tempData[0]).slice(0, 10));
            
            // Check if this looks like valid data (has recognizable headers)
            const headers = Object.keys(tempData[0]);
            const hasValidHeaders = headers.some(h => 
              h.toLowerCase().includes('car') || 
              h.toLowerCase().includes('status') ||
              h.toLowerCase().includes('location') ||
              h.toLowerCase().includes('date')
            );
            
            if (hasValidHeaders || tryRow === 3) {
              // Found valid data or reached last attempt
              jsonData = tempData;
              startRow = tryRow;
              console.log(`Using data starting from row ${tryRow + 1} (Excel row ${tryRow + 1})`);
              break;
            }
          }
        }

        console.log('Parsed', jsonData.length, 'rows from sheet');
        
        if (jsonData.length > 0) {
          console.log('First row sample:', JSON.stringify(jsonData[0]).substring(0, 200));
        }

        if (jsonData.length === 0) {
          resolve({ rows: [], headers: [], errors: ['No data found in worksheet. The sheet might be empty or formatted incorrectly.'] });
          return;
        }

        // Get headers from first row
        const firstRow = jsonData[0];
        let headers = Object.keys(firstRow);
        console.log('Found headers:', headers.slice(0, 10), '... (showing first 10)');

        // Check if headers are __EMPTY (happens when first column is blank/merged)
        // In this case, the actual headers are in the VALUES of the first row
        if (headers[0] && headers[0].startsWith('__EMPTY')) {
          console.log('Detected __EMPTY headers, using row values as headers instead');
          const actualHeaders = Object.values(firstRow).map(v => String(v).trim());
          console.log('Actual headers from values:', actualHeaders.slice(0, 10));
          
          // Remove the header row from data
          jsonData.shift();
          console.log('Removed header row, now have', jsonData.length, 'data rows');
          
          // Rebuild all data rows with new header keys
          const oldKeys = headers;
          jsonData = jsonData.map(row => {
            const newRow: ExcelRow = {};
            oldKeys.forEach((oldKey, index) => {
              if (actualHeaders[index]) {
                newRow[actualHeaders[index]] = row[oldKey];
              }
            });
            return newRow;
          });
          
          headers = actualHeaders;
          console.log('Rebuilt', jsonData.length, 'rows with actual headers');
        }

        // Build header mapping
        const headerMap = buildHeaderMap(headers);
        console.log('Mapped', headerMap.size, 'headers to database fields');

        if (headerMap.size === 0) {
          console.warn('WARNING: No headers matched! Will try to import anyway with raw headers.');
          // Create a fallback mapping using raw headers as-is
          headers.forEach(h => {
            if (h && h.trim()) {
              headerMap.set(h, h.toLowerCase().replace(/[^a-z0-9]/g, '') as any);
            }
          });
          console.log('Created fallback mapping with', headerMap.size, 'headers');
        }

        // Map rows
        const errors: string[] = [];
        const rows: NormalizedRow[] = [];

        console.log('Starting to map', jsonData.length, 'data rows...');

        for (let i = 0; i < jsonData.length; i++) {
          try {
            const rawRow = jsonData[i];
            console.log(`Row ${i + 1} raw data:`, Object.keys(rawRow).length, 'fields');
            
            const normalized = mapExcelRowToNormalized(rawRow, headerMap);
            const normalizedFieldCount = Object.keys(normalized).length;
            
            console.log(`Row ${i + 1} normalized:`, normalizedFieldCount, 'fields');
            
            // Only include rows that have at least some data
            if (normalizedFieldCount > 0) {
              rows.push(normalized);
              if (i === 0) {
                console.log('First normalized row:', normalized);
              }
            } else {
              console.log(`Row ${i + 1}: SKIPPED (no valid fields after mapping)`);
              console.log('Raw row sample:', JSON.stringify(rawRow).substring(0, 150));
            }
          } catch (error) {
            errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.error('Error mapping row', i, ':', error);
          }
        }

        console.log('Successfully mapped', rows.length, 'rows out of', jsonData.length, 'total rows');
        if (rows.length > 0) {
          console.log('First mapped row sample:', rows[0]);
        } else {
          console.warn('WARNING: All rows were filtered out. Check if headers match expected format.');
        }

        resolve({
          rows,
          headers,
          errors,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export function validateFileName(fileName: string): boolean {
  // Accept any .xlsx file
  return fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');
}

