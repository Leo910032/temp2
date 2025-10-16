// lib/services/serviceContact/server/indexManagementService.js
// Server-side service for Pinecone index management
// Handles index creation, caching, and statistics

import { Pinecone } from '@pinecone-database/pinecone';
import { SEMANTIC_SEARCH_CONFIG } from '@/lib/services/serviceContact/client/constants/contactConstants';

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

/**
 * IndexManagementService
 *
 * Architecture:
 * - Server-side only (Pinecone operations require API key)
 * - Manages Pinecone index lifecycle
 * - Caches index instance for performance
 * - Auto-creates index if it doesn't exist
 */
export class IndexManagementService {
  // Private static cache for index instance
  static _indexInstance = null;

  /**
   * Get or create Pinecone index
   * Automatically creates the index if it doesn't exist
   * Caches the index instance for performance
   *
   * @returns {Promise<PineconeIndex>} Pinecone index instance
   */
  static async getOrCreateIndex() {
    const indexName = SEMANTIC_SEARCH_CONFIG.INDEX_NAME;
    const indexStartTime = Date.now();

    try {
      // Return cached instance if available
      if (this._indexInstance) {
        console.log(`📦 [IndexManagement] Using cached index: ${indexName}`);
        return this._indexInstance;
      }

      console.log(`🔍 [IndexManagement] Checking if index exists: ${indexName}`);

      // Check if index exists
      const listStartTime = Date.now();
      const indexList = await pinecone.listIndexes();
      const listDuration = Date.now() - listStartTime;

      console.log(`✅ [IndexManagement] Listed indexes in ${listDuration}ms`);

      const indexExists = indexList.indexes?.some(index => index.name === indexName);

      if (!indexExists) {
        console.log(`⚠️ [IndexManagement] Index does not exist. Creating: ${indexName}`);
        console.log(`📊 [IndexManagement] Using dimensions: ${SEMANTIC_SEARCH_CONFIG.EMBEDDING_DIMENSION} (${SEMANTIC_SEARCH_CONFIG.EMBEDDING_MODEL})`);

        const createStartTime = Date.now();

        await pinecone.createIndex({
          name: indexName,
          dimension: SEMANTIC_SEARCH_CONFIG.EMBEDDING_DIMENSION, // ✅ Now 1024 for multilingual-e5-large
          metric: SEMANTIC_SEARCH_CONFIG.PINECONE_CONFIG.metric,
          spec: {
            serverless: {
              cloud: SEMANTIC_SEARCH_CONFIG.PINECONE_CONFIG.cloud,
              region: SEMANTIC_SEARCH_CONFIG.PINECONE_CONFIG.region
            }
          }
        });

        const createDuration = Date.now() - createStartTime;
        console.log(`✅ [IndexManagement] Index created in ${createDuration}ms`);
        console.log(`⏳ [IndexManagement] Index is initializing in background...`);

        // Don't wait for the index to be ready - let it initialize in background
      } else {
        console.log(`✅ [IndexManagement] Index exists: ${indexName}`);
      }

      // Cache and return the index instance
      this._indexInstance = pinecone.index(indexName);

      const totalDuration = Date.now() - indexStartTime;
      console.log(`✅ [IndexManagement] Index ready in ${totalDuration}ms`);

      return this._indexInstance;

    } catch (error) {
      console.error(`❌ [IndexManagement] Failed to get/create index:`, {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get index statistics
   * Returns information about the index including vector count, dimensions, etc.
   *
   * @returns {Promise<object>} Index statistics
   */
  static async getIndexStats() {
    const startTime = Date.now();

    try {
      console.log(`📊 [IndexManagement] Fetching index statistics...`);

      const index = await this.getOrCreateIndex();
      const stats = await index.describeIndexStats();

      const duration = Date.now() - startTime;
      console.log(`✅ [IndexManagement] Stats fetched in ${duration}ms:`, {
        totalVectors: stats.totalRecordCount || 0,
        dimensions: stats.dimension || SEMANTIC_SEARCH_CONFIG.EMBEDDING_DIMENSION,
        namespaces: Object.keys(stats.namespaces || {}).length
      });

      return stats;

    } catch (error) {
      console.error(`❌ [IndexManagement] Failed to get stats:`, {
        message: error.message
      });
      return null;
    }
  }

  /**
   * Clear cached index instance
   * Useful for testing or forcing a fresh connection
   */
  static clearCache() {
    console.log(`🗑️ [IndexManagement] Clearing cached index instance`);
    this._indexInstance = null;
  }

  /**
   * Check if index exists
   *
   * @returns {Promise<boolean>} True if index exists
   */
  static async indexExists() {
    try {
      const indexName = SEMANTIC_SEARCH_CONFIG.INDEX_NAME;
      const indexList = await pinecone.listIndexes();
      return indexList.indexes?.some(index => index.name === indexName) || false;
    } catch (error) {
      console.error(`❌ [IndexManagement] Failed to check if index exists:`, error);
      return false;
    }
  }

  /**
   * Get namespaced index
   * Returns a Pinecone index instance scoped to a specific user namespace
   *
   * @param {string} userId - User ID for namespace
   * @returns {Promise<PineconeNamespace>} Namespaced Pinecone index
   */
  static async getNamespacedIndex(userId) {
    const index = await this.getOrCreateIndex();
    const namespace = `user_${userId}`;
    return index.namespace(namespace);
  }
}