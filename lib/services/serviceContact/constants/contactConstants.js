// lib/services/serviceContact/constants/contactConstants.js
// Contact service constants following enterprise architecture pattern

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
  
  // Advanced features  
  ADVANCED_GROUPS: 'advanced_groups',
  EVENT_DETECTION: 'event_detection',
  BUSINESS_CARD_SCANNER: 'business_card_scanner',
  TEAM_SHARING: 'team_sharing', 
  MAP_VISUALIZATION: 'map_visualization',
  BULK_OPERATIONS: 'bulk_operations',
  
  // Analytics features
  CONTACT_ANALYTICS: 'contact_analytics',
  EXPORT_DATA: 'export_data',
  API_ACCESS: 'api_access'
};

/**
 * Subscription level definitions for contacts
 */
export const SUBSCRIPTION_LEVELS = {
  BASE: 'base',
  PRO: 'pro',
  PREMIUM: 'premium', 
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise'
};

/**
 * Contact limits by subscription level
 */
export const CONTACT_LIMITS = {
  [SUBSCRIPTION_LEVELS.BASE]: {
    maxContacts: 0,
    maxGroups: 0,
    maxShares: 0,
    canExport: false,
    features: []
  },
  [SUBSCRIPTION_LEVELS.PRO]: {
    maxContacts: 2000,
    maxGroups: 10,
    maxShares: 0,
    canExport: true,
    features: [
      CONTACT_FEATURES.BASIC_CONTACTS,
      CONTACT_FEATURES.BASIC_GROUPS,
      CONTACT_FEATURES.BUSINESS_CARD_SCANNER,
      CONTACT_FEATURES.MAP_VISUALIZATION
    ]
  },
  [SUBSCRIPTION_LEVELS.PREMIUM]: {
    maxContacts: 5000,
    maxGroups: 30, 
    maxShares: 100,
    canExport: true,
    features: [
      CONTACT_FEATURES.BASIC_CONTACTS,
      CONTACT_FEATURES.BASIC_GROUPS,
      CONTACT_FEATURES.ADVANCED_GROUPS,
      CONTACT_FEATURES.EVENT_DETECTION,
      CONTACT_FEATURES.BUSINESS_CARD_SCANNER,
      CONTACT_FEATURES.TEAM_SHARING,
      CONTACT_FEATURES.MAP_VISUALIZATION,
      CONTACT_FEATURES.CONTACT_ANALYTICS
    ]
  },
  [SUBSCRIPTION_LEVELS.BUSINESS]: {
    maxContacts: 10000,
    maxGroups: 50,
    maxShares: 500, 
    canExport: true,
    features: [
      CONTACT_FEATURES.BASIC_CONTACTS,
      CONTACT_FEATURES.BASIC_GROUPS,
      CONTACT_FEATURES.ADVANCED_GROUPS,
      CONTACT_FEATURES.EVENT_DETECTION,
      CONTACT_FEATURES.BUSINESS_CARD_SCANNER,
      CONTACT_FEATURES.TEAM_SHARING,
      CONTACT_FEATURES.MAP_VISUALIZATION,
      CONTACT_FEATURES.BULK_OPERATIONS,
      CONTACT_FEATURES.CONTACT_ANALYTICS,
      CONTACT_FEATURES.EXPORT_DATA
    ]
  },
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: {
    maxContacts: -1, // Unlimited
    maxGroups: -1,   // Unlimited
    maxShares: -1,   // Unlimited
    canExport: true,
    features: Object.values(CONTACT_FEATURES) // All features
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
 * Contact group validation rules
 */
export const GROUP_VALIDATION = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100
  },
  description: {
    required: false,
    maxLength: 500
  },
  contactIds: {
    required: true,
    minLength: 1,
    type: 'array'
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
 * Default contact group structure
 */
export const DEFAULT_GROUP = {
  id: null,
  name: '',
  description: '',
  type: CONTACT_GROUP_TYPES.CUSTOM,
  contactIds: [],
  createdAt: null,
  lastModified: null,
  createdBy: null,
  tags: [],
  color: null
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
 * Contact sharing levels
 */
export const SHARING_LEVELS = {
  VIEW_ONLY: 'view_only',
  EDIT: 'edit', 
  FULL_ACCESS: 'full_access'
};

/**
 * Utility functions
 */
export function hasContactFeature(subscriptionLevel, feature) {
  const config = CONTACT_LIMITS[subscriptionLevel?.toLowerCase()];
  return config?.features?.includes(feature) || false;
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

export function validateGroupData(groupData) {
  const errors = [];
  
  if (!groupData.name || groupData.name.trim().length === 0) {
    errors.push('Group name is required');
  }
  
  if (!groupData.contactIds || !Array.isArray(groupData.contactIds) || groupData.contactIds.length === 0) {
    errors.push('At least one contact must be selected');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}