// app/api/user/contacts/rerank/route.js
// API route for contact reranking - Thin HTTP layer following clean architecture
// Client Page → Client Service → API (this file) → Server Service → Database

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createApiSession, SessionManager } from '@/lib/server/session';
import { RerankService } from '@/lib/services/serviceContact/server/rerankService';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';
import { SEMANTIC_SEARCH_CONFIG, CONTACT_FEATURES } from '@/lib/services/serviceContact/client/constants/contactConstants';

// ==========================================
// TESTING CONFIGURATION
// ==========================================
/**
 * Force rerank mode for testing purposes
 *
 * Options:
 * - 'AUTO' (default): Let the system automatically detect query type
 * - 'ALWAYS_RERANK': Force all queries to use full reranking (never bypass)
 * - 'ALWAYS_BYPASS': Force all queries to bypass reranking (always use vector sort)
 *
 * Usage:
 * 1. Set to 'AUTO' for production (automatic detection)
 * 2. Set to 'ALWAYS_RERANK' to test reranking on all queries
 * 3. Set to 'ALWAYS_BYPASS' to test bypass on all queries
 *
 * Example test scenario:
 * - Query: "Who are the executives in my contacts?"
 * - ALWAYS_RERANK: Will call Cohere, get CEO/CPO ranked higher
 * - ALWAYS_BYPASS: Will skip Cohere, return vector-sorted results
 * - AUTO: System decides based on query analysis
 */
const FORCE_RERANK_MODE = 'ALWAYS_RERANK'; // Change to 'ALWAYS_RERANK' or 'ALWAYS_BYPASS' for testing

// NEW LOGIC STARTS HERE - Solution 2: Query detection function
/**
 * Detect if a query is a simple, factual lookup (multilingual: English, French, Italian)
 *
 * Simple queries are typically:
 * - Short (8 words or fewer) - IMPROVED from 5 words
 * - Contain proper nouns (capitalized words)
 * - Lack semantic complexity keywords
 *
 * Examples of simple queries (will bypass reranking):
 * - EN: "Show me everyone who works at Stripe" (6 words, has proper noun, no role keywords)
 * - EN: "Stripe employees" (2 words, short query)
 * - EN: "Find Sarah from Microsoft" (4 words, has proper noun)
 * - FR: "Montre-moi tous ceux qui travaillent chez Stripe" (7 words)
 * - FR: "Employés de Stripe" (3 words)
 * - IT: "Mostrami tutti quelli che lavorano a Stripe" (7 words)
 * - IT: "Dipendenti di Stripe" (3 words)
 *
 * Examples of complex queries (will use full reranking):
 * - EN: "Who are the executives in my contacts?" (interrogative + has "executives")
 * - EN: "Find senior engineers" (has role keyword "senior")
 * - EN: "Show managers at Google" (has role keyword "managers")
 * - EN: "Who can help me with machine learning projects?" (has "help")
 * - FR: "Qui sont les dirigeants?" (interrogative + has "dirigeants")
 * - FR: "Trouve les cadres supérieurs" (has "cadres")
 * - IT: "Chi sono i dirigenti?" (interrogative + has "dirigenti")
 * - IT: "Trova gli ingegneri senior" (has "ingegneri")
 * - "Contacts with blockchain experience who attended tech conferences" (9 words, too long)
 *
 * Trade-offs:
 * ✅ Fast, no API calls, easy to debug
 * ✅ Now catches more simple queries (threshold increased to 8 words)
 * ✅ Multilingual support (English, French, Italian)
 * ✅ NEW: Detects role/category queries (executive, manager, senior, etc.)
 * ✅ NEW: Handles interrogative queries (Who/What/Where)
 * ✅ NEW: Improved proper noun detection (excludes question words)
 * ⚠️ May misclassify edge cases (e.g., "stripe" in lowercase)
 * 🔧 Threshold can be tuned based on production logs
 *
 * @param {string} query - The search query
 * @returns {boolean} True if query appears to be a simple factual lookup
 */
