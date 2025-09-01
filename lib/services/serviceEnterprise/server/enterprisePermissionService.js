// lib/services/serviceEnterprise/server/enterprisePermissionService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { 
  ORGANIZATION_ROLES, 
  TEAM_ROLES, 
  PERMISSIONS,
  DEFAULT_PERMISSIONS_BY_ROLE,
  TEAM_ROLE_HIERARCHY
} from '@/lib/services/serviceEnterprise/constants/enterpriseConstants';

export class EnterprisePermissionService {

  /**
   * ✅ RESTORED: Get user context from database
   */
  static async getUserContext(userId) {
    console.log('🔍 FETCHING USER CONTEXT:', userId);
    
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) throw new Error('User not found');
    
    const userData = userDoc.data();
    const enterprise = userData.enterprise || {};
    
    console.log('📊 USER CONTEXT DATA:', {
        userId,
        hasEnterprise: !!enterprise,
        organizationId: enterprise.organizationId,
        organizationRole: enterprise.organizationRole,
        teams: Object.keys(enterprise.teams || {}),
        teamsData: enterprise.teams
    });
    
    return {
        userId,
        userData,
        isSystemAdmin: userData.isAdmin === true,
        enterprise,
        organizationId: enterprise.organizationId,
        organizationRole: enterprise.organizationRole,
        teams: enterprise.teams || {}
    };
  }

  /**
   * ✅ Check if user is organization admin
   */
  static isOrgAdmin(userContext) {
    return [ORGANIZATION_ROLES.OWNER, ORGANIZATION_ROLES.MANAGER].includes(userContext.organizationRole);
  }

  /**
   * ✅ Get user's effective role for a specific team
   */
  static getUserTeamRole(userContext, teamId) {
    // Check if user is organization owner (has all permissions)
    if (userContext.organizationRole === ORGANIZATION_ROLES.OWNER) {
      return TEAM_ROLES.OWNER;
    }
    
    // Get team-specific role
    const teamData = userContext.teams?.[teamId];
    return teamData?.role || TEAM_ROLES.EMPLOYEE;
  }

  /**
   * ✅ Get user's highest role across all teams
   */
  static getUserHighestRole(userContext) {
    // Organization owner always has highest role
    if (userContext.organizationRole === ORGANIZATION_ROLES.OWNER) {
      return TEAM_ROLES.OWNER;
    }
    
    // Find highest team role
    const teamRoles = Object.values(userContext.teams || {}).map(team => team.role);
    
    if (teamRoles.length === 0) {
      return TEAM_ROLES.EMPLOYEE;
    }
    
    // Return the highest role based on hierarchy
    return teamRoles.reduce((highest, current) => {
      const currentLevel = TEAM_ROLE_HIERARCHY[current] || 0;
      const highestLevel = TEAM_ROLE_HIERARCHY[highest] || 0;
      return currentLevel > highestLevel ? current : highest;
    }, TEAM_ROLES.EMPLOYEE);
  }

  /**
   * ✅ Check if user has a specific permission for a team
   */
  static hasPermission(userContext, permission, teamId = null) {
    // Get effective role for this team
    const effectiveRole = teamId 
      ? this.getUserTeamRole(userContext, teamId)
      : this.getUserHighestRole(userContext);
    
    // Get custom permissions for this team (if any)
    const teamData = userContext.teams?.[teamId];
    const customPermissions = teamData?.permissions || {};
    
    // Check custom permission first, then fall back to role defaults
    if (customPermissions.hasOwnProperty(permission)) {
      return customPermissions[permission];
    }
    
    // Fall back to default role permissions
    const rolePermissions = DEFAULT_PERMISSIONS_BY_ROLE[effectiveRole] || {};
    return rolePermissions[permission] || false;
  }
    /**
   * ✅ NEW: Check if one user's role is high enough to manage another.
   * Compares the hierarchical level of two roles.
   * @param {string} managerRole The role of the person trying to view.
   * @param {string} targetRole The role of the person being viewed.
   * @returns {boolean} True if manager's role is >= target's role.
   */
  static canManageRole(managerRole, targetRole) {
    const managerLevel = TEAM_ROLE_HIERARCHY[managerRole] || 0;
    const targetLevel = TEAM_ROLE_HIERARCHY[targetRole] || 0;

    // A user can manage (view stats of) anyone at or below their own level.
    return managerLevel >= targetLevel;
  }

  /**
   * ✅ LEGACY: Check if user can manage team (for backward compatibility)
   */
  static canManageTeam(userContext, teamData) {
    if (this.isOrgAdmin(userContext)) return true;
    
    const teamId = teamData.id || teamData;
    return this.hasPermission(userContext, PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS, teamId);
  }
  
  /**
   * ✅ LEGACY: Check if user can manage team members (for backward compatibility)
   */
  static canManageTeamMembers(userContext, teamData) {
    if (this.isOrgAdmin(userContext)) return true;
    
    const teamId = teamData.id || teamData;
    return this.hasPermission(userContext, PERMISSIONS.CAN_INVITE_TEAM_MEMBERS, teamId);
  }

  /**
   * ✅ Check if user can view audit logs
   */
  static canViewAuditLogs(userContext) {
    return this.isOrgAdmin(userContext);
  }

  /**
   * ✅ NEW: Permission-specific helper methods
   */
  static canInviteMembers(userContext, teamId = null) {
    return this.hasPermission(userContext, PERMISSIONS.CAN_INVITE_TEAM_MEMBERS, teamId);
  }

  static canRemoveMembers(userContext, teamId = null) {
    return this.hasPermission(userContext, PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS, teamId);
  }

  static canUpdateMemberRoles(userContext, teamId = null) {
    return this.hasPermission(userContext, PERMISSIONS.CAN_UPDATE_MEMBER_ROLES, teamId);
  }

  static canCreateTeams(userContext) {
    return this.hasPermission(userContext, PERMISSIONS.CAN_CREATE_TEAMS);
  }

  static canDeleteTeams(userContext, teamId = null) {
    return this.hasPermission(userContext, PERMISSIONS.CAN_DELETE_TEAMS, teamId);
  }

  static canManageInvitations(userContext, teamId = null) {
    return this.hasPermission(userContext, PERMISSIONS.CAN_REVOKE_INVITATIONS, teamId) ||
           this.hasPermission(userContext, PERMISSIONS.CAN_RESEND_INVITATIONS, teamId);
  }

  /**
   * ✅ NEW: Get available roles that a user can assign (can't assign higher than their own)
   */
  static getAssignableRoles(userContext, teamId) {
    const userRole = this.getUserTeamRole(userContext, teamId);
    const userLevel = TEAM_ROLE_HIERARCHY[userRole] || 0;
    
    return Object.keys(TEAM_ROLE_HIERARCHY).filter(role => {
      const roleLevel = TEAM_ROLE_HIERARCHY[role];
      return roleLevel < userLevel; // Can only assign roles lower than their own
    });
  }

  /**
   * ✅ NEW: Validate role assignment
   */
  static canAssignRole(userContext, targetRole, teamId) {
    const userRole = this.getUserTeamRole(userContext, teamId);
    const userLevel = TEAM_ROLE_HIERARCHY[userRole] || 0;
    const targetLevel = TEAM_ROLE_HIERARCHY[targetRole] || 0;
    
    // Can only assign roles lower than your own level
    return userLevel > targetLevel;
  }

  /**
   * ✅ NEW: Validate team action permissions
   */
  static validateTeamAction(userContext, action, teamId, targetUserId = null) {
    const userRole = this.getUserTeamRole(userContext, teamId);
    
    // Prevent users from acting on themselves in certain cases
    if (targetUserId === userContext.userId) {
      if (['remove_member', 'update_role'].includes(action)) {
        return {
          allowed: false,
          reason: 'Cannot perform this action on yourself'
        };
      }
    }
    
    // Check if user has permission for the action
    const permissionMap = {
      'remove_member': PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS,
      'update_role': PERMISSIONS.CAN_UPDATE_MEMBER_ROLES,
      'invite_member': PERMISSIONS.CAN_INVITE_TEAM_MEMBERS,
      'manage_settings': PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS
    };
    
    const requiredPermission = permissionMap[action];
    if (requiredPermission && !this.hasPermission(userContext, requiredPermission, teamId)) {
      return {
        allowed: false,
        reason: 'Insufficient permissions'
      };
    }
    
    return {
      allowed: true,
      reason: null
    };
  }

  /**
   * ✅ NEW: Get permission summary for a user in a specific team
   */
  static getTeamPermissionSummary(userContext, teamId) {
    const effectiveRole = this.getUserTeamRole(userContext, teamId);
    const teamData = userContext.teams?.[teamId];
    
    return {
      role: effectiveRole,
      isOwner: effectiveRole === TEAM_ROLES.OWNER,
      isManager: effectiveRole === TEAM_ROLES.MANAGER,
      isTeamLead: effectiveRole === TEAM_ROLES.TEAM_LEAD,
      isEmployee: effectiveRole === TEAM_ROLES.EMPLOYEE,
      customPermissions: teamData?.permissions || {},
      permissions: {
        canManageTeam: this.hasPermission(userContext, PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS, teamId),
        canInviteMembers: this.canInviteMembers(userContext, teamId),
        canRemoveMembers: this.canRemoveMembers(userContext, teamId),
        canUpdateRoles: this.canUpdateMemberRoles(userContext, teamId),
        canManageInvitations: this.canManageInvitations(userContext, teamId),
        canDeleteTeam: this.canDeleteTeams(userContext, teamId)
      }
    };
  }
}

