/**
 * THIS FILE HAS BEEN REFRACTORED TO ALIGN WITH THE NEW DATA MODEL
 */
//lib/services/serviceEnterprise/constants/enterpriseConstants.js

import { TEAM_ROLES, TEAM_ROLE_HIERARCHY } from '../../core/constants.js';

/**
 * Defines all possible granular permissions for a user.
 * Updated to include new organization-level features from the new data model.
 */
export const PERMISSIONS = {
  // Team-level Contact Management
  CAN_VIEW_ALL_TEAM_CONTACTS: 'canViewAllTeamContacts',
  CAN_EDIT_TEAM_CONTACTS: 'canEditTeamContacts',
  CAN_SHARE_CONTACTS_WITH_TEAM: 'canShareContactsWithTeam',
  CAN_EXPORT_TEAM_DATA: 'canExportTeamData',
  
  // Team Management
  CAN_INVITE_TEAM_MEMBERS: 'canInviteTeamMembers',
  CAN_CREATE_TEAMS: 'canCreateTeams',
  CAN_DELETE_TEAMS: 'canDeleteTeams',
  CAN_MANAGE_TEAM_SETTINGS: 'canManageTeamSettings',
  CAN_REMOVE_TEAM_MEMBERS: 'canRemoveTeamMembers',
  CAN_UPDATE_MEMBER_ROLES: 'canUpdateMemberRoles',
  CAN_REVOKE_INVITATIONS: 'canRevokeInvitations',
  CAN_RESEND_INVITATIONS: 'canResendInvitations',
  CAN_VIEW_TEAM_ANALYTICS: 'canViewTeamAnalytics',
  
  // ✅ NEW: Organization-level permissions from the new data model
  CAN_MANAGE_BANNERS: 'canManageBanners',
  CAN_MANAGE_LINK_TEMPLATES: 'canManageLinkTemplates',
  CAN_MANAGE_APPEARANCE_TEMPLATES: 'canManageAppearanceTemplates',
  CAN_MANAGE_ORGANIZATION_BRANDING: 'canManageOrganizationBranding',
  
  // ✅ NEW: Team Lead specific permission mentioned in the guide
  CAN_ASSIGN_EMPLOYEES_TO_TEAM_LEAD: 'canAssignEmployeesToTeamLead',
  
  // Cross-team sharing permissions (from new model)
  CAN_ENABLE_CROSS_TEAM_SHARING: 'canEnableCrossTeamSharing',
  CAN_APPROVE_CROSS_TEAM_SHARING: 'canApproveCrossTeamSharing'
};

/**
 * Default permissions for each team role (mapped to CORE team roles).
 * Updated to include new organization-level features.
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
    
    // ✅ NEW: Organization-level restrictions for employees
    [PERMISSIONS.CAN_MANAGE_BANNERS]: false,
    [PERMISSIONS.CAN_MANAGE_LINK_TEMPLATES]: false,
    [PERMISSIONS.CAN_MANAGE_APPEARANCE_TEMPLATES]: false,
    [PERMISSIONS.CAN_MANAGE_ORGANIZATION_BRANDING]: false,
    [PERMISSIONS.CAN_ASSIGN_EMPLOYEES_TO_TEAM_LEAD]: false,
    [PERMISSIONS.CAN_ENABLE_CROSS_TEAM_SHARING]: false,
    [PERMISSIONS.CAN_APPROVE_CROSS_TEAM_SHARING]: false
  },
  [TEAM_ROLES.TEAM_LEAD]: {
    [PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: true,
    [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: true,
    [PERMISSIONS.CAN_EXPORT_TEAM_DATA]: true,
    [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: true,
    [PERMISSIONS.CAN_CREATE_TEAMS]: false, // Still restricted for team leads
    [PERMISSIONS.CAN_DELETE_TEAMS]: false, // Still restricted for team leads
    [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: true,
    [PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS]: true,
    [PERMISSIONS.CAN_UPDATE_MEMBER_ROLES]: false, // Can't promote to manager
    [PERMISSIONS.CAN_REVOKE_INVITATIONS]: true,
    [PERMISSIONS.CAN_RESEND_INVITATIONS]: true,
    [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: true,
    
    // ✅ NEW: Team Lead gets the specific permission from the guide
    [PERMISSIONS.CAN_ASSIGN_EMPLOYEES_TO_TEAM_LEAD]: true,
    
    // ✅ NEW: Limited organization-level access for team leads
    [PERMISSIONS.CAN_MANAGE_BANNERS]: false, // Still restricted
    [PERMISSIONS.CAN_MANAGE_LINK_TEMPLATES]: false, // Still restricted
    [PERMISSIONS.CAN_MANAGE_APPEARANCE_TEMPLATES]: false, // Still restricted
    [PERMISSIONS.CAN_MANAGE_ORGANIZATION_BRANDING]: false, // Still restricted
    [PERMISSIONS.CAN_ENABLE_CROSS_TEAM_SHARING]: false, // Still restricted
    [PERMISSIONS.CAN_APPROVE_CROSS_TEAM_SHARING]: true // Can approve for their team
  },
  [TEAM_ROLES.MANAGER]: {
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
    [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: true,
    
    // ✅ NEW: Managers get organization-level template management
    [PERMISSIONS.CAN_MANAGE_BANNERS]: true,
    [PERMISSIONS.CAN_MANAGE_LINK_TEMPLATES]: true,
    [PERMISSIONS.CAN_MANAGE_APPEARANCE_TEMPLATES]: true,
    [PERMISSIONS.CAN_MANAGE_ORGANIZATION_BRANDING]: false, // Only owners
    [PERMISSIONS.CAN_ASSIGN_EMPLOYEES_TO_TEAM_LEAD]: true,
    [PERMISSIONS.CAN_ENABLE_CROSS_TEAM_SHARING]: true,
    [PERMISSIONS.CAN_APPROVE_CROSS_TEAM_SHARING]: true
  },
  [TEAM_ROLES.OWNER]: {
    // Owner has all permissions across all teams and organization
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
    [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: true,
    
    // ✅ NEW: Owners get full organization-level access
    [PERMISSIONS.CAN_MANAGE_BANNERS]: true,
    [PERMISSIONS.CAN_MANAGE_LINK_TEMPLATES]: true,
    [PERMISSIONS.CAN_MANAGE_APPEARANCE_TEMPLATES]: true,
    [PERMISSIONS.CAN_MANAGE_ORGANIZATION_BRANDING]: true, // Only owners
    [PERMISSIONS.CAN_ASSIGN_EMPLOYEES_TO_TEAM_LEAD]: true,
    [PERMISSIONS.CAN_ENABLE_CROSS_TEAM_SHARING]: true,
    [PERMISSIONS.CAN_APPROVE_CROSS_TEAM_SHARING]: true
  }
};

/**
 * Define which permissions are permanently restricted for employees
 * Updated to include new organization-level permissions.
 */
