// lib/services/serviceContact/server/searchFeedbackService.js
// Server service for handling semantic search feedback
// Business logic layer - updates SessionUsage with user feedback

import { adminDb } from '../../../firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * SearchFeedbackService
 *
 * Server-side service for recording user feedback on semantic search results.
 * Updates the SessionUsage collection with feedback data for analytics and improvements.
 *
 * Database Structure:
 * SessionUsage/{userId}/sessions/{sessionId}
 * {
 *   feature: 'semantic_search',
 *   status: 'completed',
 *   totalCost: 0.00123,
 *   steps: [...],
 *   feedback: {                    // Added by this service
 *     isPositive: true/false,      // true = good search, false = not good
 *     submittedAt: ISO timestamp,
 *     userId: string
 *   }
 * }
 */
export class SearchFeedbackService {
  /**
   * Record user feedback for a semantic search session
   *
   * @param {string} userId - The user ID who is submitting feedback
   * @param {string} sessionId - The search session ID
   * @param {Object} feedbackData - Feedback details
   * @param {boolean} feedbackData.isPositive - true = good search, false = not good
   * @param {string} feedbackData.submittedAt - ISO timestamp of submission
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async recordSearchFeedback(userId, sessionId, feedbackData) {
    const logId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`💬 [SearchFeedbackService] [${logId}] Recording feedback:`, {
      userId,
      sessionId: sessionId?.slice(0, 20) + '...',
      isPositive: feedbackData.isPositive
    });

    try {
      // Validate inputs
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid userId');
      }

      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Invalid sessionId');
      }

      if (typeof feedbackData.isPositive !== 'boolean') {
        throw new Error('Invalid feedback value - isPositive must be boolean');
      }

      // Reference to the session document
      const sessionRef = adminDb
        .collection('SessionUsage')
        .doc(userId)
        .collection('sessions')
        .doc(sessionId);

      // Use transaction to ensure data integrity
      const result = await adminDb.runTransaction(async (transaction) => {
        const sessionDoc = await transaction.get(sessionRef);

        // Check if session exists
        if (!sessionDoc.exists) {
          console.log(`❌ [SearchFeedbackService] [${logId}] Session not found`);
          return { success: false, error: 'SESSION_NOT_FOUND' };
        }

        const sessionData = sessionDoc.data();

        // Check if feedback already exists
        if (sessionData.feedback) {
          console.log(`⚠️ [SearchFeedbackService] [${logId}] Feedback already exists for this session`);
          return { success: false, error: 'ALREADY_SUBMITTED' };
        }

        // Verify this is a semantic search session
        if (sessionData.feature !== 'semantic_search') {
          console.warn(`⚠️ [SearchFeedbackService] [${logId}] Session is not a semantic_search (found: ${sessionData.feature})`);
          // Don't fail - still allow feedback for any session
        }

        // Update the session with feedback
        transaction.update(sessionRef, {
          feedback: {
            isPositive: feedbackData.isPositive,
            submittedAt: feedbackData.submittedAt,
            userId: userId, // Track who submitted (useful for multi-user scenarios)
            version: 1 // For future schema changes
          },
          lastUpdatedAt: FieldValue.serverTimestamp()
        });

        console.log(`✅ [SearchFeedbackService] [${logId}] Feedback recorded successfully`);
        return { success: true };
      });

      return result;

    } catch (error) {
      console.error(`❌ [SearchFeedbackService] [${logId}] Error recording feedback:`, {
        userId,
        sessionId: sessionId?.slice(0, 20) + '...',
        message: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message || 'Failed to record feedback'
      };
    }
  }

  /**
   * Get feedback statistics for a user (optional analytics helper)
   *
   * @param {string} userId - The user ID
   * @param {number} limit - Maximum number of sessions to analyze (default: 100)
   * @returns {Promise<Object>} Feedback statistics
   */
  static async getFeedbackStatistics(userId, limit = 100) {
    const logId = `stats_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`📊 [SearchFeedbackService] [${logId}] Getting feedback stats for user: ${userId}`);

    try {
      // Query sessions with feedback
      const sessionsSnapshot = await adminDb
        .collection('SessionUsage')
        .doc(userId)
        .collection('sessions')
        .where('feature', '==', 'semantic_search')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      let totalSessions = 0;
      let sessionsWithFeedback = 0;
      let positiveFeedback = 0;
      let negativeFeedback = 0;

      sessionsSnapshot.forEach(doc => {
        totalSessions++;
        const data = doc.data();

        if (data.feedback) {
          sessionsWithFeedback++;
          if (data.feedback.isPositive) {
            positiveFeedback++;
          } else {
            negativeFeedback++;
          }
        }
      });

      const feedbackRate = totalSessions > 0 ? (sessionsWithFeedback / totalSessions) * 100 : 0;
      const satisfactionRate = sessionsWithFeedback > 0 ? (positiveFeedback / sessionsWithFeedback) * 100 : 0;

      const stats = {
        totalSessions,
        sessionsWithFeedback,
        positiveFeedback,
        negativeFeedback,
        feedbackRate: Math.round(feedbackRate * 100) / 100, // Round to 2 decimals
        satisfactionRate: Math.round(satisfactionRate * 100) / 100
      };

      console.log(`✅ [SearchFeedbackService] [${logId}] Stats:`, stats);
      return stats;

    } catch (error) {
      console.error(`❌ [SearchFeedbackService] [${logId}] Error getting stats:`, error);
      throw error;
    }
  }
}
