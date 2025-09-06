"use client"

// lib/services/serviceEnterprise/client/enterpriseSubscriptionService.js
// ✅ CLIENT-SIDE SERVICE - Fixed inconsistencies
import { auth } from '@/important/firebase';

/**
 * Enterprise Subscription Service - Client Side
 * Handles subscription validation and enterprise access checks
 * All Firebase Admin operations moved to API routes
 */

// ==================== SUBSCRIPTION LEVEL DEFINITIONS ====================

export const SUBSCRIPTION_LEVELS = {
  FREE: 'free',
  BASE: 'base', 
  PRO: 'pro',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise'  // ✅ Removed BUSINESS tier
};

export const SUBSCRIPTION_HIERARCHY = {
  [SUBSCRIPTION_LEVELS.FREE]: 0,
  [SUBSCRIPTION_LEVELS.BASE]: 1,
  [SUBSCRIPTION_LEVELS.PRO]: 2,
  [SUBSCRIPTION_LEVELS.PREMIUM]: 3,
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: 4  // ✅ Updated hierarchy
};

// ==================== FEATURE DEFINITIONS ====================

export const ENTERPRISE_FEATURES = {
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

// ==================== SUBSCRIPTION FEATURE MATRIX ====================

export const SUBSCRIPTION_FEATURES = {
  [SUBSCRIPTION_LEVELS.FREE]: {
    maxTeams: 0,
    maxMembers: 0,
    maxContacts: 100,
    features: []
  },
  [SUBSCRIPTION_LEVELS.BASE]: {
    maxTeams: 0,
    maxMembers: 0,
    maxContacts: 500,
    features: []
  },
  [SUBSCRIPTION_LEVELS.PRO]: {
    maxTeams: 0,
    maxMembers: 0,
    maxContacts: 2000,
    features: [ENTERPRISE_FEATURES.CONTACT_SHARING]
  },
  [SUBSCRIPTION_LEVELS.PREMIUM]: {
    maxTeams: 0,
    maxMembers:0,
    maxContacts: 5000,
    features: [
      ENTERPRISE_FEATURES.CONTACT_SHARING,
      ENTERPRISE_FEATURES.BULK_CONTACT_SHARING,
      ENTERPRISE_FEATURES.AUDIT_LOGS,
      ENTERPRISE_FEATURES.PRIORITY_SUPPORT
    ]
  },
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: {  // ✅ Only ENTERPRISE has full enterprise features
    maxTeams: -1, // Unlimited
    maxMembers: -1, // Unlimited
    maxContacts: -1, // Unlimited
    features: Object.values(ENTERPRISE_FEATURES)
  }
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Check if a subscription level has enterprise access
 */
export function hasEnterpriseAccess(subscriptionLevel) {
  const level = subscriptionLevel?.toLowerCase();
  return [
    SUBSCRIPTION_LEVELS.ENTERPRISE  // ✅ Only ENTERPRISE tier has enterprise access
  ].includes(level);
}

/**
 * Check if a subscription level has a specific feature
 */
export function hasFeature(subscriptionLevel, feature) {
  const level = subscriptionLevel?.toLowerCase();
  const config = SUBSCRIPTION_FEATURES[level];
  return config?.features?.includes(feature) || false;
}

/**
 * Get subscription configuration
 */
export function getSubscriptionConfig(subscriptionLevel) {
  const level = subscriptionLevel?.toLowerCase();
  return SUBSCRIPTION_FEATURES[level] || SUBSCRIPTION_FEATURES[SUBSCRIPTION_LEVELS.FREE];
}

/**
 * Compare subscription levels
 */
export function isSubscriptionHigherOrEqual(currentLevel, requiredLevel) {
  const current = SUBSCRIPTION_HIERARCHY[currentLevel?.toLowerCase()] || 0;
  const required = SUBSCRIPTION_HIERARCHY[requiredLevel?.toLowerCase()] || 0;
  return current >= required;
}

// ==================== API COMMUNICATION HELPERS ====================

/**
 * Get authentication headers for API calls
 */
async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const token = await user.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// ==================== MAIN SERVICE FUNCTIONS ====================

/**
 * Get enterprise subscription status from API
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

    const data = await response.json();
    
    // Enrich with client-side calculations
    const subscriptionLevel = data.accountType || SUBSCRIPTION_LEVELS.FREE;
    const config = getSubscriptionConfig(subscriptionLevel);
    
    return {
      // Basic subscription info
      accountType: subscriptionLevel,
      hasEnterpriseAccess: hasEnterpriseAccess(subscriptionLevel),
      
      // Feature availability
      features: config.features,
      enterpriseFeatures: config.features.filter(f => 
        Object.values(ENTERPRISE_FEATURES).includes(f)
      ),
      
      // Limits
      limits: {
        maxTeams: config.maxTeams,
        maxMembers: config.maxMembers,
        maxContacts: config.maxContacts
      },
      
      // User context (from API)
      user: data.user || null,
      organization: data.organization || null,
      teams: data.teams || {},
      
      // Upgrade information
      upgradeMessage: data.upgradeMessage || null,
      canUpgrade: !hasEnterpriseAccess(subscriptionLevel),
      nextTier: getNextSubscriptionTier(subscriptionLevel)
    };
  } catch (error) {
    console.error('Error getting enterprise subscription status:', error);
    throw error;
  }
}

/**
 * Validate if a user can perform an enterprise operation
 */
export function validateEnterpriseOperation(operation, userRole, subscriptionLevel, context = {}) {
  const config = getSubscriptionConfig(subscriptionLevel);
  const hasAccess = hasEnterpriseAccess(subscriptionLevel);
  
  // Basic enterprise access check
  if (!hasAccess) {
    return {
      allowed: false,
      reason: 'Enterprise features require Enterprise subscription',
      upgradeRequired: true,
      requiredLevel: SUBSCRIPTION_LEVELS.ENTERPRISE  // ✅ Fixed to require ENTERPRISE
    };
  }

  // Operation-specific validations
  switch (operation) {
    case 'create_team':
      if (!hasFeature(subscriptionLevel, ENTERPRISE_FEATURES.UNLIMITED_TEAMS)) {
        const currentTeams = context.currentTeams || 0;
        if (currentTeams >= config.maxTeams) {
          return {
            allowed: false,
            reason: `Team limit reached (${config.maxTeams}). Upgrade for unlimited teams.`,
            limitReached: true,
            requiredLevel: SUBSCRIPTION_LEVELS.ENTERPRISE
          };
        }
      }
      
      // ✅ Role check updated - removed 'admin'
      if (!['owner', 'manager'].includes(userRole)) {
        return {
          allowed: false,
          reason: 'Only organization owners and managers can create teams',
          permissionRequired: true
        };
      }
      break;

    case 'invite_member':
      const currentTeamSize = context.currentTeamSize || 0;
      const newMembersCount = context.newMembersCount || 1;
      
      if (!hasFeature(subscriptionLevel, ENTERPRISE_FEATURES.UNLIMITED_TEAMS)) {
        if (currentTeamSize + newMembersCount > config.maxMembers) {
          return {
            allowed: false,
            reason: `Team size limit reached (${config.maxMembers}). Upgrade for larger teams.`,
            limitReached: true,
            requiredLevel: SUBSCRIPTION_LEVELS.ENTERPRISE
          };
        }
      }
      
      // ✅ Role check simplified - permission service will handle detailed checks
      if (!['owner', 'manager', 'team_lead'].includes(userRole)) {
        return {
          allowed: false,
          reason: 'Only managers and team leads can invite members',
          permissionRequired: true
        };
      }
      break;

    case 'share_contacts':
      if (!hasFeature(subscriptionLevel, ENTERPRISE_FEATURES.CONTACT_SHARING)) {
        return {
          allowed: false,
          reason: 'Contact sharing requires Enterprise subscription',
          upgradeRequired: true,
          requiredLevel: SUBSCRIPTION_LEVELS.ENTERPRISE  // ✅ Fixed
        };
      }
      break;

    case 'bulk_share_contacts':
      if (!hasFeature(subscriptionLevel, ENTERPRISE_FEATURES.BULK_CONTACT_SHARING)) {
        return {
          allowed: false,
          reason: 'Bulk contact sharing requires Enterprise subscription',
          upgradeRequired: true,
          requiredLevel: SUBSCRIPTION_LEVELS.ENTERPRISE  // ✅ Fixed
        };
      }
      break;

    case 'remove_member':
    case 'update_member_role':
      // ✅ Role check updated
      if (!['owner', 'manager'].includes(userRole)) {
        return {
          allowed: false,
          reason: 'Only managers can remove members or update roles',
          permissionRequired: true
        };
      }
      break;

    case 'view_audit_logs':
      if (!hasFeature(subscriptionLevel, ENTERPRISE_FEATURES.AUDIT_LOGS)) {
        return {
          allowed: false,
          reason: 'Audit logs require Premium subscription or higher',
          upgradeRequired: true,
          requiredLevel: SUBSCRIPTION_LEVELS.PREMIUM
        };
      }
      break;

    default:
      console.warn(`Unknown enterprise operation: ${operation}`);
      break;
  }

  return {
    allowed: true,
    reason: null
  };
}

/**
 * Get the next subscription tier for upgrades
 */
function getNextSubscriptionTier(currentLevel) {
  const current = SUBSCRIPTION_HIERARCHY[currentLevel?.toLowerCase()] || 0;
  const tiers = Object.keys(SUBSCRIPTION_HIERARCHY);
  
  for (const tier of tiers) {
    if (SUBSCRIPTION_HIERARCHY[tier] > current) {
      return tier;
    }
  }
  
  return null; // Already at highest tier
}

/**
 * Get upgrade suggestions based on missing features
 */
export function getUpgradeSuggestions(currentLevel, requiredFeatures = []) {
  const current = currentLevel?.toLowerCase();
  const suggestions = [];
  
  for (const feature of requiredFeatures) {
    if (!hasFeature(current, feature)) {
      // Find the minimum tier that has this feature
      for (const [tier, config] of Object.entries(SUBSCRIPTION_FEATURES)) {
        if (config.features.includes(feature)) {
          suggestions.push({
            feature,
            requiredTier: tier,
            description: getFeatureDescription(feature)
          });
          break;
        }
      }
    }
  }
  
  return suggestions;
}

/**
 * Get human-readable feature descriptions
 */
function getFeatureDescription(feature) {
  const descriptions = {
    [ENTERPRISE_FEATURES.UNLIMITED_TEAMS]: 'Create unlimited teams',
    [ENTERPRISE_FEATURES.TEAM_ROLES]: 'Advanced team role management',
    [ENTERPRISE_FEATURES.TEAM_PERMISSIONS]: 'Granular permission controls',
    [ENTERPRISE_FEATURES.CONTACT_SHARING]: 'Share contacts with team members',
    [ENTERPRISE_FEATURES.BULK_CONTACT_SHARING]: 'Bulk contact sharing operations',
    [ENTERPRISE_FEATURES.ADVANCED_SHARING_CONTROLS]: 'Advanced contact sharing controls',
    [ENTERPRISE_FEATURES.ORGANIZATION_MANAGEMENT]: 'Organization-wide management',
    [ENTERPRISE_FEATURES.AUDIT_LOGS]: 'Detailed audit logging',
    [ENTERPRISE_FEATURES.ADVANCED_SECURITY]: 'Advanced security features',
    [ENTERPRISE_FEATURES.UNLIMITED_CONTACTS]: 'Unlimited contact storage',
    [ENTERPRISE_FEATURES.PRIORITY_SUPPORT]: 'Priority customer support',
    [ENTERPRISE_FEATURES.CUSTOM_INTEGRATIONS]: 'Custom integration support'
  };
  
  return descriptions[feature] || feature;
}

// ==================== SUBSCRIPTION MANAGEMENT ====================

/**
 * Upgrade subscription (redirects to billing)
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
    
    // Redirect to billing portal or checkout
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
 * Cancel subscription
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