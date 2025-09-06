//app/api/user/contacts/ai-usage/route.js
// API endpoint for retrieving user's AI usage information

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';
import { GeminiGroupingEnhancer } from '@/lib/services/serviceContact/server/geminiGroupingEnhancer';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get current monthly usage
    const monthlyUsage = await CostTrackingService.getUserMonthlyUsage(userId);
    
    // Get usage warnings
    const warnings = await CostTrackingService.checkUsageWarnings(userId);
    
    // Get detailed usage history (last 3 months)
    const detailedUsage = await CostTrackingService.getDetailedUsage(userId, 3);

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

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error getting AI usage:', error);
    return NextResponse.json({
      error: 'Failed to retrieve AI usage information',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { action, options } = body;

    if (action === 'estimate') {
      // Get user's subscription info
      const monthlyUsage = await CostTrackingService.getUserMonthlyUsage(userId);
      
      // Calculate cost estimate
      const costEstimate = GeminiGroupingEnhancer.estimateOperationCost(
        monthlyUsage.subscriptionLevel, 
        options || {}
      );

      // Check affordability
      const affordabilityCheck = await CostTrackingService.canAffordOperation(
        userId, 
        costEstimate.estimatedCost,
        1
      );

      return NextResponse.json({
        estimate: costEstimate,
        canAfford: affordabilityCheck.canAfford,
        reason: affordabilityCheck.reason,
        currentUsage: monthlyUsage.usage,
        limits: monthlyUsage.limits,
        remaining: {
          budget: affordabilityCheck.remainingBudget,
          runs: affordabilityCheck.remainingRuns
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error processing AI usage request:', error);
    return NextResponse.json({
      error: 'Failed to process request',
      details: error.message
    }, { status: 500 });
  }
}