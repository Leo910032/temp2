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
  AI_ENHANCE_RESULTS: 'ai_enhance_results',
  RERANK: 'rerank',

  BASIC_CARD_SCANNER: 'basic_card_scanner',
  AI_ENHANCED_CARD_SCANNER: 'ai_enhanced_card_scanner',

  // Advanced features
  ADVANCED_GROUPS: 'advanced_groups',
  EVENT_DETECTION: 'event_detection',
  RULES_BASED_GROUPS: 'rules_based_groups',
  AI_GROUPS: 'ai_groups',
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
    // Pro tier - API only, no AI
    aiCostBudget: 1.5,         // $1.50 per month (matches MAX_COST_BUDGET_PER_MONTH)
    maxAiRunsPerMonth: 0,      // No AI operations (matches MAX_BILLABLE_RUNS_AI_PER_MONTH)
    maxApiCallsPerMonth: 50,   // API operations limit (matches MAX_BILLABLE_RUNS_API_PER_MONTH)
    deepAnalysisEnabled: false,
    features: [
      CONTACT_FEATURES.BASIC_CONTACTS,
      CONTACT_FEATURES.BASIC_GROUPS,
      CONTACT_FEATURES.RULES_BASED_GROUPS,
      CONTACT_FEATURES.MAP_VISUALIZATION,
      // ✅ Pro tier gets the BASIC scanner
      CONTACT_FEATURES.BASIC_CARD_SCANNER,
      CONTACT_FEATURES.AI_ENHANCE_RESULTS,
    ]
  },
  [SUBSCRIPTION_LEVELS.PREMIUM]: {
    maxContacts: 5000,
    maxGroups: 30,
    maxShares: 100,
    canExport: true,
    // AI Limits for Premium - Moderate budget
    aiCostBudget: 3.0,         // $3.00 per month (matches MAX_COST_BUDGET_PER_MONTH)
    maxAiRunsPerMonth: 30,     // AI operations limit (matches MAX_BILLABLE_RUNS_AI_PER_MONTH)
    maxApiCallsPerMonth: 100,  // API operations limit (matches MAX_BILLABLE_RUNS_API_PER_MONTH)
    deepAnalysisEnabled: false,
    features: [
      CONTACT_FEATURES.BASIC_CONTACTS,
      CONTACT_FEATURES.BASIC_GROUPS,
      CONTACT_FEATURES.ADVANCED_GROUPS,
      CONTACT_FEATURES.EVENT_DETECTION,
      CONTACT_FEATURES.RULES_BASED_GROUPS,
      CONTACT_FEATURES.AI_GROUPS,
      CONTACT_FEATURES.TEAM_SHARING,
      CONTACT_FEATURES.MAP_VISUALIZATION,
      CONTACT_FEATURES.CONTACT_ANALYTICS,
      CONTACT_FEATURES.PREMIUM_SEMANTIC_SEARCH,
      // ✅ Premium tier gets the ADVANCED, AI-enhanced scanner
      CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER,
      CONTACT_FEATURES.AI_ENHANCE_RESULTS,
      CONTACT_FEATURES.RERANK,
    ]
  },
  [SUBSCRIPTION_LEVELS.BUSINESS]: {
    maxContacts: 10000,
    maxGroups: 50,
    maxShares: 500,
    canExport: true,
    // AI Limits for Business - Generous budget
    aiCostBudget: 5.0,         // $5.00 per month (matches MAX_COST_BUDGET_PER_MONTH)
    maxAiRunsPerMonth: 50,     // AI operations limit (matches MAX_BILLABLE_RUNS_AI_PER_MONTH)
    maxApiCallsPerMonth: 200,  // API operations limit (matches MAX_BILLABLE_RUNS_API_PER_MONTH)
    deepAnalysisEnabled: true,
    features: [
      CONTACT_FEATURES.BASIC_CONTACTS,
      CONTACT_FEATURES.BASIC_GROUPS,
      CONTACT_FEATURES.ADVANCED_GROUPS,
      CONTACT_FEATURES.EVENT_DETECTION,
      CONTACT_FEATURES.RULES_BASED_GROUPS,
      CONTACT_FEATURES.AI_GROUPS,
      CONTACT_FEATURES.TEAM_SHARING,
      CONTACT_FEATURES.MAP_VISUALIZATION,
      CONTACT_FEATURES.BULK_OPERATIONS,
      CONTACT_FEATURES.CONTACT_ANALYTICS,
      CONTACT_FEATURES.EXPORT_DATA,
      CONTACT_FEATURES.BUSINESS_AI_SEARCH,
      CONTACT_FEATURES.BUSINESS_SMART_ICEBREAKERS,
      // ✅ Business tier also gets the ADVANCED, AI-enhanced scanner
      CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER,
      CONTACT_FEATURES.AI_ENHANCE_RESULTS,
      CONTACT_FEATURES.RERANK,
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
      CONTACT_FEATURES.RULES_BASED_GROUPS,
      CONTACT_FEATURES.AI_GROUPS,
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
      CONTACT_FEATURES.AI_ENHANCE_RESULTS,
      CONTACT_FEATURES.RERANK,
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

/**
 * Semantic Search Configuration
 */
export const SEMANTIC_SEARCH_CONFIG = {
  // Pinecone index name
  INDEX_NAME: 'weavink',

  // Embedding model - UPDATED TO PINECONE
  EMBEDDING_MODEL: 'multilingual-e5-large',
  EMBEDDING_DIMENSION: 1024, // multilingual-e5-large dimension (was 768 for Gemini)

  // Default search parameters
  DEFAULT_MAX_RESULTS: 10,
  DEFAULT_INCLUDE_METADATA: true,

  // Cache configuration
  CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes
  STREAMING_CACHE_TTL_MS: 30 * 60 * 1000, // 30 minutes

  // Rerank configuration - MIGRATED TO COHERE (2025-01-16)
  // SIMPLIFIED (2025-01-17): Always use rerank-v3.5 for best results
  // Testing showed v3.5 outperforms even rerank-english-v3.0 for English queries
  RERANK_MODELS: {
    // RECOMMENDED: Always use v3.5 - it's Cohere's best model
    // Testing showed v3.5 outperforms even English-specific models
    MULTILINGUAL_V35: 'rerank-v3.5', // $0.002/request - USE THIS (DEFAULT)

    // DEPRECATED: Older models, kept for backwards compatibility only
    ENGLISH: 'rerank-english-v3.0',        // $0.001/request - inferior to v3.5
    MULTILINGUAL: 'rerank-multilingual-v3.0', // $0.002/request - older version

    // Legacy Pinecone models (deprecated, keeping for reference)
    PINECONE_V0: 'pinecone-rerank-v0', // Deprecated: poor scores
    BGE_M3: 'bge-reranker-v2-m3' // Deprecated: poor scores
  },
  DEFAULT_RERANK_TOP_N: 10,

  // Pinecone index configuration
  PINECONE_CONFIG: {
    metric: 'cosine',
    cloud: 'aws',
    region: 'us-east-1'
  },

  // Batch processing configuration
  BATCH_SIZE: 5, // Smaller batches for API rate limits
  BATCH_DELAY_MS: 1500, // Delay between batches

  // Rebuild operations
  REBUILD_BATCH_SIZE: 5,
  REBUILD_BATCH_DELAY_MS: 1500
};

/**
 * Vector Similarity Thresholds by Subscription Level
 * Used to categorize search results by relevance
 */
export const VECTOR_SIMILARITY_THRESHOLDS = {
  enterprise: {
    high: 0.35,     // 35% - Strong semantic match
    medium: 0.25,   // 25% - Good semantic match
    low: 0.15,      // 15% - Moderate semantic match
    minimum: 0.10   // 10% - Weak but potentially relevant
  },
  business: {
    high: 0.40,     // 40% - Strong semantic match
    medium: 0.30,   // 30% - Good semantic match
    low: 0.20,      // 20% - Moderate semantic match
    minimum: 0.15   // 15% - Weak but potentially relevant
  },
  premium: {
    high: 0.45,     // 45% - Strong semantic match
    medium: 0.35,   // 35% - Good semantic match
    low: 0.25,      // 25% - Moderate semantic match
    minimum: 0.20   // 20% - Weak but potentially relevant
  },
  pro: {
    high: 0.50,     // 50% - Strong semantic match
    medium: 0.40,   // 40% - Good semantic match
    low: 0.30,      // 30% - Moderate semantic match
    minimum: 0.25   // 25% - Weak but potentially relevant
  },
  base: {
    high: 0.50,
    medium: 0.40,
    low: 0.30,
    minimum: 0.25
  }
};

/**
 * Rerank Similarity Thresholds
 * Applied after Cohere reranking
 */
export const RERANK_SIMILARITY_THRESHOLDS = {
  high: 0.5,      // Anything over 50% rerank relevance is excellent
  medium: 0.2,    // 20-50% is a good, contextually relevant match
  low: 0.05       // 5-20% is a potential match worth looking at
};

/**
 * AI Confidence Thresholds by Similarity Tier
 * Used to filter AI-enhanced results
 */
export const AI_CONFIDENCE_THRESHOLDS = {
  high: 5,    // Lower threshold for high similarity
  medium: 7,  // Standard threshold
  low: 8,     // Higher threshold for low similarity
  default: 7
};

/**
 * Get vector similarity thresholds for a subscription level
 * @param {string} subscriptionLevel - The subscription level
 * @returns {object} Thresholds object
 */
export function getVectorThresholds(subscriptionLevel) {
  const level = subscriptionLevel?.toLowerCase() || 'base';
  return VECTOR_SIMILARITY_THRESHOLDS[level] || VECTOR_SIMILARITY_THRESHOLDS.base;
}

/**
 * Get rerank similarity thresholds
 * @returns {object} Thresholds object
 */
export function getRerankThresholds() {
  return RERANK_SIMILARITY_THRESHOLDS;
}

/**
 * Get AI confidence threshold for a similarity tier
 * @param {string} similarityTier - The similarity tier (high, medium, low)
 * @returns {number} Confidence threshold
 */
export function getConfidenceThreshold(similarityTier) {
  return AI_CONFIDENCE_THRESHOLDS[similarityTier] || AI_CONFIDENCE_THRESHOLDS.default;
}

/**
 * Minimum confidence thresholds for filtering results
 * Used to intelligently filter search results based on quality rather than hard limits
 */
export const CONFIDENCE_THRESHOLDS = {
  // Vector similarity minimum thresholds by subscription tier
  // Higher tier = lower threshold = more results (better semantic matching)
  VECTOR_MINIMUM: {
    enterprise: 0.60,  // Keep results with 60%+ vector similarity
    business: 0.60,    // Keep results with 60%+ vector similarity
    premium: 0.60,     // Keep results with 60%+ vector similarity
    pro: 0.60,         // Keep results with 60%+ vector similarity
    base: 0.60         // Keep results with 60%+ vector similarity
  },

  // Rerank relevance minimum threshold (applies to all tiers)
  // THRESHOLD CALIBRATION: Lowered from 0.01 to 0.001 (2025-01-16)
  // With YAML documents, Cohere scores are more granular.
  // Valid semantic matches can score 0.001-0.01. Previous 0.01 was too aggressive.
  RERANK_MINIMUM: 0.001,  // Keep results with 0.1%+ rerank relevance score

  // Fallback limits (prevent cost explosion if too many results pass threshold)
  // These are "safety nets" - only applied if threshold filtering returns too many results
  FALLBACK_MAX_RESULTS: {
    vectorSearch: 80,   // Max results to return from vector search (even if more pass threshold)
    rerank: 30          // Max results to send to reranking (even if more pass vector threshold)
  }
};

/**
 * Get minimum vector similarity threshold for a subscription level
 * @param {string} subscriptionLevel - The subscription level
 * @returns {number} Minimum vector score threshold
 */
export function getMinimumVectorThreshold(subscriptionLevel) {
  const level = subscriptionLevel?.toLowerCase() || 'base';
  return CONFIDENCE_THRESHOLDS.VECTOR_MINIMUM[level] || CONFIDENCE_THRESHOLDS.VECTOR_MINIMUM.base;
}

/**
 * Get minimum rerank threshold (same for all subscription levels)
 * @returns {number} Minimum rerank relevance score threshold
 */
export function getMinimumRerankThreshold() {
  return CONFIDENCE_THRESHOLDS.RERANK_MINIMUM;
}

/**
 * Semantic Document Enhancement Constants
 * Used by documentBuilderService for building rich, searchable contact documents
 */
export const SEMANTIC_ENHANCEMENT = {
  // Professional keywords for technology
  TECH_KEYWORDS: [
    'ai', 'artificial intelligence', 'machine learning', 'blockchain', 'cloud computing',
    'software development', 'data science', 'cybersecurity', 'mobile development',
    'web development', 'devops', 'automation', 'digital transformation'
  ],

  // Business keywords
  BUSINESS_KEYWORDS: [
    'startup', 'entrepreneur', 'venture capital', 'fundraising', 'business development',
    'strategy', 'consulting', 'marketing', 'sales', 'product management',
    'project management', 'leadership', 'innovation'
  ],

  // Industry keywords
  INDUSTRY_KEYWORDS: [
    'fintech', 'healthtech', 'edtech', 'retail', 'e-commerce', 'manufacturing',
    'healthcare', 'finance', 'education', 'logistics', 'real estate'
  ],

  // Professional category mappings
  PROFESSIONAL_CATEGORIES: {
    'Technology Leadership': ['cto', 'vp engineering', 'head of technology', 'tech lead'],
    'Startup Founder': ['founder', 'co-founder', 'startup', 'entrepreneur'],
    'AI/ML Expert': ['ai', 'artificial intelligence', 'machine learning', 'data scientist'],
    'Business Executive': ['ceo', 'president', 'executive', 'chief officer'],
    'Product Management': ['product manager', 'product lead', 'product director'],
    'Engineering Professional': ['engineer', 'developer', 'software', 'programming'],
    'Venture Capital': ['vc', 'venture capital', 'investor', 'partner at'],
    'Consultant': ['consultant', 'advisory', 'consulting', 'advisor']
  },

  // Industry category mappings
  INDUSTRY_CATEGORIES: {
    'Fintech': ['fintech', 'financial technology', 'payments', 'banking', 'finance'],
    'Healthcare Technology': ['healthtech', 'medical', 'healthcare', 'biotech'],
    'E-commerce': ['ecommerce', 'e-commerce', 'retail', 'marketplace'],
    'Enterprise Software': ['saas', 'enterprise', 'b2b software', 'business software']
  },

  // Known tech companies for context enhancement
  TECH_COMPANIES: ['google', 'microsoft', 'apple', 'amazon', 'meta', 'tesla', 'nvidia', 'openai'],

  // Known consulting firms
  CONSULTING_FIRMS: ['mckinsey', 'bain', 'bcg'],

  // Known financial institutions
  FINANCIAL_FIRMS: ['goldman', 'morgan', 'jpmorgan']
};

/**
 * Query Preprocessing Configuration for Rerank
 * Strips command-style verbs to improve semantic matching with declarative documents
 *
 * Problem: "Find healthcare AI contacts" (imperative) vs "Liu Hall is Software Engineer..." (declarative)
 * Solution: Strip "Find" → "healthcare AI contacts" for better semantic similarity
 */
export const QUERY_PREPROCESSING = {
  // English command verbs (sorted by length, longest first for proper matching)
  COMMAND_VERBS_EN: [
    'show me all', 'give me all', 'get me all', 'list all',
    'show me', 'give me', 'get me', 'find me',
    'search for', 'looking for', 'look for',
    'find', 'show', 'list', 'get', 'display', 'retrieve'
  ],

  // French command verbs
  COMMAND_VERBS_FR: [
    'montre-moi tous', 'donne-moi tous', 'trouve-moi tous',
    'montre-moi', 'donne-moi', 'trouve-moi',
    'recherche', 'cherche',
    'trouve', 'montre', 'liste', 'donne', 'affiche'
  ],

  // Italian command verbs
  COMMAND_VERBS_IT: [
    'mostrami tutti', 'dammi tutti', 'trovami tutti',
    'mostrami', 'dammi', 'trovami',
    'cerca', 'ricerca',
    'trova', 'mostra', 'elenca', 'dai', 'visualizza'
  ],

  // Words to preserve (don't strip if query starts with these)
  PRESERVE_KEYWORDS: [
    // Question words that indicate semantic queries
    'who', 'what', 'where', 'when', 'why', 'how', 'which',
    'qui', 'que', 'où', 'quand', 'pourquoi', 'comment', 'quel',
    'chi', 'cosa', 'dove', 'quando', 'perché', 'come', 'quale'
  ]
};