// lib/services/serviceEnterprise/client/transitionService.js
// 🚀 CLEANED TRANSITION SERVICE - React Hooks Only
// All API functions moved to Enhanced Services

"use client"
import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '@/important/firebase';

// Import Enhanced Services
import { ServiceFactory } from './factories/ServiceFactory';

// Import validation functions (keep these as they're used by hooks)
import {
  hasEnterpriseAccess,
  validateEnterpriseOperation
} from './enterpriseSubscriptionService';

// ==================== REACT HOOKS ONLY ====================

/**
 * 🚀 REACT HOOK: useEnterpriseData (Updated to use Enhanced Services)
 */
export function useEnterpriseData() {
  const [data, setData] = useState({
    teams: [],
    userRole: null,
    organizationId: null,
    organizationName: null,
    hasAccess: false,
    subscriptionLevel: null,
    features: [],
    limits: {},
    userContext: null,
    loading: true,
    error: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 Fetching enterprise data using Enhanced Services...');
      
      // Use Enhanced Services instead of direct API calls
      const subscriptionService = ServiceFactory.getSubscriptionService();
      const teamService = ServiceFactory.getTeamService();
      
      // Parallel fetch of core data using Enhanced Services
      const [subscriptionStatus, userContext, teamsData] = await Promise.all([
        subscriptionService.getEnterpriseSubscriptionStatus().catch(err => {
          console.warn('Subscription status fetch failed:', err.message);
          return null;
        }),
        subscriptionService.getUserContext().catch(err => {
          console.warn('User context fetch failed:', err.message);
          return null;
        }),
        teamService.getUserTeams().catch(err => {
          console.warn('Teams fetch failed:', err.message);
          return { teams: [] };
        })
      ]);
      
      // Determine user role using Enhanced Services
      let effectiveUserRole = 'employee';
      
      if (userContext) {
        const roleHierarchy = { owner: 4, manager: 3, team_lead: 2, employee: 1 };
        const teamRoles = Object.values(userContext.teams || {}).map(team => team.role).filter(Boolean);
        
        if (teamRoles.length > 0) {
          effectiveUserRole = teamRoles.reduce((highest, currentRole) => {
            const currentValue = roleHierarchy[currentRole] || 0;
            const highestValue = roleHierarchy[highest] || 0;
            return currentValue > highestValue ? currentRole : highest;
          }, 'employee');
        }
        
        if (userContext.organizationRole && userContext.organizationRole !== 'employee') {
          const orgRoleValue = roleHierarchy[userContext.organizationRole] || 0;
          const teamRoleValue = roleHierarchy[effectiveUserRole] || 0;
          if (orgRoleValue > teamRoleValue) {
            effectiveUserRole = userContext.organizationRole;
          }
        }
      }
      
      console.log('✅ Enterprise data fetched via Enhanced Services:', {
        hasAccess: subscriptionStatus?.hasEnterpriseAccess || false,
        teamsCount: teamsData.teams?.length || 0,
        subscriptionLevel: subscriptionStatus?.accountType || 'free',
        effectiveUserRole,
        hasUserContext: !!userContext
      });
      
      setData({
        teams: Array.isArray(teamsData.teams) ? teamsData.teams : [],
        userRole: effectiveUserRole,
        organizationId: subscriptionStatus?.organization?.id || teamsData.organizationId,
        organizationName: subscriptionStatus?.organization?.name || teamsData.organizationName,
        hasAccess: subscriptionStatus?.hasEnterpriseAccess || false,
        subscriptionLevel: subscriptionStatus?.accountType || 'free',
        features: subscriptionStatus?.enterpriseFeatures || [],
        limits: subscriptionStatus?.limits || {},
        userContext: userContext,
        canUpgrade: subscriptionStatus?.canUpgrade || false,
        nextTier: subscriptionStatus?.nextTier,
        upgradeMessage: subscriptionStatus?.upgradeMessage
      });
    } catch (err) {
      console.error('❌ Enterprise data fetch error:', err);
      setError(err.message);
      setData(prevData => ({
        ...prevData,
        teams: [],
        hasAccess: false,
        loading: false,
        error: err.message
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      fetchData();
    } else {
      setData({
        teams: [],
        userRole: null,
        organizationId: null,
        organizationName: null,
        hasAccess: false,
        subscriptionLevel: null,
        features: [],
        limits: {},
        userContext: null,
        loading: false,
        error: null
      });
      setLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchData();
      } else {
        // Clear Enhanced Services cache on logout
        const cacheService = ServiceFactory.getCacheService();
        cacheService.clearAllCaches();
        
        setData({
          teams: [],
          userRole: null,
          organizationId: null,
          organizationName: null,
          hasAccess: false,
          subscriptionLevel: null,
          features: [],
          limits: {},
          userContext: null,
          loading: false,
          error: null
        });
        setLoading(false);
        setError(null);
      }
    });

    return unsubscribe;
  }, [fetchData]);

  return {
    ...data,
    loading,
    error,
    refetch: fetchData,
    hasFeature: (feature) => data.features.includes(feature),
    canPerformAction: (action, context = {}) => {
      const validation = validateEnterpriseOperation(
        action,
        data.userRole,
        data.subscriptionLevel,
        context
      );
      return validation.allowed;
    }
  };
}

