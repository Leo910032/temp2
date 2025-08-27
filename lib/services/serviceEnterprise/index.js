// lib/services/serviceEnterprise/index.js
// ✅ FIXED: Export all CLIENT services with correct imports

// ==================== CLIENT SERVICES ONLY ====================
// These are safe for React components and browser usage

export {
  // ✅ CRITICAL: Main hooks for React components
  useEnterpriseData,           // ✅ MAIN HOOK
  useOptimizedTeamData,        // ✅ TEAM DATA HOOK
  
  // Core data functions
  getUserContext,
  getUserTeams,
  getTeamData,                 // ✅ BATCH OPERATION
  createTeam,                  // ✅ Team creation
  
  // Team management
  getTeamMembers,
  getTeamInvitations,
  updateMemberRole,
  removeTeamMember,
  
  // Invitation management
  inviteTeamMember,
  resendInvitation,
  revokeInvitation,
  bulkResendInvitations,
  bulkRevokeInvitations,
  
  // Analytics functions
  getCurrentUserAnalytics,
  getTeamMemberAnalytics,
  getTeamAnalytics,
  getAggregatedTeamAnalytics
} from './client/transitionService';

// ✅ FIXED: Import permissions functions from the correct service
export {
  // Team permissions - from optimizedEnterpriseService
  getTeamPermissions,
  updateTeamPermissions,
  
  // Cache utilities
  getCacheStats,
  clearAllCaches,
  clearAnalyticsCaches,
  preloadEnterpriseData,
  
  // Analytics impersonation functions
  getImpersonatedAnalytics,
  canImpersonateAnalytics,
  getImpersonationAuditLog,
  
  // Batch operations
  getEnterpriseDataBatch,
  getTeamDataBatch
} from './client/optimizedEnterpriseService';

export {
  // Subscription and feature validation
  getEnterpriseSubscriptionStatus,
  validateEnterpriseOperation,
  hasEnterpriseAccess,
  hasFeature,
  getSubscriptionConfig,
  isSubscriptionHigherOrEqual,
  getUpgradeSuggestions,
  initiateSubscriptionUpgrade,
  cancelSubscription,
  
  // Constants
  SUBSCRIPTION_LEVELS,
  ENTERPRISE_FEATURES,
  SUBSCRIPTION_FEATURES
} from './client/enterpriseSubscriptionService';

// ✅ Export constants that components need
export {
  TEAM_ROLES,
  PERMISSIONS,
  DEFAULT_PERMISSIONS_BY_ROLE,
  TEAM_ROLE_HIERARCHY,
  ORGANIZATION_ROLES,
  INVITATION_STATUS,
  EMPLOYEE_RESTRICTED_PERMISSIONS,
  isEmployeeRestrictedPermission
} from './constants/enterpriseConstants';