// app/api/user/contacts/ai-usage/route.js
// API endpoint with comprehensive logging for debugging cost tracking

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';
import { GeminiGroupingEnhancer } from '@/lib/services/serviceContact/server/geminiGroupingEnhancer';

export async function GET(request) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  console.log(`🔍 [AI-Usage GET] [${requestId}] Starting request`);
  
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log(`❌ [AI-Usage GET] [${requestId}] Unauthorized - no bearer token`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log(`👤 [AI-Usage GET] [${requestId}] User authenticated: ${userId}`);

    // Get current monthly usage
    console.log(`📊 [AI-Usage GET] [${requestId}] Fetching monthly usage...`);
    const monthlyUsage = await CostTrackingService.getUserMonthlyUsage(userId);
    console.log(`📊 [AI-Usage GET] [${requestId}] Monthly usage result:`, {
      month: monthlyUsage.month,
      subscriptionLevel: monthlyUsage.subscriptionLevel,
      totalCost: monthlyUsage.usage.totalCost,
      totalRuns: monthlyUsage.usage.totalRuns,
      remainingBudget: monthlyUsage.remainingBudget,
      remainingRuns: monthlyUsage.remainingRuns,
      percentageUsed: monthlyUsage.percentageUsed
    });
    
    // Get usage warnings
    console.log(`⚠️ [AI-Usage GET] [${requestId}] Checking usage warnings...`);
    const warnings = await CostTrackingService.checkUsageWarnings(userId);
    console.log(`⚠️ [AI-Usage GET] [${requestId}] Warnings result:`, {
      warningCount: warnings.warnings.length,
      percentageUsed: warnings.percentageUsed,
      warnings: warnings.warnings.map(w => ({ type: w.type, severity: w.severity }))
    });
    
    // Get detailed usage history (last 3 months)
    console.log(`📈 [AI-Usage GET] [${requestId}] Fetching detailed usage history...`);
    const detailedUsage = await CostTrackingService.getDetailedUsage(userId, 3);
    console.log(`📈 [AI-Usage GET] [${requestId}] History result:`, {
      monthsRetrieved: detailedUsage.monthlyBreakdown.length,
      totalLifetimeCost: detailedUsage.totalLifetimeCost,
      totalLifetimeRuns: detailedUsage.totalLifetimeRuns
    });

    const response = {
      currentMonth: {
        month: monthlyUsage.month,
        usage: monthlyUsage.usage,
        limits: monthlyUsage.limits,
        remaining: {
          budget: monthlyUsage.remainingBudget,
          runs: monthlyUsage.remainingRuns
        },
        percentageUsed: monthlyUsage.percentageUsed
      },
      warnings: warnings.warnings,
      subscriptionLevel: monthlyUsage.subscriptionLevel,
      history: detailedUsage.monthlyBreakdown,
      lifetime: {
        totalCost: detailedUsage.totalLifetimeCost,
        totalRuns: detailedUsage.totalLifetimeRuns
      }
    };

    console.log(`✅ [AI-Usage GET] [${requestId}] Response prepared successfully`);
    return NextResponse.json(response);

  } catch (error) {
    console.error(`❌ [AI-Usage GET] [${requestId}] Error:`, {
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json({
      error: 'Failed to retrieve AI usage information',
      details: error.message,
      requestId
    }, { status: 500 });
  }
}

export async function POST(request) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  console.log(`🔍 [AI-Usage POST] [${requestId}] Starting request`);
  
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log(`❌ [AI-Usage POST] [${requestId}] Unauthorized - no bearer token`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log(`👤 [AI-Usage POST] [${requestId}] User authenticated: ${userId}`);

    const body = await request.json();
    const { action, options } = body;

    console.log(`📝 [AI-Usage POST] [${requestId}] Request body:`, {
      action,
      options: JSON.stringify(options)
    });

    if (action === 'estimate') {
      // Get user's subscription info
      console.log(`📊 [AI-Usage POST] [${requestId}] Getting user subscription info...`);
      const monthlyUsage = await CostTrackingService.getUserMonthlyUsage(userId);
      console.log(`📊 [AI-Usage POST] [${requestId}] User subscription data:`, {
        subscriptionLevel: monthlyUsage.subscriptionLevel,
        currentCost: monthlyUsage.usage.totalCost,
        currentRuns: monthlyUsage.usage.totalRuns,
        maxCost: monthlyUsage.limits.maxCost,
        maxRuns: monthlyUsage.limits.maxRuns
      });
      
      // Calculate cost estimate
      console.log(`💰 [AI-Usage POST] [${requestId}] Calculating cost estimate...`);
      console.log(`💰 [AI-Usage POST] [${requestId}] Estimate parameters:`, {
        subscriptionLevel: monthlyUsage.subscriptionLevel,
        options
      });
      
      const costEstimate = GeminiGroupingEnhancer.estimateOperationCost(
        monthlyUsage.subscriptionLevel, 
        options || {}
      );
      
      console.log(`💰 [AI-Usage POST] [${requestId}] Cost estimate result:`, {
        estimatedCost: costEstimate.estimatedCost,
        featuresCount: costEstimate.featuresCount,
        useDeepAnalysis: costEstimate.useDeepAnalysis,
        model: costEstimate.model
      });

      // Check affordability
      console.log(`💸 [AI-Usage POST] [${requestId}] Checking affordability...`);
      const affordabilityCheck = await CostTrackingService.canAffordOperation(
        userId, 
        costEstimate.estimatedCost,
        1
      );
      
      console.log(`💸 [AI-Usage POST] [${requestId}] Affordability check result:`, {
        canAfford: affordabilityCheck.canAfford,
        reason: affordabilityCheck.reason,
        remainingBudget: affordabilityCheck.remainingBudget,
        remainingRuns: affordabilityCheck.remainingRuns,
        estimatedCost: affordabilityCheck.estimatedCost
      });

      // Build features enabled list
      console.log(`🔧 [AI-Usage POST] [${requestId}] Building features list...`);
      const featuresEnabled = [];
      if (options?.useSmartCompanyMatching) featuresEnabled.push('Smart Company Matching');
      if (options?.useIndustryDetection) featuresEnabled.push('Industry Detection');
      if (options?.useRelationshipDetection) featuresEnabled.push('Relationship Detection');
      
      console.log(`🔧 [AI-Usage POST] [${requestId}] Features enabled:`, featuresEnabled);

      const response = {
        estimate: {
          estimatedCost: costEstimate.estimatedCost,
          featuresCount: costEstimate.featuresCount,
          useDeepAnalysis: costEstimate.useDeepAnalysis,
          model: costEstimate.model,
          featuresEnabled
        },
        canAfford: affordabilityCheck.canAfford,
        reason: affordabilityCheck.reason,
        currentUsage: monthlyUsage.usage,
        limits: monthlyUsage.limits,
        remaining: {
          budget: affordabilityCheck.remainingBudget,
          runs: affordabilityCheck.remainingRuns
        }
      };

      console.log(`✅ [AI-Usage POST] [${requestId}] Final response:`, {
        estimatedCost: response.estimate.estimatedCost,
        canAfford: response.canAfford,
        reason: response.reason,
        featuresCount: response.estimate.featuresCount
      });

      return NextResponse.json(response);
    }

    console.log(`❌ [AI-Usage POST] [${requestId}] Invalid action: ${action}`);
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error(`❌ [AI-Usage POST] [${requestId}] Error:`, {
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json({
      error: 'Failed to process request',
      details: error.message,
      requestId
    }, { status: 500 });
  }
}