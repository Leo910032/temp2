/**
 * Enhanced AnalyticsContext with Smart Caching + Real-time Updates
 * 
 * This hybrid approach provides:
 * 1. Instant loading from cache when returning to the page
 * 2. Real-time updates when data changes
 * 3. Automatic cache invalidation after a reasonable time
 * 4. Memory cleanup to prevent leaks
 */

"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useDashboard } from '@/app/dashboard/DashboardContext';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { app } from '@/important/firebase';

// Global cache object - persists across component mounts
const analyticsCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 50; // Prevent memory leaks

// Cache cleanup utility
function cleanupOldCacheEntries() {
    const now = Date.now();
    const entries = Array.from(analyticsCache.entries());
    
    // Remove expired entries
    const expiredKeys = entries
        .filter(([_, data]) => now - data.timestamp > CACHE_DURATION)
        .map(([key]) => key);
    
    expiredKeys.forEach(key => analyticsCache.delete(key));
    
    // If still too many entries, remove oldest ones
    if (analyticsCache.size > MAX_CACHE_ENTRIES) {
        const sortedEntries = entries
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
            .slice(0, analyticsCache.size - MAX_CACHE_ENTRIES);
        
        sortedEntries.forEach(([key]) => analyticsCache.delete(key));
    }
    
    console.log(`🧹 Cache cleanup: ${expiredKeys.length} expired entries removed, ${analyticsCache.size} entries remaining`);
}

