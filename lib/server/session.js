// lib/server/session.js
/**
 * Server-side session management utilities
 * Imports constants from the centralized barrel file
 */

import { 
  SUBSCRIPTION_LEVELS,
  ORGANIZATION_ROLES,
  TEAM_ROLES,
  INVITATION_STATUS,
  CONTACT_FEATURES,
  PERMISSIONS,
  hasContactFeature,
  getContactLimits,
  DEFAULT_PERMISSIONS_BY_ROLE
} from '../services/constants';

/**
 * Session management class
 */
export class SessionManager {
  constructor(sessionData) {
    this.user = sessionData?.user;
    this.organization = sessionData?.organization;
    this.subscriptionLevel = sessionData?.subscriptionLevel?.toLowerCase() || SUBSCRIPTION_LEVELS.BASE;
    this.organizationRole = sessionData?.organizationRole;
    this.teamRoles = sessionData?.teamRoles || [];
  }

  /**
   * Check if user has access to a specific contact feature
   */
  hasContactFeature(feature) {
    return hasContactFeature(this.subscriptionLevel, feature);
  }

  /**
   * Get contact limits for current subscription level
   */
  getContactLimits() {
    return getContactLimits(this.subscriptionLevel);
  }

  /**
   * Check if user has a specific team permission
   */
  hasTeamPermission(permission, teamId = null) {
    // If no specific team, check against highest role
    if (!teamId) {
      const highestRole = this.getHighestTeamRole();
      return this.checkPermissionForRole(highestRole, permission);
    }

    // Check permission for specific team
    const teamRole = this.teamRoles.find(tr => tr.teamId === teamId)?.role;
    return this.checkPermissionForRole(teamRole, permission);
  }

  /**
   * Helper to check if a role has a specific permission
   */
  checkPermissionForRole(role, permission) {
    if (!role) return false;
    
    const rolePermissions = DEFAULT_PERMISSIONS_BY_ROLE[role];
    return rolePermissions?.[permission] || false;
  }

  /**
   * Get the user's highest team role across all teams
   */
  getHighestTeamRole() {
    if (!this.teamRoles.length) return null;

    const roleHierarchy = {
      [TEAM_ROLES.EMPLOYEE]: 1,
      [TEAM_ROLES.TEAM_LEAD]: 2,
      [TEAM_ROLES.MANAGER]: 3,
      [TEAM_ROLES.OWNER]: 4
    };

    return this.teamRoles.reduce((highest, teamRole) => {
      const currentLevel = roleHierarchy[teamRole.role] || 0;
      const highestLevel = roleHierarchy[highest] || 0;
      
      return currentLevel > highestLevel ? teamRole.role : highest;
    }, null);
  }

  /**
   * Check if user is organization owner
   */
  isOrganizationOwner() {
    return this.organizationRole === ORGANIZATION_ROLES.OWNER;
  }

  /**
   * Check if user can access enterprise features
   */
  canAccessEnterpriseFeatures() {
    return [SUBSCRIPTION_LEVELS.BUSINESS, SUBSCRIPTION_LEVELS.ENTERPRISE]
      .includes(this.subscriptionLevel);
  }

  /**
   * Get user's effective permissions summary
   */
  getPermissionsSummary() {
    return {
      subscriptionLevel: this.subscriptionLevel,
      organizationRole: this.organizationRole,
      highestTeamRole: this.getHighestTeamRole(),
      contactLimits: this.getContactLimits(),
      canAccessEnterpriseFeatures: this.canAccessEnterpriseFeatures(),
      isOrganizationOwner: this.isOrganizationOwner(),
      teamCount: this.teamRoles.length
    };
  }
}

/**
 * Utility function to create session manager from request
 */
export function createSessionManager(req) {
  const sessionData = {
    user: req.user,
    organization: req.organization,
    subscriptionLevel: req.user?.subscriptionLevel || req.organization?.subscriptionLevel,
    organizationRole: req.user?.organizationRole,
    teamRoles: req.user?.teamRoles || []
  };

  return new SessionManager(sessionData);
}

/**
 * Middleware to attach session manager to request
 */
export function attachSessionManager(req, res, next) {
  req.sessionManager = createSessionManager(req);
  next();
}

/**
 * Helper function to validate session has required permissions
 */
export function requirePermission(permission, teamId = null) {
  return (req, res, next) => {
    const sessionManager = req.sessionManager || createSessionManager(req);
    
    if (!sessionManager.hasTeamPermission(permission, teamId)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission,
        teamId: teamId
      });
    }

    next();
  };
}

/**
 * Helper function to validate subscription level
 */
export function requireSubscriptionLevel(requiredLevel) {
  return (req, res, next) => {
    const sessionManager = req.sessionManager || createSessionManager(req);
    
    const levelHierarchy = {
      [SUBSCRIPTION_LEVELS.BASE]: 1,
      [SUBSCRIPTION_LEVELS.PRO]: 2,
      [SUBSCRIPTION_LEVELS.PREMIUM]: 3,
      [SUBSCRIPTION_LEVELS.BUSINESS]: 4,
      [SUBSCRIPTION_LEVELS.ENTERPRISE]: 5
    };

    const userLevel = levelHierarchy[sessionManager.subscriptionLevel] || 0;
    const requiredLevelValue = levelHierarchy[requiredLevel] || 0;

    if (userLevel < requiredLevelValue) {
      return res.status(402).json({
        error: 'Subscription upgrade required',
        current: sessionManager.subscriptionLevel,
        required: requiredLevel
      });
    }

    next();
  };
}

/**
 * Helper function to validate contact feature access
 */
export function requireContactFeature(feature) {
  return (req, res, next) => {
    const sessionManager = req.sessionManager || createSessionManager(req);
    
    if (!sessionManager.hasContactFeature(feature)) {
      return res.status(402).json({
        error: 'Feature not available in current subscription',
        feature: feature,
        subscriptionLevel: sessionManager.subscriptionLevel
      });
    }

    next();
  };
}