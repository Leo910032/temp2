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
