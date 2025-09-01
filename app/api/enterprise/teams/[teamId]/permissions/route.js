// app/api/enterprise/teams/[teamId]/permissions/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { 
  EnterpriseTeamPermissionService 
} from '@/lib/services/serviceEnterprise/server/enterpriseTeamPermissionService';
import { 
  EnterprisePermissionService 
} from '@/lib/services/serviceEnterprise/server/enterprisePermissionService';
import { 
  PERMISSIONS, 
  TEAM_ROLES 
} from '@/lib/services/serviceEnterprise/constants/enterpriseConstants';

/**
 * GET /api/enterprise/teams/[teamId]/permissions
 * Get team permissions
 */
export async function GET(request, { params }) {
  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    const teamId = params.teamId;

    console.log('Getting team permissions:', { userId, teamId });

    // Get user context to determine organization
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    if (!userContext.organizationId) {
      return NextResponse.json({ 
        error: 'User is not part of an organization' 
      }, { status: 403 });
    }

    // ✅ FIX: Check for EITHER permission, not just manage settings
    const canManageSettings = EnterprisePermissionService.hasPermission(
      userContext, 
      PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS, 
      teamId
    );
    
    const canViewAnalytics = EnterprisePermissionService.hasPermission(
      userContext,
      PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS,
      teamId
    );
    
    // ✅ FIX: Allow access if user has EITHER permission
    if (!canManageSettings && !canViewAnalytics) {
      console.log('Permission check failed:', {
        userId,
        teamId,
        canManageSettings,
        canViewAnalytics,
        userRole: EnterprisePermissionService.getUserTeamRole(userContext, teamId),
        teamData: userContext.teams?.[teamId]
      });
      
      return NextResponse.json({ 
        error: 'Insufficient permissions to view team permissions. You need either CAN_MANAGE_TEAM_SETTINGS or CAN_VIEW_TEAM_ANALYTICS permission.' 
      }, { status: 403 });
    }

    console.log('Permission check passed:', {
      userId,
      teamId,
      canManageSettings,
      canViewAnalytics,
      accessGranted: true
    });

    // Get team permissions (this part is now correctly protected)
    const permissions = await EnterpriseTeamPermissionService.getTeamPermissions(
      userContext.organizationId, 
      teamId
    );

    return NextResponse.json({
      success: true,
      permissions,
      teamId,
      // Include user's access level for client-side UI decisions
      userAccess: {
        canManageSettings,
        canViewAnalytics,
        canModify: canManageSettings, // Only managers can modify
        canView: canManageSettings || canViewAnalytics
      }
    });

  } catch (error) {
    console.error('Error getting team permissions:', error);
    
    if (error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * PUT /api/enterprise/teams/[teamId]/permissions
 * Update team permissions
 */
export async function PUT(request, { params }) {
  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    const teamId = params.teamId;

    // Parse request body
    const body = await request.json();
    const { permissions } = body;

    if (!permissions || typeof permissions !== 'object') {
      return NextResponse.json({ 
        error: 'Invalid permissions data' 
      }, { status: 400 });
    }

    // ✅ VALIDATION: Ensure employee permissions are not granted restricted permissions
    const employeePermissions = permissions[TEAM_ROLES.EMPLOYEE];
    if (employeePermissions) {
      const restrictedPermissions = [
        PERMISSIONS.CAN_INVITE_TEAM_MEMBERS,
        PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS,
        PERMISSIONS.CAN_UPDATE_MEMBER_ROLES,
        PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS,
        PERMISSIONS.CAN_CREATE_TEAMS,
        PERMISSIONS.CAN_DELETE_TEAMS,
        PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM,
        PERMISSIONS.CAN_EDIT_TEAM_CONTACTS
      ];
      
      for (const restrictedPerm of restrictedPermissions) {
        if (employeePermissions[restrictedPerm] === true) {
          return NextResponse.json({ 
            error: `Employees cannot be granted the permission: ${restrictedPerm}. This is a system-level restriction.` 
          }, { status: 400 });
        }
      }
    }

    console.log('Updating team permissions:', { userId, teamId, permissions });

    // Get user context to determine organization
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    if (!userContext.organizationId) {
      return NextResponse.json({ 
        error: 'User is not part of an organization' 
      }, { status: 403 });
    }

    // ✅ FIX: For MODIFY operations, only check CAN_MANAGE_TEAM_SETTINGS
    const canManage = EnterprisePermissionService.hasPermission(
      userContext, 
      PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS, 
      teamId
    );

    // Additional check: only organization owners and team managers can modify permissions
    const isOrgOwner = userContext.organizationRole === 'owner';
    const isTeamManager = EnterprisePermissionService.getUserTeamRole(userContext, teamId) === 'manager';

    if (!canManage && !isOrgOwner && !isTeamManager) {
      return NextResponse.json({ 
        error: 'Only organization owners and team managers can modify team permissions' 
      }, { status: 403 });
    }

    // Update team permissions
    const result = await EnterpriseTeamPermissionService.updateTeamPermissions(
      userId,
      userContext.organizationId, 
      teamId,
      permissions
    );

    return NextResponse.json({
      success: true,
      message: result.employeeRestrictionsEnforced 
        ? 'Team permissions updated successfully. Employee permissions were automatically adjusted to comply with role restrictions.'
        : 'Team permissions updated successfully',
      teamId,
      result,
      employeeRestrictionsEnforced: result.employeeRestrictionsEnforced || false
    });

  } catch (error) {
    console.error('Error updating team permissions:', error);
    
    if (error.message.includes('Employees cannot have permission')) {
      return NextResponse.json({ 
        error: error.message + ' This restriction is enforced at the system level.'
      }, { status: 400 });
    }
    
    if (error.message.includes('Invalid permissions')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    if (error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}