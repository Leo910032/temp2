// lib/services/serviceContact/server/costTracking/stepTracker.js
// Centralized step tracking utility for granular session monitoring

import { SessionTrackingService } from './sessionService.js';

/**
 * StepTracker
 *
 * Provides a simplified API for recording granular steps in multi-phase operations.
 * Used primarily for semantic search to track all 12 steps from query to results.
 *
 * Step Numbering Convention:
 * - Steps 1-6: Vector Search Pipeline
 * - Steps 7-11: Reranking Pipeline
 * - Step 12: Session Finalization
 */
export class StepTracker {
  /**
   * Records a granular step in the session
   *
   * @param {Object} params
   * @param {string} params.userId - User ID
   * @param {string} params.sessionId - Session ID
   * @param {number} params.stepNumber - Sequential step number (1-12)
   * @param {string} params.stepLabel - Human-readable step label
   * @param {string} params.feature - Feature identifier (e.g., 'semantic_search_enhancement')
   * @param {string} [params.provider='internal'] - Provider name (e.g., 'gemini', 'pinecone', 'cohere')
   * @param {number} [params.cost=0] - Cost in USD
   * @param {number} [params.duration=0] - Duration in milliseconds
   * @param {Object} [params.metadata={}] - Additional step-specific data
   * @param {boolean} [params.isBillableRun=false] - Whether this counts as a billable run (default: false)
   * @returns {Promise<string>} The generated operationId
   */
  static async recordStep({
    userId,
    sessionId,
    stepNumber,
    stepLabel,
    feature,
    provider = 'internal',
    cost = 0,
    duration = 0,
    metadata = {},
    isBillableRun = false
  }) {
    // Validate required parameters
    if (!userId || !sessionId || !stepNumber || !stepLabel || !feature) {
      throw new Error('StepTracker.recordStep: Missing required parameters');
    }

    // Generate unique operation ID
    const operationId = `${feature}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const stepData = {
      stepNumber,
      stepLabel,
      operationId,
      usageType: 'ApiUsage',
      feature,
      provider,
      cost,
      isBillableRun,
      timestamp: new Date().toISOString(),
      duration,
      metadata
    };

    // Use existing SessionTrackingService to add step
    await SessionTrackingService.addStepToSession({
      userId,
      sessionId,
      stepData
    });

    console.log(`✅ [StepTracker] Step ${stepNumber}: ${stepLabel} (${duration}ms, $${cost.toFixed(6)})`);

    return operationId;
  }

  /**
   * Helper to calculate vector magnitude for embeddings
   * @private
   */
  static _calculateVectorMagnitude(vector) {
    if (!Array.isArray(vector) || vector.length === 0) return 0;
    const sumOfSquares = vector.reduce((sum, val) => sum + val * val, 0);
    return Math.sqrt(sumOfSquares);
  }

  /**
   * Helper to calculate score distribution statistics
   * @private
   */
  static _calculateScoreDistribution(scores) {
    if (!scores || scores.length === 0) {
      return {
        min: 0,
        p25: 0,
        median: 0,
        p75: 0,
        max: 0,
        mean: 0
      };
    }

    const sorted = [...scores].sort((a, b) => a - b);
    const n = sorted.length;

    return {
      min: sorted[0],
      p25: sorted[Math.floor(n * 0.25)],
      median: sorted[Math.floor(n * 0.5)],
      p75: sorted[Math.floor(n * 0.75)],
      max: sorted[n - 1],
      mean: sorted.reduce((sum, val) => sum + val, 0) / n
    };
  }

  /**
   * Helper to categorize scores into buckets
   * @private
   */
  static _getScoreBreakdown(scores) {
    if (!scores || scores.length === 0) {
      return {
        above_0_5: 0,
        between_0_1_0_5: 0,
        between_0_01_0_1: 0,
        between_0_001_0_01: 0,
        below_0_001: 0
      };
    }

    return {
      above_0_5: scores.filter(s => s >= 0.5).length,
      between_0_1_0_5: scores.filter(s => s >= 0.1 && s < 0.5).length,
      between_0_01_0_1: scores.filter(s => s >= 0.01 && s < 0.1).length,
      between_0_001_0_01: scores.filter(s => s >= 0.001 && s < 0.01).length,
      below_0_001: scores.filter(s => s < 0.001).length
    };
  }
}

export default StepTracker;
