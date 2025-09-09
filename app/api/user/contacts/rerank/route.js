// app/api/user/contacts/rerank/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { CohereClient } from 'cohere-ai';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';

// Initialize Cohere client
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

// Pricing constants
const COHERE_RERANK_PRICING = {
  'rerank-multilingual-v3.0': 1.00 / 1000, // $1.00 per 1,000 documents
  'rerank-english-v3.0': 1.00 / 1000,      // $1.00 per 1,000 documents
};

/**
 * Build document text for reranking
 */
function buildRerankDocument(contact, subscriptionLevel) {
  let document = `[Contact Name]: ${contact.name || 'Unknown'}\n`;
  document += `[Email]: ${contact.email || 'No email'}\n`;
  document += `[Company]: ${contact.company || 'No company'}\n`;
  
  if (contact.jobTitle) {
    document += `[Job Title]: ${contact.jobTitle}\n`;
  }
  
  // Include more details for higher subscription tiers
  const isBusinessOrHigher = ['business', 'enterprise'].includes(subscriptionLevel);
  if (isBusinessOrHigher) {
    if (contact.notes) {
      document += `[Notes]: ${contact.notes}\n`;
    }
    
    if (contact.message) {
      document += `[Message]: ${contact.message}\n`;
    }
    
    if (contact.location?.address) {
      document += `[Location]: ${contact.location.address}\n`;
    }
    
    if (contact.details && Array.isArray(contact.details)) {
      contact.details.forEach(detail => {
        document += `[${detail.label}]: ${detail.value}\n`;
      });
    }
  }
  
  return document.trim();
}

/**
 * Detect query language for multilingual support
 */
function detectQueryLanguage(query) {
  // Simple language detection based on common French words/patterns
  const frenchIndicators = [
    'expert', 'spécialiste', 'ingénieur', 'directeur', 'responsable',
    'développeur', 'consultant', 'manager', 'chef', 'analyste',
    'pour', 'dans', 'avec', 'entreprise', 'société', 'équipe',
    'intelligence artificielle', 'données', 'numérique', 'digital'
  ];
  
  const lowerQuery = query.toLowerCase();
  const frenchMatches = frenchIndicators.filter(word => lowerQuery.includes(word)).length;
  
  // If we find multiple French indicators, assume French
  return frenchMatches >= 2 ? 'fr' : 'en';
}

