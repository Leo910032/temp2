import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'; // ✅ Make sure adminDb is imported
import { SubscriptionManager } from '@/lib/services/serviceEnterprise/server/core/subscriptionManager';

/**
 * GET /api/enterprise/operations/permissions
 * Get all operation permissions for the current user
 */
export async function GET(request) {
  try {
    console.log('🔍 GET /api/enterprise/operations/permissions (Optimized)');

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log('🔍 Getting operation permissions efficiently for user:', userId);

    // ✅ THE FIX: Fetch user data ONCE and use the optimized internal helpers.
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error(`User not found: ${userId}`);
    }
    const userData = userDoc.data();

    // We need the status object to pass to the permissions helper
    const status = SubscriptionManager._getSubscriptionStatusFromData(userId, userData);
    
    // Now call the fast helper that doesn't make any more DB calls
    const permissions = await SubscriptionManager._getOperationPermissionsFromData(userId, userData, status);

    console.log('✅ Operation permissions retrieved efficiently:', {
      userId,
      permissionCount: Object.keys(permissions.permissions).length
    });

    return NextResponse.json({
      success: true,
      userId,
      timestamp: new Date().toISOString(),
      ...permissions
    });

  } catch (error) {
    console.error('❌ Error getting operation permissions:', error);
    
    if (error.code?.startsWith('auth/')) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Failed to get operation permissions',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/enterprise/operations/permissions/check
 * Check specific operation permissions
 */
export async function POST(request) {
  try {
    console.log('🔍 POST /api/enterprise/operations/permissions/check');

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse request body
    const body = await request.json();
    const { operations, context = {} } = body;

    if (!Array.isArray(operations)) {
      return NextResponse.json({
        error: 'Operations must be an array'
      }, { status: 400 });
    }

    console.log('🔍 Checking specific operations:', { userId, operations });

    // Add request metadata to context
    const enhancedContext = {
      ...context,
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown'
    };

    // Check each operation
    const operationResults = {};
    for (const operation of operations) {
      try {
        const result = await SubscriptionManager.validateEnterpriseOperation(
          userId, 
          operation, 
          enhancedContext
        );
        operationResults[operation] = result;
      } catch (error) {
        operationResults[operation] = {
          allowed: false,
          reason: 'Validation error',
          code: 'VALIDATION_ERROR',
          error: error.message
        };
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      timestamp: new Date().toISOString(),
      operations: operationResults
    });

  } catch (error) {
    console.error('❌ Error checking operation permissions:', error);
    return NextResponse.json({
      error: 'Failed to check operation permissions',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Helper function to get client IP address
 */
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}