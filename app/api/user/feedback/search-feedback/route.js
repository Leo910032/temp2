// app/api/user/feedback/search-feedback/route.js
// API route for submitting semantic search feedback
// Following clean architecture pattern: Client → API (this file) → Server Service

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { SearchFeedbackService } from '@/lib/services/serviceContact/server/searchFeedbackService';

/**
 * POST /api/user/feedback/search-feedback
 *
 * Submit user feedback for a semantic search session.
 * Feedback is stored in the SessionUsage collection for analytics.
 *
 * Request body:
 * - sessionId: string (required) - The search session ID
 * - isPositive: boolean (required) - true = good search, false = not good search
 *
 * Architecture:
 * 1. Authenticate user
 * 2. Validate input
 * 3. Call server service to update SessionUsage
 * 4. Return success response
 *
 * Note: This is a free operation - no cost tracking needed
 */
export async function POST(request) {
  const requestId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  console.log(`💬 [API /search-feedback] [${requestId}] Starting feedback submission`);

  try {
    // Step 1: Authentication
    const session = await createApiSession(request);
    const userId = session.userId;

    console.log(`👤 [API /search-feedback] [${requestId}] User authenticated: ${userId}`);

    // Step 2: Validate input
    const { sessionId, isPositive } = await request.json();

    console.log(`📝 [API /search-feedback] [${requestId}] Request params:`, {
      sessionId: sessionId?.slice(0, 20) + '...',
      isPositive,
      feedbackType: isPositive ? 'positive (good)' : 'negative (not good)'
    });

    // Validate sessionId
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      console.log(`❌ [API /search-feedback] [${requestId}] Invalid sessionId`);
      return NextResponse.json({
        error: 'Session ID is required and must be a non-empty string'
      }, { status: 400 });
    }

    // Validate isPositive (must be boolean)
    if (typeof isPositive !== 'boolean') {
      console.log(`❌ [API /search-feedback] [${requestId}] Invalid feedback value`);
      return NextResponse.json({
        error: 'Feedback value (isPositive) must be a boolean'
      }, { status: 400 });
    }

    // Step 3: Call server service to record feedback
    console.log(`💾 [API /search-feedback] [${requestId}] Recording feedback in SessionUsage...`);

    const result = await SearchFeedbackService.recordSearchFeedback(
      userId,
      sessionId,
      {
        isPositive,
        submittedAt: new Date().toISOString()
      }
    );

    if (!result.success) {
      // Handle specific error cases
      if (result.error === 'SESSION_NOT_FOUND') {
        console.log(`❌ [API /search-feedback] [${requestId}] Session not found`);
        return NextResponse.json({
          error: 'Search session not found. It may have expired.'
        }, { status: 404 });
      }

      if (result.error === 'ALREADY_SUBMITTED') {
        console.log(`⚠️ [API /search-feedback] [${requestId}] Feedback already submitted`);
        return NextResponse.json({
          success: true,
          alreadySubmitted: true,
          message: 'Feedback already submitted for this search'
        });
      }

      throw new Error(result.error || 'Failed to record feedback');
    }

    console.log(`✅ [API /search-feedback] [${requestId}] Feedback recorded successfully`);

    // Step 4: Return success response
    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      sessionId: sessionId
    });

  } catch (error) {
    console.error(`❌ [API /search-feedback] [${requestId}] Error:`, {
      message: error.message,
      stack: error.stack
    });

    // Handle authentication errors
    if (error.code === 'auth/id-token-expired' || error.message?.includes('Authorization')) {
      return NextResponse.json({
        error: 'Authentication expired. Please sign in again.'
      }, { status: 401 });
    }

    // Generic error response
    return NextResponse.json({
      error: 'Failed to submit feedback. Please try again.',
      requestId
    }, { status: 500 });
  }
}
