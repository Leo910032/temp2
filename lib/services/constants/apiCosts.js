// lib/services/constants/apiCosts.js
// Centralized API cost constants for third-party services

/**
 * API Cost Constants
 *
 * This file centralizes all third-party API pricing information.
 * Update these values when pricing changes.
 *
 * All costs are in USD.
 * Source: Official API pricing pages (as of 2024)
 */

export const API_COSTS = {
  // Google Maps Platform
  // Source: https://developers.google.com/maps/billing-and-pricing/pricing
  GOOGLE_MAPS: {
    // Autocomplete - Per Session pricing
    PLACES_AUTOCOMPLETE: {
      // Cost for 1000 requests
      PER_1000: 2.83,
      // Cost per individual request
      PER_REQUEST: 0.00283
    },
    // Place Details - Basic Data
    PLACES_DETAILS: {
      // Cost for 1000 requests
      PER_1000: 17.00,
      // Cost per individual request
      PER_REQUEST: 0.017
    }
  },

  // Pinecone Vector Database
  // Source: https://www.pinecone.io/pricing/
  // To be implemented when Pinecone integration is added
  PINECONE: {
    // Example structure for future implementation:
    // QUERY: {
    //   PER_1000: 0.00,
    //   PER_REQUEST: 0.00
    // },
    // UPSERT: {
    //   PER_1000: 0.00,
    //   PER_REQUEST: 0.00
    // }
  },

  // Neo4j Graph Database
  // Source: https://neo4j.com/pricing/
  // To be implemented when Neo4j integration is added
  NEO4J: {
    // Example structure for future implementation:
    // QUERY: {
    //   PER_1000: 0.00,
    //   PER_REQUEST: 0.00
    // }
  }
};

/**
 * Helper function to get cost for a specific API operation
 * @param {string} provider - The API provider (e.g., 'GOOGLE_MAPS')
 * @param {string} operation - The operation (e.g., 'PLACES_AUTOCOMPLETE')
 * @returns {number} Cost per request
 */
export function getApiCost(provider, operation) {
  try {
    return API_COSTS[provider]?.[operation]?.PER_REQUEST || 0;
  } catch (error) {
    console.error(`[ApiCosts] Error getting cost for ${provider}.${operation}:`, error);
    return 0;
  }
}
