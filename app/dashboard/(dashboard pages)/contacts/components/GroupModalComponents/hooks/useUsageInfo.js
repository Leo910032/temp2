// app/dashboard/(dashboard pages)/contacts/hooks/useUsageInfo.js
"use client"
import { useState, useEffect, useCallback } from 'react';
import { ContactServiceFactory } from '@/lib/services/serviceContact/client/factories/ContactServiceFactory';

export function useUsageInfo(subscriptionLevel) {
  const [usageInfo, setUsageInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshUsageInfo = useCallback(async (force = false) => {
    if (!subscriptionLevel) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const aicostService = ContactServiceFactory.getAICostService();
      
      // Clear cache if force refresh is requested
      if (force) {
        aicostService.clearUsageCache();
      }
      
      const usage = await aicostService.getUsageInfo();
      setUsageInfo(usage);
      
      console.log('[useUsageInfo] Updated usage info:', usage);
    } catch (err) {
      console.error('[useUsageInfo] Failed to refresh usage info:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [subscriptionLevel]);

  // Initial load
  useEffect(() => {
    if (subscriptionLevel) {
      refreshUsageInfo();
    }
  }, [subscriptionLevel, refreshUsageInfo]);

  // Set up periodic refresh every 30 seconds when usage data exists
  useEffect(() => {
    if (!usageInfo || subscriptionLevel === 'enterprise') return;

    const interval = setInterval(() => {
      console.log('[useUsageInfo] Periodic refresh triggered');
      refreshUsageInfo();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [usageInfo, subscriptionLevel, refreshUsageInfo]);

  // Force refresh function for external triggers
  const forceRefresh = useCallback(() => {
    console.log('[useUsageInfo] Force refresh requested');
    refreshUsageInfo(true);
  }, [refreshUsageInfo]);

  return {
    usageInfo,
    loading,
    error,
    refreshUsageInfo,
    forceRefresh
  };
}