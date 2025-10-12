// lib/services/serviceContact/server/costTrackingService.js
// Service for tracking AI usage costs - ENHANCED WITH DETAILED LOGGING

import { adminDb } from '../../../firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { SUBSCRIPTION_LEVELS } from '../../core/constants.js';
import { CONTACT_LIMITS } from '../client/constants/contactConstants.js';
import { getUserSubscriptionDetails } from '../../server/subscriptionService.js';

export class CostTrackingService {

  /**
   * Get user's AI usage for the current month - WITH ENHANCED LOGGING
   */
  static async getUserMonthlyUsage(userId) {
    const operationId = `monthly_usage_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`📊 [CostTracking] [${operationId}] Getting monthly usage for user: ${userId}`);

    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // "2025-09"
      console.log(`📊 [CostTracking] [${operationId}] Current month: ${currentMonth}`);

      // Get user's subscription details using the new unified service
      console.log(`👤 [CostTracking] [${operationId}] Fetching user subscription details...`);
      const subscriptionDetails = await getUserSubscriptionDetails(userId);

      if (!subscriptionDetails.isFound) {
        console.error(`❌ [CostTracking] [${operationId}] User not found: ${userId}`);
        throw new Error('User not found');
      }

      const subscriptionLevel = subscriptionDetails.subscriptionLevel;
      console.log(`👤 [CostTracking] [${operationId}] User subscription level: ${subscriptionLevel}`);

      // Get monthly usage from separate AIUsage collection
      console.log(`📋 [CostTracking] [${operationId}] Fetching AIUsage data from collection...`);
      const usageDoc = await adminDb.collection('AIUsage')
        .doc(userId)
        .collection('monthly')
        .doc(currentMonth)
        .get();

      console.log(`📋 [CostTracking] [${operationId}] AIUsage doc exists: ${usageDoc.exists}`);

      const monthlyUsage = usageDoc.exists ? usageDoc.data() : {
        totalCost: 0,
        totalRuns: 0,
        totalApiCalls: 0,
        featureBreakdown: {},
        modelBreakdown: {},
        costVsRunsBreakdown: {},
        lastUpdated: null
      };

      console.log(`📋 [CostTracking] [${operationId}] Monthly usage data:`, {
        totalCost: monthlyUsage.totalCost,
        totalRuns: monthlyUsage.totalRuns,
        totalApiCalls: monthlyUsage.totalApiCalls || 0,
        featureBreakdownKeys: Object.keys(monthlyUsage.featureBreakdown || {}),
        modelBreakdownKeys: Object.keys(monthlyUsage.modelBreakdown || {}),
        lastUpdated: monthlyUsage.lastUpdated
      });

      // Get subscription limits from the subscription details
      console.log(`📏 [CostTracking] [${operationId}] Getting subscription limits for: ${subscriptionLevel}`);
      const limits = subscriptionDetails.limits;
      console.log(`📏 [CostTracking] [${operationId}] Subscription limits:`, {
        aiCostBudget: limits.aiCostBudget,
        maxAiRunsPerMonth: limits.maxAiRunsPerMonth,
        deepAnalysisEnabled: limits.deepAnalysisEnabled
      });

      const remainingBudget = Math.max(0, (limits.aiCostBudget || 0) - monthlyUsage.totalCost);
      const remainingRuns = Math.max(0, (limits.maxAiRunsPerMonth || 0) - monthlyUsage.totalRuns);
      const percentageUsed = limits.aiCostBudget > 0 ? (monthlyUsage.totalCost / limits.aiCostBudget) * 100 : 0;

      const result = {
        month: currentMonth,
        subscriptionLevel,
        usage: monthlyUsage,
        limits: {
          maxCost: limits.aiCostBudget || 0,
          maxRuns: limits.maxAiRunsPerMonth || 0
        },
        remainingBudget,
        remainingRuns,
        percentageUsed
      };

      console.log(`✅ [CostTracking] [${operationId}] Final result:`, {
        cost: `$${monthlyUsage.totalCost.toFixed(4)}`,
        runs: monthlyUsage.totalRuns,
        remaining: `$${remainingBudget.toFixed(4)}`,
        percentage: `${percentageUsed.toFixed(1)}%`,
        subscriptionLevel
      });

      return result;

    } catch (error) {
      console.error(`❌ [CostTracking] [${operationId}] Error getting user monthly usage:`, {
        userId,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Check if user can afford an AI operation - WITH ENHANCED LOGGING
   */
  static async canAffordOperation(userId, estimatedCost, requireRuns = 1) {
    const operationId = `afford_check_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`💸 [CostTracking] [${operationId}] Checking affordability:`, {
      userId,
      estimatedCost,
      requireRuns
    });