// Enhanced data processing with caching metadata
function processAnalyticsData(rawData, fromCache = false) {
    const safeData = rawData || {};
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = (now - yearStart + 86400000) / 86400000;
    const weekNumber = Math.ceil(dayOfYear / 7);
    const weekKey = `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Process dailyViews from dot notation
    const dailyViews = {};
    const dailyClicks = {};
    
    if (safeData.dailyViews && typeof safeData.dailyViews === 'object') {
        Object.assign(dailyViews, safeData.dailyViews);
    }
    
    if (safeData.dailyClicks && typeof safeData.dailyClicks === 'object') {
        Object.assign(dailyClicks, safeData.dailyClicks);
    }
    
    Object.keys(safeData).forEach(key => {
        if (key.startsWith('dailyViews.')) {
            const dateKey = key.replace('dailyViews.', '');
            dailyViews[dateKey] = safeData[key];
        } else if (key.startsWith('dailyClicks.')) {
            const dateKey = key.replace('dailyClicks.', '');
            dailyClicks[dateKey] = safeData[key];
        }
    });

    // Process linkClicks from dot notation
    const topLinks = [];
    const linkClicksMap = {};
    
    Object.keys(safeData).forEach(key => {
        if (key.startsWith('linkClicks.')) {
            const parts = key.split('.');
            const linkId = parts[1];
            const property = parts.slice(2).join('.');
            
            if (!linkClicksMap[linkId]) {
                linkClicksMap[linkId] = {};
            }
            
            if (property.includes('.')) {
                const propertyParts = property.split('.');
                let current = linkClicksMap[linkId];
                
                for (let i = 0; i < propertyParts.length - 1; i++) {
                    if (!current[propertyParts[i]]) {
                        current[propertyParts[i]] = {};
                    }
                    current = current[propertyParts[i]];
                }
                current[propertyParts[propertyParts.length - 1]] = safeData[key];
            } else {
                linkClicksMap[linkId][property] = safeData[key];
            }
        }
    });
    
    if (safeData.linkClicks && typeof safeData.linkClicks === 'object') {
        Object.assign(linkClicksMap, safeData.linkClicks);
    }
    
    Object.entries(linkClicksMap).forEach(([linkId, linkData]) => {
        if (linkData && typeof linkData === 'object') {
            topLinks.push({
                linkId,
                title: linkData.title || 'Untitled Link',
                url: linkData.url || '',
                totalClicks: linkData.totalClicks || 0,
            });
        }
    });
    
    topLinks.sort((a, b) => b.totalClicks - a.totalClicks);

    // Process trafficSources from dot notation
    const trafficSources = {};
    
    Object.keys(safeData).forEach(key => {
        if (key.startsWith('trafficSources.')) {
            const parts = key.split('.');
            const sourceKey = parts[1];
            const property = parts[2];
            
            if (!trafficSources[sourceKey]) {
                trafficSources[sourceKey] = {};
            }
            
            trafficSources[sourceKey][property] = safeData[key];
        }
    });
    
    if (safeData.trafficSources && typeof safeData.trafficSources === 'object') {
        Object.assign(trafficSources, safeData.trafficSources);
    }

    const trafficSourceStats = {
        totalSources: Object.keys(trafficSources).length,
        socialTraffic: 0,
        searchTraffic: 0,
        directTraffic: 0,
        referralTraffic: 0,
    };
    
    if (trafficSourceStats.totalSources > 0) {
        Object.entries(trafficSources).forEach(([_, sourceData]) => {
            const clicks = sourceData?.views || sourceData?.clicks || 0;
            const medium = sourceData?.medium || 'unknown';
            if (medium === 'social') trafficSourceStats.socialTraffic += clicks;
            else if (['search', 'organic'].includes(medium)) trafficSourceStats.searchTraffic += clicks;
            else if (medium === 'direct') trafficSourceStats.directTraffic += clicks;
            else if (medium === 'referral') trafficSourceStats.referralTraffic += clicks;
        });
    }

    // Process monthly and weekly data from dot notation
    const monthlyViews = {};
    const monthlyClicks = {};
    const weeklyViews = {};
    const weeklyClicks = {};
    
    Object.keys(safeData).forEach(key => {
        if (key.startsWith('monthlyViews.')) {
            const monthKey = key.replace('monthlyViews.', '');
            monthlyViews[monthKey] = safeData[key];
        } else if (key.startsWith('monthlyClicks.')) {
            const monthKey = key.replace('monthlyClicks.', '');
            monthlyClicks[monthKey] = safeData[key];
        } else if (key.startsWith('weeklyViews.')) {
            const weekKey = key.replace('weeklyViews.', '');
            weeklyViews[weekKey] = safeData[key];
        } else if (key.startsWith('weeklyClicks.')) {
            const weekKey = key.replace('weeklyClicks.', '');
            weeklyClicks[weekKey] = safeData[key];
        }
    });

    const result = {
        totalViews: safeData.totalViews || 0,
        totalClicks: safeData.totalClicks || 0,
        thisMonthViews: monthlyViews[monthKey] || 0,
        thisMonthClicks: monthlyClicks[monthKey] || 0,
        thisWeekViews: weeklyViews[weekKey] || 0,
        thisWeekClicks: weeklyClicks[weekKey] || 0,
        dailyViews,
        dailyClicks,
        topLinks,
        trafficSources,
        trafficSourceStats,
        // Add metadata for cache management
        _meta: {
            processedAt: now.getTime(),
            fromCache,
            cacheKey: null // Will be set by caller
        }
    };

    if (!fromCache) {
        console.log("📊 Fresh analytics data processed:", result);
    } else {
        console.log("💾 Cached analytics data restored:", result);
    }
    
    return result;
}

const AnalyticsContext = createContext(null);

export function useAnalytics() {
    const context = useContext(AnalyticsContext);
    if (!context) {
        throw new Error('useAnalytics must be used within an AnalyticsProvider');
    }
    return context;
}

const db = getFirestore(app);

export function AnalyticsProvider({ children, impersonatedUserId }) {
    const { currentUser } = useDashboard();
    const [analyticsData, setAnalyticsData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFromCache, setIsFromCache] = useState(false);
    const unsubscribeRef = useRef(null);
    const cacheKeyRef = useRef(null);

    useEffect(() => {
        const targetUserId = impersonatedUserId || currentUser?.uid;

        if (!targetUserId) {
            setIsLoading(false);
            return;
        }

        // Create cache key
        const cacheKey = `analytics_${targetUserId}`;
        cacheKeyRef.current = cacheKey;

        console.log(`[AnalyticsProvider] 🚀 Initializing for user: ${targetUserId}`);

        // Step 1: Check cache first for instant loading
        const cachedEntry = analyticsCache.get(cacheKey);
        const now = Date.now();
        
        if (cachedEntry && (now - cachedEntry.timestamp < CACHE_DURATION)) {
            console.log(`[AnalyticsProvider] ⚡ Loading from cache (${Math.round((now - cachedEntry.timestamp) / 1000)}s old)`);
            const processedCachedData = processAnalyticsData(cachedEntry.rawData, true);
            processedCachedData._meta.cacheKey = cacheKey;
            setAnalyticsData(processedCachedData);
            setIsFromCache(true);
            setIsLoading(false);
        } else {
            // Cache miss or expired
            if (cachedEntry) {
                console.log(`[AnalyticsProvider] 🕒 Cache expired (${Math.round((now - cachedEntry.timestamp) / 1000)}s old), fetching fresh data`);
                analyticsCache.delete(cacheKey);
            } else {
                console.log(`[AnalyticsProvider] 🆕 No cache found, fetching fresh data`);
            }
            setIsLoading(true);
            setIsFromCache(false);
        }

        // Step 2: Set up real-time listener (always, even if we have cache)
        console.log(`[AnalyticsProvider] 👂 Setting up real-time listener for user: ${targetUserId}`);
        
        const analyticsDocRef = doc(db, "Analytics", targetUserId);

        const unsubscribe = onSnapshot(analyticsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const rawData = docSnap.data();
                
                // Check if this is actually new data (not just the initial fetch when we already have cache)
                const existingCache = analyticsCache.get(cacheKey);
                const isDataChanged = !existingCache || JSON.stringify(existingCache.rawData) !== JSON.stringify(rawData);
                
                if (isDataChanged) {
                    console.log("[AnalyticsProvider] 🔥 Real-time data update received");
                    
                    // Update cache
                    analyticsCache.set(cacheKey, {
                        rawData,
                        timestamp: Date.now()
                    });
                    
                    // Process and update state
                    const processedData = processAnalyticsData(rawData, false);
                    processedData._meta.cacheKey = cacheKey;
                    setAnalyticsData(processedData);
                    setIsFromCache(false);
                } else {
                    console.log("[AnalyticsProvider] 📝 Real-time listener fired but data unchanged");
                }
            } else {
                console.log("[AnalyticsProvider] 🟡 No analytics document found");
                const emptyData = processAnalyticsData(null);
                emptyData._meta.cacheKey = cacheKey;
                setAnalyticsData(emptyData);
                setIsFromCache(false);
                
                // Cache the empty state too
                analyticsCache.set(cacheKey, {
                    rawData: null,
                    timestamp: Date.now()
                });
            }
            setIsLoading(false);
        }, (error) => {
            console.error("[AnalyticsProvider] ❌ Listener error:", error);
            setIsLoading(false);
        });

        unsubscribeRef.current = unsubscribe;

        // Cleanup function
        return () => {
            console.log(`[AnalyticsProvider] 🔌 Detaching listener for user: ${targetUserId}`);
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };

    }, [currentUser?.uid, impersonatedUserId]);

    // Periodic cache cleanup
    useEffect(() => {
        const cleanupInterval = setInterval(cleanupOldCacheEntries, 60000); // Every minute
        return () => clearInterval(cleanupInterval);
    }, []);

    // Enhanced context value with cache information
    const value = { 
        analyticsData, 
        isLoading,
        isFromCache,
        cacheInfo: {
            isCached: isFromCache,
            totalCacheEntries: analyticsCache.size,
            currentCacheKey: cacheKeyRef.current
        }
    };

    return (
        <AnalyticsContext.Provider value={value}>
            {children}
        </AnalyticsContext.Provider>
    );
}

// Utility function to manually clear cache (useful for debugging or user-triggered refresh)
export function clearAnalyticsCache(userId = null) {
    if (userId) {
        const cacheKey = `analytics_${userId}`;
        const deleted = analyticsCache.delete(cacheKey);
        console.log(`🗑️ Cleared cache for user ${userId}:`, deleted ? 'success' : 'not found');
        return deleted;
    } else {
        const size = analyticsCache.size;
        analyticsCache.clear();
        console.log(`🗑️ Cleared entire analytics cache (${size} entries)`);
        return size;
    }
}

// Debug function to inspect cache
export function getAnalyticsCacheInfo() {
    const entries = Array.from(analyticsCache.entries()).map(([key, data]) => ({
        key,
        age: Math.round((Date.now() - data.timestamp) / 1000),
        hasData: !!data.rawData
    }));
    
    return {
        totalEntries: analyticsCache.size,
        entries
    };
}