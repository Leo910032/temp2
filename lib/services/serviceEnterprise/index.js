// lib/services/serviceEnterprise/index.js
// ✅ MAIN ENTRY POINT - Clean exports with Enhanced Services ONLY

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
  getCurrentUserAnalytics,
  getTeamMemberAnalytics,
  getAggregatedTeamAnalytics,
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

// ==================== REACT HOOKS (CLEANED TRANSITION SERVICE) ====================
// Keep these for UI integration

export {
  useEnterpriseData,
  useOptimizedTeamData,
  clearAllEnhancedServiceCaches,
  preloadEnhancedServiceData
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

// ==================== MIGRATION HELPERS ====================

/**
 * Migration helper function to check service health
 */
export function checkEnhancedServiceHealth() {
  console.log('✅ Using Enhanced Services - migration complete');
  console.log('📖 Enhanced Services guide: https://docs.yourapp.com/enhanced-services');
  
  return {
    isEnhanced: true,
    recommendations: [
      'All obsolete services have been removed',
      'Enhanced Services provide better performance and caching',
      'React hooks now use Enhanced Services internally',
      'Service Factory manages all service instances'
    ]
  };
}

/**
 * Helper to get enhanced service status
 */
export function getEnhancedServiceStatus() {
  const { ServiceFactory } = require('./client/enhanced-index');
  const activeServices = ServiceFactory.getActiveServices();
  
  return {
    enhancedServicesActive: activeServices.length > 0,
    activeServiceCount: activeServices.length,
    availableServices: ServiceFactory.getServiceNames(),
    migrationComplete: true,
    obsoleteServicesRemoved: true,
    nextSteps: [
      'Services are fully migrated to Enhanced Services',
      'Use Service Factory for service management',
      'Monitor cache performance with analyzeCacheUsage()',
      'Consider enabling cache monitoring in production'
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
  
  // Enhanced analytics functions
  getCurrentUserAnalytics: (period) => require('./client/enhanced-index').getCurrentUserAnalytics(period),
  getAggregatedTeamAnalytics: (teamId, userId) => require('./client/enhanced-index').getAggregatedTeamAnalytics(teamId, userId),
  
  // Management functions
  initialize: () => require('./client/enhanced-index').initializeServices(),
  checkHealth: () => require('./client/enhanced-index').checkServiceHealth(),
  clearCaches: () => require('./client/enhanced-index').clearAllCaches(),
  
  // Migration helpers
  checkEnhancedServiceHealth,
  getEnhancedServiceStatus,
  
  // Version info
  version: '3.1.0',
  phase: 'Enhanced Services (Cleaned)'
};