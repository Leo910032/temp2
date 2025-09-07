// app/api/user/contacts/cost-check/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { CostTrackingService } from '../../../../../lib/services/serviceContact/server/costTrackingService';

export async function POST(request) {
  try {
    // Authenticate user using Firebase Admin
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();
    
    const { estimatedCost, requireRuns = 1, feature } = body;

    // Validate input
    if (typeof estimatedCost !== 'number' || estimatedCost < 0) {
      return NextResponse.json(
        { error: 'Valid estimatedCost is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 [Cost Check API] Checking affordability for user ${userId}: ${estimatedCost.toFixed(6)}`);

    // Check if user can afford the operation
    const affordabilityCheck = await CostTrackingService.canAffordOperation(
      userId,
      estimatedCost,
      requireRuns
    );

    console.log(`✅ [Cost Check API] Result: ${affordabilityCheck.canAfford ? 'APPROVED' : 'DENIED'} - ${affordabilityCheck.reason}`);

    return NextResponse.json(affordabilityCheck, { status: 200 });

  } catch (error) {
    console.error('❌ [Cost Check API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to check cost affordability',
        canAfford: false,
        reason: 'system_error'
      },
      { status: 500 }
    );
  }
}