// app/api/enterprise/teams/[teamId]/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

// ✅ NEW: Clean imports using the serviceEnterprise alias
import { 
  EnterpriseTeamService,
  EnterprisePermissionService,
  EnterpriseOrganizationService
} from '@serviceEnterprise/server';
/**
 * GET /api/enterprise/teams/[teamId]/members
 * Get all members of a team
 */
export async function GET(request, { params }) {
    try {
        const { teamId } = params;
        console.log('👥 GET /api/enterprise/teams/' + teamId + '/members');

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
        
        if (!userContext.organizationId) {
            return NextResponse.json({ 
                error: 'User is not part of any organization' 
            }, { status: 403 });
        }

        // Verify user has access to this team
        if (!userContext.teams[teamId]) {
            return NextResponse.json({ 
                error: 'Access denied to this team' 
            }, { status: 403 });
        }

        // Get team details including members
        const teamDetails = await EnterpriseTeamService.getTeamDetails(
            userContext.organizationId, 
            teamId
        );

        console.log('✅ Team members retrieved:', {
            teamId,
            memberCount: teamDetails.members?.length || 0,
            requestedBy: userId
        });

        return NextResponse.json({
            success: true,
            teamId,
            teamName: teamDetails.name,
            members: teamDetails.members || [],
            memberCount: teamDetails.members?.length || 0
        });

    } catch (error) {
        console.error('❌ Error fetching team members:', error);
        return NextResponse.json({ 
            error: error.message || 'Failed to fetch team members' 
        }, { status: 500 });
    }
}

/**
 * POST /api/enterprise/teams/[teamId]/members
 * Add a member to the team
 */
export async function POST(request, { params }) {
    try {
        const { teamId } = params;
        console.log('➕ POST /api/enterprise/teams/' + teamId + '/members');

        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;
        
        const { memberUserId, role } = await request.json();
        if (!memberUserId || !role) {
            return NextResponse.json({ 
                error: 'memberUserId and role are required' 
            }, { status: 400 });
        }

        const userContext = await EnterprisePermissionService.getUserContext(userId);
        
        if (!userContext.organizationId) {
            return NextResponse.json({ 
                error: 'User is not part of any organization' 
            }, { status: 403 });
        }

        // Get organization and team data
        const org = await EnterpriseOrganizationService.getOrganizationDetails(userContext.organizationId);
        const teamData = org.teams?.[teamId];
        
        if (!teamData) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }
        
        if (!EnterprisePermissionService.canManageTeamMembers(userContext, {id: teamId, ...teamData})) {
            return NextResponse.json({ 
                error: 'Insufficient permissions to add team members' 
            }, { status: 403 });
        }

        await EnterpriseTeamService.addMemberToTeam(
            userId, 
            userContext.organizationId, 
            teamId, 
            memberUserId, 
            role
        );

        console.log('✅ Member added successfully:', {
            teamId,
            memberUserId,
            role,
            addedBy: userId
        });

        return NextResponse.json({ 
            success: true, 
            message: 'Member added successfully',
            memberUserId,
            role
        }, { status: 201 });

    } catch (error) {
        console.error('❌ Error adding team member:', error);
        return NextResponse.json({ 
            error: error.message || 'Failed to add team member' 
        }, { status: 500 });
    }
}

/**
 * DELETE /api/enterprise/teams/[teamId]/members
 * Remove a member from the team (using memberIdToRemove from request body)
 */
export async function DELETE(request, { params }) {
    try {
        const { teamId } = params;
        console.log('🗑️ DELETE /api/enterprise/teams/' + teamId + '/members');

        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;
        
        const { memberIdToRemove } = await request.json();
        if (!memberIdToRemove) {
            return NextResponse.json({ 
                error: 'memberIdToRemove is required' 
            }, { status: 400 });
        }

        const userContext = await EnterprisePermissionService.getUserContext(userId);
        
        if (!userContext.organizationId) {
            return NextResponse.json({ 
                error: 'User is not part of any organization' 
            }, { status: 403 });
        }

        const org = await EnterpriseOrganizationService.getOrganizationDetails(userContext.organizationId);
        const teamData = org.teams?.[teamId];
        
        if (!teamData) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }
        
        if (!EnterprisePermissionService.canManageTeamMembers(userContext, {id: teamId, ...teamData})) {
            return NextResponse.json({ 
                error: 'Insufficient permissions to remove team members' 
            }, { status: 403 });
        }

        // Prevent self-removal (managers should transfer ownership first)
        if (userId === memberIdToRemove) {
            return NextResponse.json({ 
                error: 'Cannot remove yourself from the team. Transfer management first.' 
            }, { status: 400 });
        }
        
        await EnterpriseTeamService.removeMemberFromTeam(
            userId, 
            userContext.organizationId, 
            teamId, 
            memberIdToRemove
        );

        console.log('✅ Member removed successfully:', {
            teamId,
            memberIdToRemove,
            removedBy: userId
        });
        
        return NextResponse.json({ 
            success: true, 
            message: 'Member removed successfully',
            removedMemberId: memberIdToRemove
        });

    } catch (error) {
        console.error('❌ Error removing team member:', error);
        return NextResponse.json({ 
            error: error.message || 'Failed to remove team member' 
        }, { status: 500 });
    }
}