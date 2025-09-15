// lib/services/serviceContact/server/costTrackingService.js
// Service for tracking AI usage costs - ENHANCED WITH DETAILED LOGGING

import { adminDb } from '../../../../lib/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { CONTACT_LIMITS, SUBSCRIPTION_LEVELS } from '../../constants';

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
      
      // Get user's account type from AccountData
      console.log(`👤 [CostTracking] [${operationId}] Fetching user account data...`);
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      
      if (!userDoc.exists) {
        console.error(`❌ [CostTracking] [${operationId}] User not found in AccountData: ${userId}`);
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';
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
        featureBreakdown: {},
        modelBreakdown: {},
        lastUpdated: null
      };

      console.log(`📋 [CostTracking] [${operationId}] Monthly usage data:`, {
        totalCost: monthlyUsage.totalCost,
        totalRuns: monthlyUsage.totalRuns,
        featureBreakdownKeys: Object.keys(monthlyUsage.featureBreakdown || {}),
        modelBreakdownKeys: Object.keys(monthlyUsage.modelBreakdown || {}),
        lastUpdated: monthlyUsage.lastUpdated
      });

      // Get subscription limits
      console.log(`📏 [CostTracking] [${operationId}] Getting subscription limits for: ${subscriptionLevel}`);
      const limits = CONTACT_LIMITS[subscriptionLevel] || CONTACT_LIMITS[SUBSCRIPTION_LEVELS.BASE];
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
// Enhanced cost tracking that separates API costs from AI runs
// Update your CostTrackingService.js with these methods

// Replace the existing recordSeparatedUsage method in your CostTrackingService class

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

// Updated AI Enhancement with proper cost/run separation
static async  enhanceContactsWithSeparatedTracking(model, originalQuery, contacts, modelName, userId, trackCosts, enhanceId) {
  console.log(`🤖 [AIEnhance] [${enhanceId}] Starting enhancement with separated tracking`);
  
  let totalCosts = 0;
  let totalApiCalls = 0;
  let successfulRuns = 0;
  let filteredContacts = 0;
  
  const results = [];
  
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const contactId = `${enhanceId}_contact_${i}`;
    
    try {
      console.log(`🔍 [AIEnhance] [${enhanceId}] Processing contact ${i + 1}/${contacts.length}: ${contact.name}`);
      
      // Generate prompt and call Gemini
      const prompt = generateSimilarityAwarePrompt(originalQuery, contact);
      const result = await model.generateContent(prompt);
      
      // Calculate cost for this API call
      const usage = result.response.usageMetadata;
      const inputTokens = usage?.promptTokenCount || 0;
      const outputTokens = usage?.candidatesTokenCount || 0;
      
      const modelPrices = GEMINI_PRICING[modelName];
      const apiCallCost = (inputTokens / 1000000) * modelPrices.inputPricePerMillionTokens +
                         (outputTokens / 1000000) * modelPrices.outputPricePerMillionTokens;
      
      totalCosts += apiCallCost;
      totalApiCalls++;
      
      // Record the API call cost (always billable)
      if (trackCosts) {
        await CostTrackingService.recordSeparatedUsage(
          userId,
          apiCallCost,
          modelName,
          'ai_contact_analysis',
          {
            contactId: contact.id,
            contactName: contact.name,
            inputTokens,
            outputTokens,
            enhanceId,
            contactIndex: i
          },
          'api_call' // This is an API call cost
        );
      }
      
      console.log(`💰 [AIEnhance] [${enhanceId}] API call cost recorded: $${apiCallCost.toFixed(6)} for ${contact.name}`);
      
      // Parse and analyze the response
      const response = await result.response;
      const rawText = response.text();
      
      try {
        const jsonString = cleanJsonString(rawText);
        const analysis = JSON.parse(jsonString);
        
        if (analysis.explanation && analysis.factors && analysis.suggestions && analysis.confidence) {
          const confidenceThreshold = getConfidenceThreshold(contact.similarityTier);
          
          if (analysis.confidence >= confidenceThreshold) {
            // This is a successful run - counts toward AI run limits
            successfulRuns++;
            
            if (trackCosts) {
              await CostTrackingService.recordSeparatedUsage(
                userId,
                0, // No additional cost for successful run tracking
                modelName,
                'ai_enhancement_success',
                {
                  contactId: contact.id,
                  contactName: contact.name,
                  confidence: analysis.confidence,
                  threshold: confidenceThreshold,
                  enhanceId,
                  contactIndex: i
                },
                'successful_run' // This counts toward run limits
              );
            }
            
            results.push({
              contactId: contact.id,
              explanation: analysis.explanation,
              factors: analysis.factors,
              suggestions: analysis.suggestions,
              confidence: analysis.confidence,
              analysisTimestamp: new Date().toISOString(),
              modelUsed: modelName,
              similarityContext: {
                tier: contact.similarityTier,
                vectorScore: contact.vectorScore || contact._vectorScore,
                hybridScore: calculateHybridScore(contact.vectorScore || contact._vectorScore, analysis.confidence)
              },
              billing: {
                apiCallCost,
                countsAsRun: true,
                contactIndex: i
              }
            });
            
            console.log(`✅ [AIEnhance] [${enhanceId}] Successful run recorded for ${contact.name}: confidence ${analysis.confidence}/${confidenceThreshold}`);
            
          } else {
            // Low confidence - API call was paid for but doesn't count as successful run
            filteredContacts++;
            console.log(`🚫 [AIEnhance] [${enhanceId}] Contact filtered (paid but not counted): ${contact.name} - confidence ${analysis.confidence}/${confidenceThreshold}`);
          }
        } else {
          filteredContacts++;
          console.log(`🚫 [AIEnhance] [${enhanceId}] Invalid response structure for ${contact.name} (paid but not counted)`);
        }
        
      } catch (parseError) {
        filteredContacts++;
        console.error(`🚫 [AIEnhance] [${enhanceId}] JSON parse failed for ${contact.name} (paid but not counted):`, parseError);
      }
      
    } catch (error) {
      console.error(`❌ [AIEnhance] [${enhanceId}] Error processing ${contact.name}:`, error);
      // API call might have failed, so we don't increment totalApiCalls or costs
    }
  }
  
  const summary = {
    totalContactsProcessed: contacts.length,
    totalApiCalls,
    successfulRuns,
    filteredContacts,
    totalCosts,
    apiCallEfficiency: totalApiCalls > 0 ? (successfulRuns / totalApiCalls * 100).toFixed(1) + '%' : '0%',
    averageCostPerApiCall: totalApiCalls > 0 ? (totalCosts / totalApiCalls).toFixed(6) : '0',
    averageCostPerSuccessfulRun: successfulRuns > 0 ? (totalCosts / successfulRuns).toFixed(6) : '0'
  };
  
  console.log(`📊 [AIEnhance] [${enhanceId}] Enhancement complete:`, summary);
  
  return {
    insights: results,
    billing: summary,
    costs: trackCosts ? { aiEnhancement: totalCosts } : undefined
  };
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

      // Get user's subscription level
      console.log(`📈 [CostTracking] [${operationId}] Fetching user subscription level...`);
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      const subscriptionLevel = userDoc.exists ? 
        userDoc.data().accountType?.toLowerCase() || 'base' : 'base';
      
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