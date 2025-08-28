// lib/services/serviceEnterprise/client/core/apiClient.js
// 🎯 PHASE 2: Base API client with unified error handling and auth

"use client"
import { auth } from '@/important/firebase';

/**
 * Base API Client for all enterprise operations
 * Centralizes authentication, error handling, and request metadata
 */
export class EnterpriseApiClient {
  static async getAuthHeaders() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const token = await user.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  static getRequestMetadata() {
    return {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
  }

  static async makeRequest(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers: customHeaders = {},
      timeout = 10000
    } = options;

    try {
      // Get auth headers
      const authHeaders = await this.getAuthHeaders();
      const headers = { ...authHeaders, ...customHeaders };

      // Build request config
      const config = {
        method,
        headers,
        ...(body && { body: JSON.stringify(body) })
      };

      // Add timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      config.signal = controller.signal;

      // Make request
      const response = await fetch(endpoint, config);
      clearTimeout(timeoutId);

      // Handle response
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new EnterpriseApiError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData.code,
          errorData.details
        );
      }

      return await response.json();

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new EnterpriseApiError('Request timeout', 408, 'TIMEOUT');
      }
      
      if (error instanceof EnterpriseApiError) {
        throw error;
      }

      throw new EnterpriseApiError(
        error.message || 'Network error',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  // Convenience methods
  static async get(endpoint, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'GET' });
  }

  static async post(endpoint, body, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'POST', body });
  }

  static async put(endpoint, body, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'PUT', body });
  }

  static async patch(endpoint, body, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'PATCH', body });
  }

  static async delete(endpoint, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'DELETE' });
  }
}

/**
 * Custom error class for better error handling
 */
export class EnterpriseApiError extends Error {
  constructor(message, status = 0, code = null, details = null) {
    super(message);
    this.name = 'EnterpriseApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }

  get isNetworkError() {
    return this.status === 0 || this.code === 'NETWORK_ERROR';
  }

  get isServerError() {
    return this.status >= 500;
  }
}

// lib/services/serviceEnterprise/client/core/cacheManager.js
// 🎯 PHASE 2: Simplified and unified caching strategy

"use client"

export class CacheManager {
  constructor() {
    this.cache = new Map();
    this.expirationTimes = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    
    // TTL configurations by data type
    this.ttlConfig = {
      userContext: 10 * 60 * 1000,      // 10 minutes
      subscriptionStatus: 15 * 60 * 1000, // 15 minutes  
      teamData: 5 * 60 * 1000,          // 5 minutes
      teamMembers: 2 * 60 * 1000,       // 2 minutes
      invitations: 1 * 60 * 1000,       // 1 minute
      permissions: 5 * 60 * 1000,       // 5 minutes
      analytics: 30 * 1000              // 30 seconds
    };
  }

  set(key, value, category = 'default') {
    const ttl = this.ttlConfig[category] || this.defaultTTL;
    this.cache.set(key, value);
    this.expirationTimes.set(key, Date.now() + ttl);
    
    console.log(`📦 Cached: ${key} (TTL: ${ttl}ms)`);
  }

  get(key) {
    const expirationTime = this.expirationTimes.get(key);
    
    if (!expirationTime || Date.now() > expirationTime) {
      this.cache.delete(key);
      this.expirationTimes.delete(key);
      return null;
    }
    
    console.log(`✅ Cache hit: ${key}`);
    return this.cache.get(key);
  }

