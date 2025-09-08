// lib/services/serviceContact/client/services/SemanticSearchService.js - ENHANCED WITH VECTOR SIMILARITY OPTIMIZATION
"use client"
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';

export class SemanticSearchService extends BaseContactService {
  constructor() {
    super('SemanticSearchService');
  }

  /**
 * Get vector similarity thresholds based on subscription level
 * FIXED: More realistic thresholds based on actual semantic search behavior
 */
static getVectorThresholds(subscriptionLevel) {
  switch(subscriptionLevel?.toLowerCase()) {
    case 'enterprise': 
      return { 
        high: 0.50,     // 50% similarity (very good for semantic search)
        medium: 0.35,   // 35% similarity (decent match)
        low: 0.25,      // 25% similarity (weak but potentially relevant)
        minimum: 0.20   // 20% minimum (very weak connections)
      };
    case 'business': 
      return { 
        high: 0.55,     // Slightly higher bar for business
        medium: 0.40,   
        low: 0.30,      
        minimum: 0.25   
      };
    case 'premium': 
      return { 
        high: 0.60,     // Higher standards for premium
        medium: 0.45,   
        low: 0.35,      
        minimum: 0.30   
      };
    default: 
      return { 
        high: 0.65,     // Highest standards for free tier
        medium: 0.50,   
        low: 0.40,
        minimum: 0.35   
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
      const canEnhance = enhanceResults && this.canUseAIResearcher(vectorResults[0], subscriptionLevel);

      if (canEnhance && streamingMode) {
        // STREAMING LOGIC: Start enhancement in background, return initial results immediately
        console.log('Streaming mode: Starting background AI enhancement.');

        // Fire-and-forget the enhancement process. It will communicate via callbacks.
        this.enhanceResultsWithSmartProcessing(
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
        ).catch(error => {
            console.error('Background AI streaming enhancement failed:', error);
            if (onError) onError({ type: 'stream_error', error: error.message || 'Unknown streaming error' });
        });

        // Immediately return all vector results for the UI to display
        const allVectorResults = this.formatResultsWithSimilarityInfo(categorized, 100); // High limit to include all
        return {
            results: allVectorResults,
            searchMetadata: {
                query: query.substring(0, 100),
                totalResults: allVectorResults.length,
                vectorCategories: {
                    high: categorized.high.length,
                    medium: categorized.medium.length,
                    low: categorized.low.length,
                    filtered: categorized.filtered.length
                },
                subscriptionLevel,
                enhancementLevel: 'vector_streaming_ai', // Custom status
                streamingMode,
                timestamp: new Date().toISOString()
            }
        };

      } else {
          // BATCH or VECTOR-ONLY LOGIC: Await the result and return the final list
          let enhancedResults;
          if (canEnhance) {
              // Batch mode: await the full result
              console.log('Batch mode: Awaiting AI enhancement.');
              enhancedResults = await this.enhanceResultsWithSmartProcessing(
                  query,
                  categorized,
                  { /* Batch options */ }
              );
          } else {
              // Vector-only mode
              console.log('Vector-only mode: Formatting results.');
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
      }

    } catch (error) {
      console.error('Enhanced semantic search failed:', error);
      
      if (error.status === 403) {
        throw new Error('Semantic search requires Premium subscription or higher');
      }
      
      throw new Error(error.message || 'Search failed. Please try again.');
    }
  }

  /**
   * Smart AI processing strategy based on vector categories
   */
  static async enhanceResultsWithSmartProcessing(query, categorized, options = {}) {
    const { 
      subscriptionLevel, 
      trackCosts = false,
      streamingMode = false,
      maxResults = 10,
      onProgress = null,
      onResult = null,
      onError = null
    } = options;

    console.log('Starting smart AI processing strategy...');

    // Processing strategy based on vector categories
    let contactsToProcess = [];
    let processingStrategy = '';

    if (categorized.high.length >= maxResults) {
      // Plenty of high-similarity contacts
      contactsToProcess = categorized.high.slice(0, maxResults);
      processingStrategy = 'high_only';
    } else if (categorized.high.length + categorized.medium.length >= maxResults) {
      // Mix of high and medium
      contactsToProcess = [
        ...categorized.high,
        ...categorized.medium.slice(0, maxResults - categorized.high.length)
      ];
      processingStrategy = 'high_medium_mix';
    } else {
      // Need to include some lower similarity contacts
      contactsToProcess = [
        ...categorized.high,
        ...categorized.medium,
        ...categorized.low.slice(0, maxResults - categorized.high.length - categorized.medium.length)
      ];
      processingStrategy = 'inclusive';
    }

    console.log('AI processing strategy:', {
      strategy: processingStrategy,
      totalToProcess: contactsToProcess.length,
      breakdown: {
        high: contactsToProcess.filter(c => c.similarityTier === 'high').length,
        medium: contactsToProcess.filter(c => c.similarityTier === 'medium').length,
        low: contactsToProcess.filter(c => c.similarityTier === 'low').length
      }
    });

    if (streamingMode) {
      return this.enhanceResultsWithStreaming(query, contactsToProcess, {
        subscriptionLevel,
        trackCosts,
        onProgress,
        onResult,
        onError,
        processingStrategy
      });
    } else {
      return this.enhanceResultsWithAI(query, contactsToProcess, {
        subscriptionLevel,
        trackCosts,
        processingStrategy
      });
    }
  }

  /**
   * Format results without AI enhancement but with similarity info
   */
  static formatResultsWithSimilarityInfo(categorized, maxResults) {
    const allContacts = [
      ...categorized.high,
      ...categorized.medium,
      ...categorized.low,
      ...categorized.filtered // Include filtered contacts for initial display
    ].slice(0, maxResults);

    return allContacts.map(contact => ({
      ...contact,
      searchMetadata: {
        ...contact.searchMetadata,
        vectorSimilarity: contact.vectorScore,
        similarityTier: contact.similarityTier,
        enhancementLevel: 'vector_only',
        similarityExplanation: this.getSimilarityExplanation(contact.vectorScore, contact.similarityTier)
      }
    }));
  }

  /**
   * Get human-readable similarity explanation
   */
  static getSimilarityExplanation(score, tier) {
    switch (tier) {
      case 'high':
        return `Very strong semantic match (${(score * 100).toFixed(1)}% similarity)`;
      case 'medium':
        return `Good semantic match (${(score * 100).toFixed(1)}% similarity)`;
      case 'low':
        return `Moderate semantic match (${(score * 100).toFixed(1)}% similarity)`;
      case 'filtered':
        return `Weak semantic match (${(score * 100).toFixed(1)}% similarity)`;
      default:
        return `Semantic match (${(score * 100).toFixed(1)}% similarity)`;
    }
  }

  /**
   * Enhanced streaming with similarity-aware prompting
   */
  static async enhanceResultsWithStreaming(originalQuery, contactsToProcess, options = {}) {
    const { 
      subscriptionLevel = 'business', 
      trackCosts = false,
      onProgress = null,
      onResult = null,
      onError = null,
      processingStrategy = 'standard'
    } = options;
    
    try {
      console.log('Starting similarity-aware streaming AI enhancement:', {
        contactsCount: contactsToProcess.length,
        subscriptionLevel,
        processingStrategy
      });

      // Enhanced payload with similarity information
      const enhancementPayload = {
        originalQuery,
        contacts: contactsToProcess.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          company: contact.company,
          notes: contact.notes,
          message: contact.message,
          vectorScore: contact._vectorScore || contact.vectorScore,
          similarityTier: contact.similarityTier,
          similarityExplanation: this.getSimilarityExplanation(
            contact._vectorScore || contact.vectorScore, 
            contact.similarityTier
          )
        })),
        subscriptionLevel,
        trackCosts,
        mode: 'streaming',
        processingStrategy,
        vectorOptimized: true // Flag for enhanced processing
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

      // Process streaming response with similarity awareness
      const results = await this.processStreamingResponseWithSimilarity(
        response, 
        contactsToProcess,
        { onProgress, onResult, onError, processingStrategy }
      );

      return results;

    } catch (error) {
      console.error('Similarity-aware streaming AI enhancement failed:', error);
      
      if (onError) {
        onError(error);
      }
      
      // Graceful fallback with similarity info
      return this.formatResultsWithSimilarityInfo({
        high: contactsToProcess.filter(c => c.similarityTier === 'high'),
        medium: contactsToProcess.filter(c => c.similarityTier === 'medium'),
        low: contactsToProcess.filter(c => c.similarityTier === 'low'),
        filtered: []
      }, contactsToProcess.length);
    }
  }

