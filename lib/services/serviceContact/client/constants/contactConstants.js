/**
 * THIS FILE HAS BEEN REFACTORED
 */
// lib/services/serviceContact/client/constants/contactConstants.js
// Contact service constants following enterprise architecture pattern

import { SUBSCRIPTION_LEVELS } from '../../../core/constants.js';

// Re-export AI cost constants from centralized location

/**
 * Contact status definitions
 */
export const CONTACT_STATUS = {
  NEW: 'new',
  VIEWED: 'viewed', 
  ARCHIVED: 'archived',
  DELETED: 'deleted'
};

/**
 * Contact source definitions
 */
export const CONTACT_SOURCES = {
  MANUAL: 'manual',
  BUSINESS_CARD_SCAN: 'business_card_scan', 
  EXCHANGE_FORM: 'exchange_form',
  IMPORT_CSV: 'import_csv',
  IMPORT_JSON: 'import_json',
  TEAM_SHARE: 'team_share',
  API: 'api'
};

/**
 * Contact group types
 */
export const CONTACT_GROUP_TYPES = {
  CUSTOM: 'custom',
  AUTO_COMPANY: 'auto_company',
  AUTO_LOCATION: 'auto_location', 
  AUTO_EVENT: 'auto_event',
  AUTO_TIME: 'auto_time'
};

/**
 * Contact features by subscription level
 */
export const CONTACT_FEATURES = {
  // Basic features
  BASIC_CONTACTS: 'basic_contacts',
  BASIC_GROUPS: 'basic_groups',
  
  // Semantic Search Features
  PREMIUM_SEMANTIC_SEARCH: 'premium_semantic_search',
  BUSINESS_AI_SEARCH: 'business_ai_search',
  BUSINESS_SMART_ICEBREAKERS: 'business_smart_icebreakers',

  BASIC_CARD_SCANNER: 'basic_card_scanner',
  AI_ENHANCED_CARD_SCANNER: 'ai_enhanced_card_scanner',

  // Advanced features  
  ADVANCED_GROUPS: 'advanced_groups',
  EVENT_DETECTION: 'event_detection',
  // NEW Card Scanner Tiers
  TEAM_SHARING: 'team_sharing', 
  MAP_VISUALIZATION: 'map_visualization',
  BULK_OPERATIONS: 'bulk_operations',
  
  // Analytics features
  CONTACT_ANALYTICS: 'contact_analytics',
  EXPORT_DATA: 'export_data',
  API_ACCESS: 'api_access'
};

/**
 * Contact limits and features mapped to CORE subscription levels
 */