// ✅ EXPORT FUNCTIONS NEEDED BY THE IMPERSONATION API
/**
 * Validate that a user has specific permission for a team
 */
export async function validateTeamPermission(userId, teamId, permission) {
  try {
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    return EnterprisePermissionService.hasPermission(userContext, permission, teamId);
  } catch (error) {
    console.error('Error validating team permission:', error);
    return false;
  }
}

/**
 * Check if a user is a member of a specific team
 */
export async function checkUserTeamMembership(userId, teamId) {
  try {
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    return userContext.teams && userContext.teams[teamId] !== undefined;
  } catch (error) {
    console.error('Error checking team membership:', error);
    return false;
  }
}

/**
 * Get user's role in a specific team
 */
export async function getUserTeamRole(userId, teamId) {
  try {
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    return EnterprisePermissionService.getUserTeamRole(userContext, teamId);
  } catch (error) {
    console.error('Error getting user team role:', error);
    return null;
  }
}

/**
 * Check if user can perform a specific action on a team
 */
export async function validateTeamAction(userId, action, teamId, targetUserId = null) {
  try {
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    return EnterprisePermissionService.validateTeamAction(userContext, action, teamId, targetUserId);
  } catch (error) {
    console.error('Error validating team action:', error);
    return { allowed: false, reason: 'System error' };
  }
}