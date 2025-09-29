// lib/services/serviceContact/client/ContactsService.js
"use client";

import { ContactApiClient } from '@/lib/services/core/ApiClient';

// Enhanced cache with listeners (same pattern as LinksService)
let contactsCache = {
    data: null,
    expiry: null,
    listeners: new Set(),
};
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export class ContactsService {
    /**
     * Subscribe to contacts updates
     * @param {Function} callback - Function to call when contacts change
     * @returns {Function} - Unsubscribe function
     */
    static subscribe(callback) {
        contactsCache.listeners.add(callback);
        return () => {
            contactsCache.listeners.delete(callback);
        };
    }

    /**
     * Notify all subscribers of contacts changes
     * @param {Object} data - The updated contacts data
     */
    static notifyListeners(data) {
        contactsCache.listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error notifying contacts listener:', error);
            }
        });
    }

    /**
     * Get all contacts with groups
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Contacts, groups, and stats
     */
    static async getAllContactsWithGroups(options = {}) {
        const { userId, filter, searchTerm, selectedGroupIds, force = false, clearCache = false } = options;
        const now = Date.now();

        // Check cache first
        if (!force && !clearCache && contactsCache.data && contactsCache.expiry && now < contactsCache.expiry) {
            console.log('🔄 ContactsService: Serving contacts from cache');
            return contactsCache.data;
        }

        try {
            console.log('📥 ContactsService: Fetching fresh contacts from API...');
            
            const queryParams = new URLSearchParams();
            if (filter && filter !== 'all') queryParams.append('filter', filter);
            if (searchTerm) queryParams.append('search', searchTerm);
            if (selectedGroupIds?.length) queryParams.append('groupIds', selectedGroupIds.join(','));

            const result = await ContactApiClient.get(`/api/user/contacts?${queryParams.toString()}`);

            // Ensure proper structure
            const responseData = {
                contacts: result.contacts || [],
                groups: result.groups || [],
                stats: result.stats || null,
                pagination: result.pagination || { hasMore: false, lastDoc: null },
                success: true
            };

            // Update cache
            contactsCache = {
                ...contactsCache,
                data: responseData,
                expiry: now + CACHE_DURATION,
            };

            // Notify subscribers
            this.notifyListeners(responseData);

            return responseData;
        } catch (error) {
            console.error('ContactsService: Failed to fetch contacts', error);
            throw error;
        }
    }

    /**
     * Create a new contact
     * @param {Object} options - Creation options
     * @returns {Promise<Object>} - Created contact
     */
    static async createContact(options) {
        const { userId, contactData } = options;
        
        try {
            const result = await ContactApiClient.post('/api/user/contacts', {
                userId,
                ...contactData
            });

            // Invalidate cache on mutation
            this.invalidateCache();
            
            // Fetch fresh data and notify listeners
            if (userId) {
                const freshData = await this.getAllContactsWithGroups({ userId, force: true });
                this.notifyListeners(freshData);
            }

            return result;
        } catch (error) {
            console.error('ContactsService: Failed to create contact', error);
            throw error;
        }
    }

    /**
     * Update an existing contact
     * @param {Object} options - Update options
     * @returns {Promise<Object>} - Updated contact
     */
    static async updateContact(options) {
        const { contactId, updates } = options;
        
        try {
            const result = await ContactApiClient.patch(`/api/user/contacts/${contactId}`, updates);

            // Invalidate cache
            this.invalidateCache();
            
            return result;
        } catch (error) {
            console.error('ContactsService: Failed to update contact', error);
            throw error;
        }
    }

    /**
     * Delete a contact
     * @param {string} contactId - ID of contact to delete
     * @returns {Promise<Object>}
     */
    static async deleteContact(contactId) {
        try {
            const result = await ContactApiClient.delete(`/api/user/contacts/${contactId}`);

            // Invalidate cache
            this.invalidateCache();

            return result;
        } catch (error) {
            console.error('ContactsService: Failed to delete contact', error);
            throw error;
        }
    }

    /**
     * Get usage information for AI features
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - Usage data
     */
    static async getUsageInfo(userId) {
        try {
            const result = await ContactApiClient.get('/api/user/contacts/usage');
            return result.usageInfo || null;
        } catch (error) {
            console.error('ContactsService: Failed to fetch usage info', error);
            throw error;
        }
    }

    /**
     * Invalidate the cache
     */
    static invalidateCache() {
        console.log('🗑️ ContactsService: Invalidating contacts cache');
        contactsCache = {
            ...contactsCache,
            data: null,
            expiry: null,
        };
    }

    /**
     * Get cached contacts without making API call
     * @returns {Object|null} - Cached data or null
     */
    static getCachedContacts() {
        const now = Date.now();
        if (contactsCache.data && contactsCache.expiry && now < contactsCache.expiry) {
            return contactsCache.data;
        }
        return null;
    }
}