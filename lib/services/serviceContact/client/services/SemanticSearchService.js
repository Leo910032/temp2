// lib/services/serviceContact/client/services/SemanticSearchService.js
// Client-side service for semantic search - Thin client layer
// Handles API communication and local storage management

"use client"

import { ContactApiClient } from '@/lib/services/core/ApiClient';
import {
  getVectorThresholds,
  getRerankThresholds,
  getConfidenceThreshold,
  getMinimumVectorThreshold,
  getMinimumRerankThreshold,
  SEMANTIC_SEARCH_CONFIG,
  CONFIDENCE_THRESHOLDS
} from '../constants/contactConstants';

/**
 * SemanticSearchService
 *
 * Architecture:
 * - Client-side only (no business logic)
 * - Calls API routes for all operations
 * - Manages local storage (search history, job cache)
 * - Provides helper functions for result categorization
 */
export class SemanticSearchService {
  constructor() {
    this.searchHistory = SemanticSearchService.loadSearchHistory();
    this.jobHistory = SemanticSearchService.loadJobHistory();
  }

  /**
   * Get search history from localStorage
   * Returns array of search history items with metadata
   */
  static getSearchHistory() {
    try {
      const history = localStorage.getItem('semantic_search_history');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error reading search history:', error);
      return [];
    }
  }

  /**
   * Load search history from localStorage (legacy compatibility)
   */
  static loadSearchHistory() {
    return this.getSearchHistory();
  }

