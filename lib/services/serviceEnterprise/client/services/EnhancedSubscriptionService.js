// lib/services/serviceEnterprise/client/services/EnhancedSubscriptionService.js
// Phase 3: Complete subscription service with all subscription-related functions

"use client"
import { BaseService } from '../abstractions/BaseService';
import { ISubscriptionService } from '../interfaces/ISubscriptionService';
import { EnterpriseApiClient } from '../core/apiClient';

export class EnhancedSubscriptionService extends BaseService {
  constructor() {
    super('SubscriptionService');
  }

  // ==================== CORE SUBSCRIPTION OPERATIONS ====================

  async getStatus() {
    return this.cachedRequest(
      'status',
      () => EnterpriseApiClient.get('/api/enterprise/subscription/status'),
      'subscriptionStatus'
    );
  }

  async getEnterpriseSubscriptionStatus() {
    return this.cachedRequest(
      'enterprise_status',
      async () => {
        const response = await EnterpriseApiClient.get('/api/enterprise/subscription/status');
        
        // Enrich with client-side calculations
        const subscriptionLevel = response.accountType || 'free';
        const config = this.getSubscriptionConfig(subscriptionLevel);
        
        return {
          // Basic subscription info
          accountType: subscriptionLevel,
          hasEnterpriseAccess: this.hasEnterpriseAccessForLevel(subscriptionLevel),
          
          // Feature availability
          features: config.features,
          enterpriseFeatures: config.features.filter(f => 
            Object.values(this.getEnterpriseFeatures()).includes(f)
          ),
          
          // Limits
          limits: {
            maxTeams: config.maxTeams,
            maxMembers: config.maxMembers,
            maxContacts: config.maxContacts
          },
          
          // User context (from API)
          user: response.user || null,
          organization: response.organization || null,
          teams: response.teams || {},
          
          // Upgrade information
          upgradeMessage: response.upgradeMessage || null,
          canUpgrade: !this.hasEnterpriseAccessForLevel(subscriptionLevel),
          nextTier: this.getNextSubscriptionTier(subscriptionLevel),
          
          // Raw response for backward compatibility
          ...response
        };
      },
      'subscriptionStatus'
    );
  }

  async getUserContext() {
    return this.cachedRequest(
      'user_context',
      async () => {
        const response = await EnterpriseApiClient.get('/api/enterprise/user/context');
        return response.userContext;
      },
      'userContext'
    );
  }

  // ==================== VALIDATION & PERMISSIONS ====================

  async validateOperation(operation, context = {}) {
    this.validateParams({ operation }, ['operation']);
    
    const requestData = {
      operation,
      context: {
        ...context,
        ...EnterpriseApiClient.getRequestMetadata()
      }
    };

    return EnterpriseApiClient.post('/api/enterprise/validate-operation', requestData);
  }

  async validateEnterpriseOperation(operation, context = {}) {
    return this.validateOperation(operation, context);
  }

  // ==================== FEATURES & ACCESS ====================

  async getFeatures() {
    return this.cachedRequest(
      'features',
      () => EnterpriseApiClient.get('/api/enterprise/features'),
      'subscriptionStatus'
    );
  }

  async checkFeatures(features) {
    this.validateParams({ features }, ['features']);
    
    if (!Array.isArray(features)) {
      throw new Error('Features must be an array');
    }

    const result = await EnterpriseApiClient.post('/api/enterprise/features/check', {
      features
    });
    
    return result.featureChecks;
  }

  async getOperationPermissions() {
    return this.cachedRequest(
      'permissions',
      () => EnterpriseApiClient.get('/api/enterprise/operations/permissions'),
      'permissions'
    );
  }

  // ==================== CONVENIENCE METHODS ====================

  async hasEnterpriseAccess() {
    try {
      const status = await this.getStatus();
      return status.hasEnterpriseAccess || false;
    } catch (error) {
      console.error('Error checking enterprise access:', error);
      return false;
    }
  }

  async hasFeature(feature) {
    try {
      if (!feature || typeof feature !== 'string') {
        throw new Error('Feature must be a non-empty string');
      }

      const features = await this.checkFeatures([feature]);
      return features[feature] || false;
    } catch (error) {
      console.error('Error checking feature:', error);
      return false;
    }
  }

  async canPerformOperation(operation, context = {}) {
    try {
      const result = await this.validateOperation(operation, context);
      return result.allowed || false;
    } catch (error) {
      console.error('Error checking operation:', error);
      return false;
    }
  }

  // ==================== BATCH OPERATIONS ====================

