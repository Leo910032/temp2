// lib/services/contactSubscriptionService.js
import { getUserSubscription, SUBSCRIPTION_LEVELS, meetsMinimumSubscription } from './subscriptionService';

/**
 * Contact-specific features and their requirements
 */
export const CONTACT_FEATURES = {
  BASIC_CONTACTS: 'basic_contacts',
  BASIC_GROUPS: 'basic_groups',
  ADVANCED_GROUPS: 'advanced_groups',
  EVENT_DETECTION: 'event_detection',
  BUSINESS_CARD_SCANNER: 'business_card_scanner',
  TEAM_SHARING: 'team_sharing',
  MAP_VISUALIZATION: 'map_visualization'
};

/**
 * Updated subscription levels to include enterprise
 */
export const CONTACT_SUBSCRIPTION_LEVELS = {
  BASE: 'base',
  PRO: 'pro', 
  PREMIUM: 'premium',
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise'  // ✅ Added enterprise tier
};

/**
 * Contact feature matrix - what each subscription level includes
 * ✅ Updated to include enterprise tier with all features
 */
const CONTACT_FEATURE_MATRIX = {
  [CONTACT_SUBSCRIPTION_LEVELS.BASE]: [
    // Base users have no contact features
  ],
  [CONTACT_SUBSCRIPTION_LEVELS.PRO]: [
    CONTACT_FEATURES.BASIC_CONTACTS,
    CONTACT_FEATURES.BASIC_GROUPS,
    CONTACT_FEATURES.BUSINESS_CARD_SCANNER,
    CONTACT_FEATURES.MAP_VISUALIZATION
  ],
  [CONTACT_SUBSCRIPTION_LEVELS.PREMIUM]: [
    CONTACT_FEATURES.BASIC_CONTACTS,
    CONTACT_FEATURES.BASIC_GROUPS,
    CONTACT_FEATURES.ADVANCED_GROUPS,
    CONTACT_FEATURES.EVENT_DETECTION,
    CONTACT_FEATURES.BUSINESS_CARD_SCANNER,
    CONTACT_FEATURES.TEAM_SHARING,
    CONTACT_FEATURES.MAP_VISUALIZATION
  ],
  [CONTACT_SUBSCRIPTION_LEVELS.BUSINESS]: [
    CONTACT_FEATURES.BASIC_CONTACTS,
    CONTACT_FEATURES.BASIC_GROUPS,
    CONTACT_FEATURES.ADVANCED_GROUPS,
    CONTACT_FEATURES.EVENT_DETECTION,
    CONTACT_FEATURES.BUSINESS_CARD_SCANNER,
    CONTACT_FEATURES.TEAM_SHARING,
    CONTACT_FEATURES.MAP_VISUALIZATION
  ],
  [CONTACT_SUBSCRIPTION_LEVELS.ENTERPRISE]: [
    // ✅ Enterprise gets ALL contact features
    ...Object.values(CONTACT_FEATURES)
  ]
};

/**
 * Group generation options based on subscription level
 * ✅ Updated to include enterprise tier
 */
export const getGroupGenerationOptions = (subscriptionLevel) => {
  const options = {
    groupByCompany: false,
    groupByTime: false,
    groupByLocation: false,
    groupByEvents: false,
    maxGroups: 0,
    maxApiCalls: 0,
    costBudget: 0
  };

  switch (subscriptionLevel) {
    case CONTACT_SUBSCRIPTION_LEVELS.BASE:
      // No contact features for base users
      return options;

    case CONTACT_SUBSCRIPTION_LEVELS.PRO:
      return {
        ...options,
        groupByCompany: true,     // Free methods only
        groupByTime: true,        // Free methods only
        groupByLocation: false,   // Not available
        groupByEvents: false,     // Not available
        maxGroups: 10,
        maxApiCalls: 0,           // No API calls for Pro
        costBudget: 0
      };

    case CONTACT_SUBSCRIPTION_LEVELS.PREMIUM:
      return {
        ...options,
        groupByCompany: true,     // Free methods first
        groupByTime: true,        // Free methods first
        groupByLocation: true,    // With cost controls
        groupByEvents: true,      // With cost controls
        maxGroups: 30,
        maxApiCalls: 15,
        costBudget: 0.15
      };

    case CONTACT_SUBSCRIPTION_LEVELS.BUSINESS:
      return {
        ...options,
        groupByCompany: true,     // Free methods first
        groupByTime: true,        // Free methods first
        groupByLocation: true,    // With cost controls
        groupByEvents: true,      // With cost controls
        maxGroups: 50,
        maxApiCalls: 20,
        costBudget: 0.20
      };

    case CONTACT_SUBSCRIPTION_LEVELS.ENTERPRISE:
      // ✅ Enterprise gets unlimited everything
      return {
        ...options,
        groupByCompany: true,
        groupByTime: true,
        groupByLocation: true,
        groupByEvents: true,
        maxGroups: -1,            // Unlimited
        maxApiCalls: -1,          // Unlimited
        costBudget: -1            // Unlimited budget
      };

    default:
      return options;
  }
};

