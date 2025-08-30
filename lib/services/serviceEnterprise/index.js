// lib/services/serviceEnterprise/index.js
// ✅ MAIN ENTRY POINT - Clean exports with proper Enhanced Services

// ==================== ENHANCED SERVICES (PRIMARY) ====================
// These are the main services that should be used going forward

export {
  // Core enhanced services
  subscriptionService,
  teamService,
  invitationService,
  analyticsService,
  auditService,
  cacheService,
  
  // Service factory
  ServiceFactory,
  
  // Service management
  initializeServices,
  destroyServices,
  resetServices,
  checkServiceHealth,
  runDiagnostics,
  warmUpServices,
  
  // Subscription & User Context
  getEnterpriseSubscriptionStatus,
  getUserContext,
  getEnterpriseDataBatch,
  validateEnterpriseOperation,
  hasEnterpriseAccess,
  hasFeature,
  
  // Team Management
  getUserTeams,
  createTeam,
  getTeamMembers,
  getTeamDetails,
  getTeamDataBatch,
  updateMemberRole,
  removeMember,
  bulkUpdateMemberRoles,
  getTeamStats,
  
  // Team Permissions
  getTeamPermissions,
  updateTeamPermissions,
  
  // Invitation Management
  getTeamInvitations,
  getPendingUserInvitations,
  sendInvitation,
  inviteTeamMember,
  resendInvitation,
  revokeInvitation,
  acceptInvitation,
  verifyInvitation,
  bulkResendInvitations,
  bulkRevokeInvitations,
  getInvitationStats,
  getExpiredInvitations,
  getExpiringSoonInvitations,
  cleanupExpiredInvitations,
  resendExpiringSoonInvitations,
  
  // Analytics & Impersonation
  getUserAnalytics,
  getTeamAnalytics,
  getImpersonatedAnalytics,
  canImpersonateAnalytics,
  getImpersonationAuditLog,
  
  // Audit Logs
  getAuditLogs,
  exportAuditLogs,
  
  // Cache Management
  getCacheStats,
  clearAllCaches,
  clearAnalyticsCaches,
  clearTeamCaches,
  clearUserCaches,
  clearInvitationCaches,
  optimizeCache,
  preloadEnterpriseData,
  preloadTeamData,
  analyzeCacheUsage,
  startCacheMonitoring,
  stopCacheMonitoring,
  
  // Subscription Utilities
  getSubscriptionLevels,
  getSubscriptionConfig,
  hasEnterpriseAccessForLevel,
  isSubscriptionHigherOrEqual,
  getNextSubscriptionTier,
  getUpgradeSuggestions,
  initiateSubscriptionUpgrade,
  cancelSubscription,
  
  // Utility groups
  enterpriseServices,
  enterpriseUtils,
  teamUtils,
  invitationUtils,
  analyticsUtils,
  cacheUtils,
  
  // Service info
  getServiceInfo,
  isServiceActive,
  getActiveServices,
  getAllServices
  
} from './client/enhanced-index';

// ==================== REACT HOOKS (TRANSITION PERIOD) ====================
// Keep these for backward compatibility during migration

export {
  useEnterpriseData,
  useOptimizedTeamData
} from './client/transitionService';

// ==================== CONSTANTS ====================

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

// ==================== CORE INFRASTRUCTURE (FOR ADVANCED USAGE) ====================

export {
  EnterpriseApiClient,
  EnterpriseApiError,
  globalCache,
  ErrorHandler
} from './client/enhanced-index';

// ==================== SERVICE CLASSES (FOR ADVANCED USAGE) ====================

export {
  EnhancedSubscriptionService,
  EnhancedTeamService,
  EnhancedInvitationService,
  EnhancedAnalyticsService,
  EnhancedAuditService,
  EnhancedCacheService,
  BaseService
} from './client/enhanced-index';

// ==================== VERSION & METADATA ====================

export {
  ENTERPRISE_SERVICE_VERSION,
  PHASE
} from './client/enhanced-index';

// ==================== LEGACY COMPATIBILITY ====================
// These are kept for backward compatibility but are deprecated

// Re-export some individual functions that might be used directly
export { 
  // These functions now use the enhanced services internally
  createTeam as createTeamLegacy,
  updateMemberRole as updateMemberRoleLegacy,
  removeTeamMember as removeMemberLegacy  // ✅ FIXED
} from './client/transitionService';

// ==================== MIGRATION HELPERS ====================

/**
 * Migration helper function to check if component is using legacy services
 */
export function checkLegacyUsage() {
  console.warn('⚠️ DEPRECATION WARNING: You are using legacy service imports. Please migrate to enhanced services.');
  console.log('📖 Migration guide: https://docs.yourapp.com/enterprise-services-migration');
  
  return {
    isLegacy: true,
    recommendations: [
      'Replace useOptimizedTeamData with teamService() from enhanced services',
      'Replace direct function calls with service methods',
      'Use ServiceFactory for service management',
      'Consider using the new cache management features'
    ]
  };
}

/**
 * Helper to get migration status
 */
export function getMigrationStatus() {
  const { ServiceFactory } = require('./client/enhanced-index');
  const activeServices = ServiceFactory.getActiveServices();
  
  return {
    enhancedServicesActive: activeServices.length > 0,
    activeServiceCount: activeServices.length,
    availableServices: ServiceFactory.getServiceNames(),
    migrationComplete: activeServices.length >= 5, // All major services
    nextSteps: activeServices.length === 0 ? [
      'Initialize services with initializeServices()',
      'Replace legacy function calls with service methods',
      'Update imports to use enhanced services'
    ] : [
      'Complete migration of remaining components',
      'Remove legacy service imports',
      'Enable cache monitoring'
    ]
  };
}

// ==================== DEFAULT EXPORT ====================

export default {
  // Main service accessors
  services: {
    subscription: () => require('./client/enhanced-index').subscriptionService(),
    team: () => require('./client/enhanced-index').teamService(),
    invitation: () => require('./client/enhanced-index').invitationService(),
    analytics: () => require('./client/enhanced-index').analyticsService(),
    audit: () => require('./client/enhanced-index').auditService(),
    cache: () => require('./client/enhanced-index').cacheService()
  },
  
  // Quick access to common functions
  getUserTeams: () => require('./client/enhanced-index').getUserTeams(),
  getTeamMembers: (teamId) => require('./client/enhanced-index').getTeamMembers(teamId),
  createTeam: (teamData) => require('./client/enhanced-index').createTeam(teamData),
  inviteTeamMember: (teamId, data) => require('./client/enhanced-index').inviteTeamMember(teamId, data),
  
  // Management functions
  initialize: () => require('./client/enhanced-index').initializeServices(),
  checkHealth: () => require('./client/enhanced-index').checkServiceHealth(),
  clearCaches: () => require('./client/enhanced-index').clearAllCaches(),
  
  // Migration helpers
  checkLegacyUsage,
  getMigrationStatus,
  
  // Version info
  version: '3.0.0',
  phase: 'Enhanced Services'
};