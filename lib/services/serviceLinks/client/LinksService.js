// lib/services/serviceLinks/client/LinksService.js
"use client";

import { ContactApiClient } from '@/lib/services/core/ApiClient.js';

// ✅ ENHANCED CACHE WITH LISTENERS
let linksCache = {
    data: null,
    expiry: null,
    listeners: new Set(), // Track components that want updates
};
const CACHE_DURATION = 10 * 60 * 1000; // 2 minutes in milliseconds

export class LinksService {
    /**
     * Subscribe to links updates
     * @param {Function} callback - Function to call when links change
     * @returns {Function} - Unsubscribe function
     */
    static subscribe(callback) {
        linksCache.listeners.add(callback);
        
        // Return unsubscribe function
        return () => {
            linksCache.listeners.delete(callback);
        };
    }

    /**
     * Notify all subscribers of links changes
     * @param {Array} links - The updated links array
     */
    static notifyListeners(links) {
        linksCache.listeners.forEach(callback => {
            try {
                callback(links);
            } catch (error) {
                console.error('Error notifying links listener:', error);
            }
        });
    }

    /**
     * Fetches all links for the current user, using a cache to avoid redundant calls.
     * Returns the links array directly from the user document structure.
     * @param {boolean} forceRefresh - If true, bypasses the cache and fetches fresh data.
     * @returns {Promise<{links: Array}>}
     */
    static async getLinks(forceRefresh = false) {
        const now = Date.now();

        // ✅ CHECK THE CACHE FIRST
        if (!forceRefresh && linksCache.data && linksCache.expiry && now < linksCache.expiry) {
            console.log('🔄 LinksService: Serving links from cache.');
            return linksCache.data;
        }

        try {
            console.log('📥 LinksService: Fetching fresh links from API...');
            const result = await ContactApiClient.get('/api/user/links');

            // ✅ Ensure the response matches expected structure
            const responseData = {
                links: result.links || [], // Always ensure links is an array
                success: result.success || true
            };

            // ✅ UPDATE THE CACHE ON SUCCESSFUL FETCH
            linksCache = {
                ...linksCache, // Preserve listeners
                data: responseData,
                expiry: now + CACHE_DURATION,
            };

            // ✅ NOTIFY SUBSCRIBERS OF THE NEW DATA
            this.notifyListeners(responseData.links);
            
            return responseData;
        } catch (error) {
            console.error('LinksService: Failed to fetch links.', error);
            throw error;
        }
    }

    /**
     * Saves all links for the current user and invalidates the cache.
     * Updates the links array in the user document structure.
     * @param {Array} links - The full array of link objects.
     * @returns {Promise<object>}
     */
    static async saveLinks(links) {
        try {
            // ✅ Ensure links is always an array (never null/undefined)
            const linksArray = Array.isArray(links) ? links : [];
            
            const result = await ContactApiClient.post('/api/user/links', { links: linksArray });

            // ✅ IMPORTANT: The server may have modified the links (auto-deactivation, URL fixes, etc.)
            // If the server returns the modified links, use those instead of force-refreshing
            if (result.links && Array.isArray(result.links)) {
                console.log('🔄 LinksService: Server returned modified links, updating cache and notifying listeners');
                
                // Update cache with server-modified links
                const now = Date.now();
                const responseData = {
                    links: result.links,
                    success: true
                };
                
                linksCache = {
                    ...linksCache,
                    data: responseData,
                    expiry: now + CACHE_DURATION,
                };
                
                // Notify all listeners immediately with server-modified data
                this.notifyListeners(result.links);
                
                return { ...result, links: result.links };
            } else {
                // Fallback: force refresh if server didn't return links
                console.log('🔄 LinksService: Server didn\'t return links, force refreshing');
                const updatedData = await this.getLinks(true);
                return result;
            }
            
        } catch (error) {
            console.error('LinksService: Failed to save links.', error);
            throw error;
        }
    }

    /**
     * Update a specific link and sync with server
     * @param {string} linkId - ID of the link to update
     * @param {object} updates - Fields to update
     * @returns {Promise<Array>} - Updated links array
     */
    static async updateLink(linkId, updates) {
        try {
            // Get current links from cache or server
            const currentData = await this.getLinks();
            const currentLinks = currentData.links;
            
            // Find and update the specific link
            const updatedLinks = currentLinks.map(link => 
                link.id === linkId ? { ...link, ...updates } : link
            );
            
            // Save to server
            await this.saveLinks(updatedLinks);
            
            return updatedLinks;
        } catch (error) {
            console.error('LinksService: Failed to update link.', error);
            throw error;
        }
    }

    /**
     * A helper function to manually clear the cache.
     */
    static invalidateCache() {
        console.log('🗑️ LinksService: Invalidating links cache.');
        linksCache = {
            ...linksCache, // Preserve listeners
            data: null,
            expiry: null,
        };
    }

    /**
     * Get cached links without making API call
     * @returns {Array|null} - Cached links or null if not cached
     */
    static getCachedLinks() {
        const now = Date.now();
        if (linksCache.data && linksCache.expiry && now < linksCache.expiry) {
            return linksCache.data.links;
        }
        return null;
    }

    /**
     * Utility method to validate link structure before saving
     * @param {Array} links - Array of link objects to validate
     * @returns {boolean} - Returns true if valid, throws error if invalid
     */
    static validateLinksStructure(links) {
        if (!Array.isArray(links)) {
            throw new Error("Links must be an array");
        }

        for (const link of links) {
            // Validate required fields based on your ManageLinks component structure
            if (!link.id || typeof link.id !== 'string') {
                throw new Error("Each link must have a valid id");
            }
            if (typeof link.title !== 'string') {
                throw new Error("Each link must have a title string");
            }
            if (typeof link.isActive !== 'boolean') {
                throw new Error("Each link must have an isActive boolean");
            }
            if (typeof link.type !== 'number') {
                throw new Error("Each link must have a type number");
            }

            // Validate link types
            // Type 0: Header
            // Type 1: Standard link
            // Type 2: Carousel
            if (![0, 1, 2].includes(link.type)) {
                throw new Error(`Invalid link type: ${link.type}. Must be 0 (header), 1 (link), or 2 (carousel)`);
            }

            // For standard links (type 1), validate URL if active
            if (link.type === 1 && link.isActive) {
                if (!link.url || typeof link.url !== 'string' || link.url.trim() === '') {
                    console.warn(`Link "${link.title}" is active but has no URL - should be auto-deactivated by server`);
                }
            }

            if (link.urlKind !== undefined && typeof link.urlKind !== 'string') {
                throw new Error("urlKind must be a string if provided");
            }
        }
        
        return true;
    }
}