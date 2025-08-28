// lib/services/serviceEnterprise/client/enhanced-index.js
// Phase 3: Enhanced exports with proper abstractions

"use client"

// Factory for service instantiation
export { ServiceFactory } from './factories/ServiceFactory';

// Enhanced services with full abstractions
export { EnhancedSubscriptionService } from './services/EnhancedSubscriptionService';
export { EnhancedTeamService } from './services/EnhancedTeamService';
export { EnhancedInvitationService } from './services/EnhancedInvitationService';

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

// Convenience exports using factory pattern
export const subscriptionService = () => ServiceFactory.getSubscriptionService();
export const teamService = () => ServiceFactory.getTeamService();
export const invitationService = () => ServiceFactory.getInvitationService();

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