  async getEnterpriseDataBatch() {
    return this.cachedRequest(
      'enterprise_batch',
      async () => {
        console.log('🚀 Executing BATCH enterprise data fetch');
        
        // Parallel fetch of all core data using class methods
        const [subscriptionStatus, userContext, userTeams] = await Promise.allSettled([
          this.getEnterpriseSubscriptionStatus(),
          this.getUserContext(),
          this.getUserTeams()
        ]);

        // Process results and handle any failures gracefully
        const result = {
          subscriptionStatus: subscriptionStatus.status === 'fulfilled' ? subscriptionStatus.value : null,
          userContext: userContext.status === 'fulfilled' ? userContext.value : null,
          userTeams: userTeams.status === 'fulfilled' ? userTeams.value : { teams: [] },
          errors: []
        };

        // Collect any errors for debugging
        [subscriptionStatus, userContext, userTeams].forEach((promiseResult, index) => {
          if (promiseResult.status === 'rejected') {
            const errorNames = ['subscriptionStatus', 'userContext', 'userTeams'];
            result.errors.push({
              service: errorNames[index],
              error: promiseResult.reason.message
            });
          }
        });

        console.log('✅ BATCH enterprise data completed:', {
          hasSubscription: !!result.subscriptionStatus,
          hasUserContext: !!result.userContext,
          teamsCount: result.userTeams.teams?.length || 0,
          errorCount: result.errors.length
        });

        return result;
      },
      'batchData'
    );
  }

  async getUserTeams() {
    return this.cachedRequest(
      'user_teams',
      async () => {
        const response = await EnterpriseApiClient.get('/api/enterprise/teams');
        
        // Transform teams object to array for consistency
        let teamsArray = [];
        if (response.teams && typeof response.teams === 'object') {
          teamsArray = Object.keys(response.teams).map(teamId => ({
            id: teamId,
            ...response.teams[teamId]
          }));
        } else if (Array.isArray(response.teams)) {
          teamsArray = response.teams;
        }
        
        return {
          ...response,
          teams: teamsArray
        };
      },
      'teamData'
    );
  }

  // ==================== ENHANCED METHODS WITH RETRY LOGIC ====================

