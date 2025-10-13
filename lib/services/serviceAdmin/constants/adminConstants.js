// lib/services/serviceAdmin/constants/adminConstants.js
// Admin service constants following enterprise architecture pattern

import { SUBSCRIPTION_LEVELS } from '../../core/constants.js';

/**
 * Admin feature flags
 */
export const ADMIN_FEATURES = {
  // Basic admin features
  VIEW_USERS: 'admin_view_users',
  VIEW_ANALYTICS: 'admin_view_analytics',
  VIEW_USER_DETAILS: 'admin_view_user_details',

  // User management features (COMMENTED - to be enabled later)
  // EDIT_USER: 'admin_edit_user',
  // SUSPEND_USER: 'admin_suspend_user',
  // DELETE_USER: 'admin_delete_user',
  // MODIFY_SUBSCRIPTION: 'admin_modify_subscription',

  // System features (COMMENTED - to be enabled later)
  // VIEW_SYSTEM_LOGS: 'admin_view_system_logs',
  // MANAGE_FEATURES: 'admin_manage_features',
  // BULK_OPERATIONS: 'admin_bulk_operations',
  // EXPORT_DATA: 'admin_export_data'
};

/**
 * Admin role levels
 */
export const ADMIN_ROLES = {
  FULL_ADMIN: 'full_admin',    // Full admin access with all permissions
  VIEW_ONLY: 'view_only'       // Read-only access, cannot perform actions
};

/**
 * Admin permissions
 */
export const ADMIN_PERMISSIONS = {
  CAN_VIEW_USERS: 'canViewUsers',
  CAN_VIEW_ANALYTICS: 'canViewAnalytics',
  CAN_VIEW_USER_DETAILS: 'canViewUserDetails',
  CAN_PERFORM_ACTIONS: 'canPerformActions',  // NEW: Generate test data, cleanup, enterprise tools

  // Future permissions (COMMENTED)
  // CAN_EDIT_USERS: 'canEditUsers',
  // CAN_SUSPEND_USERS: 'canSuspendUsers',
  // CAN_DELETE_USERS: 'canDeleteUsers',
  // CAN_EXPORT_DATA: 'canExportData',
  // CAN_VIEW_SYSTEM_LOGS: 'canViewSystemLogs'
};

/**
 * Admin activity types for audit logs
 */
export const ADMIN_ACTIVITIES = {
  VIEWED_USERS_LIST: 'admin_viewed_users_list',
  VIEWED_USER_DETAIL: 'admin_viewed_user_detail',
  VIEWED_ANALYTICS: 'admin_viewed_analytics',

  // Future activities (COMMENTED)
  // UPDATED_USER: 'admin_updated_user',
  // SUSPENDED_USER: 'admin_suspended_user',
  // DELETED_USER: 'admin_deleted_user',
  // EXPORTED_DATA: 'admin_exported_data',
  // VIEWED_SYSTEM_LOGS: 'admin_viewed_system_logs'
};

/**
 * Rate limiting configuration for admin operations
 */
export const ADMIN_RATE_LIMITS = {
  VIEW_USERS: {
    maxRequests: 60,
    windowMs: 60000, // 1 minute
    message: 'Too many user list requests'
  },
  VIEW_USER_DETAIL: {
    maxRequests: 120,
    windowMs: 60000, // 1 minute
    message: 'Too many user detail requests'
  },
  VIEW_ANALYTICS: {
    maxRequests: 30,
    windowMs: 60000, // 1 minute
    message: 'Too many analytics requests'
  }

  // Future rate limits (COMMENTED)
  // EDIT_USER: {
  //   maxRequests: 20,
  //   windowMs: 60000,
  //   message: 'Too many user edit requests'
  // }
};

/**
 * Admin error codes
 */
export const ADMIN_ERROR_CODES = {
  UNAUTHORIZED: 'ADMIN_UNAUTHORIZED',
  FORBIDDEN: 'ADMIN_FORBIDDEN',
  USER_NOT_FOUND: 'ADMIN_USER_NOT_FOUND',
  INVALID_OPERATION: 'ADMIN_INVALID_OPERATION',
  RATE_LIMIT_EXCEEDED: 'ADMIN_RATE_LIMIT_EXCEEDED'
};