export const CONTACT_LIMITS = {
  [SUBSCRIPTION_LEVELS.BASE]: {
    maxContacts: 0,
    maxGroups: 0,
    maxShares: 0,
    canExport: false,
    // AI Limits
    aiCostBudget: 0,
    maxAiRunsPerMonth: 0,
    deepAnalysisEnabled: false,
    features: []
  },
  [SUBSCRIPTION_LEVELS.PRO]: {
    maxContacts: 2000,
    maxGroups: 10,
    maxShares: 0,
    canExport: true,
    // AI Limits for Pro - Conservative budget
    aiCostBudget: 0.01,        // $0.01 per month (~10 standard runs)
    maxAiRunsPerMonth: 5,      // Hard limit on runs
    deepAnalysisEnabled: false,
    features: [
      CONTACT_FEATURES.BASIC_CONTACTS,
      CONTACT_FEATURES.BASIC_GROUPS,
      CONTACT_FEATURES.MAP_VISUALIZATION,
      // ✅ Pro tier gets the BASIC scanner
      CONTACT_FEATURES.BASIC_CARD_SCANNER,
    ]
  },
  [SUBSCRIPTION_LEVELS.PREMIUM]: {
    maxContacts: 5000,
    maxGroups: 30, 
    maxShares: 100,
    canExport: true,
    // AI Limits for Premium - Moderate budget
    aiCostBudget: 0.05,        // $0.05 per month (~50 standard runs)
    maxAiRunsPerMonth: 20,     // Higher run limit
    deepAnalysisEnabled: false,
    features: [
      CONTACT_FEATURES.BASIC_CONTACTS,
      CONTACT_FEATURES.BASIC_GROUPS,
      CONTACT_FEATURES.ADVANCED_GROUPS,
      CONTACT_FEATURES.EVENT_DETECTION,
      CONTACT_FEATURES.TEAM_SHARING,
      CONTACT_FEATURES.MAP_VISUALIZATION,
      CONTACT_FEATURES.CONTACT_ANALYTICS,
      CONTACT_FEATURES.PREMIUM_SEMANTIC_SEARCH,
      // ✅ Premium tier gets the ADVANCED, AI-enhanced scanner
      CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER,
    ]
  },
  [SUBSCRIPTION_LEVELS.BUSINESS]: {
    maxContacts: 10000,
    maxGroups: 50,
    maxShares: 500, 
    canExport: true,
    // AI Limits for Business - Generous budget
    aiCostBudget: 0.20,        // $0.20 per month (~200 standard runs)
    maxAiRunsPerMonth: 100,    // High run limit
    deepAnalysisEnabled: true,
    features: [
      CONTACT_FEATURES.BASIC_CONTACTS,
      CONTACT_FEATURES.BASIC_GROUPS,
      CONTACT_FEATURES.ADVANCED_GROUPS,
      CONTACT_FEATURES.EVENT_DETECTION,
      CONTACT_FEATURES.TEAM_SHARING,
      CONTACT_FEATURES.MAP_VISUALIZATION,
      CONTACT_FEATURES.BULK_OPERATIONS,
      CONTACT_FEATURES.CONTACT_ANALYTICS,
      CONTACT_FEATURES.EXPORT_DATA,
      CONTACT_FEATURES.BUSINESS_AI_SEARCH,
      CONTACT_FEATURES.BUSINESS_SMART_ICEBREAKERS,
      // ✅ Business tier also gets the ADVANCED, AI-enhanced scanner
      CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER,
    ]
  },
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: {
    maxContacts: -1,          // Unlimited
    maxGroups: -1,            // Unlimited
    maxShares: -1,            // Unlimited
    canExport: true,
    // AI Limits for Enterprise - Unlimited with premium features
    aiCostBudget: -1,         // Unlimited budget
    maxAiRunsPerMonth: -1,    // Unlimited runs
    deepAnalysisEnabled: true, // ONLY tier with deep analysis
    features: [
      CONTACT_FEATURES.BASIC_CONTACTS,
      CONTACT_FEATURES.BASIC_GROUPS,
      CONTACT_FEATURES.ADVANCED_GROUPS,
      CONTACT_FEATURES.EVENT_DETECTION,
      CONTACT_FEATURES.TEAM_SHARING,
      CONTACT_FEATURES.MAP_VISUALIZATION,
      CONTACT_FEATURES.BULK_OPERATIONS,
      CONTACT_FEATURES.CONTACT_ANALYTICS,
      CONTACT_FEATURES.EXPORT_DATA,
      CONTACT_FEATURES.API_ACCESS,
      CONTACT_FEATURES.PREMIUM_SEMANTIC_SEARCH,
      CONTACT_FEATURES.BUSINESS_AI_SEARCH,
      CONTACT_FEATURES.BUSINESS_SMART_ICEBREAKERS,
      // ✅ Enterprise tier also gets the ADVANCED, AI-enhanced scanner
      CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER,
    ]
  }
};

/**
 * AI Feature availability by subscription tier
 */
