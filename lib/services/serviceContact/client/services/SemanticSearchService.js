// lib/services/serviceContact/client/services/SemanticSearchService.js - WITH ADVANCED LOGGING
"use client"
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';
import { AdvancedLogger, PineconeLogger, GeminiLogger, FlowLogger } from '@/lib/services/logging/advancedLogger';

// ACCURATE PRICING BASED ON PROVIDED DATA
const PINECONE_PRICING = {
  STORAGE_PER_GB_MONTHLY: 0.286,
  WRITE_COST_PER_1K_VECTORS: 0.07,
  QUERY_COST_PER_1K_VECTORS: 0.0675,
  WRITE_PER_VECTOR: 0.00007,
  QUERY_PER_VECTOR: 0.0000675,
  METADATA_SIZE_BYTES: 512,
  VECTOR_DIMENSIONS: 768,
};

const GEMINI_MODELS = {
  EMBEDDING: {
    id: 'text-embedding-004',
    pricePerMillionTokens: 0.15,
  },
  GENERATION_STANDARD: {
    id: 'gemini-2.5-flash',
    inputPricePerMillionTokens: 0.30,
    outputPricePerMillionTokens: 2.50,
    longContextInputPrice: 0.30,
    longContextOutputPrice: 2.50,
  },
  GENERATION_PREMIUM: {
    id: 'gemini-2.5-pro',
    inputPricePerMillionTokens: 1.25,
    outputPricePerMillionTokens: 10.00,
    longContextInputPrice: 2.50,
    longContextOutputPrice: 15.00,
  }
};

export class SemanticSearchService extends BaseContactService {
  constructor() {
    super('SemanticSearchService');
  }

  /**
   * Calculate exact Pinecone costs based on operations
   */
  static calculatePineconeCost(operations = {}) {
    const {
      vectorsStored = 0,
      vectorsWritten = 0,
      queriesPerformed = 0,
      storageGB = 0
    } = operations;

    const costs = {
      storage: storageGB * PINECONE_PRICING.STORAGE_PER_GB_MONTHLY,
      writes: vectorsWritten * PINECONE_PRICING.WRITE_PER_VECTOR,
      queries: queriesPerformed * PINECONE_PRICING.QUERY_PER_VECTOR,
      total: 0
    };

    costs.total = costs.storage + costs.writes + costs.queries;

    AdvancedLogger.debug('Cost', 'pinecone_calculation', {
      operations,
      costs: {
        storage: costs.storage.toFixed(6),
        writes: costs.writes.toFixed(6),
        queries: costs.queries.toFixed(6),
        total: costs.total.toFixed(6)
      }
    });

    return costs;
  }

  /**
   * Calculate exact Gemini costs based on token usage
   */
  static calculateGeminiCost(tokenUsage = {}, modelType = 'embedding') {
    const {
      inputTokens = 0,
      outputTokens = 0,
      isLongContext = false
    } = tokenUsage;

    let costs = { input: 0, output: 0, total: 0 };

    if (modelType === 'embedding') {
      costs.input = (inputTokens / 1000000) * GEMINI_MODELS.EMBEDDING.pricePerMillionTokens;
      costs.output = 0;
    } else {
      const model = modelType === 'premium' ? GEMINI_MODELS.GENERATION_PREMIUM : GEMINI_MODELS.GENERATION_STANDARD;
      
      const inputPrice = isLongContext ? model.longContextInputPrice : model.inputPricePerMillionTokens;
      const outputPrice = isLongContext ? model.longContextOutputPrice : model.outputPricePerMillionTokens;
      
      costs.input = (inputTokens / 1000000) * inputPrice;
      costs.output = (outputTokens / 1000000) * outputPrice;
    }

    costs.total = costs.input + costs.output;

    AdvancedLogger.debug('Cost', 'gemini_calculation', {
      modelType,
      tokenUsage,
      costs: {
        input: costs.input.toFixed(6),
        output: costs.output.toFixed(6),
        total: costs.total.toFixed(6)
      }
    });

    return costs;
  }

