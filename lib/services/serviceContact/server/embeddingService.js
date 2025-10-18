// lib/services/serviceContact/server/embeddingService.js
// Server-side service for generating embeddings using Pinecone Inference API
// Handles embedding generation and cost estimation

import { Pinecone } from '@pinecone-database/pinecone';
import { API_COSTS } from '@/lib/services/constants/apiCosts';
import { SEMANTIC_SEARCH_CONFIG } from '@/lib/services/serviceContact/client/constants/contactConstants';
import { StepTracker } from './costTracking/stepTracker';

// Initialize Pinecone client
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

/**
 * EmbeddingService
 *
 * Architecture:
 * - Server-side only (Pinecone API key required)
 * - Generates embeddings using Pinecone's multilingual-e5-large model
 * - Provides cost estimation for embedding operations
 * - Returns 1024-dimensional vectors (multilingual optimized)
 */
export class EmbeddingService {
  /**
   * Generate embedding for text
   * Uses Pinecone multilingual-e5-large model
   *
   * @param {string} text - Text to embed
   * @param {object} options - Options for tracking
   * @param {string} options.sessionId - Session ID for tracking
   * @param {string} options.userId - User ID for tracking
   * @param {boolean} options.trackSteps - Enable granular step tracking
   * @returns {Promise<Array<number>>} 1024-dimensional embedding vector
   */
  static async generateEmbedding(text, options = {}) {
    const { sessionId = null, userId = null, trackSteps = false } = options;
    const startTime = Date.now();

    try {
      // Clean and validate input
      const cleanText = text.replace(/\n/g, ' ').trim();

      if (!cleanText || cleanText.length === 0) {
        throw new Error('Cannot generate embedding for empty text');
      }

      console.log(`🧠 [EmbeddingService] Generating embedding for text (${cleanText.length} chars)`);
      console.log(`📝 [EmbeddingService] Text preview: "${cleanText.substring(0, 100)}..."`);

      // Generate embedding using Pinecone Inference API
      const response = await pc.inference.embed(
        SEMANTIC_SEARCH_CONFIG.EMBEDDING_MODEL,
        [cleanText],
        { inputType: 'passage' }
      );

      // Debug: Log response type and structure
      console.log(`🔍 [EmbeddingService] Response type: ${typeof response}, isArray: ${Array.isArray(response)}`);
      if (response && typeof response === 'object') {
        console.log(`🔍 [EmbeddingService] Response keys: ${Object.keys(response).join(', ')}`);
      }

      // Validate response exists
      if (!response) {
        throw new Error('Pinecone Inference API returned empty response');
      }

      // Extract embeddings based on response structure
      let embeddingData;
      
      // Case 1: Response is an object with 'data' property (most likely)
      if (typeof response === 'object' && !Array.isArray(response) && response.data) {
        console.log(`📦 [EmbeddingService] Found response.data, type: ${typeof response.data}, isArray: ${Array.isArray(response.data)}`);
        embeddingData = response.data;
      }
      // Case 2: Response is directly an array
      else if (Array.isArray(response)) {
        console.log(`📦 [EmbeddingService] Response is array directly`);
        embeddingData = response;
      }
      // Case 3: Response has some other structure
      else {
        console.error(`❌ [EmbeddingService] Unexpected response structure:`, JSON.stringify(response, null, 2));
        throw new Error(`Unexpected response structure. Response keys: ${Object.keys(response).join(', ')}`);
      }

      // Validate embeddingData is an array
      if (!Array.isArray(embeddingData)) {
        throw new Error(`Embedding data is not an array: ${typeof embeddingData}`);
      }

      if (embeddingData.length === 0) {
        throw new Error('Embedding data array is empty');
      }

      // Extract the actual embedding vector
      const firstItem = embeddingData[0];
      console.log(`🔍 [EmbeddingService] First item type: ${typeof firstItem}, isArray: ${Array.isArray(firstItem)}`);
      if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
        console.log(`🔍 [EmbeddingService] First item keys: ${Object.keys(firstItem).join(', ')}`);
      }

      let embedding;
      
      // Case A: Item has 'values' property { values: [...] }
      if (firstItem && firstItem.values) {
        console.log(`✅ [EmbeddingService] Found values property`);
        embedding = firstItem.values;
      }
      // Case B: Item is directly an array
      else if (Array.isArray(firstItem)) {
        console.log(`✅ [EmbeddingService] First item is array directly`);
        embedding = firstItem;
      }
      // Case C: Unexpected structure
      else {
        console.error(`❌ [EmbeddingService] Cannot find embedding vector in first item:`, firstItem);
        throw new Error(`Cannot extract embedding vector from first item. Type: ${typeof firstItem}`);
      }

      // Validate embedding is an array of numbers
      if (!Array.isArray(embedding)) {
        throw new Error(`Embedding is not an array: ${typeof embedding}`);
      }

      if (embedding.length === 0) {
        throw new Error('Embedding array is empty');
      }

      const duration = Date.now() - startTime;

      // Log embedding details
      console.log(`✅ [EmbeddingService] Embedding generated successfully:`);
      console.log(`   - Model: ${SEMANTIC_SEARCH_CONFIG.EMBEDDING_MODEL}`);
      console.log(`   - Dimension: ${embedding.length}`);
      console.log(`   - Duration: ${duration}ms`);
      console.log(`   - First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
      console.log(`   - Vector magnitude: ${this._calculateMagnitude(embedding).toFixed(4)}`);

      // Validate embedding dimension
      if (embedding.length !== SEMANTIC_SEARCH_CONFIG.EMBEDDING_DIMENSION) {
        console.warn(`⚠️ [EmbeddingService] Unexpected embedding dimension: ${embedding.length} (expected ${SEMANTIC_SEARCH_CONFIG.EMBEDDING_DIMENSION})`);
      }

      // STEP 3: Record Embedding Generation
      if (trackSteps && sessionId && userId) {
        try {
          await StepTracker.recordStep({
            userId,
            sessionId,
            stepNumber: 3,
            stepLabel: 'Step 3: Embedding Generation',
            feature: 'semantic_search_embedding',
            provider: 'pinecone-inference',
            cost: API_COSTS.PINECONE_EMBED,
            duration,
            isBillableRun: false,
            metadata: {
              model: SEMANTIC_SEARCH_CONFIG.EMBEDDING_MODEL,
              dimension: embedding.length,
              textLength: cleanText.length,
              tokens: Math.ceil(cleanText.length / 4), // Rough token estimate
              vectorMagnitude: this._calculateMagnitude(embedding),
              firstFiveValues: embedding.slice(0, 5).map(v => parseFloat(v.toFixed(4)))
            }
          });
          console.log(`✅ [EmbeddingService] Step 3 recorded`);
        } catch (stepError) {
          console.error(`❌ [EmbeddingService] Failed to record Step 3:`, stepError);
        }
      }

      return embedding;

    } catch (error) {
      console.error(`❌ [EmbeddingService] Embedding generation failed:`, {
        message: error.message,
        textLength: text?.length || 0,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Estimate cost of generating an embedding
   * Based on text length and Pinecone pricing
   *
   * @param {string} text - Text to estimate cost for
   * @returns {object} Cost estimation details
   */
  static estimateCost(text) {
    // Rough token estimation (1 token ≈ 4 characters for English)
    const estimatedTokens = Math.ceil(text.length / 4);

    // Calculate cost using Pinecone pricing
    const embeddingCost = (estimatedTokens / 1000000) * API_COSTS.PINECONE_INFERENCE.MULTILINGUAL_E5_LARGE.PER_MILLION;

    return {
      textLength: text.length,
      estimatedTokens,
      embeddingCost,
      model: SEMANTIC_SEARCH_CONFIG.EMBEDDING_MODEL,
      pricePerMillion: API_COSTS.PINECONE_INFERENCE.MULTILINGUAL_E5_LARGE.PER_MILLION
    };
  }

  /**
   * Batch generate embeddings
   * Generates embeddings for multiple texts with rate limiting
   *
   * @param {Array<string>} texts - Array of texts to embed
   * @param {object} options - Options for batch processing
   * @returns {Promise<Array<Array<number>>>} Array of embeddings
   */
  static async batchGenerateEmbeddings(texts, options = {}) {
    const {
      batchSize = SEMANTIC_SEARCH_CONFIG.BATCH_SIZE,
      delayMs = SEMANTIC_SEARCH_CONFIG.BATCH_DELAY_MS,
      onProgress = null
    } = options;

    console.log(`📦 [EmbeddingService] Batch generating embeddings for ${texts.length} texts`);

    const embeddings = [];
    let processedCount = 0;

    // Process in batches to respect rate limits
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / batchSize);

      console.log(`📦 [EmbeddingService] Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);

      try {
        // Pinecone's embed API supports batch requests natively
        const response = await pc.inference.embed(
          SEMANTIC_SEARCH_CONFIG.EMBEDDING_MODEL,
          batch,
          { inputType: 'passage' }
        );

        // Extract embedding data from response
        let embeddingData;
        if (response.data && Array.isArray(response.data)) {
          embeddingData = response.data;
        } else if (Array.isArray(response)) {
          embeddingData = response;
        } else {
          console.error(`❌ [EmbeddingService] Unexpected batch response structure`);
          throw new Error('Unexpected batch response structure');
        }

        // Extract embedding vectors
        const batchEmbeddings = embeddingData.map(item => {
          if (item.values) {
            return item.values;
          } else if (Array.isArray(item)) {
            return item;
          } else {
            throw new Error(`Cannot extract embedding from item`);
          }
        });

        embeddings.push(...batchEmbeddings);
        processedCount += batch.length;

        // Call progress callback if provided
        if (onProgress) {
          onProgress({
            processed: processedCount,
            total: texts.length,
            batchNumber,
            totalBatches
          });
        }

        // Delay between batches (except for last batch)
        if (i + batchSize < texts.length) {
          console.log(`⏳ [EmbeddingService] Waiting ${delayMs}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.error(`❌ [EmbeddingService] Batch ${batchNumber} failed:`, error);
        throw error;
      }
    }

    console.log(`✅ [EmbeddingService] Batch complete: ${embeddings.length} embeddings generated`);

    return embeddings;
  }

  /**
   * Calculate vector magnitude (Euclidean norm)
   * @private
   */
  static _calculateMagnitude(vector) {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  }

  /**
   * Calculate cosine similarity between two vectors
   * Useful for debugging and validation
   *
   * @param {Array<number>} vector1 - First vector
   * @param {Array<number>} vector2 - Second vector
   * @returns {number} Cosine similarity (-1 to 1)
   */
  static calculateCosineSimilarity(vector1, vector2) {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same dimension');
    }

    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = this._calculateMagnitude(vector1);
    const magnitude2 = this._calculateMagnitude(vector2);

    return dotProduct / (magnitude1 * magnitude2);
  }
}