export async function POST(request) {
  const rerankId = `rerank_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  console.log(`🔄 [Rerank] [${rerankId}] Starting rerank request`);
  
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [Rerank] [${rerankId}] Missing authorization header`);
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    console.log(`👤 [Rerank] [${rerankId}] User authenticated: ${userId}`);

    // 2. Parse request body
    const { 
      query, 
      contacts, 
      model = 'rerank-multilingual-v3.0',
      topN = 10,
      trackCosts = true 
    } = await request.json();

    console.log(`📝 [Rerank] [${rerankId}] Request params:`, {
      queryLength: query?.length,
      contactsCount: contacts?.length,
      model,
      topN,
      trackCosts
    });

    if (!query || !contacts || !Array.isArray(contacts)) {
      console.log(`❌ [Rerank] [${rerankId}] Invalid request parameters`);
      return NextResponse.json({ 
        error: 'Query and contacts array are required' 
      }, { status: 400 });
    }

    if (contacts.length === 0) {
      console.log(`📭 [Rerank] [${rerankId}] No contacts to rerank`);
      return NextResponse.json({ results: [], metadata: { cost: 0, documentsReranked: 0 } });
    }

    // 3. Get user subscription for document building
    console.log(`👤 [Rerank] [${rerankId}] Fetching user subscription...`);
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`❌ [Rerank] [${rerankId}] User not found in database`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';
    console.log(`👤 [Rerank] [${rerankId}] Subscription level: ${subscriptionLevel}`);

    // 4. Check subscription access
    const hasReranking = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);
    if (!hasReranking) {
      console.log(`❌ [Rerank] [${rerankId}] Insufficient subscription level`);
      return NextResponse.json({ 
        error: 'Reranking requires Premium subscription or higher',
        requiredFeature: 'PREMIUM_RERANKING'
      }, { status: 403 });
    }

    // 5. Calculate cost and check affordability
    const modelPrice = COHERE_RERANK_PRICING[model] || COHERE_RERANK_PRICING['rerank-multilingual-v3.0'];
    const estimatedCost = contacts.length * modelPrice;
    
    console.log(`💰 [Rerank] [${rerankId}] Estimated cost: $${estimatedCost.toFixed(6)}`);

    if (trackCosts) {
      console.log(`💰 [Rerank] [${rerankId}] Checking affordability...`);
      
      const affordabilityCheck = await CostTrackingService.canAffordOperation(
        userId, 
        estimatedCost,
        0 // Reranking doesn't count as a "run", just an operation cost
      );
      
      console.log(`💰 [Rerank] [${rerankId}] Affordability check:`, {
        canAfford: affordabilityCheck.canAfford,
        reason: affordabilityCheck.reason
      });

      if (!affordabilityCheck.canAfford) {
        console.log(`❌ [Rerank] [${rerankId}] User cannot afford operation`);
        return NextResponse.json({
          error: `Reranking not available: ${affordabilityCheck.reason}`,
          details: {
            estimatedCost,
            reason: affordabilityCheck.reason
          }
        }, { status: 403 });
      }
    }

    // 6. Build documents for reranking
    console.log(`📄 [Rerank] [${rerankId}] Building documents for reranking...`);
    const documents = contacts.map(contact => buildRerankDocument(contact, subscriptionLevel));
    
    console.log(`📄 [Rerank] [${rerankId}] Built ${documents.length} documents`, {
      avgLength: Math.round(documents.reduce((sum, doc) => sum + doc.length, 0) / documents.length),
      sampleDoc: documents[0]?.substring(0, 200) + '...'
    });

    // 7. Detect query language for multilingual support
    const queryLanguage = detectQueryLanguage(query);
    console.log(`🌐 [Rerank] [${rerankId}] Detected query language: ${queryLanguage}`);

    // 8. Call Cohere Rerank API
    console.log(`🔄 [Rerank] [${rerankId}] Calling Cohere API...`);
    const rerankStartTime = Date.now();
    
    const rerankResponse = await cohere.rerank({
      query: query,
      documents: documents,
      topN: Math.min(topN, contacts.length),
      model: model,
      returnDocuments: false // We already have the full contact data
    });
    
    const rerankDuration = Date.now() - rerankStartTime;
    console.log(`🔄 [Rerank] [${rerankId}] Cohere API complete:`, {
      duration: `${rerankDuration}ms`,
      resultsReturned: rerankResponse.results?.length || 0
    });

    // 9. Calculate actual cost and record usage
    const actualCost = contacts.length * modelPrice;
    
    if (trackCosts) {
      console.log(`💾 [Rerank] [${rerankId}] Recording API operation cost...`);
      
      try {
        await CostTrackingService.recordSeparatedUsage(
          userId,
          actualCost,
          model,
          'rerank_operation',
          {
            documentsReranked: contacts.length,
            queryLanguage,
            subscriptionLevel,
            rerankId,
            topN: Math.min(topN, contacts.length)
          },
          'api_call'
        );
        
        console.log(`✅ [Rerank] [${rerankId}] API operation cost recorded: $${actualCost.toFixed(6)}`);
      } catch (recordError) {
        console.error(`❌ [Rerank] [${rerankId}] Failed to record cost:`, recordError);
        // Don't fail the reranking if cost recording fails
      }
    }

    // 10. Re-order contacts based on rerank scores
    console.log(`📊 [Rerank] [${rerankId}] Processing rerank results...`);
    const rerankedContacts = rerankResponse.results.map((result, rank) => {
      const originalContact = contacts[result.index];
      const vectorScore = originalContact._vectorScore || originalContact.searchMetadata?.vectorSimilarity || 0;
      
      return {
        ...originalContact,
        searchMetadata: {
          ...originalContact.searchMetadata,
          rerankScore: result.relevanceScore,
          rerankRank: rank + 1,
          originalVectorRank: result.index + 1,
          hybridScore: (vectorScore * 0.3) + (result.relevanceScore * 0.7), // Weight rerank score higher
          rerankModel: model,
          queryLanguage
        }
      };
    });

    // 11. Prepare response
    const responseData = {
      results: rerankedContacts,
      metadata: {
        cost: actualCost,
        model,
        queryLanguage,
        documentsReranked: contacts.length,
        resultsReturned: rerankedContacts.length,
        rerankDuration,
        subscriptionLevel,
        timestamp: new Date().toISOString(),
        rerankId
      }
    };

    console.log(`✅ [Rerank] [${rerankId}] Reranking complete:`, {
      originalCount: contacts.length,
      rerankedCount: rerankedContacts.length,
      cost: actualCost.toFixed(6),
      queryLanguage,
      duration: `${rerankDuration}ms`
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error(`❌ [Rerank] [${rerankId}] Reranking failed:`, {
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

    // Provide more specific error details if available from Cohere
    const errorMessage = error.body?.message || error.message || 'Reranking failed';
    return NextResponse.json({ 
      error: errorMessage,
      rerankId 
    }, { status: 500 });
  }
}