export const AI_FEATURE_MATRIX = {
  [SUBSCRIPTION_LEVELS.BASE]: {
    smartCompanyMatching: false,
    industryDetection: false, 
    relationshipDetection: false,
    deepAnalysis: false
  },
  [SUBSCRIPTION_LEVELS.PRO]: {
    smartCompanyMatching: true,   // Only basic company matching
    industryDetection: false,
    relationshipDetection: false,
    deepAnalysis: false
  },
  [SUBSCRIPTION_LEVELS.PREMIUM]: {
    smartCompanyMatching: true,
    industryDetection: true,      // Adds industry detection
    relationshipDetection: false,
    deepAnalysis: false
  },
  [SUBSCRIPTION_LEVELS.BUSINESS]: {
    smartCompanyMatching: true,
    industryDetection: true,
    relationshipDetection: true,  // Adds relationship detection
    deepAnalysis: false
  },
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: {
    smartCompanyMatching: true,
    industryDetection: true,
    relationshipDetection: true,
    deepAnalysis: true            // ONLY tier with deep analysis
  }
};

/**
 * Contact permissions for different operations
 */
export const CONTACT_PERMISSIONS = {
  // Basic operations
  CAN_VIEW_CONTACTS: 'canViewContacts',
  CAN_CREATE_CONTACTS: 'canCreateContacts',
  CAN_EDIT_CONTACTS: 'canEditContacts', 
  CAN_DELETE_CONTACTS: 'canDeleteContacts',
  
  // Group operations
  CAN_CREATE_GROUPS: 'canCreateGroups',
  CAN_EDIT_GROUPS: 'canEditGroups',
  CAN_DELETE_GROUPS: 'canDeleteGroups',
  CAN_MANAGE_GROUP_MEMBERS: 'canManageGroupMembers',
  
  // Sharing operations
  CAN_SHARE_CONTACTS: 'canShareContacts',
  CAN_RECEIVE_SHARED_CONTACTS: 'canReceiveSharedContacts',
  CAN_MANAGE_SHARED_CONTACTS: 'canManageSharedContacts',
  
  // Import/Export operations
  CAN_IMPORT_CONTACTS: 'canImportContacts',
  CAN_EXPORT_CONTACTS: 'canExportContacts',
  CAN_BULK_OPERATIONS: 'canBulkOperations',
  
  // Advanced features
  CAN_SCAN_BUSINESS_CARDS: 'canScanBusinessCards',
  CAN_VIEW_ANALYTICS: 'canViewAnalytics',
  CAN_USE_API: 'canUseApi'
};

/**
 * Contact validation rules
 */
export const CONTACT_VALIDATION = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100
  },
  email: {
    required: false,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 100
  },
  phone: {
    required: false,
    pattern: /^[\+]?[\d\s\-\(\)\.]{7,}$/,
    maxLength: 20
  },
  company: {
    required: false,
    maxLength: 100
  },
  message: {
    required: false,
    maxLength: 500
  },
  website: {
    required: false,
    pattern: /^https?:\/\/.+/,
    maxLength: 200
  }
};

/**
 * Contact export formats
 */
export const EXPORT_FORMATS = {
  JSON: 'json',
  CSV: 'csv', 
  VCF: 'vcf',
  XLSX: 'xlsx'
};

/**
 * Contact import formats
 */
export const IMPORT_FORMATS = {
  JSON: 'json',
  CSV: 'csv',
  VCF: 'vcf',
  XLSX: 'xlsx'
};

/**
 * Default contact data structure
 */
export const DEFAULT_CONTACT = {
  id: null,
  name: '',
  email: '',
  phone: '',
  company: '',
  jobTitle: '',
  website: '',
  message: '',
  status: CONTACT_STATUS.NEW,
  source: CONTACT_SOURCES.MANUAL,
  location: null,
  details: [],
  tags: [],
  submittedAt: null,
  lastModified: null,
  createdBy: null
};

/**
 * Contact activity types for audit logs
 */
export const CONTACT_ACTIVITIES = {
  CREATED: 'contact_created',
  UPDATED: 'contact_updated', 
  DELETED: 'contact_deleted',
  STATUS_CHANGED: 'contact_status_changed',
  SHARED: 'contact_shared',
  IMPORTED: 'contacts_imported',
  EXPORTED: 'contacts_exported',
  GROUP_CREATED: 'group_created',
  GROUP_UPDATED: 'group_updated',
  GROUP_DELETED: 'group_deleted',
  BUSINESS_CARD_SCANNED: 'business_card_scanned'
};

