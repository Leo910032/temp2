// lib/services/serviceAdmin/client/adminServiceVector.js
// Client-side service for admin vector contact testing operations
// Follows the admin service architecture pattern

import { ContactApiClient } from '@/lib/services/core/ApiClient';

/**
 * AdminServiceVector
 *
 * Client-side service for managing vector-optimized contact generation and testing
 * in the admin dashboard. Follows the same pattern as AdminService and AdminServiceAnalytics.
 *
 * Architecture:
 * - Client-side only (makes API calls to server)
 * - Uses ContactApiClient for authenticated requests
 * - Handles errors gracefully with detailed logging
 * - Returns formatted data ready for UI consumption
 *
 * Security:
 * - All requests include JWT token via ContactApiClient
 * - Server validates admin permissions
 * - View-only admins blocked from write operations
 *
 * Pattern: Follows lib/services/serviceAdmin/client/adminServiceAnalytics.js
 */
export class AdminServiceVector {
  /**
   * Fetch vector storage information for a user
   *
   * @param {string} userId - User ID to get vector info for
   * @returns {Promise<Object>} Vector storage information
   * @throws {Error} If request fails or user not authorized
   *
   * @example
   * const vectorInfo = await AdminServiceVector.fetchVectorInfo('user123');
   * console.log(vectorInfo.vectorsStored); // Number of vectors in Pinecone
   * console.log(vectorInfo.hasVectorSupport); // true/false
   */
  static async fetchVectorInfo(userId) {
    try {
      console.log(`📊 [AdminServiceVector] Fetching vector info for user: ${userId}`);

      const response = await ContactApiClient.get(`/api/admin/vector-info?userId=${userId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch vector info');
      }

      const data = await response.json();

      console.log(`✅ [AdminServiceVector] Vector info fetched successfully:`, {
        userId,
        vectorsStored: data.vectorsStored,
        hasVectorSupport: data.hasVectorSupport,
        subscriptionTier: data.subscriptionTier
      });

      return this.formatVectorInfo(data);
    } catch (error) {
      console.error(`❌ [AdminServiceVector] Failed to fetch vector info:`, error);
      throw error;
    }
  }

  /**
   * Fetch generation and vector information for a user
   * Combines both generation stats and vector storage info
   *
   * @param {string} userId - User ID to get info for
   * @returns {Promise<Object>} Combined generation and vector information
   * @throws {Error} If request fails or user not authorized
   *
   * @example
   * const info = await AdminServiceVector.fetchGenerationAndVectorInfo('user123');
   * console.log(info.generation); // Generation stats
   * console.log(info.vector); // Vector storage info
   */
  static async fetchGenerationAndVectorInfo(userId) {
    try {
      console.log(`📊 [AdminServiceVector] Fetching generation and vector info for user: ${userId}`);

      // Fetch both in parallel for better performance
      const [generationResponse, vectorResponse] = await Promise.all([
        ContactApiClient.get(`/api/admin/generate-contacts?userId=${userId}`),
        ContactApiClient.get(`/api/admin/vector-info?userId=${userId}`)
      ]);

      const generationData = generationResponse.ok ? await generationResponse.json() : null;
      const vectorData = vectorResponse.ok ? await vectorResponse.json() : null;

      console.log(`✅ [AdminServiceVector] Info fetched successfully for user: ${userId}`);

      return {
        generation: generationData,
        vector: vectorData ? this.formatVectorInfo(vectorData) : null
      };
    } catch (error) {
      console.error(`❌ [AdminServiceVector] Failed to fetch generation and vector info:`, error);
      throw error;
    }
  }

  /**
   * Generate vector-optimized test contacts
   *
   * @param {string} userId - Target user ID for generation
   * @param {Object} options - Generation options
   * @param {number} options.count - Number of contacts to generate
   * @param {number} options.eventPercentage - Percentage with events (0-1)
   * @param {number} options.locationPercentage - Percentage with locations (0-1)
   * @param {boolean} options.enableVectorStorage - Enable vector storage
   * @param {boolean} options.forceVectorCreation - Force vector creation
   * @param {string} options.vectorOptimizationLevel - Optimization level
   * @param {boolean} options.includeNotes - Include notes
   * @param {string} options.noteScenario - Note scenario type
   * @param {string} options.noteComplexity - Note complexity level
   * @param {number} options.noteProbability - Note probability (0-1)
   * @param {boolean} options.includeMessages - Include messages
   * @param {number} options.messageProbability - Message probability (0-1)
   * @param {boolean} options.forceExchangeForm - Force exchange form
   * @returns {Promise<Object>} Generation result
   * @throws {Error} If generation fails or user not authorized
   *
   * @example
   * const result = await AdminServiceVector.generateVectorContacts('user123', {
   *   count: 30,
   *   enableVectorStorage: true,
   *   vectorOptimizationLevel: 'premium'
   * });
   * console.log(result.generated); // Number of contacts generated
   */
  static async generateVectorContacts(userId, options) {
    try {
      console.log(`🎲 [AdminServiceVector] Generating vector contacts for user: ${userId}`, options);

      const response = await ContactApiClient.post('/api/admin/vector-contacts', {
        targetUserId: userId,
        ...options
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate vector contacts');
      }

      const data = await response.json();

      console.log(`✅ [AdminServiceVector] Vector contacts generated successfully:`, {
        userId,
        generated: data.data?.generated,
        vectorsCreated: data.data?.vectorsCreated
      });

      return data;
    } catch (error) {
      console.error(`❌ [AdminServiceVector] Failed to generate vector contacts:`, error);
      throw error;
    }
  }

  /**
   * Cleanup vector test data for a user
   * Removes test contacts and their associated vectors
   *
   * @param {string} userId - User ID to cleanup test data for
   * @returns {Promise<Object>} Cleanup result
   * @throws {Error} If cleanup fails or user not authorized
   *
   * @example
   * const result = await AdminServiceVector.cleanupVectorTestData('user123');
   * console.log(result.deletedContacts); // Number of contacts deleted
   * console.log(result.deletedVectors); // Number of vectors deleted
   */
  static async cleanupVectorTestData(userId) {
    try {
      console.log(`🧹 [AdminServiceVector] Cleaning up vector test data for user: ${userId}`);

      const response = await ContactApiClient.delete(`/api/admin/vector-contacts?userId=${userId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cleanup vector test data');
      }

      const data = await response.json();

      console.log(`✅ [AdminServiceVector] Vector test data cleaned up successfully:`, {
        userId,
        deletedContacts: data.data?.deletedContacts,
        deletedVectors: data.data?.deletedVectors
      });

      return data;
    } catch (error) {
      console.error(`❌ [AdminServiceVector] Failed to cleanup vector test data:`, error);
      throw error;
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Format vector information for UI display
   *
   * @param {Object} data - Raw vector info data from API
   * @returns {Object} Formatted vector information
   * @private
   */
  static formatVectorInfo(data) {
    return {
      hasVectorSupport: data.hasVectorSupport || false,
      subscriptionTier: data.subscriptionTier || 'base',
      vectorsStored: data.vectorsStored || 0,
      totalContacts: data.totalContacts || 0,
      vectorPercentage: data.vectorPercentage || 0,
      pineconeIndexStatus: data.pineconeIndexStatus || 'unknown',
      vectorDimensions: data.vectorDimensions || 0,
      lastVectorUpdate: data.lastVectorUpdate || null,
      contactsWithRichData: data.contactsWithRichData || 0,
      indexName: data.indexName || null,
      namespace: data.namespace || null
    };
  }

  /**
   * Format generation result for UI display
   *
   * @param {Object} data - Raw generation data from API
   * @returns {Object} Formatted generation result
   * @private
   */
  static formatGenerationResult(data) {
    return {
      success: data.success || false,
      generated: data.data?.generated || 0,
      vectorsCreated: data.data?.vectorsCreated || 0,
      totalContacts: data.data?.totalContacts || 0,
      message: data.message || '',
      processingTimeMs: data.processingTimeMs || 0
    };
  }

  /**
   * Format cleanup result for UI display
   *
   * @param {Object} data - Raw cleanup data from API
   * @returns {Object} Formatted cleanup result
   * @private
   */
  static formatCleanupResult(data) {
    return {
      success: data.success || false,
      deletedContacts: data.data?.deletedContacts || 0,
      deletedVectors: data.data?.deletedVectors || 0,
      message: data.message || '',
      processingTimeMs: data.processingTimeMs || 0
    };
  }

  /**
   * Get tier eligibility for vector features
   *
   * @param {string} tier - Subscription tier
   * @returns {boolean} Whether tier supports vector features
   *
   * @example
   * const hasVectors = AdminServiceVector.hasVectorSupport('premium'); // true
   * const noVectors = AdminServiceVector.hasVectorSupport('base'); // false
   */
  static hasVectorSupport(tier) {
    const eligibleTiers = ['premium', 'business', 'enterprise'];
    return eligibleTiers.includes(tier?.toLowerCase());
  }

  /**
   * Get recommended vector optimization level for tier
   *
   * @param {string} tier - Subscription tier
   * @returns {string} Recommended optimization level
   *
   * @example
   * const level = AdminServiceVector.getRecommendedOptimizationLevel('enterprise');
   * console.log(level); // 'enterprise'
   */
  static getRecommendedOptimizationLevel(tier) {
    const tierMap = {
      'enterprise': 'enterprise',
      'business': 'business',
      'premium': 'premium',
      'base': 'auto'
    };

    return tierMap[tier?.toLowerCase()] || 'auto';
  }
}
