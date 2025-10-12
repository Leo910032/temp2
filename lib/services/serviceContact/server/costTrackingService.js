// lib/services/serviceContact/server/costTrackingService.js
// REFACTORED: Generic service for tracking AI and API costs with scalable architecture
// Enhanced with session tracking for multi-step operations

import { adminDb } from '../../../firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { SUBSCRIPTION_LEVELS } from '../../core/constants.js';
import { getUserSubscriptionDetails } from '../../server/subscriptionService.js';
import { SessionTrackingService } from './costTracking/sessionService.js';

/**
 * Generic cost tracking service for managing usage across different resource types.
 * Supports tracking for AI operations, third-party APIs (Google Maps, Pinecone, etc.)
 *
 * Database Structure:
 * - AIUsage/{userId}/monthly/{YYYY-MM}
 * - AIUsage/{userId}/operations/{operationId}
 * - ApiUsage/{userId}/monthly/{YYYY-MM}
 * - ApiUsage/{userId}/operations/{operationId}
 * - SessionUsage/{userId}/sessions/{sessionId} (for multi-step operations)
 */
export class CostTrackingService {

  /**
   * Record a usage event for any type of resource (AI, API, etc.)
   * This is the main function for tracking costs across the platform.
   * Enhanced to support session tracking for multi-step operations.
   *
   * @param {Object} params - Usage parameters
   * @param {string} params.userId - User ID
   * @param {string} params.usageType - Type of usage collection ('AIUsage', 'ApiUsage')
   * @param {string} params.feature - Feature name (e.g., 'business_card_scan', 'google_maps_places')
   * @param {number} params.cost - Monetary cost of the operation
   * @param {boolean} params.isBillableRun - Whether this counts toward monthly run limits (default: false)
   * @param {string} params.provider - Service provider (e.g., 'openai', 'anthropic', 'google_maps')
   * @param {Object} params.metadata - Additional data to record (model, tokens, etc.)
   * @param {string|null} params.sessionId - Optional session ID to group related operations
   */
  static async recordUsage({
    userId,
    usageType = 'AIUsage',
    feature,
    cost = 0,
    isBillableRun = false,
    provider = 'unknown',
    metadata = {},
    sessionId = null
  }) {
    const operationId = `usage_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`💰 [CostTracking] [${operationId}] Recording ${usageType}:`, {
      userId,
      feature,
      cost,
      isBillableRun,
      provider,
      sessionId: sessionId || 'none'
    });

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const timestamp = new Date().toISOString();
      const safeCost = Number(cost) || 0;

      const usageCollection = adminDb.collection(usageType);
      const monthlyDocRef = usageCollection.doc(userId).collection('monthly').doc(currentMonth);
      const operationDocRef = usageCollection.doc(userId).collection('operations').doc();

      await adminDb.runTransaction(async (transaction) => {
        const monthlyDoc = await transaction.get(monthlyDocRef);

        // Initialize or get existing monthly data
        const monthlyData = monthlyDoc.exists ? monthlyDoc.data() : {
          totalCost: 0,
          totalRuns: 0,
          totalApiCalls: 0,
          featureBreakdown: {},
          providerBreakdown: {},
          createdAt: FieldValue.serverTimestamp()
        };

        // Ensure all breakdown objects exist
        monthlyData.featureBreakdown = monthlyData.featureBreakdown || {};
        monthlyData.providerBreakdown = monthlyData.providerBreakdown || {};

        // Update totals
        monthlyData.totalCost = (Number(monthlyData.totalCost) || 0) + safeCost;
        monthlyData.totalApiCalls = (Number(monthlyData.totalApiCalls) || 0) + 1;

        if (isBillableRun) {
          monthlyData.totalRuns = (Number(monthlyData.totalRuns) || 0) + 1;
          console.log(`💰 [CostTracking] [${operationId}] Incrementing billable runs: ${monthlyData.totalRuns}`);
        }

        monthlyData.lastUpdated = FieldValue.serverTimestamp();

        // Update feature breakdown
        if (!monthlyData.featureBreakdown[feature]) {
          monthlyData.featureBreakdown[feature] = {
            cost: 0,
            apiCalls: 0,
            billableRuns: 0
          };
        }

        const featureData = monthlyData.featureBreakdown[feature];
        featureData.cost = (Number(featureData.cost) || 0) + safeCost;
        featureData.apiCalls = (Number(featureData.apiCalls) || 0) + 1;

        if (isBillableRun) {
          featureData.billableRuns = (Number(featureData.billableRuns) || 0) + 1;
        }

        // Update provider breakdown
        if (!monthlyData.providerBreakdown[provider]) {
          monthlyData.providerBreakdown[provider] = {
            cost: 0,
            apiCalls: 0,
            billableRuns: 0
          };
        }

        const providerData = monthlyData.providerBreakdown[provider];
        providerData.cost = (Number(providerData.cost) || 0) + safeCost;
        providerData.apiCalls = (Number(providerData.apiCalls) || 0) + 1;

        if (isBillableRun) {
          providerData.billableRuns = (Number(providerData.billableRuns) || 0) + 1;
        }

        // Calculate efficiency metrics for AI usage
        if (usageType === 'AIUsage' && monthlyData.totalApiCalls > 0) {
          monthlyData.efficiency = monthlyData.totalRuns / monthlyData.totalApiCalls;
          monthlyData.costPerApiCall = monthlyData.totalCost / monthlyData.totalApiCalls;
          if (monthlyData.totalRuns > 0) {
            monthlyData.costPerBillableRun = monthlyData.totalCost / monthlyData.totalRuns;
          }
        }

        // Store individual operation record
        const operationData = {
          timestamp,
          feature,
          provider,
          cost: safeCost,
          isBillableRun,
          metadata: {
            ...metadata,
            operationId,
            usageType,
            sessionId
          },
          month: currentMonth,
          createdAt: FieldValue.serverTimestamp()
        };

        transaction.set(monthlyDocRef, monthlyData, { merge: true });
        transaction.set(operationDocRef, operationData);
      });

      // If a sessionId is provided, add this operation to the session
      if (sessionId) {
        try {
          await SessionTrackingService.addStepToSession({
            userId,
            sessionId,
            stepData: {
              operationId: operationDocRef.id,
              usageType,
              feature,
              provider,
              cost: safeCost,
              isBillableRun,
              timestamp,
              metadata: {
                ...metadata,
                operationId
              }
            }
          });
          console.log(`🔗 [CostTracking] [${operationId}] Added to session: ${sessionId}`);
        } catch (sessionError) {
          console.error(`⚠️ [CostTracking] [${operationId}] Failed to add to session:`, sessionError.message);
          // Don't fail the main operation if session tracking fails
        }
      }

      console.log(`✅ [CostTracking] [${operationId}] Usage recorded:`, {
        usageType,
        cost: `$${safeCost.toFixed(6)}`,
        feature,
        provider,
        isBillableRun,
        session: sessionId || 'none'
      });

      return { success: true, operationId };

    } catch (error) {
      console.error(`❌ [CostTracking] [${operationId}] Error recording usage:`, {
        userId,
        usageType,
        feature,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get user's monthly usage for a specific usage type
   *
   * @param {string} userId - User ID
   * @param {string} usageType - Type of usage ('AIUsage', 'ApiUsage')
   * @returns {Object} Monthly usage summary with limits and remaining budget
   */
  static async getUserMonthlyUsage(userId, usageType = 'AIUsage') {
    const operationId = `monthly_usage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    console.log(`📊 [CostTracking] [${operationId}] Getting ${usageType} for user: ${userId}`);

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Get user subscription details
      const subscriptionDetails = await getUserSubscriptionDetails(userId);

      if (!subscriptionDetails.isFound) {
        console.error(`❌ [CostTracking] [${operationId}] User not found: ${userId}`);
        throw new Error('User not found');
      }

      const subscriptionLevel = subscriptionDetails.subscriptionLevel;
      console.log(`👤 [CostTracking] [${operationId}] User subscription: ${subscriptionLevel}`);

      // Get monthly usage
      const usageDoc = await adminDb.collection(usageType)
        .doc(userId)
        .collection('monthly')
        .doc(currentMonth)
        .get();

      const monthlyUsage = usageDoc.exists ? usageDoc.data() : {
        totalCost: 0,
        totalRuns: 0,
        totalApiCalls: 0,
        featureBreakdown: {},
        providerBreakdown: {},
        lastUpdated: null
      };

      console.log(`📋 [CostTracking] [${operationId}] Monthly usage:`, {
        totalCost: monthlyUsage.totalCost,
        totalRuns: monthlyUsage.totalRuns,
        totalApiCalls: monthlyUsage.totalApiCalls
      });

      // Get subscription limits
      const limits = subscriptionDetails.limits;
      const maxCost = usageType === 'AIUsage' ? limits.aiCostBudget || 0 : limits.apiCostBudget || 0;
      const maxRuns = usageType === 'AIUsage' ? limits.maxAiRunsPerMonth || 0 : limits.maxApiCallsPerMonth || 0;

      const remainingBudget = Math.max(0, maxCost - monthlyUsage.totalCost);
      const remainingRuns = Math.max(0, maxRuns - monthlyUsage.totalRuns);
      const percentageUsed = maxCost > 0 ? (monthlyUsage.totalCost / maxCost) * 100 : 0;

      const result = {
        month: currentMonth,
        subscriptionLevel,
        usageType,
        usage: monthlyUsage,
        limits: {
          maxCost,
          maxRuns
        },
        remainingBudget,
        remainingRuns,
        percentageUsed
      };

      console.log(`✅ [CostTracking] [${operationId}] Result:`, {
        cost: `$${monthlyUsage.totalCost.toFixed(4)}`,
        runs: monthlyUsage.totalRuns,
        remaining: `$${remainingBudget.toFixed(4)}`,
        percentage: `${percentageUsed.toFixed(1)}%`
      });

      return result;

    } catch (error) {
      console.error(`❌ [CostTracking] [${operationId}] Error getting monthly usage:`, {
        userId,
        usageType,
        message: error.message
      });
      throw error;
    }
  }

  /**
   * Check if user can afford an AI operation
   * Only checks AI usage limits (backward compatibility)
   *
   * @param {string} userId - User ID
   * @param {number} estimatedCost - Estimated cost of the operation
   * @param {number} requireRuns - Number of billable runs required (default: 1)
   * @returns {Object} Affordability check result
   */
  static async canAffordOperation(userId, estimatedCost, requireRuns = 1) {
    const operationId = `afford_check_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    console.log(`💸 [CostTracking] [${operationId}] Checking AI affordability:`, {
      userId,
      estimatedCost,
      requireRuns
    });

    try {
      const usage = await this.getUserMonthlyUsage(userId, 'AIUsage');

      // Enterprise has unlimited budget
      if (usage.subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE) {
        console.log(`✅ [CostTracking] [${operationId}] Enterprise user - unlimited`);
        return {
          canAfford: true,
          reason: 'enterprise_unlimited',
          remainingBudget: -1,
          remainingRuns: -1
        };
      }

      // Check cost budget
      const wouldExceedBudget = usage.limits.maxCost > 0 &&
        (usage.usage.totalCost + estimatedCost) > usage.limits.maxCost;

      if (wouldExceedBudget) {
        console.log(`❌ [CostTracking] [${operationId}] Would exceed budget`);
        return {
          canAfford: false,
          reason: 'budget_exceeded',
          remainingBudget: usage.remainingBudget,
          estimatedCost,
          currentUsage: usage.usage.totalCost
        };
      }

      // Check run limits
      const wouldExceedRuns = usage.limits.maxRuns > 0 &&
        (usage.usage.totalRuns + requireRuns) > usage.limits.maxRuns;

      if (wouldExceedRuns) {
        console.log(`❌ [CostTracking] [${operationId}] Would exceed runs`);
        return {
          canAfford: false,
          reason: 'runs_exceeded',
          remainingRuns: usage.remainingRuns,
          currentRuns: usage.usage.totalRuns
        };
      }

      console.log(`✅ [CostTracking] [${operationId}] User can afford operation`);
      return {
        canAfford: true,
        reason: 'within_limits',
        remainingBudget: usage.remainingBudget - estimatedCost,
        remainingRuns: usage.remainingRuns - requireRuns
      };

    } catch (error) {
      console.error(`❌ [CostTracking] [${operationId}] Error checking affordability:`, {
        userId,
        message: error.message
      });
      throw error;
    }
  }

  /**
   * Generic affordability check for any usage type
   *
   * @param {string} userId - User ID
   * @param {string} usageType - Type of usage ('AIUsage', 'ApiUsage')
   * @param {number} estimatedCost - Estimated cost
   * @param {boolean} requiresBillableRun - Whether this requires a billable run slot
   * @returns {Object} Affordability check result
   */
  static async canAffordGeneric(userId, usageType, estimatedCost, requiresBillableRun = false) {
    const operationId = `generic_afford_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    console.log(`💸 [CostTracking] [${operationId}] Generic affordability check:`, {
      userId,
      usageType,
      estimatedCost,
      requiresBillableRun
    });

    try {
      const usage = await this.getUserMonthlyUsage(userId, usageType);

      if (usage.subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE) {
        return {
          canAfford: true,
          reason: 'enterprise_unlimited'
        };
      }

      const wouldExceedBudget = usage.limits.maxCost > 0 &&
        (usage.usage.totalCost + estimatedCost) > usage.limits.maxCost;

      if (wouldExceedBudget) {
        return {
          canAfford: false,
          reason: 'budget_exceeded',
          remainingBudget: usage.remainingBudget
        };
      }

      if (requiresBillableRun) {
        const wouldExceedRuns = usage.limits.maxRuns > 0 &&
          (usage.usage.totalRuns + 1) > usage.limits.maxRuns;

        if (wouldExceedRuns) {
          return {
            canAfford: false,
            reason: 'runs_exceeded',
            remainingRuns: usage.remainingRuns
          };
        }
      }

      return {
        canAfford: true,
        reason: 'within_limits',
        remainingBudget: usage.remainingBudget - estimatedCost
      };

    } catch (error) {
      console.error(`❌ [CostTracking] [${operationId}] Error in generic affordability check:`, error);
      throw error;
    }
  }

  /**
   * Check usage warnings for approaching limits
   *
   * @param {string} userId - User ID
   * @param {string} usageType - Type of usage (default: 'AIUsage')
   * @returns {Object} Warning information
   */
  static async checkUsageWarnings(userId, usageType = 'AIUsage') {
    const operationId = `warnings_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    console.log(`⚠️ [CostTracking] [${operationId}] Checking warnings for ${usageType}:`, userId);

    try {
      const usage = await this.getUserMonthlyUsage(userId, usageType);
      const warnings = [];

      if (usage.subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE) {
        return { warnings: [], percentageUsed: 0 };
      }

      // Cost warning at 80%
      if (usage.percentageUsed >= 80) {
        warnings.push({
          type: 'cost_warning',
          severity: usage.percentageUsed >= 95 ? 'high' : 'medium',
          message: `You've used ${usage.percentageUsed.toFixed(0)}% of your monthly ${usageType} budget`,
          remainingBudget: usage.remainingBudget,
          upgradeRecommended: usage.percentageUsed >= 90
        });
      }

      // Run warning at 80%
      const runPercentage = usage.limits.maxRuns > 0 ?
        (usage.usage.totalRuns / usage.limits.maxRuns) * 100 : 0;

      if (runPercentage >= 80) {
        warnings.push({
          type: 'runs_warning',
          severity: runPercentage >= 95 ? 'high' : 'medium',
          message: `You've used ${runPercentage.toFixed(0)}% of your monthly ${usageType} runs`,
          remainingRuns: usage.remainingRuns,
          upgradeRecommended: runPercentage >= 90
        });
      }

      return {
        warnings,
        percentageUsed: Math.max(usage.percentageUsed, runPercentage)
      };

    } catch (error) {
      console.error(`❌ [CostTracking] [${operationId}] Error checking warnings:`, error);
      return { warnings: [], percentageUsed: 0 };
    }
  }

  /**
   * Get detailed usage breakdown with historical data
   *
   * @param {string} userId - User ID
   * @param {string} usageType - Type of usage (default: 'AIUsage')
   * @param {number} months - Number of months to retrieve (default: 3)
   * @param {boolean} includeOperations - Include individual operations (default: false)
   * @param {number} operationsLimit - Max operations to return (default: 100)
   * @returns {Object} Detailed usage information
   */
  static async getDetailedUsage(userId, usageType = 'AIUsage', months = 3, includeOperations = false, operationsLimit = 100) {
    const operationId = `detailed_usage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    console.log(`📈 [CostTracking] [${operationId}] Getting detailed ${usageType}:`, {
      userId,
      months,
      includeOperations
    });

    try {
      // Get monthly summaries
      const monthlyQuery = await adminDb.collection(usageType)
        .doc(userId)
        .collection('monthly')
        .orderBy('__name__', 'desc')
        .limit(months)
        .get();

      const monthlyBreakdown = monthlyQuery.docs.map(doc => ({
        month: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        lastUpdated: doc.data().lastUpdated?.toDate?.()?.toISOString() || null
      }));

      // Get subscription details
      const subscriptionDetails = await getUserSubscriptionDetails(userId);

      const totalLifetimeCost = monthlyBreakdown.reduce((sum, month) => sum + (month.totalCost || 0), 0);
      const totalLifetimeRuns = monthlyBreakdown.reduce((sum, month) => sum + (month.totalRuns || 0), 0);
      const totalLifetimeApiCalls = monthlyBreakdown.reduce((sum, month) => sum + (month.totalApiCalls || 0), 0);

      const result = {
        usageType,
        subscriptionLevel: subscriptionDetails.subscriptionLevel,
        monthlyBreakdown,
        totalLifetimeCost,
        totalLifetimeRuns,
        totalLifetimeApiCalls
      };

      // Include recent operations if requested
      if (includeOperations) {
        const operationsQuery = await adminDb.collection(usageType)
          .doc(userId)
          .collection('operations')
          .orderBy('createdAt', 'desc')
          .limit(operationsLimit)
          .get();

        result.recentOperations = operationsQuery.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
        }));
      }

      console.log(`✅ [CostTracking] [${operationId}] Detailed usage retrieved:`, {
        monthsReturned: result.monthlyBreakdown.length,
        totalCost: totalLifetimeCost,
        operationsIncluded: !!result.recentOperations
      });

      return result;

    } catch (error) {
      console.error(`❌ [CostTracking] [${operationId}] Error getting detailed usage:`, {
        userId,
        usageType,
        message: error.message
      });
      throw error;
    }
  }

  // ========================================
  // SESSION TRACKING METHODS
  // Expose session tracking functionality
  // ========================================

  /**
   * Finalize a session to mark it as completed.
   * This is a convenience method that delegates to SessionTrackingService.
   *
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID to finalize
   * @returns {Promise<{success: boolean}>}
   */
  static async finalizeSession(userId, sessionId) {
    return SessionTrackingService.finalizeSession({ userId, sessionId });
  }

  /**
   * Get session details.
   * This is a convenience method that delegates to SessionTrackingService.
   *
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>}
   */
  static async getSession(userId, sessionId) {
    return SessionTrackingService.getSession(userId, sessionId);
  }

  /**
   * Get user sessions with optional filters.
   * This is a convenience method that delegates to SessionTrackingService.
   *
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  static async getUserSessions(userId, options = {}) {
    return SessionTrackingService.getUserSessions(userId, options);
  }

  // ========================================
  // BACKWARD COMPATIBILITY METHODS
  // These maintain compatibility with existing code
  // ========================================

  /**
   * @deprecated Use recordUsage() instead
   * Record AI usage with legacy separation of costs vs runs
   */
  static async recordSeparatedUsage(userId, actualCost, modelUsed, feature, metadata = {}, costType = 'api_call') {
    console.warn(`⚠️ [CostTracking] recordSeparatedUsage is deprecated. Use recordUsage() instead.`);

    return this.recordUsage({
      userId,
      usageType: 'AIUsage',
      feature,
      cost: actualCost,
      isBillableRun: costType === 'successful_run',
      provider: modelUsed,
      metadata: {
        ...metadata,
        legacyCostType: costType,
        model: modelUsed
      }
    });
  }
}