/**
 * Admin data sanitization rules
 */
export const ADMIN_SANITIZATION_RULES = {
  // Fields to include in user list
  USER_LIST_FIELDS: [
    'id',
    'username',
    'displayName',
    'email',
    'selectedTheme',
    'linksCount',
    'socialsCount',
    'createdAt',
    'profilePhoto',
    'sensitiveStatus',
    'supportBannerStatus',
    'lastLogin',
    'emailVerified',
    'accountType',
    'analytics'
  ],

  // Fields to include in user detail
  USER_DETAIL_FIELDS: [
    'id',
    'username',
    'displayName',
    'email',
    'selectedTheme',
    'links',
    'socials',
    'createdAt',
    'profilePhoto',
    'sensitiveStatus',
    'supportBannerStatus',
    'lastLogin',
    'emailVerified',
    'accountType',
    'contacts',
    'groups',
    'analytics'
  ],

  // Fields to NEVER expose (sensitive data)
  RESTRICTED_FIELDS: [
    'password',
    'passwordHash',
    'fcmTokens',
    'authToken',
    'privateKey',
    'apiKeys'
  ]
};

/**
 * Helper function to check if user is admin
 * (This is a client-side check - server-side check is authoritative)
 */
export function isAdminEmail(email) {
  // Client-side hint only - NOT for security decisions
  // Real check happens server-side with environment variables
  console.log('[AdminConstants] Client-side admin check (hint only):', email);
  return false; // Always return false client-side for security
}

/**
 * Helper function to validate admin operation permission
 */
export function hasAdminPermission(permissions, feature) {
  return permissions?.[feature] || false;
}

/**
 * Helper function to get permissions based on admin role
 * @param {string} role - Admin role (ADMIN_ROLES.FULL_ADMIN or ADMIN_ROLES.VIEW_ONLY)
 * @returns {Object} - Permissions object
 */
export function getPermissionsForRole(role) {
  const basePermissions = {
    [ADMIN_PERMISSIONS.CAN_VIEW_USERS]: true,
    [ADMIN_PERMISSIONS.CAN_VIEW_ANALYTICS]: true,
    [ADMIN_PERMISSIONS.CAN_VIEW_USER_DETAILS]: true,
  };

  if (role === ADMIN_ROLES.FULL_ADMIN) {
    return {
      ...basePermissions,
      [ADMIN_PERMISSIONS.CAN_PERFORM_ACTIONS]: true,
    };
  }

  if (role === ADMIN_ROLES.VIEW_ONLY) {
    return {
      ...basePermissions,
      [ADMIN_PERMISSIONS.CAN_PERFORM_ACTIONS]: false,
    };
  }

  // Default: no permissions
  return {};
}

/**
 * Helper function to get admin feature description
 */
export function getAdminFeatureDescription(feature) {
  const descriptions = {
    [ADMIN_FEATURES.VIEW_USERS]: 'View list of all users',
    [ADMIN_FEATURES.VIEW_ANALYTICS]: 'View platform analytics',
    [ADMIN_FEATURES.VIEW_USER_DETAILS]: 'View detailed user information'
  };

  return descriptions[feature] || 'Unknown admin feature';
}

/**
 * Helper function to get rate limit configuration
 */
export function getRateLimitConfig(operation) {
  return ADMIN_RATE_LIMITS[operation] || {
    maxRequests: 30,
    windowMs: 60000,
    message: 'Too many requests'
  };
}

// ============================================================================
// API AND AI PRICING CONSTANTS FOR ADMIN DASHBOARD
// ============================================================================

/**
 * AI Provider Pricing (Cost per operation/token)
 * All costs are in USD
 * Source: Official provider pricing pages
 */
/**
 * AI Provider Pricing (Cost per operation/token)
 * All costs are in USD
 * Source: Official provider pricing pages (as of Oct 2025)
 */
export const AI_PROVIDER_PRICING = {
  // Google Gemini Models
  'gemini-2.5-flash-lite': {
    displayName: 'Gemini 2.5 Flash Lite',
    inputCostPerMillionTokens: 0.10, // Corrected from 0.15
    outputCostPerMillionTokens: 0.40, // Corrected from 0.25
    estimatedCostPerOperation: 0.00013, // Recalculated based on new pricing
    freeTier: {
      enabled: true,
      limit: 500,
      unit: 'requests/day',
      description: 'Free tier for getting started, includes 500 RPD for Grounding.'
    }
  },
};

