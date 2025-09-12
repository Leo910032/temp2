// lib/server/session.js
import { adminAuth } from '@/lib/firebaseAdmin';
import { getUserSubscriptionDetails } from './subscriptionService';

/**
 * Creates a "session" object for a single API request.
 * This is our "request-scoped cache" that uses the unified subscription service.
 */
export async function createApiSession(request) {
  // 1. AUTHENTICATION
  const authHeader = request.headers.get('authorization');
  if (!authHeader) throw new Error('Authorization required');
  const token = authHeader.substring(7);
  const decodedToken = await adminAuth.verifyIdToken(token);
  const userId = decodedToken.uid;

  // 2. DATA FETCHING (ONCE per request via the unified service)
  const subscriptionDetails = await getUserSubscriptionDetails(userId);
  if (!subscriptionDetails.isFound && !subscriptionDetails.error) {
    throw new Error('User account not found');
  }

  // 3. RETURN THE SESSION "PASSPORT" (Now much simpler)
  return {
    userId,
    subscriptionLevel: subscriptionDetails.subscriptionLevel,
    permissions: subscriptionDetails.permissions,
    limits: subscriptionDetails.limits,
    userData: subscriptionDetails.rawUserData,
    
    // Enhanced capabilities from unified service
    contactCapabilities: subscriptionDetails.contactFeatures,
    enterpriseCapabilities: subscriptionDetails.enterpriseCapabilities,
    teamRoles: subscriptionDetails.teamRoles,
    organizationRole: subscriptionDetails.organizationRole,
    
    // Convenience properties
    canUpgrade: subscriptionDetails.canUpgrade,
    nextTier: subscriptionDetails.nextTier,
    isOrganizationOwner: subscriptionDetails.organizationRole === 'owner',
    highestTeamRole: subscriptionDetails.highestTeamRole
  };
}

/**
 * Session management class that works with the unified subscription system
 */
export class SessionManager {
  constructor(sessionData) {
    this.session = sessionData;
  }

  /**
   * Check if user has access to a specific contact feature
   */
  hasContactFeature(feature) {
    return this.session.permissions[feature] || false;
  }

  /**
   * Check if user has a specific team permission
   */
  hasTeamPermission(permission, teamId = null) {
    if (!teamId) {
      // Check against unified permissions
      return this.session.permissions[permission] || false;
    }

    // Check permission for specific team
    const teamRole = this.session.teamRoles.find(tr => tr.teamId === teamId)?.role;
    return this.checkPermissionForRole(teamRole, permission);
  }

  /**
   * Helper to check if a role has a specific permission
   */
  checkPermissionForRole(role, permission) {
    if (!role) return false;
    
    // This would need to import DEFAULT_PERMISSIONS_BY_ROLE if needed
    // For now, use the unified permissions
    return this.session.permissions[permission] || false;
  }

  /**
   * Check if user is organization owner
   */
  isOrganizationOwner() {
    return this.session.isOrganizationOwner;
  }

  /**
   * Check if user can access enterprise features
   */
  canAccessEnterpriseFeatures() {
    return this.session.enterpriseCapabilities.hasAccess;
  }

  /**
   * Get contact limits
   */
  getContactLimits() {
    return {
      maxContacts: this.session.limits.maxContacts,
      maxGroups: this.session.limits.maxGroups,
      maxShares: this.session.limits.maxShares
    };
  }

  /**
   * Get user's effective permissions summary
   */
  getPermissionsSummary() {
    return {
      subscriptionLevel: this.session.subscriptionLevel,
      organizationRole: this.session.organizationRole,
      highestTeamRole: this.session.highestTeamRole,
      contactLimits: this.getContactLimits(),
      enterpriseLimits: {
        maxTeams: this.session.limits.maxTeams,
        maxMembers: this.session.limits.maxMembers
      },
      canAccessEnterpriseFeatures: this.canAccessEnterpriseFeatures(),
      isOrganizationOwner: this.isOrganizationOwner(),
      teamCount: this.session.teamRoles.length,
      canUpgrade: this.session.canUpgrade,
      nextTier: this.session.nextTier
    };
  }
}

/**
 * Utility function to create session manager from request
 */
export function createSessionManager(req) {
  return new SessionManager(req.session || req);
}

/**
 * Middleware to attach session manager to request
 */
export function attachSessionManager(req, res, next) {
  createApiSession(req).then(session => {
    req.session = session;
    req.sessionManager = new SessionManager(session);
    next();
  }).catch(error => {
    res.status(401).json({ error: error.message });
  });
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
    const session = req.session || req;
    
    const levelHierarchy = {
      base: 1,
      pro: 2,
      premium: 3,
      business: 4,
      enterprise: 5
    };

    const userLevel = levelHierarchy[session.subscriptionLevel] || 0;
    const requiredLevelValue = levelHierarchy[requiredLevel] || 0;

    if (userLevel < requiredLevelValue) {
      return res.status(402).json({
        error: 'Subscription upgrade required',
        current: session.subscriptionLevel,
        required: requiredLevel,
        nextTier: session.nextTier
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
        subscriptionLevel: sessionManager.session.subscriptionLevel,
        upgradeRequired: sessionManager.session.nextTier
      });
    }

    next();
  };
}