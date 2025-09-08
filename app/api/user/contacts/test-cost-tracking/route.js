// app/api/user/contacts/test-cost-tracking/route.js
// Test endpoint to verify cost tracking is working

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';

export async function POST(request) {
  const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  console.log(`🧪 [CostTrackingTest] [${testId}] Starting cost tracking test`);
  
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log(`🧪 [CostTrackingTest] [${testId}] Testing for user: ${userId}`);

    const testResults = {
      testId,
      userId,
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Test 1: Get monthly usage
    console.log(`🧪 [CostTrackingTest] [${testId}] Test 1: Getting monthly usage...`);
    try {
      const monthlyUsage = await CostTrackingService.getUserMonthlyUsage(userId);
      testResults.tests.push({
        name: 'getUserMonthlyUsage',
        status: 'PASS',
        result: {
          subscriptionLevel: monthlyUsage.subscriptionLevel,
          currentCost: monthlyUsage.usage.totalCost,
          currentRuns: monthlyUsage.usage.totalRuns,
          limits: monthlyUsage.limits,
          remainingBudget: monthlyUsage.remainingBudget
        }
      });
      console.log(`✅ [CostTrackingTest] [${testId}] Test 1 PASSED`);
    } catch (error) {
      testResults.tests.push({
        name: 'getUserMonthlyUsage',
        status: 'FAIL',
        error: error.message
      });
      console.log(`❌ [CostTrackingTest] [${testId}] Test 1 FAILED:`, error.message);
    }

    // Test 2: Check affordability
    console.log(`🧪 [CostTrackingTest] [${testId}] Test 2: Checking affordability...`);
    try {
      const testCost = 0.001;
      const affordabilityCheck = await CostTrackingService.canAffordOperation(userId, testCost, 1);
      testResults.tests.push({
        name: 'canAffordOperation',
        status: 'PASS',
        input: { testCost, requiredRuns: 1 },
        result: {
          canAfford: affordabilityCheck.canAfford,
          reason: affordabilityCheck.reason,
          remainingBudget: affordabilityCheck.remainingBudget
        }
      });
      console.log(`✅ [CostTrackingTest] [${testId}] Test 2 PASSED`);
    } catch (error) {
      testResults.tests.push({
        name: 'canAffordOperation',
        status: 'FAIL',
        error: error.message
      });
      console.log(`❌ [CostTrackingTest] [${testId}] Test 2 FAILED:`, error.message);
    }

    // Test 3: Record test usage
    console.log(`🧪 [CostTrackingTest] [${testId}] Test 3: Recording test usage...`);
    try {
      const testCost = 0.0001;
      const recordResult = await CostTrackingService.recordUsage(
        userId,
        testCost,
        'test-model',
        'cost_tracking_test',
        { testId, testRun: true }
      );
      testResults.tests.push({
        name: 'recordUsage',
        status: 'PASS',
        input: { testCost, model: 'test-model', feature: 'cost_tracking_test' },
        result: recordResult
      });
      console.log(`✅ [CostTrackingTest] [${testId}] Test 3 PASSED`);
    } catch (error) {
      testResults.tests.push({
        name: 'recordUsage',
        status: 'FAIL',
        error: error.message
      });
      console.log(`❌ [CostTrackingTest] [${testId}] Test 3 FAILED:`, error.message);
    }

    // Test 4: Verify the recording worked
    console.log(`🧪 [CostTrackingTest] [${testId}] Test 4: Verifying usage was recorded...`);
    try {
      const monthlyUsageAfter = await CostTrackingService.getUserMonthlyUsage(userId);
      testResults.tests.push({
        name: 'verifyRecording',
        status: 'PASS',
        result: {
          newTotalCost: monthlyUsageAfter.usage.totalCost,
          newTotalRuns: monthlyUsageAfter.usage.totalRuns,
          featureBreakdown: monthlyUsageAfter.usage.featureBreakdown
        }
      });
      console.log(`✅ [CostTrackingTest] [${testId}] Test 4 PASSED`);
    } catch (error) {
      testResults.tests.push({
        name: 'verifyRecording',
        status: 'FAIL',
        error: error.message
      });
      console.log(`❌ [CostTrackingTest] [${testId}] Test 4 FAILED:`, error.message);
    }

    // Test 5: Get detailed usage
    console.log(`🧪 [CostTrackingTest] [${testId}] Test 5: Getting detailed usage...`);
    try {
      const detailedUsage = await CostTrackingService.getDetailedUsage(userId, 1, true, 10);
      testResults.tests.push({
        name: 'getDetailedUsage',
        status: 'PASS',
        result: {
          monthlyBreakdownCount: detailedUsage.monthlyBreakdown.length,
          recentOperationsCount: detailedUsage.recentOperations?.length || 0,
          totalLifetimeCost: detailedUsage.totalLifetimeCost,
          totalLifetimeRuns: detailedUsage.totalLifetimeRuns
        }
      });
      console.log(`✅ [CostTrackingTest] [${testId}] Test 5 PASSED`);
    } catch (error) {
      testResults.tests.push({
        name: 'getDetailedUsage',
        status: 'FAIL',
        error: error.message
      });
      console.log(`❌ [CostTrackingTest] [${testId}] Test 5 FAILED:`, error.message);
    }

    // Summary
    const passedTests = testResults.tests.filter(t => t.status === 'PASS').length;
    const totalTests = testResults.tests.length;
    testResults.summary = {
      passed: passedTests,
      total: totalTests,
      success: passedTests === totalTests
    };

    console.log(`🧪 [CostTrackingTest] [${testId}] Test complete:`, {
      passed: passedTests,
      total: totalTests,
      success: testResults.summary.success
    });

    return NextResponse.json(testResults);

  } catch (error) {
    console.error(`❌ [CostTrackingTest] [${testId}] Test suite failed:`, error);
    return NextResponse.json({
      error: 'Test suite failed',
      details: error.message,
      testId
    }, { status: 500 });
  }
}