/**
 * Third-Party API Pricing
 * All costs are in USD
 * Source: Official API provider pricing pages (as of Oct 2025)
 */
export const THIRD_PARTY_API_PRICING = {
  // Google Maps Platform
  'google_maps_autocomplete': {
    displayName: 'Google Maps Autocomplete',
    costPerRequest: 0.00283,
    costPer1000: 2.83,
    freeTier: {
      enabled: true,
      limit: 200, // Representing the monthly credit
      unit: 'USD/month',
      description: 'Eligible for the recurring $200 monthly credit.'
    }
  },
  'google_maps_places_search': {
    displayName: 'Google Maps Places Search',
    costPerRequest: 0.032,
    costPer1000: 32.00,
    freeTier: {
      enabled: true, // Corrected from false
      limit: 200,
      unit: 'USD/month',
      description: 'Eligible for the recurring $200 monthly credit.'
    }
  },
  'google_maps_place_details': {
    displayName: 'Google Maps Place Details',
    costPerRequest: 0.017,
    costPer1000: 17.00,
    freeTier: {
      enabled: true, // Corrected from false
      limit: 200,
      unit: 'USD/month',
      description: 'Eligible for the recurring $200 monthly credit.'
    }
  },
  'google_vision_document_text': {
    displayName: 'Google Vision Document Text Detection',
    costPerRequest: 0.0015,
    costPer1000: 1.50,
    freeTier: {
      enabled: true,
      limit: 1000,
      unit: 'units/month',
      description: 'First 1,000 units/month free.'
    }
  },
  'google_vision_ocr': {
    displayName: 'Google Vision OCR',
    costPerRequest: 0.0015,
    costPer1000: 1.50,
    freeTier: {
      enabled: true,
      limit: 1000,
      unit: 'units/month',
      description: 'First 1,000 units/month free.'
    }
  },
};

/**
 * Admin Dashboard Cost Thresholds
 * Used to determine warning levels and alert colors
 */
export const ADMIN_COST_THRESHOLDS = {
  // Platform-wide monthly cost thresholds (USD)
  PLATFORM: {
    LOW: 1.00,           // Under $1 - all good (blue/info)
    MEDIUM: 10.00,       // $1-$10 - monitor (yellow/warning)
    HIGH: 50.00,         // $10-$50 - caution (orange/alert)
    CRITICAL: 100.00     // Over $100 - critical (red/critical)
  },

  // Per-user monthly cost thresholds (USD)
  PER_USER: {
    LOW: 0.10,           // Under $0.10 - normal usage
    MEDIUM: 1.00,        // $0.10-$1.00 - active usage
    HIGH: 5.00,          // $1.00-$5.00 - heavy usage
    CRITICAL: 10.00      // Over $10.00 - investigate
  },

  // AI usage specific thresholds
  AI_USAGE: {
    TOKENS_WARNING: 1000000,     // 1M tokens
    TOKENS_CRITICAL: 5000000,    // 5M tokens
    COST_WARNING: 5.00,          // $5
    COST_CRITICAL: 20.00         // $20
  },

  // API usage specific thresholds
  API_USAGE: {
    CALLS_WARNING: 10000,        // 10K calls
    CALLS_CRITICAL: 50000,       // 50K calls
    COST_WARNING: 10.00,         // $10
    COST_CRITICAL: 50.00         // $50
  }
};

/**
 * Feature-specific cost estimates
 * Used for budgeting and forecasting
 */
