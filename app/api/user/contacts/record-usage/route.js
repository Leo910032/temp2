// app/api/user/contacts/record-usage/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { CostTrackingService } from '../../../../../lib/services/serviceContact/server/costTracking/costTrackingService';

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
    
    const { cost, model, feature, metadata = {} } = body;

    // Validate input
    if (typeof cost !== 'number' || cost < 0) {
      return NextResponse.json(
        { error: 'Valid cost is required' },
        { status: 400 }
      );
    }

    if (!model || !feature) {
      return NextResponse.json(
        { error: 'Model and feature are required' },
        { status: 400 }
      );
    }

    console.log(`💰 [Record Usage API] Recording usage for user ${userId}: ${cost.toFixed(6)} (${feature})`);

    // Record the usage
    const result = await CostTrackingService.recordUsage(
      userId,
      cost,
      model,
      feature,
      metadata
    );

    console.log(`✅ [Record Usage API] Successfully recorded usage for ${userId}`);

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('❌ [Record Usage API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to record usage',
        success: false
      },
      { status: 500 }
    );
  }
}