  /**
   * Enhanced streaming response processing with similarity context
   */
  static async processStreamingResponseWithSimilarity(response, contactsToProcess, callbacks = {}) {
    const { onProgress, onResult, onError, processingStrategy } = callbacks;
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    const enhancedContacts = [...contactsToProcess];
    const processedInsights = new Map();
    
    let totalProcessed = 0;
    let totalContacts = 0;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            switch (data.type) {
              case 'start':
                totalContacts = data.total;
                console.log(`Starting AI analysis for ${totalContacts} contacts (${processingStrategy} strategy)`);
                if (onProgress) {
                  onProgress({
                    type: 'start',
                    total: totalContacts,
                    query: data.query,
                    strategy: processingStrategy
                  });
                }
                break;
                
              case 'progress':
                const contact = enhancedContacts.find(c => c.id === data.contactId) || {};
                console.log(`Processing: ${data.contactName} (${contact.similarityTier || 'unknown'} similarity, ${data.processed}/${data.total})`);
                
                if (onProgress) {
                  onProgress({
                    type: 'processing',
                    contactIndex: data.contactIndex,
                    contactName: data.contactName,
                    processed: data.processed,
                    total: data.total,
                    percentage: (data.processed / data.total) * 100,
                    similarityTier: contact.similarityTier,
                    vectorScore: contact.vectorScore
                  });
                }
                break;
                
              case 'result':
                const insight = data.insight;
                processedInsights.set(insight.contactId, insight);
                
                // Find the original contact for similarity context
                const originalContact = enhancedContacts.find(c => c.id === insight.contactId);
                
                console.log(`Result: ${insight.contactId} (AI: ${insight.confidence}/10, Vector: ${originalContact?.similarityTier || 'unknown'})`);
                
                // Merge AI insights with similarity context
                const contactIndex = enhancedContacts.findIndex(c => c.id === insight.contactId);
                if (contactIndex !== -1) {
                  enhancedContacts[contactIndex] = {
                    ...enhancedContacts[contactIndex],
                    searchMetadata: {
                      ...enhancedContacts[contactIndex].searchMetadata,
                      enhancementLevel: 'ai_powered',
                      vectorSimilarity: enhancedContacts[contactIndex].vectorScore,
                      similarityTier: enhancedContacts[contactIndex].similarityTier,
                      aiAnalysis: {
                        matchExplanation: insight.explanation,
                        relevanceFactors: insight.factors,
                        actionSuggestions: insight.suggestions,
                        confidenceScore: insight.confidence
                      },
                      hybridScore: this.calculateHybridScore(
                        enhancedContacts[contactIndex].vectorScore,
                        insight.confidence
                      )
                    }
                  };
                  
                  if (onResult) {
                    onResult({
                      contact: enhancedContacts[contactIndex],
                      insight,
                      processed: data.processed,
                      total: data.total,
                      similarityContext: {
                        tier: enhancedContacts[contactIndex].similarityTier,
                        vectorScore: enhancedContacts[contactIndex].vectorScore,
                        hybridScore: enhancedContacts[contactIndex].searchMetadata.hybridScore
                      }
                    });
                  }
                }
                break;
                
              case 'filtered':
                const filteredContact = enhancedContacts.find(c => c.name === data.contactName);
                console.log(`Filtered: ${data.contactName} (${data.reason}, Vector: ${filteredContact?.similarityTier || 'unknown'})`);
                
                if (onProgress) {
                  onProgress({
                    type: 'filtered',
                    contactName: data.contactName,
                    reason: data.reason,
                    confidence: data.confidence,
                    processed: data.processed,
                    total: data.total,
                    similarityTier: filteredContact?.similarityTier,
                    vectorScore: filteredContact?.vectorScore
                  });
                }
                break;
                
              case 'complete':
                console.log('AI enhancement complete with similarity optimization:', data.stats);
                if (onProgress) {
                  onProgress({
                    type: 'complete',
                    stats: data.stats,
                    insights: data.insights,
                    strategy: processingStrategy
                  });
                }
                totalProcessed = data.stats.totalProcessed;
                break;
                
              case 'error':
                console.error(`Contact error: ${data.contactName}:`, data.error);
                if (onError) {
                  onError({
                    type: 'contact_error',
                    contactName: data.contactName,
                    error: data.error
                  });
                }
                break;
            }
          } catch (parseError) {
            console.warn('Failed to parse streaming data:', parseError);
          }
        }
      }
      
      // Sort results by hybrid score (combination of vector similarity + AI confidence)
      enhancedContacts.sort((a, b) => {
        const scoreA = a.searchMetadata?.hybridScore || a.vectorScore || 0;
        const scoreB = b.searchMetadata?.hybridScore || b.vectorScore || 0;
        return scoreB - scoreA;
      });
      
      console.log(`Streaming complete with similarity optimization: ${processedInsights.size} insights for ${totalProcessed} contacts`);
      
      return enhancedContacts;
      
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Calculate hybrid score combining vector similarity and AI confidence
   */
  static calculateHybridScore(vectorScore, aiConfidence) {
    // Normalize AI confidence to 0-1 scale
    const normalizedAI = aiConfidence / 10;
    
    // Weight: 40% vector similarity, 60% AI confidence
    const hybridScore = (vectorScore * 0.4) + (normalizedAI * 0.6);
    
    return Math.round(hybridScore * 1000) / 1000; // Round to 3 decimal places
  }

  /**
   * Existing methods for backward compatibility
   */
  static canUseAIResearcher(sampleResult, subscriptionLevel) {
    return ['business', 'enterprise'].includes(subscriptionLevel);
  }

  // Keep instance methods for backwards compatibility
  async search(...args) {
    return SemanticSearchService.search(...args);
  }
}