function isSimpleFactualQuery(query) {
  const trimmedQuery = query.trim();

  // Step 1: Check word count - simple queries are typically short
  const words = trimmedQuery.split(/\s+/);
  const wordCount = words.length;

  // IMPROVED: Increased threshold from 5 to 8 words
  // Queries like "Show me everyone who works at Stripe" (6 words) are still simple
  if (wordCount > 8) {
    return false;
  }

  // Step 2: Check for semantic complexity keywords
  // These indicate the user wants nuanced, context-aware matching
  // IMPROVED: Removed common action verbs from semantic keywords (multilingual support)
  // Action verbs like "show/montre/mostra" are just query prefixes, not semantic complexity
  const semanticKeywords = [
    // English semantic keywords
    'help', 'expert', 'interested', 'experienced', 'specialist',
    'knowledge', 'background', 'skills', 'expertise', 'best',
    'recommend', 'suggest', 'advice', 'similar', 'like',
    'understand', 'familiar', 'passionate', 'focus', 'specialize',
    'looking for', 'can assist', 'able to', 'good at',

    // NEW: Role/category/seniority keywords - these require semantic understanding
    'executive', 'executives', 'manager', 'managers', 'director', 'directors',
    'senior', 'junior', 'lead', 'leads', 'leadership', 'officer', 'officers',
    'chief', 'president', 'vice president', 'vp', 'head of', 'founder', 'founders',
    'engineer', 'engineers', 'developer', 'developers', 'architect', 'architects',
    'designer', 'designers', 'analyst', 'analysts', 'consultant', 'consultants',

    // French semantic keywords (excluding action verbs: montrer, trouver, lister, donner)
    'aider', 'aidez', 'aide',           // help
    'expert', 'experte', 'spécialiste',  // expert, specialist
    'intéressé', 'intéressée',           // interested
    'expérimenté', 'expérience',         // experienced
    'compétence', 'compétences',         // skills
    'expertise',                         // expertise
    'meilleur', 'meilleure',             // best
    'recommander', 'conseil',            // recommend, advice
    'similaire', 'comme',                // similar, like
    'comprendre', 'familier',            // understand, familiar
    'passionné', 'passionnée',           // passionate
    'spécialiser',                       // specialize

    // NEW: French role/category keywords
    'dirigeant', 'dirigeants', 'cadre', 'cadres',      // executive, manager
    'directeur', 'directrice', 'directeurs',           // director
    'responsable', 'responsables', 'chef', 'chefs',    // manager, lead, chief
    'président', 'présidente', 'vice-président',       // president, VP
    'fondateur', 'fondatrice', 'fondateurs',           // founder
    'ingénieur', 'ingénieurs', 'développeur', 'développeurs',  // engineer, developer
    'architecte', 'architectes', 'analyste', 'analystes',      // architect, analyst

    // Italian semantic keywords (excluding action verbs: mostrare, trovare, elencare, dare)
    'aiutare', 'aiuto', 'aiuta',         // help
    'esperto', 'esperta', 'specialista', // expert, specialist
    'interessato', 'interessata',        // interested
    'esperto', 'esperienza',             // experienced
    'competenza', 'competenze',          // skills
    'conoscenza',                        // knowledge
    'migliore',                          // best
    'raccomandare', 'consiglio',         // recommend, advice
    'simile', 'come',                    // similar, like
    'capire', 'familiare',               // understand, familiar
    'appassionato', 'appassionata',      // passionate
    'specializzare',                     // specialize

    // NEW: Italian role/category keywords
    'dirigente', 'dirigenti', 'direttore', 'direttrice', 'direttori',  // executive, director
    'responsabile', 'responsabili', 'capo', 'capi',                    // manager, lead, chief
    'presidente', 'vicepresidente',                                     // president, VP
    'fondatore', 'fondatrice', 'fondatori',                            // founder
    'ingegnere', 'ingegneri', 'sviluppatore', 'sviluppatori',         // engineer, developer
    'architetto', 'architetti', 'analista', 'analisti'                 // architect, analyst
  ];

  const lowerQuery = trimmedQuery.toLowerCase();
  const hasSemanticKeywords = semanticKeywords.some(keyword =>
    lowerQuery.includes(keyword)
  );

  if (hasSemanticKeywords) {
    // Query has semantic complexity - use full reranking
    return false;
  }

  // Step 3: Check for proper nouns (capitalized words)
  // Simple factual queries usually reference specific names/companies
  // IMPROVED: Exclude question words and common sentence starters
  const questionWords = ['who', 'what', 'where', 'when', 'why', 'how', 'which'];
  const commonStarters = ['can', 'do', 'does', 'is', 'are', 'should', 'would', 'could'];
  const excludedWords = [...questionWords, ...commonStarters];

  const hasProperNoun = words.some((word, index) => {
    // Remove common punctuation
    const cleanWord = word.replace(/[.,!?;:'"()]/g, '');
    const lowerWord = cleanWord.toLowerCase();

    // Exclude question words and common starters (especially at start of sentence)
    if (excludedWords.includes(lowerWord)) {
      return false;
    }

    // Check if word starts with capital letter and has at least 2 characters
    // For first word, be more strict (must be longer to avoid false positives)
    if (index === 0) {
      return cleanWord.length >= 3 && /^[A-Z]/.test(cleanWord) && !excludedWords.includes(lowerWord);
    }

    return cleanWord.length >= 2 && /^[A-Z]/.test(cleanWord);
  });

  // Step 4: Check if query is interrogative (starts with question word)
  // NEW: Questions like "Who are the executives" are likely semantic queries
  const firstWord = words[0]?.toLowerCase();
  if (questionWords.includes(firstWord)) {
    // Question format queries are usually semantic (require understanding of categories/roles)
    // Exception: Very simple questions like "Who?" or "What?" (1-2 words)
    if (wordCount <= 2) {
      return true; // "Who?" or "What company?" are simple
    }
    return false; // "Who are the executives?" needs semantic understanding
  }

  // Step 5: Check for very short queries (1-2 words)
  // These are almost always simple lookups
  if (wordCount <= 2) {
    return true;
  }

  // Step 6: Final decision
  // If query is short (3-8 words) and has a proper noun, it's likely factual
  // Examples: "Stripe employees", "Sarah from Microsoft", "Show me everyone who works at Stripe"
  return hasProperNoun;
}
// NEW LOGIC ENDS HERE

/**
 * POST /api/user/contacts/rerank
 *
 * Architecture:
 * 1. Authenticate user and create session (includes subscription and feature checks)
 * 2. Validate input
 * 3. Check affordability
 * 4. Call server service (business logic)
 * 5. Record usage
 * 6. Return formatted response
 */
export async function POST(request) {
  const rerankId = `rerank_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  console.log(`🔄 [API /rerank] [${rerankId}] Starting rerank request`);

  try {
    // Step 1: Authentication and session creation
    const session = await createApiSession(request);
    const sessionManager = new SessionManager(session);
    const userId = session.userId;

    console.log(`👤 [API /rerank] [${rerankId}] User authenticated: ${userId}`);

    // Step 1.5: Check feature access (Premium and above only)
    const hasAccess = session.permissions[CONTACT_FEATURES.RERANK];

    if (!hasAccess) {
      console.log(`❌ [API /rerank] [${rerankId}] Insufficient subscription level`);
      return NextResponse.json({
        error: 'Reranking requires Premium subscription or higher',
        requiredFeature: 'RERANK'
      }, { status: 403 });
    }

    console.log(`✅ [API /rerank] [${rerankId}] Feature access granted for ${session.subscriptionLevel}`);

    // Step 2: Validate input
    const {
      query,
      contacts,
      model = SEMANTIC_SEARCH_CONFIG.RERANK_MODELS.MULTILINGUAL,
      topN = SEMANTIC_SEARCH_CONFIG.DEFAULT_RERANK_TOP_N,
      minConfidence = null, // Optional: minimum rerank relevance threshold (replaces topN if provided)
      trackCosts = true,
      sessionId = null // Accept sessionId from client for multi-step tracking
    } = await request.json();

    console.log(`📝 [API /rerank] [${rerankId}] Request params:`, {
      queryLength: query?.length,
      contactsCount: contacts?.length,
      model,
      topN,
      minConfidence: minConfidence !== null ? minConfidence : 'not set (using topN)',
      trackCosts,
      sessionId: sessionId || 'none (standalone)'
    });

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

    // Get subscription level for cost calculations
    const subscriptionLevel = session.subscriptionLevel;

    // NEW LOGIC STARTS HERE - Solution 2: Detect simple queries and bypass reranking
    // Check if we're in testing mode
    let isSimpleQuery;
    let testingModeActive = false;

    if (FORCE_RERANK_MODE === 'ALWAYS_RERANK') {
      isSimpleQuery = false; // Force all queries to use reranking
      testingModeActive = true;
      console.log(`🧪 [API /rerank] [${rerankId}] TESTING MODE: ALWAYS_RERANK - Forcing reranking for all queries`);
    } else if (FORCE_RERANK_MODE === 'ALWAYS_BYPASS') {
      isSimpleQuery = true; // Force all queries to bypass
      testingModeActive = true;
      console.log(`🧪 [API /rerank] [${rerankId}] TESTING MODE: ALWAYS_BYPASS - Forcing bypass for all queries`);
    } else {
      // AUTO mode - use intelligent detection
      isSimpleQuery = isSimpleFactualQuery(query);
    }

    console.log(`🔍 [API /rerank] [${rerankId}] Query analysis:`, {
      query: query.substring(0, 100),
      isSimpleQuery,
      testingMode: testingModeActive ? FORCE_RERANK_MODE : 'AUTO (intelligent detection)',
      decision: isSimpleQuery
        ? 'BYPASS reranking (return vector-sorted results)'
        : 'PROCEED with reranking (call Cohere API)'
    });

    // If query is simple and factual, bypass reranking entirely
    if (isSimpleQuery) {
      console.log(`⚡ [API /rerank] [${rerankId}] Bypassing rerank for simple query - sorting by vector score`);

      // Sort contacts by their vector similarity score (descending)
      const sortedContacts = [...contacts].sort((a, b) => {
        const scoreA = a._vectorScore || a.searchMetadata?.vectorSimilarity || 0;
        const scoreB = b._vectorScore || b.searchMetadata?.vectorSimilarity || 0;
        return scoreB - scoreA;
      });

      // Limit to topN results
      const finalResults = sortedContacts.slice(0, Math.min(topN, sortedContacts.length));

      // Add minimal metadata to match rerank response format
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
          cost: 0, // No Cohere API call = $0 cost
          model: 'none (bypassed)',
          queryLanguage: 'en',
          documentsReranked: 0,
          resultsReturned: finalResults.length,
          rerankDuration: 0,
          subscriptionLevel,
          timestamp: new Date().toISOString(),
          rerankId,
          bypassedReranking: true,
          bypassReason: testingModeActive ? `forced_bypass_${FORCE_RERANK_MODE}` : 'simple_factual_query',
          originalContactCount: contacts.length,
          // NEW: Testing mode information
          testingMode: testingModeActive ? FORCE_RERANK_MODE : null
        }
      };

      console.log(`✅ [API /rerank] [${rerankId}] Bypass complete:`, {
        originalCount: contacts.length,
        returnedCount: finalResults.length,
        cost: '$0.00 (saved by bypass)',
        strategy: 'vector score sorting'
      });

      return NextResponse.json(bypassResult);
    }
    // NEW LOGIC ENDS HERE

    // Step 3: Check affordability
    if (trackCosts) {
      console.log(`💰 [API /rerank] [${rerankId}] Checking affordability...`);

      const costEstimate = RerankService.estimateCost(contacts.length, model);

      console.log(`💰 [API /rerank] [${rerankId}] Estimated cost: $${costEstimate.estimatedCost.toFixed(6)}`);

      const affordabilityCheck = await CostTrackingService.canAffordOperation(
        userId,
        costEstimate.estimatedCost,
        0 // Reranking doesn't count as a "run", just an operation cost
      );

      console.log(`💰 [API /rerank] [${rerankId}] Affordability check:`, {
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

    // Step 4: Call server service (business logic)
    console.log(`🔄 [API /rerank] [${rerankId}] Calling server service...`);
    const rerankResult = await RerankService.rerankContacts(query, contacts, {
      model,
      topN,
      minRerankScore: minConfidence, // Pass threshold to service
      subscriptionLevel,
      rerankId,
      // NEW LOGIC STARTS HERE - Solution 2: Pass query type to service
      // If we reach here, the query is NOT simple (bypass logic above didn't trigger)
      // So this is a complex semantic query that needs rich document building
      isFactualQuery: false
      // NEW LOGIC ENDS HERE
    });

    // Step 5: Record usage in SessionUsage (if part of multi-step) or ApiUsage (standalone)
    if (trackCosts) {
      const actualCost = rerankResult.metadata.cost;

      try {
        await CostTrackingService.recordUsage({
          userId,
          usageType: 'ApiUsage',
          feature: sessionId ? 'semantic_search_rerank' : 'rerank_operation',
          cost: actualCost,
          isBillableRun: false, // Reranking doesn't count as billable run
          provider: model,
          sessionId, // If provided, records in SessionUsage; if null, records in ApiUsage
          stepLabel: sessionId ? 'Step 1: Rerank' : null, // Only label if part of semantic search
          metadata: {
            documentsReranked: contacts.length,
            queryLanguage: rerankResult.metadata.queryLanguage,
            subscriptionLevel,
            rerankId,
            topN: Math.min(topN, contacts.length),
            isPartOfSemanticSearch: !!sessionId
          }
        });

        const recordLocation = sessionId ? 'SessionUsage' : 'ApiUsage';
        console.log(`✅ [API /rerank] [${rerankId}] Rerank step recorded in ${recordLocation}: $${actualCost.toFixed(6)}`);
      } catch (recordError) {
        console.error(`❌ [API /rerank] [${rerankId}] Failed to record cost:`, recordError);
        // Don't fail the reranking if cost recording fails
      }
    }

    // Step 6: Return formatted response
    const logData = {
      inputCount: contacts.length,
      outputCount: rerankResult.results.length,
      cost: rerankResult.metadata.cost.toFixed(6),
      queryLanguage: rerankResult.metadata.queryLanguage,
      duration: `${rerankResult.metadata.rerankDuration}ms`
    };

    // Add threshold filtering info to logs if it was used
    if (rerankResult.metadata.thresholdFiltering) {
      const stats = rerankResult.metadata.thresholdFiltering;
      logData.thresholdUsed = stats.thresholdUsed;
      logData.filteredOut = stats.removedCount;
      logData.fallbackApplied = stats.fallbackApplied;
    } else {
      logData.strategy = 'topN limit';
    }

    console.log(`✅ [API /rerank] [${rerankId}] Reranking complete:`, logData);

    return NextResponse.json(rerankResult);

  } catch (error) {
    console.error(`❌ [API /rerank] [${rerankId}] Reranking failed:`, {
      message: error.message,
      stack: error.stack
    });

    // Handle specific Cohere API errors
    if (error.status === 401) {
      return NextResponse.json({
        error: 'Reranking service authentication failed'
      }, { status: 503 });
    }

    if (error.status === 429) {
      return NextResponse.json({
        error: 'Reranking service rate limit exceeded. Please try again in a moment.'
      }, { status: 503 });
    }

    // Provide more specific error details if available
    const errorMessage = error.body?.message || error.message || 'Reranking failed';
    return NextResponse.json({
      error: errorMessage,
      rerankId
    }, { status: 500 });
  }
}
