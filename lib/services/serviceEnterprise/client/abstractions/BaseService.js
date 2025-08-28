// lib/services/serviceEnterprise/client/abstractions/BaseService.js
// Phase 3: Base abstraction for all enterprise services

"use client"
import { EnterpriseApiClient } from '../core/apiClient';
import { globalCache } from '../core/cacheManager';
import { ErrorHandler } from '../core/errorHandler';

export class BaseService {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.cachePrefix = serviceName.toLowerCase();
  }

  // Standard cache key generation
  getCacheKey(operation, params = {}) {
    const paramString = Object.keys(params).length > 0 
      ? '_' + Object.values(params).join('_')
      : '';
    return `${this.cachePrefix}_${operation}${paramString}`;
  }

  // Standard cached request pattern
  async cachedRequest(operation, requestFn, category = 'default', params = {}) {
    const cacheKey = this.getCacheKey(operation, params);
    
    try {
      // Check cache first
      const cached = globalCache.get(cacheKey);
      if (cached) {
        console.log(`Cache hit: ${cacheKey}`);
        return cached;
      }

      // Execute request
      const result = await requestFn();
      
      // Cache result
      globalCache.set(cacheKey, result, category);
      console.log(`Cached result: ${cacheKey}`);
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, `${this.serviceName}.${operation}`);
      throw new Error(handled.message);
    }
  }

  // Standard invalidation patterns
  invalidateCache(patterns = []) {
    if (patterns.length === 0) {
      patterns = [this.cachePrefix];
    }
    
    patterns.forEach(pattern => {
      globalCache.invalidate(pattern);
    });
  }

  // Validate required parameters
  validateParams(params, required = []) {
    for (const param of required) {
      if (!params[param]) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }
}

// lib/services/serviceEnterprise/client/interfaces/ISubscriptionService.js
// Phase 3: Interface definitions for better type safety and documentation

export const ISubscriptionService = {
  // Core subscription methods
  async getStatus() {
    throw new Error('Method must be implemented');
  },
  
  async validateOperation(operation, context) {
    throw new Error('Method must be implemented');
  },
  
  async getFeatures() {
    throw new Error('Method must be implemented');
  },

  async checkFeatures(features) {
    throw new Error('Method must be implemented');
  },

  async getOperationPermissions() {
    throw new Error('Method must be implemented');
  },

  // Convenience methods
  async hasEnterpriseAccess() {
    throw new Error('Method must be implemented');
  },

  async hasFeature(feature) {
    throw new Error('Method must be implemented');
  },

  async canPerformOperation(operation, context) {
    throw new Error('Method must be implemented');
  }
};

export const ITeamService = {
  // Team management
  async getUserTeams() {
    throw new Error('Method must be implemented');
  },

  async createTeam(teamData) {
    throw new Error('Method must be implemented');
  },

  async getTeamMembers(teamId) {
    throw new Error('Method must be implemented');
  },

  async updateMemberRole(teamId, memberId, newRole) {
    throw new Error('Method must be implemented');
  },

  async removeMember(teamId, memberId) {
    throw new Error('Method must be implemented');
  },

  // Permissions
  async getTeamPermissions(teamId) {
    throw new Error('Method must be implemented');
  },

  async updateTeamPermissions(teamId, permissions) {
    throw new Error('Method must be implemented');
  }
};

export const IInvitationService = {
  // Invitation management
  async sendInvitation(teamId, email, role) {
    throw new Error('Method must be implemented');
  },

  async getTeamInvitations(teamId) {
    throw new Error('Method must be implemented');
  },

  async resendInvitation(invitationId) {
    throw new Error('Method must be implemented');
  },

  async revokeInvitation(invitationId) {
    throw new Error('Method must be implemented');
  },

  async verifyInvitation(email, code) {
    throw new Error('Method must be implemented');
  },

  async acceptInvitation(invitationId) {
    throw new Error('Method must be implemented');
  },

  // Bulk operations
  async bulkResendInvitations(invitationIds) {
    throw new Error('Method must be implemented');
  },

  async bulkRevokeInvitations(invitationIds) {
    throw new Error('Method must be implemented');
  }
};

