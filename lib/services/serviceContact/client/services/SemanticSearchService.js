//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 

// lib/services/serviceContact/client/services/SemanticSearchService.js - ENHANCED WITH RERANKING
"use client"
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';
import { contactCache } from '../core/contactCacheManager';

export class SemanticSearchService extends BaseContactService {
  constructor() {
    super('SemanticSearchService');
    this.searchHistory = this.loadSearchHistory();
    this.jobHistory = this.loadJobHistory();
  }

  /**
   * Load search history from localStorage
   */
  static loadSearchHistory() {
    try {
      const stored = localStorage.getItem('semantic_search_history');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load search history:', error);
      return [];
    }
  }
  /**
   * Save search history to localStorage
   */
  static saveSearchHistory(history) {
    try {
      // Keep only last 20 searches
      const trimmed = history.slice(-20);
      localStorage.setItem('semantic_search_history', JSON.stringify(trimmed));
      return trimmed;
    } catch (error) {
      console.warn('Failed to save search history:', error);
      return history;
    }
  }
  /**
   * Add query to search history
   */
  static addToSearchHistory(query) {
    if (!query || query.trim().length < 3) return;
    
    const history = this.loadSearchHistory();
    const trimmedQuery = query.trim();
    
    // Remove duplicate if exists
    const filtered = history.filter(q => q !== trimmedQuery);
    
    // Add to end
    filtered.push(trimmedQuery);
    
    return this.saveSearchHistory(filtered);
  }
  /**
   * Clear search history
   */
  static clearSearchHistory() {
    try {
      localStorage.removeItem('semantic_search_history');
      return [];
    } catch (error) {
      console.warn('Failed to clear search history:', error);
      return [];
    }
  }
  /**
   * Load job history from localStorage
   */
  static loadJobHistory() {
    try {
      const stored = localStorage.getItem('semantic_search_jobs');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load job history:', error);
      return [];
    }
  }
  /**
   * Save completed search job to history and its full data to persistent storage
   */
  static saveSearchJob(query, results, metadata) {
    try {
      const jobs = this.loadJobHistory();
      const jobId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const jobMetadata = {
        id: jobId,
        query: query.substring(0, 100),
        timestamp: new Date().toISOString(),
        resultCount: results.length,
        enhancementLevel: metadata.enhancementLevel,
        subscriptionLevel: metadata.subscriptionLevel,
        vectorCategories: metadata.vectorCategories,
        hasReranking: metadata.hasReranking || false,
        cacheKey: `search_job_data_${jobId}`,
        summary: this.generateJobSummary(results, metadata)
      };

      // Define an expiration time (e.g., 1 hour from now)
      const ttl = 60 * 60 * 1000; // 1 hour in milliseconds
      const expiresAt = Date.now() + ttl;

      // Create the full data payload to be cached
      const jobDataToCache = {
        payload: {
          results,
          metadata,
          query
        },
        expiresAt: expiresAt
      };

      // Cache the full results in localStorage
      localStorage.setItem(`search_job_data_${jobId}`, JSON.stringify(jobDataToCache));
      
      jobs.push(jobMetadata);
      
      // Keep only last 50 jobs in the history list
      const trimmed = jobs.slice(-50);
      localStorage.setItem('semantic_search_jobs', JSON.stringify(trimmed));
      
      return jobMetadata;
    } catch (error) {
      console.warn('Failed to save search job:', error);
      // Clean up failed cache attempt
      localStorage.removeItem(`search_job_data_${jobId}`);
      return null;
    }
  }
  /**
   * Generate job summary for quick preview
   */
  static generateJobSummary(results, metadata) {
    const topContacts = results.slice(0, 3).map(r => r.name || 'Unknown');
    const hasAI = metadata.enhancementLevel?.includes('ai');
    const hasReranking = metadata.hasReranking || false;
    
    return {
      topContacts,
      hasAI,
      hasReranking,
      categories: metadata.vectorCategories
    };
  }
  /**
   * Load job from persistent history in localStorage
   */
  static async loadSearchJob(jobId) {
    try {
      const itemStr = localStorage.getItem(`search_job_data_${jobId}`);
      if (!itemStr) {
        console.log(`❌ Search job not found in localStorage: ${jobId}`);
        return null;
      }

      const item = JSON.parse(itemStr);
      const now = Date.now();

      // Check if the item has expired
      if (now > item.expiresAt) {
        console.log(`⌛️ Cached search job has expired: ${jobId}. Removing it.`);
        // Clean up the expired item from storage
        localStorage.removeItem(`search_job_data_${jobId}`);
        return null;
      }

      console.log(`📋 Loaded PERSISTENT cached search job: ${jobId}`);
      return item.payload; // Return the actual data
      
    } catch (error) {
      console.warn('Failed to load search job:', error);
      // If parsing fails or something goes wrong, remove the corrupt item
      localStorage.removeItem(`search_job_data_${jobId}`);
      return null;
    }
  }
// lib/services/serviceContact/client/services/SemanticSearchService.js

static getVectorThresholds(subscriptionLevel) {
  switch(subscriptionLevel?.toLowerCase()) {
    case 'enterprise': 
      return { 
        high: 0.35,     // 35% - Strong semantic match
        medium: 0.25,   // 25% - Good semantic match  
        low: 0.15,      // 15% - Moderate semantic match
        minimum: 0.10   // 10% - Weak but potentially relevant
      };
    case 'business': 
      return { 
        high: 0.40,     // 40% - Strong semantic match
        medium: 0.30,   // 30% - Good semantic match
        low: 0.20,      // 20% - Moderate semantic match  
        minimum: 0.15   // 15% - Weak but potentially relevant
      };
    case 'premium': 
      return { 
        high: 0.45,     // 45% - Strong semantic match
        medium: 0.35,   // 35% - Good semantic match
        low: 0.25,      // 25% - Moderate semantic match
        minimum: 0.20   // 20% - Weak but potentially relevant
      };
    default: 
      return { 
        high: 0.50,     // 50% - Strong semantic match  
        medium: 0.40,   // 40% - Good semantic match
        low: 0.30,      // 30% - Moderate semantic match
        minimum: 0.25   // 25% - Weak but potentially relevant
      };
  }
}
  static getRerankThresholds(subscriptionLevel) {
    return {
        high: 0.5,      // Anything over 50% rerank relevance is excellent
        medium: 0.2,    // 20-50% is a good, contextually relevant match
        low: 0.05       // 5-20% is a potential match worth looking at
    };
  }
 // lib/services/serviceContact/client/services/SemanticSearchService.js - ADD CLIENT DEBUGGING
static assignSimilarityTier(contact, subscriptionLevel) {
    const thresholds = this.getVectorThresholds(subscriptionLevel);
    const score = contact.searchMetadata?.hybridScore || contact.searchMetadata?.rerankScore || contact._vectorScore || 0;

    if (score >= thresholds.high) {
        contact.similarityTier = 'high';
    } else if (score >= thresholds.medium) {
        contact.similarityTier = 'medium';
    } else if (score >= thresholds.low) {
        contact.similarityTier = 'low';
    } else {
        contact.similarityTier = 'filtered';
    }
    return contact;
}

/**
 * Enhanced categorizeContactsBySimilarity with debugging
 */
static categorizeContactsBySimilarity(results, subscriptionLevel) {
    // Check if the first result has a rerank score to decide which logic to use
    const isReranked = results[0]?.searchMetadata?.rerankScore !== undefined;

    const thresholds = isReranked 
        ? this.getRerankThresholds(subscriptionLevel) 
        : this.getVectorThresholds(subscriptionLevel);

    console.log(`[ClientDebug] Categorizing using ${isReranked ? 'RERANK' : 'VECTOR'} thresholds:`, thresholds);

    const categories = { high: [], medium: [], low: [] };

    results.forEach(contact => {
        // Use the rerank score if it exists, otherwise fall back to the vector score
        const score = isReranked ? (contact.searchMetadata.rerankScore || 0) : (contact._vectorScore || 0);

        let tier = 'low'; // Default tier
        if (score >= thresholds.high) {
            tier = 'high';
        } else if (score >= thresholds.medium) {
            tier = 'medium';
        }
        
        // This is important: we update the contact object itself
        contact.similarityTier = tier;
        categories[tier].push(contact);
    });

    console.log(`[ClientDebug] Final relevance categories:`, {
        high: categories.high.length,
        medium: categories.medium.length,
        low: categories.low.length,
    });

    return categories;
  }



