// lib/services/serviceLinks/client/LinksService.js
"use client";

import { ContactApiClient } from '@/lib/services/core/ApiClient.js';

// ✅ STEP 1: CREATE A CACHE OBJECT FOR THIS SERVICE
let linksCache = {
  data: null,
  expiry: null,
};
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes in milliseconds

export class LinksService {
    /**
     * Fetches all links for the current user, using a cache to avoid redundant calls.
     * @param {boolean} forceRefresh - If true, bypasses the cache and fetches fresh data.
     * @returns {Promise<Array>}
     */
    static async getLinks(forceRefresh = false) {
        const now = Date.now();

        // ✅ STEP 2: CHECK THE CACHE FIRST
        if (!forceRefresh && linksCache.data && linksCache.expiry && now < linksCache.expiry) {
            console.log('🔄 LinksService: Serving links from cache.');
            return linksCache.data;
        }

        try {
            console.log('📥 LinksService: Fetching fresh links from API...');
            const result = await ContactApiClient.get('/api/user/links');

            // ✅ STEP 3: UPDATE THE CACHE ON SUCCESSFUL FETCH
            linksCache = {
                data: result,
                expiry: now + CACHE_DURATION,
            };
            
            return result;
        } catch (error) {
            console.error('LinksService: Failed to fetch links.', error);
            throw error; // Re-throw the error so the page component can handle it
        }
    }

    /**
     * Saves all links for the current user and invalidates the cache.
     * @param {Array} links - The full array of link objects.
     * @returns {Promise<object>}
     */
    static async saveLinks(links) {
        try {
            const result = await ContactApiClient.post('/api/user/links', { links });

            // ✅ STEP 4: INVALIDATE THE CACHE AFTER A SUCCESSFUL SAVE
            // This ensures the next time we call getLinks(), we get the fresh data.
            this.invalidateCache();
            
            return result;
        } catch (error) {
            console.error('LinksService: Failed to save links.', error);
            throw error;
        }
    }

    /**
     * A helper function to manually clear the cache.
     */
    static invalidateCache() {
        console.log('🗑️ LinksService: Invalidating links cache.');
        linksCache = {
            data: null,
            expiry: null,
        };
    }
}