// lib/services/serviceEnterprise/client/services/EnhancedSubscriptionService.js
// Phase 3: Enhanced subscription service with proper abstractions

"use client"
import { BaseService } from '../abstractions/BaseService';
import { ISubscriptionService } from '../interfaces/ISubscriptionService';
import { EnterpriseApiClient } from '../core/apiClient';

export class EnhancedSubscriptionService extends BaseService {
  constructor() {
    super('SubscriptionService');
  }

  // Implement ISubscriptionService interface
  async getStatus() {
    return this.cachedRequest(
      'status',
      () => EnterpriseApiClient.get('/api/enterprise/subscription/status'),
      'subscriptionStatus'
    );
  }

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

  // Convenience methods with proper error handling
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

  // Enhanced methods with validation and retry logic
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

  // Batch validation for multiple operations
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

  // Cache management with granular control
  invalidateSubscriptionCache() {
    this.invalidateCache(['subscription_', 'feature_', 'operation_']);
  }

  invalidateFeatureCache() {
    this.invalidateCache(['feature_']);
  }

  invalidatePermissionCache() {
    this.invalidateCache(['operation_', 'permission_']);
  }
}

// lib/services/serviceEnterprise/client/services/EnhancedTeamService.js
// Phase 3: Enhanced team service with proper structure

"use client"
import { BaseService } from '../abstractions/BaseService';
import { ITeamService } from '../interfaces/ISubscriptionService';
import { EnterpriseApiClient } from '../core/apiClient';

export class EnhancedTeamService extends BaseService {
  constructor() {
    super('TeamService');
  }

  async getUserTeams() {
    return this.cachedRequest(
      'user_teams',
      () => EnterpriseApiClient.get('/api/enterprise/teams'),
      'teamData'
    );
  }

  async createTeam(teamData) {
    this.validateParams(teamData, ['name']);
    
    if (!teamData.name || teamData.name.trim().length < 2) {
      throw new Error('Team name must be at least 2 characters long');
    }

    const result = await EnterpriseApiClient.post('/api/enterprise/teams', {
      name: teamData.name.trim(),
      description: teamData.description?.trim() || '',
      settings: teamData.settings || {}
    });

    // Invalidate team-related caches
    this.invalidateTeamCaches();
    
    return result;
  }

  async getTeamMembers(teamId) {
    this.validateParams({ teamId }, ['teamId']);
    
    return this.cachedRequest(
      'members',
      () => EnterpriseApiClient.get(`/api/enterprise/teams/${teamId}/members`),
      'teamMembers',
      { teamId }
    );
  }

