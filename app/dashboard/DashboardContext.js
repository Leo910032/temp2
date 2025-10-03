  
  /**
 * THIS FILE HAS BEEN REFRACTORED 
 */
  "use client";

  import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
  import { useAuth } from '@/contexts/AuthContext';
  import { getSubscriptionStatus } from '@/lib/services/client/subscriptionService';

  const DashboardContext = createContext();

  export function useDashboard() {
    const context = useContext(DashboardContext);
    if (!context) {
      throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
  }

  export function DashboardProvider({ children }) {
    const { currentUser } = useAuth();
    
    const [subscriptionData, setSubscriptionData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
  const didFetch = useRef(false);

    const fetchDashboardData = useCallback(async (forceRefresh = false) => {
      // Guard: Don't run if there's no user
      if (!currentUser) {
        setSubscriptionData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        console.log('🚀 DashboardProvider: Fetching unified subscription data...');

        // Pass the forceRefresh flag to the service
        const data = await getSubscriptionStatus(forceRefresh);

        setSubscriptionData(data);
        console.log('✅ DashboardProvider: Data loaded successfully');

        // 🔍 DEBUG: Log permissions for carousel feature
        console.log('🔍 [DashboardContext] Permissions Debug:', {
          subscriptionLevel: data?.subscriptionLevel,
          allPermissions: data?.permissions,
          hasCarouselPermission: data?.permissions?.['custom_carousel'],
          permissionKeys: Object.keys(data?.permissions || {})
        });

      } catch (error) {
        console.error('❌ DashboardProvider: Error loading data:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    }, [currentUser]);

   // In DashboardProvider...

  useEffect(() => {
    // This effect now ONLY triggers the initial fetch.
    if (didFetch.current) {
      return;
    }
    
    if (currentUser) {
      // Set the ref to true BEFORE fetching
      didFetch.current = true; 
      fetchDashboardData();
    } else {
      // Reset everything on logout
      setSubscriptionData(null);
      setIsLoading(false);
      setError(null);
      didFetch.current = false; // Allow fetching again for the next user
    }
    
  }, [currentUser, fetchDashboardData]); // ✅ ADD fetchDashboardData BACK HERE

// ...
    // Convenience getters for common subscription checks
    const hasContactFeature = useCallback((feature) => {
      return subscriptionData?.permissions?.[feature] || false;
    }, [subscriptionData]);

    const hasEnterprisePermission = useCallback((permission) => {
      return subscriptionData?.permissions?.[permission] || false;
    }, [subscriptionData]);

    const canUpgrade = subscriptionData?.canUpgrade || false;
    const subscriptionLevel = subscriptionData?.subscriptionLevel || 'base';
    const isEnterpriseUser = subscriptionData?.enterpriseCapabilities?.hasAccess || false;
    const isOrganizationOwner = subscriptionData?.enterpriseCapabilities?.isOrganizationOwner || false;

    const contextValue = {
      subscriptionData,
      isLoading,
      error,
      currentUser,
      subscriptionLevel,
      canUpgrade,
      nextTier: subscriptionData?.nextTier || null,
      contactCapabilities: subscriptionData?.contactCapabilities || {},
      enterpriseCapabilities: subscriptionData?.enterpriseCapabilities || {},
      userContext: subscriptionData?.userContext || {},
      limits: subscriptionData?.limits || {},
      isEnterpriseUser,
      isOrganizationOwner,
      hasContactFeature,
      hasEnterprisePermission,
      refreshData: () => fetchDashboardData(true),
      permissions: subscriptionData?.permissions || {}
    };

    return (
      <DashboardContext.Provider value={contextValue}>
        {children}
      </DashboardContext.Provider>
    );
  }