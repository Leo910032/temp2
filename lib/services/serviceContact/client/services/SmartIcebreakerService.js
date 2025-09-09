// lib/services/serviceContact/client/services/SmartIcebreakerService.js
// Client-side service for smart icebreaker generation

"use client"
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';

export class SmartIcebreakerClientService extends BaseContactService {
  constructor() {
    super('SmartIcebreakerClientService');
  }

  /**
   * Generate smart icebreakers with real-time web search
   */
  async generateSmartIcebreakers(contactId, strategicQuestions, options = {}) {
    const operationId = `client_icebreaker_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`🚀 [SmartIcebreakerClient] [${operationId}] Starting generation for contact: ${contactId}`);
    
    try {
      if (!contactId) {
        throw new Error('Contact ID is required');
      }

      if (!strategicQuestions || !Array.isArray(strategicQuestions) || strategicQuestions.length === 0) {
        throw new Error('Strategic questions are required');
      }

      const {
        trackCosts = true,
        searchProvider = 'serpapi',
        maxSearches = 3,
        useCache = false // Smart icebreakers should always be fresh
      } = options;

      console.log(`🚀 [SmartIcebreakerClient] [${operationId}] Options:`, {
        trackCosts,
        searchProvider,
        maxSearches,
        questionsCount: strategicQuestions.length
      });

      // Don't cache smart icebreakers - they should always be fresh
      const cacheKey = `smart_icebreaker_${contactId}_${Date.now()}`;

      const result = await this.cachedRequest(
        cacheKey,
        async () => {
          const response = await ContactApiClient.post('/api/user/contacts/smart-icebreakers', {
            contactId,
            strategicQuestions,
            options: {
              trackCosts,
              searchProvider,
              maxSearches
            }
          });

          console.log(`✅ [SmartIcebreakerClient] [${operationId}] Generation successful:`, {
            icebreakersCount: response.icebreakers?.length || 0,
            totalCost: response.costs?.total || 0,
            searchSuccess: response.searchSummary?.successfulSearches || 0,
            searchFailed: response.searchSummary?.failedSearches || 0
          });

          return response;
        },
        'smartIcebreaker',
        useCache ? 300000 : 0 // 5 minutes cache if explicitly requested, otherwise no cache
      );

      return result;

    } catch (error) {
      console.error(`❌ [SmartIcebreakerClient] [${operationId}] Generation failed:`, error);
      
      // Handle specific error types
      if (error.status === 403) {
        throw new Error('Smart icebreaker generation requires Business subscription or higher');
      }
      
      if (error.message?.includes('budget exceeded')) {
        throw new Error('Monthly AI budget limit reached. Upgrade your plan to continue using smart icebreakers.');
      }
      
      if (error.message?.includes('runs exceeded')) {
        throw new Error('Monthly AI runs limit reached. Upgrade your plan for more smart icebreaker generations.');
      }

      throw new Error(error.message || 'Smart icebreaker generation failed');
    }
  }

  /**
   * Get usage statistics for smart icebreakers
   */
  async getUsageStats(timeframe = '30d') {
    return this.cachedRequest(
      `icebreaker_stats_${timeframe}`,
      () => ContactApiClient.get(`/api/user/contacts/smart-icebreakers?timeframe=${timeframe}`),
      'smartIcebreakerStats',
      300000 // Cache for 5 minutes
    );
  }

  /**
   * Estimate cost for smart icebreaker generation
   */
  estimateCost(searchCount = 3, searchProvider = 'serpapi') {
    const searchCosts = {
      'serpapi': 5.00 / 1000,
      'brave_search': 2.50 / 1000,
      'google_search': 5.00 / 1000
    };

    const geminiCosts = {
      inputPrice: 0.30, // per 1M tokens
      outputPrice: 2.50  // per 1M tokens
    };

    // Calculate search costs
    const searchCost = searchCount * (searchCosts[searchProvider] || searchCosts['serpapi']);

    // Estimate LLM costs (larger prompt with search results)
    const estimatedInputTokens = 2000; // Larger due to search results
    const estimatedOutputTokens = 300;
    
    const llmCost = (estimatedInputTokens / 1000000) * geminiCosts.inputPrice +
                    (estimatedOutputTokens / 1000000) * geminiCosts.outputPrice;

    const totalCost = searchCost + llmCost;

    return {
      searchCost,
      llmCost,
      totalCost,
      breakdown: {
        searches: searchCount,
        searchProvider,
        estimatedInputTokens,
        estimatedOutputTokens
      }
    };
  }

  /**
   * Check if smart icebreakers are available for current subscription
   */
  canUseSmartIcebreakers(subscriptionLevel) {
    return ['business', 'enterprise'].includes(subscriptionLevel?.toLowerCase());
  }

  /**
   * Get upgrade message for users who can't access smart icebreakers
   */
  getUpgradeMessage(subscriptionLevel) {
    const currentLevel = subscriptionLevel?.toLowerCase() || 'base';
    
    const messages = {
      base: 'Upgrade to Business to unlock Smart Icebreakers with real-time web research',
      pro: 'Upgrade to Business to unlock Smart Icebreakers with real-time web research',
      premium: 'Upgrade to Business to unlock Smart Icebreakers with real-time web research'
    };

    return messages[currentLevel] || 'Smart Icebreakers require Business subscription or higher';
  }

  /**
   * Format icebreaker for display
   */
  formatIcebreaker(icebreaker) {
    return {
      ...icebreaker,
      displayText: icebreaker.text,
      categoryLabel: this.getCategoryLabel(icebreaker.category),
      confidenceColor: this.getConfidenceColor(icebreaker.confidence),
      confidenceLabel: this.getConfidenceLabel(icebreaker.confidence)
    };
  }

  /**
   * Get human-readable category labels
   */
  getCategoryLabel(category) {
    const labels = {
      'company_news': 'Company Updates',
      'industry_trends': 'Industry Trends',
      'personal_updates': 'Professional Updates',
      'general': 'General',
      'fallback': 'General'
    };
    
    return labels[category] || 'Professional';
  }

  /**
   * Get confidence level colors for UI
   */
  getConfidenceColor(confidence) {
    if (confidence >= 8) return 'text-green-600';
    if (confidence >= 6) return 'text-blue-600';
    if (confidence >= 4) return 'text-yellow-600';
    return 'text-orange-600';
  }

  /**
   * Get confidence level labels
   */
  getConfidenceLabel(confidence) {
    if (confidence >= 9) return 'Excellent';
    if (confidence >= 7) return 'Strong';
    if (confidence >= 5) return 'Good';
    if (confidence >= 3) return 'Fair';
    return 'Basic';
  }

  /**
   * Format costs for display
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
   * Clear smart icebreaker cache
   */
  clearCache() {
    this.invalidateCache(['smartIcebreaker', 'smartIcebreakerStats']);
  }

  /**
   * Validate strategic questions format
   */
  validateStrategicQuestions(questions) {
    if (!Array.isArray(questions)) {
      return { valid: false, error: 'Questions must be an array' };
    }

    if (questions.length === 0) {
      return { valid: false, error: 'At least one question is required' };
    }

    if (questions.length > 5) {
      return { valid: false, error: 'Maximum 5 questions allowed' };
    }

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      if (!question.question || typeof question.question !== 'string') {
        return { valid: false, error: `Question ${i + 1}: 'question' field is required` };
      }
      
      if (!question.searchQuery || typeof question.searchQuery !== 'string') {
        return { valid: false, error: `Question ${i + 1}: 'searchQuery' field is required` };
      }
      
      if (!question.category || typeof question.category !== 'string') {
        return { valid: false, error: `Question ${i + 1}: 'category' field is required` };
      }
    }

    return { valid: true };
  }

  /**
   * Generate example strategic questions for testing
   */
  generateExampleQuestions(contact) {
    return [
      {
        question: `What recent announcements has ${contact.company || 'the company'} made?`,
        searchQuery: `"${contact.company}" recent news announcements 2024`,
        category: 'company_news'
      },
      {
        question: 'What are the latest trends in their industry?',
        searchQuery: `technology industry trends 2024`,
        category: 'industry_trends'
      },
      {
        question: `Has ${contact.name} been mentioned in recent professional news?`,
        searchQuery: `"${contact.name}" "${contact.company}" recent news`,
        category: 'personal_updates'
      }
    ];
  }

  /**
   * Get feature analytics
   */
  getFeatureAnalytics() {
    return {
      estimatedCostPerGeneration: this.estimateCost().totalCost,
      averageSearches: 3,
      averageGenerationTime: '15-30 seconds',
      supportedProviders: ['serpapi', 'brave_search'],
      maxSearchesPerGeneration: 5,
      requiredSubscription: 'business'
    };
  }
}