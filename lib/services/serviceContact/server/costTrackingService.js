// lib/services/serviceContact/server/costTrackingService.js
// Service for tracking AI usage costs using separate collection

import { adminDb } from '../../../../lib/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { CONTACT_LIMITS, SUBSCRIPTION_LEVELS } from '../client/services/constants/contactConstants.js';

export class CostTrackingService {
  
  /**
   * Get user's AI usage for the current month
   */
  static async getUserMonthlyUsage(userId) {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // "2025-09"
      
      // Get user's account type from AccountData
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';

      // Get monthly usage from separate AIUsage collection
      const usageDoc = await adminDb.collection('AIUsage')
        .doc(userId)
        .collection('monthly')
        .doc(currentMonth)
        .get();

      const monthlyUsage = usageDoc.exists ? usageDoc.data() : {
        totalCost: 0,
        totalRuns: 0,
        featureBreakdown: {},
        modelBreakdown: {},
        lastUpdated: null
      };

      // Get subscription limits
      const limits = CONTACT_LIMITS[subscriptionLevel] || CONTACT_LIMITS[SUBSCRIPTION_LEVELS.BASE];

      const result = {
        month: currentMonth,
        subscriptionLevel,
        usage: monthlyUsage,
        limits: {
          maxCost: limits.aiCostBudget || 0,
          maxRuns: limits.maxAiRunsPerMonth || 0
        },
        remainingBudget: Math.max(0, (limits.aiCostBudget || 0) - monthlyUsage.totalCost),
        remainingRuns: Math.max(0, (limits.maxAiRunsPerMonth || 0) - monthlyUsage.totalRuns),
        percentageUsed: limits.aiCostBudget > 0 ? (monthlyUsage.totalCost / limits.aiCostBudget) * 100 : 0
      };

      console.log(`📊 [CostTracking] User ${userId} monthly usage:`, {
        cost: `$${monthlyUsage.totalCost.toFixed(4)}`,
        runs: monthlyUsage.totalRuns,
        remaining: `$${result.remainingBudget.toFixed(4)}`,
        percentage: `${result.percentageUsed.toFixed(1)}%`
      });

      return result;

    } catch (error) {
      console.error('❌ Error getting user monthly usage:', error);
      throw error;
    }
  }

  /**
   * Check if user can afford an AI operation
   */
  static async canAffordOperation(userId, estimatedCost, requireRuns = 1) {
    try {
      const usage = await this.getUserMonthlyUsage(userId);
      
      // Enterprise has unlimited budget
      if (usage.subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE) {
        console.log(`✅ [CostTracking] Enterprise user ${userId} - unlimited access`);
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

      if (wouldExceedBudget) {
        console.log(`❌ [CostTracking] User ${userId} would exceed budget: $${(usage.usage.totalCost + estimatedCost).toFixed(4)} > $${usage.limits.maxCost}`);
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
        console.log(`❌ [CostTracking] User ${userId} would exceed runs: ${usage.usage.totalRuns + requireRuns} > ${usage.limits.maxRuns}`);
        return {
          canAfford: false,
          reason: 'runs_exceeded',
          remainingBudget: usage.remainingBudget,
          remainingRuns: usage.remainingRuns,
          estimatedCost,
          currentRuns: usage.usage.totalRuns
        };
      }

      console.log(`✅ [CostTracking] User ${userId} can afford operation: ${estimatedCost.toFixed(4)}`);
      return {
        canAfford: true,
        reason: 'within_limits',
        remainingBudget: usage.remainingBudget - estimatedCost,
        remainingRuns: usage.remainingRuns - requireRuns
      };

    } catch (error) {
      console.error('❌ Error checking if user can afford operation:', error);
      throw error;
    }
  }

  /**
   * Record AI usage after an operation completes
   * Now uses separate AIUsage collection with unlimited operations
   */
  static async recordUsage(userId, actualCost, modelUsed, feature, metadata = {}) {
    try {
      // Validate inputs
      if (isNaN(actualCost) || actualCost < 0) {
        throw new Error(`Invalid cost: ${actualCost}`);
      }

      const currentMonth = new Date().toISOString().slice(0, 7);
      const timestamp = new Date().toISOString();
      
      // References for the new structure
      const monthlyDocRef = adminDb.collection('AIUsage')
        .doc(userId)
        .collection('monthly')
        .doc(currentMonth);

      const operationDocRef = adminDb.collection('AIUsage')
        .doc(userId)
        .collection('operations')
        .doc(); // Auto-generated ID

      await adminDb.runTransaction(async (transaction) => {
        // Get current monthly totals
        const monthlyDoc = await transaction.get(monthlyDocRef);
        const monthlyData = monthlyDoc.exists ? monthlyDoc.data() : {
          totalCost: 0,
          totalRuns: 0,
          featureBreakdown: {},
          modelBreakdown: {},
          createdAt: FieldValue.serverTimestamp()
        };

        // Ensure all values are numbers, not NaN
        const safeActualCost = Number(actualCost) || 0;
        const safeTotalCost = Number(monthlyData.totalCost) || 0;
        const safeTotalRuns = Number(monthlyData.totalRuns) || 0;

        // Update monthly totals
        monthlyData.totalCost = safeTotalCost + safeActualCost;
        monthlyData.totalRuns = safeTotalRuns + 1;
        monthlyData.lastUpdated = FieldValue.serverTimestamp();

        // Update feature breakdown
        if (!monthlyData.featureBreakdown[feature]) {
          monthlyData.featureBreakdown[feature] = { runs: 0, cost: 0 };
        }
        const featureRuns = Number(monthlyData.featureBreakdown[feature].runs) || 0;
        const featureCost = Number(monthlyData.featureBreakdown[feature].cost) || 0;
        
        monthlyData.featureBreakdown[feature].runs = featureRuns + 1;
        monthlyData.featureBreakdown[feature].cost = featureCost + safeActualCost;

        // Update model breakdown
        if (!monthlyData.modelBreakdown[modelUsed]) {
          monthlyData.modelBreakdown[modelUsed] = { runs: 0, cost: 0 };
        }
        const modelRuns = Number(monthlyData.modelBreakdown[modelUsed].runs) || 0;
        const modelCost = Number(monthlyData.modelBreakdown[modelUsed].cost) || 0;
        
        monthlyData.modelBreakdown[modelUsed].runs = modelRuns + 1;
        monthlyData.modelBreakdown[modelUsed].cost = modelCost + safeActualCost;

        // Store individual operation record (unlimited storage)
        const operationData = {
          timestamp,
          feature,
          model: modelUsed,
          cost: safeActualCost,
          metadata,
          month: currentMonth,
          createdAt: FieldValue.serverTimestamp()
        };

        // Update both documents
        transaction.set(monthlyDocRef, monthlyData, { merge: true });
        transaction.set(operationDocRef, operationData);
      });

      console.log(`💰 [CostTracking] Recorded usage for ${userId}:`, {
        cost: `${actualCost.toFixed(6)}`,
        feature,
        model: modelUsed,
        month: currentMonth
      });

      return { success: true };

    } catch (error) {
      console.error('❌ Error recording AI usage:', error);
      throw error;
    }
  }

  /**
   * Get detailed usage breakdown with pagination for operations
   */
  static async getDetailedUsage(userId, months = 3, includeOperations = false, operationsLimit = 100) {
    try {
      // Get monthly summaries
      const monthlyQuery = await adminDb.collection('AIUsage')
        .doc(userId)
        .collection('monthly')
        .orderBy('__name__', 'desc')
        .limit(months)
        .get();

      const monthlyBreakdown = monthlyQuery.docs.map(doc => ({
        month: doc.id,
        ...doc.data(),
        // Convert timestamps for JSON serialization
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        lastUpdated: doc.data().lastUpdated?.toDate?.()?.toISOString() || null
      }));

      // Get user's subscription level
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      const subscriptionLevel = userDoc.exists ? 
        userDoc.data().accountType?.toLowerCase() || 'base' : 'base';

      const result = {
        subscriptionLevel,
        monthlyBreakdown,
        totalLifetimeCost: monthlyBreakdown.reduce((sum, month) => sum + (month.totalCost || 0), 0),
        totalLifetimeRuns: monthlyBreakdown.reduce((sum, month) => sum + (month.totalRuns || 0), 0)
      };

      // Optionally include recent operations
      if (includeOperations) {
        const operationsQuery = await adminDb.collection('AIUsage')
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

      return result;

    } catch (error) {
      console.error('❌ Error getting detailed usage:', error);
      throw error;
    }
  }

  /**
   * Get operations for a specific time period with pagination
   */
  static async getOperations(userId, options = {}) {
    try {
      const {
        startDate,
        endDate,
        feature,
        model,
        limit = 50,
        offset = 0,
        orderBy = 'createdAt',
        orderDirection = 'desc'
      } = options;

      let query = adminDb.collection('AIUsage')
        .doc(userId)
        .collection('operations');

      // Add filters
      if (startDate) {
        query = query.where('timestamp', '>=', startDate);
      }
      if (endDate) {
        query = query.where('timestamp', '<=', endDate);
      }
      if (feature) {
        query = query.where('feature', '==', feature);
      }
      if (model) {
        query = query.where('model', '==', model);
      }

      // Add ordering and pagination
      query = query.orderBy(orderBy, orderDirection)
        .offset(offset)
        .limit(limit);

      const snapshot = await query.get();
      
      const operations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
      }));

      // Get total count for pagination
      const countQuery = adminDb.collection('AIUsage')
        .doc(userId)
        .collection('operations');
      
      const countSnapshot = await countQuery.count().get();
      const totalCount = countSnapshot.data().count;

      return {
        operations,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      };

    } catch (error) {
      console.error('❌ Error getting operations:', error);
      throw error;
    }
  }

  /**
   * Check if user is approaching their limits (for warnings)
   */
  static async checkUsageWarnings(userId) {
    try {
      const usage = await this.getUserMonthlyUsage(userId);
      const warnings = [];

      // Skip warnings for enterprise users
      if (usage.subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE) {
        return { warnings: [], percentageUsed: 0 };
      }

      // Cost warning at 80%
      if (usage.percentageUsed >= 80) {
        warnings.push({
          type: 'cost_warning',
          severity: usage.percentageUsed >= 95 ? 'high' : 'medium',
          message: `You've used ${usage.percentageUsed.toFixed(0)}% of your monthly AI budget`,
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
          message: `You've used ${runPercentage.toFixed(0)}% of your monthly AI runs`,
          remainingRuns: usage.remainingRuns,
          upgradeRecommended: runPercentage >= 90
        });
      }

      return { 
        warnings, 
        percentageUsed: Math.max(usage.percentageUsed, runPercentage) 
      };

    } catch (error) {
      console.error('❌ Error checking usage warnings:', error);
      return { warnings: [], percentageUsed: 0 };
    }
  }

  /**
   * Cleanup old usage data (operations older than specified months)
   */
  static async cleanupOldUsageData(monthsToKeep = 12) {
    try {
      console.log(`🧹 [CostTracking] Starting cleanup of usage data older than ${monthsToKeep} months`);
      
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);
      const cutoffTimestamp = cutoffDate.toISOString();

      // Get all users with AI usage data
      const usersQuery = await adminDb.collection('AIUsage').get();

      let cleanedUsers = 0;
      let deletedOperations = 0;
      let deletedMonthlyDocs = 0;

      for (const userDoc of usersQuery.docs) {
        const userId = userDoc.id;

        // Clean up old operations
        const oldOperationsQuery = await adminDb.collection('AIUsage')
          .doc(userId)
          .collection('operations')
          .where('timestamp', '<', cutoffTimestamp)
          .get();

        if (!oldOperationsQuery.empty) {
          const batch = adminDb.batch();
          oldOperationsQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          deletedOperations += oldOperationsQuery.size;
        }

        // Clean up old monthly summaries
        const cutoffMonth = cutoffTimestamp.slice(0, 7);
        const oldMonthlyQuery = await adminDb.collection('AIUsage')
          .doc(userId)
          .collection('monthly')
          .where('__name__', '<', cutoffMonth)
          .get();

        if (!oldMonthlyQuery.empty) {
          const batch = adminDb.batch();
          oldMonthlyQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          deletedMonthlyDocs += oldMonthlyQuery.size;
        }

        if (!oldOperationsQuery.empty || !oldMonthlyQuery.empty) {
          cleanedUsers++;
        }
      }

      console.log(`✅ [CostTracking] Cleanup completed:`, {
        cleanedUsers,
        deletedOperations,
        deletedMonthlyDocs
      });

      return { cleanedUsers, deletedOperations, deletedMonthlyDocs };

    } catch (error) {
      console.error('❌ Error during usage data cleanup:', error);
      throw error;
    }
  }

  /**
   * Migrate existing data from AccountData to new AIUsage collection
   */
  static async migrateFromAccountData(userId) {
    try {
      console.log(`🔄 [Migration] Starting migration for user ${userId}`);

      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const aiUsage = userData.aiUsage || {};

      let migratedMonths = 0;
      let migratedOperations = 0;

      for (const [monthKey, monthData] of Object.entries(aiUsage)) {
        if (monthKey === 'lastUpdated' || !monthData) continue;

        // Migrate monthly summary
        const monthlyDocRef = adminDb.collection('AIUsage')
          .doc(userId)
          .collection('monthly')
          .doc(monthKey);

        const monthlyDataToMigrate = {
          totalCost: Number(monthData.totalCost) || 0,
          totalRuns: Number(monthData.totalRuns) || 0,
          featureBreakdown: monthData.featureBreakdown || {},
          modelBreakdown: monthData.modelBreakdown || {},
          createdAt: FieldValue.serverTimestamp(),
          lastUpdated: FieldValue.serverTimestamp(),
          migratedFrom: 'AccountData'
        };

        await monthlyDocRef.set(monthlyDataToMigrate);
        migratedMonths++;

        // Migrate individual operations if they exist
        if (monthData.operations && Array.isArray(monthData.operations)) {
          const batch = adminDb.batch();
          
          for (const operation of monthData.operations) {
            const operationDocRef = adminDb.collection('AIUsage')
              .doc(userId)
              .collection('operations')
              .doc();

            const operationDataToMigrate = {
              timestamp: operation.timestamp,
              feature: operation.feature,
              model: operation.model,
              cost: Number(operation.cost) || 0,
              metadata: operation.metadata || {},
              month: monthKey,
              createdAt: FieldValue.serverTimestamp(),
              migratedFrom: 'AccountData'
            };

            batch.set(operationDocRef, operationDataToMigrate);
            migratedOperations++;
          }

          await batch.commit();
        }
      }

      console.log(`✅ [Migration] Completed for user ${userId}:`, {
        migratedMonths,
        migratedOperations
      });

      return { migratedMonths, migratedOperations };

    } catch (error) {
      console.error(`❌ Error migrating data for user ${userId}:`, error);
      throw error;
    }
  }
}