  /**
   * NEW: Rerank contacts using Cohere API
   */
  static async rerankContacts(query, contacts, options = {}) {
    const { 
      subscriptionLevel = 'premium',
      model = 'rerank-multilingual-v3.0',
      topN = 10,
      trackCosts = true 
    } = options;

    try {
      console.log('Starting contact reranking:', {
        query: query.substring(0, 50) + '...',
        contactsCount: contacts.length,
        model,
        topN
      });

      // Call the rerank API
      const rerankResponse = await ContactApiClient.post('/api/user/contacts/rerank', {
        query,
        contacts,
        model,
        topN: Math.min(topN, contacts.length),
        trackCosts
      });

    // In lib/services/serviceContact/client/services/SemanticSearchService.js
// Inside the rerankContacts function

      if (rerankResponse.results) {
        console.log('Reranking complete:', {
          originalCount: contacts.length,
          rerankedCount: rerankResponse.results.length,
          cost: rerankResponse.metadata?.cost || 0,
          model: rerankResponse.metadata?.model
        });

        // ===================================================================
        // ✅ FINAL FIX: Re-attach the original ID after reranking.
        // The reranker API might strip or not return the original ID field.
        // We look it up by index from the original `contacts` array.
        // ===================================================================
        const resultsWithIds = rerankResponse.results.map(rerankedContact => {
          const originalContact = contacts[rerankedContact.index];
          if (!originalContact) {
            console.warn(`Could not find original contact for reranked index: ${rerankedContact.index}`);
            return rerankedContact; // Return as is if lookup fails
          }
          return {
            ...originalContact, // Start with the original object (which has the ID)
            ...rerankedContact, // Overwrite with reranked data (like the score)
            id: originalContact.id, // Explicitly ensure the ID is preserved
          };
        });

        return {
          results: resultsWithIds, // Return the corrected array
          metadata: rerankResponse.metadata
        };
      }

      // Fallback if reranking fails
      console.warn('Reranking API returned no results, falling back to original order');
      return {
        results: contacts.slice(0, topN),
        metadata: { fallback: true, cost: 0 }
      };

    } catch (error) {
      console.error('Reranking failed, falling back to original order:', error);
      
      // Graceful fallback - return original contacts
      return {
        results: contacts.slice(0, topN),
        metadata: { 
          fallback: true, 
          error: error.message,
          cost: 0
        }
      };
    }
  }
// lib/services/serviceContact/client/services/SemanticSearchService.js - FULLY CORRECTED

