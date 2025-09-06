// app/api/enterprise/teams/[teamId]/members/[memberId]/role/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

// ✅ FIXED: Import all required server services
import { 
  EnterpriseTeamService,
  EnterprisePermissionService,
  EnterpriseSecurityService  // ✅ This was missing - causing the error
} from '@/lib/services/serviceEnterprise/server';

/**
 * PUT /api/enterprise/teams/[teamId]/members/[memberId]/role
 * Update a member's role in the team
 */
export async function PUT(request, { params }) {
  try {
    const { teamId, memberId } = params;
    console.log('🔄 PUT /api/enterprise/teams/' + teamId + '/members/' + memberId + '/role');

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
    const { role } = body;

    // Validate parameters
    if (!teamId || !memberId || !role) {
      return NextResponse.json({ 
        error: 'Team ID, Member ID, and role are required' 
      }, { status: 400 });
    }

    // Validate role
    const validRoles = ['manager', 'team_lead', 'employee'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ 
        error: 'Invalid role. Must be one of: ' + validRoles.join(', ') 
      }, { status: 400 });
    }

    // Check user permissions
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    if (!userContext.organizationId) {
      return NextResponse.json({ 
        error: 'User is not part of any organization' 
      }, { status: 403 });
    }

    // Verify user has management permissions for this team
    if (!userContext.teams[teamId]) {
      return NextResponse.json({ 
        error: 'Access denied to this team' 
      }, { status: 403 });
    }

    const userTeamData = userContext.teams[teamId];
    if (!['manager'].includes(userTeamData.role) && 
        !userTeamData.permissions?.canUpdateMemberRoles &&
        !EnterprisePermissionService.isOrgAdmin(userContext)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to update member roles' 
      }, { status: 403 });
    }

    // Prevent self-role change for managers (to prevent lockout)
    if (userId === memberId && userTeamData.role === 'manager' && role !== 'manager') {
      return NextResponse.json({ 
        error: 'Cannot demote yourself as manager. Transfer management to another user first.' 
      }, { status: 400 });
    }

    console.log('🔍 About to update member role:', {
      userId,
      organizationId: userContext.organizationId,
      teamId,
      memberId,
      newRole: role
    });

    // ✅ This should now work because all services are properly imported
    const result = await EnterpriseTeamService.updateMemberRole(
      userId, 
      userContext.organizationId, 
      teamId, 
      memberId,
      role
    );

    console.log('✅ Member role updated successfully:', result);

    return NextResponse.json({
      success: true,
      message: `Member role updated to ${role} successfully`,
      memberId,
      newRole: role,
      teamId,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error updating member role:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to update member role' 
    }, { status: 500 });
  }
}