// lib/services/serviceContact/client/services/GroupService.js
"use client";

import { ContactApiClient } from '@/lib/services/core/ApiClient';

// Enhanced cache with listeners (same pattern as ContactsService)
let groupsCache = {
    data: null,
    expiry: null,
    listeners: new Set(),
};
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export class GroupService {
    /**
     * Subscribe to groups updates
     * @param {Function} callback - Function to call when groups change
     * @returns {Function} - Unsubscribe function
     */
    static subscribe(callback) {
        groupsCache.listeners.add(callback);
        return () => {
            groupsCache.listeners.delete(callback);
        };
    }

    /**
     * Notify all subscribers of groups changes
     * @param {Array} data - The updated groups data
     */
    static notifyListeners(data) {
        groupsCache.listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error notifying groups listener:', error);
            }
        });
    }

    /**
     * Get all groups
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Array of groups
     */
    static async getAllGroups(options = {}) {
        const { force = false, clearCache = false } = options;
        const now = Date.now();

        // Check cache first
        if (!force && !clearCache && groupsCache.data && groupsCache.expiry && now < groupsCache.expiry) {
            console.log('🔄 GroupService: Serving groups from cache');
            return groupsCache.data;
        }

        try {
            console.log('📥 GroupService: Fetching fresh groups from API...');

            const result = await ContactApiClient.get('/api/user/contacts/groups');

            const groups = result.groups || [];

            // Update cache
            groupsCache = {
                ...groupsCache,
                data: groups,
                expiry: now + CACHE_DURATION,
            };

            // Notify subscribers
            this.notifyListeners(groups);

            return groups;
        } catch (error) {
            console.error('GroupService: Failed to fetch groups', error);
            throw error;
        }
    }

    /**
     * Create a new group
     * @param {Object} options - Creation options
     * @returns {Promise<Object>} - Created group
     */
    static async createGroup(options) {
        const { groupData } = options;

        try {
            console.log('📤 GroupService: Creating group:', groupData.name);

            const result = await ContactApiClient.post('/api/user/contacts/groups', groupData);

            // Invalidate cache on mutation
            this.invalidateCache();

            // Fetch fresh data and notify listeners
            const freshData = await this.getAllGroups({ force: true });
            this.notifyListeners(freshData);

            return result;
        } catch (error) {
            console.error('GroupService: Failed to create group', error);
            throw error;
        }
    }

    /**
     * Update an existing group
     * @param {Object} options - Update options
     * @returns {Promise<Object>} - Updated group
     */
    static async updateGroup(options) {
        const { groupId, updates } = options;

        try {
            console.log('📤 GroupService: Updating group:', groupId);

            const result = await ContactApiClient.patch(`/api/user/contacts/groups/${groupId}`, updates);

            // Invalidate cache
            this.invalidateCache();

            // Fetch fresh data and notify listeners
            const freshData = await this.getAllGroups({ force: true });
            this.notifyListeners(freshData);

            return result;
        } catch (error) {
            console.error('GroupService: Failed to update group', error);
            throw error;
        }
    }

    /**
     * Delete a group
     * @param {string} groupId - ID of group to delete
     * @returns {Promise<Object>}
     */
    static async deleteGroup(groupId) {
        try {
            console.log('📤 GroupService: Deleting group:', groupId);

            const result = await ContactApiClient.delete(`/api/user/contacts/groups?groupId=${groupId}`);

            // Invalidate cache
            this.invalidateCache();

            // Fetch fresh data and notify listeners
            const freshData = await this.getAllGroups({ force: true });
            this.notifyListeners(freshData);

            return result;
        } catch (error) {
            console.error('GroupService: Failed to delete group', error);
            throw error;
        }
    }

    /**
     * Invalidate the cache
     */
    static invalidateCache() {
        console.log('🗑️ GroupService: Invalidating groups cache');
        groupsCache = {
            ...groupsCache,
            data: null,
            expiry: null,
        };
    }

    /**
     * Get cached groups without making API call
     * @returns {Array|null} - Cached data or null
     */
    static getCachedGroups() {
        const now = Date.now();
        if (groupsCache.data && groupsCache.expiry && now < groupsCache.expiry) {
            return groupsCache.data;
        }
        return null;
    }
}
