/**
 * THIS FILE HAS BEEN REFACTORED TO USE THE NEW DATA MODEL
 */
// lib/server/session.js
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { getUserSubscriptionDetails, getUserSession } from '../services/server/subscriptionService.js';
import {
  MAX_BILLABLE_RUNS_AI_PER_MONTH,
  MAX_BILLABLE_RUNS_API_PER_MONTH,
  MAX_COST_BUDGET_PER_MONTH,
  SUBSCRIPTION_LEVELS
} from '../services/core/constants.js';

/**
 * Creates a "session" object for a single API request.
 * This is our "request-scoped cache" that uses the unified subscription service.
 * ✅ UPDATED: Now uses the new subscriptionService with full organization support
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

  // ✅ NEW: Get enhanced session object with IP and User Agent for audit logging
  const enhancedSession = await getUserSession(userId, true, true, request);

  // 3. RETURN THE SESSION "PASSPORT" (Now with organization support)
  return {
    userId,
    subscriptionLevel: subscriptionDetails.subscriptionLevel,
    permissions: subscriptionDetails.permissions,
    limits: subscriptionDetails.limits,
    userData: subscriptionDetails.rawUserData,
    
    // Enhanced capabilities from unified service
    contactCapabilities: subscriptionDetails.contactFeatures,
    enterpriseCapabilities: subscriptionDetails.enterpriseCapabilities,
    
    // ✅ NEW: Organization context
    organizationId: subscriptionDetails.organizationId,
    organizationData: subscriptionDetails.organizationData,
    organizationRole: subscriptionDetails.organizationRole,
    organizationFeatures: subscriptionDetails.enterpriseCapabilities.organizationFeatures,
    
    // Team context (enhanced)
    teamRoles: subscriptionDetails.teamRoles,
    teamData: subscriptionDetails.teamData,
    highestTeamRole: subscriptionDetails.highestTeamRole,
    
    // Convenience properties
    canUpgrade: subscriptionDetails.canUpgrade,
    nextTier: subscriptionDetails.nextTier,
    isOrganizationOwner: subscriptionDetails.organizationRole === 'owner',
    
    // ✅ NEW: Session object for service calls (includes IP/User Agent)
    serviceSession: enhancedSession,
    
    // ✅ NEW: Request metadata for audit logging
    requestMetadata: {
      ipAddress: enhancedSession.ipAddress,
      userAgent: enhancedSession.userAgent,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Session management class that works with the unified subscription system
 * ✅ ENHANCED: Now includes organization-level permission checks
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
   * ✅ NEW: Check if user has organization-level permission
   */
  hasOrganizationPermission(permission) {
    // Organization owners have all permissions
    if (this.session.isOrganizationOwner) {
      return true;
    }
    
    return this.session.permissions[permission] || false;
  }

  /**
   * ✅ NEW: Check if user can manage organization features
   */
  canManageOrganizationFeature(featureType) {
    const permissionMap = {
      'banners': 'canManageBanners',
      'linkTemplates': 'canManageLinkTemplates', 
      'appearanceTemplates': 'canManageAppearanceTemplates',
      'branding': 'canManageOrganizationBranding',
      'crossTeamSharing': 'canEnableCrossTeamSharing'
    };
    
    const permission = permissionMap[featureType];
    return permission ? this.hasOrganizationPermission(permission) : false;
  }

  /**
   * ✅ NEW: Check cross-team sharing permissions with organization rules
   */
  canShareAcrossTeams(skipApprovalCheck = false) {
    const orgFeatures = this.session.organizationFeatures;
    
    // Check if cross-team sharing is enabled for the organization
    if (!orgFeatures.crossTeamSharing) {
      return { allowed: false, reason: 'Cross-team sharing disabled by organization' };
    }
    
    // Check if user has basic sharing permission
    if (!this.session.permissions.canShareContactsWithTeam) {
      return { allowed: false, reason: 'User lacks sharing permissions' };
    }
    
    // Check approval requirements
    if (orgFeatures.requireManagerApproval && !skipApprovalCheck) {
      const canApprove = this.session.permissions.canApproveCrossTeamSharing;
      if (!canApprove) {
        return { allowed: false, reason: 'Manager approval required' };
      }
    }
    
    return { allowed: true, reason: null };
  }

  /**
   * ✅ NEW: Check if user can assign employees to team leads
   */
  canAssignEmployeesToTeamLead() {
    return this.session.permissions.canAssignEmployeesToTeamLead || false;
  }

  /**
   * Helper to check if a role has a specific permission
   */
  checkPermissionForRole(role, permission) {
    if (!role) return false;
    
    // Use the unified permissions from subscription service
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
   * ✅ NEW: Get organization features summary
   */
  getOrganizationFeatures() {
    if (!this.session.organizationFeatures) {
      return {
        banners: [],
        linkTemplates: [],
        appearanceTemplates: [],
        branding: null,
        crossTeamSharing: false,
        requireManagerApproval: false
      };
    }
    
    return this.session.organizationFeatures;
  }

  /**
   * ✅ NEW: Get user's teams with enhanced context
   */
  getTeamsContext() {
    return this.session.teamRoles.map(teamRole => ({
      teamId: teamRole.teamId,
      teamName: teamRole.teamName,
      role: teamRole.role,
      organizationId: teamRole.organizationId,
      // Find matching team data
      teamData: this.session.teamData.find(td => td.id === teamRole.teamId)
    }));
  }

  /**
   * Get user's effective permissions summary
   * ✅ ENHANCED: Now includes organization context
   */
  getPermissionsSummary() {
    return {
      subscriptionLevel: this.session.subscriptionLevel,
      organizationId: this.session.organizationId,
      organizationRole: this.session.organizationRole,
      highestTeamRole: this.session.highestTeamRole,

      contactLimits: this.getContactLimits(),
      enterpriseLimits: {
        maxTeams: this.session.limits.maxTeams,
        maxMembers: this.session.limits.maxMembers
      },

      capabilities: {
        canAccessEnterpriseFeatures: this.canAccessEnterpriseFeatures(),
        isOrganizationOwner: this.isOrganizationOwner(),
        canManageBanners: this.canManageOrganizationFeature('banners'),
        canManageBranding: this.canManageOrganizationFeature('branding'),
        canShareAcrossTeams: this.canShareAcrossTeams().allowed,
        canAssignEmployees: this.canAssignEmployeesToTeamLead()
      },

      teamCount: this.session.teamRoles.length,
      canUpgrade: this.session.canUpgrade,
      nextTier: this.session.nextTier,

      organizationFeatures: this.getOrganizationFeatures()
    };
  }

  /**
   * ✅ NEW: Get remaining budget and runs for the current month
   * Reads from real-time user document fields for fast access
   * Returns separate tracking for AI operations and API operations
   *
   * @returns {Promise<Object>} Current usage status with remaining budget and runs
   */
  async getRemainingBudget() {
    const userId = this.session.userId;
    const subscriptionLevel = this.session.subscriptionLevel;

    // Get limits for subscription level
    const maxCost = MAX_COST_BUDGET_PER_MONTH[subscriptionLevel] || 0;
    const maxRunsAI = MAX_BILLABLE_RUNS_AI_PER_MONTH[subscriptionLevel] || 0;
    const maxRunsAPI = MAX_BILLABLE_RUNS_API_PER_MONTH[subscriptionLevel] || 0;

    // Enterprise has unlimited
    if (subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE || maxCost === -1) {
      return {
        subscriptionLevel,
        unlimited: true,
        currentCost: 0,
        currentRunsAI: 0,
        currentRunsAPI: 0,
        maxCost: -1,
        maxRunsAI: -1,
        maxRunsAPI: -1,
        remainingCost: -1,
        remainingRunsAI: -1,
        remainingRunsAPI: -1,
        percentageUsedCost: 0,
        percentageUsedRunsAI: 0,
        percentageUsedRunsAPI: 0
      };
    }

    // Read from user document
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const currentMonth = new Date().toISOString().slice(0, 7);
    const userMonth = userData.monthlyUsageMonth || null;

    // If month doesn't match, counters are stale (reset to 0)
    const currentCost = userMonth === currentMonth ? (Number(userData.monthlyTotalCost) || 0) : 0;
    const currentRunsAI = userMonth === currentMonth ? (Number(userData.monthlyBillableRunsAI) || 0) : 0;
    const currentRunsAPI = userMonth === currentMonth ? (Number(userData.monthlyBillableRunsAPI) || 0) : 0;

    const remainingCost = Math.max(0, maxCost - currentCost);
    const remainingRunsAI = Math.max(0, maxRunsAI - currentRunsAI);
    const remainingRunsAPI = Math.max(0, maxRunsAPI - currentRunsAPI);

    const percentageUsedCost = maxCost > 0 ? (currentCost / maxCost) * 100 : 0;
    const percentageUsedRunsAI = maxRunsAI > 0 ? (currentRunsAI / maxRunsAI) * 100 : 0;
    const percentageUsedRunsAPI = maxRunsAPI > 0 ? (currentRunsAPI / maxRunsAPI) * 100 : 0;

    return {
      subscriptionLevel,
      unlimited: false,
      currentCost,
      currentRunsAI,
      currentRunsAPI,
      maxCost,
      maxRunsAI,
      maxRunsAPI,
      remainingCost,
      remainingRunsAI,
      remainingRunsAPI,
      percentageUsedCost,
      percentageUsedRunsAI,
      percentageUsedRunsAPI,
      month: currentMonth
    };
  }

  /**
   * ✅ NEW: Check if user can afford an operation
   * Fast pre-flight check using real-time user document fields
   *
   * @param {number} estimatedCost - Estimated cost of the operation in USD
   * @param {boolean} requiresBillableRun - Whether this operation uses a billable run slot
   * @param {string} usageType - 'AIUsage' or 'ApiUsage' (default: 'AIUsage')
   * @returns {Promise<Object>} Affordability check result
   */
  async canAffordOperation(estimatedCost = 0, requiresBillableRun = false, usageType = 'AIUsage') {
    const budget = await this.getRemainingBudget();

    // Enterprise/unlimited users can always afford
    if (budget.unlimited) {
      return {
        allowed: true,
        reason: 'unlimited',
        budget
      };
    }

    // Check cost budget
    if (budget.maxCost > 0 && (budget.currentCost + estimatedCost) > budget.maxCost) {
      return {
        allowed: false,
        reason: 'budget_exceeded',
        message: `Monthly budget of $${budget.maxCost} would be exceeded. Current usage: $${budget.currentCost.toFixed(4)}, Estimated cost: $${estimatedCost.toFixed(4)}`,
        budget,
        upgradeRequired: this.session.canUpgrade,
        nextTier: this.session.nextTier
      };
    }

    // Check run limit if this requires a billable run
    if (requiresBillableRun) {
      const isAI = usageType === 'AIUsage';
      const currentRuns = isAI ? budget.currentRunsAI : budget.currentRunsAPI;
      const maxRuns = isAI ? budget.maxRunsAI : budget.maxRunsAPI;
      const operationType = isAI ? 'AI' : 'API';

      if (maxRuns > 0 && (currentRuns + 1) > maxRuns) {
        return {
          allowed: false,
          reason: 'runs_exceeded',
          message: `Monthly ${operationType} operation limit of ${maxRuns} would be exceeded. Current runs: ${currentRuns}`,
          budget,
          upgradeRequired: this.session.canUpgrade,
          nextTier: this.session.nextTier
        };
      }
    }

    // User can afford the operation
    const isAI = usageType === 'AIUsage';
    return {
      allowed: true,
      reason: 'within_limits',
      budget,
      estimatedCostAfter: budget.currentCost + estimatedCost,
      estimatedRunsAIAfter: budget.currentRunsAI + (requiresBillableRun && isAI ? 1 : 0),
      estimatedRunsAPIAfter: budget.currentRunsAPI + (requiresBillableRun && !isAI ? 1 : 0)
    };
  }

  /**
   * ✅ NEW: Get session object for service calls
   */
  getServiceSession() {
    return this.session.serviceSession;
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
 * ✅ ENHANCED: Now supports organization permissions
 */
export function requirePermission(permission, context = {}) {
  return (req, res, next) => {
    const sessionManager = req.sessionManager || createSessionManager(req);
    
    let hasPermission = false;
    
    if (context.type === 'organization') {
      hasPermission = sessionManager.hasOrganizationPermission(permission);
    } else if (context.teamId) {
      hasPermission = sessionManager.hasTeamPermission(permission, context.teamId);
    } else {
      hasPermission = sessionManager.hasTeamPermission(permission);
    }
    
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission,
        context: context,
        userRole: sessionManager.session.highestTeamRole,
        organizationRole: sessionManager.session.organizationRole
      });
    }

    next();
  };
}