    try {
      const usage = await this.getUserMonthlyUsage(userId);
      console.log(`💸 [CostTracking] [${operationId}] Current usage retrieved:`, {
        totalCost: usage.usage.totalCost,
        totalRuns: usage.usage.totalRuns,
        maxCost: usage.limits.maxCost,
        maxRuns: usage.limits.maxRuns,
        subscriptionLevel: usage.subscriptionLevel
      });

      // Enterprise has unlimited budget
      if (usage.subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE) {
        console.log(`✅ [CostTracking] [${operationId}] Enterprise user - unlimited access`);
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

      // Check run limits
      const wouldExceedRuns = usage.limits.maxRuns > 0 &&
        (usage.usage.totalRuns + requireRuns) > usage.limits.maxRuns;

      console.log(`💸 [CostTracking] [${operationId}] Budget checks:`, {
        currentCost: usage.usage.totalCost,
        estimatedCost,
        newTotal: usage.usage.totalCost + estimatedCost,
        maxCost: usage.limits.maxCost,
        wouldExceedBudget,
        currentRuns: usage.usage.totalRuns,
        requireRuns,
        newRunsTotal: usage.usage.totalRuns + requireRuns,
        maxRuns: usage.limits.maxRuns,
        wouldExceedRuns
      });

      if (wouldExceedBudget) {
        console.log(`❌ [CostTracking] [${operationId}] Would exceed budget`);
        return {
          canAfford: false,
          reason: 'budget_exceeded',
          remainingBudget: usage.remainingBudget,
          remainingRuns: usage.remainingRuns,
          estimatedCost,
          currentUsage: usage.usage.totalCost
        };
      }

      if (wouldExceedRuns) {
        console.log(`❌ [CostTracking] [${operationId}] Would exceed runs`);
        return {
          canAfford: false,
          reason: 'runs_exceeded',
          remainingBudget: usage.remainingBudget,
          remainingRuns: usage.remainingRuns,
          estimatedCost,
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
        estimatedCost,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Record usage with separation of costs vs runs - COMPLETELY FIXED VERSION
   * costType: 'api_call' (always billable) vs 'successful_run' (counts toward limits)
   */
  static async recordSeparatedUsage(userId, actualCost, modelUsed, feature, metadata = {}, costType = 'api_call') {
    const operationId = `separated_usage_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`💰 [CostTracking] [${operationId}] Recording separated usage:`, {
      userId,
      actualCost,
      modelUsed,
      feature,
      costType,
      metadata
    });

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const timestamp = new Date().toISOString();

      const monthlyDocRef = adminDb.collection('AIUsage')
        .doc(userId)
        .collection('monthly')
        .doc(currentMonth);

      const operationDocRef = adminDb.collection('AIUsage')
        .doc(userId)
        .collection('operations')
        .doc();

      await adminDb.runTransaction(async (transaction) => {
        const monthlyDoc = await transaction.get(monthlyDocRef);
        const monthlyData = monthlyDoc.exists ? monthlyDoc.data() : {
          totalCost: 0,
          totalRuns: 0,
          totalApiCalls: 0,
          featureBreakdown: {},
          modelBreakdown: {},
          costVsRunsBreakdown: {},
          createdAt: FieldValue.serverTimestamp()
        };

        // CRITICAL FIX: Ensure all breakdown objects exist
        if (!monthlyData.featureBreakdown) {
          monthlyData.featureBreakdown = {};
        }
        if (!monthlyData.modelBreakdown) {
          monthlyData.modelBreakdown = {};
        }
        if (!monthlyData.costVsRunsBreakdown) {
          monthlyData.costVsRunsBreakdown = {};
        }

        const safeActualCost = Number(actualCost) || 0;
        const safeTotalCost = Number(monthlyData.totalCost) || 0;
        const safeTotalRuns = Number(monthlyData.totalRuns) || 0;
        const safeTotalApiCalls = Number(monthlyData.totalApiCalls) || 0;

        // Always add to total cost
        monthlyData.totalCost = safeTotalCost + safeActualCost;
        monthlyData.lastUpdated = FieldValue.serverTimestamp();

        // Increment based on cost type
        if (costType === 'api_call') {
          monthlyData.totalApiCalls = safeTotalApiCalls + 1;
          console.log(`💰 [CostTracking] [${operationId}] Incrementing API calls: ${safeTotalApiCalls} -> ${safeTotalApiCalls + 1}`);
        } else if (costType === 'successful_run') {
          monthlyData.totalRuns = safeTotalRuns + 1;
          console.log(`💰 [CostTracking] [${operationId}] Incrementing successful runs: ${safeTotalRuns} -> ${safeTotalRuns + 1}`);
        }

        // Initialize feature breakdown if it doesn't exist
        if (!monthlyData.featureBreakdown[feature]) {
          monthlyData.featureBreakdown[feature] = {
            runs: 0,
            cost: 0,
            apiCalls: 0,
            successfulRuns: 0
          };
        }

        const featureData = monthlyData.featureBreakdown[feature];
        const featureCost = Number(featureData.cost) || 0;
        const featureApiCalls = Number(featureData.apiCalls) || 0;
        const featureSuccessfulRuns = Number(featureData.successfulRuns) || 0;

        featureData.cost = featureCost + safeActualCost;

        if (costType === 'api_call') {
          featureData.apiCalls = featureApiCalls + 1;
          featureData.runs = featureApiCalls + 1; // Legacy field
        } else if (costType === 'successful_run') {
          featureData.successfulRuns = featureSuccessfulRuns + 1;
        }

        // Initialize model breakdown if it doesn't exist
        if (!monthlyData.modelBreakdown[modelUsed]) {
          monthlyData.modelBreakdown[modelUsed] = {
            runs: 0,
            cost: 0,
            apiCalls: 0,
            successfulRuns: 0
          };
        }

        const modelData = monthlyData.modelBreakdown[modelUsed];
        const modelCost = Number(modelData.cost) || 0;
        const modelApiCalls = Number(modelData.apiCalls) || 0;
        const modelSuccessfulRuns = Number(modelData.successfulRuns) || 0;

        modelData.cost = modelCost + safeActualCost;

        if (costType === 'api_call') {
          modelData.apiCalls = modelApiCalls + 1;
          modelData.runs = modelApiCalls + 1; // Legacy field
        } else if (costType === 'successful_run') {
          modelData.successfulRuns = modelSuccessfulRuns + 1;
        }

        // Initialize cost vs runs breakdown if it doesn't exist
        if (!monthlyData.costVsRunsBreakdown[feature]) {
          monthlyData.costVsRunsBreakdown[feature] = {
            totalApiCalls: 0,
            successfulRuns: 0,
            filteredCalls: 0,
            totalCost: 0,
            costPerApiCall: 0,
            costPerSuccessfulRun: 0,
            efficiency: 0
          };
        }

        const costVsData = monthlyData.costVsRunsBreakdown[feature];
        costVsData.totalCost = (Number(costVsData.totalCost) || 0) + safeActualCost;

        if (costType === 'api_call') {
          costVsData.totalApiCalls = (Number(costVsData.totalApiCalls) || 0) + 1;
        } else if (costType === 'successful_run') {
          costVsData.successfulRuns = (Number(costVsData.successfulRuns) || 0) + 1;
        }

        // Recalculate efficiency metrics
        if (costVsData.totalApiCalls > 0) {
          costVsData.filteredCalls = costVsData.totalApiCalls - costVsData.successfulRuns;
          costVsData.costPerApiCall = costVsData.totalCost / costVsData.totalApiCalls;
          costVsData.efficiency = costVsData.successfulRuns / costVsData.totalApiCalls;

          if (costVsData.successfulRuns > 0) {
            costVsData.costPerSuccessfulRun = costVsData.totalCost / costVsData.successfulRuns;
          }
        }

        // Store individual operation record
        const operationData = {
          timestamp,
          feature,
          model: modelUsed,
          cost: safeActualCost,
          costType,
          metadata: {
            ...metadata,
            costType,
            operationId
          },
          month: currentMonth,
          createdAt: FieldValue.serverTimestamp()
        };

        transaction.set(monthlyDocRef, monthlyData, { merge: true });
        transaction.set(operationDocRef, operationData);
      });

      console.log(`✅ [CostTracking] [${operationId}] Separated usage recorded:`, {
        userId,
        cost: `${actualCost.toFixed(6)}`,
        feature,
        model: modelUsed,
        costType,
        month: currentMonth
      });

      return { success: true };

    } catch (error) {
      console.error(`❌ [CostTracking] [${operationId}] Error recording separated usage:`, {
        userId,
        actualCost,
        modelUsed,
        feature,
        costType,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Check if user is approaching their limits (for warnings) - WITH ENHANCED LOGGING
   */
  static async checkUsageWarnings(userId) {
    const operationId = `warnings_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`⚠️ [CostTracking] [${operationId}] Checking usage warnings for: ${userId}`);

    try {
      const usage = await this.getUserMonthlyUsage(userId);
      const warnings = [];

      console.log(`⚠️ [CostTracking] [${operationId}] Usage data:`, {
        subscriptionLevel: usage.subscriptionLevel,
        percentageUsed: usage.percentageUsed,
        totalCost: usage.usage.totalCost,
        totalRuns: usage.usage.totalRuns,
        maxCost: usage.limits.maxCost,
        maxRuns: usage.limits.maxRuns
      });

      // Skip warnings for enterprise users
      if (usage.subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE) {
        console.log(`⚠️ [CostTracking] [${operationId}] Enterprise user - no warnings needed`);
        return { warnings: [], percentageUsed: 0 };
      }

      // Cost warning at 80%
      if (usage.percentageUsed >= 80) {
        const warning = {
          type: 'cost_warning',
          severity: usage.percentageUsed >= 95 ? 'high' : 'medium',
          message: `You've used ${usage.percentageUsed.toFixed(0)}% of your monthly AI budget`,
          remainingBudget: usage.remainingBudget,
          upgradeRecommended: usage.percentageUsed >= 90
        };
        warnings.push(warning);
        console.log(`⚠️ [CostTracking] [${operationId}] Cost warning added:`, warning);
      }

      // Run warning at 80%
      const runPercentage = usage.limits.maxRuns > 0 ?
        (usage.usage.totalRuns / usage.limits.maxRuns) * 100 : 0;

      console.log(`⚠️ [CostTracking] [${operationId}] Run percentage: ${runPercentage.toFixed(1)}%`);

      if (runPercentage >= 80) {
        const warning = {
          type: 'runs_warning',
          severity: runPercentage >= 95 ? 'high' : 'medium',
          message: `You've used ${runPercentage.toFixed(0)}% of your monthly AI runs`,
          remainingRuns: usage.remainingRuns,
          upgradeRecommended: runPercentage >= 90
        };
        warnings.push(warning);
        console.log(`⚠️ [CostTracking] [${operationId}] Run warning added:`, warning);
      }

      const result = {
        warnings,
        percentageUsed: Math.max(usage.percentageUsed, runPercentage)
      };

      console.log(`✅ [CostTracking] [${operationId}] Warnings check complete:`, {
        warningCount: warnings.length,
        highestPercentage: result.percentageUsed
      });

      return result;

    } catch (error) {
      console.error(`❌ [CostTracking] [${operationId}] Error checking usage warnings:`, {
        userId,
        message: error.message,
        stack: error.stack
      });
      return { warnings: [], percentageUsed: 0 };
    }
  }

  /**
   * Get detailed usage breakdown with pagination for operations - WITH ENHANCED LOGGING
   */
  static async getDetailedUsage(userId, months = 3, includeOperations = false, operationsLimit = 100) {
    const operationId = `detailed_usage_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`📈 [CostTracking] [${operationId}] Getting detailed usage:`, {
      userId,
      months,
      includeOperations,
      operationsLimit
    });

    try {
      // Get monthly summaries
      console.log(`📈 [CostTracking] [${operationId}] Fetching monthly summaries...`);
      const monthlyQuery = await adminDb.collection('AIUsage')
        .doc(userId)
        .collection('monthly')
        .orderBy('__name__', 'desc')
        .limit(months)
        .get();

      console.log(`📈 [CostTracking] [${operationId}] Monthly query result:`, {
        docsFound: monthlyQuery.docs.length,
        monthsRequested: months
      });

      const monthlyBreakdown = monthlyQuery.docs.map(doc => ({
        month: doc.id,
        ...doc.data(),
        // Convert timestamps for JSON serialization
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        lastUpdated: doc.data().lastUpdated?.toDate?.()?.toISOString() || null
      }));

      console.log(`📈 [CostTracking] [${operationId}] Monthly breakdown processed:`, {
        monthsProcessed: monthlyBreakdown.length,
        monthIds: monthlyBreakdown.map(m => m.month)
      });

      // Get user's subscription level using the new unified service
      console.log(`📈 [CostTracking] [${operationId}] Fetching user subscription level...`);
      const subscriptionDetails = await getUserSubscriptionDetails(userId);
      const subscriptionLevel = subscriptionDetails.subscriptionLevel;

      console.log(`📈 [CostTracking] [${operationId}] User subscription level: ${subscriptionLevel}`);

      const totalLifetimeCost = monthlyBreakdown.reduce((sum, month) => sum + (month.totalCost || 0), 0);
      const totalLifetimeRuns = monthlyBreakdown.reduce((sum, month) => sum + (month.totalRuns || 0), 0);

      const result = {
        subscriptionLevel,
        monthlyBreakdown,
        totalLifetimeCost,
        totalLifetimeRuns
      };

      console.log(`📈 [CostTracking] [${operationId}] Lifetime totals calculated:`, {
        totalLifetimeCost,
        totalLifetimeRuns
      });

      // Optionally include recent operations
      if (includeOperations) {
        console.log(`📈 [CostTracking] [${operationId}] Fetching recent operations...`);
        const operationsQuery = await adminDb.collection('AIUsage')
          .doc(userId)
          .collection('operations')
          .orderBy('createdAt', 'desc')
          .limit(operationsLimit)
          .get();

        console.log(`📈 [CostTracking] [${operationId}] Operations query result:`, {
          operationsFound: operationsQuery.docs.length,
          operationsLimit
        });

        result.recentOperations = operationsQuery.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
        }));
      }

      console.log(`✅ [CostTracking] [${operationId}] Detailed usage complete:`, {
        monthsReturned: result.monthlyBreakdown.length,
        operationsIncluded: !!result.recentOperations,
        operationsCount: result.recentOperations?.length || 0
      });

      return result;

    } catch (error) {
      console.error(`❌ [CostTracking] [${operationId}] Error getting detailed usage:`, {
        userId,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}