  static async search(query, options = {}) {
    const { 
      userId, 
      subscriptionLevel = 'premium',
      maxResults = 20,
      enhanceResults = true,
      useReranking = true,
      streamingMode = false,
      onProgress = null,
      onResult = null,
      onError = null,
      queryLanguage = 'en',
      useCache = true
    } = options;

    try {
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Search query is required');
      }

      const cleanQuery = query.trim();
      
      const cacheKey = `semantic_search_${userId}_${btoa(cleanQuery)}_${subscriptionLevel}_${maxResults}_${enhanceResults}_${useReranking}_${streamingMode}`;
      
      if (useCache) {
        try {
          const cached = contactCache.cache.get(cacheKey);
          if (cached && Date.now() < contactCache.expirationTimes.get(cacheKey)) {
            console.log(`💾 Using cached semantic search results for: ${cleanQuery}`);
            this.addToSearchHistory(cleanQuery);
            return cached;
          }
        } catch (error) {
          console.warn('Cache retrieval failed:', error);
        }
      }

      console.log('Starting enhanced semantic search with reranking:', {
        queryLength: cleanQuery.length,
        subscriptionLevel,
        streamingMode,
        enhanceResults,
        useReranking,
        queryLanguage,
        cached: false
      });

      this.addToSearchHistory(cleanQuery);

      // STEP 1: Fetch more results than needed to give the reranker a good selection.
      const vectorMaxResults = useReranking ? Math.min(maxResults * 4, 80) : maxResults * 2;
      
      const vectorSearchResponse = await ContactApiClient.post('/api/user/contacts/semantic-search', {
        query: cleanQuery,
        maxResults: vectorMaxResults,
        includeMetadata: true,
        trackCosts: true
      });

      // Define vectorResults right after the API call to prevent reference errors.
      const vectorResults = vectorSearchResponse.results || [];
      // Add this after: const vectorResults = vectorSearchResponse.results || [];
if (vectorResults.length > 0) {
  const contactsWithDynamic = vectorResults.filter(c => c.dynamicFields?.length > 0);
  if (contactsWithDynamic.length > 0) {
    console.log(`🔍 [ClientSearch] Found ${contactsWithDynamic.length} contacts with dynamic fields in vector results`);
    contactsWithDynamic.forEach(contact => {
      console.log(`🔍 [ClientSearch] ${contact.name}: ${contact.dynamicFields.map(f => f.label).join(', ')}`);
    });
  }
}
      console.log('Vector search complete:', { resultsFound: vectorResults.length });

      if (vectorResults.length === 0) {
        const emptyResult = { results: [], searchMetadata: { /* ... */ } };
        if (useCache) contactCache.set(cacheKey, emptyResult, 'default', 2 * 60 * 1000);
        return emptyResult;
      }

      // STEP 2: Perform an initial categorization based on PURE vector scores.
      // This is used ONLY for the initial toast message to give the user quick feedback.
      const initialVectorCategories = this.categorizeContactsBySimilarity(vectorResults, subscriptionLevel);
      
      let finalDisplayResults = vectorResults;
      let rerankMetadata = { fallback: true, cost: 0 };
      const canRerank = useReranking && ['premium', 'business', 'enterprise'].includes(subscriptionLevel);

      // STEP 3: Rerank the results if applicable.
      if (canRerank && vectorResults.length > 1) {
        console.log('Starting reranking phase...');
        const rerankResponse = await this.rerankContacts(cleanQuery, vectorResults, {
          subscriptionLevel,
          topN: maxResults,
          trackCosts: true
        });

        if (rerankResponse.results && rerankResponse.results.length > 0) {
            finalDisplayResults = rerankResponse.results;
            rerankMetadata = rerankResponse.metadata;
            console.log('Reranking successful.');
        }
      } else {
        console.log('Skipping reranking. Using top vector results.');
        finalDisplayResults.sort((a,b) => (b._vectorScore || 0) - (a._vectorScore || 0));
        finalDisplayResults = finalDisplayResults.slice(0, maxResults);
      }
      
      // STEP 4: THIS IS THE CRITICAL FIX.
      // Re-categorize the FINAL list of results. This function will now use
      // the rerank scores if they exist, assigning the correct `similarityTier`.
      console.log("Assigning final relevance tiers to all displayed contacts...");
      this.categorizeContactsBySimilarity(finalDisplayResults, subscriptionLevel);
      
      const canEnhance = enhanceResults && this.canUseAIResearcher(finalDisplayResults[0], subscriptionLevel);
      
      let finalResult;
      if (canEnhance && streamingMode) {
        // STREAMING LOGIC
        console.log('Streaming mode: Starting background AI enhancement...');
        const contactsForAI = finalDisplayResults.slice(0, 10);

        // Fire and forget the AI enhancement process.
        this.enhanceResultsWithSmartProcessing(
          cleanQuery,
          this.categorizeContactsBySimilarity(contactsForAI, subscriptionLevel), // Pass the correctly tiered contacts
          {
            subscriptionLevel,
            trackCosts: true,
            streamingMode,
            maxResults: 10,
            queryLanguage,
            onProgress,
            onResult,
            onError
          }
        ).catch(error => {
            console.error('Background AI streaming enhancement failed:', error);
            if (onError) onError({ type: 'stream_error', error: error.message || 'Unknown streaming error' });
        });

        // Immediately return the full list of reranked results.
        finalResult = {
            results: finalDisplayResults,
            searchMetadata: {
                query: cleanQuery.substring(0, 100),
                totalResults: finalDisplayResults.length,
                // Use the INITIAL vector categories for the toast message.
                vectorCategories: {
                    high: initialVectorCategories.high.length,
                    medium: initialVectorCategories.medium.length,
                    low: initialVectorCategories.low.length,
                },
                subscriptionLevel,
                enhancementLevel: 'vector_streaming_ai_reranked',
                streamingMode,
                hasReranking: canRerank && !rerankMetadata.fallback,
                rerankCost: rerankMetadata.cost || 0,
                timestamp: new Date().toISOString(),
                aiEnhancementPending: true
            }
        };

      } else {
          // BATCH or VECTOR-ONLY LOGIC
          let enhancedResults;
          if (canEnhance) {
              const contactsForAI = finalDisplayResults.slice(0, 10);
              enhancedResults = await this.enhanceResultsWithSmartProcessing(
                  cleanQuery,
                  this.categorizeContactsBySimilarity(contactsForAI, subscriptionLevel),
                  { subscriptionLevel, trackCosts: true, maxResults: 10, queryLanguage }
              );
          } else {
              enhancedResults = this.formatResultsWithSimilarityInfo(
                this.categorizeContactsBySimilarity(finalDisplayResults, subscriptionLevel), 
                maxResults
              );
          }
          
          const finalEnhancedResults = Array.isArray(enhancedResults) ? enhancedResults : enhancedResults.results || [];
          
          finalResult = {
              results: finalEnhancedResults,
              searchMetadata: {
                  query: cleanQuery.substring(0, 100),
                  totalResults: finalEnhancedResults.length,
                  vectorCategories: {
                    high: initialVectorCategories.high.length,
                    medium: initialVectorCategories.medium.length,
                    low: initialVectorCategories.low.length,
                  },
                  subscriptionLevel,
                  enhancementLevel: finalEnhancedResults.some(r => r.searchMetadata?.aiAnalysis) 
                    ? (canRerank && !rerankMetadata.fallback ? 'ai_powered_reranked' : 'ai_powered')
                    : (canRerank && !rerankMetadata.fallback ? 'vector_reranked' : 'vector_only'),
                  streamingMode,
                  hasReranking: canRerank && !rerankMetadata.fallback,
                  rerankCost: rerankMetadata.cost || 0,
                  timestamp: new Date().toISOString()
              }
          };
      }

      if (useCache && finalResult.results.length > 0) {
        const ttl = streamingMode ? 30 * 60 * 1000 : 10 * 60 * 1000;
        contactCache.set(cacheKey, finalResult, 'contacts', ttl);
        
        if (!streamingMode) {
          this.saveSearchJob(cleanQuery, finalResult.results, finalResult.searchMetadata);
        }
      }

      return finalResult;

    } catch (error) {
      console.error('Enhanced semantic search failed:', error);
      if (error.status === 403) {
        throw new Error('Semantic search requires Premium subscription or higher');
      }
      throw new Error(error.message || 'Search failed. Please try again.');
    }
  }

  /**
   * Smart AI processing strategy based on vector categories (now works with reranked results)
   */
  static async enhanceResultsWithSmartProcessing(query, categorized, options = {}) {
    const { 
      subscriptionLevel, 
      trackCosts = false,
      streamingMode = false,
      maxResults = 10,
       queryLanguage = 'en',
      onProgress = null,
      onResult = null,
      onError = null
    } = options;

    console.log('Starting smart AI processing strategy on reranked results...');

    // Processing strategy based on available contacts (now pre-filtered by reranking)
    let contactsToProcess = [];
    let processingStrategy = '';

    if (categorized.high.length >= maxResults) {
      contactsToProcess = categorized.high.slice(0, maxResults);
      processingStrategy = 'high_only_reranked';
    } else if (categorized.high.length + categorized.medium.length >= maxResults) {
      contactsToProcess = [
        ...categorized.high,
        ...categorized.medium.slice(0, maxResults - categorized.high.length)
      ];
      processingStrategy = 'high_medium_mix_reranked';
    } else {
      contactsToProcess = [
        ...categorized.high,
        ...categorized.medium,
        ...categorized.low.slice(0, maxResults - categorized.high.length - categorized.medium.length)
      ];
      processingStrategy = 'inclusive_reranked';
    }

    console.log('AI processing strategy (post-rerank):', {
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
        processingStrategy,
        queryLanguage // <-- Pass it down
      });
    } else {
      return this.enhanceResultsWithAI(query, contactsToProcess, {
        subscriptionLevel,
        trackCosts,
        processingStrategy,
        queryLanguage // <-- Pass it down
      });
    }
  }

  /**
   * Format results without AI enhancement but with similarity info (updated for rerank scores)
   */
  static formatResultsWithSimilarityInfo(categorized, maxResults) {
    const allContacts = [
      ...categorized.high,
      ...categorized.medium,
      ...categorized.low,
      ...categorized.filtered
    ].slice(0, maxResults);

    return allContacts.map(contact => ({
      ...contact,
      searchMetadata: {
        ...contact.searchMetadata,
        vectorSimilarity: contact.vectorScore,
        similarityTier: contact.similarityTier,
        enhancementLevel: 'vector_only',
        similarityExplanation: this.getSimilarityExplanation(contact.vectorScore, contact.similarityTier),
        // Preserve rerank score if it exists
        rerankScore: contact.searchMetadata?.rerankScore,
        hybridScore: contact.searchMetadata?.hybridScore || contact.vectorScore
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
   * Enhanced streaming with similarity-aware prompting (updated for rerank context)
   */
  static async enhanceResultsWithStreaming(originalQuery, contactsToProcess, options = {}) {
    const { 
      subscriptionLevel = 'business', 
      trackCosts = false,
      onProgress = null,
      onResult = null,
      onError = null,
      queryLanguage = 'en', // <-- ADD THIS to destructure the option with a default
      processingStrategy = 'standard'
    } = options;
    
    try {
      console.log('Starting similarity-aware streaming AI enhancement with rerank context:', {
        contactsCount: contactsToProcess.length,
        subscriptionLevel,
        processingStrategy
      });

      // Enhanced payload with similarity and rerank information
      const enhancementPayload = {
        originalQuery,
       contacts: contactsToProcess.map(contact => ({
  id: contact.id,
  name: contact.name,
  queryLanguage,
  email: contact.email,
  company: contact.company,
  jobTitle: contact.jobTitle,
  phone: contact.phone,
  website: contact.website,
  notes: contact.notes,
  message: contact.message,
  dynamicFields: contact.dynamicFields || [], // Include dynamic fields
  vectorScore: contact._vectorScore || contact.vectorScore,
  rerankScore: contact.searchMetadata?.rerankScore,
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
        vectorOptimized: true,
        rerankOptimized: true, // Flag for rerank-enhanced processing
        queryLanguage // <-- ADD THIS to the payload

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

      // Save completed streaming job to history
      if (results && results.length > 0) {
        this.saveSearchJob(originalQuery, results, {
          enhancementLevel: 'ai_powered_reranked',
          subscriptionLevel,
          hasReranking: true,
          vectorCategories: {
            high: contactsToProcess.filter(c => c.similarityTier === 'high').length,
            medium: contactsToProcess.filter(c => c.similarityTier === 'medium').length,
            low: contactsToProcess.filter(c => c.similarityTier === 'low').length,
            filtered: 0
          }
        });
      }

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
   * Enhanced streaming response processing with similarity context (updated for rerank)
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
                console.log(`Starting AI analysis for ${totalContacts} reranked contacts (${processingStrategy} strategy)`);
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
                console.log(`Processing: ${data.contactName} (${contact.similarityTier || 'unknown'} similarity, rerank: ${contact.searchMetadata?.rerankScore?.toFixed(3) || 'N/A'}, ${data.processed}/${data.total})`);
                
                if (onProgress) {
                  onProgress({
                    type: 'processing',
                    contactIndex: data.contactIndex,
                    contactName: data.contactName,
                    processed: data.processed,
                    total: data.total,
                    percentage: (data.processed / data.total) * 100,
                    similarityTier: contact.similarityTier,
                    vectorScore: contact.vectorScore,
                    rerankScore: contact.searchMetadata?.rerankScore
                  });
                }
                break;
                
              case 'result':
                const insight = data.insight;
                processedInsights.set(insight.contactId, insight);
                
                // Find the original contact for similarity context
                const originalContact = enhancedContacts.find(c => c.id === insight.contactId);
                
                console.log(`Result: ${insight.contactId} (AI: ${insight.confidence}/10, Vector: ${originalContact?.similarityTier || 'unknown'}, Rerank: ${originalContact?.searchMetadata?.rerankScore?.toFixed(3) || 'N/A'})`);
                
                // Merge AI insights with similarity and rerank context
                const contactIndex = enhancedContacts.findIndex(c => c.id === insight.contactId);
                if (contactIndex !== -1) {
                  enhancedContacts[contactIndex] = {
                    ...enhancedContacts[contactIndex],
                    searchMetadata: {
                      ...enhancedContacts[contactIndex].searchMetadata,
                      enhancementLevel: 'ai_powered_reranked',
                      vectorSimilarity: enhancedContacts[contactIndex].vectorScore,
                      similarityTier: enhancedContacts[contactIndex].similarityTier,
                      aiAnalysis: {
                        matchExplanation: insight.explanation,
                        relevanceFactors: insight.factors,
                        actionSuggestions: insight.suggestions,
                        confidenceScore: insight.confidence
                      },
                    // In lib/services/serviceContact/client/services/SemanticSearchService.js

                      hybridScore: this.calculateHybridScore(
                        // ✅ THE FIX IS HERE: Use _vectorScore with the underscore
                        enhancedContacts[contactIndex]._vectorScore, 
                        enhancedContacts[contactIndex].searchMetadata?.rerankScore,
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
                        rerankScore: enhancedContacts[contactIndex].searchMetadata?.rerankScore,
                        hybridScore: enhancedContacts[contactIndex].searchMetadata.hybridScore
                      }
                    });
                  }
                }
                break;
                
           // Inside processStreamingResponseWithSimilarity

              case 'filtered':
                const filteredContact = enhancedContacts.find(c => c.name === data.contactName);
                console.log(`Filtered: ${data.contactName} (${data.reason}, Vector: ${filteredContact?.similarityTier || 'unknown'}, Rerank: ${filteredContact?.searchMetadata?.rerankScore?.toFixed(3) || 'N/A'})`);
                
             // In lib/services/serviceContact/client/services/SemanticSearchService.js

                if (onProgress) {
                  onProgress({
                    type: 'filtered',
                    // =========================================================
                    // ✅ THIS IS THE FINAL FIX: Pass the ID through
                    // =========================================================
                    contactId: data.contactId, 
                    contactName: data.contactName,
                    reason: data.reason,
                    confidence: data.confidence,
                    threshold: data.threshold, // Also good to pass this along
                    processed: data.processed,
                    total: data.total,
                    similarityTier: filteredContact?.similarityTier,
                    vectorScore: filteredContact?.vectorScore,
                    rerankScore: filteredContact?.searchMetadata?.rerankScore
                  });
                }
                break;
              case 'complete':
                console.log('AI enhancement complete with rerank optimization:', data.stats);
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
      
      // Sort results by hybrid score (combination of vector similarity + rerank score + AI confidence)
      enhancedContacts.sort((a, b) => {
        const scoreA = a.searchMetadata?.hybridScore || a.searchMetadata?.rerankScore || a.vectorScore || 0;
        const scoreB = b.searchMetadata?.hybridScore || b.searchMetadata?.rerankScore || b.vectorScore || 0;
        return scoreB - scoreA;
      });
      
      console.log(`Streaming complete with rerank optimization: ${processedInsights.size} insights for ${totalProcessed} contacts`);
      
      return enhancedContacts;
      
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Calculate hybrid score combining vector similarity, rerank score, and AI confidence
   */
  static calculateHybridScore(vectorScore, rerankScore, aiConfidence) {
    // Normalize AI confidence to 0-1 scale
    const normalizedAI = aiConfidence / 10;
    
    if (rerankScore !== undefined && rerankScore !== null) {
      // Triple hybrid: 20% vector, 40% rerank, 40% AI
      const hybridScore = (vectorScore * 0.2) + (rerankScore * 0.4) + (normalizedAI * 0.4);
      return Math.round(hybridScore * 1000) / 1000;
    } else {
      // Dual hybrid: 40% vector, 60% AI (fallback)
      const hybridScore = (vectorScore * 0.4) + (normalizedAI * 0.6);
      return Math.round(hybridScore * 1000) / 1000;
    }
  }

  /**
   * Batch AI enhancement (non-streaming) updated for rerank context
   */
  static async enhanceResultsWithAI(query, contacts, options = {}) {
    const { subscriptionLevel, trackCosts = false, processingStrategy,        queryLanguage = 'en' // <-- ADDED THIS
 } = options;
    
    try {
      console.log('Starting batch AI enhancement on reranked results:', {
        contactsCount: contacts.length,
        subscriptionLevel,
        processingStrategy,
        
      });

      const payload = {
        originalQuery: query,
       contacts: contacts.map(contact => ({
  id: contact.id,
  name: contact.name,
  email: contact.email,
  company: contact.company,
  jobTitle: contact.jobTitle,        // ADD THIS
  phone: contact.phone,              // ADD THIS
  website: contact.website,          // ADD THIS
  notes: contact.notes,
  message: contact.message,
  dynamicFields: contact.dynamicFields || [], // ADD THIS - KEY CHANGE
  vectorScore: contact._vectorScore || contact.vectorScore,
  rerankScore: contact.searchMetadata?.rerankScore,
  similarityTier: contact.similarityTier,
  similarityExplanation: this.getSimilarityExplanation(
    contact._vectorScore || contact.vectorScore, 
    contact.similarityTier
  )
})),
        subscriptionLevel,
        trackCosts,
        mode: 'batch',
        processingStrategy,
        vectorOptimized: true,
        rerankOptimized: true,
                    queryLanguage // <-- ADD THIS to the payload

      };

      const response = await ContactApiClient.post('/api/user/contacts/ai-enhance-results', payload);
      
      if (response.results) {
        // Merge AI insights with original contacts
        const enhancedContacts = contacts.map(contact => {
          const aiInsight = response.results.find(r => r.contactId === contact.id);
          
          if (aiInsight) {
            return {
              ...contact,
              searchMetadata: {
                ...contact.searchMetadata,
                enhancementLevel: 'ai_powered_reranked',
                vectorSimilarity: contact.vectorScore,
                similarityTier: contact.similarityTier,
                aiAnalysis: {
                  matchExplanation: aiInsight.explanation,
                  relevanceFactors: aiInsight.factors,
                  actionSuggestions: aiInsight.suggestions,
                  confidenceScore: aiInsight.confidence
                },
                hybridScore: this.calculateHybridScore(
                  contact.vectorScore, 
                  contact.searchMetadata?.rerankScore,
                  aiInsight.confidence
                )
              }
            };
          }
          
          return contact;
        });

        // Sort by hybrid score
        enhancedContacts.sort((a, b) => {
          const scoreA = a.searchMetadata?.hybridScore || a.searchMetadata?.rerankScore || a.vectorScore || 0;
          const scoreB = b.searchMetadata?.hybridScore || b.searchMetadata?.rerankScore || b.vectorScore || 0;
          return scoreB - scoreA;
        });

        return enhancedContacts;
      }

      return contacts;

    } catch (error) {
      console.error('Batch AI enhancement failed:', error);
      
      // Return original contacts with vector-only metadata on failure
      return this.formatResultsWithSimilarityInfo({
        high: contacts.filter(c => c.similarityTier === 'high'),
        medium: contacts.filter(c => c.similarityTier === 'medium'),
        low: contacts.filter(c => c.similarityTier === 'low'),
        filtered: []
      }, contacts.length);
    }
  }

  /**
   * Existing methods for backward compatibility
   */
  static canUseAIResearcher(sampleResult, subscriptionLevel) {
    return ['business', 'enterprise'].includes(subscriptionLevel);
  }

  /**
   * Clear all caches related to semantic search
   */
  static clearSearchCache() {
    contactCache.invalidate('semantic_search_');
    contactCache.invalidate('search_job_');
    console.log('Cleared semantic search cache');
  }

  /**
   * Get search statistics
   */
  static getSearchStats() {
    return {
      cache: contactCache.getStats(),
      history: {
        searches: this.loadSearchHistory().length,
        jobs: this.loadJobHistory().length
      }
    };
  }

  // Keep instance methods for backwards compatibility
  async search(...args) {
    return SemanticSearchService.search(...args);
  }
}