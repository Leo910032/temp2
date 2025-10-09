  
  /**
 * THIS FILE HAS BEEN REFRACTORED 
 */
  "use client";

  import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
  import { useAuth } from '@/contexts/AuthContext';
  import { getSubscriptionStatus } from '@/lib/services/client/subscriptionService';
  import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
  import { app } from '@/important/firebase';

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

        // 🔍 DEBUG: Log permissions for carousel and media embed features
        console.log('🔍 [DashboardContext] Permissions Debug:', {
          subscriptionLevel: data?.subscriptionLevel,
          hasCarouselPermission: data?.permissions?.['custom_carousel'],
          hasMediaEmbedPermission: data?.permissions?.['custom_media_embed'],
          allPermissions: data?.permissions,
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

  // 🆕 Real-time listener for subscription changes
  useEffect(() => {
    if (!currentUser?.uid) {
      return;
    }

    console.log('🔔 [DashboardContext] Setting up real-time subscription listener for:', currentUser.uid);

    const db = getFirestore(app);
    const userRef = doc(db, 'users', currentUser.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          const newSubscriptionLevel = userData.accountType || 'base'; // ✅ FIX: Read from 'accountType' field
          const currentLevel = subscriptionData?.subscriptionLevel;

          console.log('🔍 [DashboardContext] Listener fired - checking subscription:', {
            firestoreAccountType: userData.accountType,
            newSubscriptionLevel,
            currentLevel,
            hasCurrentLevel: !!currentLevel
          });

          // Only refresh if subscription level actually changed
          if (currentLevel && newSubscriptionLevel !== currentLevel) {
            console.log('🔄 [DashboardContext] Subscription changed:', {
              from: currentLevel,
              to: newSubscriptionLevel
            });
            console.log('🔄 [DashboardContext] Fetching new permissions for subscription:', newSubscriptionLevel);

            // Force refresh subscription data to get new permissions
            fetchDashboardData(true);
          } else {
            console.log('🔔 [DashboardContext] Subscription listener fired but no change detected:', {
              currentLevel,
              newSubscriptionLevel,
              hasCurrentLevel: !!currentLevel
            });
          }
        }
      },
      (error) => {
        console.error('❌ [DashboardContext] Subscription listener error:', error);
      }
    );

    return () => {
      console.log('🧹 [DashboardContext] Cleaning up subscription listener');
      unsubscribe();
    };
  }, [currentUser?.uid, subscriptionData?.subscriptionLevel, fetchDashboardData]);

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