/**
 * Check if user has access to a specific contact feature
 * ✅ Updated to handle enterprise tier
 */
export function hasContactFeatureAccess(subscriptionLevel, feature) {
  if (!subscriptionLevel || !feature) return false;
  
  // Normalize subscription level to handle different formats
  const normalizedLevel = subscriptionLevel.toLowerCase();
  const userFeatures = CONTACT_FEATURE_MATRIX[normalizedLevel] || [];
  return userFeatures.includes(feature);
}

/**
 * Check if user can access basic contacts functionality
 * ✅ Enterprise users can access contacts
 */
export function canAccessContacts(subscriptionLevel) {
  return hasContactFeatureAccess(subscriptionLevel, CONTACT_FEATURES.BASIC_CONTACTS);
}

/**
 * Check if user can create basic groups (company/time-based)
 * ✅ Enterprise users can create basic groups
 */
export function canCreateBasicGroups(subscriptionLevel) {
  return hasContactFeatureAccess(subscriptionLevel, CONTACT_FEATURES.BASIC_GROUPS);
}

/**
 * Check if user can create advanced groups (location/event-based)
 * ✅ Enterprise users can create advanced groups
 */
export function canCreateAdvancedGroups(subscriptionLevel) {
  return hasContactFeatureAccess(subscriptionLevel, CONTACT_FEATURES.ADVANCED_GROUPS);
}

/**
 * Check if user can use event detection
 * ✅ Enterprise users can use event detection
 */
export function canUseEventDetection(subscriptionLevel) {
  return hasContactFeatureAccess(subscriptionLevel, CONTACT_FEATURES.EVENT_DETECTION);
}

/**
 * Check if user can share contacts with team
 * ✅ Enterprise users can share with team
 */
export function canShareWithTeam(subscriptionLevel) {
  return hasContactFeatureAccess(subscriptionLevel, CONTACT_FEATURES.TEAM_SHARING);
}

/**
 * Get upgrade message for contact features
 * ✅ Updated messages to reflect enterprise tier
 */
export function getContactUpgradeMessage(feature) {
  const messages = {
    [CONTACT_FEATURES.BASIC_CONTACTS]: 'Upgrade to Pro to access contact management features.',
    [CONTACT_FEATURES.BASIC_GROUPS]: 'Upgrade to Pro to organize contacts into groups.',
    [CONTACT_FEATURES.ADVANCED_GROUPS]: 'Upgrade to Premium to create location and event-based groups.',
    [CONTACT_FEATURES.EVENT_DETECTION]: 'Upgrade to Premium to automatically detect events and create smart groups.',
    [CONTACT_FEATURES.TEAM_SHARING]: 'Upgrade to Premium to share contacts with your team.',
    [CONTACT_FEATURES.BUSINESS_CARD_SCANNER]: 'Upgrade to Pro to scan business cards and auto-extract contact information.',
    [CONTACT_FEATURES.MAP_VISUALIZATION]: 'Upgrade to Pro to visualize your contacts on an interactive map.'
  };
  
  return messages[feature] || 'Upgrade your subscription to access this contact feature.';
}