  /**
   * Save a search query to history with metadata
   * @param {string} query - The search query
   * @param {number} resultsCount - Number of results returned
   */
  static saveToHistory(query, resultsCount = 0) {
    try {
      const history = this.getSearchHistory();

      // Don't save empty queries
      if (!query || query.trim().length === 0) return;

      // Check if query already exists
      const existingIndex = history.findIndex(item => item.query.toLowerCase() === query.toLowerCase());

      if (existingIndex !== -1) {
        // Update existing entry (move to top, update timestamp and count)
        const existing = history[existingIndex];
        history.splice(existingIndex, 1);
        history.unshift({
          query,
          resultsCount,
          timestamp: Date.now(),
          searchCount: existing.searchCount + 1
        });
      } else {
        // Add new entry at the top
        history.unshift({
          query,
          resultsCount,
          timestamp: Date.now(),
          searchCount: 1
        });
      }

      // Keep only last 20 searches
      const trimmedHistory = history.slice(0, 20);

      localStorage.setItem('semantic_search_history', JSON.stringify(trimmedHistory));

      console.log('💾 Search history updated:', query);
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }

  /**
   * Save search history to localStorage (legacy compatibility)
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
   * Add query to search history (legacy - simplified version)
   */
  static addToSearchHistory(query) {
    if (!query || query.trim().length < 3) return;

    const history = this.loadSearchHistory();
    const trimmedQuery = query.trim();

    // Check if it's the old format (array of strings)
    if (history.length > 0 && typeof history[0] === 'string') {
      // Migrate to new format
      const migrated = history.map(q => ({
        query: q,
        resultsCount: 0,
        timestamp: Date.now(),
        searchCount: 1
      }));
      localStorage.setItem('semantic_search_history', JSON.stringify(migrated));
    }

    // Don't update here - let saveToHistory handle it
  }

  /**
   * Clear search history
   */
  static clearSearchHistory() {
    try {
      localStorage.removeItem('semantic_search_history');
      console.log('🗑️ Search history cleared');
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }

  /**
   * Remove a specific search from history
   * @param {string} query - The query to remove
   */
  static removeFromHistory(query) {
    try {
      const history = this.getSearchHistory();
      const filtered = history.filter(item => item.query !== query);
      localStorage.setItem('semantic_search_history', JSON.stringify(filtered));
      console.log('🗑️ Removed from history:', query);
    } catch (error) {
      console.error('Error removing from history:', error);
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
   * Save completed search job to history and cache
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

      const ttl = 60 * 60 * 1000; // 1 hour
      const expiresAt = Date.now() + ttl;

      const jobDataToCache = {
        payload: { results, metadata, query },
        expiresAt: expiresAt
      };

      localStorage.setItem(`search_job_data_${jobId}`, JSON.stringify(jobDataToCache));

      jobs.push(jobMetadata);

      // Keep only last 50 jobs
      const trimmed = jobs.slice(-50);
      localStorage.setItem('semantic_search_jobs', JSON.stringify(trimmed));

      return jobMetadata;
    } catch (error) {
      console.warn('Failed to save search job:', error);
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
   * Load job from persistent cache
   */
  static async loadSearchJob(jobId) {
    try {
      const itemStr = localStorage.getItem(`search_job_data_${jobId}`);
      if (!itemStr) {
        console.log(`❌ Search job not found: ${jobId}`);
        return null;
      }

      const item = JSON.parse(itemStr);
      const now = Date.now();

      if (now > item.expiresAt) {
        console.log(`⌛️ Cached search job expired: ${jobId}`);
        localStorage.removeItem(`search_job_data_${jobId}`);
        return null;
      }

      console.log(`📋 Loaded cached search job: ${jobId}`);
      return item.payload;

    } catch (error) {
      console.warn('Failed to load search job:', error);
      localStorage.removeItem(`search_job_data_${jobId}`);
      return null;
    }
  }

  /**
   * Assign similarity tier to a contact
   */
  static assignSimilarityTier(contact, subscriptionLevel) {
    const thresholds = getVectorThresholds(subscriptionLevel);
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
   * Categorize contacts by similarity
   */
  static categorizeContactsBySimilarity(results, subscriptionLevel) {
    const isReranked = results[0]?.searchMetadata?.rerankScore !== undefined;

    const thresholds = isReranked
      ? getRerankThresholds()
      : getVectorThresholds(subscriptionLevel);

    console.log(`[SemanticSearch] Categorizing using ${isReranked ? 'RERANK' : 'VECTOR'} thresholds:`, thresholds);

    const categories = { high: [], medium: [], low: [] };

    results.forEach(contact => {
      const score = isReranked ? (contact.searchMetadata.rerankScore || 0) : (contact._vectorScore || 0);

      let tier = 'low';
      if (score >= thresholds.high) {
        tier = 'high';
      } else if (score >= thresholds.medium) {
        tier = 'medium';
      }

      contact.similarityTier = tier;
      categories[tier].push(contact);
    });

    console.log(`[SemanticSearch] Categorized:`, {
      high: categories.high.length,
      medium: categories.medium.length,
      low: categories.low.length
    });

    return categories;
  }

  /**
   * Rerank contacts using Cohere API
   * SIMPLIFIED: Always uses rerank-v3.5 (best model for all languages)
   * detectedLanguage is passed for analytics/logging only, not model selection
   */
  static async rerankContacts(query, contacts, options = {}) {
    const {
      subscriptionLevel = 'premium',
      topN = SEMANTIC_SEARCH_CONFIG.DEFAULT_RERANK_TOP_N,
      // THRESHOLD CALIBRATION: Lowered from 0.01 to 0.001 (2025-01-16)
      // With YAML documents, Cohere scores are more granular.
      // Valid matches can score 0.001-0.01. Previous 0.01 was too aggressive.
      minConfidence = 0.001, // Minimum rerank relevance threshold
      trackCosts = true,
      sessionId = null, // Accept sessionId for multi-step tracking
      detectedLanguage // For logging/analytics only, not model selection
    } = options;

    try {
      console.log('[SemanticSearch] Starting reranking:', {
        query: query.substring(0, 50) + '...',
        contactsCount: contacts.length,
        detectedLanguage: detectedLanguage || 'not detected',
        model: 'rerank-v3.5 (always)',
        topN,
        minConfidence: minConfidence !== null ? minConfidence : 'not set (using topN)',
        sessionId: sessionId || 'none'
      });

      const rerankResponse = await ContactApiClient.post('/api/user/contacts/rerank', {
        query,
        contacts,
        topN: Math.min(topN, contacts.length),
        minConfidence, // Pass threshold to API
        trackCosts,
        sessionId, // Pass sessionId to API
        detectedLanguage // Passed for analytics/logging, not model selection
      });

      if (rerankResponse.results) {
        console.log('[SemanticSearch] Reranking complete:', {
          originalCount: contacts.length,
          rerankedCount: rerankResponse.results.length,
          cost: rerankResponse.metadata?.cost || 0
        });

        // Re-attach original IDs
        const resultsWithIds = rerankResponse.results.map((rerankedContact, index) => {
          const originalContact = contacts.find(c => c.id === rerankedContact.id) || contacts[index];
          return {
            ...originalContact,
            ...rerankedContact,
            id: originalContact.id
          };
        });

        return {
          results: resultsWithIds,
          metadata: rerankResponse.metadata
        };
      }

      // Fallback
      console.warn('[SemanticSearch] Reranking returned no results, using fallback');
      return {
        results: contacts.slice(0, topN),
        metadata: { fallback: true, cost: 0 }
      };

    } catch (error) {
      console.error('[SemanticSearch] Reranking failed:', error);

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
   * Main semantic search method
   */
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
      useCache = true,
      locale // NEW: UI locale for language-based model selection (en, fr, es, vm, zh)
    } = options;

    try {
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Search query is required');
      }

      const cleanQuery = query.trim();

      // Check cache
      const cacheKey = `semantic_search_${userId}_${btoa(cleanQuery)}_${subscriptionLevel}_${maxResults}_${enhanceResults}_${useReranking}`;

      if (useCache) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() < parsed.expiresAt) {
              console.log(`[SemanticSearch] Using cached results`);
              // Save to history with results count
              const resultsCount = parsed.payload?.results?.length || 0;
              this.saveToHistory(cleanQuery, resultsCount);
              return parsed.payload;
            }
          }
        } catch (error) {
          console.warn('[SemanticSearch] Cache retrieval failed:', error);
        }
      }

      // Get thresholds based on subscription level
      const minVectorScore = getMinimumVectorThreshold(subscriptionLevel);
      const minRerankScore = getMinimumRerankThreshold();
      const vectorMaxResults = CONFIDENCE_THRESHOLDS.FALLBACK_MAX_RESULTS.vectorSearch;

      console.log('[SemanticSearch] Starting search with thresholds:', {
        queryLength: cleanQuery.length,
        subscriptionLevel,
        streamingMode,
        enhanceResults,
        useReranking,
        minVectorScore,
        minRerankScore: useReranking ? minRerankScore : 'N/A (reranking disabled)',
        vectorMaxResults
      });

      // Step 1: Vector search (generates sessionId)
      // Use threshold filtering instead of hard-coded multipliers
      const vectorSearchResponse = await ContactApiClient.post('/api/user/contacts/semantic-search', {
        query: cleanQuery,
        maxResults: vectorMaxResults, // Use fallback max limit
        includeMetadata: true,
        trackCosts: true,
        minVectorScore, // Apply threshold filtering
        locale // NEW: Pass UI locale to API
      });

      const vectorResults = vectorSearchResponse.results || [];
      const sessionId = vectorSearchResponse.sessionId; // Get sessionId from API response

      const vectorLogData = {
        resultsFound: vectorResults.length,
        sessionId: sessionId || 'none'
      };

      // Add threshold filtering info if available
      if (vectorSearchResponse.searchMetadata?.thresholdFiltering) {
        const stats = vectorSearchResponse.searchMetadata.thresholdFiltering;
        vectorLogData.thresholdUsed = stats.thresholdUsed;
        vectorLogData.rawResults = stats.rawCount;
        vectorLogData.filteredOut = stats.removedCount;
      }

      console.log('[SemanticSearch] Vector search complete:', vectorLogData);

      if (vectorResults.length === 0) {
        const emptyResult = {
          results: [],
          searchMetadata: {
            query: cleanQuery,
            totalResults: 0,
            vectorCategories: { high: 0, medium: 0, low: 0 }
          }
        };

        if (useCache) {
          const ttl = 2 * 60 * 1000; // 2 minutes
          localStorage.setItem(cacheKey, JSON.stringify({
            payload: emptyResult,
            expiresAt: Date.now() + ttl
          }));
        }

        return emptyResult;
      }

      // Initial categorization
      const initialVectorCategories = this.categorizeContactsBySimilarity(vectorResults, subscriptionLevel);

      let finalDisplayResults = vectorResults;
      let rerankMetadata = { fallback: true, cost: 0 };
      const canRerank = useReranking && ['premium', 'business', 'enterprise'].includes(subscriptionLevel);

      // Step 2: Rerank if applicable
      if (canRerank && vectorResults.length > 1) {
        // Extract detected language from vector search response (for analytics/logging only)
        const detectedLanguage = vectorSearchResponse.searchMetadata?.detectedLanguage || null;

        console.log('[SemanticSearch] Starting reranking:', {
          detectedLanguage: detectedLanguage || 'not detected',
          model: 'rerank-v3.5 (always - best model for all languages)'
        });

        const rerankResponse = await this.rerankContacts(cleanQuery, vectorResults, {
          subscriptionLevel,
          topN: maxResults,
          minConfidence: minRerankScore,
          trackCosts: true,
          sessionId,
          detectedLanguage // For analytics/logging only, not model selection
        });

        if (rerankResponse.results && rerankResponse.results.length > 0) {
          finalDisplayResults = rerankResponse.results;
          rerankMetadata = rerankResponse.metadata;

          // Log threshold filtering stats
          if (rerankMetadata.thresholdFiltering) {
            console.log('[SemanticSearch] Rerank threshold filtering:', {
              threshold: rerankMetadata.thresholdFiltering.thresholdUsed,
              kept: rerankMetadata.thresholdFiltering.finalCount,
              removed: rerankMetadata.thresholdFiltering.removedCount
            });
          }
        }
      } 
      
      
      else {
        // No reranking - sort by vector score and apply reasonable limit
        finalDisplayResults.sort((a, b) => (b._vectorScore || 0) - (a._vectorScore || 0));
        finalDisplayResults = finalDisplayResults.slice(0, Math.min(maxResults, 30));
      }

      // Re-categorize final results
      this.categorizeContactsBySimilarity(finalDisplayResults, subscriptionLevel);

      const canEnhance = enhanceResults && this.canUseAIResearcher(finalDisplayResults[0], subscriptionLevel);

      let finalResult;
      if (canEnhance && streamingMode) {
        // Streaming mode
        console.log('[SemanticSearch] Starting streaming AI enhancement...');
        const contactsForAI = finalDisplayResults.slice(0, 10);

        // Fire and forget
        this.enhanceResultsWithStreaming(
          cleanQuery,
          contactsForAI,
          {
            subscriptionLevel,
            trackCosts: true,
            queryLanguage,
            sessionId, // Pass sessionId for session tracking
            onProgress,
            onResult,
            onError
          }
        ).catch(error => {
          console.error('[SemanticSearch] Streaming enhancement failed:', error);
          if (onError) onError({ type: 'stream_error', error: error.message });
        });

        finalResult = {
          results: finalDisplayResults,
          searchMetadata: {
            query: cleanQuery.substring(0, 100),
            totalResults: finalDisplayResults.length,
            vectorCategories: {
              high: initialVectorCategories.high.length,
              medium: initialVectorCategories.medium.length,
              low: initialVectorCategories.low.length
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

        // Save to history with results count
        this.saveToHistory(cleanQuery, finalDisplayResults.length);

      } else {
        // Batch mode
        let enhancedResults;
        if (canEnhance) {
          const contactsForAI = finalDisplayResults.slice(0, 10);
          enhancedResults = await this.enhanceResultsWithBatch(
            cleanQuery,
            contactsForAI,
            { subscriptionLevel, trackCosts: true, queryLanguage, sessionId }
          );
        } else {
          enhancedResults = finalDisplayResults;
        }

        const finalEnhancedResults = Array.isArray(enhancedResults) ? enhancedResults : enhancedResults.results || [];

        finalResult = {
          results: finalEnhancedResults,
          sessionId, // Include sessionId for feedback loop
          searchMetadata: {
            query: cleanQuery.substring(0, 100),
            totalResults: finalEnhancedResults.length,
            vectorCategories: {
              high: initialVectorCategories.high.length,
              medium: initialVectorCategories.medium.length,
              low: initialVectorCategories.low.length
            },
            subscriptionLevel,
            enhancementLevel: finalEnhancedResults.some(r => r.searchMetadata?.aiAnalysis)
              ? (canRerank && !rerankMetadata.fallback ? 'ai_powered_reranked' : 'ai_powered')
              : (canRerank && !rerankMetadata.fallback ? 'vector_reranked' : 'vector_only'),
            streamingMode,
            hasReranking: canRerank && !rerankMetadata.fallback,
            rerankCost: rerankMetadata.cost || 0,
            timestamp: new Date().toISOString(),
            sessionId // Also include in metadata for consistency
          }
        };

        // Save to history with results count
        this.saveToHistory(cleanQuery, finalEnhancedResults.length);
      }

      // Cache result
      if (useCache && finalResult.results.length > 0) {
        const ttl = streamingMode ? SEMANTIC_SEARCH_CONFIG.STREAMING_CACHE_TTL_MS : SEMANTIC_SEARCH_CONFIG.CACHE_TTL_MS;
        localStorage.setItem(cacheKey, JSON.stringify({
          payload: finalResult,
          expiresAt: Date.now() + ttl
        }));

        if (!streamingMode) {
          this.saveSearchJob(cleanQuery, finalResult.results, finalResult.searchMetadata);
        }
      }

      return finalResult;

    } catch (error) {
      console.error('[SemanticSearch] Search failed:', error);
      if (error.status === 403) {
        throw new Error('Semantic search requires Premium subscription or higher');
      }
      throw new Error(error.message || 'Search failed. Please try again.');
    }
  }

  /**
   * Enhance results with streaming AI
   */
  static async enhanceResultsWithStreaming(query, contacts, options = {}) {
    const {
      subscriptionLevel = 'business',
      trackCosts = false,
      queryLanguage = 'en',
      sessionId = null, // Accept sessionId for multi-step tracking
      onProgress = null,
      onResult = null,
      onError = null
    } = options;

    try {
      console.log('[SemanticSearch] Starting streaming AI enhancement', {
        sessionId: sessionId || 'none'
      });

      const payload = {
        originalQuery: query,
        contacts: contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          company: contact.company,
          jobTitle: contact.jobTitle,
          phone: contact.phone,
          website: contact.website,
          notes: contact.notes,
          message: contact.message,
          dynamicFields: contact.dynamicFields || [],
          vectorScore: contact._vectorScore || contact.vectorScore,
          rerankScore: contact.searchMetadata?.rerankScore,
          similarityTier: contact.similarityTier
        })),
        subscriptionLevel,
        trackCosts,
        mode: 'streaming',
        queryLanguage,
        sessionId // Pass sessionId to API
      };

      const token = await ContactApiClient.getAuthToken();

      const response = await fetch('/api/user/contacts/ai-enhance-results', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Process stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.type === 'progress' && onProgress) {
              onProgress(data);
            } else if (data.type === 'result' && onResult) {
              onResult(data);
            } else if (data.type === 'error' && onError) {
              onError(data);
            } else if (data.type === 'complete') {
              console.log('[SemanticSearch] Streaming complete');
            }
          } catch (parseError) {
            // Skip non-JSON lines
          }
        }
      }

    } catch (error) {
      console.error('[SemanticSearch] Streaming enhancement failed:', error);
      if (onError) onError({ type: 'stream_error', error: error.message });
      throw error;
    }
  }

  /**
   * Enhance results with batch AI
   */
  static async enhanceResultsWithBatch(query, contacts, options = {}) {
    const { subscriptionLevel, trackCosts = false, queryLanguage = 'en', sessionId = null } = options;

    try {
      console.log('[SemanticSearch] Starting batch AI enhancement', {
        sessionId: sessionId || 'none'
      });

      const payload = {
        originalQuery: query,
        contacts: contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          company: contact.company,
          jobTitle: contact.jobTitle,
          phone: contact.phone,
          website: contact.website,
          notes: contact.notes,
          message: contact.message,
          dynamicFields: contact.dynamicFields || [],
          vectorScore: contact._vectorScore || contact.vectorScore,
          rerankScore: contact.searchMetadata?.rerankScore,
          similarityTier: contact.similarityTier
        })),
        subscriptionLevel,
        trackCosts,
        mode: 'batch',
        queryLanguage,
        sessionId // Pass sessionId to API
      };

      const response = await ContactApiClient.post('/api/user/contacts/ai-enhance-results', payload);

      if (response.insights) {
        // Merge AI insights with contacts
        const enhancedContacts = contacts.map(contact => {
          const insight = response.insights.find(r => r.contactId === contact.id);

          if (insight) {
            return {
              ...contact,
              searchMetadata: {
                ...contact.searchMetadata,
                enhancementLevel: 'ai_powered',
                aiAnalysis: {
                  matchExplanation: insight.explanation,
                  relevanceFactors: insight.factors,
                  strategicQuestions: insight.strategicQuestions,
                  confidenceScore: insight.confidence
                }
              }
            };
          }

          return contact;
        });

        return enhancedContacts;
      }

      return contacts;

    } catch (error) {
      console.error('[SemanticSearch] Batch enhancement failed:', error);
      return contacts;
    }
  }

  /**
   * Check if AI researcher can be used
   */
  static canUseAIResearcher(sampleResult, subscriptionLevel) {
    return ['business', 'enterprise'].includes(subscriptionLevel);
  }

  /**
   * Clear search cache
   */
  static clearSearchCache() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('semantic_search_') || key.startsWith('search_job_')) {
          localStorage.removeItem(key);
        }
      });
      console.log('[SemanticSearch] Cache cleared');
    } catch (error) {
      console.warn('[SemanticSearch] Failed to clear cache:', error);
    }
  }

  /**
   * Get search statistics
   */
  static getSearchStats() {
    return {
      history: {
        searches: this.loadSearchHistory().length,
        jobs: this.loadJobHistory().length
      }
    };
  }

  // Instance methods for backwards compatibility
  async search(...args) {
    return SemanticSearchService.search(...args);
  }
}
