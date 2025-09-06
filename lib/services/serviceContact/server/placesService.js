// lib/services/serviceContact/server/placesService.js
// Server-side service for interacting with Google Places API

import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// In-memory cache for API results
const autocompleteCache = new Map();
const detailsCache = new Map();
const AUTOCOMPLETE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DETAILS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
   */
  static async searchPlaces(userId, { input, sessiontoken, types = 'establishment|geocode' }) {
    if (!input || input.trim().length < 3) {
      return { predictions: [], status: 'QUERY_TOO_SHORT' };
    }

    const cacheKey = `${input.toLowerCase().trim()}_${sessiontoken}`;
    const cached = autocompleteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < AUTOCOMPLETE_CACHE_TTL) {
      console.log(`[PlacesService] Autocomplete cache HIT for: ${input}`);
      return cached.data;
    }

    const apiKey = this.getApiKey();
    const params = new URLSearchParams({
      input: input.trim(),
      key: apiKey,
      types,
      sessiontoken,
    });
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;

    console.log(`[PlacesService] Autocomplete cache MISS. Calling Google API for: ${input}`);
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[PlacesService] Google Autocomplete API Error:', data);
      throw new Error(data.error_message || `API Error: ${data.status}`);
    }

    autocompleteCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Get detailed information for a specific Place ID.
   */
  static async getPlaceDetails(userId, { place_id, sessiontoken, fields = [] }) {
    if (!place_id) {
      throw new Error('Place ID is required');
    }

    const requestedFields = fields.length > 0 ? fields : [
      'place_id', 'name', 'formatted_address', 'geometry', 'types'
    ];
    const cacheKey = `${place_id}_${requestedFields.sort().join(',')}`;

    const cached = detailsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DETAILS_CACHE_TTL) {
      console.log(`[PlacesService] Details cache HIT for Place ID: ${place_id}`);
      return cached.data;
    }
    
    const apiKey = this.getApiKey();
    const params = new URLSearchParams({
      place_id,
      key: apiKey,
      fields: requestedFields.join(','),
      sessiontoken,
    });
    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;

    console.log(`[PlacesService] Details cache MISS. Calling Google API for Place ID: ${place_id}`);
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('[PlacesService] Google Place Details API Error:', data);
      throw new Error(data.error_message || `API Error: ${data.status}`);
    }
    
    detailsCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }
}
