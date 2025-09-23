
/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/api/enterprise/contacts/shared/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { EnterpriseContactService } from '@/lib/services/serviceEnterprise/server/enterpriseContactService.js';
import { EnterprisePermissionService } from '@/lib/services/serviceEnterprise/server/enterprisePermissionService.js';

/**
 * GET /api/enterprise/contacts/shared
 * Get contacts shared with the current user
 */
export async function GET(request) {
  try {
    console.log('📥 GET /api/enterprise/contacts/shared');

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get optional teamId filter from query params
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    // Check user permissions
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    if (!userContext.organizationId) {
      return NextResponse.json({ 
        error: 'User is not part of any organization' 
      }, { status: 403 });
    }

    // If teamId is specified, verify user has access to that team
    if (teamId && !userContext.teams[teamId]) {
      return NextResponse.json({ 
        error: 'Access denied to the specified team' 
      }, { status: 403 });
    }

    // Get shared contacts using the enterprise service
    const contacts = await EnterpriseContactService.getSharedContacts(userId, teamId);

    console.log('✅ Shared contacts retrieved:', {
      userId,
      teamId,
      contactCount: contacts.length
    });

    return NextResponse.json({
      success: true,
      contacts,
      contactCount: contacts.length,
      teamId,
      userId
    });

  } catch (error) {
    console.error('❌ Error fetching shared contacts:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch shared contacts' 
    }, { status: 500 });
  }
}
