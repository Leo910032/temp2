// app/api/user/contacts/cost-analytics/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { CostTrackingService } from '../../../../../lib/services/serviceContact/server/costTrackingService';

export async function GET(request) {
  try {
    // Authenticate user using Firebase Admin
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { searchParams } = new URL(request.url);
    
    const timeframe = searchParams.get('timeframe') || '30d';
    const feature = searchParams.get('feature'); // Optional filter by feature
    const includeOperations = searchParams.get('includeOperations') === 'true';
    const operationsLimit = parseInt(searchParams.get('operationsLimit')) || 100;

    console.log(`📊 [Cost Analytics API] Getting analytics for user ${userId} (${timeframe})`);

    // Get detailed usage breakdown
    const usage = await CostTrackingService.getDetailedUsage(
      userId, 
      3, // 3 months of monthly data
      includeOperations, 
      operationsLimit
    );

    // If filtering by specific feature, process the operations
    let analytics = {
      subscriptionLevel: usage.subscriptionLevel,
      monthlyBreakdown: usage.monthlyBreakdown,
      totalLifetimeCost: usage.totalLifetimeCost,
      totalLifetimeRuns: usage.totalLifetimeRuns
    };

    if (feature && usage.recentOperations) {
      // Filter for specific feature operations
      const featureOperations = usage.recentOperations.filter(op => 
        op.feature === feature
      );

      const featureAnalytics = {
        totalOperations: featureOperations.length,
        totalCost: featureOperations.reduce((sum, op) => sum + (op.cost || 0), 0),
        averageCostPerOperation: 0,
        costBreakdown: {
          embedding: 0,
          vectorSearch: 0,
          aiEnhancement: 0
        },
        operations: featureOperations
      };

      if (featureOperations.length > 0) {
        featureAnalytics.averageCostPerOperation = featureAnalytics.totalCost / featureOperations.length;

        // Analyze cost breakdown from metadata
        featureOperations.forEach(op => {
          const breakdown = op.metadata?.costBreakdown || {};
          featureAnalytics.costBreakdown.embedding += breakdown.embedding || 0;
          featureAnalytics.costBreakdown.vectorSearch += breakdown.vectorSearch || 0;
          featureAnalytics.costBreakdown.aiEnhancement += breakdown.aiEnhancement || 0;
        });
      }

      analytics.featureAnalytics = featureAnalytics;
    } else if (includeOperations) {
      analytics.recentOperations = usage.recentOperations;
    }

    console.log(`✅ [Cost Analytics API] Retrieved analytics for ${userId}: ${analytics.totalLifetimeCost.toFixed(6)} lifetime cost`);

    return NextResponse.json(analytics, { status: 200 });

  } catch (error) {
    console.error('❌ [Cost Analytics API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get cost analytics',
        subscriptionLevel: 'base',
        monthlyBreakdown: [],
        totalLifetimeCost: 0,
        totalLifetimeRuns: 0
      },
      { status: 500 }
    );
  }
}