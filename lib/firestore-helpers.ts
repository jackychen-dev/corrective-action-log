// Firebase disabled - using local storage
// This generates CAR numbers from existing records

import type { CorrectiveActionRecord } from './types';

/**
 * Generate the next Internal CAR number for a given year
 * Format: YY-XXX (e.g., 24-001, 24-002, ...)
 */
export function generateInternalCarNumber(records: CorrectiveActionRecord[]): string {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  // Find the highest number for the current year
  const yearPrefix = `${currentYear}-`;
  const existingNumbers = records
    .map(r => r.internalCarNumber)
    .filter(num => num && num.startsWith(yearPrefix))
    .map(num => parseInt(num!.split('-')[1]) || 0);
  
  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  const nextNumber = maxNumber + 1;
  const paddedCounter = String(nextNumber).padStart(3, '0');
  
  return `${currentYear}-${paddedCounter}`;
}
