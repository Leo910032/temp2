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

 // lib/services/serviceContact/client/services/SemanticSearchService.js - ADD CLIENT DEBUGGING

/**
 * Enhanced categorizeContactsBySimilarity with debugging
 */
static categorizeContactsBySimilarity(vectorResults, subscriptionLevel) {
  const thresholds = this.getVectorThresholds(subscriptionLevel);
  
  console.log(`🔍 [ClientDebug] ========== CATEGORIZATION DEBUG ==========`);
  console.log(`🔍 [ClientDebug] Input: ${vectorResults.length} contacts`);
  console.log(`🔍 [ClientDebug] Subscription: ${subscriptionLevel}`);
  console.log(`🔍 [ClientDebug] Thresholds:`, thresholds);
  
  const categories = {
    high: [],
    medium: [],
    low: [],
    filtered: []
  };

  vectorResults.forEach((contact, index) => {
    const score = contact._vectorScore || 0;
    
    console.log(`🔍 [ClientDebug] Contact ${index + 1}: ${contact.name}`);
    console.log(`🔍 [ClientDebug] - Raw _vectorScore: ${contact._vectorScore}`);
    console.log(`🔍 [ClientDebug] - Used score: ${score}`);
    console.log(`🔍 [ClientDebug] - Debug info:`, contact._debugInfo);
    
    let categoryAssigned = '';
    
    if (score >= thresholds.high) {
      categories.high.push({ ...contact, similarityTier: 'high', vectorScore: score });
      categoryAssigned = 'high';
    } else if (score >= thresholds.medium) {
      categories.medium.push({ ...contact, similarityTier: 'medium', vectorScore: score });
      categoryAssigned = 'medium';
    } else if (score >= thresholds.low) {
      categories.low.push({ ...contact, similarityTier: 'low', vectorScore: score });
      categoryAssigned = 'low';
    } else if (score >= thresholds.minimum) {
      categories.filtered.push({ ...contact, similarityTier: 'filtered', vectorScore: score });
      categoryAssigned = 'filtered';
    } else {
      categoryAssigned = 'excluded';
    }
    
    console.log(`🔍 [ClientDebug] - Category: ${categoryAssigned}`);
    console.log(`🔍 [ClientDebug] - Score vs thresholds: ${score.toFixed(3)} vs High:${thresholds.high} Med:${thresholds.medium} Low:${thresholds.low} Min:${thresholds.minimum}`);
  });

  // Sort within each category by score (highest first)
  Object.keys(categories).forEach(key => {
    categories[key].sort((a, b) => (b.vectorScore || 0) - (a.vectorScore || 0));
  });

  console.log(`🔍 [ClientDebug] Final categorization:`, {
    high: categories.high.length,
    medium: categories.medium.length,
    low: categories.low.length,
    filtered: categories.filtered.length,
    totalProcessed: vectorResults.length
  });
  
  console.log(`🔍 [ClientDebug] High similarity contacts:`);
  categories.high.forEach((contact, i) => {
    console.log(`🔍 [ClientDebug] ${i + 1}. ${contact.name}: ${contact.vectorScore?.toFixed(6)}`);
  });

  console.log(`🔍 [ClientDebug] ========== END CATEGORIZATION DEBUG ==========`);

  return categories;
}

/**
 * Enhanced search with comprehensive debugging
 */
