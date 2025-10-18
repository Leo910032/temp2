// lib/services/serviceContact/server/costTracking/sessionService.js
// Service for tracking multi-step API operations as sessions

import { adminDb } from '../../../../firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * SessionTrackingService
 *
 * Manages "sessions" that group multiple related API calls into a single logical operation.
 * Example: A Google Maps search session consists of:
 *   1. Autocomplete request (user types query)
 *   2. Place Details request (user selects a result)
 *
 * Database Structure:
 * SessionUsage/{userId}/sessions/{sessionId}
 * {
 *   feature: 'google_maps',
 *   status: 'in-progress' | 'completed' | 'abandoned',
 *   totalCost: number,
 *   totalRuns: number,
 *   steps: [
 *     {
 *       operationId: string,
 *       usageType: 'ApiUsage',
 *       feature: 'google_maps_autocomplete',
 *       provider: 'google_maps',
 *       cost: number,
 *       timestamp: string,
 *       metadata: {}
 *     }
 *   ],
 *   createdAt: Timestamp,
 *   lastUpdatedAt: Timestamp,
 *   completedAt: Timestamp (if completed)
 * }
 */
export class SessionTrackingService {
  /**
   * Add a step to an existing session or create a new session.
   * This method uses merge:true to support both creating and updating sessions.
   *
   * @param {Object} params
   * @param {string} params.userId - The user ID
   * @param {string} params.sessionId - Unique session identifier (generated client-side)
   * @param {Object} params.stepData - Data for the step to add
   * @param {string} params.stepData.operationId - Unique operation ID
   * @param {string} params.stepData.usageType - Type of usage ('ApiUsage', 'AIUsage')
   * @param {string} params.stepData.feature - Feature name (e.g., 'google_maps_autocomplete')
   * @param {string} params.stepData.provider - Provider name (e.g., 'google_maps')
   * @param {number} params.stepData.cost - Cost of this step
   * @param {boolean} params.stepData.isBillableRun - Whether this counts as a billable run
   * @param {string} params.stepData.stepLabel - Human-readable label (e.g., 'Step 0: Vector Search')
   * @param {Object} params.stepData.metadata - Additional metadata
   * @returns {Promise<{success: boolean, sessionId: string}>}
   */
  static async addStepToSession({ userId, sessionId, stepData }) {
    const logId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`📋 [SessionTracking] [${logId}] Adding step to session:`, {
      userId,
      sessionId,
      feature: stepData.feature,
      stepLabel: stepData.stepLabel || 'unlabeled',
      cost: stepData.cost
    });

    try {
      const sessionRef = adminDb
        .collection('SessionUsage')
        .doc(userId)
        .collection('sessions')
        .doc(sessionId);

      // Extract the base feature name with improved logic
      // Examples:
      // 'google_maps_autocomplete' -> 'google_maps'
      // 'semantic_search_vector' -> 'semantic_search'
      // 'semantic_search_rerank' -> 'semantic_search'
      let baseFeature;
      if (stepData.feature.startsWith('google_maps_')) {
        baseFeature = 'google_maps';
      } else if (stepData.feature.startsWith('semantic_search_')) {
        baseFeature = 'semantic_search';
      } else if (stepData.feature.startsWith('business_card_')) {
        baseFeature = 'business_card_scan';
      } else {
        // Fallback: take first part
        baseFeature = stepData.feature.split('_')[0];
      }

      // Prepare step object
      const step = {
        stepLabel: stepData.stepLabel || 'Unlabeled Step',
        operationId: stepData.operationId,
        usageType: stepData.usageType,
        feature: stepData.feature,
        provider: stepData.provider,
        cost: stepData.cost,
        isBillableRun: stepData.isBillableRun,
        timestamp: stepData.timestamp,
        metadata: stepData.metadata
      };

      // Add stepNumber if provided (for granular tracking)
      if (stepData.stepNumber !== undefined && stepData.stepNumber !== null) {
        step.stepNumber = stepData.stepNumber;
      }

      // Add duration if provided
      if (stepData.duration !== undefined && stepData.duration !== null) {
        step.duration = stepData.duration;
      }

      const sessionUpdate = {
        feature: baseFeature,
        status: 'in-progress',
        totalCost: FieldValue.increment(stepData.cost || 0),
        totalRuns: FieldValue.increment(stepData.isBillableRun ? 1 : 0),
        lastUpdatedAt: FieldValue.serverTimestamp(),
        steps: FieldValue.arrayUnion(step)
      };

      // If this is a new session, set createdAt
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        sessionUpdate.createdAt = FieldValue.serverTimestamp();
        console.log(`🆕 [SessionTracking] [${logId}] Creating new session: ${sessionId}`);
      }

