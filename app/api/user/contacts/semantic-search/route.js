// app/api/user/contacts/semantic-search/route.js - WITH ADVANCED LOGGING
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pinecone } from '@pinecone-database/pinecone';
import { AdvancedLogger, PineconeLogger, GeminiLogger, FlowLogger } from '../../../../../lib/services/logging/advancedLogger.js';

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
  EMBEDDING_PER_MILLION_TOKENS: 0.15, // $0.15 per 1M tokens
  PINECONE_QUERY_PER_REQUEST: 0.0000675, // ~$0.0675 per 1K queries
};

export async function POST(request) {
  const flowLogger = new FlowLogger('semantic_search_api');
  
  try {
    AdvancedLogger.info('API', 'semantic_search_start', {
      endpoint: '/api/user/contacts/semantic-search',
      method: 'POST'
    });

    flowLogger.logStep('auth_start', { message: 'Starting authentication' });

    // 1. Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      flowLogger.logError('auth_missing', new Error('Missing authorization header'));
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    flowLogger.logStep('auth_success', {
      userId,
      userEmail: decodedToken.email
    });

    // 2. Parse request body
    flowLogger.logStep('parse_request', { message: 'Parsing request body' });
    
    const { 
      query, 
      maxResults = 10, 
      includeMetadata = true, 
      trackCosts = false 
    } = await request.json();

    flowLogger.logStep('request_parsed', {
      query: query?.substring(0, 100) + (query?.length > 100 ? '...' : ''),
      queryLength: query?.length,
      maxResults,
      includeMetadata,
      trackCosts
    });

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      const error = new Error('Query is required and must be a non-empty string');
      flowLogger.logError('invalid_query', error);
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // 3. Get user subscription
    flowLogger.logStep('fetch_subscription', { message: 'Fetching user subscription' });
    
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) {
      const error = new Error('User not found');
      flowLogger.logError('user_not_found', error);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';

    flowLogger.logStep('subscription_fetched', {
      subscriptionLevel,
      hasAccountType: !!userData.accountType
    });

    // 4. Check subscription access
    const hasSemanticSearch = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);
    if (!hasSemanticSearch) {
      const error = new Error('Semantic search requires Premium subscription or higher');
      flowLogger.logError('insufficient_subscription', error, { 
        required: ['premium', 'business', 'enterprise'],
        actual: subscriptionLevel 
      });
      return NextResponse.json({
        error: 'Semantic search requires Premium subscription or higher',
        requiredFeature: 'PREMIUM_SEMANTIC_SEARCH'
      }, { status: 403 });
    }

    // 5. Initialize cost tracking
    const costs = {
      embedding: 0,
      vectorSearch: 0,
      total: 0
    };

    flowLogger.logStep('cost_tracking_init', {
      trackCosts,
      subscriptionLevel
    });

    // 6. Generate embedding using Gemini
    flowLogger.logStep('embedding_start', {
      message: 'Generating query embedding',
      model: EMBEDDING_MODEL
    });

    AdvancedLogger.info('Gemini', 'embedding_request_start', {
      query: query.substring(0, 100),
      queryLength: query.length,
      model: EMBEDDING_MODEL
    });

    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const embeddingResult = await embeddingModel.embedContent(query);
    const queryEmbedding = embeddingResult.embedding.values;

    // Log embedding generation
    const embeddingRequestId = await GeminiLogger.logEmbedding(
      query,
      queryEmbedding,
      { userId, subscriptionLevel }
    );

    flowLogger.logStep('embedding_complete', {
      embeddingDimension: queryEmbedding.length,
      embeddingRequestId,
      embeddingPreview: queryEmbedding.slice(0, 5)
    });

    // Calculate embedding cost
    const estimatedTokens = Math.ceil(query.length / 4); // Rough estimation
    if (trackCosts) {
      costs.embedding = (estimatedTokens / 1000000) * COSTS.EMBEDDING_PER_MILLION_TOKENS;
      
      flowLogger.logStep('embedding_cost_calculated', {
        estimatedTokens,
        cost: costs.embedding
      });
    }

    // 7. Connect to Pinecone and search
    flowLogger.logStep('pinecone_connection', { message: 'Connecting to Pinecone index' });

    const namespace = `user_${userId}`;
    const index = pinecone.index(INDEX_NAME).namespace(namespace);

    AdvancedLogger.info('Pinecone', 'search_request_start', {
      indexName: INDEX_NAME,
      namespace,
      queryDimension: queryEmbedding.length,
      maxResults,
      userId
    });

    // Prepare Pinecone query - FIXED: Remove namespace from query object
    const pineconeQuery = {
      vector: queryEmbedding,
      topK: maxResults,
      includeMetadata,
      includeValues: false
      // namespace is now handled by .namespace() method above
    };

    flowLogger.logStep('pinecone_query_prepared', {
      topK: maxResults,
      namespace,
      includeMetadata,
      vectorDimension: queryEmbedding.length
    });

    // Log the Pinecone query input
    const pineconeRequestId = await PineconeLogger.logQuery('SEARCH', pineconeQuery, { pending: true }, {
      userId,
      subscriptionLevel,
      namespace
    });

    // Execute search
    const searchStartTime = Date.now();
    const searchResults = await index.query(pineconeQuery);
    const searchDuration = Date.now() - searchStartTime;

    // Log the Pinecone query output
    await PineconeLogger.logQuery('SEARCH', pineconeQuery, searchResults, {
      userId,
      subscriptionLevel,
      namespace,
      duration: searchDuration,
      requestId: pineconeRequestId
    });

    flowLogger.logStep('pinecone_search_complete', {
      searchDuration,
      matchesCount: searchResults.matches?.length || 0,
      pineconeRequestId,
      searchResults: {
        matchesFound: searchResults.matches?.length || 0,
        averageScore: searchResults.matches?.length > 0 
          ? searchResults.matches.reduce((sum, match) => sum + match.score, 0) / searchResults.matches.length 
          : 0,
        topScore: searchResults.matches?.[0]?.score || 0
      }
    });

    // Calculate Pinecone search cost
    if (trackCosts) {
      costs.vectorSearch = COSTS.PINECONE_QUERY_PER_REQUEST;
      costs.total = costs.embedding + costs.vectorSearch;

      flowLogger.logStep('search_cost_calculated', {
        vectorSearchCost: costs.vectorSearch,
        totalCost: costs.total
      });
    }

   // =========================================================================
    // --- START OF FIXED SECTION ---
    // 8. Fetch contact details from database
    flowLogger.logStep('contact_fetch_start', {
      message: 'Fetching all user contacts from single document',
      contactIdsToFind: searchResults.matches?.map(m => m.id) || []
    });

    let validContacts = [];

    // Only fetch from Firestore if Pinecone returned any matches
    if (searchResults.matches && searchResults.matches.length > 0) {
      // Get the single document that holds all contacts for this user
      const userContactsDoc = await adminDb.collection('Contacts').doc(userId).get();

      if (userContactsDoc.exists) {
        // Get the array of contacts from the document
        const allUserContacts = userContactsDoc.data().contacts || [];
        
        // Create a quick lookup map for efficiency
        const contactsMap = new Map(allUserContacts.map(contact => [contact.id, contact]));
        
        // Filter and enrich the contacts based on Pinecone's results
        validContacts = searchResults.matches.map(match => {
          const contactData = contactsMap.get(match.id);
          if (contactData) {
            return {
              ...contactData,
              id: match.id,
              _vectorScore: match.score,
              searchMetadata: {
                score: match.score,
                namespace,
                retrievedAt: new Date().toISOString(),
                tier: subscriptionLevel
              }
            };
          }
          AdvancedLogger.warn('Database', 'contact_not_found_in_array', {
            contactId: match.id,
            score: match.score
          });
          return null; // This contact was in Pinecone but not in the user's array
        }).filter(contact => contact !== null); // Remove any nulls
      } else {
        AdvancedLogger.warn('Database', 'user_contacts_document_not_found', { userId });
      }
    }

    flowLogger.logStep('contact_fetch_complete', {
      totalMatches: searchResults.matches?.length || 0,
      contactsRetrieved: validContacts.length,
      contactsNotFound: (searchResults.matches?.length || 0) - validContacts.length
    });

    AdvancedLogger.info('Database', 'contacts_fetched', {
      totalRequested: searchResults.matches?.length || 0,
      successfullyRetrieved: validContacts.length,
      userId
    });
    // --- END OF FIXED SECTION ---
    // =========================================================================


    // 9. Prepare response
    const responseData = {
      results: validContacts,
      searchMetadata: {
        query: query.substring(0, 100), // Truncate for privacy
        totalResults: validContacts.length,
        namespace,
        costs: trackCosts ? costs : undefined,
        searchDuration: searchDuration,
        subscriptionLevel,
        timestamp: new Date().toISOString(),
        pineconeRequestId,
        embeddingRequestId
      }
    };

    flowLogger.complete({
      success: true,
      resultsCount: validContacts.length,
      totalCost: costs.total,
      searchDuration
    });

    AdvancedLogger.info('API', 'semantic_search_success', {
      resultsCount: validContacts.length,
      totalCost: costs.total,
      searchDuration,
      userId
    });

    return NextResponse.json(responseData);

  } catch (error) {
    flowLogger.logError('api_error', error);
    
    AdvancedLogger.error('API', 'semantic_search_error', {
      error: error.message,
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
      error: 'Internal server error' 
    }, { status: 500 });
  }
}