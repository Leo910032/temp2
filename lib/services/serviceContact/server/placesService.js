//lib/services/serviceContact/server/placesService.js
// Server-side service for interacting with Google Places API

import { CostTrackingService } from './costTrackingService.js';
import { API_COSTS } from '../../../services/constants/apiCosts.js';

export class PlacesService {
  static getApiKey() {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('ERROR: Google Maps API key not configured on the server.');
      throw new Error('Google Maps API not configured');
    }
    return apiKey;
  }

  /**
   * Search for place predictions using Google Places Autocomplete API.
   * @param {string} userId - The user ID
   * @param {Object} params - Search parameters
   * @param {string} params.input - Search query
   * @param {string} params.sessiontoken - Google session token
   * @param {string} params.sessionId - Optional session ID for cost tracking
   * @param {string} params.types - Place types filter
   */
  static async searchPlaces(userId, { input, sessiontoken, sessionId = null, types = 'establishment|geocode' }) {
    if (!input || input.trim().length < 3) {
      return { predictions: [], status: 'QUERY_TOO_SHORT' };
    }

    const apiKey = this.getApiKey();
    const params = new URLSearchParams({
      input: input.trim(),
      key: apiKey,
      types,
      sessiontoken,
    });
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;

    console.log(`[PlacesService] Calling Google Autocomplete API for: ${input}`);
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[PlacesService] Google Autocomplete API Error:', data);
      throw new Error(data.error_message || `API Error: ${data.status}`);
    }

    // Track API cost
    try {
      await CostTrackingService.recordUsage({
        userId,
        usageType: 'ApiUsage',
        feature: 'google_maps_autocomplete',
        cost: API_COSTS.GOOGLE_MAPS.PLACES_AUTOCOMPLETE.PER_REQUEST,
        isBillableRun: false,
        provider: 'google_maps',
        sessionId, // Add to session if provided
        metadata: {
          input: input.trim(),
          sessiontoken,
          resultCount: data.predictions?.length || 0,
          status: data.status
        }
      });
    } catch (costError) {
      console.error('[PlacesService] Failed to track cost:', costError);
      // Don't fail the request if cost tracking fails
    }

    return data;
  }

  /**
   * Get detailed information for a specific Place ID.
   * @param {string} userId - The user ID
   * @param {Object} params - Details parameters
   * @param {string} params.place_id - Google Place ID
   * @param {string} params.sessiontoken - Google session token
   * @param {string} params.sessionId - Optional session ID for cost tracking (finalizes the session)
   * @param {Array<string>} params.fields - Fields to request
   */
  static async getPlaceDetails(userId, { place_id, sessiontoken, sessionId = null, fields = [] }) {
    if (!place_id) {
      throw new Error('Place ID is required');
    }

    const requestedFields = fields.length > 0 ? fields : [
      'place_id', 'name', 'formatted_address', 'geometry', 'types'
    ];

    const apiKey = this.getApiKey();
    const params = new URLSearchParams({
      place_id,
      key: apiKey,
      fields: requestedFields.join(','),
      sessiontoken,
    });
    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;

    console.log(`[PlacesService] Calling Google Place Details API for Place ID: ${place_id}`);
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('[PlacesService] Google Place Details API Error:', data);
      throw new Error(data.error_message || `API Error: ${data.status}`);
    }

    // Track API cost
    try {
      await CostTrackingService.recordUsage({
        userId,
        usageType: 'ApiUsage',
        feature: 'google_maps_place_details',
        cost: API_COSTS.GOOGLE_MAPS.PLACES_DETAILS.PER_REQUEST,
        isBillableRun: false,
        provider: 'google_maps',
        sessionId, // Add to session if provided
        metadata: {
          place_id,
          sessiontoken,
          fields: requestedFields,
          status: data.status
        }
      });

      // Finalize the session after getting place details (last step)
      if (sessionId) {
        try {
          await CostTrackingService.finalizeSession(userId, sessionId);
          console.log(`[PlacesService] Session finalized: ${sessionId}`);
        } catch (sessionError) {
          console.error('[PlacesService] Failed to finalize session:', sessionError);
          // Don't fail the request if session finalization fails
        }
      }
    } catch (costError) {
      console.error('[PlacesService] Failed to track cost:', costError);
      // Don't fail the request if cost tracking fails
    }

    return data;
  }
}
