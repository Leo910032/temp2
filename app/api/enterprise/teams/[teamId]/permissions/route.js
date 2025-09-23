/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
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
  TEAM_ROLES,
  EMPLOYEE_RESTRICTED_PERMISSIONS 
}from '@/lib/services/constants';

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
/**
 * PUT /api/enterprise/teams/[teamId]/permissions
 * Update team permissions with robust server-side validation.
 */
export async function PUT(request, { params }) {
  try {
    // 1. AUTHENTICATION
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    const { teamId } = params;

    // 2. PARSE AND VALIDATE INPUT
    const body = await request.json();
    const { permissions } = body;
    if (!permissions || typeof permissions !== 'object') {
      return NextResponse.json({ error: 'Invalid permissions data provided' }, { status: 400 });
    }

    // 3. 🛡️ CRITICAL SECURITY CHECK: Enforce Employee Role Restrictions
    const employeePermissions = permissions[TEAM_ROLES.EMPLOYEE];
    if (employeePermissions) {
      // Use the single source of truth from the constants file to check for violations.
      for (const restrictedPerm of EMPLOYEE_RESTRICTED_PERMISSIONS) {
        if (employeePermissions[restrictedPerm] === true) {
          // Log the security attempt and reject the request immediately.
          console.warn(`SECURITY: Blocked attempt by user ${userId} to grant restricted permission '${restrictedPerm}' to an employee on team ${teamId}.`);
          return NextResponse.json({ 
            error: `Employees cannot be granted the permission: ${restrictedPerm}. This is a system-level restriction.` 
          }, { status: 400 });
        }
      }
    }
    
    // 4. CHECK USER'S PERMISSION TO MODIFY
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    if (!userContext.organizationId) {
      return NextResponse.json({ error: 'User is not part of an organization' }, { status: 403 });
    }

    // A user must have the 'CAN_MANAGE_TEAM_SETTINGS' permission to modify the settings.
    const canManage = EnterprisePermissionService.hasPermission(
      userContext, 
      PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS, 
      teamId
    );

    if (!canManage) {
      return NextResponse.json({ 
        error: 'Only organization owners and team managers can modify team permissions' 
      }, { status: 403 });
    }

    // 5. EXECUTE THE UPDATE
    console.log(`User ${userId} is updating permissions for team ${teamId}...`);
    const result = await EnterpriseTeamPermissionService.updateTeamPermissions(
      userId,
      userContext.organizationId, 
      teamId,
      permissions
    );

    // 6. RETURN SUCCESS RESPONSE
    return NextResponse.json({
      success: true,
      message: 'Team permissions updated successfully.',
      teamId,
      // Pass back details from the service if needed
      details: result 
    });

  } catch (error) {
    console.error('❌ Error updating team permissions:', error);
    
    // Provide specific error messages for known issues
    if (error.message.includes('Invalid permissions')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    
    // Generic fallback for all other errors
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}