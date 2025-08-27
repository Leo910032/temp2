//lib/services/serviceEnterprise/constants/enterpriseConstants.js

/**
 * Defines the roles within an organization.
 */
export const ORGANIZATION_ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  EMPLOYEE: 'employee'
};

/**
 * Defines the roles within a specific team.
 */
export const TEAM_ROLES = {
  OWNER: 'owner',      // ✅ Added OWNER for team context
  MANAGER: 'manager',
  TEAM_LEAD: 'team_lead',
  EMPLOYEE: 'employee'
};

/**
 * Defines all possible granular permissions for a user.
 */
export const PERMISSIONS = {
  CAN_VIEW_ALL_TEAM_CONTACTS: 'canViewAllTeamContacts',
  CAN_EDIT_TEAM_CONTACTS: 'canEditTeamContacts',
  CAN_SHARE_CONTACTS_WITH_TEAM: 'canShareContactsWithTeam',
  CAN_EXPORT_TEAM_DATA: 'canExportTeamData',
  CAN_INVITE_TEAM_MEMBERS: 'canInviteTeamMembers',
  
  // ✅ Additional permissions for team management
  CAN_CREATE_TEAMS: 'canCreateTeams',
  CAN_DELETE_TEAMS: 'canDeleteTeams',
  CAN_MANAGE_TEAM_SETTINGS: 'canManageTeamSettings',
  CAN_REMOVE_TEAM_MEMBERS: 'canRemoveTeamMembers',
  CAN_UPDATE_MEMBER_ROLES: 'canUpdateMemberRoles',
  CAN_REVOKE_INVITATIONS: 'canRevokeInvitations',
  CAN_RESEND_INVITATIONS: 'canResendInvitations',
  CAN_VIEW_TEAM_ANALYTICS: 'canViewTeamAnalytics'
};

/**
 * Statuses for team invitations.
 */
export const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REVOKED: 'revoked'
};

/**
 * Team role hierarchy (higher number = more permissions)
 */
export const TEAM_ROLE_HIERARCHY = {
  [TEAM_ROLES.EMPLOYEE]: 1,
  [TEAM_ROLES.TEAM_LEAD]: 2, 
  [TEAM_ROLES.MANAGER]: 3,
  [TEAM_ROLES.OWNER]: 4
};

/**
 * Default permissions for each team role.
 */
export const DEFAULT_PERMISSIONS_BY_ROLE = {
  [TEAM_ROLES.EMPLOYEE]: {
    // Allowed permissions for employees
    [PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_EXPORT_TEAM_DATA]: false, // Optional - can be granted
    [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: false, // Optional - can be granted
    
    
    // RESTRICTED permissions - employees can NEVER have these
    [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: false, // RESTRICTED
    [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: false, // RESTRICTED
    [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: false, // RESTRICTED
    [PERMISSIONS.CAN_CREATE_TEAMS]: false, // RESTRICTED
    [PERMISSIONS.CAN_DELETE_TEAMS]: false, // RESTRICTED
    [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: false, // RESTRICTED
    [PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS]: false, // RESTRICTED
    [PERMISSIONS.CAN_UPDATE_MEMBER_ROLES]: false, // RESTRICTED
    [PERMISSIONS.CAN_REVOKE_INVITATIONS]: false, // Optional - can be granted
    [PERMISSIONS.CAN_RESEND_INVITATIONS]: false, // Optional - can be granted
  },
  [TEAM_ROLES.TEAM_LEAD]: {
    [PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: true, // Now allowed for team leads
    [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: true, // Now allowed for team leads
    [PERMISSIONS.CAN_EXPORT_TEAM_DATA]: true,
    [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: true,
    [PERMISSIONS.CAN_CREATE_TEAMS]: false, // Still restricted for team leads
    [PERMISSIONS.CAN_DELETE_TEAMS]: false, // Still restricted for team leads
    [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: true,
    [PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS]: true,
    [PERMISSIONS.CAN_UPDATE_MEMBER_ROLES]: false, // Can't promote to manager
    [PERMISSIONS.CAN_REVOKE_INVITATIONS]: true,
    [PERMISSIONS.CAN_RESEND_INVITATIONS]: true,
    [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: true
  },
  [TEAM_ROLES.MANAGER]: {
    [PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: true,
    [PERMISSIONS.CAN_EXPORT_TEAM_DATA]: true,
    [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: true,
    [PERMISSIONS.CAN_CREATE_TEAMS]: true, // Managers can create teams
    [PERMISSIONS.CAN_DELETE_TEAMS]: true, // Managers can delete teams
    [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: true,
    [PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS]: true,
    [PERMISSIONS.CAN_UPDATE_MEMBER_ROLES]: true,
    [PERMISSIONS.CAN_REVOKE_INVITATIONS]: true,
    [PERMISSIONS.CAN_RESEND_INVITATIONS]: true,
    [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: true
  },
  [TEAM_ROLES.OWNER]: {
    // Owner has all permissions across all teams
    [PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: true,
    [PERMISSIONS.CAN_EXPORT_TEAM_DATA]: true,
    [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: true,
    [PERMISSIONS.CAN_CREATE_TEAMS]: true,
    [PERMISSIONS.CAN_DELETE_TEAMS]: true,
    [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: true,
    [PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS]: true,
    [PERMISSIONS.CAN_UPDATE_MEMBER_ROLES]: true,
    [PERMISSIONS.CAN_REVOKE_INVITATIONS]: true,
    [PERMISSIONS.CAN_RESEND_INVITATIONS]: true,
    [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: true
  }
};
/**
 * Define which permissions are permanently restricted for employees
 */
export const EMPLOYEE_RESTRICTED_PERMISSIONS = [
  // Team Management permissions
  PERMISSIONS.CAN_INVITE_TEAM_MEMBERS,
  PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS,
  PERMISSIONS.CAN_UPDATE_MEMBER_ROLES,
  PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS,
  
  // Organization Management permissions
  PERMISSIONS.CAN_CREATE_TEAMS,
  PERMISSIONS.CAN_DELETE_TEAMS,
  
  // Specific contact permissions
  PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM,
  PERMISSIONS.CAN_EDIT_TEAM_CONTACTS
];

/**
 * Helper function to check if a permission is restricted for employees
 */
export function isEmployeeRestrictedPermission(permission) {
  return EMPLOYEE_RESTRICTED_PERMISSIONS.includes(permission);
}