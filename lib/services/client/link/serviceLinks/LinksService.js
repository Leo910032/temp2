/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// lib/services/serviceContact/client/services/linksService.js
// We can reuse an existing API client to get the auth token
import { ContactApiClient } from '@/lib/services/core/ApiClient.js';

export class LinksService {
    /**
     * Fetches all links for the current user.
     * @returns {Promise<Array>}
     */
    static async getLinks() {
        return ContactApiClient.get('/api/user/links');
    }

    /**
     * Saves all links for the current user.
     * @param {Array} links - The full array of link objects.
     * @returns {Promise<object>}
     */
    static async saveLinks(links) {
        return ContactApiClient.post('/api/user/links', { links });
    }
}