// lib/services/serviceContact/client/services/PlacesService.js
"use client"

import { ContactApiClient } from '@/lib/services/core/ApiClient'; // Ensure this path is correct

// Client-side cache for API results
const autocompleteCache = new Map();
const detailsCache = new Map();
const AUTOCOMPLETE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DETAILS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * A simplified, static client-side service for interacting with the Places API proxy.
 */
export class PlacesService {
  /**
   * Get place predictions from our backend API.
   * @param {object} params - { input, sessiontoken }
   */
  static async getPredictions(params) {
    try {
      if (!params.input || !params.sessiontoken) {
        throw new Error('Input and session token are required for predictions.');
      }

      // Check cache first
      const cacheKey = `${params.input.toLowerCase().trim()}_${params.sessiontoken}`;
      const cached = autocompleteCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < AUTOCOMPLETE_CACHE_TTL) {
        console.log(`[PlacesService Client] Autocomplete cache HIT for: ${params.input}`);
        return cached.data;
      }

      console.log(`[PlacesService Client] Autocomplete cache MISS. Calling backend for: ${params.input}`);
      const data = await ContactApiClient.post('/api/user/contacts/places/autocomplete', params);

      // Store in cache
      autocompleteCache.set(cacheKey, { data, timestamp: Date.now() });

      return data;
    } catch (error) {
      console.error("PlacesService Error (getPredictions):", error);
      // Re-throw the error so the calling component can handle it (e.g., show a toast)
      throw new Error(error.message || 'Could not fetch place suggestions.');
    }
  }

  /**
   * Get place details from our backend API.
   * @param {object} params - { place_id, sessiontoken }
   */
  static async getDetails(params) {
    try {
      if (!params.place_id || !params.sessiontoken) {
        throw new Error('Place ID and session token are required for details.');
      }

      // Check cache first
      const cacheKey = `${params.place_id}_${params.sessiontoken}`;
      const cached = detailsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < DETAILS_CACHE_TTL) {
        console.log(`[PlacesService Client] Details cache HIT for Place ID: ${params.place_id}`);
        return cached.data;
      }

      console.log(`[PlacesService Client] Details cache MISS. Calling backend for Place ID: ${params.place_id}`);
      const data = await ContactApiClient.post('/api/user/contacts/places/details', params);

      // Store in cache
      detailsCache.set(cacheKey, { data, timestamp: Date.now() });

      return data;
    } catch (error) {
      console.error("PlacesService Error (getDetails):", error);
      throw new Error(error.message || 'Could not get location details.');
    }
  }
}
