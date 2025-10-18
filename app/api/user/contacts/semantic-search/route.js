// app/api/user/contacts/semantic-search/route.js
// API route for semantic search - Thin HTTP layer following clean architecture
// Client Page → Client Service → API (this file) → Server Service → Database

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createApiSession, SessionManager } from '@/lib/server/session';
import { SemanticSearchService } from '@/lib/services/serviceContact/server/semanticSearchService';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';
import { SEMANTIC_SEARCH_CONFIG, CONTACT_FEATURES } from '@/lib/services/serviceContact/client/constants/contactConstants';
import { StepTracker } from '@/lib/services/serviceContact/server/costTracking/stepTracker';

/**
 * POST /api/user/contacts/semantic-search
 *
 * Architecture:
 * 1. Authenticate semanticSearchServiceuser and create session (includes subscription and feature checks)
 * 2. Validate input
 * 3. Check affordability
 * 4. Call server service (business logic)
 * 5. Record usage
 * 6. Return formatted response
 */
export async function POST(request) {
  // Generate session ID for multi-step operation tracking
  const sessionId = `session_search_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  console.log(`🔍 [API /semantic-search] [${searchId}] Starting search request (Session: ${sessionId})`);

  try {
    // Step 1: Authentication and session creation
    const session = await createApiSession(request);
    const sessionManager = new SessionManager(session);
    const userId = session.userId;

    console.log(`👤 [API /semantic-search] [${searchId}] User authenticated: ${userId}`);

    // Step 1.5: Check feature access (Premium and above only)
    const hasAccess = session.permissions[CONTACT_FEATURES.PREMIUM_SEMANTIC_SEARCH];

    if (!hasAccess) {
      console.log(`❌ [API /semantic-search] [${searchId}] Insufficient subscription level`);
      return NextResponse.json({
        error: 'Semantic search requires Premium subscription or higher',
        requiredFeature: 'PREMIUM_SEMANTIC_SEARCH'
      }, { status: 403 });
    }

    console.log(`✅ [API /semantic-search] [${searchId}] Feature access granted for ${session.subscriptionLevel}`);

    // Step 2: Validate input
    const {
      query,
      maxResults = SEMANTIC_SEARCH_CONFIG.DEFAULT_MAX_RESULTS,
      includeMetadata = SEMANTIC_SEARCH_CONFIG.DEFAULT_INCLUDE_METADATA,
      trackCosts = true,
      minVectorScore = null, // Optional: minimum vector similarity threshold
      locale = 'en' // NEW: UI locale for language-based model selection (default to English)
    } = await request.json();

    console.log(`📝 [API /semantic-search] [${searchId}] Request params:`, {
      queryLength: query?.length,
      maxResults,
      trackCosts,
      minVectorScore: minVectorScore !== null ? minVectorScore : 'not set (no threshold filtering)',
      locale // NEW: Log UI locale
    });

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.log(`❌ [API /semantic-search] [${searchId}] Invalid query`);
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Get subscription level for cost calculations
    const subscriptionLevel = session.subscriptionLevel;

    // Step 3: Check affordability (STEP 1 - Cost Affordability Check)
    if (trackCosts) {
      console.log(`💰 [API /semantic-search] [${searchId}] Checking affordability...`);

      const affordCheckStart = Date.now();
      const costEstimate = SemanticSearchService.estimateCost(query);

      console.log(`💰 [API /semantic-search] [${searchId}] Estimated cost: $${costEstimate.totalCost.toFixed(6)}`);

      const affordabilityCheck = await CostTrackingService.canAffordOperation(
        userId,
        costEstimate.totalCost,
        1 // Semantic search counts as 1 successful run if it returns results
      );
      const affordCheckDuration = Date.now() - affordCheckStart;

      console.log(`💰 [API /semantic-search] [${searchId}] Affordability check:`, {
        canAfford: affordabilityCheck.canAfford,
        reason: affordabilityCheck.reason
      });

      // STEP 1: Record Cost Affordability Check
      try {
        await StepTracker.recordStep({
          userId,
          sessionId,
          stepNumber: 1,
          stepLabel: 'Step 1: Cost Affordability Check',
          feature: 'semantic_search_affordability',
          provider: 'internal',
          cost: 0,
          duration: affordCheckDuration,
          isBillableRun: true,
          metadata: {
            estimatedCost: costEstimate.totalCost,
            currentUsage: affordabilityCheck.usage,
            limits: affordabilityCheck.limits,
            canAfford: affordabilityCheck.canAfford,
            reason: affordabilityCheck.reason,
            remainingBudget: affordabilityCheck.limits.maxCost - affordabilityCheck.usage.totalCost,
            budgetPercentage: `${((affordabilityCheck.usage.totalCost / affordabilityCheck.limits.maxCost) * 100).toFixed(1)}%`
          }
        });
        console.log(`✅ [API /semantic-search] [${searchId}] Step 1 recorded: Cost Affordability Check`);
      } catch (stepError) {
        console.error(`❌ [API /semantic-search] [${searchId}] Failed to record Step 1:`, stepError);
      }

      if (!affordabilityCheck.canAfford) {
        console.log(`❌ [API /semantic-search] [${searchId}] User cannot afford operation`);
        return NextResponse.json({
          error: `Search not available: ${affordabilityCheck.reason}`,
          details: {
            estimatedCost: costEstimate.totalCost,
            reason: affordabilityCheck.reason,
            currentUsage: affordabilityCheck.currentUsage
          }
        }, { status: 403 });
      }
    }

    // Step 4: Call server service (business logic)
    console.log(`🔍 [API /semantic-search] [${searchId}] Calling server service...`);
    const searchResult = await SemanticSearchService.search(userId, query, {
      maxResults,
      includeMetadata,
      searchId,
      minVectorScore, // Pass threshold to service
      subscriptionLevel,
      sessionId, // Session ID for tracking
      trackSteps: trackCosts // Enable granular step tracking when cost tracking is enabled
    });

    // Step 5: Record usage in SessionUsage (multi-step operation)
    if (trackCosts) {
      const actualCost = searchResult.searchMetadata.costs.total;

      // Record vector search step in SessionUsage
      try {
        await CostTrackingService.recordUsage({
          userId,
          usageType: 'ApiUsage',
          feature: 'semantic_search_vector',
          cost: actualCost,
          isBillableRun: false, // Only final step counts as billable run
          provider: 'pinecone+gemini',
          sessionId, // Multi-step operation
          stepLabel: 'Step 0: Vector Search', // Human-readable label
          metadata: {
            queryLength: query.length,
            embeddingTime: searchResult.searchMetadata.embeddingTime,
            searchDuration: searchResult.searchMetadata.searchDuration,
            tokens: searchResult.searchMetadata.costs.tokens,
            searchId,
            namespace: searchResult.searchMetadata.namespace,
            resultsFound: searchResult.results.length,
            subscriptionLevel
          }
        });
        console.log(`✅ [API /semantic-search] [${searchId}] Vector search step recorded in SessionUsage: $${actualCost.toFixed(6)}`);
      } catch (recordError) {
        console.error(`❌ [API /semantic-search] [${searchId}] Failed to record vector search step:`, recordError);
        // Don't fail the search if cost recording fails
      }
    }

    // Step 6: Return formatted response with sessionId
    const responseData = {
      results: searchResult.results,
      sessionId, // Include sessionId for client to use in rerank/enhance calls
      searchMetadata: {
        ...searchResult.searchMetadata,
        costs: trackCosts ? searchResult.searchMetadata.costs : undefined,
        billing: trackCosts ? {
          apiOperationCost: searchResult.searchMetadata.costs.total,
          sessionTracking: true,
          resultsFound: searchResult.results.length
        } : undefined,
        subscriptionLevel,
        locale // NEW: Include locale in metadata for transparency
      }
    };

    const logData = {
      resultsFound: searchResult.results.length,
      cost: searchResult.searchMetadata.costs.total.toFixed(6),
      countsAsRun: searchResult.results.length > 0,
      totalTime: `${searchResult.searchMetadata.embeddingTime + searchResult.searchMetadata.searchDuration}ms`
    };

    // Add threshold filtering info to logs if it was used
    if (searchResult.searchMetadata.thresholdFiltering) {
      const stats = searchResult.searchMetadata.thresholdFiltering;
      logData.thresholdUsed = stats.thresholdUsed;
      logData.rawResults = stats.rawCount;
      logData.filteredOut = stats.removedCount;
    }

    console.log(`✅ [API /semantic-search] [${searchId}] Search complete:`, logData);

    return NextResponse.json(responseData);

  } catch (error) {
    console.error(`❌ [API /semantic-search] [${searchId}] Search failed:`, {
      message: error.message,
      stack: error.stack
    });

    // Handle specific error types
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json({
        error: 'Authentication expired. Please sign in again.'
      }, { status: 401 });
    }

    if (error.message?.includes('Pinecone')) {
      return NextResponse.json({
        error: 'Search service temporarily unavailable. Please try again in a moment.'
      }, { status: 503 });
    }

    if (error.message?.includes('subscription')) {
      return NextResponse.json({
        error: error.message
      }, { status: 403 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      searchId
    }, { status: 500 });
  }
}