/**
 * Get user's contact subscription status
 * ✅ Updated to properly handle enterprise tier
 */
export async function getContactSubscriptionStatus() {
  try {
    const subscriptionData = await getUserSubscription();
    const subscriptionLevel = subscriptionData.accountType;
    
    // ✅ Normalize subscription level for consistency
    const normalizedLevel = subscriptionLevel?.toLowerCase();
    
    return {
      subscriptionLevel: normalizedLevel,
      features: CONTACT_FEATURE_MATRIX[normalizedLevel] || [],
      groupOptions: getGroupGenerationOptions(normalizedLevel),
      canAccessContacts: canAccessContacts(normalizedLevel),
      canCreateBasicGroups: canCreateBasicGroups(normalizedLevel),
      canCreateAdvancedGroups: canCreateAdvancedGroups(normalizedLevel),
      canUseEventDetection: canUseEventDetection(normalizedLevel),
      canShareWithTeam: canShareWithTeam(normalizedLevel),
      // ✅ Enterprise-specific flags
      isEnterpriseTier: normalizedLevel === CONTACT_SUBSCRIPTION_LEVELS.ENTERPRISE,
      hasUnlimitedFeatures: normalizedLevel === CONTACT_SUBSCRIPTION_LEVELS.ENTERPRISE
    };
  } catch (error) {
    console.error('Error fetching contact subscription status:', error);
    throw error;
  }
}

/**
 * Get subscription requirements for a feature
 * ✅ Updated to reflect that enterprise has access to everything
 */
export function getFeatureRequirements(feature) {
  const requirements = {
    [CONTACT_FEATURES.BASIC_CONTACTS]: CONTACT_SUBSCRIPTION_LEVELS.PRO,
    [CONTACT_FEATURES.BASIC_GROUPS]: CONTACT_SUBSCRIPTION_LEVELS.PRO,
    [CONTACT_FEATURES.ADVANCED_GROUPS]: CONTACT_SUBSCRIPTION_LEVELS.PREMIUM,
    [CONTACT_FEATURES.EVENT_DETECTION]: CONTACT_SUBSCRIPTION_LEVELS.PREMIUM,
    [CONTACT_FEATURES.TEAM_SHARING]: CONTACT_SUBSCRIPTION_LEVELS.PREMIUM,
    [CONTACT_FEATURES.BUSINESS_CARD_SCANNER]: CONTACT_SUBSCRIPTION_LEVELS.PRO,
    [CONTACT_FEATURES.MAP_VISUALIZATION]: CONTACT_SUBSCRIPTION_LEVELS.PRO
  };
  
  return requirements[feature] || CONTACT_SUBSCRIPTION_LEVELS.ENTERPRISE;
}

/**
 * ✅ New helper function to check if user has enterprise-level access
 */
export function hasEnterpriseContactAccess(subscriptionLevel) {
  const normalizedLevel = subscriptionLevel?.toLowerCase();
  return normalizedLevel === CONTACT_SUBSCRIPTION_LEVELS.ENTERPRISE;
}

/**
 * ✅ New helper function to get contact limits based on subscription
 */
export function getContactLimits(subscriptionLevel) {
  const normalizedLevel = subscriptionLevel?.toLowerCase();
  
  const limits = {
    [CONTACT_SUBSCRIPTION_LEVELS.BASE]: { maxContacts: 0, maxGroups: 0, maxShares: 0 },
    [CONTACT_SUBSCRIPTION_LEVELS.PRO]: { maxContacts: 2000, maxGroups: 10, maxShares: 0 },
    [CONTACT_SUBSCRIPTION_LEVELS.PREMIUM]: { maxContacts: 5000, maxGroups: 30, maxShares: 100 },
    [CONTACT_SUBSCRIPTION_LEVELS.BUSINESS]: { maxContacts: 10000, maxGroups: 50, maxShares: 500 },
    [CONTACT_SUBSCRIPTION_LEVELS.ENTERPRISE]: { maxContacts: -1, maxGroups: -1, maxShares: -1 } // Unlimited
  };
  
  return limits[normalizedLevel] || limits[CONTACT_SUBSCRIPTION_LEVELS.BASE];
}