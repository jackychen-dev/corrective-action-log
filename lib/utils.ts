import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .replace(/[\r\n]+/g, ' ') // Replace line breaks with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/\(.*?\)/g, '') // Remove parentheses and their contents
    .trim()
    .toLowerCase();
}

export function parseExcelDate(value: any): string | undefined {
  if (!value) return undefined;
  
  // If it's already a date string
  if (typeof value === 'string') {
    // Try to parse various date formats
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // If it's an Excel serial number
  if (typeof value === 'number') {
    // Excel epoch starts 1900-01-01, but Excel incorrectly treats 1900 as a leap year
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  return undefined;
}

export function parseBoolean(value: any): boolean | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'y' || lower === 'yes' || lower === 'true' || lower === '1') return true;
    if (lower === 'n' || lower === 'no' || lower === 'false' || lower === '0') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return undefined;
}

export function parseNumber(value: any): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return isNaN(value) ? undefined : value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

export function formatDateForExport(date: Timestamp | string | undefined): string {
  if (!date) return '';
  if (typeof date === 'string') {
    // If it's already in ISO format
    if (date.includes('T')) {
      return date.split('T')[0];
    }
    return date;
  }
  // Firestore Timestamp
  if (date.toDate) {
    return date.toDate().toISOString().split('T')[0];
  }
  return '';
}

