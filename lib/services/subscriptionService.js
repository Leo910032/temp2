// lib/services/subscriptionService.js
import { auth } from '@/important/firebase';

/**
 * Subscription levels and their features
 * ✅ Added enterprise tier
 */
export const SUBSCRIPTION_LEVELS = {
  BASE: 'base',
  PRO: 'pro',
  PREMIUM: 'premium',
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise'  // ✅ Added enterprise tier
};

export const FEATURES = {
  ANALYTICS: 'analytics',
  CUSTOM_DOMAINS: 'custom_domains',
  ADVANCED_THEMES: 'advanced_themes',
  PRIORITY_SUPPORT: 'priority_support',
  WHITE_LABEL: 'white_label',
  // ✅ Enterprise-specific features
  TEAM_MANAGEMENT: 'team_management',
  MULTI_TEAM_SUPPORT: 'multi_team_support',
  ADVANCED_PERMISSIONS: 'advanced_permissions',
  AUDIT_LOGS: 'audit_logs',
  SSO_INTEGRATION: 'sso_integration'
};

/**
 * Feature matrix - what each subscription level includes
 * ✅ Updated to include enterprise tier with all features
 */
const FEATURE_MATRIX = {
  [SUBSCRIPTION_LEVELS.BASE]: [
    // Base features only
  ],
  [SUBSCRIPTION_LEVELS.PRO]: [
    FEATURES.ANALYTICS,
  ],
  [SUBSCRIPTION_LEVELS.PREMIUM]: [
    FEATURES.ANALYTICS,
    FEATURES.CUSTOM_DOMAINS,
    FEATURES.ADVANCED_THEMES,
  ],
  [SUBSCRIPTION_LEVELS.BUSINESS]: [
    FEATURES.ANALYTICS,
    FEATURES.CUSTOM_DOMAINS,
    FEATURES.ADVANCED_THEMES,
    FEATURES.PRIORITY_SUPPORT,
    FEATURES.WHITE_LABEL,
  ],
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: [
    // ✅ Enterprise gets ALL features
    ...Object.values(FEATURES)
  ]
};

/**
 * Get user's subscription level from server
 */
export async function getUserSubscription() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/user/subscription', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subscription data');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching subscription:', error);
    throw error;
  }
}

/**
 * Check if user has access to a specific feature
 * ✅ Updated to handle enterprise tier
 */
export function hasFeatureAccess(subscriptionLevel, feature) {
  if (!subscriptionLevel || !feature) return false;
  
  // ✅ Normalize subscription level to handle different formats
  const normalizedLevel = subscriptionLevel?.toLowerCase();
  const userFeatures = FEATURE_MATRIX[normalizedLevel] || [];
  return userFeatures.includes(feature);
}

/**
 * Check if user can access analytics
 * ✅ Enterprise users can now access analytics
 */
export function canAccessAnalytics(subscriptionLevel) {
  return hasFeatureAccess(subscriptionLevel, FEATURES.ANALYTICS);
}

/**
 * Get subscription level hierarchy for comparisons
 * ✅ Updated hierarchy to include enterprise
 */
export function getSubscriptionHierarchy() {
  return [
    SUBSCRIPTION_LEVELS.BASE,
    SUBSCRIPTION_LEVELS.PRO,
    SUBSCRIPTION_LEVELS.PREMIUM,
    SUBSCRIPTION_LEVELS.BUSINESS,
    SUBSCRIPTION_LEVELS.ENTERPRISE  // ✅ Enterprise is highest tier
  ];
}

/**
 * Check if subscription level meets minimum requirement
 * ✅ Updated to handle enterprise tier
 */
export function meetsMinimumSubscription(userLevel, requiredLevel) {
  const hierarchy = getSubscriptionHierarchy();
  const userIndex = hierarchy.indexOf(userLevel?.toLowerCase());
  const requiredIndex = hierarchy.indexOf(requiredLevel?.toLowerCase());
  
  return userIndex >= requiredIndex;
}

/**
 * Get display name for subscription level
 * ✅ Added enterprise display name
 */
export function getSubscriptionDisplayName(level) {
  const displayNames = {
    [SUBSCRIPTION_LEVELS.BASE]: 'Base',
    [SUBSCRIPTION_LEVELS.PRO]: 'Pro',
    [SUBSCRIPTION_LEVELS.PREMIUM]: 'Premium',
    [SUBSCRIPTION_LEVELS.BUSINESS]: 'Business',
    [SUBSCRIPTION_LEVELS.ENTERPRISE]: 'Enterprise'  // ✅ Added enterprise display name
  };
  
  return displayNames[level?.toLowerCase()] || 'Unknown';
}

/**
 * Get upgrade message for features
 * ✅ Updated messages to reflect enterprise tier availability
 */
export function getUpgradeMessage(feature) {
  const messages = {
    [FEATURES.ANALYTICS]: 'Upgrade to Pro to access detailed analytics and insights about your profile performance.',
    [FEATURES.CUSTOM_DOMAINS]: 'Upgrade to Premium to use your own custom domain.',
    [FEATURES.ADVANCED_THEMES]: 'Upgrade to Premium to access advanced themes and customization options.',
    [FEATURES.PRIORITY_SUPPORT]: 'Upgrade to Business for priority customer support.',
    [FEATURES.WHITE_LABEL]: 'Upgrade to Business to remove branding and use white-label features.',
    // ✅ Enterprise-specific feature messages
    [FEATURES.TEAM_MANAGEMENT]: 'Upgrade to Enterprise for advanced team management capabilities.',
    [FEATURES.MULTI_TEAM_SUPPORT]: 'Upgrade to Enterprise to manage multiple teams and organizations.',
    [FEATURES.ADVANCED_PERMISSIONS]: 'Upgrade to Enterprise for granular permission controls.',
    [FEATURES.AUDIT_LOGS]: 'Upgrade to Enterprise to access detailed audit logs and compliance features.',
    [FEATURES.SSO_INTEGRATION]: 'Upgrade to Enterprise for single sign-on integration.'
  };
  
  return messages[feature] || 'Upgrade your subscription to access this feature.';
}

/**
 * ✅ New helper function to check if user has enterprise access
 */
export function hasEnterpriseAccess(subscriptionLevel) {
  const normalizedLevel = subscriptionLevel?.toLowerCase();
  return normalizedLevel === SUBSCRIPTION_LEVELS.ENTERPRISE;
}

/**
 * ✅ New helper function to get all features for a subscription level
 */
export function getSubscriptionFeatures(subscriptionLevel) {
  const normalizedLevel = subscriptionLevel?.toLowerCase();
  return FEATURE_MATRIX[normalizedLevel] || [];
}

/**
 * ✅ New helper function to check if user has premium-level features or higher
 */
export function hasPremiumOrHigher(subscriptionLevel) {
  const normalizedLevel = subscriptionLevel?.toLowerCase();
  return meetsMinimumSubscription(normalizedLevel, SUBSCRIPTION_LEVELS.PREMIUM);
}

/**
 * ✅ New helper function to check if user has business-level features or higher
 */
export function hasBusinessOrHigher(subscriptionLevel) {
  const normalizedLevel = subscriptionLevel?.toLowerCase();
  return meetsMinimumSubscription(normalizedLevel, SUBSCRIPTION_LEVELS.BUSINESS);
}