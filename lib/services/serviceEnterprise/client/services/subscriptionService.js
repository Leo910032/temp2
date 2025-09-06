
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