export const EMPLOYEE_RESTRICTED_PERMISSIONS = [
  // Team Management permissions
  PERMISSIONS.CAN_INVITE_TEAM_MEMBERS,
  PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS,
  PERMISSIONS.CAN_UPDATE_MEMBER_ROLES,
  PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS,
  
  // Invitation Management
  PERMISSIONS.CAN_REVOKE_INVITATIONS,
  PERMISSIONS.CAN_RESEND_INVITATIONS,
  
  // Organization Management permissions
  PERMISSIONS.CAN_CREATE_TEAMS,
  PERMISSIONS.CAN_DELETE_TEAMS,
  
  // Contact permissions
  PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM,
  PERMISSIONS.CAN_EDIT_TEAM_CONTACTS,
  
  // ✅ NEW: Organization-level restrictions for employees
  PERMISSIONS.CAN_MANAGE_BANNERS,
  PERMISSIONS.CAN_MANAGE_LINK_TEMPLATES,
  PERMISSIONS.CAN_MANAGE_APPEARANCE_TEMPLATES,
  PERMISSIONS.CAN_MANAGE_ORGANIZATION_BRANDING,
  PERMISSIONS.CAN_ASSIGN_EMPLOYEES_TO_TEAM_LEAD,
  PERMISSIONS.CAN_ENABLE_CROSS_TEAM_SHARING,
  PERMISSIONS.CAN_APPROVE_CROSS_TEAM_SHARING
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
 * Updated to include new organization-level categories.
 */
export const PERMISSION_CATEGORIES = {
  'Team Management': [
    PERMISSIONS.CAN_INVITE_TEAM_MEMBERS,
    PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS,
    PERMISSIONS.CAN_UPDATE_MEMBER_ROLES,
    PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS,
    PERMISSIONS.CAN_ASSIGN_EMPLOYEES_TO_TEAM_LEAD
  ],
  'Team Operations': [
    PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS,
    PERMISSIONS.CAN_REVOKE_INVITATIONS,
    PERMISSIONS.CAN_RESEND_INVITATIONS,
    PERMISSIONS.CAN_EXPORT_TEAM_DATA
  ],
  'Organization Level': [
    PERMISSIONS.CAN_CREATE_TEAMS,
    PERMISSIONS.CAN_DELETE_TEAMS,
    PERMISSIONS.CAN_ENABLE_CROSS_TEAM_SHARING,
    PERMISSIONS.CAN_APPROVE_CROSS_TEAM_SHARING
  ],
  'Contact Management': [
    PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS,
    PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM,
    PERMISSIONS.CAN_EDIT_TEAM_CONTACTS
  ],
  // ✅ NEW: Organization customization category
  'Organization Customization': [
    PERMISSIONS.CAN_MANAGE_BANNERS,
    PERMISSIONS.CAN_MANAGE_LINK_TEMPLATES,
    PERMISSIONS.CAN_MANAGE_APPEARANCE_TEMPLATES,
    PERMISSIONS.CAN_MANAGE_ORGANIZATION_BRANDING
  ]
};

/**
 * Human-readable labels for permissions
 * Updated to include new organization-level permission labels.
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
  [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: 'View Analytics',
  
  // ✅ NEW: Labels for organization-level permissions
  [PERMISSIONS.CAN_MANAGE_BANNERS]: 'Manage Banners',
  [PERMISSIONS.CAN_MANAGE_LINK_TEMPLATES]: 'Manage Link Templates',
  [PERMISSIONS.CAN_MANAGE_APPEARANCE_TEMPLATES]: 'Manage Appearance Templates',
  [PERMISSIONS.CAN_MANAGE_ORGANIZATION_BRANDING]: 'Manage Organization Branding',
  [PERMISSIONS.CAN_ASSIGN_EMPLOYEES_TO_TEAM_LEAD]: 'Assign Employees to Team Lead',
  [PERMISSIONS.CAN_ENABLE_CROSS_TEAM_SHARING]: 'Enable Cross-Team Sharing',
  [PERMISSIONS.CAN_APPROVE_CROSS_TEAM_SHARING]: 'Approve Cross-Team Sharing'
};

/**
 * Helper function to check if a permission is restricted for employees
 */
export function isEmployeeRestrictedPermission(permission) {
  return EMPLOYEE_RESTRICTED_PERMISSIONS.includes(permission);
}