  /**
   * Estimate costs before performing search operation
   */
  static async estimateSearchCost(query, options = {}) {
    const flowLogger = new FlowLogger('estimate_search_cost');
    
    try {
      const { maxResults = 10, enhanceResults = true, subscriptionLevel = 'premium' } = options;
      
      flowLogger.logStep('estimation_start', {
        queryLength: query.length,
        maxResults,
        enhanceResults,
        subscriptionLevel
      });
      
      // Estimate tokens in query (rough approximation: 1 token ≈ 4 characters)
      const estimatedTokens = Math.ceil(query.length / 4);
      
      let totalCost = 0;
      const breakdown = {
        embedding: 0,
        vectorSearch: 0,
        aiEnhancement: 0,
        total: 0
      };

      // Cost for generating embedding from query
      const embeddingCost = SemanticSearchService.calculateGeminiCost(
        { inputTokens: estimatedTokens },
        'embedding'
      );
      breakdown.embedding = embeddingCost.total;

      // Cost for Pinecone vector search
      const pineconeSearchCost = SemanticSearchService.calculatePineconeCost({
        queriesPerformed: 1
      });
      breakdown.vectorSearch = pineconeSearchCost.total;

      // Cost for AI enhancement (Business+ only)
      if (enhanceResults && (subscriptionLevel === 'business' || subscriptionLevel === 'enterprise')) {
        const contextTokens = estimatedTokens + (maxResults * 200);
        const estimatedOutputTokens = maxResults * 50;
        
        const enhancementCost = SemanticSearchService.calculateGeminiCost(
          { 
            inputTokens: contextTokens, 
            outputTokens: estimatedOutputTokens,
            isLongContext: contextTokens > 200000
          },
          subscriptionLevel === 'enterprise' ? 'premium' : 'standard'
        );
        breakdown.aiEnhancement = enhancementCost.total;
      }

      breakdown.total = breakdown.embedding + breakdown.vectorSearch + breakdown.aiEnhancement;

      flowLogger.complete({
        success: true,
        costBreakdown: breakdown
      });

      AdvancedLogger.info('Cost', 'search_estimate', breakdown);

      return breakdown;
    } catch (error) {
      flowLogger.logError('estimation_failed', error);
      throw error;
    }
  }

