"use client"

// hooks/useOptimizedEnterpriseData.js
// 🚀 HIGHLY OPTIMIZED React Hook for Enterprise Data

import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '@/important/firebase';

import {  getEnterpriseDataBatch, 
  getTeamDataBatch,
  getCacheStats,
  preloadEnterpriseData,
  clearAllCaches } from '@/lib/services/serviceEnterprise';

/**
 * 🚀 ULTIMATE OPTIMIZED: Enterprise Data Hook
 * - Single API call instead of 3-4 separate calls
 * - Request deduplication
 * - Smart caching with longer TTL
 * - Background data refresh
 * - Performance monitoring
 */
export function useOptimizedEnterpriseData() {
  const [data, setData] = useState({
    // Core data
    subscriptionStatus: null,
    userContext: null,
    teams: [],
    
    // Computed data
    hasAccess: false,
    subscriptionLevel: null,
    userRole: null,
    organizationId: null,
    organizationName: null,
    
    // State
    loading: true,
    error: null,
    lastUpdated: null,
    
    // Performance
    cacheStats: null,
    loadTime: null
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadStartTime = useRef(null);
  const mountedRef = useRef(true);

  // 🚀 OPTIMIZED: Single batch data fetch
  const fetchEnterpriseData = useCallback(async () => {
    if (!auth.currentUser) {
      setData(prevData => ({
        ...prevData,
        loading: false,
        hasAccess: false,
        error: null
      }));
      setLoading(false);
      return;
    }

    try {
      loadStartTime.current = Date.now();
      setLoading(true);
      setError(null);
      
      console.log('🚀 OPTIMIZED: Fetching enterprise data batch...');
      
      // Single batch call instead of multiple API calls
      const batchResult = await getEnterpriseDataBatch();
      
      if (!mountedRef.current) return; // Prevent state updates if unmounted
      
      const loadTime = Date.now() - loadStartTime.current;
      
      // Process batch results
      const subscriptionStatus = batchResult.subscriptionStatus;
      const userContext = batchResult.userContext;
      const userTeams = batchResult.userTeams;
      
      // Compute derived data
      const hasAccess = subscriptionStatus?.hasEnterpriseAccess || false;
      const subscriptionLevel = subscriptionStatus?.accountType || 'free';
      
      // Determine user role from context
      let effectiveUserRole = 'employee';
      if (userContext) {
        const roleHierarchy = { owner: 4, manager: 3, team_lead: 2, employee: 1 };
        const teamRoles = Object.values(userContext.teams || {})
          .map(team => team.role)
          .filter(Boolean);
        
        if (teamRoles.length > 0) {
          effectiveUserRole = teamRoles.reduce((highest, currentRole) => {
            const currentValue = roleHierarchy[currentRole] || 0;
            const highestValue = roleHierarchy[highest] || 0;
            return currentValue > highestValue ? currentRole : highest;
          }, 'employee');
        }
        
        // Organization role override
        if (userContext.organizationRole && userContext.organizationRole !== 'employee') {
          const orgRoleValue = roleHierarchy[userContext.organizationRole] || 0;
          const teamRoleValue = roleHierarchy[effectiveUserRole] || 0;
          if (orgRoleValue > teamRoleValue) {
            effectiveUserRole = userContext.organizationRole;
          }
        }
      }
      
      console.log('✅ OPTIMIZED: Enterprise data loaded:', {
        loadTime: `${loadTime}ms`,
        hasAccess,
        teamsCount: userTeams.teams?.length || 0,
        subscriptionLevel,
        effectiveUserRole,
        errorCount: batchResult.errors?.length || 0,
        cacheStats: getCacheStats()
      });
      
      setData({
        // Core data
        subscriptionStatus,
        userContext,
        teams: Array.isArray(userTeams.teams) ? userTeams.teams : [],
        
        // Computed data
        hasAccess,
        subscriptionLevel,
        userRole: effectiveUserRole,
        organizationId: subscriptionStatus?.organization?.id || userTeams.organizationId,
        organizationName: subscriptionStatus?.organization?.name || userTeams.organizationName,
        
        // Features and limits
        features: subscriptionStatus?.enterpriseFeatures || [],
        limits: subscriptionStatus?.limits || {},
        canUpgrade: subscriptionStatus?.canUpgrade || false,
        nextTier: subscriptionStatus?.nextTier,
        upgradeMessage: subscriptionStatus?.upgradeMessage,
        
        // State
        loading: false,
        error: null,
        lastUpdated: new Date().toISOString(),
        
        // Performance
        cacheStats: getCacheStats(),
        loadTime,
        
        // Errors (for debugging)
        batchErrors: batchResult.errors || []
      });
      
    } catch (err) {
      console.error('❌ OPTIMIZED: Enterprise data fetch error:', err);
      
      if (!mountedRef.current) return;
      
      setError(err.message);
      setData(prevData => ({
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
  }, []);

  // 🚀 Background refresh without loading state
  const refreshInBackground = useCallback(async () => {
    try {
      console.log('🔄 Background refresh initiated...');
      
      const batchResult = await getEnterpriseDataBatch();
      
      if (!mountedRef.current) return;
      
      // Update data without showing loading state
      const subscriptionStatus = batchResult.subscriptionStatus;
      const userContext = batchResult.userContext;
      const userTeams = batchResult.userTeams;
      
      setData(prevData => ({
        ...prevData,
        subscriptionStatus,
        userContext,
        teams: Array.isArray(userTeams.teams) ? userTeams.teams : [],
        lastUpdated: new Date().toISOString(),
        cacheStats: getCacheStats(),
        batchErrors: batchResult.errors || []
      }));
      
      console.log('✅ Background refresh completed');
    } catch (error) {
      console.warn('⚠️ Background refresh failed:', error);
      // Don't update error state for background refreshes
    }
  }, []);

  // Initial data load
  useEffect(() => {
    mountedRef.current = true;
    
    if (auth.currentUser) {
      fetchEnterpriseData();
    } else {
      setData(prevData => ({
        ...prevData,
        loading: false,
        hasAccess: false,
        error: null
      }));
      setLoading(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchEnterpriseData]);

  // Auth state change handler
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // User logged in - preload data and fetch
        preloadEnterpriseData();
        fetchEnterpriseData();
      } else {
        // User logged out - clear everything
        clearAllCaches();
        setData({
          subscriptionStatus: null,
          userContext: null,
          teams: [],
          hasAccess: false,
          subscriptionLevel: null,
          userRole: null,
          organizationId: null,
          organizationName: null,
          features: [],
          limits: {},
          loading: false,
          error: null,
          lastUpdated: null,
          cacheStats: null,
          loadTime: null
        });
        setLoading(false);
        setError(null);
      }
    });

    return unsubscribe;
  }, [fetchEnterpriseData]);

  // 🚀 Performance monitoring - log slow loads
  useEffect(() => {
    if (data.loadTime && data.loadTime > 2000) {
      console.warn('⚠️ Slow enterprise data load:', {
        loadTime: data.loadTime,
        cacheStats: data.cacheStats,
        errorCount: data.batchErrors?.length || 0
      });
    }
  }, [data.loadTime, data.cacheStats, data.batchErrors]);

  return {
    // Core data
    ...data,
    loading,
    error,
    
    // Helper methods
    refetch: fetchEnterpriseData,
    refreshInBackground,
    
    // Feature checks
    hasFeature: (feature) => data.features.includes(feature),
    
    // Permission checks
    canPerformAction: (action, context = {}) => {
      // Import validation function here to avoid circular dependencies
      try {
        const { validateEnterpriseOperation } = require('@/lib/services/serviceEnterprise/client/enterpriseSubscriptionService');
        const validation = validateEnterpriseOperation(
          action,
          data.userRole,
          data.subscriptionLevel,
          context
        );
        return validation.allowed;
      } catch {
        return false;
      }
    },
    
    // Performance utilities
    getCacheStats: () => data.cacheStats,
    clearCache: clearAllCaches,
    
    // Development helpers
    debugInfo: {
      loadTime: data.loadTime,
      cacheStats: data.cacheStats,
      batchErrors: data.batchErrors,
      lastUpdated: data.lastUpdated
    }
  };
}

/**
 * 🚀 OPTIMIZED: Team-specific data hook
 * Uses batch operations to fetch all team data at once
 */
export function useOptimizedTeamData(teamId) {
  const [teamData, setTeamData] = useState({
    userContext: null,
    members: [],
    invitations: [],
    teamInfo: {},
    loading: true,
    error: null,
    lastUpdated: null,
    loadTime: null
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadStartTime = useRef(null);
  const mountedRef = useRef(true);

  const fetchTeamData = useCallback(async () => {
    if (!teamId || !auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      loadStartTime.current = Date.now();
      setLoading(true);
      setError(null);
      
      console.log('🚀 OPTIMIZED: Fetching team data batch for:', teamId);
      
      // Single batch call for all team data
      const batchResult = await getTeamDataBatch(teamId);
      
      if (!mountedRef.current) return;
      
      const loadTime = Date.now() - loadStartTime.current;
      
      console.log('✅ OPTIMIZED: Team data loaded:', {
        teamId,
        loadTime: `${loadTime}ms`,
        memberCount: batchResult.members?.members?.length || 0,
        invitationCount: batchResult.invitations?.length || 0,
        errorCount: batchResult.errors?.length || 0
      });
      
      setTeamData({
        userContext: batchResult.userContext,
        members: batchResult.members?.members || [],
        invitations: batchResult.invitations || [],
        teamInfo: batchResult.members?.teamInfo || {},
        loading: false,
        error: null,
        lastUpdated: new Date().toISOString(),
        loadTime,
        batchErrors: batchResult.errors || []
      });
      
    } catch (err) {
      console.error('❌ OPTIMIZED: Team data fetch error:', err);
      
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
    
    // Team-specific helpers
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

/**
 * 🚀 Cache monitoring hook for development
 */
export function useCacheMonitor() {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getCacheStats());
    }, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  return stats;
}
