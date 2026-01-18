import { Timestamp } from 'firebase/firestore';

export interface CorrectiveActionRecord {
  id?: string;
  internalCarNumber: string;
  location?: string;
  status?: string;
  incidenceType?: string;
  type?: string;
  category?: string;
  receivedDate?: Timestamp | string;
  partNumber?: string;
  partDescription?: string;
  partFamily?: string;
  customerCarNumber?: string;
  stopTagNumber?: string;
  auditNcNumber?: string;
  customer?: string;
  komatsuTracking?: string;
  workOrderNumber?: string;
  manufactureDate?: Timestamp | string;
  quantity?: number;
  problemDescription?: string;
  departmentResponsible?: string;
  defectCategory?: string;
  champion?: string;
  containmentComplete?: boolean | string;
  correctiveActionPrevention?: string;
  correctiveActionDetection?: string;
  proposedCost?: number;
  costApproved?: boolean | string;
  initialResp?: string;
  finalRespDueDate?: Timestamp | string;
  completedRespActual?: Timestamp | string;
  daysToClose?: number;
  closedDate?: Timestamp | string;
  employeeId?: string;
  rmaNumber?: string;
  followUpContact?: string;
  followUpDebitCost?: number;
  followUpComments?: string;
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
  emailSent?: boolean;
}

export interface ExcelRow {
  [key: string]: any;
}

export interface NormalizedRow {
  internalCarNumber?: string;
  location?: string;
  status?: string;
  incidenceType?: string;
  type?: string;
  category?: string;
  receivedDate?: string;
  partNumber?: string;
  partDescription?: string;
  partFamily?: string;
  customerCarNumber?: string;
  stopTagNumber?: string;
  auditNcNumber?: string;
  customer?: string;
  komatsuTracking?: string;
  workOrderNumber?: string;
  manufactureDate?: string;
  quantity?: number;
  problemDescription?: string;
  departmentResponsible?: string;
  defectCategory?: string;
  champion?: string;
  containmentComplete?: boolean | string;
  correctiveActionPrevention?: string;
  correctiveActionDetection?: string;
  proposedCost?: number;
  costApproved?: boolean | string;
  initialResp?: string;
  finalRespDueDate?: string;
  completedRespActual?: string;
  daysToClose?: number;
  closedDate?: string;
  employeeId?: string;
  rmaNumber?: string;
  followUpContact?: string;
  followUpDebitCost?: number;
  followUpComments?: string;
}

export interface ImportResult {
  success: boolean;
  rowIndex: number;
  internalCarNumber?: string;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  error?: string;
}

export interface BulkUpdatePatch {
  id: string;
  expectedUpdatedAt?: string;
  changes: Partial<NormalizedRow>;
}

export interface BulkUpdateResult {
  success: boolean;
  id: string;
  conflict?: boolean;
  error?: string;
}

export interface FieldEdit {
  id: string;
  field: string;
  value: any;
}

