// app/api/user/contacts/rerank/route.js
// API route for contact reranking
// SIMPLIFIED: Always uses rerank-v3.5 (best model for all languages)
// detectedLanguage is passed for analytics/logging only

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createApiSession, SessionManager } from '@/lib/server/session';
import { RerankService } from '@/lib/services/serviceContact/server/rerankService';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';
import { SEMANTIC_SEARCH_CONFIG, CONTACT_FEATURES } from '@/lib/services/serviceContact/client/constants/contactConstants';

const FORCE_RERANK_MODE = 'ALWAYS_RERANK';

function isSimpleFactualQuery(query) {
  const trimmedQuery = query.trim();
  const words = trimmedQuery.split(/\s+/);
  const wordCount = words.length;

  if (wordCount > 8) return false;

  const semanticKeywords = [
    'help', 'expert', 'interested', 'experienced', 'specialist',
    'knowledge', 'background', 'skills', 'expertise', 'best',
    'recommend', 'suggest', 'advice', 'similar', 'like',
    'understand', 'familiar', 'passionate', 'focus', 'specialize',
    'looking for', 'can assist', 'able to', 'good at',
    'executive', 'executives', 'manager', 'managers', 'director', 'directors',
    'senior', 'junior', 'lead', 'leads', 'leadership', 'officer', 'officers',
    'chief', 'president', 'vice president', 'vp', 'head of', 'founder', 'founders',
    'engineer', 'engineers', 'developer', 'developers', 'architect', 'architects',
    'designer', 'designers', 'analyst', 'analysts', 'consultant', 'consultants',
    'aider', 'aidez', 'aide', 'expert', 'experte', 'spécialiste',
    'intéressé', 'intéressée', 'expérimenté', 'expérience',
    'compétence', 'compétences', 'expertise', 'meilleur', 'meilleure',
    'recommander', 'conseil', 'similaire', 'comme', 'comprendre', 'familier',
    'passionné', 'passionnée', 'spécialiser',
    'dirigeant', 'dirigeants', 'cadre', 'cadres', 'directeur', 'directrice', 'directeurs',
    'responsable', 'responsables', 'chef', 'chefs', 'président', 'présidente', 'vice-président',
    'fondateur', 'fondatrice', 'fondateurs', 'ingénieur', 'ingénieurs', 'développeur', 'développeurs',
    'architecte', 'architectes', 'analyste', 'analystes',
    'aiutare', 'aiuto', 'aiuta', 'esperto', 'esperta', 'specialista',
    'interessato', 'interessata', 'esperienza', 'competenza', 'competenze',
    'conoscenza', 'migliore', 'raccomandare', 'consiglio', 'simile', 'come',
    'capire', 'familiare', 'appassionato', 'appassionata', 'specializzare',
    'dirigente', 'dirigenti', 'direttore', 'direttrice', 'direttori',
    'responsabile', 'responsabili', 'capo', 'capi', 'presidente', 'vicepresidente',
    'fondatore', 'fondatrice', 'fondatori', 'ingegnere', 'ingegneri', 'sviluppatore', 'sviluppatori',
    'architetto', 'architetti', 'analista', 'analisti'
  ];

  const lowerQuery = trimmedQuery.toLowerCase();
  if (semanticKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return false;
  }

  const questionWords = ['who', 'what', 'where', 'when', 'why', 'how', 'which'];
  const commonStarters = ['can', 'do', 'does', 'is', 'are', 'should', 'would', 'could'];
  const excludedWords = [...questionWords, ...commonStarters];

  const hasProperNoun = words.some((word, index) => {
    const cleanWord = word.replace(/[.,!?;:'"()]/g, '');
    const lowerWord = cleanWord.toLowerCase();

    if (excludedWords.includes(lowerWord)) return false;

    if (index === 0) {
      return cleanWord.length >= 3 && /^[A-Z]/.test(cleanWord) && !excludedWords.includes(lowerWord);
    }

    return cleanWord.length >= 2 && /^[A-Z]/.test(cleanWord);
  });

  const firstWord = words[0]?.toLowerCase();
  if (questionWords.includes(firstWord)) {
    if (wordCount <= 2) return true;
    return false;
  }

  if (wordCount <= 2) return true;

  return hasProperNoun;
}

export async function POST(request) {
  const rerankId = `rerank_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  console.log(`🔄 [API /rerank] [${rerankId}] Starting rerank request`);

  try {
    // Step 1: Authentication
    const session = await createApiSession(request);
    const userId = session.userId;
    console.log(`👤 [API /rerank] [${rerankId}] User authenticated: ${userId}`);

    // Check feature access
    const hasAccess = session.permissions[CONTACT_FEATURES.RERANK];
    if (!hasAccess) {
      console.log(`❌ [API /rerank] [${rerankId}] Insufficient subscription level`);
      return NextResponse.json({
        error: 'Reranking requires Premium subscription or higher',
        requiredFeature: 'RERANK'
      }, { status: 403 });
    }

    console.log(`✅ [API /rerank] [${rerankId}] Feature access granted for ${session.subscriptionLevel}`);

    // Step 2: Get input and detected language from semantic search
    const {
      query,
      contacts,
      detectedLanguage, // From QueryEnhancementService via semantic search
      topN = SEMANTIC_SEARCH_CONFIG.DEFAULT_RERANK_TOP_N,
      minConfidence = 0.001,
      trackCosts = true,
      sessionId = null
    } = await request.json();

    // Always use rerank-v3.5 (best model for all languages)
    // Testing showed v3.5 outperforms even rerank-english-v3.0 for English queries
    // v3.5 is Cohere's newest and most accurate model
const model = SEMANTIC_SEARCH_CONFIG.RERANK_MODELS.MULTILINGUAL; // 'rerank-multilingual-v3.0'
    const modelCost = '$0.002';

    console.log(`📝 [API /rerank] [${rerankId}] Request params:`, {
      queryLength: query?.length,
      contactsCount: contacts?.length,
      detectedLanguage: detectedLanguage || 'not detected',
      model,
      modelCost: `${modelCost}/request`,
      topN,
      minConfidence,
      trackCosts,
      sessionId: sessionId || 'none'
    });

    console.log(`✅ [API /rerank] [${rerankId}] Using rerank-v3.5 (best model for all languages)`, {
      detectedLanguage: detectedLanguage || 'not detected',
      modelCost: `${modelCost}/request`,
      note: 'v3.5 outperforms language-specific models'
    });

    // Validation
    if (!query || !contacts || !Array.isArray(contacts)) {
      console.log(`❌ [API /rerank] [${rerankId}] Invalid request parameters`);
      return NextResponse.json({
        error: 'Query and contacts array are required'
      }, { status: 400 });
    }

    if (contacts.length === 0) {
      console.log(`📭 [API /rerank] [${rerankId}] No contacts to rerank`);
      return NextResponse.json({
        results: [],
        metadata: { cost: 0, documentsReranked: 0 }
      });
    }

    const subscriptionLevel = session.subscriptionLevel;

    // Check if query is simple (bypass logic)
    let isSimpleQuery;
    let testingModeActive = false;

    if (FORCE_RERANK_MODE === 'ALWAYS_RERANK') {
      isSimpleQuery = false;
      testingModeActive = true;
      console.log(`🧪 [API /rerank] [${rerankId}] TESTING MODE: ALWAYS_RERANK`);
    } else if (FORCE_RERANK_MODE === 'ALWAYS_BYPASS') {
      isSimpleQuery = true;
      testingModeActive = true;
      console.log(`🧪 [API /rerank] [${rerankId}] TESTING MODE: ALWAYS_BYPASS`);
    } else {
      isSimpleQuery = isSimpleFactualQuery(query);
    }

    console.log(`🔍 [API /rerank] [${rerankId}] Query analysis:`, {
      query: query.substring(0, 100),
      isSimpleQuery,
      testingMode: testingModeActive ? FORCE_RERANK_MODE : 'AUTO',
      decision: isSimpleQuery ? 'BYPASS reranking' : 'PROCEED with reranking'
    });

    // Bypass reranking for simple queries
    if (isSimpleQuery) {
      console.log(`⚡ [API /rerank] [${rerankId}] Bypassing rerank - sorting by vector score`);

      const sortedContacts = [...contacts].sort((a, b) => {
        const scoreA = a._vectorScore || a.searchMetadata?.vectorSimilarity || 0;
        const scoreB = b._vectorScore || b.searchMetadata?.vectorSimilarity || 0;
        return scoreB - scoreA;
      });

      const finalResults = sortedContacts.slice(0, Math.min(topN, sortedContacts.length));

      const bypassResult = {
        results: finalResults.map((contact, index) => ({
          ...contact,
          searchMetadata: {
            ...contact.searchMetadata,
            rerankBypassed: true,
            rerankBypassReason: testingModeActive ? `forced_bypass_${FORCE_RERANK_MODE}` : 'simple_factual_query',
            vectorSortRank: index + 1
          }
        })),
        metadata: {
          cost: 0,
          model: 'none (bypassed)',
          detectedLanguage: detectedLanguage || 'unknown',
          documentsReranked: 0,
          resultsReturned: finalResults.length,
          rerankDuration: 0,
          subscriptionLevel,
          timestamp: new Date().toISOString(),
          rerankId,
          bypassedReranking: true,
          bypassReason: testingModeActive ? `forced_bypass_${FORCE_RERANK_MODE}` : 'simple_factual_query',
          originalContactCount: contacts.length,
          testingMode: testingModeActive ? FORCE_RERANK_MODE : null
        }
      };

      console.log(`✅ [API /rerank] [${rerankId}] Bypass complete:`, {
        originalCount: contacts.length,
        returnedCount: finalResults.length,
        cost: '$0.00'
      });

      return NextResponse.json(bypassResult);
    }

    // Step 3: Check affordability
    if (trackCosts) {
      console.log(`💰 [API /rerank] [${rerankId}] Checking affordability...`);

      const costEstimate = RerankService.estimateCost(contacts.length, model);
      console.log(`💰 [API /rerank] [${rerankId}] Estimated cost: $${costEstimate.estimatedCost.toFixed(6)}`);

      const affordabilityCheck = await CostTrackingService.canAffordOperation(
        userId,
        costEstimate.estimatedCost,
        0
      );

      console.log(`💰 [API /rerank] [${rerankId}] Affordability:`, {
        canAfford: affordabilityCheck.canAfford,
        reason: affordabilityCheck.reason
      });

      if (!affordabilityCheck.canAfford) {
        console.log(`❌ [API /rerank] [${rerankId}] User cannot afford operation`);
        return NextResponse.json({
          error: `Reranking not available: ${affordabilityCheck.reason}`,
          details: {
            estimatedCost: costEstimate.estimatedCost,
            reason: affordabilityCheck.reason
          }
        }, { status: 403 });
      }
    }

    // Step 4: Call rerank service
    console.log(`🔄 [API /rerank] [${rerankId}] Calling RerankService with model: ${model}`);
    const rerankResult = await RerankService.rerankContacts(query, contacts, {
      model,
      topN,
      minRerankScore: minConfidence,
      subscriptionLevel,
      rerankId,
      detectedLanguage, // Pass detected language to service
      isFactualQuery: false
    });

    // Step 5: Record usage
    if (trackCosts) {
      const actualCost = rerankResult.metadata.cost;

      try {
        await CostTrackingService.recordUsage({
          userId,
          usageType: 'ApiUsage',
          feature: sessionId ? 'semantic_search_rerank' : 'rerank_operation',
          cost: actualCost,
          isBillableRun: false,
          provider: model,
          sessionId,
          stepLabel: sessionId ? 'Step 1: Rerank' : null,
          metadata: {
            documentsReranked: contacts.length,
            detectedLanguage: rerankResult.metadata.detectedLanguage,
            subscriptionLevel,
            rerankId,
            topN: Math.min(topN, contacts.length),
            isPartOfSemanticSearch: !!sessionId
          }
        });

        const recordLocation = sessionId ? 'SessionUsage' : 'ApiUsage';
        console.log(`✅ [API /rerank] [${rerankId}] Recorded in ${recordLocation}: $${actualCost.toFixed(6)}`);
      } catch (recordError) {
        console.error(`❌ [API /rerank] [${rerankId}] Failed to record cost:`, recordError);
      }
    }

    // Step 5.5: Finalize session if this is part of semantic search
    if (sessionId && trackCosts) {
      try {
        const { SessionTrackingService } = await import('@/lib/services/serviceContact/server/costTracking/sessionService');
        await SessionTrackingService.finalizeSession({ userId, sessionId });
        console.log(`✅ [API /rerank] [${rerankId}] Session finalized: ${sessionId}`);
      } catch (finalizeError) {
        console.error(`❌ [API /rerank] [${rerankId}] Failed to finalize session:`, finalizeError);
      }
    }

    // Step 6: Return response
    const logData = {
      inputCount: contacts.length,
      outputCount: rerankResult.results.length,
      cost: rerankResult.metadata.cost.toFixed(6),
      detectedLanguage: rerankResult.metadata.detectedLanguage,
      model: rerankResult.metadata.model,
      duration: `${rerankResult.metadata.rerankDuration}ms`
    };

    if (rerankResult.metadata.queryPreprocessing?.wasTransformed) {
      logData.queryPreprocessing = {
        original: rerankResult.metadata.queryPreprocessing.originalQuery,
        preprocessed: rerankResult.metadata.queryPreprocessing.preprocessedQuery,
        strippedVerb: rerankResult.metadata.queryPreprocessing.strippedVerb
      };
    }

    if (rerankResult.metadata.thresholdFiltering) {
      const stats = rerankResult.metadata.thresholdFiltering;
      logData.thresholdUsed = stats.thresholdUsed;
      logData.filteredOut = stats.removedCount;
      logData.fallbackApplied = stats.fallbackApplied;
    }

    console.log(`✅ [API /rerank] [${rerankId}] Reranking complete:`, logData);

    return NextResponse.json(rerankResult);

  } catch (error) {
    console.error(`❌ [API /rerank] [${rerankId}] Reranking failed:`, {
      message: error.message,
      stack: error.stack
    });

    if (error.status === 401) {
      return NextResponse.json({
        error: 'Reranking service authentication failed'
      }, { status: 503 });
    }

    if (error.status === 429) {
      return NextResponse.json({
        error: 'Reranking service rate limit exceeded'
      }, { status: 503 });
    }

    const errorMessage = error.body?.message || error.message || 'Reranking failed';
    return NextResponse.json({
      error: errorMessage,
      rerankId
    }, { status: 500 });
  }
}