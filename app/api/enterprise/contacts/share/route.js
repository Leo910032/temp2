// app/api/enterprise/contacts/share/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { EnterpriseContactService } from '@/lib/services/enterpriseContactService';
import { EnterprisePermissionService } from '@/lib/services/enterprisePermissionService';

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

// app/api/enterprise/contacts/unshare/route.js
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
      contactId
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