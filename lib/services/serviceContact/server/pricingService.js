// lib/services/serviceContact/server/pricingService.js
// Server-side pricing calculation service - no client dependencies

/**
 * Official Gemini API pricing per 1M tokens (from Google's pricing page)
 */
export const GEMINI_PRICING = {
  'gemini-2.0-flash': {
    inputPrice: 0.10,   // $0.10 per 1M input tokens
    outputPrice: 0.40   // $0.40 per 1M output tokens
  },
  'gemini-2.5-flash': {
    inputPrice: 0.30,   // $0.30 per 1M input tokens  
    outputPrice: 2.50   // $2.50 per 1M output tokens
  },
  'gemini-2.5-pro': {
    inputPrice: 1.25,   // $1.25 per 1M input tokens
    outputPrice: 10.00  // $10.00 per 1M output tokens
  },
  'gemini-2.0-flash-lite': {
    inputPrice: 0.075,  // $0.075 per 1M input tokens
    outputPrice: 0.30   // $0.30 per 1M output tokens
  },
  'gemini-1.5-flash': {
    inputPrice: 0.075,  // $0.075 per 1M input tokens (≤128k tokens)
    outputPrice: 0.30   // $0.30 per 1M output tokens (≤128k tokens)
  },
  'gemini-1.5-pro': {
    inputPrice: 1.25,   // $1.25 per 1M input tokens (≤128k tokens)
    outputPrice: 5.00   // $5.00 per 1M output tokens (≤128k tokens)
  }
};

/**
 * Calculate actual cost based on token usage from Gemini API response
 */
export function calculateActualCost(usageMetadata, modelId) {
  if (!usageMetadata || !modelId) {
    console.warn('⚠️ [Pricing] Missing usage metadata or model ID for cost calculation');
    return 0.001; // Fallback minimum cost
  }

  const pricing = GEMINI_PRICING[modelId];
  if (!pricing) {
    console.warn(`⚠️ [Pricing] No pricing found for model: ${modelId}`);
    return 0.001; // Fallback minimum cost
  }

  const { promptTokenCount = 0, candidatesTokenCount = 0 } = usageMetadata;
  
  // Calculate cost per million tokens
  const inputCost = (promptTokenCount / 1000000) * pricing.inputPrice;
  const outputCost = (candidatesTokenCount / 1000000) * pricing.outputPrice;
  
  const totalCost = inputCost + outputCost;
  
  console.log(`💰 [Pricing] Model: ${modelId}, Input: ${promptTokenCount} tokens ($${inputCost.toFixed(6)}), Output: ${candidatesTokenCount} tokens ($${outputCost.toFixed(6)}), Total: $${totalCost.toFixed(6)}`);
  
  return totalCost;
}

/**
 * Typical token usage patterns for estimation purposes
 * Based on observed API behavior with different types of content
 */
export const ESTIMATED_TOKEN_USAGE = {
  company_matching: {
    inputTokens: 2000,   // Typical prompt with ~20 companies
    outputTokens: 800    // Typical JSON response
  },
  industry_detection: {
    inputTokens: 3500,   // Larger contact dataset with job titles
    outputTokens: 1200   // More complex analysis output
  },
  relationship_detection: {
    inputTokens: 4500,   // Contact data with notes/messages
    outputTokens: 1500   // Detailed relationship analysis
  }
};

/**
 * Estimate cost for an operation before it runs (for budget checking)
 */
export function estimateOperationCost(modelId, operations = []) {
  const pricing = GEMINI_PRICING[modelId];
  if (!pricing) {
    console.warn(`⚠️ [Pricing] No pricing found for model: ${modelId}`);
    return 0.001;
  }
  
  let totalEstimatedCost = 0;
  
  operations.forEach(operation => {
    const tokenUsage = ESTIMATED_TOKEN_USAGE[operation];
    if (tokenUsage) {
      const inputCost = (tokenUsage.inputTokens / 1000000) * pricing.inputPrice;
      const outputCost = (tokenUsage.outputTokens / 1000000) * pricing.outputPrice;
      totalEstimatedCost += inputCost + outputCost;
    }
  });
  
  return Math.max(totalEstimatedCost, 0.0001); // Minimum estimate
}

/**
 * Get pricing information for a specific model
 */
export function getModelPricing(modelId) {
  return GEMINI_PRICING[modelId] || null;
}

/**
 * Get all available models and their pricing
 */
export function getAllModelPricing() {
  return GEMINI_PRICING;
}

/**
 * Compare costs between different models for the same operation
 */
export function compareCosts(operations, models = ['gemini-2.0-flash', 'gemini-2.5-pro']) {
  const comparison = {};
  
  models.forEach(modelId => {
    comparison[modelId] = {
      estimatedCost: estimateOperationCost(modelId, operations),
      pricing: getModelPricing(modelId)
    };
  });
  
  return comparison;
}

/**
 * Calculate cost per operation for reporting
 */
export function calculateCostPerOperation(totalCost, operationCount) {
  if (operationCount === 0) return 0;
  return totalCost / operationCount;
}

/**
 * Format cost for display (server-side utility)
 */
export function formatCost(cost) {
  if (cost === 0) return '$0.00';
  if (cost === -1) return 'Unlimited';
  
  if (cost < 0.001) {
    return `$${(cost * 1000000).toFixed(1)}µ`; // Show as microcents
  } else if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  } else {
    return `$${cost.toFixed(4)}`;
  }
}