/**
 * ✅ NEW: Helper function to validate organization membership
 */
export function requireOrganizationMembership(req, res, next) {
  const sessionManager = req.sessionManager || createSessionManager(req);
  
  if (!sessionManager.session.organizationId) {
    return res.status(403).json({
      error: 'Organization membership required',
      subscriptionLevel: sessionManager.session.subscriptionLevel
    });
  }
  
  next();
}

/**
 * ✅ NEW: Helper function to validate cross-team sharing permissions
 */
export function requireCrossTeamSharingPermission(req, res, next) {
  const sessionManager = req.sessionManager || createSessionManager(req);
  
  const sharingCheck = sessionManager.canShareAcrossTeams();
  if (!sharingCheck.allowed) {
    return res.status(403).json({
      error: 'Cross-team sharing not allowed',
      reason: sharingCheck.reason,
      organizationId: sessionManager.session.organizationId
    });
  }
  
  next();
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

/**
 * ✅ NEW: Helper function to validate organization feature access
 */
export function requireOrganizationFeature(featureType) {
  return (req, res, next) => {
    const sessionManager = req.sessionManager || createSessionManager(req);
    
    if (!sessionManager.canManageOrganizationFeature(featureType)) {
      return res.status(403).json({
        error: 'Insufficient permissions for organization feature',
        feature: featureType,
        organizationRole: sessionManager.session.organizationRole,
        highestTeamRole: sessionManager.session.highestTeamRole
      });
    }

    next();
  };
}