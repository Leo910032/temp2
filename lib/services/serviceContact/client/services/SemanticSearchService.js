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
   * Get vector similarity thresholds based on subscription level
   */
  static getVectorThresholds(subscriptionLevel) {
    switch(subscriptionLevel?.toLowerCase()) {
      case 'enterprise': 
        return { 
          high: 0.60, 
          medium: 0.45, 
          low: 0.30,
          minimum: 0.25 
        };
      case 'business': 
        return { 
          high: 0.70, 
          medium: 0.55, 
          low: 0.40,
          minimum: 0.35 
        };
      case 'premium': 
        return { 
          high: 0.75, 
          medium: 0.60, 
          low: 0.45,
          minimum: 0.40 
        };
      default: 
        return { 
          high: 0.80, 
          medium: 0.65, 
          low: 0.50,
          minimum: 0.45 
        };
    }
  }
   /**
   * Categorize contacts by vector similarity
   */
  static categorizeContactsBySimilarity(vectorResults, subscriptionLevel) {
    const thresholds = this.getVectorThresholds(subscriptionLevel);
    
    console.log('Vector similarity thresholds for', subscriptionLevel, ':', thresholds);
    
    const categories = {
      high: [],
      medium: [],
      low: [],
      filtered: []
    };

    vectorResults.forEach(contact => {
      const score = contact._vectorScore || 0;
      
      if (score >= thresholds.high) {
        categories.high.push({ ...contact, similarityTier: 'high', vectorScore: score });
      } else if (score >= thresholds.medium) {
        categories.medium.push({ ...contact, similarityTier: 'medium', vectorScore: score });
      } else if (score >= thresholds.low) {
        categories.low.push({ ...contact, similarityTier: 'low', vectorScore: score });
      } else if (score >= thresholds.minimum) {
        categories.filtered.push({ ...contact, similarityTier: 'filtered', vectorScore: score });
      }
      // Contacts below minimum threshold are completely filtered out
    });

    // Sort within each category by score (highest first)
    Object.keys(categories).forEach(key => {
      categories[key].sort((a, b) => (b.vectorScore || 0) - (a.vectorScore || 0));
    });

    console.log('Contact categorization:', {
      high: categories.high.length,
      medium: categories.medium.length,
      low: categories.low.length,
      filtered: categories.filtered.length,
      totalProcessed: vectorResults.length
    });

    return categories;
  }
  /**
   * Enhanced search with smart vector filtering
   */
  static async search(query, options = {}) {
    const { 
      userId, 
      subscriptionLevel = 'premium',
      maxResults = 10,
      enhanceResults = true,
      streamingMode = false,
      onProgress = null,
      onResult = null,
      onError = null
    } = options;

    try {
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Search query is required');
      }

      console.log('Starting enhanced semantic search with vector optimization:', {
        queryLength: query.length,
        subscriptionLevel,
        streamingMode,
        enhanceResults
      });

      // Step 1: Perform vector search (AI Librarian)
      const vectorSearchResponse = await ContactApiClient.post('/api/user/contacts/semantic-search', {
        query: query.trim(),
        maxResults: Math.min(maxResults * 2, 20), // Get more results for filtering
        includeMetadata: true,
        trackCosts: true
      });

      const vectorResults = vectorSearchResponse.results || vectorSearchResponse || [];
      const serverMetadata = vectorSearchResponse.searchMetadata || {};

      console.log('Vector search complete:', {
        resultsFound: vectorResults.length,
        averageScore: vectorResults.length > 0 
          ? (vectorResults.reduce((sum, r) => sum + (r._vectorScore || 0), 0) / vectorResults.length).toFixed(3)
          : 0
      });

      if (vectorResults.length === 0) {
        return {
          results: [],
          searchMetadata: {
            query: query.substring(0, 100),
            totalResults: 0,
            message: 'No semantically similar contacts found',
            subscriptionLevel,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Step 2: Categorize by vector similarity
      const categorized = this.categorizeContactsBySimilarity(vectorResults, subscriptionLevel);
      
      // Step 3: Smart AI enhancement strategy
      let enhancedResults = vectorResults;
      
      if (enhanceResults && this.canUseAIResearcher(vectorResults[0], subscriptionLevel)) {
        enhancedResults = await this.enhanceResultsWithSmartProcessing(
          query,
          categorized,
          {
            subscriptionLevel,
            trackCosts: true,
            streamingMode,
            maxResults,
            onProgress,
            onResult,
            onError
          }
        );
      } else {
        // No AI enhancement - return categorized results with similarity info
        enhancedResults = this.formatResultsWithSimilarityInfo(categorized, maxResults);
      }

      const finalResults = Array.isArray(enhancedResults) ? enhancedResults : enhancedResults.results || [];
      
      return {
        results: finalResults,
        searchMetadata: {
          query: query.substring(0, 100),
          totalResults: finalResults.length,
          vectorCategories: {
            high: categorized.high.length,
            medium: categorized.medium.length,
            low: categorized.low.length,
            filtered: categorized.filtered.length
          },
          subscriptionLevel,
          enhancementLevel: finalResults.some(r => r.searchMetadata?.aiAnalysis) ? 'ai_powered' : 'vector_only',
          streamingMode,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Enhanced semantic search failed:', error);
      
      if (error.status === 403) {
        throw new Error('Semantic search requires Premium subscription or higher');
      }
      
      throw new Error(error.message || 'Search failed. Please try again.');
    }
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
   * Enhanced search with streaming AI enhancement option
   */
  static async search(query, options = {}) {
    const { 
      userId, 
      subscriptionLevel = 'premium',
      maxResults = 10,
      enhanceResults = true,
      streamingMode = false,
      onProgress = null,
      onResult = null,
      onError = null
    } = options;

    try {
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Search query is required');
      }

      console.log('🔍 Starting semantic search:', {
        queryLength: query.length,
        subscriptionLevel,
        streamingMode,
        enhanceResults
      });

      // Step 1: Perform vector search (Job #1 - AI Librarian)
      const vectorSearchResponse = await ContactApiClient.post('/api/user/contacts/semantic-search', {
        query: query.trim(),
        maxResults,
        includeMetadata: true,
        trackCosts: true
      });

      const vectorResults = vectorSearchResponse.results || vectorSearchResponse || [];
      const serverMetadata = vectorSearchResponse.searchMetadata || {};

      console.log('✅ Vector search complete:', {
        resultsFound: vectorResults.length
      });

      // Step 2: AI Enhancement
      let enhancedResults = vectorResults;
      
      if (enhanceResults && vectorResults.length > 0 && SemanticSearchService.canUseAIResearcher(vectorResults[0], subscriptionLevel)) {
        if (streamingMode) {
          // Use streaming mode for real-time results
          enhancedResults = await SemanticSearchService.enhanceResultsWithStreaming(
            query, 
            vectorResults, 
            {
              subscriptionLevel,
              trackCosts: true,
              onProgress,
              onResult,
              onError
            }
          );
        } else {
          // Use batch mode (existing behavior)
          enhancedResults = await SemanticSearchService.enhanceResultsWithAI(query, vectorResults, {
            subscriptionLevel,
            trackCosts: true
          });
        }
      }

      // Return final results
      const finalResults = Array.isArray(enhancedResults) ? enhancedResults : enhancedResults.results || [];
      
      return {
        results: finalResults,
        searchMetadata: {
          query: query.substring(0, 100),
          totalResults: finalResults.length,
          subscriptionLevel,
          enhancementLevel: enhancedResults.some(r => r.searchMetadata?.aiAnalysis) ? 'ai_powered' : 'basic',
          streamingMode,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Semantic search failed:', error);
      
      if (error.status === 403) {
        throw new Error('Semantic search requires Premium subscription or higher');
      }
      
      if (error.status === 429) {
        throw new Error('Search quota exceeded. Please try again later.');
      }
      
      throw new Error(error.message || 'Search failed. Please try again.');
    }
  }
    /**
   * NEW: Enhanced AI result enhancement with streaming support
   */
  static async enhanceResultsWithStreaming(originalQuery, vectorResults, options = {}) {
    const { 
      subscriptionLevel = 'business', 
      trackCosts = false,
      onProgress = null,
      onResult = null,
      onError = null
    } = options;
    
    try {
      console.log('🔄 Starting streaming AI enhancement:', {
        contactsCount: vectorResults.length,
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
        trackCosts,
        mode: 'streaming' // Enable streaming mode
      };

      // Get auth token for streaming request
      const token = await ContactApiClient.getAuthToken();
      
      // Make streaming request
      const response = await fetch('/api/user/contacts/ai-enhance-results', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(enhancementPayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Process streaming response
      const results = await this.processStreamingResponse(
        response, 
        vectorResults,
        { onProgress, onResult, onError }
      );

      return results;

    } catch (error) {
      console.error('❌ Streaming AI enhancement failed:', error);
      
      if (onError) {
        onError(error);
      }
      
      // Graceful fallback - return vector results without AI enhancement
      return vectorResults.map(contact => ({
        ...contact,
        searchMetadata: {
          ...contact.searchMetadata,
          enhancementLevel: 'basic_fallback',
          aiAnalysis: null,
          enhancementError: 'AI analysis temporarily unavailable'
        }
      }));
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