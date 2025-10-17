// lib/services/serviceAdmin/server/adminServiceSessions.js
// Server-side service for session usage operations

import { adminDb } from '@/lib/firebaseAdmin';

/**
 * Admin Service Sessions - Server-side operations for session usage analytics
 *
 * Architecture:
 * - Processes session data from SessionUsage collection
 * - Aggregates multi-step operation statistics
 * - Provides insights into user's API and AI usage patterns
 */
export class AdminServiceSessions {

  /**
   * Get sessions for a specific user
   * @param {string} userId - User ID
   * @param {Object} filters - { status, limit }
   * @returns {Promise<Array>} Array of session objects
   */
  static async getUserSessions(userId, filters = {}) {
    const startTime = Date.now();
    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║  ADMIN SERVICE SESSIONS - GET USER SESSIONS                    ║`);
    console.log(`║  User ID: ${userId.slice(-20).padEnd(48)} ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

    try {
      const { status = 'all', limit = 50 } = filters;

      console.log(`[AdminServiceSessions] 📊 Fetching sessions with filters:`, { status, limit });

      // Build query
      let query = adminDb
        .collection('SessionUsage')
        .doc(userId)
        .collection('sessions');

      // Apply status filter if not 'all'
      if (status !== 'all') {
        query = query.where('status', '==', status);
      }

      // Apply limit and sort by creation date descending
      query = query
        .orderBy('createdAt', 'desc')
        .limit(limit);

      // Execute query
      const sessionsSnapshot = await query.get();

      if (sessionsSnapshot.empty) {
        console.log(`[AdminServiceSessions] ⚠️ No sessions found for user ${userId}`);
        return [];
      }

      console.log(`[AdminServiceSessions] 📊 Found ${sessionsSnapshot.size} sessions`);

      // Process sessions
      const sessions = [];
      sessionsSnapshot.forEach(doc => {
        try {
          const data = doc.data();
          const session = this._processSessionData(doc.id, data);
          sessions.push(session);
        } catch (error) {
          console.error(`[AdminServiceSessions] ❌ Error processing session ${doc.id}:`, error);
        }
      });

      const processingTime = Date.now() - startTime;
      console.log(`[AdminServiceSessions] ✅ Sessions fetched successfully (${processingTime}ms, ${sessions.length} sessions)`);

      return sessions;

    } catch (error) {
      console.error('[AdminServiceSessions] ❌ Error fetching user sessions:', error);
      throw error;
    }
  }

  /**
   * Get a specific session detail
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session object with all steps
   */
  static async getSessionDetail(userId, sessionId) {
    console.log(`[AdminServiceSessions] 📋 Fetching session detail: ${sessionId} for user: ${userId}`);

    try {
      const sessionDoc = await adminDb
        .collection('SessionUsage')
        .doc(userId)
        .collection('sessions')
        .doc(sessionId)
        .get();

      if (!sessionDoc.exists) {
        throw new Error('Session not found');
      }

      const data = sessionDoc.data();
      const session = this._processSessionData(sessionDoc.id, data);

      console.log(`[AdminServiceSessions] ✅ Session detail fetched successfully`);
      return session;

    } catch (error) {
      console.error('[AdminServiceSessions] ❌ Error fetching session detail:', error);
      throw error;
    }
  }