static async search(query, options = {}) {
  const { 
    userId, 
    subscriptionLevel = 'premium',
    maxResults = 10,
    enhanceResults = true,
    useReranking = true,
    streamingMode = false,
    onProgress = null,
    onResult = null,
    onError = null,
    useCache = true
  } = options;

  try {
    console.log(`🔍 [ClientDebug] ========== CLIENT SEARCH DEBUG ==========`);
    console.log(`🔍 [ClientDebug] Query: "${query}"`);
    console.log(`🔍 [ClientDebug] Options:`, {
      userId: userId?.substring(0, 8) + '...',
      subscriptionLevel,
      maxResults,
      enhanceResults,
      useReranking,
      streamingMode
    });

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Search query is required');
    }

    const cleanQuery = query.trim();
    
    // Generate cache key including reranking option
    const cacheKey = `semantic_search_${userId}_${btoa(cleanQuery)}_${subscriptionLevel}_${maxResults}_${enhanceResults}_${useReranking}_${streamingMode}`;
    
    // Try to get from cache first
    if (useCache) {
      try {
        const cached = contactCache.cache.get(cacheKey);
        if (cached && Date.now() < contactCache.expirationTimes.get(cacheKey)) {
          console.log(`🔍 [ClientDebug] Using cached results for: ${cleanQuery}`);
          
          // Debug cached results
          if (cached.results && cached.results.length > 0) {
            console.log(`🔍 [ClientDebug] Cached results preview:`);
            cached.results.slice(0, 3).forEach((contact, i) => {
              console.log(`🔍 [ClientDebug] ${i + 1}. ${contact.name}: Vector=${contact._vectorScore?.toFixed(6)}, Rerank=${contact.searchMetadata?.rerankScore?.toFixed(6)}, Hybrid=${contact.searchMetadata?.hybridScore?.toFixed(6)}`);
            });
          }
          
          this.addToSearchHistory(cleanQuery);
          return cached;
        }
      } catch (error) {
        console.warn(`🔍 [ClientDebug] Cache retrieval failed:`, error);
      }
    }

    console.log(`🔍 [ClientDebug] Starting fresh search - no cache hit`);
    this.addToSearchHistory(cleanQuery);

    // Step 1: Perform vector search with increased results for reranking
    const vectorMaxResults = useReranking ? Math.min(maxResults * 5, 50) : maxResults * 2;
    
    console.log(`🔍 [ClientDebug] Calling vector search API with maxResults: ${vectorMaxResults}`);
    
    const vectorSearchResponse = await ContactApiClient.post('/api/user/contacts/semantic-search', {
      query: cleanQuery,
      maxResults: vectorMaxResults,
      includeMetadata: true,
      trackCosts: true
    });

    console.log(`🔍 [ClientDebug] Vector search API response:`, {
      hasResults: !!vectorSearchResponse.results,
      resultCount: vectorSearchResponse.results?.length || 0,
      metadata: vectorSearchResponse.searchMetadata
    });

    const vectorResults = vectorSearchResponse.results || vectorSearchResponse || [];
    const serverMetadata = vectorSearchResponse.searchMetadata || {};

    console.log(`🔍 [ClientDebug] Vector results processing:`);
    console.log(`🔍 [ClientDebug] - Raw results count: ${vectorResults.length}`);
    
    if (vectorResults.length > 0) {
      console.log(`🔍 [ClientDebug] First 3 vector results:`);
      vectorResults.slice(0, 3).forEach((contact, i) => {
        console.log(`🔍 [ClientDebug] ${i + 1}. ${contact.name}:`);
        console.log(`🔍 [ClientDebug]    _vectorScore: ${contact._vectorScore}`);
        console.log(`🔍 [ClientDebug]    searchMetadata.score: ${contact.searchMetadata?.score}`);
        console.log(`🔍 [ClientDebug]    debugInfo:`, contact._debugInfo);
      });
      
      const scores = vectorResults.map(r => r._vectorScore).filter(s => s !== undefined);
      if (scores.length > 0) {
        const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        
        console.log(`🔍 [ClientDebug] Vector score statistics:`);
        console.log(`🔍 [ClientDebug] - Average: ${avgScore.toFixed(6)}`);
        console.log(`🔍 [ClientDebug] - Maximum: ${maxScore.toFixed(6)}`);
        console.log(`🔍 [ClientDebug] - Minimum: ${minScore.toFixed(6)}`);
        console.log(`🔍 [ClientDebug] - Range: ${(maxScore - minScore).toFixed(6)}`);
      }
    }

    if (vectorResults.length === 0) {
      console.log(`🔍 [ClientDebug] No vector results found - returning empty`);
      const emptyResult = {
        results: [],
        searchMetadata: {
          query: cleanQuery.substring(0, 100),
          totalResults: 0,
          message: 'No semantically similar contacts found',
          subscriptionLevel,
          timestamp: new Date().toISOString(),
          hasReranking: false
        }
      };
      
      if (useCache) {
        contactCache.set(cacheKey, emptyResult, 'default', 2 * 60 * 1000);
      }
      
      return emptyResult;
    }

    // Step 2: Categorize by vector similarity (for logging/metadata)
    console.log(`🔍 [ClientDebug] Categorizing results by similarity...`);
    const categorized = this.categorizeContactsBySimilarity(vectorResults, subscriptionLevel);
    
    // Step 3: Reranking step (if enabled and subscription supports it)
    let rerankedResults = vectorResults;
    let rerankMetadata = { fallback: true, cost: 0 };
    
    const canRerank = useReranking && ['premium', 'business', 'enterprise'].includes(subscriptionLevel);
    
    if (canRerank && vectorResults.length > 1) {
      console.log(`🔍 [ClientDebug] Starting reranking phase...`);
      
      const rerankResponse = await this.rerankContacts(cleanQuery, vectorResults, {
        subscriptionLevel,
        topN: Math.min(maxResults * 2, 20),
        trackCosts: true
      });
      
      if (rerankResponse.results && rerankResponse.results.length > 0) {
        rerankedResults = rerankResponse.results;
        rerankMetadata = rerankResponse.metadata;
        
        console.log(`🔍 [ClientDebug] Reranking successful:`);
        console.log(`🔍 [ClientDebug] - Original count: ${vectorResults.length}`);
        console.log(`🔍 [ClientDebug] - Reranked count: ${rerankedResults.length}`);
        console.log(`🔍 [ClientDebug] - Cost: ${rerankMetadata.cost || 0}`);
        
        console.log(`🔍 [ClientDebug] First 3 reranked results:`);
        rerankedResults.slice(0, 3).forEach((contact, i) => {
          console.log(`🔍 [ClientDebug] ${i + 1}. ${contact.name}:`);
          console.log(`🔍 [ClientDebug]    Vector: ${contact._vectorScore?.toFixed(6)}`);
          console.log(`🔍 [ClientDebug]    Rerank: ${contact.searchMetadata?.rerankScore?.toFixed(6)}`);
          console.log(`🔍 [ClientDebug]    Hybrid: ${contact.searchMetadata?.hybridScore?.toFixed(6)}`);
        });
      } else {
        console.log(`🔍 [ClientDebug] Reranking failed or returned no results, using vector results`);
      }
    } else {
      console.log(`🔍 [ClientDebug] Skipping reranking:`, {
        useReranking,
        subscriptionLevel,
        canRerank,
        resultCount: vectorResults.length
      });
    }

    // Continue with the rest of the search logic...
    const contactsForAI = rerankedResults.slice(0, maxResults);
    
    console.log(`🔍 [ClientDebug] Final contacts for AI (${contactsForAI.length}):`);
    contactsForAI.forEach((contact, i) => {
      const vectorScore = contact._vectorScore;
      const rerankScore = contact.searchMetadata?.rerankScore;
      const hybridScore = contact.searchMetadata?.hybridScore;
      
      console.log(`🔍 [ClientDebug] ${i + 1}. ${contact.name}:`);
      console.log(`🔍 [ClientDebug]    Vector: ${vectorScore?.toFixed(6) || 'undefined'}`);
      console.log(`🔍 [ClientDebug]    Rerank: ${rerankScore?.toFixed(6) || 'undefined'}`);
      console.log(`🔍 [ClientDebug]    Hybrid: ${hybridScore?.toFixed(6) || 'undefined'}`);
      console.log(`🔍 [ClientDebug]    Tier: ${contact.similarityTier || 'undefined'}`);
    });

    // Return simplified result for now to focus on debugging the vector scores
    const finalResult = {
      results: contactsForAI,
      searchMetadata: {
        query: cleanQuery.substring(0, 100),
        totalResults: contactsForAI.length,
        vectorCategories: {
          high: categorized.high.length,
          medium: categorized.medium.length,
          low: categorized.low.length,
          filtered: categorized.filtered.length
        },
        subscriptionLevel,
        enhancementLevel: 'vector_debug',
        hasReranking: canRerank && !rerankMetadata.fallback,
        rerankCost: rerankMetadata.cost || 0,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`🔍 [ClientDebug] ========== END CLIENT SEARCH DEBUG ==========`);
    
    return finalResult;

  } catch (error) {
    console.error(`🔍 [ClientDebug] Enhanced semantic search failed:`, error);
    
    if (error.status === 403) {
      throw new Error('Semantic search requires Premium subscription or higher');
    }
    
    throw new Error(error.message || 'Search failed. Please try again.');
  }
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

      if (rerankResponse.results) {
        console.log('Reranking complete:', {
          originalCount: contacts.length,
          rerankedCount: rerankResponse.results.length,
          cost: rerankResponse.metadata?.cost || 0,
          model: rerankResponse.metadata?.model
        });

        return {
          results: rerankResponse.results,
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

  /**
   * UPDATED: Enhanced search with smart vector filtering, reranking, and caching
   */
  static async search(query, options = {}) {
    const { 
      userId, 
      subscriptionLevel = 'premium',
      maxResults = 10,
      enhanceResults = true,
      useReranking = true,
      streamingMode = false,
      onProgress = null,
      onResult = null,
      onError = null,
      useCache = true
    } = options;

    try {
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Search query is required');
      }

      const cleanQuery = query.trim();
      
      // Generate cache key including reranking option
      const cacheKey = `semantic_search_${userId}_${btoa(cleanQuery)}_${subscriptionLevel}_${maxResults}_${enhanceResults}_${useReranking}_${streamingMode}`;
      
      // Try to get from cache first
      if (useCache) {
        try {
          const cached = contactCache.cache.get(cacheKey);
          if (cached && Date.now() < contactCache.expirationTimes.get(cacheKey)) {
            console.log(`💾 Using cached semantic search results for: ${cleanQuery}`);
            
            // Add to search history even for cached results
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
        cached: false
      });

      // Add to search history
      this.addToSearchHistory(cleanQuery);

      // Step 1: Perform vector search with increased results for reranking
      const vectorMaxResults = useReranking ? Math.min(maxResults * 5, 50) : maxResults * 2;
      
      const vectorSearchResponse = await ContactApiClient.post('/api/user/contacts/semantic-search', {
        query: cleanQuery,
        maxResults: vectorMaxResults,
        includeMetadata: true,
        trackCosts: true
      });

      const vectorResults = vectorSearchResponse.results || vectorSearchResponse || [];
      const serverMetadata = vectorSearchResponse.searchMetadata || {};

      console.log('Vector search complete:', {
        resultsFound: vectorResults.length,
        vectorMaxResults,
        averageScore: vectorResults.length > 0 
          ? (vectorResults.reduce((sum, r) => sum + (r._vectorScore || 0), 0) / vectorResults.length).toFixed(3)
          : 0
      });

      if (vectorResults.length === 0) {
        const emptyResult = {
          results: [],
          searchMetadata: {
            query: cleanQuery.substring(0, 100),
            totalResults: 0,
            message: 'No semantically similar contacts found',
            subscriptionLevel,
            timestamp: new Date().toISOString(),
            hasReranking: false
          }
        };
        
        // Cache empty results briefly
        if (useCache) {
          contactCache.set(cacheKey, emptyResult, 'default', 2 * 60 * 1000); // 2 minutes
        }
        
        return emptyResult;
      }

      // Step 2: Categorize by vector similarity (for logging/metadata)
      const categorized = this.categorizeContactsBySimilarity(vectorResults, subscriptionLevel);
      
      // Step 3: NEW - Reranking step (if enabled and subscription supports it)
      let rerankedResults = vectorResults;
      let rerankMetadata = { fallback: true, cost: 0 };
      
      const canRerank = useReranking && ['premium', 'business', 'enterprise'].includes(subscriptionLevel);
      
      if (canRerank && vectorResults.length > 1) {
        console.log('Starting reranking phase...');
        
        const rerankResponse = await this.rerankContacts(cleanQuery, vectorResults, {
          subscriptionLevel,
          topN: Math.min(maxResults * 2, 20), // Get more than final target for AI enhancement
          trackCosts: true
        });
        
        if (rerankResponse.results && rerankResponse.results.length > 0) {
          rerankedResults = rerankResponse.results;
          rerankMetadata = rerankResponse.metadata;
          
          console.log('Reranking successful:', {
            originalCount: vectorResults.length,
            rerankedCount: rerankedResults.length,
            cost: rerankMetadata.cost || 0
          });
        }
      } else {
        console.log('Skipping reranking:', {
          useReranking,
          subscriptionLevel,
          canRerank,
          resultCount: vectorResults.length
        });
      }

      // Step 4: Smart AI enhancement strategy (on reranked results)
      const canEnhance = enhanceResults && this.canUseAIResearcher(rerankedResults[0], subscriptionLevel);
      const contactsForAI = rerankedResults.slice(0, maxResults); // Final limit for AI processing

      let finalResult;

      if (canEnhance && streamingMode) {
        // STREAMING LOGIC: Start enhancement in background, return initial results immediately
        console.log('Streaming mode: Starting background AI enhancement on reranked results.');

        // Fire-and-forget the enhancement process
        this.enhanceResultsWithSmartProcessing(
          cleanQuery,
          this.categorizeContactsBySimilarity(contactsForAI, subscriptionLevel),
          {
            subscriptionLevel,
            trackCosts: true,
            streamingMode,
            maxResults,
            onProgress,
            onResult: (resultData) => {
              // Update cache with streaming results as they come in
              try {
                const currentCached = contactCache.cache.get(cacheKey);
                if (currentCached) {
                  // Update the cached results with new streaming data
                  const updatedResults = [...currentCached.results];
                  const existingIndex = updatedResults.findIndex(r => r.id === resultData.contact.id);
                  
                  if (existingIndex >= 0) {
                    updatedResults[existingIndex] = resultData.contact;
                  } else {
                    updatedResults.push(resultData.contact);
                  }
                  
                  // Re-sort by hybrid score (which now includes rerank score)
                  updatedResults.sort((a, b) => {
                    const scoreA = a.searchMetadata?.hybridScore || a.searchMetadata?.rerankScore || a.vectorScore || 0;
                    const scoreB = b.searchMetadata?.hybridScore || b.searchMetadata?.rerankScore || b.vectorScore || 0;
                    return scoreB - scoreA;
                  });
                  
                  const updatedResult = {
                    ...currentCached,
                    results: updatedResults
                  };
                  
                  contactCache.set(cacheKey, updatedResult, 'contacts');
                }
              } catch (error) {
                console.warn('Failed to update cache during streaming:', error);
              }
              
              if (onResult) onResult(resultData);
            },
            onError
          }
        ).catch(error => {
            console.error('Background AI streaming enhancement failed:', error);
            if (onError) onError({ type: 'stream_error', error: error.message || 'Unknown streaming error' });
        });

        // Immediately return reranked results for the UI to display
        finalResult = {
            results: contactsForAI,
            searchMetadata: {
                query: cleanQuery.substring(0, 100),
                totalResults: contactsForAI.length,
                vectorCategories: {
                    high: categorized.high.length,
                    medium: categorized.medium.length,
                    low: categorized.low.length,
                    filtered: categorized.filtered.length
                },
                subscriptionLevel,
                enhancementLevel: 'vector_streaming_ai_reranked',
                streamingMode,
                hasReranking: canRerank && !rerankMetadata.fallback,
                rerankCost: rerankMetadata.cost || 0,
                timestamp: new Date().toISOString()
            }
        };

      } else {
          // BATCH or VECTOR-ONLY LOGIC: Await the result and return the final list
          let enhancedResults;
          if (canEnhance) {
              // Batch mode: await the full result on reranked contacts
              console.log('Batch mode: Awaiting AI enhancement on reranked results.');
              enhancedResults = await this.enhanceResultsWithSmartProcessing(
                  cleanQuery,
                  this.categorizeContactsBySimilarity(contactsForAI, subscriptionLevel),
                  { subscriptionLevel, trackCosts: true, maxResults }
              );
          } else {
              // Vector + Rerank only mode
              console.log('Vector + Rerank only mode: Formatting results.');
              enhancedResults = this.formatResultsWithSimilarityInfo(
                this.categorizeContactsBySimilarity(contactsForAI, subscriptionLevel), 
                maxResults
              );
          }
          
          const finalResults = Array.isArray(enhancedResults) ? enhancedResults : enhancedResults.results || [];
          
          finalResult = {
              results: finalResults,
              searchMetadata: {
                  query: cleanQuery.substring(0, 100),
                  totalResults: finalResults.length,
                  vectorCategories: {
                      high: categorized.high.length,
                      medium: categorized.medium.length,
                      low: categorized.low.length,
                      filtered: categorized.filtered.length
                  },
                  subscriptionLevel,
                  enhancementLevel: finalResults.some(r => r.searchMetadata?.aiAnalysis) 
                    ? (canRerank && !rerankMetadata.fallback ? 'ai_powered_reranked' : 'ai_powered')
                    : (canRerank && !rerankMetadata.fallback ? 'vector_reranked' : 'vector_only'),
                  streamingMode,
                  hasReranking: canRerank && !rerankMetadata.fallback,
                  rerankCost: rerankMetadata.cost || 0,
                  timestamp: new Date().toISOString()
              }
          };
      }

      // Cache the result
      if (useCache && finalResult.results.length > 0) {
        const ttl = streamingMode ? 30 * 60 * 1000 : 10 * 60 * 1000; // 30min for streaming, 10min for batch
        contactCache.set(cacheKey, finalResult, 'contacts', ttl);
        
        // Save to job history for non-streaming results or when streaming is complete
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
          email: contact.email,
          company: contact.company,
          notes: contact.notes,
          message: contact.message,
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
        rerankOptimized: true // Flag for rerank-enhanced processing
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
                      hybridScore: this.calculateHybridScore(
                        enhancedContacts[contactIndex].vectorScore,
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
                
              case 'filtered':
                const filteredContact = enhancedContacts.find(c => c.name === data.contactName);
                console.log(`Filtered: ${data.contactName} (${data.reason}, Vector: ${filteredContact?.similarityTier || 'unknown'}, Rerank: ${filteredContact?.searchMetadata?.rerankScore?.toFixed(3) || 'N/A'})`);
                
                if (onProgress) {
                  onProgress({
                    type: 'filtered',
                    contactName: data.contactName,
                    reason: data.reason,
                    confidence: data.confidence,
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
    const { subscriptionLevel, trackCosts = false, processingStrategy } = options;
    
    try {
      console.log('Starting batch AI enhancement on reranked results:', {
        contactsCount: contacts.length,
        subscriptionLevel,
        processingStrategy
      });

      const payload = {
        originalQuery: query,
        contacts: contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          company: contact.company,
          notes: contact.notes,
          message: contact.message,
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
        rerankOptimized: true
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