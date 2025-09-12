//lib/services/serviceEnterprise/constants/enterpriseConstants.js

import { TEAM_ROLES, TEAM_ROLE_HIERARCHY } from '../../core/constants';

/**
 * Defines all possible granular permissions for a user.
 */
export const PERMISSIONS = {
  CAN_VIEW_ALL_TEAM_CONTACTS: 'canViewAllTeamContacts',
  CAN_EDIT_TEAM_CONTACTS: 'canEditTeamContacts',
  CAN_SHARE_CONTACTS_WITH_TEAM: 'canShareContactsWithTeam',
  CAN_EXPORT_TEAM_DATA: 'canExportTeamData',
  CAN_INVITE_TEAM_MEMBERS: 'canInviteTeamMembers',
  
  // Additional permissions for team management
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
 * Default permissions for each team role (mapped to CORE team roles).
 */
export const DEFAULT_PERMISSIONS_BY_ROLE = {
   [TEAM_ROLES.EMPLOYEE]: {
    // Allowed permissions for employees
    [PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_EXPORT_TEAM_DATA]: false,
    [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: false,
    
    // RESTRICTED permissions - employees can NEVER have these
    [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: false,
    [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: false,
    [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: false,
    [PERMISSIONS.CAN_CREATE_TEAMS]: false,
    [PERMISSIONS.CAN_DELETE_TEAMS]: false,
    [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: false,
    [PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS]: false,
    [PERMISSIONS.CAN_UPDATE_MEMBER_ROLES]: false,
    [PERMISSIONS.CAN_REVOKE_INVITATIONS]: false,
    [PERMISSIONS.CAN_RESEND_INVITATIONS]: false,
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
  
  // Invitation Management is now restricted for employees
  PERMISSIONS.CAN_REVOKE_INVITATIONS,
  PERMISSIONS.CAN_RESEND_INVITATIONS,
  
  // Organization Management permissions
  PERMISSIONS.CAN_CREATE_TEAMS,
  PERMISSIONS.CAN_DELETE_TEAMS,
  
  // Specific contact permissions
  PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM,
  PERMISSIONS.CAN_EDIT_TEAM_CONTACTS
];

/**
 * Roles that can have their permissions customized (excludes OWNER)
 */
export const CUSTOMIZABLE_ROLES = [
  TEAM_ROLES.MANAGER, 
  TEAM_ROLES.TEAM_LEAD, 
  TEAM_ROLES.EMPLOYEE
];

/**
 * Permission categories for UI organization
 */
export const PERMISSION_CATEGORIES = {
  'Team Management': [
    PERMISSIONS.CAN_INVITE_TEAM_MEMBERS,
    PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS,
    PERMISSIONS.CAN_UPDATE_MEMBER_ROLES,
    PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS
  ],
  'Team Operations': [
    PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS,
    PERMISSIONS.CAN_REVOKE_INVITATIONS,
    PERMISSIONS.CAN_RESEND_INVITATIONS,
    PERMISSIONS.CAN_EXPORT_TEAM_DATA
  ],
  'Organization Level': [
    PERMISSIONS.CAN_CREATE_TEAMS,
    PERMISSIONS.CAN_DELETE_TEAMS
  ],
  'Contact Management': [
    PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS,
    PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM,
    PERMISSIONS.CAN_EDIT_TEAM_CONTACTS
  ]
};

/**
 * Human-readable labels for permissions
 */
export const PERMISSION_LABELS = {
  [PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS]: 'View Team Contacts',
  [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: 'Edit Team Contacts',
  [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: 'Share Contacts',
  [PERMISSIONS.CAN_EXPORT_TEAM_DATA]: 'Export Team Data',
  [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: 'Invite Members',
  [PERMISSIONS.CAN_CREATE_TEAMS]: 'Create Teams',
  [PERMISSIONS.CAN_DELETE_TEAMS]: 'Delete Teams',
  [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: 'Manage Settings',
  [PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS]: 'Remove Members',
  [PERMISSIONS.CAN_UPDATE_MEMBER_ROLES]: 'Update Roles',
  [PERMISSIONS.CAN_REVOKE_INVITATIONS]: 'Revoke Invitations',
  [PERMISSIONS.CAN_RESEND_INVITATIONS]: 'Resend Invitations',
  [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: 'View Analytics'
};

/**
 * Helper function to check if a permission is restricted for employees
 */
export function isEmployeeRestrictedPermission(permission) {
  return EMPLOYEE_RESTRICTED_PERMISSIONS.includes(permission);
}