  invalidate(pattern) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.expirationTimes.delete(key);
    });
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Invalidated ${keysToDelete.length} cache entries for: ${pattern}`);
    }
  }

  clear() {
    this.cache.clear();
    this.expirationTimes.clear();
    console.log('🧹 Cache cleared');
  }

  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Global cache instance
export const globalCache = new CacheManager();

// lib/services/serviceEnterprise/client/core/errorHandler.js
// 🎯 PHASE 2: Centralized error handling

"use client"
import { EnterpriseApiError } from './apiClient';

export class ErrorHandler {
  static handle(error, context = '') {
    console.error(`❌ Enterprise Error ${context}:`, error);

    if (error instanceof EnterpriseApiError) {
      return this.handleApiError(error);
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        type: 'network',
        message: 'Network connection failed. Please check your internet connection.',
        retry: true
      };
    }

    return {
      type: 'unknown',
      message: error.message || 'An unexpected error occurred',
      retry: false
    };
  }

  static handleApiError(error) {
    if (error.isAuthError) {
      return {
        type: 'auth',
        message: error.status === 401 
          ? 'Authentication required. Please log in again.'
          : 'Access denied. You may not have permission for this action.',
        retry: false,
        redirectToLogin: error.status === 401
      };
    }

    if (error.isServerError) {
      return {
        type: 'server',
        message: 'Server error. Please try again in a moment.',
        retry: true
      };
    }

    if (error.status === 400) {
      return {
        type: 'validation',
        message: error.message || 'Invalid request data',
        retry: false
      };
    }

    if (error.status === 404) {
      return {
        type: 'notfound',
        message: 'Requested resource not found',
        retry: false
      };
    }

    return {
      type: 'api',
      message: error.message || 'API request failed',
      retry: error.status >= 500
    };
  }

  static getUserFriendlyMessage(error) {
    const handled = this.handle(error);
    return handled.message;
  }
}

// lib/services/serviceEnterprise/client/services/subscriptionService.js
// 🎯 PHASE 2: Consolidated subscription service (replaces multiple files)

"use client"
import { EnterpriseApiClient } from '../core/apiClient';
import { globalCache } from '../core/cacheManager';
import { ErrorHandler } from '../core/errorHandler';

export class SubscriptionService {
  
  /**
   * Get enterprise subscription status (server-validated)
   */
  static async getStatus() {
    const cacheKey = 'subscription_status';
    
    try {
      // Check cache first
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      // Fetch from server
      const data = await EnterpriseApiClient.get('/api/enterprise/subscription/status');
      
      // Cache the result
      globalCache.set(cacheKey, data, 'subscriptionStatus');
      
      return data;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'getStatus');
      throw new Error(handled.message);
    }
  }

  /**
   * Validate enterprise operation (server-side)
   */
  static async validateOperation(operation, context = {}) {
    try {
      const result = await EnterpriseApiClient.post('/api/enterprise/validate-operation', {
        operation,
        context: {
          ...context,
          ...EnterpriseApiClient.getRequestMetadata()
        }
      });

      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'validateOperation');
      throw new Error(handled.message);
    }
  }

  /**
   * Get feature access (server-validated)
   */
  static async getFeatures() {
    const cacheKey = 'feature_access';
    
    try {
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const data = await EnterpriseApiClient.get('/api/enterprise/features');
      globalCache.set(cacheKey, data, 'subscriptionStatus');
      
      return data;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'getFeatures');
      throw new Error(handled.message);
    }
  }

  /**
   * Check if user has specific features
   */
  static async checkFeatures(features) {
    try {
      const result = await EnterpriseApiClient.post('/api/enterprise/features/check', {
        features
      });
      
      return result.featureChecks;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'checkFeatures');
      throw new Error(handled.message);
    }
  }

  /**
   * Get operation permissions
   */
  static async getOperationPermissions() {
    const cacheKey = 'operation_permissions';
    
    try {
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const data = await EnterpriseApiClient.get('/api/enterprise/operations/permissions');
      globalCache.set(cacheKey, data, 'permissions');
      
      return data;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'getOperationPermissions');
      throw new Error(handled.message);
    }
  }

  // Convenience methods
  static async hasEnterpriseAccess() {
    try {
      const status = await this.getStatus();
      return status.hasEnterpriseAccess;
    } catch (error) {
      console.error('Error checking enterprise access:', error);
      return false;
    }
  }

  static async hasFeature(feature) {
    try {
      const features = await this.checkFeatures([feature]);
      return features[feature] || false;
    } catch (error) {
      console.error('Error checking feature:', error);
      return false;
    }
  }

  static async canPerformOperation(operation, context = {}) {
    try {
      const result = await this.validateOperation(operation, context);
      return result.allowed;
    } catch (error) {
      console.error('Error checking operation:', error);
      return false;
    }
  }

  // Cache invalidation
  static invalidateCache() {
    globalCache.invalidate('subscription_');
    globalCache.invalidate('feature_');
    globalCache.invalidate('operation_');
  }
}

// lib/services/serviceEnterprise/client/services/teamService.js
// 🎯 PHASE 2: Consolidated team service (removes duplicates)

"use client"
import { EnterpriseApiClient } from '../core/apiClient';
import { globalCache } from '../core/cacheManager';
import { ErrorHandler } from '../core/errorHandler';

export class TeamService {

  /**
   * Get user's teams
   */
  static async getUserTeams() {
    const cacheKey = 'user_teams';
    
    try {
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const data = await EnterpriseApiClient.get('/api/enterprise/teams');
      globalCache.set(cacheKey, data, 'teamData');
      
      return data;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'getUserTeams');
      throw new Error(handled.message);
    }
  }

  /**
   * Create new team
   */
  static async createTeam(teamData) {
    try {
      const result = await EnterpriseApiClient.post('/api/enterprise/teams', teamData);
      
      // Invalidate related caches
      this.invalidateTeamCaches();
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'createTeam');
      throw new Error(handled.message);
    }
  }

  /**
   * Get team members
   */
  static async getTeamMembers(teamId) {
    const cacheKey = `team_members_${teamId}`;
    
    try {
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const data = await EnterpriseApiClient.get(`/api/enterprise/teams/${teamId}/members`);
      globalCache.set(cacheKey, data, 'teamMembers');
      
      return data;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'getTeamMembers');
      throw new Error(handled.message);
    }
  }

  /**
   * Update member role
   */
  static async updateMemberRole(teamId, memberId, newRole) {
    try {
      const result = await EnterpriseApiClient.put(
        `/api/enterprise/teams/${teamId}/members/${memberId}/role`,
        { role: newRole }
      );
      
      // Invalidate related caches
      this.invalidateMemberCaches(teamId);
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'updateMemberRole');
      throw new Error(handled.message);
    }
  }

  /**
   * Remove team member
   */
  static async removeMember(teamId, memberId) {
    try {
      const result = await EnterpriseApiClient.delete(
        `/api/enterprise/teams/${teamId}/members/${memberId}`
      );
      
      // Invalidate related caches
      this.invalidateMemberCaches(teamId);
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'removeMember');
      throw new Error(handled.message);
    }
  }

  /**
   * Get team permissions
   */
  static async getTeamPermissions(teamId) {
    const cacheKey = `team_permissions_${teamId}`;
    
    try {
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const data = await EnterpriseApiClient.get(`/api/enterprise/teams/${teamId}/permissions`);
      globalCache.set(cacheKey, data, 'permissions');
      
      return data;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'getTeamPermissions');
      throw new Error(handled.message);
    }
  }

  /**
   * Update team permissions
   */
  static async updateTeamPermissions(teamId, permissions) {
    try {
      const result = await EnterpriseApiClient.put(
        `/api/enterprise/teams/${teamId}/permissions`,
        { permissions }
      );
      
      // Invalidate related caches
      this.invalidatePermissionCaches(teamId);
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'updateTeamPermissions');
      throw new Error(handled.message);
    }
  }

  // Cache invalidation helpers
  static invalidateTeamCaches() {
    globalCache.invalidate('user_teams');
    globalCache.invalidate('team_');
  }

  static invalidateMemberCaches(teamId) {
    globalCache.invalidate(`team_members_${teamId}`);
    globalCache.invalidate(`team_permissions_${teamId}`);
    globalCache.invalidate('user_teams');
  }

  static invalidatePermissionCaches(teamId) {
    globalCache.invalidate(`team_permissions_${teamId}`);
    globalCache.invalidate(`team_members_${teamId}`);
  }
}

// lib/services/serviceEnterprise/client/services/invitationService.js
// 🎯 PHASE 2: Consolidated invitation service

"use client"
import { EnterpriseApiClient } from '../core/apiClient';
import { globalCache } from '../core/cacheManager';
import { ErrorHandler } from '../core/errorHandler';

export class InvitationService {

  /**
   * Send team invitation
   */
  static async sendInvitation(teamId, email, role) {
    try {
      const result = await EnterpriseApiClient.post('/api/enterprise/invitations', {
        teamId,
        invitedEmail: email,
        role
      });
      
      // Invalidate invitation caches
      this.invalidateInvitationCaches(teamId);
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'sendInvitation');
      throw new Error(handled.message);
    }
  }

  /**
   * Get team invitations
   */
  static async getTeamInvitations(teamId) {
    const cacheKey = `team_invitations_${teamId}`;
    
    try {
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const data = await EnterpriseApiClient.get(`/api/enterprise/invitations?teamId=${teamId}`);
      globalCache.set(cacheKey, data.invitations || [], 'invitations');
      
      return data.invitations || [];
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'getTeamInvitations');
      throw new Error(handled.message);
    }
  }

  /**
   * Resend invitation
   */
  static async resendInvitation(invitationId) {
    try {
      const result = await EnterpriseApiClient.patch('/api/enterprise/invitations', {
        invitationId,
        action: 'resend'
      });
      
      // Invalidate invitation caches
      this.invalidateAllInvitationCaches();
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'resendInvitation');
      throw new Error(handled.message);
    }
  }

  /**
   * Revoke invitation
   */
  static async revokeInvitation(invitationId) {
    try {
      const result = await EnterpriseApiClient.delete(
        `/api/enterprise/invitations?invitationId=${invitationId}`
      );
      
      // Invalidate invitation caches
      this.invalidateAllInvitationCaches();
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'revokeInvitation');
      throw new Error(handled.message);
    }
  }

  /**
   * Verify invitation
   */
  static async verifyInvitation(email, code) {
    try {
      const result = await EnterpriseApiClient.post('/api/enterprise/invitations/verify', {
        email,
        code
      });
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'verifyInvitation');
      throw new Error(handled.message);
    }
  }

  /**
   * Accept invitation
   */
  static async acceptInvitation(invitationId) {
    try {
      const result = await EnterpriseApiClient.post('/api/enterprise/invitations/accept', {
        action: 'accept',
        invitationId
      });
      
      // Clear all caches since user context will change
      globalCache.clear();
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'acceptInvitation');
      throw new Error(handled.message);
    }
  }

  /**
   * Bulk operations
   */
  static async bulkResendInvitations(invitationIds) {
    try {
      const result = await EnterpriseApiClient.patch('/api/enterprise/invitations/bulk', {
        invitationIds,
        action: 'resend'
      });
      
      this.invalidateAllInvitationCaches();
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'bulkResendInvitations');
      throw new Error(handled.message);
    }
  }

  static async bulkRevokeInvitations(invitationIds) {
    try {
      const result = await EnterpriseApiClient.delete('/api/enterprise/invitations/bulk', {
        body: { invitationIds }
      });
      
      this.invalidateAllInvitationCaches();
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'bulkRevokeInvitations');
      throw new Error(handled.message);
    }
  }

  // Cache management
  static invalidateInvitationCaches(teamId) {
    globalCache.invalidate(`team_invitations_${teamId}`);
  }

  static invalidateAllInvitationCaches() {
    globalCache.invalidate('team_invitations_');
  }
}

// lib/services/serviceEnterprise/client/index.js
// 🎯 PHASE 2: Updated exports with consolidated services

"use client"

// Core services
export { SubscriptionService } from './services/subscriptionService';
export { TeamService } from './services/teamService';
export { InvitationService } from './services/invitationService';

// Core infrastructure
export { EnterpriseApiClient, EnterpriseApiError } from './core/apiClient';
export { CacheManager, globalCache } from './core/cacheManager';
export { ErrorHandler } from './core/errorHandler';

// Legacy compatibility (gradually phase these out)
export {
  // Main hooks
  useEnterpriseData,
  useOptimizedTeamData,
  
  // Analytics functions  
  getImpersonatedAnalytics,
  canImpersonateAnalytics
} from './transitionService';

// Constants
export {
  TEAM_ROLES,
  PERMISSIONS,
  ORGANIZATION_ROLES,
  INVITATION_STATUS
} from '../constants/enterpriseConstants';