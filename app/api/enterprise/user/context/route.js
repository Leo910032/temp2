// app/api/enterprise/user/context/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { EnterprisePermissionService } from '@serviceEnterprise/server';

export async function GET(request) {
  try {
    console.log('🔍 GET /api/enterprise/user/context');

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log('🔍 FETCHING USER CONTEXT:', userId);

    // Get user context using the permission service
    const userContext = await EnterprisePermissionService.getUserContext(userId);

    if (!userContext) {
      return NextResponse.json({ error: 'User context not found' }, { status: 404 });
    }

    console.log('🔍 API: User context loaded:', {
      userId: userContext.userId,
      organizationId: userContext.organizationId,
      organizationRole: userContext.organizationRole,
      teams: Object.keys(userContext.teams || {})
    });

    return NextResponse.json({ 
      userContext,
      success: true 
    });

  } catch (error) {
    console.error('❌ Error getting user context:', error);
    
    return NextResponse.json({
      error: 'Failed to fetch user context',
      details: error.message
    }, { status: 500 });
  }
}