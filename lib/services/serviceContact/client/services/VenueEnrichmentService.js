// lib/services/serviceContact/client/services/VenueEnrichmentService.js
"use client"

import { ContactApiClient } from '@/lib/services/core/ApiClient';

// Tiered keywords for venue search
const VENUE_KEYWORDS = {
  TIER_1: [
    'conference center',
    'convention center',
    'exhibition hall',
    'arena',
    'stadium',
    'university',
    'tech park'
  ],
  TIER_2: [
    'hotel',
    'coworking space',
    'business center',
    'auditorium'
  ],
  TIER_3_OPTIONAL: [
    'restaurant',
    'bar',
    'cafe'
  ]
};

/**
 * Client-side service for enriching groups with venue information
 * using Google Maps Nearby Search API.
 */
export class VenueEnrichmentService {
  /**
   * Enrich a group with venue information based on contact locations.
   *
   * @param {Object} params - Enrichment parameters
   * @param {Object} params.groupData - The group object to enrich
   * @param {Array} params.contacts - Array of contacts in the group (must have location data)
   * @param {number} params.radius - Search radius in meters (default: 1000)
   * @param {boolean} params.includeTier3 - Whether to include Tier 3 keywords (default: false)
   * @param {string} params.sessionId - Optional session ID for cost tracking
   * @returns {Promise<Object>} Enriched group data or original if no venue found
   */
  static async enrichGroupWithVenue({
    groupData,
    contacts,
    radius = 1000,
    includeTier3 = false,
    sessionId = null
  }) {
    try {
      // Validate inputs
      if (!groupData || !contacts || contacts.length === 0) {
        throw new Error('Group data and contacts are required');
      }

      // Calculate centroid from contact GPS coordinates
      const centroid = this._calculateCentroid(contacts);
      if (!centroid) {
        console.log('[VenueEnrichmentService] No valid GPS coordinates found in contacts');
        return { success: false, group: groupData, reason: 'no_gps_data' };
      }

      // Build keyword list based on tiers
      const keywords = [
        ...VENUE_KEYWORDS.TIER_1,
        ...VENUE_KEYWORDS.TIER_2
      ];
      if (includeTier3) {
        keywords.push(...VENUE_KEYWORDS.TIER_3_OPTIONAL);
      }

      console.log('[VenueEnrichmentService] Searching for venue:', {
        centroid,
        radius,
        keywordTiers: includeTier3 ? '1-3' : '1-2',
        contactCount: contacts.length
      });

      // Call API endpoint
      const result = await ContactApiClient.post('/api/user/contacts/groups/enrich-venue', {
        latitude: centroid.lat,
        longitude: centroid.lng,
        radius,
        keywords,
        sessionId
      });

      // If venue found, enrich the group
      if (result.success && result.venue) {
        const enrichedGroup = this._enrichGroupWithVenueData(groupData, result.venue, centroid);
        console.log('[VenueEnrichmentService] Group enriched:', {
          originalName: groupData.name,
          enrichedName: enrichedGroup.name,
          venue: result.venue.name
        });
        return { success: true, group: enrichedGroup, venue: result.venue };
      }

      // No venue found
      console.log('[VenueEnrichmentService] No venue found for group');
      return { success: false, group: groupData, reason: 'no_venue_found' };

    } catch (error) {
      console.error('[VenueEnrichmentService] Error enriching group:', error);

      // Check if it's a budget error
      if (error.message?.includes('limit') || error.message?.includes('budget')) {
        return {
          success: false,
          group: groupData,
          reason: 'budget_exceeded',
          error: error.message
        };
      }

      // Return original group on error
      return {
        success: false,
        group: groupData,
        reason: 'error',
        error: error.message
      };
    }
  }

  /**
   * Calculate the geographic centroid (center point) from an array of contacts.
   * @private
   * @param {Array} contacts - Array of contacts with location data
   * @returns {Object|null} Centroid { lat, lng } or null if no valid coordinates
   */
  static _calculateCentroid(contacts) {
    const validContacts = contacts.filter(c =>
      c.location?.latitude &&
      c.location?.longitude &&
      !isNaN(c.location.latitude) &&
      !isNaN(c.location.longitude)
    );

    if (validContacts.length === 0) {
      return null;
    }

    const sum = validContacts.reduce((acc, contact) => {
      acc.lat += contact.location.latitude;
      acc.lng += contact.location.longitude;
      return acc;
    }, { lat: 0, lng: 0 });

    return {
      lat: sum.lat / validContacts.length,
      lng: sum.lng / validContacts.length
    };
  }

  /**
   * Create an enriched group object with venue information.
   * @private
   * @param {Object} groupData - Original group data
   * @param {Object} venue - Venue data from API
   * @param {Object} centroid - Calculated centroid
   * @returns {Object} Enriched group data
   */
  static _enrichGroupWithVenueData(groupData, venue, centroid) {
    // Extract venue name without common suffixes for cleaner group names
    const venueName = this._cleanVenueName(venue.name);

    // Create new group name based on group type
    let newName;
    if (groupData.type === 'rules_event') {
      newName = `${venueName} Event`;
    } else if (groupData.type === 'rules_location') {
      newName = `${venueName} Location`;
    } else {
      newName = venueName;
    }

    // Create enriched metadata
    const enrichedMetadata = {
      ...groupData.metadata,
      venue: {
        name: venue.name,
        address: venue.address,
        placeId: venue.placeId,
        location: venue.location,
        types: venue.types,
        distance: venue.distance,
        matchedKeyword: venue.matchedKeyword
      },
      enriched: true,
      enrichedAt: new Date().toISOString(),
      centroid
    };

    return {
      ...groupData,
      name: newName,
      metadata: enrichedMetadata
    };
  }

  /**
   * Clean venue name by removing common suffixes and formatting.
   * @private
   * @param {string} venueName - Original venue name
   * @returns {string} Cleaned venue name
   */
  static _cleanVenueName(venueName) {
    // Remove common location suffixes to make names cleaner
    return venueName
      .replace(/\s*-\s*.*$/, '') // Remove everything after dash
      .trim();
  }

  /**
   * Check if a group is eligible for venue enrichment.
   *
   * @param {Object} group - Group to check
   * @param {number} minContacts - Minimum contacts required (default: 5)
   * @returns {boolean} True if eligible
   */
  static isEligibleForEnrichment(group, minContacts = 5) {
    // Must be location or event group
    if (group.type !== 'rules_location' && group.type !== 'rules_event') {
      return false;
    }

    // Must have enough contacts
    if (!group.contactIds || group.contactIds.length < minContacts) {
      return false;
    }

    // Must not already be enriched
    if (group.metadata?.enriched) {
      return false;
    }

    return true;
  }

  /**
   * Get keyword tiers for display/debugging purposes.
   * @returns {Object} Keyword tiers
   */
  static getKeywordTiers() {
    return VENUE_KEYWORDS;
  }
}
