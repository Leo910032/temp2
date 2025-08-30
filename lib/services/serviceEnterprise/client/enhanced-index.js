"use client"

// 🚨 THE FIX: Import ServiceFactory directly so it's available in this module's scope.
import { ServiceFactory } from './factories/ServiceFactory';

// Now you can re-export it for other modules to use if they need direct access.
export { ServiceFactory };

// Enhanced services with full abstractions
export { EnhancedSubscriptionService } from './services/EnhancedSubscriptionService';
export { EnhancedTeamService } from './services/EnhancedTeamService';
export { EnhancedInvitationService } from './services/EnhancedInvitationService';
export { EnhancedAuditService } from './services/EnhancedAuditService'; // ✅ ADD THIS EXPORT

// Base abstractions for extending
export { BaseService } from './abstractions/BaseService';

// Interfaces for type checking
export { 
  ISubscriptionService, 
  ITeamService, 
  IInvitationService 
} from './interfaces/ISubscriptionService';

// Core infrastructure (from Phase 2)
export { EnterpriseApiClient, EnterpriseApiError } from './core/apiClient';
export { CacheManager, globalCache } from './core/cacheManager';
export { ErrorHandler } from './core/errorHandler';
export { EnhancedAnalyticsService } from './services/EnhancedAnalyticsService'; // ✅ ADD THIS

// ✅ NOW THIS WORKS:
// These functions can now safely call ServiceFactory because it was imported above.
export const subscriptionService = () => ServiceFactory.getSubscriptionService();
export const teamService = () => ServiceFactory.getTeamService();
export const invitationService = () => ServiceFactory.getInvitationService();
export const auditService = () => ServiceFactory.getAuditService();
export const analyticsService = () => ServiceFactory.getAnalyticsService();
export const cacheService = () => ServiceFactory.getCacheService();

// Legacy compatibility hooks (to be phased out in Phase 4)
export {
  useEnterpriseData,
  useOptimizedTeamData
} from './transitionService';

// Constants
export {
  TEAM_ROLES,
  PERMISSIONS,
  ORGANIZATION_ROLES,
  INVITATION_STATUS
} from '../constants/enterpriseConstants';