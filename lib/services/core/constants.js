/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// lib/services/core/constants.js
/**
 * @file Contains constants that are fundamental to the application and shared across multiple service domains.
 * This is the single source of truth for these core concepts.
 */

/**
 * Defines the subscription tiers available in the application.
 * Used by both Contact and Enterprise services to determine feature access.
 */
export const SUBSCRIPTION_LEVELS = {
  BASE: 'base',
  PRO: 'pro',
  PREMIUM: 'premium',
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise'
};

/**
 * Defines the roles a user can have within an entire organization.
 * Primarily used by Enterprise services but can affect cross-service permissions.
 */
export const ORGANIZATION_ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  EMPLOYEE: 'employee'
};

/**
 * Defines the roles a user can have within a specific team.
 */
export const TEAM_ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  TEAM_LEAD: 'team_lead',
  EMPLOYEE: 'employee'
};

/**
 * Defines the possible statuses for a team invitation.
 */
export const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REVOKED: 'revoked'
};

/**
 * Team role hierarchy (higher number = more permissions)
 * Used across services to determine permission levels
 */
export const TEAM_ROLE_HIERARCHY = {
  [TEAM_ROLES.EMPLOYEE]: 1,
  [TEAM_ROLES.TEAM_LEAD]: 2, 
  [TEAM_ROLES.MANAGER]: 3,
  [TEAM_ROLES.OWNER]: 4
};