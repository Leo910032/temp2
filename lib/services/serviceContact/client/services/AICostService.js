// lib/services/serviceContact/client/services/AICostService.js
// Client-side service for AI cost tracking and estimation - FIXED

"use client"
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';
import { 
  getAIFeaturesForLevel, 
  canUseDeepAnalysis,
  CONTACT_LIMITS 
} from '../constants/contactConstants';

export class AICostService extends BaseContactService {
  constructor() {
    super('AICostService');
  }

  /**
   * Client-side pricing information for estimates
   */
  static CLIENT_PRICING = {
    'gemini-2.5-flash': {
      inputPrice: 0.30,
      outputPrice: 2.50,
      displayName: 'Gemini 2.5 flash',
      tier: 'standard'
    },
    'gemini-2.5-pro': {
      inputPrice: 1.25,
      outputPrice: 10.00,
      displayName: 'Gemini 2.5 Pro',
      tier: 'premium'
    }
  };

  /**
   * Get user's current AI usage information
   */
  async getUsageInfo() {
    return this.cachedRequest(
      'usage',
      () => ContactApiClient.get('/api/user/contacts/ai-usage'),
      'aiUsage',
      300000 // Cache for 5 minutes
    );
  }

  /**
   * Get cost estimate for an AI operation - FIXED
   */
  async estimateOperationCost(subscriptionLevel, options = {}) {
    try {
      console.log('[AICostService] Requesting estimate for:', { subscriptionLevel, options });
      
      const response = await this.cachedRequest(
        `estimate_${subscriptionLevel}_${JSON.stringify(options)}`,
        async () => {
          const apiResponse = await ContactApiClient.post('/api/user/contacts/ai-usage', {
            action: 'estimate',
            options
          });
          
          console.log('[AICostService] Raw API response:', apiResponse);
          
          // FIXED: Extract the estimate object from the response
          if (apiResponse && apiResponse.estimate) {
            return apiResponse.estimate;
          } else {
            console.warn('[AICostService] No estimate in response, using fallback');
            return {
              estimatedCost: 0.0001,
              featuresEnabled: [],
              useDeepAnalysis: false,
              model: 'gemini-2.5-flash'
            };
          }
        },
        'aiEstimate',
        60000 // Cache for 1 minute
      );

      console.log('[AICostService] Final estimate result:', response);
      return response;

    } catch (error) {
      console.error('[AICostService] Error getting cost estimate:', error);
      
      // Fallback estimate to prevent UI from breaking
      return {
        estimatedCost: 0.0001,
        featuresEnabled: [],
        useDeepAnalysis: options.useDeepAnalysis || false,
        model: options.useDeepAnalysis ? 'gemini-2.5-pro' : 'gemini-2.5-flash',
        error: error.message
      };
    }
  }

  /**
   * Client-side cost estimation (for UI updates)
   */
  estimateUIOperationCost(modelId, operationCount = 1) {
    const pricing = AICostService.CLIENT_PRICING[modelId];
    if (!pricing) return 0.001;
    
    // Rough estimate based on typical usage
    const avgInputTokens = 3000 * operationCount;
    const avgOutputTokens = 1000 * operationCount;
    
    const inputCost = (avgInputTokens / 1000000) * pricing.inputPrice;
    const outputCost = (avgOutputTokens / 1000000) * pricing.outputPrice;
    
    return Math.max(inputCost + outputCost, 0.0001);
  }

  /**
   * Client-side cost estimation (faster, for UI updates) - IMPROVED
   */
  getQuickCostEstimate(subscriptionLevel, options = {}) {
    console.log('[AICostService] Quick estimate for:', { subscriptionLevel, options });
    
    const availableFeatures = getAIFeaturesForLevel(subscriptionLevel);
    const useDeepAnalysis = options.useDeepAnalysis && canUseDeepAnalysis(subscriptionLevel);
    const modelId = useDeepAnalysis ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    
    let operationCount = 0;
    let featuresEnabled = [];

    // Count enabled features based on options
    if (options.useSmartCompanyMatching && availableFeatures.smartCompanyMatching) {
      operationCount++;
      featuresEnabled.push('Smart Company Matching');
    }

    if (options.useIndustryDetection && availableFeatures.industryDetection) {
      operationCount++;
      featuresEnabled.push('Industry Detection');
    }

    if (options.useRelationshipDetection && availableFeatures.relationshipDetection) {
      operationCount++;
      featuresEnabled.push('Relationship Detection');
    }

    // Always count at least 1 operation for basic grouping
    if (operationCount === 0) {
      operationCount = 1;
    }

    const estimatedCost = this.estimateUIOperationCost(modelId, operationCount);

    const result = {
      estimatedCost,
      featuresEnabled,
      useDeepAnalysis,
      model: modelId,
      operationCount
    };

    console.log('[AICostService] Quick estimate result:', result);
    return result;
  }

  /**
   * Check if user can afford an operation
   */
  async canAffordOperation(subscriptionLevel, options = {}) {
    try {
      const response = await ContactApiClient.post('/api/user/contacts/ai-usage', {
        action: 'estimate',
        options
      });
      
      return response.canAfford || false;
    } catch (error) {
      console.error('Error checking affordability:', error);
      return false;
    }
  }

