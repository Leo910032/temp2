// lib/services/serviceEnterprise/client/subscriptionService.js
// 🎯 PHASE 1: Simplified CLIENT service - THIN LAYER only
// Replaces enterpriseSubscriptionService.js with server-side validation

"use client"
import { auth } from '@/important/firebase';

/**
 * 🎯 THIN CLIENT: Subscription Service
 * Contains ONLY API calls - NO business logic
 * All validation and business rules moved to server
 */

// ==================== AUTH HELPERS ====================

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  const token = await user.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// ==================== CORE API CALLS ====================

/**
 * ✅ THIN CLIENT: Get subscription status from server
 * Server handles all validation and business logic
 */
export async function getEnterpriseSubscriptionStatus() {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/enterprise/subscription/status', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get subscription status');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting subscription status:', error);
    throw error;
  }
}

/**
 * ✅ THIN CLIENT: Validate enterprise operation on server
 * Replaces complex client-side validateEnterpriseOperation()
 */
export async function validateEnterpriseOperation(operation, context = {}) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/enterprise/validate-operation', {
      method: 'POST',
      headers,
      body: JSON.stringify({ operation, context })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to validate operation');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error validating enterprise operation:', error);
    throw error;
  }
}

/**
 * ✅ THIN CLIENT: Get feature access from server
 * Server determines all feature availability
 */
export async function getFeatureAccess() {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/enterprise/features', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get features');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting feature access:', error);
    throw error;
  }
}

/**
 * ✅ THIN CLIENT: Check specific features on server
 */
export async function checkFeatures(features) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/enterprise/features/check', {
      method: 'POST',
      headers,
      body: JSON.stringify({ features })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to check features');
    }

    const result = await response.json();
    return result.featureChecks;
  } catch (error) {
    console.error('Error checking features:', error);
    throw error;
  }
}

/**
 * ✅ THIN CLIENT: Get operation permissions from server
 */
export async function getOperationPermissions() {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/enterprise/operations/permissions', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get permissions');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting operation permissions:', error);
    throw error;
  }
}

/**
 * ✅ THIN CLIENT: Check specific operations on server
 */
export async function checkOperations(operations, context = {}) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/enterprise/operations/permissions/check', {
      method: 'POST',
      headers,
      body: JSON.stringify({ operations, context })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to check operations');
    }

    const result = await response.json();
    return result.operations;
  } catch (error) {
    console.error('Error checking operations:', error);
    throw error;
  }
}

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * ✅ THIN CLIENT: Simple server-validated access check
 */
export async function hasEnterpriseAccess() {
  try {
    const status = await getEnterpriseSubscriptionStatus();
    return status.hasEnterpriseAccess;
  } catch (error) {
    console.error('Error checking enterprise access:', error);
    return false;
  }
}

/**
 * ✅ THIN CLIENT: Simple server-validated feature check
 */
export async function hasFeature(feature) {
  try {
    const featureChecks = await checkFeatures([feature]);
    return featureChecks[feature] || false;
  } catch (error) {
    console.error('Error checking feature:', error);
    return false;
  }
}

/**
 * ✅ THIN CLIENT: Simple server-validated operation check
 */
export async function canPerformOperation(operation, context = {}) {
  try {
    const result = await validateEnterpriseOperation(operation, context);
    return result.allowed;
  } catch (error) {
    console.error('Error checking operation:', error);
    return false;
  }
}

// ==================== SUBSCRIPTION MANAGEMENT ====================

/**
 * ✅ THIN CLIENT: Initiate subscription upgrade
 * Server handles all business logic
 */
export async function initiateSubscriptionUpgrade(targetTier, returnUrl = null) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/enterprise/subscription/upgrade', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        targetTier,
        returnUrl: returnUrl || window.location.href
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to initiate upgrade');
    }

    const data = await response.json();
    
    // Redirect to billing portal if provided
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl;
    }
    
    return data;
  } catch (error) {
    console.error('Error initiating subscription upgrade:', error);
    throw error;
  }
}

/**
 * ✅ THIN CLIENT: Cancel subscription
 */
export async function cancelSubscription(reason = null) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/enterprise/subscription/cancel', {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to cancel subscription');
    }

    return await response.json();
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}

// ==================== CONSTANTS (from server) ====================

/**
 * ✅ Get constants from server instead of hardcoding client-side
 */
let _constants = null;

export async function getSubscriptionConstants() {
  if (_constants) return _constants;
  
  try {
    const features = await getFeatureAccess();
    _constants = features.constants || {
      subscriptionLevels: {
        FREE: 'free',
        BASE: 'base',
        PRO: 'pro', 
        PREMIUM: 'premium',
        ENTERPRISE: 'enterprise'
      },
      enterpriseFeatures: {}
    };
    return _constants;
  } catch (error) {
    console.error('Error getting constants:', error);
    // Fallback constants
    return {
      subscriptionLevels: {
        FREE: 'free',
        BASE: 'base',
        PRO: 'pro',
        PREMIUM: 'premium', 
        ENTERPRISE: 'enterprise'
      },
      enterpriseFeatures: {}
    };
  }
}

// ==================== LEGACY COMPATIBILITY ====================

/**
 * ✅ Legacy compatibility functions
 * These maintain API compatibility while using server validation
 */

export async function getSubscriptionConfig(subscriptionLevel) {
  try {
    const status = await getEnterpriseSubscriptionStatus();
    return {
      maxTeams: status.limits.maxTeams,
      maxMembers: status.limits.maxMembers,
      maxContacts: status.limits.maxContacts,
      features: status.features
    };
  } catch (error) {
    console.error('Error getting subscription config:', error);
    return {
      maxTeams: 0,
      maxMembers: 0,
      maxContacts: 100,
      features: []
    };
  }
}

export async function isSubscriptionHigherOrEqual(currentLevel, requiredLevel) {
  try {
    const constants = await getSubscriptionConstants();
    const hierarchy = {
      [constants.subscriptionLevels.FREE]: 0,
      [constants.subscriptionLevels.BASE]: 1,
      [constants.subscriptionLevels.PRO]: 2,
      [constants.subscriptionLevels.PREMIUM]: 3,
      [constants.subscriptionLevels.ENTERPRISE]: 4
    };
    
    const current = hierarchy[currentLevel?.toLowerCase()] || 0;
    const required = hierarchy[requiredLevel?.toLowerCase()] || 0;
    return current >= required;
  } catch (error) {
    console.error('Error comparing subscription levels:', error);
    return false;
  }
}

export async function getUpgradeSuggestions(currentLevel, requiredFeatures = []) {
  try {
    const status = await getEnterpriseSubscriptionStatus();
    
    if (status.canUpgrade) {
      return [{
        feature: 'enterprise_access',
        requiredTier: 'enterprise',
        description: 'Unlock all enterprise features'
      }];
    }
    
    return [];
  } catch (error) {
    console.error('Error getting upgrade suggestions:', error);
    return [];
  }
}