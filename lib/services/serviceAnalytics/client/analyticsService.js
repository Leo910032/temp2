// lib/services/client/analyticsService.js
"use client";

import { ContactApiClient } from './serviceContact/client/core/contactApiClient';
import { GenericCacheManager } from './core/genericCacheManager'; // ✅ IMPORT THE NEW GENERIC CACHE

// ✅ CREATE A DEDICATED CACHE INSTANCE FOR THIS SERVICE
const analyticsCache = new GenericCacheManager('analytics');

export class AnalyticsService {
    static async getAnalytics(period = 'all', forceRefresh = false) {
        const queryParams = new URLSearchParams(window.location.search);
        const isImpersonating = queryParams.get('impersonate') === 'true';
        const targetUserId = queryParams.get('userId');
        const teamId = queryParams.get('teamId');

        let endpoint;
        let cacheKey;

        if (isImpersonating && targetUserId && teamId) {
            endpoint = `/api/enterprise/analytics/impersonate/${targetUserId}`;
            cacheKey = `analytics_impersonate_${targetUserId}_${period}`;
        } else {
            endpoint = `/api/user/analytics`;
            cacheKey = `analytics_personal_${period}`;
        }

        // ✅ USE THE NEW, DEDICATED CACHE
        if (!forceRefresh) {
            const cachedData = analyticsCache.get(cacheKey);
            if (cachedData) {
                return cachedData;
            }
        }
        
        try {
            const url = new URL(endpoint, window.location.origin);
            url.searchParams.set('period', period);
            if (teamId) {
                url.searchParams.set('teamId', teamId);
            }

            const data = await ContactApiClient.get(url.pathname + url.search);

            // ✅ SET THE NEW, DEDICATED CACHE
            analyticsCache.set(cacheKey, data, 5 * 60 * 1000); // 5 minute cache
            
            return data;
        } catch (error) {
            console.error(`[AnalyticsService] Failed to fetch analytics:`, error);
            throw error;
        }
    }

    static invalidateCache() {
        // ✅ INVALIDATE THE DEDICATED CACHE
        analyticsCache.invalidate('analytics_');
    }
}