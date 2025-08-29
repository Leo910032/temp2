// lib/services/serviceEnterprise/server/core/subscriptionManager.js
// 🎯 PHASE 1: Move ALL subscription business logic from client to server

import { adminDb } from '@/lib/firebaseAdmin';
import { EnterpriseSecurityService } from '../enterpriseSecurityService';

/**
 * Server-Side Subscription Manager
 * Contains ALL subscription validation and business logic
 * This replaces client-side logic in enterpriseSubscriptionService.js
 */
export class SubscriptionManager {
  
  // ==================== SUBSCRIPTION LEVEL DEFINITIONS ====================
  
  static SUBSCRIPTION_LEVELS = {
    FREE: 'free',
    BASE: 'base', 
    PRO: 'pro',
    PREMIUM: 'premium',
    ENTERPRISE: 'enterprise'
  };

  static SUBSCRIPTION_HIERARCHY = {
    [this.SUBSCRIPTION_LEVELS.FREE]: 0,
    [this.SUBSCRIPTION_LEVELS.BASE]: 1,
    [this.SUBSCRIPTION_LEVELS.PRO]: 2,
    [this.SUBSCRIPTION_LEVELS.PREMIUM]: 3,
    [this.SUBSCRIPTION_LEVELS.ENTERPRISE]: 4
  };

  static ENTERPRISE_FEATURES = {
    // Team Management
    UNLIMITED_TEAMS: 'unlimited_teams',
    TEAM_ROLES: 'team_roles',
    TEAM_PERMISSIONS: 'team_permissions',
    
    // Contact Sharing
    CONTACT_SHARING: 'contact_sharing',
    BULK_CONTACT_SHARING: 'bulk_contact_sharing',
    ADVANCED_SHARING_CONTROLS: 'advanced_sharing_controls',
    
    // Organization Management
    ORGANIZATION_MANAGEMENT: 'organization_management',
    AUDIT_LOGS: 'audit_logs',
    ADVANCED_SECURITY: 'advanced_security',
    
    // Limits
    UNLIMITED_CONTACTS: 'unlimited_contacts',
    PRIORITY_SUPPORT: 'priority_support',
    CUSTOM_INTEGRATIONS: 'custom_integrations'
  };

  static SUBSCRIPTION_FEATURES = {
    [this.SUBSCRIPTION_LEVELS.FREE]: {
      maxTeams: 0,
      maxMembers: 0,
      maxContacts: 100,
      features: []
    },
    [this.SUBSCRIPTION_LEVELS.BASE]: {
      maxTeams: 0,
      maxMembers: 0,
      maxContacts: 500,
      features: []
    },
    [this.SUBSCRIPTION_LEVELS.PRO]: {
      maxTeams: 0,
      maxMembers: 0,
      maxContacts: 2000,
      features: [this.ENTERPRISE_FEATURES.CONTACT_SHARING]
    },
    [this.SUBSCRIPTION_LEVELS.PREMIUM]: {
      maxTeams: 0,
      maxMembers: 0,
      maxContacts: 5000,
      features: [
        this.ENTERPRISE_FEATURES.CONTACT_SHARING,
        this.ENTERPRISE_FEATURES.BULK_CONTACT_SHARING,
        this.ENTERPRISE_FEATURES.AUDIT_LOGS,
        this.ENTERPRISE_FEATURES.PRIORITY_SUPPORT
      ]
    },
    [this.SUBSCRIPTION_LEVELS.ENTERPRISE]: {
      maxTeams: -1, // Unlimited
      maxMembers: -1, // Unlimited
      maxContacts: -1, // Unlimited
      features: Object.values(this.ENTERPRISE_FEATURES)
    }
  };

  // ==================== NEW HIGH-LEVEL METHOD ====================

