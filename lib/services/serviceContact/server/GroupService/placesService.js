//lib/services/serviceContact/server/placesService.js
// Server-side service for interacting with Google Places API

import { CostTrackingService } from '../costTracking/costTrackingService.js';
import { API_COSTS } from '../../../constants/apiCosts.js';

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
        isBillableRun: true, // Place Details counts as a billable API operation
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

  /**
   * Search for nearby venues using Google Places Nearby Search API.
   * Implements tiered keyword search for contextual group naming.
   *
   * @param {string} userId - The user ID
   * @param {Object} params - Search parameters
   * @param {number} params.latitude - Center latitude
   * @param {number} params.longitude - Center longitude
   * @param {number} params.radius - Search radius in meters (default: 1000)
   * @param {Array<string>} params.keywords - Keywords to search for (e.g., ['conference center', 'hotel'])
   * @param {string} params.sessionId - Optional session ID for cost tracking
   * @returns {Promise<Object>} Best matching venue or null
   */
  static async searchNearbyVenues(userId, {
    latitude,
    longitude,
    radius = 1000,
    keywords = [],
    sessionId = null
  }) {
    if (!latitude || !longitude) {
      throw new Error('Latitude and longitude are required');
    }

    if (!keywords || keywords.length === 0) {
      throw new Error('At least one keyword is required');
    }

    const apiKey = this.getApiKey();
    const location = `${latitude},${longitude}`;

    console.log(`[PlacesService] Searching nearby venues:`, {
      location,
      radius,
      keywords: keywords.join(' OR ')
    });

    // Try each keyword until we find results
    for (const keyword of keywords) {
      const params = new URLSearchParams({
        location,
        radius: radius.toString(),
        keyword,
        key: apiKey,
      });

      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;

      console.log(`[PlacesService] Trying keyword: "${keyword}"`);

      try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          console.error('[PlacesService] Google Nearby Search API Error:', data);
          // Continue to next keyword instead of failing completely
          continue;
        }

        // Track API cost for this request
        try {
          await CostTrackingService.recordUsage({
            userId,
            usageType: 'ApiUsage',
            feature: 'google_maps_nearby_search',
            cost: API_COSTS.GOOGLE_MAPS.PLACES_NEARBY_SEARCH.PER_REQUEST,
            isBillableRun: true, // Nearby Search counts as a billable operation
            provider: 'google_maps',
            sessionId,
            metadata: {
              location,
              radius,
              keyword,
              resultCount: data.results?.length || 0,
              status: data.status
            }
          });
        } catch (costError) {
          console.error('[PlacesService] Failed to track cost:', costError);
          // Don't fail the request if cost tracking fails
        }

        // If we found results, return the closest one
        if (data.results && data.results.length > 0) {
          const closestVenue = this._findClosestVenue(data.results, latitude, longitude);

          console.log(`[PlacesService] Found venue: "${closestVenue.name}" (${closestVenue.vicinity})`);

          return {
            success: true,
            venue: {
              name: closestVenue.name,
              address: closestVenue.vicinity,
              placeId: closestVenue.place_id,
              location: closestVenue.geometry?.location || null,
              types: closestVenue.types || [],
              distance: closestVenue._distance,
              matchedKeyword: keyword
            },
            totalResults: data.results.length
          };
        }

        console.log(`[PlacesService] No results for keyword: "${keyword}"`);

      } catch (error) {
        console.error(`[PlacesService] Error searching with keyword "${keyword}":`, error);
        // Continue to next keyword
        continue;
      }
    }

    // No results found for any keyword
    console.log(`[PlacesService] No venues found for any keywords`);
    return {
      success: false,
      venue: null,
      message: 'No venues found in the area'
    };
  }

  /**
   * Find the closest venue to a given location using Haversine formula.
   * @private
   * @param {Array} venues - Array of venue results from Google Places API
   * @param {number} centerLat - Center latitude
   * @param {number} centerLng - Center longitude
   * @returns {Object} Closest venue with added _distance property
   */
  static _findClosestVenue(venues, centerLat, centerLng) {
    let closestVenue = null;
    let minDistance = Infinity;

    for (const venue of venues) {
      if (!venue.geometry?.location) continue;

      const venueLat = venue.geometry.location.lat;
      const venueLng = venue.geometry.location.lng;

      const distance = this._calculateHaversineDistance(
        centerLat,
        centerLng,
        venueLat,
        venueLng
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestVenue = { ...venue, _distance: distance };
      }
    }

    return closestVenue || venues[0]; // Fallback to first result if calculation fails
  }

  /**
   * Calculate distance between two GPS coordinates using Haversine formula.
   * @private
   * @param {number} lat1 - First latitude
   * @param {number} lon1 - First longitude
   * @param {number} lat2 - Second latitude
   * @param {number} lon2 - Second longitude
   * @returns {number} Distance in kilometers
   */
  static _calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this._toRadians(lat2 - lat1);
    const dLon = this._toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this._toRadians(lat1)) *
              Math.cos(this._toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians.
   * @private
   */
  static _toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
}