  /**
   * Get session statistics for a user
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look back (default 30)
   * @returns {Promise<Object>} Session statistics
   */
  static async getSessionStats(userId, days = 30) {
    console.log(`[AdminServiceSessions] 📊 Calculating session stats for user: ${userId} (${days} days)`);

    try {
      // Calculate date threshold
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);

      // Fetch all sessions within date range
      const sessionsSnapshot = await adminDb
        .collection('SessionUsage')
        .doc(userId)
        .collection('sessions')
        .where('createdAt', '>=', dateThreshold.toISOString())
        .get();

      if (sessionsSnapshot.empty) {
        return this._getEmptyStats();
      }

      // Aggregate statistics
      const stats = {
        totalSessions: 0,
        completedSessions: 0,
        inProgressSessions: 0,
        abandonedSessions: 0,
        totalCost: 0,
        totalSteps: 0,
        averageCost: 0,
        averageDuration: 0,
        totalDuration: 0,
        features: {},
        providers: {}
      };

      sessionsSnapshot.forEach(doc => {
        const data = doc.data();
        stats.totalSessions++;

        // Count by status
        if (data.status === 'completed') stats.completedSessions++;
        else if (data.status === 'in-progress') stats.inProgressSessions++;
        else if (data.status === 'abandoned') stats.abandonedSessions++;

        // Aggregate costs
        stats.totalCost += Number(data.totalCost) || 0;
        stats.totalSteps += data.steps?.length || 0;

        // Calculate duration for completed sessions
        if (data.status === 'completed' && data.createdAt && data.completedAt) {
          const duration = this._calculateDuration(data.createdAt, data.completedAt);
          if (duration > 0) {
            stats.totalDuration += duration;
          }
        }

        // Aggregate by feature
        if (data.feature) {
          if (!stats.features[data.feature]) {
            stats.features[data.feature] = { count: 0, cost: 0 };
          }
          stats.features[data.feature].count++;
          stats.features[data.feature].cost += Number(data.totalCost) || 0;
        }

        // Aggregate by provider (from steps)
        if (data.steps && Array.isArray(data.steps)) {
          data.steps.forEach(step => {
            const provider = step.provider;
            if (provider) {
              if (!stats.providers[provider]) {
                stats.providers[provider] = { count: 0, cost: 0 };
              }
              stats.providers[provider].count++;
              stats.providers[provider].cost += Number(step.cost) || 0;
            }
          });
        }
      });

      // Calculate averages
      if (stats.totalSessions > 0) {
        stats.averageCost = stats.totalCost / stats.totalSessions;
      }
      if (stats.completedSessions > 0) {
        stats.averageDuration = stats.totalDuration / stats.completedSessions;
      }

      console.log(`[AdminServiceSessions] ✅ Stats calculated:`, {
        totalSessions: stats.totalSessions,
        totalCost: `$${stats.totalCost.toFixed(4)}`,
        completedSessions: stats.completedSessions
      });

      return stats;

    } catch (error) {
      console.error('[AdminServiceSessions] ❌ Error calculating session stats:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Process raw session data from Firestore
   * @private
   */
  static _processSessionData(sessionId, data) {
    return {
      sessionId,
      feature: data.feature || 'unknown',
      status: data.status || 'unknown',
      totalCost: Number(data.totalCost) || 0,
      totalRuns: Number(data.totalRuns) || 0,
      createdAt: this._serializeTimestamp(data.createdAt),
      lastUpdatedAt: this._serializeTimestamp(data.lastUpdatedAt),
      completedAt: data.completedAt ? this._serializeTimestamp(data.completedAt) : null,
      steps: data.steps ? this._processSteps(data.steps) : [],
      metadata: data.metadata || {}
    };
  }

  /**
   * Process steps array
   * @private
   */
  static _processSteps(steps) {
    if (!Array.isArray(steps)) return [];

    return steps.map(step => ({
      operationId: step.operationId || 'unknown',
      feature: step.feature || 'unknown',
      provider: step.provider || 'unknown',
      usageType: step.usageType || 'unknown',
      cost: Number(step.cost) || 0,
      isBillableRun: step.isBillableRun || false,
      timestamp: this._serializeTimestamp(step.timestamp),
      metadata: step.metadata || {}
    }));
  }

  /**
   * Serialize Firestore Timestamp to ISO string
   * @private
   */
  static _serializeTimestamp(timestamp) {
    if (!timestamp) return null;

    // Handle Firestore Timestamp objects
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
      try {
        return timestamp.toDate().toISOString();
      } catch (error) {
        console.warn('[AdminServiceSessions] Failed to convert Firestore Timestamp:', error);
        return null;
      }
    }

    // Handle ISO string timestamps
    if (typeof timestamp === 'string') {
      return timestamp;
    }

    // Handle Date objects
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }

    console.warn('[AdminServiceSessions] Unknown timestamp format:', typeof timestamp);
    return null;
  }

  /**
   * Calculate duration between two timestamps in seconds
   * @private
   */
  static _calculateDuration(startTimestamp, endTimestamp) {
    try {
      const start = this._serializeTimestamp(startTimestamp);
      const end = this._serializeTimestamp(endTimestamp);

      if (!start || !end) return 0;

      const startDate = new Date(start);
      const endDate = new Date(end);

      const durationMs = endDate - startDate;
      return durationMs / 1000; // Return seconds
    } catch (error) {
      console.warn('[AdminServiceSessions] Failed to calculate duration:', error);
      return 0;
    }
  }

  /**
   * Get empty stats object
   * @private
   */
  static _getEmptyStats() {
    return {
      totalSessions: 0,
      completedSessions: 0,
      inProgressSessions: 0,
      abandonedSessions: 0,
      totalCost: 0,
      totalSteps: 0,
      averageCost: 0,
      averageDuration: 0,
      totalDuration: 0,
      features: {},
      providers: {}
    };
  }
}
