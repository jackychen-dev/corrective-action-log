import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { BulkUpdatePatch, BulkUpdateResult } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

const COLLECTION_NAME = 'correctiveActions';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { patches }: { patches: BulkUpdatePatch[] } = body;
    
    if (!Array.isArray(patches)) {
      return NextResponse.json(
        { error: 'Invalid request body: patches must be an array' },
        { status: 400 }
      );
    }
    
    const results: BulkUpdateResult[] = [];
    
    for (const patch of patches) {
      try {
        const ref = adminDb.doc(`${COLLECTION_NAME}/${patch.id}`);
        const docSnap = await ref.get();
        
        if (!docSnap.exists) {
          results.push({
            success: false,
            id: patch.id,
            error: 'Record not found',
          });
          continue;
        }
        
        // Check for conflicts if expectedUpdatedAt is provided
        if (patch.expectedUpdatedAt) {
          const currentUpdatedAt = docSnap.data()?.updatedAt;
          if (currentUpdatedAt) {
            const currentTime = currentUpdatedAt.toMillis?.() || currentUpdatedAt.toDate?.().getTime() || 0;
            const expectedTime = new Date(patch.expectedUpdatedAt).getTime();
            
            if (currentTime > expectedTime) {
              results.push({
                success: false,
                id: patch.id,
                conflict: true,
                error: 'Record was modified by another user',
              });
              continue;
            }
          }
        }
        
        // Convert date strings to Firestore Timestamps
        const updateData: any = { ...patch.changes };
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
        
        await ref.update(updateData);
        
        results.push({
          success: true,
          id: patch.id,
        });
      } catch (error) {
        results.push({
          success: false,
          id: patch.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    const conflicts = results.filter((r) => r.conflict);
    
    return NextResponse.json({
      success: true,
      results,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