/**
 * 🚀 REACT HOOK: useOptimizedTeamData (Updated to use Enhanced Services)
 */
export function useOptimizedTeamData(teamId) {
  const [teamData, setTeamData] = useState({
    userContext: null,
    members: [],
    invitations: [],
    permissions: null,
    teamInfo: {},
    loading: true,
    error: null,
    lastUpdated: null
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetchTeamData = useCallback(async () => {
    if (!teamId || !auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 Fetching team data via Enhanced Services for:', teamId);
      
      // Use Enhanced Services for team data
      const teamService = ServiceFactory.getTeamService();
      
      // Use the batch function from Enhanced Team Service
      const batchResult = await teamService.getTeamDataBatch(teamId);
      
      if (!mountedRef.current) return;
      
      console.log('✅ Team data loaded via Enhanced Services:', {
        teamId,
        memberCount: Array.isArray(batchResult.members) ? batchResult.members.length : 0,
        invitationCount: batchResult.invitations?.length || 0,
        hasPermissions: !!batchResult.permissions
      });
      
      setTeamData({
        userContext: batchResult.userContext,
        members: Array.isArray(batchResult.members) ? batchResult.members : [],
        invitations: batchResult.invitations || [],
        permissions: batchResult.permissions,
        teamInfo: batchResult.teamInfo || {},
        loading: false,
        error: null,
        lastUpdated: new Date().toISOString()
      });
      
    } catch (err) {
      console.error('❌ Team data fetch error:', err);
      
      if (!mountedRef.current) return;
      
      setError(err.message);
      setTeamData(prevData => ({
        ...prevData,
        loading: false,
        error: err.message,
        lastUpdated: new Date().toISOString()
      }));
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [teamId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchTeamData();
    
    return () => {
      mountedRef.current = false;
    };
  }, [fetchTeamData]);

  return {
    ...teamData,
    loading,
    error,
    refetch: fetchTeamData,
    
    // Helper functions
    getMember: (memberId) => teamData.members.find(m => m.id === memberId),
    getInvitation: (inviteId) => teamData.invitations.find(i => i.id === inviteId),
    
    // Statistics
    stats: {
      totalMembers: teamData.members.length,
      totalInvitations: teamData.invitations.length,
      expiredInvitations: teamData.invitations.filter(i => {
        const expiresAt = new Date(i.expiresAt?.toDate ? i.expiresAt.toDate() : i.expiresAt);
        return new Date() > expiresAt;
      }).length
    }
  };
}

// ==================== CONVENIENCE FUNCTIONS FOR HOOKS ====================

/**
 * Clear all Enhanced Service caches (for logout/cleanup)
 */
export function clearAllEnhancedServiceCaches() {
  try {
    const cacheService = ServiceFactory.getCacheService();
    cacheService.clearAllCaches();
    console.log('✅ Enhanced Service caches cleared');
  } catch (error) {
    console.warn('⚠️ Failed to clear Enhanced Service caches:', error);
  }
}

/**
 * Preload Enhanced Service data
 */
export async function preloadEnhancedServiceData() {
  try {
    const subscriptionService = ServiceFactory.getSubscriptionService();
    await subscriptionService.preloadEnterpriseData();
    console.log('✅ Enhanced Service data preloaded');
  } catch (error) {
    console.warn('⚠️ Failed to preload Enhanced Service data:', error);
  }
}

// ==================== LEGACY COMPATIBILITY ====================

// Keep these exports for backward compatibility during transition
export { 
  hasEnterpriseAccess,
  validateEnterpriseOperation
} from './enterpriseSubscriptionService';