      // Use set with merge:true to create or update
      await sessionRef.set(sessionUpdate, { merge: true });

      // 🆕 Update user document budget counters for budget display
      // This ensures costs tracked in sessions are reflected in BudgetInfoCard
      try {
        const userRef = adminDb.collection('users').doc(userId);
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

        // Build the update for user document
        const userUpdate = {
          monthlyUsageMonth: currentMonth,
          monthlyTotalCost: FieldValue.increment(stepData.cost || 0)
        };

        // Increment run counter based on usage type (only if billable)
        if (stepData.isBillableRun) {
          if (stepData.usageType === 'AIUsage') {
            userUpdate.monthlyBillableRunsAI = FieldValue.increment(1);
          } else if (stepData.usageType === 'ApiUsage') {
            userUpdate.monthlyBillableRunsAPI = FieldValue.increment(1);
          }
        }

        await userRef.set(userUpdate, { merge: true });
        console.log(`💰 [SessionTracking] [${logId}] User budget updated: +$${stepData.cost.toFixed(6)}, billable=${stepData.isBillableRun}, type=${stepData.usageType}`);
      } catch (budgetError) {
        // Log error but don't fail the entire operation
        console.error(`⚠️ [SessionTracking] [${logId}] Failed to update user budget (non-critical):`, budgetError.message);
      }