  async getStatusWithRetry(maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.getStatus();
      } catch (error) {
        lastError = error;
        console.warn(`Subscription status attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError;
  }

  async validateMultipleOperations(operations) {
    this.validateParams({ operations }, ['operations']);
    
    if (!Array.isArray(operations)) {
      throw new Error('Operations must be an array');
    }

    const results = await Promise.allSettled(
      operations.map(op => this.validateOperation(op.operation, op.context))
    );

    return results.map((result, index) => ({
      operation: operations[index].operation,
      success: result.status === 'fulfilled',
      result: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }

  // ==================== SUBSCRIPTION LEVEL DEFINITIONS (CLIENT-SIDE) ====================

  getSubscriptionLevels() {
    return {
      FREE: 'free',
      BASE: 'base', 
      PRO: 'pro',
      PREMIUM: 'premium',
      ENTERPRISE: 'enterprise'
    };
  }

  getSubscriptionHierarchy() {
    const levels = this.getSubscriptionLevels();
    return {
      [levels.FREE]: 0,
      [levels.BASE]: 1,
      [levels.PRO]: 2,
      [levels.PREMIUM]: 3,
      [levels.ENTERPRISE]: 4
    };
  }

  getEnterpriseFeatures() {
    return {
      UNLIMITED_TEAMS: 'unlimited_teams',
      TEAM_ROLES: 'team_roles',
      TEAM_PERMISSIONS: 'team_permissions',
      CONTACT_SHARING: 'contact_sharing',
      BULK_CONTACT_SHARING: 'bulk_contact_sharing',
      ADVANCED_SHARING_CONTROLS: 'advanced_sharing_controls',
      ORGANIZATION_MANAGEMENT: 'organization_management',
      AUDIT_LOGS: 'audit_logs',
      ADVANCED_SECURITY: 'advanced_security',
      UNLIMITED_CONTACTS: 'unlimited_contacts',
      PRIORITY_SUPPORT: 'priority_support',
      CUSTOM_INTEGRATIONS: 'custom_integrations'
    };
  }

  getSubscriptionFeatures() {
    const levels = this.getSubscriptionLevels();
    const features = this.getEnterpriseFeatures();
    
    return {
      [levels.FREE]: {
        maxTeams: 0,
        maxMembers: 0,
        maxContacts: 100,
        features: []
      },
      [levels.BASE]: {
        maxTeams: 0,
        maxMembers: 0,
        maxContacts: 500,
        features: []
      },
      [levels.PRO]: {
        maxTeams: 0,
        maxMembers: 0,
        maxContacts: 2000,
        features: [features.CONTACT_SHARING]
      },
      [levels.PREMIUM]: {
        maxTeams: 0,
        maxMembers: 0,
        maxContacts: 5000,
        features: [
          features.CONTACT_SHARING,
          features.BULK_CONTACT_SHARING,
          features.AUDIT_LOGS,
          features.PRIORITY_SUPPORT
        ]
      },
      [levels.ENTERPRISE]: {
        maxTeams: -1, // Unlimited
        maxMembers: -1, // Unlimited
        maxContacts: -1, // Unlimited
        features: Object.values(features)
      }
    };
  }

  // ==================== UTILITY METHODS ====================

  hasEnterpriseAccessForLevel(subscriptionLevel) {
    const level = subscriptionLevel?.toLowerCase();
    return level === this.getSubscriptionLevels().ENTERPRISE;
  }

  getSubscriptionConfig(subscriptionLevel) {
    const level = subscriptionLevel?.toLowerCase();
    const features = this.getSubscriptionFeatures();
    return features[level] || features[this.getSubscriptionLevels().FREE];
  }

  isSubscriptionHigherOrEqual(currentLevel, requiredLevel) {
    const hierarchy = this.getSubscriptionHierarchy();
    const current = hierarchy[currentLevel?.toLowerCase()] || 0;
    const required = hierarchy[requiredLevel?.toLowerCase()] || 0;
    return current >= required;
  }

  getNextSubscriptionTier(currentLevel) {
    const hierarchy = this.getSubscriptionHierarchy();
    const current = hierarchy[currentLevel?.toLowerCase()] || 0;
    const tiers = Object.keys(hierarchy);
    
    for (const tier of tiers) {
      if (hierarchy[tier] > current) {
        return tier;
      }
    }
    
    return null; // Already at highest tier
  }

  getUpgradeSuggestions(currentLevel, requiredFeatures = []) {
    const current = currentLevel?.toLowerCase();
    const suggestions = [];
    const subscriptionFeatures = this.getSubscriptionFeatures();
    
    for (const feature of requiredFeatures) {
      if (!this.hasFeatureForLevel(current, feature)) {
        // Find the minimum tier that has this feature
        for (const [tier, config] of Object.entries(subscriptionFeatures)) {
          if (config.features.includes(feature)) {
            suggestions.push({
              feature,
              requiredTier: tier,
              description: this.getFeatureDescription(feature)
            });
            break;
          }
        }
      }
    }
    
    return suggestions;
  }

  hasFeatureForLevel(subscriptionLevel, feature) {
    const config = this.getSubscriptionConfig(subscriptionLevel);
    return config.features.includes(feature);
  }

  getFeatureDescription(feature) {
    const features = this.getEnterpriseFeatures();
    const descriptions = {
      [features.UNLIMITED_TEAMS]: 'Create unlimited teams',
      [features.TEAM_ROLES]: 'Advanced team role management',
      [features.TEAM_PERMISSIONS]: 'Granular permission controls',
      [features.CONTACT_SHARING]: 'Share contacts with team members',
      [features.BULK_CONTACT_SHARING]: 'Bulk contact sharing operations',
      [features.ADVANCED_SHARING_CONTROLS]: 'Advanced contact sharing controls',
      [features.ORGANIZATION_MANAGEMENT]: 'Organization-wide management',
      [features.AUDIT_LOGS]: 'Detailed audit logging',
      [features.ADVANCED_SECURITY]: 'Advanced security features',
      [features.UNLIMITED_CONTACTS]: 'Unlimited contact storage',
      [features.PRIORITY_SUPPORT]: 'Priority customer support',
      [features.CUSTOM_INTEGRATIONS]: 'Custom integration support'
    };
    
    return descriptions[feature] || feature;
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  async initiateSubscriptionUpgrade(targetTier, returnUrl = null) {
    try {
      const result = await EnterpriseApiClient.post('/api/enterprise/subscription/upgrade', {
        targetTier,
        returnUrl: returnUrl || window.location.href
      });
      
      // Redirect to billing portal or checkout
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
      
      return result;
    } catch (error) {
      console.error('Error initiating subscription upgrade:', error);
      throw error;
    }
  }

  async cancelSubscription(reason = null) {
    try {
      const result = await EnterpriseApiClient.post('/api/enterprise/subscription/cancel', {
        reason
      });

      // Invalidate subscription caches
      this.invalidateSubscriptionCache();

      return result;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  // ==================== CACHE MANAGEMENT ====================

  invalidateSubscriptionCache() {
    this.invalidateCache(['subscription_', 'feature_', 'operation_']);
  }

  invalidateFeatureCache() {
    this.invalidateCache(['feature_']);
  }

  invalidatePermissionCache() {
    this.invalidateCache(['operation_', 'permission_']);
  }

  invalidateUserContextCache() {
    this.invalidateCache(['user_context', 'enterprise_batch']);
  }

  invalidateAllCaches() {
    this.invalidateCache(['subscription_', 'feature_', 'operation_', 'user_context', 'enterprise_batch', 'user_teams']);
  }
}