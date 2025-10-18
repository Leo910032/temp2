// lib/services/constants/aiCosts.js
// Centralized AI cost constants for Gemini and other AI models

/**
 * AI Cost Constants
 *
 * This file centralizes all AI model pricing information.
 * Update these values when pricing changes.
 *
 * All costs are in USD.
 * Source: Official Google AI pricing pages (as of 2024)
 */

/**
 * AI Cost estimation constants for contact intelligence features
 */
export const AI_COST_ESTIMATES = {
  // Standard model costs (gemini-2.0-flash)
  STANDARD_COMPANY_MATCHING: 0.0002,   // ~$0.0002 per run
  STANDARD_INDUSTRY_DETECTION: 0.0004, // ~$0.0004 per run
  STANDARD_RELATIONSHIP_DETECTION: 0.001, // ~$0.001 per run

  // Deep analysis costs (gemini-2.5-pro) - Enterprise only
  DEEP_COMPANY_MATCHING: 0.005,        // ~$0.005 per run
  DEEP_INDUSTRY_DETECTION: 0.010,      // ~$0.010 per run
  DEEP_RELATIONSHIP_DETECTION: 0.020,  // ~$0.020 per run

  // Combined operation estimates
  STANDARD_FULL_ANALYSIS: 0.001,       // All features with standard model
  DEEP_FULL_ANALYSIS: 0.035            // All features with deep model
};

/**
 * Business Card Scanner AI Model Configuration
 * Uses Gemini 2.5 Flash Lite for optimal cost/performance balance
 */
export const BUSINESS_CARD_AI_CONFIG = {
  // Model identification
  MODEL_NAME: 'gemini-2.0-flash-lite',
  MODEL_DISPLAY_NAME: 'gemini-2.0-flash-lite',

  // Pricing per 1 million tokens (USD)
  // Source: https://ai.google.dev/pricing
  PRICING: {
    INPUT_TEXT_PER_MILLION: 0.15,
    OUTPUT_PER_MILLION: 0.25,
  },

  // Estimated costs based on typical usage patterns
  ESTIMATED_COSTS: {
    SINGLE_SIDE_SCAN: 0.00007,  // ~300 input + 90 output tokens
    DOUBLE_SIDE_SCAN: 0.00014,  // ~600 input + 180 output tokens
  }
};

/**
 * Gemini Embedding Model Configuration
 * Used for semantic search with Pinecone
 */
export const GEMINI_EMBEDDING_CONFIG = {
  MODEL_NAME: 'text-embedding-004',

  // Pricing per 1 million tokens (USD)
  // Source: https://ai.google.dev/pricing
  PRICING: {
    INPUT_PER_MILLION: 0.10 // Gemini embedding cost
  }
};

/**
 * Query Enhancement AI Model Configuration
 * Uses Gemini 2.0 Flash for query expansion and language detection
 */
export const QUERY_ENHANCEMENT = {
  // Model identification
  MODEL_NAME: 'gemini-2.0-flash',
  MODEL_DISPLAY_NAME: 'Gemini 2.0 Flash',
  PROVIDER_NAME: 'gemini-2.0-flash',

  // Pricing per 1 million tokens (USD)
  // Source: https://ai.google.dev/pricing
  PRICING: {
    INPUT_PER_MILLION: 0.075,
    OUTPUT_PER_MILLION: 0.30,
  },

  // Feature configuration
  FEATURE_NAME: 'semantic_search_enhancement',
  STEP_LABEL: 'Query Enhancement',

  // Cache configuration
  CACHE_TTL: 86400, // 24 hours in seconds

  // Logging prefixes
  LOG_PREFIX: 'QueryEnhancement',
};

/**
 * Gemini Flash and Pro Models for AI Enhancement
 * Used for contact analysis and enhancement
 */
export const GEMINI_PRICING = {
  'gemini-2.5-flash': {
    inputPricePerMillionTokens: 0.30,
    outputPricePerMillionTokens: 2.50,
  },
  'gemini-2.5-pro': {
    inputPricePerMillionTokens: 1.25,
    outputPricePerMillionTokens: 10.00,
  },
  'gemini-2.0-flash': {
    inputPricePerMillionTokens: 0.075,
    outputPricePerMillionTokens: 0.30,
  }
};

/**
 * Helper function to get estimated AI cost for a specific operation
 * @param {string} operation - The operation type
 * @param {boolean} isDeep - Whether to use deep analysis model
 * @returns {number} Estimated cost in USD
 */
export function getAICost(operation, isDeep = false) {
  try {
    const prefix = isDeep ? 'DEEP_' : 'STANDARD_';
    const key = `${prefix}${operation}`;
    return AI_COST_ESTIMATES[key] || 0;
  } catch (error) {
    console.error(`[AiCosts] Error getting cost for ${operation}:`, error);
    return 0;
  }
}