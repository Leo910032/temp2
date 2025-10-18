// app/api/user/contacts/ai-enhance-results/route.js
// API route for AI-powered contact enhancement - Thin HTTP layer following clean architecture
// Client Page → Client Service → API (this file) → Server Service → Database

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createApiSession, SessionManager } from '@/lib/server/session';
import { AIEnhanceService } from '@/lib/services/serviceContact/server/aiEnhanceService';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';
import { SessionTrackingService } from '@/lib/services/serviceContact/server/costTracking/sessionService';
import { CONTACT_FEATURES } from '@/lib/services/serviceContact/client/constants/contactConstants';
import { StepTracker } from '@/lib/services/serviceContact/server/costTracking/stepTracker';

/**
 * POST /api/user/contacts/ai-enhance-results
 *
 * Architecture:
 * 1. Authenticate user and create session (includes subscription and feature checks)
 * 2. Validate input
 * 3. Check affordability
 * 4. Call server service (business logic)
 * 5. Record usage (done by server service for streaming)
 * 6. Return formatted response (batch) or stream (streaming)
 */
export async function POST(request) {
  const enhanceId = `enhance_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  console.log(`🤖 [API /ai-enhance] [${enhanceId}] Starting AI enhancement request`);

  try {
    // Step 1: Authentication and session creation
    const session = await createApiSession(request);
    const sessionManager = new SessionManager(session);
    const userId = session.userId;

    console.log(`👤 [API /ai-enhance] [${enhanceId}] User authenticated: ${userId}`);

    // Step 1.5: Check feature access (Pro and above only)
    const hasAccess = session.permissions[CONTACT_FEATURES.AI_ENHANCE_RESULTS];

    if (!hasAccess) {
      console.log(`❌ [API /ai-enhance] [${enhanceId}] Insufficient subscription level`);
      return NextResponse.json({
        error: 'AI result enhancement requires Pro subscription or higher',
        requiredFeature: 'AI_ENHANCE_RESULTS'
      }, { status: 403 });
    }

    console.log(`✅ [API /ai-enhance] [${enhanceId}] Feature access granted for ${session.subscriptionLevel}`);

    // Step 2: Validate input
    const {
      originalQuery,
      contacts,
      trackCosts = true,
      mode = 'batch',
      processingStrategy = 'standard',
      vectorOptimized = false,
      queryLanguage = 'en',
      sessionId = null // Accept sessionId from client for multi-step tracking
    } = await request.json();

    console.log(`📝 [API /ai-enhance] [${enhanceId}] Request params:`, {
      queryLength: originalQuery?.length,
      contactsCount: contacts?.length,
      trackCosts,
      mode,
      processingStrategy,
      vectorOptimized,
      queryLanguage,
      sessionId: sessionId || 'none (standalone)'
    });

    if (!originalQuery || !contacts || !Array.isArray(contacts)) {
      console.log(`❌ [API /ai-enhance] [${enhanceId}] Invalid request parameters`);
      return NextResponse.json({
        error: 'Original query and contacts array are required'
      }, { status: 400 });
    }

    if (contacts.length === 0) {
      return NextResponse.json({ insights: [] });
    }

    // Get subscription level for cost calculations
    const subscriptionLevel = session.subscriptionLevel;

    // Step 3: Check affordability
    if (trackCosts) {
      console.log(`💰 [API /ai-enhance] [${enhanceId}] Checking affordability...`);

      const costEstimate = AIEnhanceService.estimateCost(contacts.length, subscriptionLevel);

      console.log(`💰 [API /ai-enhance] [${enhanceId}] Estimated cost: $${costEstimate.estimatedCost.toFixed(6)}`);

      const affordabilityCheck = await CostTrackingService.canAffordOperation(
        userId,
        costEstimate.estimatedCost,
        1
      );

      console.log(`💰 [API /ai-enhance] [${enhanceId}] Affordability check:`, {
        canAfford: affordabilityCheck.canAfford,
        reason: affordabilityCheck.reason
      });

      if (!affordabilityCheck.canAfford) {
        console.log(`❌ [API /ai-enhance] [${enhanceId}] User cannot afford operation`);
        return NextResponse.json({
          error: `AI enhancement not available: ${affordabilityCheck.reason}`,
          details: {
            estimatedCost: costEstimate.estimatedCost,
            reason: affordabilityCheck.reason
          }
        }, { status: 403 });
      }
    }

    // Step 4 & 5 & 6: Handle streaming or batch mode
    if (mode === 'streaming') {
      console.log(`🔄 [API /ai-enhance] [${enhanceId}] Starting streaming mode`);

      // Create streaming response with cost tracking built-in
      const stream = AIEnhanceService.createStreamingResponse(originalQuery, contacts, {
        subscriptionLevel,
        queryLanguage,
        vectorOptimized,
        enhanceId
      });

      // Wrap the stream with cost tracking for streaming mode
      const trackedStream = trackCosts
        ? await wrapStreamWithCostTracking(stream, userId, enhanceId, sessionId, subscriptionLevel)
        : stream;

      return new Response(trackedStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // Batch mode
    console.log(`📦 [API /ai-enhance] [${enhanceId}] Starting batch mode`);

    const enhanceResult = await AIEnhanceService.enhanceResults(originalQuery, contacts, {
      subscriptionLevel,
      queryLanguage,
      enhanceId
    });

    // Record costs for batch mode
    if (trackCosts) {
      await recordBatchCosts(userId, enhanceResult, enhanceId, subscriptionLevel, sessionId);
    }

    // Finalize session if this is part of semantic search
    if (sessionId && trackCosts) {
      try {
        // STEP 12: Record Session Finalization (batch mode)
        const finalizeStart = Date.now();
        const sessionStats = await SessionTrackingService.getSessionStatistics(userId, sessionId);
        const finalizeDuration = Date.now() - finalizeStart;

        if (sessionStats) {
          try {
            await StepTracker.recordStep({
              userId,
              sessionId,
              stepNumber: 12,
              stepLabel: 'Step 12: Session Finalization',
              feature: 'semantic_search_finalization',
              provider: 'internal',
              cost: 0,
              duration: finalizeDuration,
              metadata: {
                sessionId,
                finalStatus: 'completed',
                totalSteps: sessionStats.totalSteps + 1, // +1 for this step
                totalDuration: sessionStats.totalDuration,
                pipelinePhases: {
                  vectorSearch: sessionStats.stepsByPhase.vectorSearch,
                  reranking: sessionStats.stepsByPhase.reranking
                }
              }
            });
            console.log(`✅ [API /ai-enhance] [${enhanceId}] Step 12 recorded`);
          } catch (stepError) {
            console.error(`❌ [API /ai-enhance] [${enhanceId}] Failed to record Step 12:`, stepError);
          }
        }

        await SessionTrackingService.finalizeSession({ userId, sessionId });
        console.log(`✅ [API /ai-enhance] [${enhanceId}] Session finalized: ${sessionId}`);
      } catch (finalizeError) {
        console.error(`❌ [API /ai-enhance] [${enhanceId}] Failed to finalize session:`, finalizeError);
      }
    }

    console.log(`✅ [API /ai-enhance] [${enhanceId}] Batch complete:`, {
      insights: enhanceResult.insights.length,
      cost: enhanceResult.billing.totalCosts.toFixed(6)
    });

    return NextResponse.json(enhanceResult);

  } catch (error) {
    console.error(`❌ [API /ai-enhance] [${enhanceId}] API error:`, {
      message: error.message,
      stack: error.stack
    });

    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json({
        error: 'Authentication expired. Please sign in again.'
      }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      enhanceId
    }, { status: 500 });
  }
}

/**
 * Wrap streaming response with cost tracking
 * @private
 */
async function wrapStreamWithCostTracking(originalStream, userId, enhanceId, sessionId, subscriptionLevel) {
  let totalCosts = 0;
  let totalApiCalls = 0;
  let successfulRuns = 0;
  let sessionFinalized = false;

  return new ReadableStream({
    async start(controller) {
      const reader = originalStream.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            controller.close();
            break;
          }

          // Pass through the data
          controller.enqueue(value);

          // Parse the data to track costs
          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              // Track API calls and costs
              if (data.type === 'result' && data.insight?.billing) {
                totalCosts += data.insight.billing.apiCallCost || 0;
                totalApiCalls++;
                const isBillableRun = data.insight.billing.countsAsRun;
                if (isBillableRun) {
                  successfulRuns++;
                }

                // Record in SessionUsage (if part of semantic search) or AIUsage (standalone)
                await CostTrackingService.recordUsage({
                  userId,
                  usageType: 'AIUsage',
                  feature: sessionId ? 'semantic_search_ai_enhance' : 'ai_contact_analysis_strategic',
                  cost: data.insight.billing.apiCallCost,
                  isBillableRun, // Only counts as billable if confidence is high enough
                  provider: data.insight.modelUsed,
                  sessionId, // If provided, records in SessionUsage
                  stepLabel: sessionId ? 'Step 2: AI Enhancement' : null, // Only label if part of semantic search
                  metadata: {
                    contactId: data.contactId,
                    enhanceId,
                    contactIndex: data.contactIndex,
                    confidence: data.confidence,
                    subscriptionLevel,
                    isPartOfSemanticSearch: !!sessionId
                  }
                });
              }

              // Finalize session when streaming is complete
              if (data.type === 'complete' && sessionId && !sessionFinalized) {
                sessionFinalized = true;
                try {
                  // STEP 12: Record Session Finalization (streaming mode)
                  const finalizeStart = Date.now();
                  const sessionStats = await SessionTrackingService.getSessionStatistics(userId, sessionId);
                  const finalizeDuration = Date.now() - finalizeStart;

                  if (sessionStats) {
                    try {
                      await StepTracker.recordStep({
                        userId,
                        sessionId,
                        stepNumber: 12,
                        stepLabel: 'Step 12: Session Finalization',
                        feature: 'semantic_search_finalization',
                        provider: 'internal',
                        cost: 0,
                        duration: finalizeDuration,
                        metadata: {
                          sessionId,
                          finalStatus: 'completed',
                          totalSteps: sessionStats.totalSteps + 1,
                          totalDuration: sessionStats.totalDuration,
                          pipelinePhases: {
                            vectorSearch: sessionStats.stepsByPhase.vectorSearch,
                            reranking: sessionStats.stepsByPhase.reranking
                          },
                          mode: 'streaming'
                        }
                      });
                      console.log(`✅ [API /ai-enhance] [${enhanceId}] Step 12 recorded (streaming)`);
                    } catch (stepError) {
                      console.error(`❌ [API /ai-enhance] [${enhanceId}] Failed to record Step 12 (streaming):`, stepError);
                    }
                  }

                  await SessionTrackingService.finalizeSession({ userId, sessionId });
                  console.log(`✅ [API /ai-enhance] [${enhanceId}] Session finalized (streaming): ${sessionId}`);
                } catch (finalizeError) {
                  console.error(`❌ [API /ai-enhance] [${enhanceId}] Failed to finalize session:`, finalizeError);
                }
              }
            } catch (parseError) {
              // Not all lines are JSON, skip
            }
          }
        }
      } catch (streamError) {
        console.error(`❌ [API /ai-enhance] [${enhanceId}] Stream tracking error:`, streamError);
        controller.error(streamError);
      }
    }
  });
}

/**
 * Record costs for batch mode
 * @private
 */
async function recordBatchCosts(userId, enhanceResult, enhanceId, subscriptionLevel, sessionId) {
  try {
    // Record each AI enhancement step
    for (const insight of enhanceResult.insights) {
      if (insight.billing?.apiCallCost) {
        const isBillableRun = insight.billing.countsAsRun;

        // Record in SessionUsage (if part of semantic search) or AIUsage (standalone)
        await CostTrackingService.recordUsage({
          userId,
          usageType: 'AIUsage',
          feature: sessionId ? 'semantic_search_ai_enhance' : 'ai_contact_analysis_strategic',
          cost: insight.billing.apiCallCost,
          isBillableRun, // Only counts as billable if confidence is high enough
          provider: insight.modelUsed,
          sessionId, // If provided, records in SessionUsage
          stepLabel: sessionId ? 'Step 2: AI Enhancement' : null, // Only label if part of semantic search
          metadata: {
            contactId: insight.contactId,
            enhanceId,
            contactIndex: insight.billing.contactIndex,
            confidence: insight.confidence,
            subscriptionLevel,
            isPartOfSemanticSearch: !!sessionId
          }
        });
      }
    }

    const recordLocation = sessionId ? 'SessionUsage' : 'AIUsage';
    console.log(`✅ [API /ai-enhance] [${enhanceId}] Batch costs recorded in ${recordLocation}:`, {
      totalCosts: enhanceResult.billing.totalCosts.toFixed(6),
      apiCalls: enhanceResult.billing.totalApiCalls,
      successfulRuns: enhanceResult.billing.successfulRuns,
      sessionId: sessionId || 'none'
    });
  } catch (recordError) {
    console.error(`❌ [API /ai-enhance] [${enhanceId}] Failed to record batch costs:`, recordError);
    // Don't fail the enhancement if cost recording fails
  }
}