  async updateMemberRole(teamId, memberId, newRole) {
    this.validateParams({ teamId, memberId, newRole }, ['teamId', 'memberId', 'newRole']);
    
    const validRoles = ['employee', 'team_lead', 'manager', 'owner'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}. Must be one of: ${validRoles.join(', ')}`);
    }

    const result = await EnterpriseApiClient.put(
      `/api/enterprise/teams/${teamId}/members/${memberId}/role`,
      { role: newRole }
    );

    // Invalidate member-related caches
    this.invalidateMemberCaches(teamId);
    
    return result;
  }

  async removeMember(teamId, memberId) {
    this.validateParams({ teamId, memberId }, ['teamId', 'memberId']);
    
    const result = await EnterpriseApiClient.delete(
      `/api/enterprise/teams/${teamId}/members/${memberId}`
    );

    // Invalidate member-related caches
    this.invalidateMemberCaches(teamId);
    
    return result;
  }

  async getTeamPermissions(teamId) {
    this.validateParams({ teamId }, ['teamId']);
    
    return this.cachedRequest(
      'permissions',
      () => EnterpriseApiClient.get(`/api/enterprise/teams/${teamId}/permissions`),
      'permissions',
      { teamId }
    );
  }

  async updateTeamPermissions(teamId, permissions) {
    this.validateParams({ teamId, permissions }, ['teamId', 'permissions']);
    
    if (!permissions || typeof permissions !== 'object') {
      throw new Error('Permissions must be an object');
    }

    const result = await EnterpriseApiClient.put(
      `/api/enterprise/teams/${teamId}/permissions`,
      { permissions }
    );

    // Invalidate permission-related caches
    this.invalidatePermissionCaches(teamId);
    
    return result;
  }

  // Enhanced team management methods
  async getTeamDetails(teamId) {
    this.validateParams({ teamId }, ['teamId']);
    
    // Get both members and permissions in parallel
    const [members, permissions] = await Promise.all([
      this.getTeamMembers(teamId),
      this.getTeamPermissions(teamId).catch(() => null) // Graceful fallback
    ]);

    return {
      teamId,
      members: members.members || [],
      permissions: permissions?.permissions || null,
      memberCount: members.members?.length || 0,
      teamInfo: members.teamInfo || {}
    };
  }

  async bulkUpdateMemberRoles(teamId, roleUpdates) {
    this.validateParams({ teamId, roleUpdates }, ['teamId', 'roleUpdates']);
    
    if (!Array.isArray(roleUpdates)) {
      throw new Error('Role updates must be an array');
    }

    const results = await Promise.allSettled(
      roleUpdates.map(update => 
        this.updateMemberRole(teamId, update.memberId, update.newRole)
      )
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    return {
      total: roleUpdates.length,
      successful: successCount,
      failed: failureCount,
      results: results.map((result, index) => ({
        memberId: roleUpdates[index].memberId,
        newRole: roleUpdates[index].newRole,
        success: result.status === 'fulfilled',
        error: result.status === 'rejected' ? result.reason.message : null
      }))
    };
  }

  // Specialized cache management
  invalidateTeamCaches() {
    this.invalidateCache(['team_', 'user_teams']);
  }

  invalidateMemberCaches(teamId) {
    this.invalidateCache([
      `team_members_${teamId}`,
      `team_permissions_${teamId}`,
      'user_teams'
    ]);
  }

  invalidatePermissionCaches(teamId) {
    this.invalidateCache([
      `team_permissions_${teamId}`,
      `team_members_${teamId}`
    ]);
  }
}

// lib/services/serviceEnterprise/client/services/EnhancedInvitationService.js
// Phase 3: Enhanced invitation service with robust error handling

"use client"
import { BaseService } from '../abstractions/BaseService';
import { IInvitationService } from '../interfaces/ISubscriptionService';
import { EnterpriseApiClient } from '../core/apiClient';

export class EnhancedInvitationService extends BaseService {
  constructor() {
    super('InvitationService');
  }

  async sendInvitation(teamId, email, role) {
    this.validateParams({ teamId, email, role }, ['teamId', 'email', 'role']);
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Please provide a valid email address');
    }

    // Role validation
    const validRoles = ['employee', 'team_lead', 'manager'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
    }

    const result = await EnterpriseApiClient.post('/api/enterprise/invitations', {
      teamId,
      invitedEmail: email.trim().toLowerCase(),
      role
    });

    // Invalidate invitation caches
    this.invalidateInvitationCaches(teamId);
    
    return result;
  }

  async getTeamInvitations(teamId) {
    this.validateParams({ teamId }, ['teamId']);
    
    const result = await this.cachedRequest(
      'team_invitations',
      () => EnterpriseApiClient.get(`/api/enterprise/invitations?teamId=${teamId}`),
      'invitations',
      { teamId }
    );
    
    return result.invitations || [];
  }

  async resendInvitation(invitationId) {
    this.validateParams({ invitationId }, ['invitationId']);
    
    const result = await EnterpriseApiClient.patch('/api/enterprise/invitations', {
      invitationId,
      action: 'resend'
    });

    // Invalidate all invitation caches since we don't know the teamId
    this.invalidateAllInvitationCaches();
    
    return result;
  }

  async revokeInvitation(invitationId) {
    this.validateParams({ invitationId }, ['invitationId']);
    
    const result = await EnterpriseApiClient.delete(
      `/api/enterprise/invitations?invitationId=${invitationId}`
    );

    // Invalidate all invitation caches
    this.invalidateAllInvitationCaches();
    
    return result;
  }

  async verifyInvitation(email, code) {
    this.validateParams({ email, code }, ['email', 'code']);
    
    // Input validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Please provide a valid email address');
    }

    if (!code || code.trim().length !== 6) {
      throw new Error('Invitation code must be 6 characters long');
    }

    return EnterpriseApiClient.post('/api/enterprise/invitations/verify', {
      email: email.trim().toLowerCase(),
      code: code.trim().toUpperCase()
    });
  }

  async acceptInvitation(invitationId) {
    this.validateParams({ invitationId }, ['invitationId']);
    
    const result = await EnterpriseApiClient.post('/api/enterprise/invitations/accept', {
      action: 'accept',
      invitationId
    });

    // Clear all caches since user context will change significantly
    globalCache.clear();
    
    return result;
  }

  // Enhanced bulk operations with progress tracking
  async bulkResendInvitations(invitationIds, onProgress = null) {
    this.validateParams({ invitationIds }, ['invitationIds']);
    
    if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
      throw new Error('Invitation IDs must be a non-empty array');
    }

    // Process in batches for better performance and user feedback
    const batchSize = 5;
    const results = [];
    
    for (let i = 0; i < invitationIds.length; i += batchSize) {
      const batch = invitationIds.slice(i, i + batchSize);
      
      try {
        const batchResult = await EnterpriseApiClient.patch('/api/enterprise/invitations/bulk', {
          invitationIds: batch,
          action: 'resend'
        });
        
        results.push(...(batchResult.results || []));
        
        // Report progress
        if (onProgress) {
          onProgress({
            completed: Math.min(i + batchSize, invitationIds.length),
            total: invitationIds.length,
            currentBatch: Math.floor(i / batchSize) + 1,
            totalBatches: Math.ceil(invitationIds.length / batchSize)
          });
        }
        
      } catch (error) {
        // Add failed batch to results
        batch.forEach(id => {
          results.push({
            id,
            success: false,
            error: error.message
          });
        });
      }
    }

    this.invalidateAllInvitationCaches();
    
    return {
      total: invitationIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  async bulkRevokeInvitations(invitationIds, onProgress = null) {
    this.validateParams({ invitationIds }, ['invitationIds']);
    
    if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
      throw new Error('Invitation IDs must be a non-empty array');
    }

    // Similar batching strategy as bulk resend
    const batchSize = 10; // Can be more aggressive with deletes
    const results = [];
    
    for (let i = 0; i < invitationIds.length; i += batchSize) {
      const batch = invitationIds.slice(i, i + batchSize);
      
      try {
        const batchResult = await EnterpriseApiClient.delete('/api/enterprise/invitations/bulk', {
          body: { invitationIds: batch }
        });
        
        results.push(...(batchResult.results || []));
        
        if (onProgress) {
          onProgress({
            completed: Math.min(i + batchSize, invitationIds.length),
            total: invitationIds.length
          });
        }
        
      } catch (error) {
        batch.forEach(id => {
          results.push({
            id,
            success: false,
            error: error.message
          });
        });
      }
    }

    this.invalidateAllInvitationCaches();
    
    return {
      total: invitationIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  // Advanced invitation management
  async getInvitationStats(teamId) {
    const invitations = await this.getTeamInvitations(teamId);
    
    const now = new Date();
    const stats = {
      total: invitations.length,
      pending: 0,
      expired: 0,
      expiringSoon: 0, // Expires within 24 hours
      byRole: {},
      avgAge: 0
    };

    let totalAge = 0;
    
    invitations.forEach(invitation => {
      // Status counts
      if (invitation.status === 'pending') {
        stats.pending++;
        
        // Check if expiring soon
        const expiresAt = new Date(invitation.expiresAt);
        const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
        
        if (hoursUntilExpiry < 24 && hoursUntilExpiry > 0) {
          stats.expiringSoon++;
        }
      } else if (invitation.status === 'expired') {
        stats.expired++;
      }
      
      // Role distribution
      stats.byRole[invitation.role] = (stats.byRole[invitation.role] || 0) + 1;
      
      // Age calculation
      const createdAt = new Date(invitation.createdAt);
      totalAge += (now - createdAt) / (1000 * 60 * 60 * 24); // Days
    });

    stats.avgAge = invitations.length > 0 ? Math.round(totalAge / invitations.length) : 0;
    
    return stats;
  }

  // Cache management
  invalidateInvitationCaches(teamId) {
    this.invalidateCache([`team_invitations_${teamId}`]);
  }

  invalidateAllInvitationCaches() {
    this.invalidateCache(['invitation_', 'team_invitations_']);
  }
}

// lib/services/serviceEnterprise/client/factories/ServiceFactory.js
// Phase 3: Factory pattern for service instantiation and dependency injection

"use client"
import { EnhancedSubscriptionService } from '../services/EnhancedSubscriptionService';
import { EnhancedTeamService } from '../services/EnhancedTeamService';
import { EnhancedInvitationService } from '../services/EnhancedInvitationService';

export class ServiceFactory {
  static services = new Map();

  static getSubscriptionService() {
    if (!this.services.has('subscription')) {
      this.services.set('subscription', new EnhancedSubscriptionService());
    }
    return this.services.get('subscription');
  }

  static getTeamService() {
    if (!this.services.has('team')) {
      this.services.set('team', new EnhancedTeamService());
    }
    return this.services.get('team');
  }

  static getInvitationService() {
    if (!this.services.has('invitation')) {
      this.services.set('invitation', new EnhancedInvitationService());
    }
    return this.services.get('invitation');
  }

  // Service health checking
  static async checkServiceHealth() {
    const services = ['subscription', 'team', 'invitation'];
    const results = {};

    for (const serviceName of services) {
      try {
        const service = this.services.get(serviceName);
        if (service) {
          // Basic connectivity test
          await service.cachedRequest('health', () => 
            Promise.resolve({ status: 'healthy', timestamp: new Date().toISOString() })
          );
          results[serviceName] = { healthy: true, error: null };
        } else {
          results[serviceName] = { healthy: true, error: 'Not instantiated' };
        }
      } catch (error) {
        results[serviceName] = { healthy: false, error: error.message };
      }
    }

    return results;
  }

  // Clear all service instances (useful for testing or reset)
  static resetServices() {
    this.services.clear();
  }
}

// lib/services/serviceEnterprise/client/enhanced-index.js
// Phase 3: Enhanced exports with proper abstractions

"use client"

// Factory for service instantiation
export { ServiceFactory } from './factories/ServiceFactory';

// Enhanced services with full abstractions
export { EnhancedSubscriptionService } from './services/EnhancedSubscriptionService';
export { EnhancedTeamService } from './services/EnhancedTeamService';
export { EnhancedInvitationService } from './services/EnhancedInvitationService';

// Base abstractions for extending
export { BaseService } from './abstractions/BaseService';

// Interfaces for type checking
export { 
  ISubscriptionService, 
  ITeamService, 
  IInvitationService 
} from './interfaces/ISubscriptionService';

// Core infrastructure (from Phase 2)
export { EnterpriseApiClient, EnterpriseApiError } from './core/apiClient';
export { CacheManager, globalCache } from './core/cacheManager';
export { ErrorHandler } from './core/errorHandler';

// Convenience exports using factory pattern
export const subscriptionService = () => ServiceFactory.getSubscriptionService();
export const teamService = () => ServiceFactory.getTeamService();
export const invitationService = () => ServiceFactory.getInvitationService();

// Legacy compatibility hooks (to be phased out in Phase 4)
export {
  useEnterpriseData,
  useOptimizedTeamData
} from './transitionService';

// Constants
export {
  TEAM_ROLES,
  PERMISSIONS,
  ORGANIZATION_ROLES,
  INVITATION_STATUS
} from '../constants/enterpriseConstants';