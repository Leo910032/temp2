// lib/services/client/subscriptionService.js
"use client";

import { auth } from '@/lib/important/firebase';

/**
 * The single, unified client-side service for fetching subscription status.
 * This replaces ALL other client-side subscription services and provides a thin client layer.
 */

// Simple in-memory cache to avoid duplicate API calls
let subscriptionCache = null;
let cacheExpiry = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get authentication headers for API calls
 */
async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  const token = await user.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Main function to get comprehensive subscription status
 * This replaces all the fragmented getStatus, getEnterpriseSubscriptionStatus, etc.
 */
export async function getSubscriptionStatus() {
  // Check cache first
  if (subscriptionCache && cacheExpiry && Date.now() < cacheExpiry) {
    console.log('🔄 Using cached unified subscription status');
    return subscriptionCache;
  }
  
  try {
    console.log('📥 Fetching unified subscription status from server...');
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/user/subscription/status', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get subscription status');
    }

    const data = await response.json();
    
    // Cache the result
    subscriptionCache = data;
    cacheExpiry = Date.now() + CACHE_DURATION;
    
    console.log('✅ Unified subscription status fetched successfully');
    return data;
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    throw error;
  }
}

/**
 * Check if user has access to a specific contact feature
 */
export async function hasContactFeature(feature) {
  try {
    const status = await getSubscriptionStatus();
    return status.permissions[feature] || false;
  } catch (error) {
    console.error('Error checking contact feature:', error);
    return false;
  }
}

/**
 * Check if user has a specific enterprise permission
 */
export async function hasEnterprisePermission(permission) {
  try {
    const status = await getSubscriptionStatus();
    return status.permissions[permission] || false;
  } catch (error) {
    console.error('Error checking enterprise permission:', error);
    return false;
  }
}

/**
 * Check if user has enterprise access
 */
export async function hasEnterpriseAccess() {
  try {
    const status = await getSubscriptionStatus();
    return status.enterpriseCapabilities.hasAccess;
  } catch (error) {
    console.error('Error checking enterprise access:', error);
    return false;
  }
}

/**
 * Get contact capabilities and limits
 */
export async function getContactCapabilities() {
  try {
    const status = await getSubscriptionStatus();
    return status.contactCapabilities;
  } catch (error) {
    console.error('Error getting contact capabilities:', error);
    return {
      hasBasicAccess: false,
      hasAdvancedFeatures: false,
      hasUnlimitedAccess: false,
      features: [],
      limits: { maxContacts: 0, maxGroups: 0, maxShares: 0 }
    };
  }
}

/**
 * Get enterprise capabilities
 */
export async function getEnterpriseCapabilities() {
  try {
    const status = await getSubscriptionStatus();
    return status.enterpriseCapabilities;
  } catch (error) {
    console.error('Error getting enterprise capabilities:', error);
    return {
      hasAccess: false,
      canCreateTeams: false,
      canManageOrganization: false,
      teamLimits: { maxTeams: 0, maxMembers: 0 },
      isOrganizationOwner: false
    };
  }
}

/**
 * Get user context (teams, roles, etc.)
 */
export async function getUserContext() {
  try {
    const status = await getSubscriptionStatus();
    return status.userContext;
  } catch (error) {
    console.error('Error getting user context:', error);
    return {
      teamRoles: [],
      organizationRole: null,
      highestTeamRole: 'employee',
      isOrganizationOwner: false
    };
  }
}

/**
 * Get subscription limits across all services
 */
export async function getSubscriptionLimits() {
  try {
    const status = await getSubscriptionStatus();
    return status.limits;
  } catch (error) {
    console.error('Error getting subscription limits:', error);
    return {
      maxContacts: 0,
      maxGroups: 0,
      maxShares: 0,
      maxTeams: 0,
      maxMembers: 0,
      aiCostBudget: 0,
      maxAiRunsPerMonth: 0,
      deepAnalysisEnabled: false
    };
  }
}

/**
 * Check if user can perform a specific operation (server validation)
 */
export async function canPerformOperation(operation, context = {}) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/user/validate-operation', {
      method: 'POST',
      headers,
      body: JSON.stringify({ operation, context })
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.allowed || false;
  } catch (error) {
    console.error('Error validating operation:', error);
    return false;
  }
}

/**
 * Get upgrade suggestions
 */
export async function getUpgradeSuggestions() {
  try {
    const status = await getSubscriptionStatus();
    
    if (status.canUpgrade && status.nextTier) {
      return {
        canUpgrade: true,
        currentTier: status.subscriptionLevel,
        nextTier: status.nextTier,
        suggestions: [
          {
            feature: 'subscription_upgrade',
            requiredTier: status.nextTier,
            description: `Upgrade to ${status.nextTier} for additional features`
          }
        ]
      };
    }
    
    return {
      canUpgrade: false,
      currentTier: status.subscriptionLevel,
      nextTier: null,
      suggestions: []
    };
  } catch (error) {
    console.error('Error getting upgrade suggestions:', error);
    return {
      canUpgrade: false,
      currentTier: 'base',
      nextTier: 'pro',
      suggestions: []
    };
  }
}

