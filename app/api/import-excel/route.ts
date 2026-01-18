import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { NormalizedRow, ImportResult } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

const COLLECTION_NAME = 'correctiveActions';
const BATCH_SIZE = 200;

async function getCounterForYear(year: string): Promise<number> {
  const counterRef = adminDb.doc(`counters/${year}`);
  
  return await adminDb.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    
    if (!counterDoc.exists) {
      transaction.set(counterRef, { count: 1 });
      return 1;
    }
    
    const currentCount = counterDoc.data()?.count || 0;
    const newCount = currentCount + 1;
    transaction.update(counterRef, { count: newCount });
    return newCount;
  });
}

function generateInternalCarNumber(year: string, sequence: number): string {
  const yearSuffix = year.slice(-2);
  const paddedSequence = sequence.toString().padStart(3, '0');
  return `${yearSuffix}-${paddedSequence}`;
}

async function findRecordByInternalCarNumber(
  internalCarNumber: string
): Promise<{ id: string } | null> {
  const snapshot = await adminDb
    .collection(COLLECTION_NAME)
    .where('internalCarNumber', '==', internalCarNumber)
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  
  return { id: snapshot.docs[0].id };
}

async function processRow(
  row: NormalizedRow,
  rowIndex: number
): Promise<ImportResult> {
  try {
    const internalCarNumber = row.internalCarNumber;
    
    // Convert date strings to Firestore Timestamps
    const recordData: any = { ...row };
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
    
    const now = Timestamp.now();
    
    if (internalCarNumber) {
      const existing = await findRecordByInternalCarNumber(internalCarNumber);
      
      if (existing) {
        // Update existing record - only changed fields
        const ref = adminDb.doc(`${COLLECTION_NAME}/${existing.id}`);
        await ref.update({
          ...recordData,
          updatedAt: now,
        });
        
        return {
          success: true,
          rowIndex,
          internalCarNumber,
          action: 'updated',
        };
      }
      
      // Check for duplicate before creating
      const duplicate = await findRecordByInternalCarNumber(internalCarNumber);
      if (duplicate && duplicate.id) {
        return {
          success: false,
          rowIndex,
          action: 'failed',
          error: `Duplicate Internal CAR #: ${internalCarNumber}`,
        };
      }
    }
    
    // Create new record
    let finalInternalCarNumber = internalCarNumber;
    
    if (!finalInternalCarNumber) {
      const year = new Date().getFullYear().toString();
      const sequence = await getCounterForYear(year);
      finalInternalCarNumber = generateInternalCarNumber(year, sequence);
    }
    
    recordData.internalCarNumber = finalInternalCarNumber;
    recordData.createdAt = now;
    recordData.updatedAt = now;
    
    await adminDb.collection(COLLECTION_NAME).add(recordData);
    
    return {
      success: true,
      rowIndex,
      internalCarNumber: finalInternalCarNumber,
      action: 'created',
    };
  } catch (error) {
    return {
      success: false,
      rowIndex,
      action: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rows }: { rows: NormalizedRow[] } = body;
    
    if (!Array.isArray(rows)) {
      return NextResponse.json(
        { error: 'Invalid request body: rows must be an array' },
        { status: 400 }
      );
    }
    
    const results: ImportResult[] = [];
    
    // Process in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((row, idx) => processRow(row, i + idx))
      );
      results.push(...batchResults);
    }
    
    const summary = {
      total: results.length,
      created: results.filter((r) => r.action === 'created').length,
      updated: results.filter((r) => r.action === 'updated').length,
      failed: results.filter((r) => r.action === 'failed').length,
    };
    
    return NextResponse.json({
      success: true,
      results,
      summary,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

