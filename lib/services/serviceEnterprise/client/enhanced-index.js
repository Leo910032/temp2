//////////////////////////////////////////////
// lib/services/serviceEnterprise/client/enhanced-index.js
// Phase 3: Complete exports with Enhanced Services ONLY

"use client"

// Import ServiceFactory directly so it's available in this module's scope
import { ServiceFactory } from './factories/ServiceFactory';

// Re-export ServiceFactory for direct access
export { ServiceFactory };

// ==================== ENHANCED SERVICES ====================

// Enhanced services with full abstractions
export { EnhancedSubscriptionService } from './services/EnhancedSubscriptionService';
export { EnhancedTeamService } from './services/EnhancedTeamService';
export { EnhancedInvitationService } from './services/EnhancedInvitationService';
export { EnhancedAuditService } from './services/EnhancedAuditService';
export { EnhancedAnalyticsService } from './services/EnhancedAnalyticsService';
export { EnhancedCacheService } from './services/EnhancedCacheService';

// ==================== BASE ABSTRACTIONS ====================

// Base abstractions for extending
export { BaseService } from './abstractions/BaseService';
/*
// Interfaces for type checking
export { 
  ISubscriptionService, 
  ITeamService, 
  IInvitationService 
} from './interfaces/ISubscriptionService';
*/
// ==================== CORE INFRASTRUCTURE ====================

// Core infrastructure
export { EnterpriseApiClient, EnterpriseApiError } from './core/apiClient';
export { CacheManager, globalCache } from './core/cacheManager';
export { ErrorHandler } from './core/errorHandler';

// ==================== SERVICE FACTORY FUNCTIONS ====================

// Service accessor functions
export const subscriptionService = () => ServiceFactory.getSubscriptionService();
export const teamService = () => ServiceFactory.getTeamService();
export const invitationService = () => ServiceFactory.getInvitationService();
export const auditService = () => ServiceFactory.getAuditService();
export const analyticsService = () => ServiceFactory.getAnalyticsService();
export const cacheService = () => ServiceFactory.getCacheService();

// ==================== ENHANCED SERVICE FUNCTIONS ====================

// Subscription & User Context
export const getEnterpriseSubscriptionStatus = () => 
  subscriptionService().getEnterpriseSubscriptionStatus();

export const getUserContext = () => 
  subscriptionService().getUserContext();

export const getEnterpriseDataBatch = () => 
  subscriptionService().getEnterpriseDataBatch();

export const validateEnterpriseOperation = (operation, context = {}) => 
  subscriptionService().validateOperation(operation, context);

export const hasEnterpriseAccess = () => 
  subscriptionService().hasEnterpriseAccess();

export const hasFeature = (feature) => 
  subscriptionService().hasFeature(feature);

// Team Management
export const getUserTeams = () => 
  teamService().getUserTeams();

export const createTeam = (teamData) => 
  teamService().createTeam(teamData);

export const getTeamMembers = (teamId) => 
  teamService().getTeamMembers(teamId);

export const getTeamDetails = (teamId) => 
  teamService().getTeamDetails(teamId);

export const getTeamDataBatch = (teamId) => 
  teamService().getTeamDataBatch(teamId);

export const updateMemberRole = (teamId, memberId, newRole) => 
  teamService().updateMemberRole(teamId, memberId, newRole);

export const removeMember = (teamId, memberId) => 
  teamService().removeMember(teamId, memberId);

export const bulkUpdateMemberRoles = (teamId, roleUpdates) => 
  teamService().bulkUpdateMemberRoles(teamId, roleUpdates);

export const getTeamStats = (teamId) => 
  teamService().getTeamStats(teamId);

// Team Permissions
export const getTeamPermissions = (teamId) => 
  teamService().getTeamPermissions(teamId);

export const updateTeamPermissions = (teamId, permissions) => 
  teamService().updateTeamPermissions(teamId, permissions);

// Invitation Management
export const getTeamInvitations = (teamId) => 
  invitationService().getTeamInvitations(teamId);

export const getPendingUserInvitations = () => 
  invitationService().getPendingUserInvitations();

export const sendInvitation = (teamId, email, role) => 
  invitationService().sendInvitation(teamId, email, role);

export const inviteTeamMember = (teamId, invitationData, currentTeamSize = 0) => 
  invitationService().inviteTeamMember(teamId, invitationData, currentTeamSize);

export const resendInvitation = (invitationId) => 
  invitationService().resendInvitation(invitationId);

export const revokeInvitation = (invitationId) => 
  invitationService().revokeInvitation(invitationId);

export const acceptInvitation = (invitationId) => 
  invitationService().acceptInvitation(invitationId);

