// app/api/enterprise/invitations/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { EnterpriseInvitationService } from '@/lib/services/serviceEnterprise/server/enterpriseInvitationService';
import { EnterprisePermissionService } from '@/lib/services/serviceEnterprise/server/enterprisePermissionService';

export async function POST(request) {
  try {
    console.log('📧 POST /api/enterprise/invitations');
    
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
    console.log('📧 Invitation request body:', body);
    
    const { teamId, invitedEmail, role } = body;

    // Validate required fields
    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }
    
    if (!invitedEmail || !invitedEmail.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    
    if (!role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(invitedEmail.trim())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate role
    const validRoles = ['employee', 'team_lead', 'manager'];
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

    // Verify user has access to this team and can invite members
    if (!userContext.teams[teamId]) {
      return NextResponse.json({ 
        error: 'Access denied to this team' 
      }, { status: 403 });
    }

    const userTeamData = userContext.teams[teamId];
    if (!['manager', 'team_lead'].includes(userTeamData.role) && 
        !userTeamData.permissions?.canInviteTeamMembers &&
        !EnterprisePermissionService.isOrgAdmin(userContext)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to invite team members' 
      }, { status: 403 });
    }

    console.log('📧 Creating invitation:', {
      inviterId: userId,
      organizationId: userContext.organizationId,
      teamId,
      invitedEmail: invitedEmail.trim(),
      role
    });

    // Create the invitation using the enterprise service
    const invitation = await EnterpriseInvitationService.createInvitation(
      userId, 
      userContext.organizationId, 
      teamId, 
      invitedEmail.trim(), 
      role
    );

    console.log('✅ Invitation created successfully:', invitation.id);

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        invitedEmail: invitation.invitedEmail,
        role: invitation.role,
        teamId: invitation.teamId,
        inviteCode: invitation.inviteCode,
        expiresAt: invitation.expiresAt
      }
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating invitation:', error);

    // ✅ Handle specific error cases with proper HTTP status codes
    if (error.message.includes('Pending invitation already exists')) {
      return NextResponse.json({ 
        error: 'This email already has a pending invitation to this team. Please revoke the existing invitation first or ask the user to check their email.',
        code: 'INVITATION_EXISTS'
      }, { status: 409 }); // 409 Conflict
    }

    if (error.message.includes('not found')) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 404 });
    }

    if (error.message.includes('permission') || error.message.includes('access')) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 403 });
    }

    // Generic server error
    return NextResponse.json({ 
      error: error.message || 'Failed to create invitation' 
    }, { status: 500 });
  }
}

// Replace the entire GET handler with this new, more flexible version
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const teamId = url.searchParams.get('teamId');
    
    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;

    let invitations;

    // ✅ THE FIX: Differentiate between fetching for a team vs. for a user
    if (teamId) {
      // --- LOGIC FOR FETCHING TEAM-SPECIFIC INVITATIONS (Manager View) ---
      console.log('📨 GET /api/enterprise/invitations (for Team)');
      const userContext = await EnterprisePermissionService.getUserContext(userId);
      if (!userContext.teams[teamId]) {
        return NextResponse.json({ error: 'Access denied to this team' }, { status: 403 });
      }
      invitations = await EnterpriseInvitationService.getInvitationsForTeam(teamId);
      console.log('✅ Team invitations fetched:', { teamId, count: invitations.length });

      return NextResponse.json({
        success: true,
        invitations,
        teamId
      });

    } else {
      // --- LOGIC FOR FETCHING USER'S OWN INVITATIONS (Banner View) ---
      console.log('📨 GET /api/enterprise/invitations (for User)');
       if (!userEmail) {
            return NextResponse.json({ error: 'User email not found in token' }, { status: 400 });
        }
      invitations = await EnterpriseInvitationService.getInvitationsForUser(userEmail);
      console.log('✅ User invitations fetched:', { userEmail, count: invitations.length });
      
      // We need to enhance this data for the banner
      const enhancedInvitations = await EnterpriseInvitationService.enhanceInvitations(invitations);
      return NextResponse.json(enhancedInvitations);
    }

  } catch (error) {
    console.error('❌ Error fetching invitations:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch invitations' 
    }, { status: 500 });
  }
}

