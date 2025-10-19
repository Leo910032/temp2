// lib/services/constants/apiCosts.js
// Centralized API cost constants for third-party services

/**
 * API Cost Constants
 *
 * This file centralizes all third-party API pricing information.
 * Update these values when pricing changes.
 *
 * All costs are in USD.
 * Source: Official API pricing pages (as of 2024-2025)
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
    },
    // Nearby Search - Contact-Based Requests
    PLACES_NEARBY_SEARCH: {
      // Cost for 1000 requests
      PER_1000: 32.00,
      // Cost per individual request
      PER_REQUEST: 0.032
    },
    // Geocoding API - Convert coordinates to addresses
    GEOCODING: {
      // Cost for 1000 requests
      PER_1000: 5.00,
      // Cost per individual request
      PER_REQUEST: 0.005
    }
  },

  // Google Cloud Vision
  // Source: https://cloud.google.com/vision/pricing
  GOOGLE_VISION: {
    // First 1,000 units/month are free.
    // Price shown is for 1,001 - 5,000,000 units per month.
    // Each page in a multi-page file (e.g., PDF) is treated as a single unit.
    DOCUMENT_TEXT_DETECTION: {
      // Cost for 1000 requests (units)
      PER_1000: 1.50,
      // Cost per individual request (unit)
      PER_REQUEST: 0.0015
    }
  },

  // Pinecone Vector Database
  // Source: https://www.pinecone.io/pricing/
  PINECONE: {
    QUERY_BASE: 0.0001, // Base Pinecone query cost
    UPSERT: {
      PER_1000: 0.00, // To be updated when implemented
      PER_REQUEST: 0.00
    }
  },

  // Pinecone Inference API - Embeddings
  // Source: https://www.pinecone.io/pricing/
  // Free tier: 5M tokens/month included
  PINECONE_INFERENCE: {
    MULTILINGUAL_E5_LARGE: {
      PER_MILLION: 0.08,        // $0.08 per million tokens
      PER_TOKEN: 0.00000008,
      FREE_TIER_TOKENS: 5000000 // 5M tokens/month free
    },
    LLAMA_TEXT_EMBED_V2: {
      PER_MILLION: 0.16,        // $0.16 per million tokens
      PER_TOKEN: 0.00000016,
      FREE_TIER_TOKENS: 5000000 // 5M tokens/month free
    },
    PINECONE_SPARSE_ENGLISH_V0: {
      PER_MILLION: 0.08,        // $0.08 per million tokens
      PER_TOKEN: 0.00000008,
      FREE_TIER_TOKENS: 5000000 // 5M tokens/month free
    }
  },

  // Cohere Rerank API (Direct) - MIGRATION 2025-01-16
  // Source: https://cohere.com/pricing
  // Switched from Pinecone rerank due to poor scores (0.0000-0.0121)
  // Cohere provides much better semantic matching (0.6-0.9 expected)
  COHERE_RERANK: {
    // English rerank model (best for English queries)
    RERANK_ENGLISH_V3: {
      PER_1000: 1.00,              // $1.00 per 1,000 searches
      PER_REQUEST: 0.001,
      FREE_TIER_REQUESTS: 0        // No free tier
    },
    // Multilingual rerank model (100+ languages)
    RERANK_MULTILINGUAL_V3: {
      PER_1000: 2.00,              // $2.00 per 1,000 searches
      PER_REQUEST: 0.002,
      FREE_TIER_REQUESTS: 0        // No free tier
    },
    // Multilingual rerank v3.5 model (improved, 100+ languages)
    RERANK_V35: {
      PER_1000: 2.00,              // $2.00 per 1,000 searches
      PER_REQUEST: 0.002,
      FREE_TIER_REQUESTS: 0        // No free tier
    }
  },

  // Pinecone Rerank API (Inference) - DEPRECATED
  // Kept for reference, switched to Cohere direct API for better performance
  PINECONE_RERANK: {
    // Pinecone's state-of-the-art reranking model (DEPRECATED: poor scores)
    PINECONE_RERANK_V0: {
      PER_1000: 2.00,              // $2.00 per 1,000 requests
      PER_REQUEST: 0.002,
      FREE_TIER_REQUESTS: 500      // 500 requests/month free
    },
    // Multilingual BGE reranker (DEPRECATED: poor scores)
    BGE_RERANKER_V2_M3: {
      PER_1000: 2.00,              // $2.00 per 1,000 requests
      PER_REQUEST: 0.002,
      FREE_TIER_REQUESTS: 500      // 500 requests/month free
    }
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