      console.log(`✅ [SessionTracking] [${logId}] Step added successfully`);
      return { success: true, sessionId };

    } catch (error) {
      console.error(`❌ [SessionTracking] [${logId}] Error adding step:`, {
        userId,
        sessionId,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Finalize a session by marking it as completed.
   * This should be called when all steps in a logical operation are complete.
   *
   * @param {Object} params
   * @param {string} params.userId - The user ID
   * @param {string} params.sessionId - The session ID to finalize
   * @returns {Promise<{success: boolean}>}
   */
  static async finalizeSession({ userId, sessionId }) {
    const logId = `finalize_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`🏁 [SessionTracking] [${logId}] Finalizing session:`, {
      userId,
      sessionId
    });

    try {
      const sessionRef = adminDb
        .collection('SessionUsage')
        .doc(userId)
        .collection('sessions')
        .doc(sessionId);

      await sessionRef.update({
        status: 'completed',
        completedAt: FieldValue.serverTimestamp()
      });

      console.log(`✅ [SessionTracking] [${logId}] Session finalized successfully`);
      return { success: true };

    } catch (error) {
      console.error(`❌ [SessionTracking] [${logId}] Error finalizing session:`, {
        userId,
        sessionId,
        message: error.message
      });
      throw error;
    }
  }

  /**
   * Get session details.
   *
   * @param {string} userId - The user ID
   * @param {string} sessionId - The session ID
   * @returns {Promise<Object|null>} Session data or null if not found
   */
  static async getSession(userId, sessionId) {
    const logId = `get_session_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`🔍 [SessionTracking] [${logId}] Getting session:`, {
      userId,
      sessionId
    });

    try {
      const sessionRef = adminDb
        .collection('SessionUsage')
        .doc(userId)
        .collection('sessions')
        .doc(sessionId);

      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        console.log(`⚠️ [SessionTracking] [${logId}] Session not found`);
        return null;
      }

      const data = {
        id: sessionDoc.id,
        ...sessionDoc.data(),
        createdAt: sessionDoc.data().createdAt?.toDate?.()?.toISOString() || null,
        lastUpdatedAt: sessionDoc.data().lastUpdatedAt?.toDate?.()?.toISOString() || null,
        completedAt: sessionDoc.data().completedAt?.toDate?.()?.toISOString() || null
      };

      console.log(`✅ [SessionTracking] [${logId}] Session retrieved:`, {
        status: data.status,
        steps: data.steps?.length || 0,
        totalCost: data.totalCost
      });

      return data;

    } catch (error) {
      console.error(`❌ [SessionTracking] [${logId}] Error getting session:`, {
        userId,
        sessionId,
        message: error.message
      });
      throw error;
    }
  }

  /**
   * Get all sessions for a user with optional filters.
   *
   * @param {string} userId - The user ID
   * @param {Object} options - Query options
   * @param {string} options.status - Filter by status ('in-progress', 'completed', 'abandoned')
   * @param {number} options.limit - Maximum number of sessions to return (default: 50)
   * @returns {Promise<Array>} Array of session objects
   */
  static async getUserSessions(userId, { status = null, limit = 50 } = {}) {
    const logId = `get_user_sessions_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`📊 [SessionTracking] [${logId}] Getting user sessions:`, {
      userId,
      status,
      limit
    });

    try {
      let query = adminDb
        .collection('SessionUsage')
        .doc(userId)
        .collection('sessions')
        .orderBy('lastUpdatedAt', 'desc')
        .limit(limit);

      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.get();

      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        lastUpdatedAt: doc.data().lastUpdatedAt?.toDate?.()?.toISOString() || null,
        completedAt: doc.data().completedAt?.toDate?.()?.toISOString() || null
      }));

      console.log(`✅ [SessionTracking] [${logId}] Retrieved ${sessions.length} sessions`);
      return sessions;

    } catch (error) {
      console.error(`❌ [SessionTracking] [${logId}] Error getting user sessions:`, {
        userId,
        message: error.message
      });
      throw error;
    }
  }

  /**
   * Get session statistics including phase breakdowns.
   *
   * @param {string} userId - The user ID
   * @param {string} sessionId - The session ID
   * @returns {Promise<Object|null>} Session statistics or null if not found
   */
  static async getSessionStatistics(userId, sessionId) {
    const logId = `stats_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`📈 [SessionTracking] [${logId}] Getting session statistics:`, {
      userId,
      sessionId
    });

    try {
      const sessionRef = adminDb
        .collection('SessionUsage')
        .doc(userId)
        .collection('sessions')
        .doc(sessionId);

      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        console.log(`⚠️ [SessionTracking] [${logId}] Session not found`);
        return null;
      }

      const data = sessionDoc.data();
      const steps = data.steps || [];

      // Calculate totals
      const totalSteps = steps.length;
      const totalDuration = steps.reduce((sum, s) => sum + (s.duration || 0), 0);
      const totalCost = data.totalCost || 0;

      // Break down by phase (for semantic search)
      const vectorSearchSteps = steps.filter(s => s.stepNumber >= 1 && s.stepNumber <= 6);
      const rerankingSteps = steps.filter(s => s.stepNumber >= 7 && s.stepNumber <= 11);
      const finalizationSteps = steps.filter(s => s.stepNumber === 12);

      const statistics = {
        sessionId,
        feature: data.feature,
        status: data.status,
        totalSteps,
        totalDuration,
        totalCost,
        totalRuns: data.totalRuns || 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
        stepsByPhase: {
          vectorSearch: {
            stepCount: vectorSearchSteps.length,
            duration: vectorSearchSteps.reduce((sum, s) => sum + (s.duration || 0), 0),
            cost: vectorSearchSteps.reduce((sum, s) => sum + (s.cost || 0), 0)
          },
          reranking: {
            stepCount: rerankingSteps.length,
            duration: rerankingSteps.reduce((sum, s) => sum + (s.duration || 0), 0),
            cost: rerankingSteps.reduce((sum, s) => sum + (s.cost || 0), 0)
          },
          finalization: {
            stepCount: finalizationSteps.length,
            duration: finalizationSteps.reduce((sum, s) => sum + (s.duration || 0), 0),
            cost: finalizationSteps.reduce((sum, s) => sum + (s.cost || 0), 0)
          }
        }
      };

      console.log(`✅ [SessionTracking] [${logId}] Statistics calculated:`, {
        totalSteps: statistics.totalSteps,
        totalDuration: statistics.totalDuration,
        totalCost: statistics.totalCost
      });

      return statistics;

    } catch (error) {
      console.error(`❌ [SessionTracking] [${logId}] Error getting statistics:`, {
        userId,
        sessionId,
        message: error.message
      });
      throw error;
    }
  }
}