  /**
   * ✅ OPTIMIZED: Gets all status, feature, and permission data in one go.
   * This is the ONLY method the API route should call.
   * It fetches the user document ONCE and reuses it.
   */
 static async getComprehensiveStatus(userId) {
  try {
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }
    const userData = userDoc.data();

    const subscriptionStatus = this._getSubscriptionStatusFromData(userId, userData);
    const featureAccess = this._getFeatureAccessFromData(subscriptionStatus);
    // ✅ REMOVED await, as the helper is now synchronous
    const operationPermissions = this._getOperationPermissionsFromData(userId, userData, subscriptionStatus);
    
    return {
      subscriptionStatus,
      featureAccess,
      operationPermissions,
    };

  } catch (error) {
    console.error(`Error in getComprehensiveStatus for user ${userId}:`, error);
    throw error;
  }
}
   // ==================== REFACTORED CORE METHODS ====================
  // Note: These are now prefixed with `_` to indicate they are internal helpers.
  // They accept `userData` to prevent extra database calls.

  /**
   * 🔒 INTERNAL HELPER: Builds subscription status from existing user data.
   * 🚀 NO DATABASE CALL HERE.
   */
  static _getSubscriptionStatusFromData(userId, userData) {
    const subscriptionLevel = userData.accountType?.toLowerCase() || 'free';
    const config = this.getSubscriptionConfig(subscriptionLevel);

    return {
      userId,
      subscriptionLevel,
      hasEnterpriseAccess: this.hasEnterpriseAccessForLevel(subscriptionLevel),
      features: config.features,
      limits: {
        maxTeams: config.maxTeams,
        maxMembers: config.maxMembers,
        maxContacts: config.maxContacts
      },
      canUpgrade: !this.hasEnterpriseAccessForLevel(subscriptionLevel),
      nextTier: this.getNextSubscriptionTier(subscriptionLevel),
      enterprise: userData.enterprise || null
    };
  }

  /**
   * 🔒 INTERNAL HELPER: Builds feature access from existing status object.
   * 🚀 NO DATABASE CALL HERE.
   */
  static _getFeatureAccessFromData(status) {
    return {
      subscriptionLevel: status.subscriptionLevel,
      hasEnterpriseAccess: status.hasEnterpriseAccess,
      features: status.features,
      featureMap: status.features.reduce((map, feature) => {
        map[feature] = true;
        return map;
      }, {}),
      limits: status.limits
    };
  }

 /**
 * 🔒 INTERNAL HELPER: Builds operation permissions from existing user data.
 * 🚀 NO DATABASE CALLS IN LOOP. THIS IS NOW A SYNCHRONOUS FUNCTION.
 */
static _getOperationPermissionsFromData(userId, userData, status) { // REMOVED async keyword
  const userRole = this.getUserRole(userData);
  
  const operations = [
    'create_team', 'invite_member', 'share_contacts', 
    'bulk_share_contacts', 'remove_member', 'update_member_role', 'view_audit_logs',
    'view_analytics' // Ensure this is in the list
  ];

  const permissions = {};
  for (const operation of operations) {
    // ✅ THE FIX: Call the synchronous helper WITHOUT 'await'
    const result = this._validateEnterpriseOperationFromData(userData, operation, {});
    permissions[operation] = {
      allowed: result.allowed,
      reason: result.reason,
      code: result.code
    };
  }

  return {
    userId,
    subscriptionLevel: status.subscriptionLevel,
    userRole,
    permissions,
    limits: status.limits,
    features: status.features
  };
}


/**
 * 🔒 INTERNAL HELPER: Validates operation from existing user data.
 * 🚀 NO DATABASE CALL HERE. THIS IS NOW A SYNCHRONOUS FUNCTION.
 */