/**
 * Initiate subscription upgrade
 */
export async function initiateSubscriptionUpgrade(targetTier, returnUrl = null) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch('/api/user/subscription/upgrade', {
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
    
    // Invalidate cache after upgrade
    invalidateCache();
    
    return data;
  } catch (error) {
    console.error('Error initiating subscription upgrade:', error);
    throw error;
  }
}

/**
 * Batch fetch all subscription-related data
 * This replaces the various getEnterpriseDataBatch functions
 */
export async function getSubscriptionDataBatch() {
  try {
    console.log('🚀 Executing BATCH subscription data fetch');
    
    // Single API call gets everything we need
    const subscriptionStatus = await getSubscriptionStatus();
    
    // Additional data can be fetched in parallel if needed
    const [userContext, limits] = await Promise.allSettled([
      getUserContext(),
      getSubscriptionLimits()
    ]);

    const result = {
      subscriptionStatus: subscriptionStatus,
      userContext: userContext.status === 'fulfilled' ? userContext.value : null,
      limits: limits.status === 'fulfilled' ? limits.value : null,
      errors: []
    };

    // Collect any errors for debugging
    [userContext, limits].forEach((promiseResult, index) => {
      if (promiseResult.status === 'rejected') {
        const errorNames = ['userContext', 'limits'];
        result.errors.push({
          service: errorNames[index],
          error: promiseResult.reason.message
        });
      }
    });

    console.log('✅ BATCH subscription data completed:', {
      hasSubscription: !!result.subscriptionStatus,
      hasUserContext: !!result.userContext,
      hasLimits: !!result.limits,
      errorCount: result.errors.length
    });

    return result;
  } catch (error) {
    console.error('Error in batch subscription fetch:', error);
    throw error;
  }
}

/**
 * Preload subscription data for better performance
 */
export async function preloadSubscriptionData() {
  try {
    console.log('⚡ Preloading unified subscription data...');
    
    const userId = auth.currentUser?.uid;
    if (userId) {
      // Start preloading in background without awaiting
      getSubscriptionStatus().catch(console.warn);
    }
    
    console.log('⚡ Unified subscription preload initiated');
    return { success: true };
  } catch (error) {
    console.warn('⚠️ Unified subscription preload failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Invalidate the subscription cache
 */
export function invalidateCache() {
  subscriptionCache = null;
  cacheExpiry = null;
  console.log('🔄 Subscription cache invalidated');
}

/**
 * Legacy compatibility functions for existing code
 */

// For existing contact service compatibility
export async function getContactSubscriptionStatus() {
  const status = await getSubscriptionStatus();
  return {
    subscriptionLevel: status.subscriptionLevel,
    features: status.contactCapabilities.features,
    hasBasicAccess: status.contactCapabilities.hasBasicAccess,
    hasAdvancedFeatures: status.contactCapabilities.hasAdvancedFeatures,
    hasUnlimitedAccess: status.contactCapabilities.hasUnlimitedAccess,
    limits: status.contactCapabilities.limits
  };
}

// For existing enterprise service compatibility
export async function getEnterpriseSubscriptionStatus() {
  const status = await getSubscriptionStatus();
  return {
    accountType: status.subscriptionLevel,
    hasEnterpriseAccess: status.enterpriseCapabilities.hasAccess,
    features: Object.keys(status.permissions).filter(key => 
      status.permissions[key] && key.startsWith('can')
    ),
    limits: {
      maxTeams: status.limits.maxTeams,
      maxMembers: status.limits.maxMembers,
      maxContacts: status.limits.maxContacts
    },
    user: status.userContext,
    canUpgrade: status.canUpgrade,
    nextTier: status.nextTier
  };
}

// For checking multiple features at once
export async function checkFeatures(features) {
  try {
    const status = await getSubscriptionStatus();
    const result = {};
    
    features.forEach(feature => {
      result[feature] = status.permissions[feature] || false;
    });
    
    return result;
  } catch (error) {
    console.error('Error checking features:', error);
    const result = {};
    features.forEach(feature => {
      result[feature] = false;
    });
    return result;
  }
}

/**
 * Utility function to check subscription level hierarchy
 */
export async function isSubscriptionHigherOrEqual(requiredLevel) {
  try {
    const status = await getSubscriptionStatus();
    const levelHierarchy = {
      'base': 1,
      'pro': 2,
      'premium': 3,
      'business': 4,
      'enterprise': 5
    };
    
    const currentLevel = levelHierarchy[status.subscriptionLevel] || 0;
    const required = levelHierarchy[requiredLevel] || 0;
    
    return currentLevel >= required;
  } catch (error) {
    console.error('Error comparing subscription levels:', error);
    return false;
  }
}
