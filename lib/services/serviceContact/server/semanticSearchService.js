// lib/services/serviceContact/server/semanticSearchService.js
// Server-side service for semantic search operations
// Handles Pinecone embeddings and Pinecone vector queries

import { adminDb } from '@/lib/firebaseAdmin';
import { API_COSTS } from '@/lib/services/constants/apiCosts';
import { SEMANTIC_SEARCH_CONFIG } from '@/lib/services/serviceContact/client/constants/contactConstants';
import { IndexManagementService } from './indexManagementService';
import { EmbeddingService } from './embeddingService';
import { QueryEnhancementService } from './queryEnhancementService';

/**
 * SemanticSearchService
 *
 * Architecture:
 * - Generates embeddings using Pinecone Inference API
 * - Queries Pinecone vector database
 * - Retrieves full contact data from Firestore
 * - Returns formatted results with metadata
 */
export class SemanticSearchService {
  /**
   * Perform semantic search for contacts
   *
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @returns {Promise<object>} Search results with metadata
   */
  static async search(userId, query, options = {}) {
 const {
    maxResults = SEMANTIC_SEARCH_CONFIG.DEFAULT_MAX_RESULTS,
    includeMetadata = SEMANTIC_SEARCH_CONFIG.DEFAULT_INCLUDE_METADATA,
    searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    minVectorScore = null,
    subscriptionLevel = 'premium',
    sessionId = null, // NEW: Accept sessionId for cost tracking
    enhanceQuery = true // NEW: Option to enable/disable enhancement
  } = options;

    console.log(`🔍 [SemanticSearchService] [${searchId}] Starting search for user: ${userId}`);
  try {
    // Step 0: Enhance query with AI (NEW!)
    let queryToUse = query;
    let detectedLanguage = 'eng';
    let enhancementMetadata = null;

    if (enhanceQuery) {
      console.log(`🚀 [SemanticSearchService] [${searchId}] Step 0: Enhancing query...`);
      const enhancementStartTime = Date.now();

      const enhancement = await QueryEnhancementService.enhanceQuery(query, {
        sessionId,
        userId,
        enhanceId: `${searchId}_enhance`
      });

      queryToUse = enhancement.enhancedQuery;
      detectedLanguage = enhancement.language;
      enhancementMetadata = enhancement.metadata;

      const enhancementTime = Date.now() - enhancementStartTime;
      
      console.log(`✅ [SemanticSearchService] [${searchId}] Query enhanced (${enhancementTime}ms):`, {
        original: query.substring(0, 50),
        enhanced: queryToUse.substring(0, 50),
        language: detectedLanguage,
        cached: enhancementMetadata.cached,
        cacheType: enhancementMetadata.cacheType
      });
    }

      console.log(`🧠 [SemanticSearchService] [${searchId}] Step 1: Generating embedding...`);
    const embeddingStartTime = Date.now();

    const queryEmbedding = await EmbeddingService.generateEmbedding(queryToUse); // Use enhanced query

      const embeddingTime = Date.now() - embeddingStartTime;
      console.log(`🧠 [SemanticSearchService] [${searchId}] Embedding generated:`, {
        dimension: queryEmbedding.length,
        time: `${embeddingTime}ms`
      });

      // Step 2: Query Pinecone for similar vectors
      console.log(`📊 [SemanticSearchService] [${searchId}] Querying Pinecone...`);
      const searchStartTime = Date.now();

      const namespace = `user_${userId}`;
      const index = await IndexManagementService.getNamespacedIndex(userId);

      const pineconeQuery = {
        vector: queryEmbedding,
        topK: maxResults,
        includeMetadata,
        includeValues: false
      };

      const searchResults = await index.query(pineconeQuery);
      const searchDuration = Date.now() - searchStartTime;

      // Get raw results before filtering
      const rawMatches = searchResults.matches || [];
      const rawCount = rawMatches.length;
      const rawScoreRange = rawCount > 0 ? {
        min: Math.min(...rawMatches.map(m => m.score)),
        max: Math.max(...rawMatches.map(m => m.score))
      } : { min: 0, max: 0 };

      console.log(`📊 [SemanticSearchService] [${searchId}] Pinecone search complete:`, {
        matches: rawCount,
        duration: `${searchDuration}ms`,
        scoreRange: `${rawScoreRange.min.toFixed(4)} - ${rawScoreRange.max.toFixed(4)}`
      });

      // Apply threshold filtering if minVectorScore is provided
      let filteredMatches = rawMatches;
      let filteringStats = null;

      if (minVectorScore !== null && minVectorScore > 0) {
        console.log(`🎯 [SemanticSearchService] [${searchId}] Applying vector threshold filter: ${minVectorScore} (${(minVectorScore * 100).toFixed(0)}% minimum similarity)`);

        filteredMatches = rawMatches.filter(match => match.score >= minVectorScore);
        const filteredCount = filteredMatches.length;
        const removedCount = rawCount - filteredCount;
        const filteredScoreRange = filteredCount > 0 ? {
          min: Math.min(...filteredMatches.map(m => m.score)),
          max: Math.max(...filteredMatches.map(m => m.score))
        } : { min: 0, max: 0 };

        console.log(`✅ [SemanticSearchService] [${searchId}] After threshold filter:`, {
          kept: filteredCount,
          removed: removedCount,
          scoreRange: filteredCount > 0 ? `${filteredScoreRange.min.toFixed(4)} - ${filteredScoreRange.max.toFixed(4)}` : 'N/A'
        });

        filteringStats = {
          thresholdUsed: minVectorScore,
          rawCount,
          filteredCount,
          removedCount,
          rawScoreRange,
          filteredScoreRange
        };

        if (removedCount > 0) {
          console.log(`📉 [SemanticSearchService] [${searchId}] Filtered out: ${removedCount} contacts below ${(minVectorScore * 100).toFixed(0)}% similarity threshold`);
        }

        if (filteredCount === 0) {
          console.log(`⚠️  [SemanticSearchService] [${searchId}] WARNING: No results passed threshold filter. Consider lowering threshold.`);
        }
      } else {
        console.log(`ℹ️  [SemanticSearchService] [${searchId}] No threshold filtering applied (minVectorScore: ${minVectorScore})`);
      }

      // Update searchResults with filtered matches
      searchResults.matches = filteredMatches;

      // Step 3: Calculate actual costs
      const costEstimate = EmbeddingService.estimateCost(query);
      const embeddingCost = costEstimate.embeddingCost;
      const searchCost = API_COSTS.PINECONE.QUERY_BASE;
      const totalCost = embeddingCost + searchCost;

      console.log(`💾 [SemanticSearchService] [${searchId}] Cost calculation:`, {
        tokens: costEstimate.estimatedTokens,
        embeddingCost: embeddingCost.toFixed(6),
        searchCost: searchCost.toFixed(6),
        totalCost: totalCost.toFixed(6)
      });

      // Step 4: Retrieve full contact data from Firestore
      console.log(`📋 [SemanticSearchService] [${searchId}] Fetching contact details...`);
      const contacts = await this._retrieveContactData(userId, searchResults.matches, searchId, namespace);

      console.log(`📋 [SemanticSearchService] [${searchId}] Contacts retrieved: ${contacts.length}`);

      // Step 5: Return formatted results
       const result = {
      results: contacts,
      searchMetadata: {
        query: query.substring(0, 100),
        enhancedQuery: queryToUse !== query ? queryToUse.substring(0, 100) : undefined, // NEW
        detectedLanguage, // NEW
        queryEnhancement: enhancementMetadata, // NEW
        totalResults: contacts.length,
        namespace,
        costs: {
      embedding: embeddingCost,
      search: searchCost,
      queryEnhancement: enhancementMetadata?.cost || 0,
      total: totalCost + (enhancementMetadata?.cost || 0),
      tokens: costEstimate.estimatedTokens // ✅ ADD THIS LINE
    },
        searchDuration,
        embeddingTime,
        timestamp: new Date().toISOString(),
        searchId,
        sessionId, // NEW: Include sessionId in response
        thresholdFiltering: filteringStats
      }
    };

      console.log(`✅ [SemanticSearchService] [${searchId}] Search complete:`, {
        results: contacts.length,
        cost: totalCost.toFixed(6),
        totalTime: `${embeddingTime + searchDuration}ms`
      });

      return result;

    } catch (error) {
      console.error(`❌ [SemanticSearchService] [${searchId}] Search failed:`, {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Retrieve full contact data from Firestore based on Pinecone matches
   * @private
   */
  static async _retrieveContactData(userId, matches, searchId, namespace) {
    if (!matches || matches.length === 0) {
      return [];
    }

    const userContactsDoc = await adminDb.collection('Contacts').doc(userId).get();

    if (!userContactsDoc.exists) {
      console.log(`📋 [SemanticSearchService] [${searchId}] No contacts document found for user`);
      return [];
    }

    const allUserContacts = userContactsDoc.data().contacts || [];
    const contactsMap = new Map(allUserContacts.map(contact => [contact.id, contact]));

    const validContacts = matches.map(match => {
      const contactData = contactsMap.get(match.id);
      if (contactData) {
        // Log dynamic fields for debugging
        if (contactData.dynamicFields?.length > 0) {
          console.log(`📋 [SemanticSearchService] [${searchId}] Contact ${contactData.name} has ${contactData.dynamicFields.length} dynamic fields:`,
            contactData.dynamicFields.map(f => `${f.label}: ${f.value}`));
        }

        return {
          ...contactData,
          id: match.id,
          _vectorScore: match.score,
          searchMetadata: {
            score: match.score,
            namespace,
            retrievedAt: new Date().toISOString(),
            searchId,
            dynamicFieldsFromVector: Object.entries(match.metadata || {})
              .filter(([key]) => !['userId', 'name', 'email', 'company', 'subscriptionTier', 'lastUpdated', 'source', 'embeddingModel'].includes(key))
              .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
          }
        };
      }
      return null;
    }).filter(contact => contact !== null);

    // Log summary of dynamic fields found
    const contactsWithDynamicFields = validContacts.filter(c => c.dynamicFields?.length > 0);
    if (contactsWithDynamicFields.length > 0) {
      console.log(`📋 [SemanticSearchService] [${searchId}] Found ${contactsWithDynamicFields.length} contacts with dynamic fields`);
    }

    return validContacts;
  }

  /**
   * Estimate cost for a semantic search operation
   * UPDATED: Now uses Pinecone Inference API pricing
   *
   * @param {string} query - Search query
   * @returns {object} Cost estimate
   */
  static estimateCost(query) {
    const estimatedTokens = Math.ceil(query.length / 4);
    const embeddingCost = (estimatedTokens / 1000000) * API_COSTS.PINECONE_INFERENCE.MULTILINGUAL_E5_LARGE.PER_MILLION;
    const searchCost = API_COSTS.PINECONE.QUERY_BASE;
    const totalCost = embeddingCost + searchCost;

    return {
      estimatedTokens,
      embeddingCost,
      searchCost,
      totalCost
    };
  }
}