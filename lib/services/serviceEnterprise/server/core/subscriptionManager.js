// lib/services/serviceEnterprise/server/core/subscriptionManager.js
// Fixed: Updated import path for EnterpriseSecurityService

import { adminDb } from '@/lib/firebaseAdmin';
import { EnterpriseSecurityService } from '../enterpriseSecurityService';

/**
 * Server-Side Subscription Manager
 * Contains ALL subscription validation and business logic
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

  // ==================== OPTIMIZED HIGH-LEVEL METHOD ====================

  static async getComprehensiveStatus(userId) {
    try {
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }
      const userData = userDoc.data();

      const subscriptionStatus = this._getSubscriptionStatusFromData(userId, userData);
      const featureAccess = this._getFeatureAccessFromData(subscriptionStatus);
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

  // ==================== INTERNAL HELPER METHODS ====================

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

  static _getOperationPermissionsFromData(userId, userData, status) {
    const userRole = this.getUserRole(userData);
    
    const operations = [
      'create_team', 'invite_member', 'share_contacts', 
      'bulk_share_contacts', 'remove_member', 'update_member_role', 'view_audit_logs',
      'view_analytics'
    ];

    const permissions = {};
    for (const operation of operations) {
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

  static _validateEnterpriseOperationFromData(userData, operation, context = {}) {
    const subscriptionLevel = userData.accountType?.toLowerCase() || 'free';
    const userRole = this.getUserRole(userData);
    const config = this.getSubscriptionConfig(subscriptionLevel);

    if (operation === 'view_analytics') {
      const canAccess = ['pro', 'premium', 'enterprise'].includes(subscriptionLevel);
      return {
        allowed: canAccess,
        reason: canAccess ? null : 'Analytics requires a Pro plan or higher.',
        code: canAccess ? 'ALLOWED' : 'SUBSCRIPTION_REQUIRED'
      };
    }

    if (operation === 'manage_team_permissions') {
      const canAccess = (subscriptionLevel === 'enterprise') && ['owner', 'manager'].includes(userRole);
      return {
        allowed: canAccess,
        reason: canAccess ? null : 'Managing permissions requires an Enterprise plan and Manager role.',
        code: canAccess ? 'ALLOWED' : 'SUBSCRIPTION_AND_ROLE_REQUIRED'
      };
    }

    return this.validateSpecificOperation(
      operation, subscriptionLevel, userRole, context, config
    );
  }

  // ==================== CORE VALIDATION METHODS ====================

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

  static async validateEnterpriseOperation(userId, operation, context = {}) {
    try {
      console.log('Validating enterprise operation:', { userId, operation, context });

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

      const operationResult = this.validateSpecificOperation(
        operation, 
        subscriptionLevel, 
        userRole, 
        context, 
        config
      );

      // Log permission violations using the correct import
      if (!operationResult.allowed) {
        try {
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
        } catch (auditError) {
          console.warn('Failed to log security event:', auditError.message);
        }
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

  // ==================== HELPER METHODS ====================

  static hasEnterpriseAccessForLevel(subscriptionLevel) {
    const level = subscriptionLevel?.toLowerCase();
    return level === this.SUBSCRIPTION_LEVELS.ENTERPRISE;
  }

  static getSubscriptionConfig(subscriptionLevel) {
    const level = subscriptionLevel?.toLowerCase();
    return this.SUBSCRIPTION_FEATURES[level] || this.SUBSCRIPTION_FEATURES[this.SUBSCRIPTION_LEVELS.FREE];
  }

  static getUserRole(userData) {
    const enterprise = userData.enterprise || {};
    return enterprise.organizationRole || 'employee';
  }

  static getNextSubscriptionTier(currentLevel) {
    const current = this.SUBSCRIPTION_HIERARCHY[currentLevel?.toLowerCase()] || 0;
    const tiers = Object.keys(this.SUBSCRIPTION_HIERARCHY);
    
    for (const tier of tiers) {
      if (this.SUBSCRIPTION_HIERARCHY[tier] > current) {
        return tier;
      }
    }
    
    return null;
  }

  static validateSpecificOperation(operation, subscriptionLevel, userRole, context, config) {
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
        return { allowed: true, reason: null, code: 'ALLOWED' };
    }
  }

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

    return { allowed: true, reason: null, code: 'ALLOWED' };
  }

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

    return { allowed: true, reason: null, code: 'ALLOWED' };
  }

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

    return { allowed: true, reason: null, code: 'ALLOWED' };
  }

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

    return { allowed: true, reason: null, code: 'ALLOWED' };
  }

  static validateMemberManagement(subscriptionLevel, userRole, context, config) {
    if (!['owner', 'manager'].includes(userRole)) {
      return {
        allowed: false,
        reason: 'Only managers can remove members or update roles',
        permissionRequired: true,
        code: 'INSUFFICIENT_ROLE'
      };
    }

    return { allowed: true, reason: null, code: 'ALLOWED' };
  }

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

    return { allowed: true, reason: null, code: 'ALLOWED' };
  }

  static hasFeatureForLevel(subscriptionLevel, feature) {
    const config = this.getSubscriptionConfig(subscriptionLevel);
    return config.features.includes(feature);
  }
}

// Export constants for use in API routes
export const {
  SUBSCRIPTION_LEVELS,
  SUBSCRIPTION_HIERARCHY,
  ENTERPRISE_FEATURES,
  SUBSCRIPTION_FEATURES
} = SubscriptionManager;