  /**
   * Enhanced search with integrated cost tracking and detailed logging
   */
  static async search(query, options = {}) {
    const flowLogger = new FlowLogger('semantic_search', options.userId);
    const startTime = Date.now();
    
    try {
      const { userId, subscriptionLevel = 'premium' } = options;
      
      flowLogger.logStep('search_start', {
        queryLength: query.length,
        queryPreview: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        options: {
          userId: !!userId,
          subscriptionLevel,
          maxResults: options.maxResults || 10,
          enhanceResults: options.enhanceResults !== false
        }
      });

      AdvancedLogger.info('Search', 'semantic_search_start', {
        queryLength: query.length,
        subscriptionLevel,
        userId
      });
      
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        const error = new Error('Search query is required');
        flowLogger.logError('invalid_query', error);
        throw error;
      }

      // Step 1: Estimate costs
      flowLogger.logStep('cost_estimation', { message: 'Estimating operation costs' });
      const costEstimate = await SemanticSearchService.estimateSearchCost(query, options);
      
      flowLogger.logStep('cost_estimated', {
        estimatedCost: costEstimate.total,
        breakdown: costEstimate
      });

      // Step 2: Check if user can afford operation
      if (userId) {
        flowLogger.logStep('affordability_check', { message: 'Checking user budget' });
        
        const affordabilityCheck = await ContactApiClient.post('/api/user/contacts/cost-check', {
          estimatedCost: costEstimate.total,
          requireRuns: 1,
          feature: 'semantic_search'
        });

        flowLogger.logStep('affordability_result', {
          canAfford: affordabilityCheck.canAfford,
          reason: affordabilityCheck.reason
        });

        if (!affordabilityCheck.canAfford) {
          const error = new Error(`Search quota exceeded: ${affordabilityCheck.reason}`);
          flowLogger.logError('budget_exceeded', error);
          AdvancedLogger.warn('Search', 'budget_exceeded', {
            userId,
            estimatedCost: costEstimate.total,
            reason: affordabilityCheck.reason
          });
          throw error;
        }
      }

      const { maxResults = 10, includeMetadata = true, enhanceResults = true } = options;

      // Step 3: Perform vector search (Job #1 - AI Librarian)
      flowLogger.logStep('vector_search_start', {
        message: 'Starting vector search with AI Librarian',
        parameters: { maxResults, includeMetadata, trackCosts: true }
      });

      AdvancedLogger.info('Search', 'vector_search_start', {
        query: query.substring(0, 100),
        maxResults,
        userId
      });
      
      const vectorSearchResponse = await ContactApiClient.post('/api/user/contacts/semantic-search', {
        query: query.trim(),
        maxResults,
        includeMetadata,
        trackCosts: true
      });

      const vectorResults = vectorSearchResponse.results || vectorSearchResponse || [];
      const serverMetadata = vectorSearchResponse.searchMetadata || {};

      flowLogger.logStep('vector_search_complete', {
        resultsCount: vectorResults.length,
        hasServerMetadata: !!serverMetadata,
        serverCosts: serverMetadata.costs
      });

      AdvancedLogger.info('Search', 'vector_search_complete', {
        resultsFound: vectorResults.length,
        serverCosts: serverMetadata.costs,
        userId
      });

      let actualCosts = {
        embedding: 0,
        vectorSearch: 0,
        aiEnhancement: 0,
        total: 0
      };

      // Extract actual costs from server response
      if (serverMetadata.costs) {
        actualCosts.embedding = serverMetadata.costs.embedding || 0;
        actualCosts.vectorSearch = serverMetadata.costs.vectorSearch || 0;
        
        flowLogger.logStep('server_costs_extracted', {
          embedding: actualCosts.embedding,
          vectorSearch: actualCosts.vectorSearch
        });
      }

      // Step 4: AI Enhancement for Business+ users (Job #2 - AI Researcher)
      let enhancedResults = vectorResults;
      
      if (enhanceResults && vectorResults.length > 0 && SemanticSearchService.canUseAIResearcher(vectorResults[0], subscriptionLevel)) {
        flowLogger.logStep('ai_enhancement_start', {
          message: 'Starting AI Researcher enhancement',
          vectorResultsCount: vectorResults.length,
          subscriptionLevel
        });

        AdvancedLogger.info('Search', 'ai_enhancement_start', {
          vectorResultsCount: vectorResults.length,
          subscriptionLevel,
          userId
        });
        
        const enhancementStartTime = Date.now();
        
        try {
          enhancedResults = await SemanticSearchService.enhanceResultsWithAI(query, vectorResults, {
            subscriptionLevel,
            trackCosts: true
          });
          
          // Extract AI enhancement costs
          if (enhancedResults.searchMetadata?.costs?.aiEnhancement) {
            actualCosts.aiEnhancement = enhancedResults.searchMetadata.costs.aiEnhancement;
          }
          
          const enhancementDuration = Date.now() - enhancementStartTime;
          
          flowLogger.logStep('ai_enhancement_complete', {
            duration: enhancementDuration,
            enhancementCost: actualCosts.aiEnhancement,
            resultsCount: Array.isArray(enhancedResults) ? enhancedResults.length : enhancedResults.results?.length
          });

          AdvancedLogger.info('Search', 'ai_enhancement_complete', {
            duration: enhancementDuration,
            cost: actualCosts.aiEnhancement,
            userId
          });
          
        } catch (enhancementError) {
          flowLogger.logError('ai_enhancement_failed', enhancementError);
          
          AdvancedLogger.error('Search', 'ai_enhancement_failed', {
            error: enhancementError.message,
            userId
          });
          // Continue with basic results if enhancement fails
        }
      }

      // Step 5: Calculate total actual costs
      actualCosts.total = actualCosts.embedding + actualCosts.vectorSearch + actualCosts.aiEnhancement;

      flowLogger.logStep('cost_totaling', {
        actualCosts,
        costEstimate,
        accuracy: Math.abs(costEstimate.total - actualCosts.total) / costEstimate.total
      });

      // Step 6: Record usage in cost tracking system
      if (userId && actualCosts.total > 0) {
        flowLogger.logStep('usage_recording', { message: 'Recording usage for cost tracking' });
        
        try {
          await ContactApiClient.post('/api/user/contacts/record-usage', {
            cost: actualCosts.total,
            model: 'semantic_search_combined',
            feature: 'semantic_search',
            metadata: {
              query: query.substring(0, 100),
              resultsCount: enhancedResults.length,
              searchDurationMs: Date.now() - startTime,
              enhancementUsed: actualCosts.aiEnhancement > 0,
              subscriptionLevel,
              costBreakdown: actualCosts,
              estimateVsActual: {
                estimated: costEstimate.total,
                actual: actualCosts.total,
                accuracy: Math.abs(costEstimate.total - actualCosts.total) / costEstimate.total
              }
            }
          });
          
          flowLogger.logStep('usage_recorded', {
            cost: actualCosts.total,
            accuracy: Math.abs(costEstimate.total - actualCosts.total) / costEstimate.total
          });

          AdvancedLogger.info('Cost', 'usage_recorded', {
            userId,
            cost: actualCosts.total,
            feature: 'semantic_search'
          });
          
        } catch (trackingError) {
          flowLogger.logError('usage_recording_failed', trackingError);
          
          AdvancedLogger.error('Cost', 'usage_recording_failed', {
            error: trackingError.message,
            userId,
            cost: actualCosts.total
          });
          // Don't fail the search if cost tracking fails
        }
      }

      // Step 7: Prepare final results
      const finalResults = Array.isArray(enhancedResults) ? enhancedResults : enhancedResults.results || [];
      
      const searchMetadata = {
        query: query.substring(0, 100),
        totalResults: finalResults.length,
        searchDurationMs: Date.now() - startTime,
        costs: actualCosts,
        costEstimate: costEstimate,
        subscriptionLevel,
        enhancementLevel: actualCosts.aiEnhancement > 0 ? 'ai_powered' : 'basic',
        timestamp: new Date().toISOString()
      };

      flowLogger.complete({
        success: true,
        resultsCount: finalResults.length,
        totalCost: actualCosts.total,
        duration: Date.now() - startTime,
        enhancementUsed: actualCosts.aiEnhancement > 0
      });

      AdvancedLogger.info('Search', 'semantic_search_complete', {
        resultsCount: finalResults.length,
        totalCost: actualCosts.total,
        duration: Date.now() - startTime,
        userId
      });

      return {
        results: finalResults,
        searchMetadata
      };

    } catch (error) {
      flowLogger.logError('search_failed', error);
      
      AdvancedLogger.error('Search', 'semantic_search_failed', {
        error: error.message,
        query: query.substring(0, 100),
        userId: options.userId
      });
      
      // Handle specific error cases
      if (error.status === 403) {
        throw new Error('Semantic search requires Premium subscription or higher');
      }
      
      if (error.status === 429) {
        throw new Error('Search quota exceeded. Please try again later.');
      }
      
      if (error.status === 503) {
        throw new Error('Search service temporarily unavailable. Please try again in a moment.');
      }

      throw new Error(error.message || 'Search failed. Please try again.');
    }
  }

  /**
   * Enhanced AI result enhancement with detailed logging
   */
  static async enhanceResultsWithAI(originalQuery, vectorResults, options = {}) {
    const flowLogger = new FlowLogger('ai_enhancement');
    const { subscriptionLevel = 'business', trackCosts = false } = options;
    
    try {
      flowLogger.logStep('enhancement_start', {
        originalQuery: originalQuery.substring(0, 100) + (originalQuery.length > 100 ? '...' : ''),
        vectorResultsCount: vectorResults.length,
        subscriptionLevel,
        trackCosts
      });

      AdvancedLogger.info('AI', 'enhancement_start', {
        queryLength: originalQuery.length,
        vectorResultsCount: vectorResults.length,
        subscriptionLevel
      });

      const enhancementPayload = {
        originalQuery,
        contacts: vectorResults.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          company: contact.company,
          notes: contact.notes,
          message: contact.message,
          vectorScore: contact._vectorScore
        })),
        subscriptionLevel,
        trackCosts
      };

      flowLogger.logStep('payload_prepared', {
        contactsCount: enhancementPayload.contacts.length,
        payloadSize: JSON.stringify(enhancementPayload).length
      });

      // Call AI enhancement endpoint
      const aiAnalysis = await ContactApiClient.post('/api/user/contacts/ai-enhance-results', enhancementPayload);

      flowLogger.logStep('ai_analysis_complete', {
        insightsCount: aiAnalysis.insights?.length || 0,
        costs: aiAnalysis.costs,
        metadata: aiAnalysis.metadata
      });

      AdvancedLogger.info('AI', 'enhancement_complete', {
        insightsGenerated: aiAnalysis.insights?.length || 0,
        costs: aiAnalysis.costs
      });

      // Merge AI insights back into the contacts
      const enhancedContacts = vectorResults.map(contact => {
        const aiInsight = aiAnalysis.insights?.find(insight => insight.contactId === contact.id);
        
        return {
          ...contact,
          searchMetadata: {
            ...contact.searchMetadata,
            enhancementLevel: 'ai_powered',
            aiAnalysis: aiInsight ? {
              matchExplanation: aiInsight.explanation,
              relevanceFactors: aiInsight.factors,
              actionSuggestions: aiInsight.suggestions,
              confidenceScore: aiInsight.confidence
            } : null
          }
        };
      });
  // ✅ FIX: Sort the results by AI confidence score in descending order
      // This puts the highest confidence results at the top.
      enhancedContacts.sort((a, b) => {
        const confidenceA = a.searchMetadata?.aiAnalysis?.confidenceScore || 0;
        const confidenceB = b.searchMetadata?.aiAnalysis?.confidenceScore || 0;
        return confidenceB - confidenceA; // Sort descending (9, 8, 7...)
      });

      flowLogger.complete({
        success: true,
        enhancedContactsCount: enhancedContacts.length,
        contactsWithInsights: enhancedContacts.filter(c => c.searchMetadata?.aiAnalysis).length
      });

      // Return enhanced results with cost metadata
      return {
        results: enhancedContacts,
        searchMetadata: {
          costs: aiAnalysis.costs || {},
          metadata: aiAnalysis.metadata || {}
        }
      };

    } catch (error) {
      flowLogger.logError('enhancement_failed', error);
      
      AdvancedLogger.error('AI', 'enhancement_failed', {
        error: error.message,
        vectorResultsCount: vectorResults.length
      });
      
      // Graceful fallback - return vector results without AI enhancement
      return {
        results: vectorResults.map(contact => ({
          ...contact,
          searchMetadata: {
            ...contact.searchMetadata,
            enhancementLevel: 'basic_fallback',
            aiAnalysis: null,
            enhancementError: 'AI analysis temporarily unavailable'
          }
        })),
        searchMetadata: {
          costs: { aiEnhancement: 0 }
        }
      };
    }
  }

  /**
   * Get detailed cost breakdown for transparency
   */
  static async getSearchCostAnalytics(userId, timeframe = '30d') {
    const flowLogger = new FlowLogger('cost_analytics');
    
    try {
      flowLogger.logStep('analytics_request', { userId, timeframe });
      
      const usage = await ContactApiClient.get(`/api/user/contacts/cost-analytics?timeframe=${timeframe}&feature=semantic_search`);
      
      flowLogger.complete({ success: true, analyticsRetrieved: !!usage });
      
      AdvancedLogger.info('Analytics', 'cost_analytics_retrieved', {
        userId,
        timeframe,
        hasData: !!usage
      });
      
      return usage;

    } catch (error) {
      flowLogger.logError('analytics_failed', error);
      
      AdvancedLogger.error('Analytics', 'cost_analytics_failed', {
        error: error.message,
        userId,
        timeframe
      });
      
      return null;
    }
  }

  /**
   * Determine if user can use AI Researcher based on subscription
   */
  static canUseAIResearcher(sampleResult, subscriptionLevel) {
    const canUse = sampleResult?.searchMetadata?.tier === 'business' || 
           sampleResult?.searchMetadata?.tier === 'enterprise' ||
           subscriptionLevel === 'business' ||
           subscriptionLevel === 'enterprise';
           
    AdvancedLogger.debug('Feature', 'ai_researcher_check', {
      canUse,
      sampleResultTier: sampleResult?.searchMetadata?.tier,
      subscriptionLevel
    });
    
    return canUse;
  }

  /**
   * Get pricing information for different tiers
   */
  static getPricingInfo() {
    return {
      pinecone: {
        storage: `${PINECONE_PRICING.STORAGE_PER_GB_MONTHLY.toFixed(3)} per GB per month`,
        writes: `${PINECONE_PRICING.WRITE_PER_VECTOR.toFixed(6)} per vector written`,
        queries: `${PINECONE_PRICING.QUERY_PER_VECTOR.toFixed(6)} per vector queried`
      },
      gemini: {
        embedding: `${GEMINI_MODELS.EMBEDDING.pricePerMillionTokens} per million tokens`,
        generation: `${GEMINI_MODELS.GENERATION_STANDARD.inputPricePerMillionTokens}-${GEMINI_MODELS.GENERATION_STANDARD.outputPricePerMillionTokens} per million tokens`,
        longContext: `${GEMINI_MODELS.GENERATION_STANDARD.longContextInputPrice}-${GEMINI_MODELS.GENERATION_STANDARD.longContextOutputPrice} per million tokens (>200k)`
      },
      estimatedCostPerSearch: {
        basic: '$0.0001 - $0.0005',
        withAI: '$0.001 - $0.01',
        complex: '$0.01 - $0.05'
      }
    };
  }

  // Keep instance methods for backwards compatibility
  async search(...args) {
    return SemanticSearchService.search(...args);
  }

  async enhanceResultsWithAI(...args) {
    return SemanticSearchService.enhanceResultsWithAI(...args);
  }

  canUseAIResearcher(...args) {
    return SemanticSearchService.canUseAIResearcher(...args);
  }

  async getSearchCostAnalytics(...args) {
    return SemanticSearchService.getSearchCostAnalytics(...args);
  } 

}