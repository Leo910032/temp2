// app/api/user/validate-operation/route.js
import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { validateUserOperation } from '@/lib/services/server/subscriptionService';

export async function POST(request) {
  try {
    // Get user session
    const session = await createApiSession(request);
    
    // Parse request body
    const { operation, context = {} } = await request.json();
    
    if (!operation) {
      return NextResponse.json(
        { error: 'Operation is required' }, 
        { status: 400 }
      );
    }

    // Validate the operation using the unified service
    const validationResult = await validateUserOperation(session.userId, operation, context);

    return NextResponse.json({
      allowed: validationResult.allowed,
      reason: validationResult.reason,
      subscriptionLevel: validationResult.subscriptionLevel,
      requiredUpgrade: validationResult.requiredUpgrade
    });

  } catch (error) {
    console.error("Error in POST /api/user/validate-operation:", error.message);
    const status = error.message.includes('Authorization') ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
