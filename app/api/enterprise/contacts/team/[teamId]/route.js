
/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/api/enterprise/contacts/team/[teamId]/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { EnterpriseContactService } from '@/lib/services/serviceEnterprise/server/enterpriseContactService.js';
import { EnterprisePermissionService } from '@/lib/services/serviceEnterprise/server/enterprisePermissionService.js';

/**
/**
 * GET /api/enterprise/contacts/team/[teamId]
 * Get all contacts accessible to a team manager
 */
export async function GET(request, { params }) {
  try {
    const { teamId } = params;
    console.log('📋 GET /api/enterprise/contacts/team/' + teamId);

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Validate teamId
    if (!teamId) {
      return NextResponse.json({ 
        error: 'Team ID is required' 
      }, { status: 400 });
    }

    // Check user permissions
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    // Verify user has access to the team
    if (!userContext.teams[teamId]) {
      return NextResponse.json({ 
        error: 'Access denied to this team' 
      }, { status: 403 });
    }

    const userTeamData = userContext.teams[teamId];
    
    // Check if user can view all team contacts (managers and team leads)
    if (!['manager', 'team_lead'].includes(userTeamData.role) && 
        !userTeamData.permissions?.canViewAllTeamContacts) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to view all team contacts' 
      }, { status: 403 });
    }

    // Get team contacts using the enterprise service
    const result = await EnterpriseContactService.getManagerTeamContacts(userId, teamId);

    console.log('✅ Team contacts retrieved:', {
      teamId,
      contactCount: result.contacts?.length || 0,
      teamMembers: result.teamInfo?.memberCount || 0,
      requestedBy: userId
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Error fetching team contacts:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch team contacts' 
    }, { status: 500 });
  }
}