export const FEATURE_COST_ESTIMATES = {
  'business_card_scan': {
    displayName: 'Business Card Scan',
    averageCost: 0.00007,
    provider: 'gemini-2.5-flash-lite',
    estimatedCallsPerRun: 1
  },
  'business_card_analysis': {
    displayName: 'Business Card Analysis',
    averageCost: 0.002,
    provider: 'gemini-2.0-flash',
    estimatedCallsPerRun: 1
  },
  'contact_enrichment': {
    displayName: 'Contact Enrichment',
    averageCost: 0.05,
    provider: 'openai-gpt4',
    estimatedCallsPerRun: 2
  },
  'company_matching': {
    displayName: 'Company Matching',
    averageCost: 0.0002,
    provider: 'gemini-2.0-flash',
    estimatedCallsPerRun: 1
  },
  'industry_detection': {
    displayName: 'Industry Detection',
    averageCost: 0.0004,
    provider: 'gemini-2.0-flash',
    estimatedCallsPerRun: 1
  },
  'relationship_detection': {
    displayName: 'Relationship Detection',
    averageCost: 0.001,
    provider: 'gemini-2.0-flash',
    estimatedCallsPerRun: 1
  },
  'auto_grouping': {
    displayName: 'Auto-Grouping',
    averageCost: 0.032,
    provider: 'google_maps_places_search',
    estimatedCallsPerRun: 1
  },
  'places_search': {
    displayName: 'Places Search',
    averageCost: 0.032,
    provider: 'google_maps_places_search',
    estimatedCallsPerRun: 1
  },
  'places_autocomplete': {
    displayName: 'Places Autocomplete',
    averageCost: 0.00283,
    provider: 'google_maps_autocomplete',
    estimatedCallsPerRun: 1
  },
  'places_details': {
    displayName: 'Places Details',
    averageCost: 0.017,
    provider: 'google_maps_place_details',
    estimatedCallsPerRun: 1
  },
  'vector_search': {
    displayName: 'Vector Search',
    averageCost: 0.00,
    provider: 'pinecone_query',
    estimatedCallsPerRun: 1,
    note: 'Within free tier limits'
  }
};

/**
 * Helper function to get cost threshold status
 * @param {number} cost - Current cost
 * @param {string} type - Threshold type ('PLATFORM', 'PER_USER', 'AI_USAGE', 'API_USAGE')
 * @returns {Object} Status information
 */
export function getCostStatus(cost, type = 'PLATFORM') {
  const thresholds = ADMIN_COST_THRESHOLDS[type];
  if (!thresholds) {
    return { level: 'unknown', color: 'gray', icon: '❓' };
  }

  if (cost === 0) {
    return {
      level: 'none',
      color: 'green',
      icon: '✅',
      message: 'No costs incurred'
    };
  } else if (cost < thresholds.LOW) {
    return {
      level: 'low',
      color: 'blue',
      icon: 'ℹ️',
      message: 'Well within acceptable limits'
    };
  } else if (cost < thresholds.MEDIUM) {
    return {
      level: 'medium',
      color: 'yellow',
      icon: '⚠️',
      message: 'Monitor usage carefully'
    };
  } else if (cost < thresholds.HIGH) {
    return {
      level: 'high',
      color: 'orange',
      icon: '🔶',
      message: 'High usage - review costs'
    };
  } else {
    return {
      level: 'critical',
      color: 'red',
      icon: '🔴',
      message: 'Critical usage - immediate attention required'
    };
  }
}

/**
 * Helper function to get provider display info
 * @param {string} providerId - Provider identifier
 * @returns {Object} Provider information
 */
export function getProviderInfo(providerId) {
  // Check AI providers first
  if (AI_PROVIDER_PRICING[providerId]) {
    return {
      ...AI_PROVIDER_PRICING[providerId],
      type: 'AI',
      id: providerId
    };
  }

  // Check API providers
  if (THIRD_PARTY_API_PRICING[providerId]) {
    return {
      ...THIRD_PARTY_API_PRICING[providerId],
      type: 'API',
      id: providerId
    };
  }

  // Unknown provider
  return {
    displayName: providerId,
    type: 'Unknown',
    id: providerId,
    costPerRequest: 0,
    estimatedCostPerOperation: 0
  };
}

/**
 * Helper function to get feature display info
 * @param {string} featureId - Feature identifier
 * @returns {Object} Feature information
 */
export function getFeatureInfo(featureId) {
  if (FEATURE_COST_ESTIMATES[featureId]) {
    return {
      ...FEATURE_COST_ESTIMATES[featureId],
      id: featureId
    };
  }

  // Unknown feature
  return {
    displayName: featureId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    id: featureId,
    averageCost: 0,
    provider: 'unknown'
  };
}
