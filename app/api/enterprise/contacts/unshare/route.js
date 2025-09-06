// app/api/enterprise/contacts/unshare/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { EnterpriseContactService } from '@/lib/services/enterpriseContactService';
import { EnterprisePermissionService } from '@/lib/services/enterprisePermissionService';

/**
 * POST /api/enterprise/contacts/unshare
 * Remove contact sharing from team
 */
export async function POST(request) {
  try {
    console.log('🗑️ POST /api/enterprise/contacts/unshare');

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse request body
    const body = await request.json();
    const { teamId, contactId } = body;

    // Validate required fields
    if (!teamId || !contactId) {
      return NextResponse.json({ 
        error: 'teamId and contactId are required' 
      }, { status: 400 });
    }

    // Check user permissions
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    if (!userContext.organizationId) {
      return NextResponse.json({ 
        error: 'User is not part of any organization' 
      }, { status: 403 });
    }

    // Verify user has access to the team
    if (!userContext.teams[teamId]) {
      return NextResponse.json({ 
        error: 'Access denied to this team' 
      }, { status: 403 });
    }

    const userTeamData = userContext.teams[teamId];
    if (!['manager', 'team_lead'].includes(userTeamData.role) && 
        !userTeamData.permissions?.canShareContactsWithTeam) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to manage contact sharing' 
      }, { status: 403 });
    }

    // Remove contact sharing
    const result = await EnterpriseContactService.removeContactSharing(
      userId, 
      contactId, 
      teamId
    );

    console.log('✅ Contact sharing removed successfully:', {
      teamId,
      contactId,
      removedBy: userId
    });

    return NextResponse.json({
      success: true,
      message: 'Contact sharing removed successfully',
      ...result
    });

  } catch (error) {
    console.error('❌ Error removing contact sharing:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to remove contact sharing' 
    }, { status: 500 });
  }
}