  /**
   * Get subscription limits for AI usage
   */
  getSubscriptionLimits(subscriptionLevel) {
    const level = subscriptionLevel?.toLowerCase() || 'base';
    const limits = CONTACT_LIMITS[level] || CONTACT_LIMITS.base;
    
    return {
      maxCostPerMonth: limits.aiCostBudget,
      maxRunsPerMonth: limits.maxAiRunsPerMonth,
      deepAnalysisEnabled: limits.deepAnalysisEnabled,
      isUnlimited: limits.aiCostBudget === -1
    };
  }

  /**
   * Format cost for display
   */
  formatCost(cost) {
    if (cost === undefined || cost === null || isNaN(cost)) {
      return 'Calculating...';
    }
    
    if (cost === 0) return 'Free';
    if (cost === -1) return 'Unlimited';
    
    if (cost < 0.001) {
      return `$${(cost * 1000000).toFixed(1)}µ`; // Show as microcents
    } else if (cost < 0.01) {
      return `$${cost.toFixed(6)}`;
    } else {
      return `$${cost.toFixed(4)}`;
    }
  }

  /**
   * Get usage percentage with color coding
   */
  getUsageStatus(currentUsage, limit) {
    if (limit === -1) return { percentage: 0, status: 'unlimited', color: 'green' };
    if (limit === 0) return { percentage: 100, status: 'no_access', color: 'gray' };
    
    const percentage = (currentUsage / limit) * 100;
    
    let status, color;
    if (percentage < 50) {
      status = 'good';
      color = 'green';
    } else if (percentage < 80) {
      status = 'moderate';
      color = 'yellow';
    } else if (percentage < 95) {
      status = 'high';
      color = 'orange';
    } else {
      status = 'critical';
      color = 'red';
    }

    return { percentage: Math.min(percentage, 100), status, color };
  }

  /**
   * Get upgrade recommendations based on usage
   */
  getUpgradeRecommendations(usageInfo) {
    const { currentMonth, subscriptionLevel } = usageInfo;
    const recommendations = [];

    // Check if approaching limits
    if (currentMonth.percentageUsed > 80 && subscriptionLevel !== 'enterprise') {
      recommendations.push({
        type: 'usage_limit',
        priority: 'high',
        title: 'Approaching AI Usage Limits',
        description: `You've used ${currentMonth.percentageUsed.toFixed(0)}% of your monthly AI budget. Consider upgrading for more capacity.`,
        suggestedPlan: this.getNextTier(subscriptionLevel)
      });
    }

    // Check for feature access
    const availableFeatures = getAIFeaturesForLevel(subscriptionLevel);
    
    if (!availableFeatures.industryDetection && subscriptionLevel !== 'enterprise') {
      recommendations.push({
        type: 'feature_access',
        priority: 'medium',
        title: 'Unlock Industry Detection',
        description: 'Group your contacts by business domain with our Industry Detection feature.',
        suggestedPlan: 'Premium'
      });
    }

    if (!availableFeatures.relationshipDetection && subscriptionLevel !== 'enterprise') {
      recommendations.push({
        type: 'feature_access',
        priority: 'medium',
        title: 'Unlock Relationship Detection',
        description: 'Find business relationships and partnerships with our most advanced AI.',
        suggestedPlan: 'Business'
      });
    }

    if (!canUseDeepAnalysis(subscriptionLevel) && subscriptionLevel !== 'enterprise') {
      recommendations.push({
        type: 'premium_feature',
        priority: 'low',
        title: 'Deep Strategic Analysis',
        description: 'Unlock our most powerful AI model for complex strategic insights.',
        suggestedPlan: 'Enterprise'
      });
    }

    return recommendations;
  }

  /**
   * Helper to get next subscription tier
   */
  getNextTier(currentTier) {
    const tiers = ['base', 'pro', 'premium', 'business', 'enterprise'];
    const currentIndex = tiers.indexOf(currentTier.toLowerCase());
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : 'enterprise';
  }

  /**
   * Get cost comparison between tiers
   */
  getCostComparison() {
    return {
      pro: {
        monthlyCost: 15,
        aiCostBudget: 0.01,
        estimatedOperations: '~10 AI runs',
        features: ['Smart Company Matching']
      },
      premium: {
        monthlyCost: 35,
        aiCostBudget: 0.05,
        estimatedOperations: '~50 AI runs',
        features: ['Smart Company Matching', 'Industry Detection']
      },
      business: {
        monthlyCost: 99,
        aiCostBudget: 0.20,
        estimatedOperations: '~200 AI runs',
        features: ['All Standard Features', 'Relationship Detection']
      },
      enterprise: {
        monthlyCost: 'Custom',
        aiCostBudget: 'Unlimited',
        estimatedOperations: 'Unlimited',
        features: ['All Features', 'Deep Strategic Analysis', 'Premium AI Models']
      }
    };
  }

  /**
   * Clear cached usage data (call after operations)
   */
  clearUsageCache() {
    this.invalidateCache(['usage', 'aiUsage', 'aiEstimate']);
  }
}