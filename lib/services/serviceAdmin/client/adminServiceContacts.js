// lib/services/serviceAdmin/client/adminServiceContacts.js
// Client-side service for admin contact generation operations
// Follows the same pattern as adminService.js and adminServiceAnalytics.js

"use client"
import { ContactApiClient } from '@/lib/services/core/ApiClient';

/**
 * Admin Service Contacts - Client-side operations for test contact generation
 *
 * Architecture:
 * - Handles all API communication for contact generation
 * - Uses ContactApiClient for authenticated requests
 * - Provides clean interface for UI components
 * - Includes error handling and logging
 */
export class AdminServiceContacts {

  /**
   * Generate test contacts for a user
   * @param {string} userId - User ID to generate contacts for
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation result with statistics
   */
  static async generateContacts(userId, options = {}) {
    console.log("🎲 [AdminServiceContacts] Generating test contacts:", {
      userId,
      options
    });

    try {
      const result = await ContactApiClient.post(
        '/api/admin/generate-contacts',
        {
          targetUserId: userId,
          count: options.count || 50,
          eventPercentage: options.eventPercentage || 0.4,
          locationPercentage: options.locationPercentage || 0.7,
          forceEventLocation: options.forceEventLocation || false,
          forceRandomLocation: options.forceRandomLocation || false,
          includeMessages: options.includeMessages || false,
          messageProbability: options.messageProbability || 1.0,
          forceExchangeForm: options.forceExchangeForm || false,
          includeNotes: options.includeNotes !== undefined ? options.includeNotes : true,
          noteScenario: options.noteScenario || 'mixed',
          noteComplexity: options.noteComplexity || 'medium',
          noteProbability: options.noteProbability || 0.7
        },
        { timeout: 60000 } // 60 second timeout for generation
      );

      console.log("✅ [AdminServiceContacts] Contacts generated successfully:", {
        generated: result.data?.generated,
        totalContacts: result.data?.totalContacts
      });

      return result;
    } catch (error) {
      console.error("❌ [AdminServiceContacts] Failed to generate contacts:", error);
      throw error;
    }
  }

  /**
   * Get generation info for a user (stats and capabilities)
   * @param {string} userId - User ID to get info for
   * @returns {Promise<Object>} Generation info with stats
   */
  static async getGenerationInfo(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`📊 [AdminServiceContacts] Fetching generation info for: ${userId}`);

    try {
      const result = await ContactApiClient.get(
        `/api/admin/generate-contacts?userId=${userId}`,
        { timeout: 30000 }
      );

      console.log("✅ [AdminServiceContacts] Generation info fetched successfully:", {
        userId,
        totalContacts: result.currentStats?.totalContacts,
        testContacts: result.testDataInfo?.totalTestContacts
      });

      return result;
    } catch (error) {
      console.error("❌ [AdminServiceContacts] Failed to fetch generation info:", error);
      throw error;
    }
  }

  /**
   * Cleanup test contacts for a user
   * @param {string} userId - User ID to cleanup test data for
   * @returns {Promise<Object>} Cleanup result
   */
  static async cleanupTestContacts(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`🧹 [AdminServiceContacts] Cleaning up test contacts for: ${userId}`);

    try {
      const result = await ContactApiClient.delete(
        `/api/admin/cleanup-test-data?userId=${userId}`,
        { timeout: 30000 }
      );

      console.log("✅ [AdminServiceContacts] Test contacts cleaned up successfully:", {
        userId,
        removed: result.removed,
        remaining: result.remaining
      });

      return result;
    } catch (error) {
      console.error("❌ [AdminServiceContacts] Failed to cleanup test contacts:", error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Format generation result for display
   * @param {Object} result - Generation result from API
   * @returns {Object} Formatted result
   */
  static formatGenerationResult(result) {
    if (!result || !result.data) return null;

    return {
      generated: result.data.generated || 0,
      totalContacts: result.data.totalContacts || 0,
      insights: result.data.insights || {},
      statistics: result.data.statistics || {},
      sampleContacts: result.data.sampleContacts || []
    };
  }

  /**
   * Format generation info for display
   * @param {Object} info - Generation info from API
   * @returns {Object} Formatted info
   */
  static formatGenerationInfo(info) {
    if (!info) return null;

    return {
      currentStats: info.currentStats || null,
      testDataInfo: info.testDataInfo || null,
      generationOptions: info.generationOptions || {},
      examples: info.generationOptions?.examples || {}
    };
  }

  /**
   * Validate generation options before sending
   * @param {Object} options - Generation options to validate
   * @returns {Object} Validated options
   */
  static validateOptions(options) {
    return {
      count: Math.min(Math.max(parseInt(options.count) || 50, 1), 200),
      eventPercentage: Math.min(Math.max(parseFloat(options.eventPercentage) || 0.4, 0), 1),
      locationPercentage: Math.min(Math.max(parseFloat(options.locationPercentage) || 0.7, 0), 1),
      forceEventLocation: Boolean(options.forceEventLocation),
      forceRandomLocation: Boolean(options.forceRandomLocation),
      includeMessages: Boolean(options.includeMessages),
      messageProbability: Math.min(Math.max(parseFloat(options.messageProbability) || 1.0, 0), 1),
      forceExchangeForm: Boolean(options.forceExchangeForm),
      includeNotes: options.includeNotes !== undefined ? Boolean(options.includeNotes) : true,
      noteScenario: options.noteScenario || 'mixed',
      noteComplexity: options.noteComplexity || 'medium',
      noteProbability: Math.min(Math.max(parseFloat(options.noteProbability) || 0.7, 0), 1)
    };
  }
}

export default AdminServiceContacts;