export const verifyInvitation = (email, code) => 
  invitationService().verifyInvitation(email, code);

export const bulkResendInvitations = (invitationIds, onProgress = null) => 
  invitationService().bulkResendInvitations(invitationIds, onProgress);

export const bulkRevokeInvitations = (invitationIds, onProgress = null) => 
  invitationService().bulkRevokeInvitations(invitationIds, onProgress);

export const getInvitationStats = (teamId) => 
  invitationService().getInvitationStats(teamId);

export const getExpiredInvitations = (teamId) => 
  invitationService().getExpiredInvitations(teamId);

export const getExpiringSoonInvitations = (teamId, hours = 24) => 
  invitationService().getExpiringSoonInvitations(teamId, hours);

export const cleanupExpiredInvitations = (teamId) => 
  invitationService().cleanupExpiredInvitations(teamId);

export const resendExpiringSoonInvitations = (teamId, hours = 24) => 
  invitationService().resendExpiringSoonInvitations(teamId, hours);

// Analytics & Impersonation
export const getUserAnalytics = (period = '30d') => 
  analyticsService().getUserAnalytics(period);

export const getTeamAnalytics = (teamId) => 
  analyticsService().getTeamAnalytics(teamId);

export const getImpersonatedAnalytics = (targetUserId, teamId, period = '30d') => 
  analyticsService().getImpersonatedAnalytics(targetUserId, teamId, period);

export const canImpersonateAnalytics = (targetUserId, teamId) => 
  analyticsService().canImpersonateAnalytics(targetUserId, teamId);

export const getImpersonationAuditLog = (teamId, limit = 50) => 
  analyticsService().getImpersonationAuditLog(teamId, limit);

// NEW: Enhanced Analytics Functions
export const getCurrentUserAnalytics = (period = 'all') =>
  analyticsService().getCurrentUserAnalytics(period);

export const getTeamMemberAnalytics = (memberId, teamId, period = '30d') =>
  analyticsService().getTeamMemberAnalytics(memberId, teamId, period);

export const getAggregatedTeamAnalytics = (teamId, currentUserId) =>
  analyticsService().getAggregatedTeamAnalytics(teamId, currentUserId);

// Audit Logs
export const getAuditLogs = (teamId, options = {}) => 
  auditService().getLogs(teamId, options);

export const exportAuditLogs = (teamId) => 
  auditService().exportLogs(teamId);

// Cache Management
export const getCacheStats = () => 
  cacheService().getCacheStats();

export const clearAllCaches = () => 
  cacheService().clearAllCaches();

export const clearAnalyticsCaches = () => 
  cacheService().clearAnalyticsCaches();

export const clearTeamCaches = (teamId = null) => 
  cacheService().clearTeamCaches(teamId);

export const clearUserCaches = (userId = null) => 
  cacheService().clearUserCaches(userId);

export const clearInvitationCaches = (teamId = null) => 
  cacheService().clearInvitationCaches(teamId);

export const optimizeCache = () => 
  cacheService().optimizeCache();

export const preloadEnterpriseData = () => 
  cacheService().preloadEnterpriseData();

export const preloadTeamData = (teamId) => 
  cacheService().preloadTeamData(teamId);

export const analyzeCacheUsage = () => 
  cacheService().analyzeCacheUsage();

export const startCacheMonitoring = (intervalMs = 60000) => 
  cacheService().startCacheMonitoring(intervalMs);

export const stopCacheMonitoring = () => 
  cacheService().stopCacheMonitoring();

// ==================== SUBSCRIPTION UTILITIES ====================

export const getSubscriptionLevels = () => 
  subscriptionService().getSubscriptionLevels();

export const getSubscriptionConfig = (subscriptionLevel) => 
  subscriptionService().getSubscriptionConfig(subscriptionLevel);

export const hasEnterpriseAccessForLevel = (subscriptionLevel) => 
  subscriptionService().hasEnterpriseAccessForLevel(subscriptionLevel);

export const isSubscriptionHigherOrEqual = (currentLevel, requiredLevel) => 
  subscriptionService().isSubscriptionHigherOrEqual(currentLevel, requiredLevel);

export const getNextSubscriptionTier = (currentLevel) => 
  subscriptionService().getNextSubscriptionTier(currentLevel);

export const getUpgradeSuggestions = (currentLevel, requiredFeatures = []) => 
  subscriptionService().getUpgradeSuggestions(currentLevel, requiredFeatures);

export const initiateSubscriptionUpgrade = (targetTier, returnUrl = null) => 
  subscriptionService().initiateSubscriptionUpgrade(targetTier, returnUrl);

export const cancelSubscription = (reason = null) => 
  subscriptionService().cancelSubscription(reason);

