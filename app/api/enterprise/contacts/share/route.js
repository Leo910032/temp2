/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/api/enterprise/contacts/share/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { EnterpriseContactService } from '@/lib/services/serviceEnterprise/server/enterpriseContactService.js';
import { EnterprisePermissionService } from '@/lib/services/serviceEnterprise/server/enterprisePermissionService.js';

/**
 * POST /api/enterprise/contacts/share
 * Share contacts with team members
 */
export async function POST(request) {
  try {
    console.log('📤 POST /api/enterprise/contacts/share');

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
    const { teamId, contactIds, options = {} } = body;

    // Validate required fields
    if (!teamId || !contactIds || !Array.isArray(contactIds)) {
      return NextResponse.json({ 
        error: 'teamId and contactIds array are required' 
      }, { status: 400 });
    }

    if (contactIds.length === 0) {
      return NextResponse.json({ 
        error: 'At least one contact ID is required' 
      }, { status: 400 });
    }

    // Check user permissions
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    // Verify user has access to the team and can share contacts
    if (!userContext.teams[teamId]) {
      return NextResponse.json({ 
        error: 'Access denied to this team' 
      }, { status: 403 });
    }

    const userTeamData = userContext.teams[teamId];
    if (!['manager', 'team_lead'].includes(userTeamData.role) && 
        !userTeamData.permissions?.canShareContactsWithTeam) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to share contacts with team' 
      }, { status: 403 });
    }

    // Share contacts using the enterprise service
    const result = await EnterpriseContactService.shareContactsWithTeam(
      userId, 
      contactIds, 
      teamId, 
      options
    );

    console.log('✅ Contacts shared successfully:', {
      teamId,
      contactsShared: result.sharedContacts,
      membersNotified: result.sharedWith
    });

    return NextResponse.json({
      success: true,
      message: `Successfully shared ${result.sharedContacts} contacts with ${result.sharedWith} team members`,
      ...result
    });

  } catch (error) {
    console.error('❌ Error sharing contacts:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to share contacts' 
    }, { status: 500 });
  }
}