static _validateEnterpriseOperationFromData(userData, operation, context = {}) { // REMOVED async keyword
    const subscriptionLevel = userData.accountType?.toLowerCase() || 'free';
    const userRole = this.getUserRole(userData);
    const config = this.getSubscriptionConfig(subscriptionLevel);

    // This is a simple permission check based on subscription level
    if (operation === 'view_analytics') {
      // ✅ Example: Allow Pro, Premium, and Enterprise plans to view analytics
      const canAccess = ['pro', 'premium', 'enterprise'].includes(subscriptionLevel);
      return {
        allowed: canAccess,
        reason: canAccess ? null : 'Analytics requires a Pro plan or higher.'
      };
    }

    // This is a simple permission check based on subscription level AND role
    if (operation === 'manage_team_permissions') {
        const canAccess = (subscriptionLevel === 'enterprise') && ['owner', 'manager'].includes(userRole);
        return {
            allowed: canAccess,
            reason: canAccess ? null : 'Managing permissions requires an Enterprise plan and Manager role.'
        };
    }

    // The rest of the logic can use the existing validateSpecificOperation,
    // which should also be synchronous.
    return this.validateSpecificOperation(
      operation, subscriptionLevel, userRole, context, config
    );
}



  // ==================== CORE VALIDATION METHODS ====================

  /**
   * 🔒 SERVER-SIDE: Check if user has enterprise access
   * MOVED FROM CLIENT - prevents manipulation
   */
  static async hasEnterpriseAccess(userId) {
    try {
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      if (!userDoc.exists) return false;

      const userData = userDoc.data();
      const subscriptionLevel = userData.accountType?.toLowerCase() || 'free';
      
      return subscriptionLevel === this.SUBSCRIPTION_LEVELS.ENTERPRISE;
    } catch (error) {
      console.error('Error checking enterprise access:', error);
      return false;
    }
  }

  /**
   * 🔒 SERVER-SIDE: Validate if user can perform enterprise operation
   * MOVED FROM CLIENT - prevents bypassing business rules
   */
  static async validateEnterpriseOperation(userId, operation, context = {}) {
    try {
      console.log('🔍 Validating enterprise operation:', { userId, operation, context });

      // Get user data
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      if (!userDoc.exists) {
        return {
          allowed: false,
          reason: 'User not found',
          code: 'USER_NOT_FOUND'
        };
      }

      const userData = userDoc.data();
      const subscriptionLevel = userData.accountType?.toLowerCase() || 'free';
      const userRole = this.getUserRole(userData);
      const config = this.getSubscriptionConfig(subscriptionLevel);

      // Basic enterprise access check
      if (!this.hasEnterpriseAccessForLevel(subscriptionLevel)) {
        return {
          allowed: false,
          reason: 'Enterprise features require Enterprise subscription',
          upgradeRequired: true,
          requiredLevel: this.SUBSCRIPTION_LEVELS.ENTERPRISE,
          currentLevel: subscriptionLevel,
          code: 'SUBSCRIPTION_REQUIRED'
        };
      }

      // Operation-specific validations
      const operationResult = await this.validateSpecificOperation(
        operation, 
        subscriptionLevel, 
        userRole, 
        context, 
        config
      );

      if (!operationResult.allowed) {
        // Log permission violation for security
        await EnterpriseSecurityService.logSecurityEvent({
          userId,
          action: 'OPERATION_DENIED',
          details: {
            operation,
            reason: operationResult.reason,
            subscriptionLevel,
            userRole
          },
          severity: 'MEDIUM',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        });
      }

      return operationResult;

    } catch (error) {
      console.error('Error validating enterprise operation:', error);
      return {
        allowed: false,
        reason: 'Validation error occurred',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * 🔒 SERVER-SIDE: Get user's subscription status with validation
   */
  static async getSubscriptionStatus(userId) {
    try {
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const subscriptionLevel = userData.accountType?.toLowerCase() || 'free';
      const config = this.getSubscriptionConfig(subscriptionLevel);

      return {
        userId,
        subscriptionLevel,
        hasEnterpriseAccess: this.hasEnterpriseAccessForLevel(subscriptionLevel),
        features: config.features,
        limits: {
          maxTeams: config.maxTeams,
          maxMembers: config.maxMembers,
          maxContacts: config.maxContacts
        },
        canUpgrade: !this.hasEnterpriseAccessForLevel(subscriptionLevel),
        nextTier: this.getNextSubscriptionTier(subscriptionLevel),
        enterprise: userData.enterprise || null
      };

    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw error;
    }
  }

  /**
   * 🔒 SERVER-SIDE: Get available features for user
   */
  static async getFeatureAccess(userId) {
    try {
      const status = await this.getSubscriptionStatus(userId);
      
      return {
        subscriptionLevel: status.subscriptionLevel,
        hasEnterpriseAccess: status.hasEnterpriseAccess,
        features: status.features,
        featureMap: status.features.reduce((map, feature) => {
          map[feature] = true;
          return map;
        }, {}),
        limits: status.limits
      };

    } catch (error) {
      console.error('Error getting feature access:', error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Check if subscription level has enterprise access (static method)
   */
  static hasEnterpriseAccessForLevel(subscriptionLevel) {
    const level = subscriptionLevel?.toLowerCase();
    return level === this.SUBSCRIPTION_LEVELS.ENTERPRISE;
  }

  /**
   * Get subscription configuration
   */
  static getSubscriptionConfig(subscriptionLevel) {
    const level = subscriptionLevel?.toLowerCase();
    return this.SUBSCRIPTION_FEATURES[level] || this.SUBSCRIPTION_FEATURES[this.SUBSCRIPTION_LEVELS.FREE];
  }

  /**
   * Get user's role from user data
   */
  static getUserRole(userData) {
    const enterprise = userData.enterprise || {};
    return enterprise.organizationRole || 'employee';
  }

  /**
   * Get next subscription tier for upgrades
   */
  static getNextSubscriptionTier(currentLevel) {
    const current = this.SUBSCRIPTION_HIERARCHY[currentLevel?.toLowerCase()] || 0;
    const tiers = Object.keys(this.SUBSCRIPTION_HIERARCHY);
    
    for (const tier of tiers) {
      if (this.SUBSCRIPTION_HIERARCHY[tier] > current) {
        return tier;
      }
    }
    
    return null; // Already at highest tier
  }

  /**
   * Validate specific operation types
   */
  static async validateSpecificOperation(operation, subscriptionLevel, userRole, context, config) {
    switch (operation) {
      case 'create_team':
        return this.validateCreateTeam(subscriptionLevel, userRole, context, config);
      
      case 'invite_member':
        return this.validateInviteMember(subscriptionLevel, userRole, context, config);
      
      case 'share_contacts':
        return this.validateShareContacts(subscriptionLevel, userRole, context, config);
      
      case 'bulk_share_contacts':
        return this.validateBulkShareContacts(subscriptionLevel, userRole, context, config);
      
      case 'remove_member':
      case 'update_member_role':
        return this.validateMemberManagement(subscriptionLevel, userRole, context, config);
      
      case 'view_audit_logs':
        return this.validateViewAuditLogs(subscriptionLevel, userRole, context, config);
      
      default:
        return { allowed: true, reason: null };
    }
  }

  /**
   * Validate team creation
   */
  static validateCreateTeam(subscriptionLevel, userRole, context, config) {
    if (!this.hasFeatureForLevel(subscriptionLevel, this.ENTERPRISE_FEATURES.UNLIMITED_TEAMS)) {
      const currentTeams = context.currentTeams || 0;
      if (currentTeams >= config.maxTeams) {
        return {
          allowed: false,
          reason: `Team limit reached (${config.maxTeams}). Upgrade for unlimited teams.`,
          limitReached: true,
          requiredLevel: this.SUBSCRIPTION_LEVELS.ENTERPRISE,
          code: 'TEAM_LIMIT_REACHED'
        };
      }
    }

    if (!['owner', 'manager'].includes(userRole)) {
      return {
        allowed: false,
        reason: 'Only organization owners and managers can create teams',
        permissionRequired: true,
        code: 'INSUFFICIENT_ROLE'
      };
    }

    return { allowed: true, reason: null };
  }

  /**
   * Validate member invitation
   */
  static validateInviteMember(subscriptionLevel, userRole, context, config) {
    const currentTeamSize = context.currentTeamSize || 0;
    const newMembersCount = context.newMembersCount || 1;
    
    if (!this.hasFeatureForLevel(subscriptionLevel, this.ENTERPRISE_FEATURES.UNLIMITED_TEAMS)) {
      if (currentTeamSize + newMembersCount > config.maxMembers) {
        return {
          allowed: false,
          reason: `Team size limit reached (${config.maxMembers}). Upgrade for larger teams.`,
          limitReached: true,
          requiredLevel: this.SUBSCRIPTION_LEVELS.ENTERPRISE,
          code: 'MEMBER_LIMIT_REACHED'
        };
      }
    }

    if (!['owner', 'manager', 'team_lead'].includes(userRole)) {
      return {
        allowed: false,
        reason: 'Only managers and team leads can invite members',
        permissionRequired: true,
        code: 'INSUFFICIENT_ROLE'
      };
    }

    return { allowed: true, reason: null };
  }

  /**
   * Validate contact sharing
   */
  static validateShareContacts(subscriptionLevel, userRole, context, config) {
    if (!this.hasFeatureForLevel(subscriptionLevel, this.ENTERPRISE_FEATURES.CONTACT_SHARING)) {
      return {
        allowed: false,
        reason: 'Contact sharing requires Enterprise subscription',
        upgradeRequired: true,
        requiredLevel: this.SUBSCRIPTION_LEVELS.ENTERPRISE,
        code: 'FEATURE_NOT_AVAILABLE'
      };
    }

    return { allowed: true, reason: null };
  }

  /**
   * Validate bulk contact sharing
   */
  static validateBulkShareContacts(subscriptionLevel, userRole, context, config) {
    if (!this.hasFeatureForLevel(subscriptionLevel, this.ENTERPRISE_FEATURES.BULK_CONTACT_SHARING)) {
      return {
        allowed: false,
        reason: 'Bulk contact sharing requires Enterprise subscription',
        upgradeRequired: true,
        requiredLevel: this.SUBSCRIPTION_LEVELS.ENTERPRISE,
        code: 'FEATURE_NOT_AVAILABLE'
      };
    }

    return { allowed: true, reason: null };
  }

  /**
   * Validate member management operations
   */
  static validateMemberManagement(subscriptionLevel, userRole, context, config) {
    if (!['owner', 'manager'].includes(userRole)) {
      return {
        allowed: false,
        reason: 'Only managers can remove members or update roles',
        permissionRequired: true,
        code: 'INSUFFICIENT_ROLE'
      };
    }

    return { allowed: true, reason: null };
  }

  /**
   * Validate audit log viewing
   */
  static validateViewAuditLogs(subscriptionLevel, userRole, context, config) {
    if (!this.hasFeatureForLevel(subscriptionLevel, this.ENTERPRISE_FEATURES.AUDIT_LOGS)) {
      return {
        allowed: false,
        reason: 'Audit logs require Premium subscription or higher',
        upgradeRequired: true,
        requiredLevel: this.SUBSCRIPTION_LEVELS.PREMIUM,
        code: 'FEATURE_NOT_AVAILABLE'
      };
    }

    return { allowed: true, reason: null };
  }

  /**
   * Check if subscription level has specific feature
   */
  static hasFeatureForLevel(subscriptionLevel, feature) {
    const config = this.getSubscriptionConfig(subscriptionLevel);
    return config.features.includes(feature);
  }

  /**
   * 🔒 SERVER-SIDE: Get operation permissions for user
   * Returns what operations the user can perform
   */
  static async getOperationPermissions(userId) {
    try {
      const status = await this.getSubscriptionStatus(userId);
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      const userData = userDoc.data();
      const userRole = this.getUserRole(userData);
      
      // Test all common operations
      const operations = [
        'create_team',
        'invite_member',
        'share_contacts',
        'bulk_share_contacts',
        'remove_member',
        'update_member_role',
        'view_audit_logs'
      ];

      const permissions = {};
      
      for (const operation of operations) {
        const result = await this.validateEnterpriseOperation(userId, operation, {});
        permissions[operation] = {
          allowed: result.allowed,
          reason: result.reason,
          code: result.code
        };
      }

      return {
        userId,
        subscriptionLevel: status.subscriptionLevel,
        userRole,
        permissions,
        limits: status.limits,
        features: status.features
      };

    } catch (error) {
      console.error('Error getting operation permissions:', error);
      throw error;
    }
  }
}

// Export constants for use in API routes
export const {
  SUBSCRIPTION_LEVELS,
  SUBSCRIPTION_HIERARCHY,
  ENTERPRISE_FEATURES,
  SUBSCRIPTION_FEATURES
} = SubscriptionManager;