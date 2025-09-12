// app/api/user/contacts/semantic-search/route.js - UPDATED WITH SEPARATED COST TRACKING
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pinecone } from '@pinecone-database/pinecone';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';

// Initialize services
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Constants
const INDEX_NAME = 'networking-app-contacts';
const EMBEDDING_MODEL = 'text-embedding-004';

// Pricing for cost tracking
const COSTS = {
  EMBEDDING_PER_MILLION_TOKENS: 0.10, // Gemini embedding cost
  PINECONE_QUERY_BASE: 0.0001, // Base Pinecone query cost
};

export async function POST(request) {
  const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  console.log(`🔍 [SemanticSearch] [${searchId}] Starting search request`);
  
  try {
    // 1. Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [SemanticSearch] [${searchId}] No authorization header`);
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log(`👤 [SemanticSearch] [${searchId}] User authenticated: ${userId}`);

    // 2. Parse request body
    const { 
      query, 
      maxResults = 10, 
      includeMetadata = true, 
      trackCosts = true
    } = await request.json();

    console.log(`📝 [SemanticSearch] [${searchId}] Request params:`, {
      queryLength: query?.length,
      maxResults,
      trackCosts
    });

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.log(`❌ [SemanticSearch] [${searchId}] Invalid query`);
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // 3. Get user subscription
    console.log(`👤 [SemanticSearch] [${searchId}] Fetching user subscription...`);
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`❌ [SemanticSearch] [${searchId}] User not found`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';
    console.log(`👤 [SemanticSearch] [${searchId}] Subscription level: ${subscriptionLevel}`);

    // 4. Check subscription access
    const hasSemanticSearch = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);
    if (!hasSemanticSearch) {
      console.log(`❌ [SemanticSearch] [${searchId}] Insufficient subscription level`);
      return NextResponse.json({
        error: 'Semantic search requires Premium subscription or higher',
        requiredFeature: 'PREMIUM_SEMANTIC_SEARCH'
      }, { status: 403 });
    }

    // 5. Cost tracking - Check if user can afford operation
    let estimatedCost = 0;
    if (trackCosts) {
      console.log(`💰 [SemanticSearch] [${searchId}] Checking affordability...`);
      
      // Estimate cost based on query length
      const estimatedTokens = Math.ceil(query.length / 4);
      const embeddingCost = (estimatedTokens / 1000000) * COSTS.EMBEDDING_PER_MILLION_TOKENS;
      const searchCost = COSTS.PINECONE_QUERY_BASE;
      estimatedCost = embeddingCost + searchCost;
      
      console.log(`💰 [SemanticSearch] [${searchId}] Estimated cost: $${estimatedCost.toFixed(6)}`);
      
      const affordabilityCheck = await CostTrackingService.canAffordOperation(
        userId, 
        estimatedCost,
        1 // Semantic search counts as 1 successful run if it returns results
      );
      
      console.log(`💰 [SemanticSearch] [${searchId}] Affordability check:`, {
        canAfford: affordabilityCheck.canAfford,
        reason: affordabilityCheck.reason
      });

      if (!affordabilityCheck.canAfford) {
        console.log(`❌ [SemanticSearch] [${searchId}] User cannot afford operation`);
        return NextResponse.json({
          error: `Search not available: ${affordabilityCheck.reason}`,
          details: {
            estimatedCost,
            reason: affordabilityCheck.reason,
            currentUsage: affordabilityCheck.currentUsage
          }
        }, { status: 403 });
      }
    }

    // 6. Generate embedding
    console.log(`🧠 [SemanticSearch] [${searchId}] Generating embedding...`);
    const embeddingStartTime = Date.now();
    
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const embeddingResult = await embeddingModel.embedContent(query);
    const queryEmbedding = embeddingResult.embedding.values;
    
    const embeddingTime = Date.now() - embeddingStartTime;
    console.log(`🧠 [SemanticSearch] [${searchId}] Embedding generated:`, {
      dimension: queryEmbedding.length,
      time: `${embeddingTime}ms`
    });

    // 7. Connect to Pinecone and search
    console.log(`📊 [SemanticSearch] [${searchId}] Connecting to Pinecone...`);
    const namespace = `user_${userId}`;
    const index = pinecone.index(INDEX_NAME).namespace(namespace);

    const pineconeQuery = {
      vector: queryEmbedding,
      topK: maxResults,
      includeMetadata,
      includeValues: false
    };

    console.log(`📊 [SemanticSearch] [${searchId}] Executing Pinecone search:`, {
      namespace,
      topK: maxResults
    });

    const searchStartTime = Date.now();
    const searchResults = await index.query(pineconeQuery);
    const searchDuration = Date.now() - searchStartTime;

    console.log(`📊 [SemanticSearch] [${searchId}] Pinecone search complete:`, {
      matches: searchResults.matches?.length || 0,
      duration: `${searchDuration}ms`
    });

    // 8. Calculate actual costs
    let actualCost = 0;
    if (trackCosts) {
      // Calculate actual cost based on real token usage if available
      const actualTokens = embeddingResult.usageMetadata?.promptTokenCount || Math.ceil(query.length / 4);
      const actualEmbeddingCost = (actualTokens / 1000000) * COSTS.EMBEDDING_PER_MILLION_TOKENS;
      const actualSearchCost = COSTS.PINECONE_QUERY_BASE;
      actualCost = actualEmbeddingCost + actualSearchCost;
      
      console.log(`💾 [SemanticSearch] [${searchId}] Actual cost calculation:`, {
        tokens: actualTokens,
        embeddingCost: actualEmbeddingCost.toFixed(6),
        searchCost: actualSearchCost.toFixed(6),
        totalCost: actualCost.toFixed(6)
      });

      // Record the API operation cost (always billable)
      try {
        await CostTrackingService.recordSeparatedUsage(
          userId,
          actualCost,
          EMBEDDING_MODEL,
          'semantic_search_operation',
          {
            queryLength: query.length,
            embeddingTime,
            searchDuration,
            tokens: actualTokens,
            searchId,
            namespace
          },
          'api_call' // This is an API operation cost
        );
        console.log(`✅ [SemanticSearch] [${searchId}] API operation cost recorded: $${actualCost.toFixed(6)}`);
      } catch (recordError) {
        console.error(`❌ [SemanticSearch] [${searchId}] Failed to record API cost:`, recordError);
        // Don't fail the search if cost recording fails
      }
    }

  // 9. Fetch contact details from database
console.log(`📋 [SemanticSearch] [${searchId}] Fetching contact details...`);
let validContacts = [];

if (searchResults.matches && searchResults.matches.length > 0) {
  const userContactsDoc = await adminDb.collection('Contacts').doc(userId).get();

  if (userContactsDoc.exists) {
    const allUserContacts = userContactsDoc.data().contacts || [];
    const contactsMap = new Map(allUserContacts.map(contact => [contact.id, contact]));
    
    validContacts = searchResults.matches.map(match => {
      const contactData = contactsMap.get(match.id);
      if (contactData) {
        // Log dynamic fields for debugging
        if (contactData.dynamicFields?.length > 0) {
          console.log(`📋 [SemanticSearch] [${searchId}] Contact ${contactData.name} has ${contactData.dynamicFields.length} dynamic fields:`, 
            contactData.dynamicFields.map(f => `${f.label}: ${f.value}`));
        }

        return {
          ...contactData,
          id: match.id,
          _vectorScore: match.score,
          searchMetadata: {
            score: match.score,
            namespace,
            retrievedAt: new Date().toISOString(),
            tier: subscriptionLevel,
            searchId,
            // Include dynamic field metadata from Pinecone
            dynamicFieldsFromVector: Object.entries(match.metadata || {})
              .filter(([key]) => !['userId', 'name', 'email', 'company', 'subscriptionTier', 'lastUpdated', 'source', 'embeddingModel'].includes(key))
              .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
          }
        };
      }
      return null;
    }).filter(contact => contact !== null);
  }
}

console.log(`📋 [SemanticSearch] [${searchId}] Contacts retrieved: ${validContacts.length}`);
// Log summary of dynamic fields found
const contactsWithDynamicFields = validContacts.filter(c => c.dynamicFields?.length > 0);
if (contactsWithDynamicFields.length > 0) {
  console.log(`📋 [SemanticSearch] [${searchId}] Found ${contactsWithDynamicFields.length} contacts with dynamic fields`);
}
    // 10. Record successful run if results were found
    if (trackCosts && validContacts.length > 0) {
      try {
        await CostTrackingService.recordSeparatedUsage(
          userId,
          0, // No additional cost for successful run tracking
          EMBEDDING_MODEL,
          'semantic_search_success',
          {
            queryLength: query.length,
            resultsFound: validContacts.length,
            subscriptionLevel,
            embeddingTime,
            searchDuration,
            searchId
          },
          'successful_run' // This counts toward run limits
        );
        console.log(`✅ [SemanticSearch] [${searchId}] Successful run recorded (${validContacts.length} results)`);
      } catch (recordError) {
        console.error(`❌ [SemanticSearch] [${searchId}] Failed to record successful run:`, recordError);
      }
    } else if (trackCosts && validContacts.length === 0) {
      console.log(`🚫 [SemanticSearch] [${searchId}] No results found - API cost paid but no successful run recorded`);
    }

    // 11. Prepare response
    const responseData = {
      results: validContacts,
      searchMetadata: {
        query: query.substring(0, 100),
        totalResults: validContacts.length,
        namespace,
        costs: trackCosts ? {
          estimated: estimatedCost,
          actual: actualCost,
          embedding: (embeddingResult.usageMetadata?.promptTokenCount || Math.ceil(query.length / 4) / 1000000) * COSTS.EMBEDDING_PER_MILLION_TOKENS,
          search: COSTS.PINECONE_QUERY_BASE
        } : undefined,
        billing: trackCosts ? {
          apiOperationCost: actualCost,
          countsAsRun: validContacts.length > 0,
          resultsFound: validContacts.length
        } : undefined,
        searchDuration,
        embeddingTime,
        subscriptionLevel,
        timestamp: new Date().toISOString(),
        searchId
      }
    };

    console.log(`✅ [SemanticSearch] [${searchId}] Search complete:`, {
      results: validContacts.length,
      cost: actualCost.toFixed(6),
      countsAsRun: validContacts.length > 0,
      totalTime: `${embeddingTime + searchDuration}ms`
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error(`❌ [SemanticSearch] [${searchId}] Search failed:`, {
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