/**
 * Error codes for contact operations
 */
export const CONTACT_ERROR_CODES = {
  CONTACT_NOT_FOUND: 'CONTACT_NOT_FOUND',
  INVALID_CONTACT_DATA: 'INVALID_CONTACT_DATA',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  INVALID_FILE_FORMAT: 'INVALID_FILE_FORMAT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS'
};

/**
 * Human-readable labels for contact fields
 */
export const CONTACT_FIELD_LABELS = {
  name: 'Full Name',
  email: 'Email Address', 
  phone: 'Phone Number',
  company: 'Company',
  jobTitle: 'Job Title',
  website: 'Website',
  message: 'Message/Notes',
  status: 'Status',
  source: 'Source',
  submittedAt: 'Date Added',
  lastModified: 'Last Modified'
};

/**
 * Helper function to get AI features available for a subscription level
 */
export function getAIFeaturesForLevel(subscriptionLevel) {
  const level = subscriptionLevel?.toLowerCase() || 'base';
  return AI_FEATURE_MATRIX[level] || AI_FEATURE_MATRIX[SUBSCRIPTION_LEVELS.BASE];
}

/**
 * Helper function to check if user can use deep analysis
 */
export function canUseDeepAnalysis(subscriptionLevel) {
  const level = subscriptionLevel?.toLowerCase() || 'base';
  const limits = CONTACT_LIMITS[level];
  return limits?.deepAnalysisEnabled || false;
}

/**
 * Utility functions
 */
export function hasContactFeature(subscriptionLevel, feature) {
  console.log('--- DEBUG: Inside hasContactFeature ---');
  console.log(`[SERVER-SIDE CHECK] Subscription Level Received: >>${subscriptionLevel}<<`);
  console.log(`[SERVER-SIDE CHECK] Feature to Check: >>${feature}<<`)
  const config = CONTACT_LIMITS[subscriptionLevel?.toLowerCase()];
  if (!config) {
    console.log('[SERVER-SIDE CHECK] RESULT: No config found for this level. Access DENIED.');
    console.log('--------------------------------------');
    return false;
  }
  console.log('[SERVER-SIDE CHECK] Config found for this level. Features available:', config.features);

  const hasAccess = config?.features?.includes(feature) || false;
  console.log(`[SERVER-SIDE CHECK] Does '${subscriptionLevel}' include '${feature}'? --> ${hasAccess}`);
  console.log('[SERVER-SIDE CHECK] RESULT: Access', hasAccess ? 'GRANTED' : 'DENIED');
  console.log('--------------------------------------');

  return hasAccess;
}

export function getContactLimits(subscriptionLevel) {
  const level = subscriptionLevel?.toLowerCase();
  return CONTACT_LIMITS[level] || CONTACT_LIMITS[SUBSCRIPTION_LEVELS.BASE];
}

export function validateContactData(contactData) {
  const errors = [];
  
  // Validate required fields
  if (!contactData.name || contactData.name.trim().length === 0) {
    errors.push('Name is required');
  }
  
  // Validate email format if provided
  if (contactData.email && !CONTACT_VALIDATION.email.pattern.test(contactData.email)) {
    errors.push('Invalid email format');
  }
  
  // Validate phone format if provided
  if (contactData.phone && !CONTACT_VALIDATION.phone.pattern.test(contactData.phone)) {
    errors.push('Invalid phone format');
  }
  
  // Validate field lengths
  Object.entries(CONTACT_VALIDATION).forEach(([field, rules]) => {
    const value = contactData[field];
    if (value && rules.maxLength && value.length > rules.maxLength) {
      errors.push(`${CONTACT_FIELD_LABELS[field] || field} exceeds maximum length of ${rules.maxLength} characters`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}