// ✅ NEW: PATCH method for resending invitations
export async function PATCH(request) {
  try {
    console.log('🔄 PATCH /api/enterprise/invitations');

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
    const { invitationId, action } = body;

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    if (!action || action !== 'resend') {
      return NextResponse.json({ error: 'Invalid action. Only "resend" is supported.' }, { status: 400 });
    }

    // Get invitation details first
    const invitation = await EnterpriseInvitationService.getInvitationById(invitationId);
    
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check permissions
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    if (userContext.organizationId !== invitation.organizationId) {
      return NextResponse.json({ 
        error: 'Access denied to this invitation' 
      }, { status: 403 });
    }

    // Verify user has permission to manage invitations for this team
    if (!userContext.teams[invitation.teamId]) {
      return NextResponse.json({ 
        error: 'Access denied to this team' 
      }, { status: 403 });
    }

    const userTeamData = userContext.teams[invitation.teamId];
    if (!['manager', 'team_lead'].includes(userTeamData.role) && 
        !userTeamData.permissions?.canInviteTeamMembers &&
        !EnterprisePermissionService.isOrgAdmin(userContext)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to resend invitations' 
      }, { status: 403 });
    }

    // Resend the invitation
    const result = await EnterpriseInvitationService.resendInvitation(invitationId, userId);

    console.log('✅ Invitation resent successfully:', invitationId);

    return NextResponse.json({
      success: true,
      message: `Invitation resent to ${invitation.invitedEmail}`,
      invitation: {
        id: invitationId,
        inviteCode: result.inviteCode,
        expiresAt: result.expiresAt,
        resentCount: result.resentCount
      }
    });

  } catch (error) {
    console.error('❌ Error resending invitation:', error);

    // Handle specific error cases
    if (error.message.includes('not found')) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 404 });
    }

    if (error.message.includes('Cannot resend') || error.message.includes('Maximum resend limit')) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 400 });
    }

    if (error.message.includes('permission') || error.message.includes('access')) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 403 });
    }

    return NextResponse.json({ 
      error: error.message || 'Failed to resend invitation' 
    }, { status: 500 });
  }
}

// DELETE method for revoking invitations
export async function DELETE(request) {
  try {
    console.log('🚫 DELETE /api/enterprise/invitations');

    const url = new URL(request.url);
    const invitationId = url.searchParams.get('invitationId');
    
    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get invitation details first
    const invitation = await EnterpriseInvitationService.getInvitationById(invitationId);
    
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check permissions
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    if (userContext.organizationId !== invitation.organizationId) {
      return NextResponse.json({ 
        error: 'Access denied to this invitation' 
      }, { status: 403 });
    }

    // Verify user has permission to manage invitations for this team
    if (!userContext.teams[invitation.teamId]) {
      return NextResponse.json({ 
        error: 'Access denied to this team' 
      }, { status: 403 });
    }

    const userTeamData = userContext.teams[invitation.teamId];
    if (!['manager', 'team_lead'].includes(userTeamData.role) && 
        !userTeamData.permissions?.canInviteTeamMembers &&
        !EnterprisePermissionService.isOrgAdmin(userContext)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to revoke invitations' 
      }, { status: 403 });
    }

    // Revoke the invitation
    await EnterpriseInvitationService.revokeInvitation(
      userId, 
      userContext.organizationId, 
      invitationId, 
      invitation.teamId
    );

    console.log('✅ Invitation revoked successfully:', invitationId);

    return NextResponse.json({
      success: true,
      message: 'Invitation revoked successfully'
    });

  } catch (error) {
    console.error('❌ Error revoking invitation:', error);

    if (error.message.includes('not found')) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 404 });
    }

    if (error.message.includes('Cannot revoke')) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 400 });
    }

    if (error.message.includes('permission') || error.message.includes('access')) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 403 });
    }

    return NextResponse.json({ 
      error: error.message || 'Failed to revoke invitation' 
    }, { status: 500 });
  }
}