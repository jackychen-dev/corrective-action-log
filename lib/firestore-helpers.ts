import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  writeBatch,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { CorrectiveActionRecord, NormalizedRow } from './types';

const COLLECTION_NAME = 'correctiveActions';

export async function getCounterForYear(year: string): Promise<number> {
  const counterRef = doc(db, 'counters', year);
  
  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    
    if (!counterDoc.exists()) {
      transaction.set(counterRef, { count: 1 });
      return 1;
    }
    
    const currentCount = counterDoc.data().count || 0;
    const newCount = currentCount + 1;
    transaction.update(counterRef, { count: newCount });
    return newCount;
  });
}

export function generateInternalCarNumber(year: string, sequence: number): string {
  const yearSuffix = year.slice(-2);
  const paddedSequence = sequence.toString().padStart(3, '0');
  return `${yearSuffix}-${paddedSequence}`;
}

export async function findRecordByInternalCarNumber(
  internalCarNumber: string
): Promise<{ id: string; record: CorrectiveActionRecord } | null> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('internalCarNumber', '==', internalCarNumber)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    record: { id: doc.id, ...doc.data() } as CorrectiveActionRecord,
  };
}

export async function getAllRecords(): Promise<CorrectiveActionRecord[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('internalCarNumber', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CorrectiveActionRecord[];
}

export async function createRecord(
  data: Omit<CorrectiveActionRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Timestamp.now();
  const ref = doc(collection(db, COLLECTION_NAME));
  
  await setDoc(ref, {
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  
  return ref.id;
}

export async function updateRecord(
  id: string,
  changes: Partial<NormalizedRow>,
  expectedUpdatedAt?: string
): Promise<{ success: boolean; conflict?: boolean; error?: string }> {
  try {
    const ref = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(ref);
    
    if (!docSnap.exists()) {
      return { success: false, error: 'Record not found' };
    }
    
    // Check for conflicts if expectedUpdatedAt is provided
    if (expectedUpdatedAt) {
      const currentUpdatedAt = docSnap.data().updatedAt;
      if (currentUpdatedAt) {
        const currentTime = currentUpdatedAt.toMillis?.() || currentUpdatedAt;
        const expectedTime = new Date(expectedUpdatedAt).getTime();
        
        if (currentTime > expectedTime) {
          return { success: false, conflict: true, error: 'Record was modified by another user' };
        }
      }
    }
    
    // Convert date strings to Timestamps
    const updateData: any = { ...changes };
    const dateFields = [
      'receivedDate',
      'manufactureDate',
      'finalRespDueDate',
      'completedRespActual',
      'closedDate',
    ];
    
    for (const field of dateFields) {
      if (updateData[field] && typeof updateData[field] === 'string') {
        updateData[field] = Timestamp.fromDate(new Date(updateData[field]));
      }
    }
    
    updateData.updatedAt = Timestamp.now();
    
    await updateDoc(ref, updateData);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function createOrUpdateRecord(
  data: NormalizedRow,
  internalCarNumber?: string
): Promise<{ success: boolean; id?: string; internalCarNumber?: string; action: 'created' | 'updated'; error?: string }> {
  try {
    // If internalCarNumber is provided, try to find existing record
    if (internalCarNumber) {
      const existing = await findRecordByInternalCarNumber(internalCarNumber);
      
      if (existing) {
        // Update existing record
        const result = await updateRecord(existing.id, data);
        if (result.success) {
          return {
            success: true,
            id: existing.id,
            internalCarNumber,
            action: 'updated',
          };
        } else if (result.conflict) {
          return {
            success: false,
            error: 'Conflict detected during update',
          };
        } else {
          return {
            success: false,
            error: result.error || 'Update failed',
          };
        }
      }
    }
    
    // Create new record
    let finalInternalCarNumber = internalCarNumber;
    
    if (!finalInternalCarNumber) {
      // Generate new internal CAR number
      const year = new Date().getFullYear().toString();
      const sequence = await getCounterForYear(year);
      finalInternalCarNumber = generateInternalCarNumber(year, sequence);
    } else {
      // Verify uniqueness
      const existing = await findRecordByInternalCarNumber(finalInternalCarNumber);
      if (existing) {
        return {
          success: false,
          error: `Duplicate Internal CAR #: ${finalInternalCarNumber}`,
        };
      }
    }
    
    // Convert date strings to Timestamps
    const recordData: any = { ...data, internalCarNumber: finalInternalCarNumber };
    const dateFields = [
      'receivedDate',
      'manufactureDate',
      'finalRespDueDate',
      'completedRespActual',
      'closedDate',
    ];
    
    for (const field of dateFields) {
      if (recordData[field] && typeof recordData[field] === 'string') {
        recordData[field] = Timestamp.fromDate(new Date(recordData[field]));
      }
    }
    
    const id = await createRecord(recordData);
    
    return {
      success: true,
      id,
      internalCarNumber: finalInternalCarNumber,
      action: 'created',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

