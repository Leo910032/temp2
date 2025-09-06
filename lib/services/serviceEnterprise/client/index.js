
// lib/services/serviceEnterprise/client/index.js
// 🎯 PHASE 2: Updated exports with consolidated services

"use client"

// Core services
export { SubscriptionService } from './services/subscriptionService';
export { TeamService } from './services/teamService';
export { InvitationService } from './services/invitationService';

// Core infrastructure
export { EnterpriseApiClient, EnterpriseApiError } from './core/apiClient';
export { CacheManager, globalCache } from './core/cacheManager';
export { ErrorHandler } from './core/errorHandler';

// Legacy compatibility (gradually phase these out)
export {
  // Main hooks
  useEnterpriseData,
  useOptimizedTeamData,
  
  // Analytics functions  
  getImpersonatedAnalytics,
  canImpersonateAnalytics
} from './transitionService';

// Constants
export {
  TEAM_ROLES,
  PERMISSIONS,
  ORGANIZATION_ROLES,
  INVITATION_STATUS
} from '../constants/enterpriseConstants';