// ==================== SERVICE FACTORY UTILITIES ====================

export const initializeServices = () => 
  ServiceFactory.initializeServices();

export const destroyServices = () => 
  ServiceFactory.destroyServices();

export const resetServices = () => 
  ServiceFactory.resetServices();

export const checkServiceHealth = () => 
  ServiceFactory.checkServiceHealth();

export const runDiagnostics = () => 
  ServiceFactory.runDiagnostics();

export const warmUpServices = () => 
  ServiceFactory.warmUpServices();

export const getServiceInfo = (serviceName = null) => 
  ServiceFactory.getServiceInfo(serviceName);

export const isServiceActive = (serviceName) => 
  ServiceFactory.isServiceActive(serviceName);

export const getActiveServices = () => 
  ServiceFactory.getActiveServices();

export const getAllServices = () => 
  ServiceFactory.getAllServices();

// ==================== CONSTANTS ====================

// lib/services/serviceEnterprise/client/enhanced-index.js

// ==================== CONSTANTS ====================

// ✅ THE FIX: Import and re-export everything from the main barrel file.
// This gives us access to core constants AND enterprise-specific constants.
export {
  TEAM_ROLES,
  PERMISSIONS,
  ORGANIZATION_ROLES,
  INVITATION_STATUS,
  DEFAULT_PERMISSIONS_BY_ROLE,
  TEAM_ROLE_HIERARCHY,
  EMPLOYEE_RESTRICTED_PERMISSIONS,
  isEmployeeRestrictedPermission
} from '../../constants'; // ✅ CHANGED to the central barrel file

// Import constants for use in default export, also from the central barrel file.
import {
  TEAM_ROLES as TEAM_ROLES_CONST,
  PERMISSIONS as PERMISSIONS_CONST,
  ORGANIZATION_ROLES as ORGANIZATION_ROLES_CONST,
  INVITATION_STATUS as INVITATION_STATUS_CONST
} from '../../constants'; // ✅ CHANGED to the central barrel file

// ==================== CONVENIENCE EXPORTS ====================

export const enterpriseServices = {
  subscription: subscriptionService,
  team: teamService,
  invitation: invitationService,
  analytics: analyticsService,
  audit: auditService,
  cache: cacheService
};

export const enterpriseUtils = {
  initializeServices,
  destroyServices,
  resetServices,
  checkServiceHealth,
  runDiagnostics,
  warmUpServices,
  preloadEnterpriseData,
  clearAllCaches,
  optimizeCache
};

export const teamUtils = {
  createTeam,
  getTeamDetails,
  getTeamStats,
  updateMemberRole,
  removeMember,
  bulkUpdateMemberRoles,
  getTeamPermissions,
  updateTeamPermissions,
  getTeamDataBatch,
  preloadTeamData
};

export const invitationUtils = {
  sendInvitation,
  inviteTeamMember,
  resendInvitation,
  revokeInvitation,
  acceptInvitation,
  verifyInvitation,
  bulkResendInvitations,
  bulkRevokeInvitations,
  getInvitationStats,
  cleanupExpiredInvitations
};

export const analyticsUtils = {
  getUserAnalytics,
  getTeamAnalytics,
  getCurrentUserAnalytics,
  getTeamMemberAnalytics,
  getAggregatedTeamAnalytics,
  getImpersonatedAnalytics,
  canImpersonateAnalytics,
  getImpersonationAuditLog,
  clearAnalyticsCaches
};

export const cacheUtils = {
  getCacheStats,
  clearAllCaches,
  clearTeamCaches,
  clearUserCaches,
  clearInvitationCaches,
  optimizeCache,
  analyzeCacheUsage,
  startCacheMonitoring,
  stopCacheMonitoring
};

// ==================== VERSION INFO ====================

export const ENTERPRISE_SERVICE_VERSION = '3.1.0'; // Updated version
export const PHASE = 'Phase 3 - Enhanced Services (Cleaned)';

// ==================== DEFAULT EXPORT ====================

export default {
  // Services
  ...enterpriseServices,
  
  // Utilities
  ...enterpriseUtils,
  
  // Specific domains
  team: teamUtils,
  invitation: invitationUtils,
  analytics: analyticsUtils,
  cache: cacheUtils,
  
  // Constants
  TEAM_ROLES: TEAM_ROLES_CONST,
  PERMISSIONS: PERMISSIONS_CONST,
  ORGANIZATION_ROLES: ORGANIZATION_ROLES_CONST,
  INVITATION_STATUS: INVITATION_STATUS_CONST,
  
  // Version
  version: ENTERPRISE_SERVICE_VERSION,
  phase: PHASE
};  