// app/api/user/budget/status/route.js
// API endpoint to fetch real-time budget status for the current user

import { createApiSession, SessionManager } from '@/lib/server/session';
import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/user/budget/status
 * Returns the current user's budget status including:
 * - Current cost and run usage
 * - Maximum limits based on subscription
 * - Remaining budget and runs
 * - Usage percentages
 */
export async function GET(req) {
  try {
    // Create session with user authentication
    const session = await createApiSession(req);
    const sessionManager = new SessionManager(session);

    // Get budget information using the new SessionManager method
    const budget = await sessionManager.getRemainingBudget();

    // Return formatted response
    return NextResponse.json({
      success: true,
      subscriptionLevel: budget.subscriptionLevel,
      unlimited: budget.unlimited,

      // Current usage
      currentUsage: {
        cost: budget.currentCost,
        runsAI: budget.currentRunsAI,
        runsAPI: budget.currentRunsAPI
      },

      // Maximum limits
      limits: {
        maxCost: budget.maxCost,
        maxRunsAI: budget.maxRunsAI,
        maxRunsAPI: budget.maxRunsAPI
      },

      // Remaining budget
      remaining: {
        cost: budget.remainingCost,
        runsAI: budget.remainingRunsAI,
        runsAPI: budget.remainingRunsAPI
      },

      // Usage percentages
      percentageUsed: {
        cost: Math.round(budget.percentageUsedCost),
        runsAI: Math.round(budget.percentageUsedRunsAI),
        runsAPI: Math.round(budget.percentageUsedRunsAPI)
      },

      // Current month
      month: budget.month,

      // Warning flags
      warnings: {
        costWarning: budget.percentageUsedCost >= 80,
        runsAIWarning: budget.percentageUsedRunsAI >= 80,
        runsAPIWarning: budget.percentageUsedRunsAPI >= 80,
        costCritical: budget.percentageUsedCost >= 95,
        runsAICritical: budget.percentageUsedRunsAI >= 95,
        runsAPICritical: budget.percentageUsedRunsAPI >= 95
      }
    });

  } catch (error) {
    console.error('❌ [BudgetStatus] Error fetching budget status:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch budget status',
        success: false
      },
      { status: error.message.includes('Authorization') ? 401 : 500 }
    );
  }
}
