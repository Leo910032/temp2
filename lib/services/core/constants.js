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

/**
 * Maximum AI billable runs per month by subscription level
 * AI operations: Gemini, GPT, Claude, AI-enhanced features
 * -1 indicates unlimited
 */
export const MAX_BILLABLE_RUNS_AI_PER_MONTH = {
  [SUBSCRIPTION_LEVELS.BASE]: 0,
  [SUBSCRIPTION_LEVELS.PRO]: 0,       // Pro tier doesn't have AI features
  [SUBSCRIPTION_LEVELS.PREMIUM]: 30,
  [SUBSCRIPTION_LEVELS.BUSINESS]: 50,
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: -1
};

/**
 * Maximum API billable runs per month by subscription level
 * API operations: Google Maps, OCR, Pinecone, external APIs
 * -1 indicates unlimited
 */
export const MAX_BILLABLE_RUNS_API_PER_MONTH = {
  [SUBSCRIPTION_LEVELS.BASE]: 0,
  [SUBSCRIPTION_LEVELS.PRO]: 50,
  [SUBSCRIPTION_LEVELS.PREMIUM]: 100,
  [SUBSCRIPTION_LEVELS.BUSINESS]: 200,
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: -1
};

/**
 * @deprecated Use MAX_BILLABLE_RUNS_AI_PER_MONTH or MAX_BILLABLE_RUNS_API_PER_MONTH
 * Kept for backward compatibility during migration
 */
export const MAX_BILLABLE_RUNS_PER_MONTH = {
  [SUBSCRIPTION_LEVELS.BASE]: 0,
  [SUBSCRIPTION_LEVELS.PRO]: 50,      // Now refers to API operations
  [SUBSCRIPTION_LEVELS.PREMIUM]: 30,  // Now refers to AI operations
  [SUBSCRIPTION_LEVELS.BUSINESS]: 50,
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: -1
};

/**
 * Maximum cost budget per month by subscription level (in USD)
 * -1 indicates unlimited
 */
export const MAX_COST_BUDGET_PER_MONTH = {
  [SUBSCRIPTION_LEVELS.BASE]: 0,
  [SUBSCRIPTION_LEVELS.PRO]: 1.5,
  [SUBSCRIPTION_LEVELS.PREMIUM]: 3.0,
  [SUBSCRIPTION_LEVELS.BUSINESS]: 5.0,
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: -1
};