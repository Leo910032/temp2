// app/api/enterprise/invitations/bulk/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { EnterpriseInvitationService } from '@/lib/services/serviceEnterprise/server/enterpriseInvitationService';
import { EnterprisePermissionService } from '@/lib/services/serviceEnterprise/server/enterprisePermissionService';

// PATCH method for bulk resending invitations
export async function PATCH(request) {
  try {
    console.log('🔄 PATCH /api/enterprise/invitations/bulk');

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
    const { invitationIds, action } = body;

    if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
      return NextResponse.json({ 
        error: 'Invitation IDs array is required' 
      }, { status: 400 });
    }

    if (!action || action !== 'resend') {
      return NextResponse.json({ 
        error: 'Invalid action. Only "resend" is supported.' 
      }, { status: 400 });
    }

    // Check user permissions
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    if (!userContext.organizationId) {
      return NextResponse.json({ 
        error: 'User is not part of any organization' 
      }, { status: 403 });
    }

    // Validate user has permission to manage invitations
    const hasGlobalPermission = EnterprisePermissionService.isOrgAdmin(userContext) ||
                                userContext.organizationRole === 'manager';

    if (!hasGlobalPermission) {
      // Check if user has permission for all teams involved
      const invitations = await Promise.all(
        invitationIds.map(id => EnterpriseInvitationService.getInvitationById(id))
      );

      const invalidInvitations = invitations.filter(inv => !inv);
      if (invalidInvitations.length > 0) {
        return NextResponse.json({ 
          error: 'Some invitations not found' 
        }, { status: 404 });
      }

      const teamIds = [...new Set(invitations.map(inv => inv.teamId))];
      const unauthorizedTeams = teamIds.filter(teamId => {
        const userTeamData = userContext.teams[teamId];
        return !userTeamData || 
               (!['manager', 'team_lead'].includes(userTeamData.role) && 
                !userTeamData.permissions?.canInviteTeamMembers);
      });

      if (unauthorizedTeams.length > 0) {
        return NextResponse.json({ 
          error: 'Insufficient permissions for some teams' 
        }, { status: 403 });
      }
    }

    // Perform bulk resend
    const results = await EnterpriseInvitationService.bulkResendInvitations(invitationIds, userId);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log('✅ Bulk invitation resend completed:', {
      total: invitationIds.length,
      successful: successCount,
      failed: failureCount
    });

    return NextResponse.json({
      success: true,
      message: `${successCount} invitations resent successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      results,
      summary: {
        total: invitationIds.length,
        successful: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    console.error('❌ Error bulk resending invitations:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to bulk resend invitations' 
    }, { status: 500 });
  }
}

// DELETE method for bulk revoking invitations
export async function DELETE(request) {
  try {
    console.log('🚫 DELETE /api/enterprise/invitations/bulk');

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
    const { invitationIds } = body;

    if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
      return NextResponse.json({ 
        error: 'Invitation IDs array is required' 
      }, { status: 400 });
    }

    // Check user permissions
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    if (!userContext.organizationId) {
      return NextResponse.json({ 
        error: 'User is not part of any organization' 
      }, { status: 403 });
    }

    // Validate user has permission to manage invitations
    const hasGlobalPermission = EnterprisePermissionService.isOrgAdmin(userContext) ||
                                userContext.organizationRole === 'manager';

    if (!hasGlobalPermission) {
      // Check if user has permission for all teams involved
      const invitations = await Promise.all(
        invitationIds.map(id => EnterpriseInvitationService.getInvitationById(id))
      );

      const invalidInvitations = invitations.filter(inv => !inv);
      if (invalidInvitations.length > 0) {
        return NextResponse.json({ 
          error: 'Some invitations not found' 
        }, { status: 404 });
      }

      const teamIds = [...new Set(invitations.map(inv => inv.teamId))];
      const unauthorizedTeams = teamIds.filter(teamId => {
        const userTeamData = userContext.teams[teamId];
        return !userTeamData || 
               (!['manager', 'team_lead'].includes(userTeamData.role) && 
                !userTeamData.permissions?.canInviteTeamMembers);
      });

      if (unauthorizedTeams.length > 0) {
        return NextResponse.json({ 
          error: 'Insufficient permissions for some teams' 
        }, { status: 403 });
      }
    }

    // Perform bulk revoke
    const results = await EnterpriseInvitationService.bulkRevokeInvitations(
      invitationIds, 
      userId, 
      userContext.organizationId
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log('✅ Bulk invitation revoke completed:', {
      total: invitationIds.length,
      successful: successCount,
      failed: failureCount
    });

    return NextResponse.json({
      success: true,
      message: `${successCount} invitations revoked successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      results,
      summary: {
        total: invitationIds.length,
        successful: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    console.error('❌ Error bulk revoking invitations:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to bulk revoke invitations' 
    }, { status: 500 });
  }
}