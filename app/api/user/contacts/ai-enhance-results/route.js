// app/api/user/contacts/ai-enhance-results/route.js - STREAMING VERSION
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AdvancedLogger, GeminiLogger, FlowLogger } from '@/lib/services/logging/advancedLogger';

// Initialize Gemini for the "Researcher" job
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Accurate pricing structure
const GEMINI_PRICING = {
  'gemini-2.5-flash': {
    inputPricePerMillionTokens: 0.30,
    outputPricePerMillionTokens: 2.50,
  },
  'gemini-2.5-pro': {
    inputPricePerMillionTokens: 1.25,
    outputPricePerMillionTokens: 10.00,
  }
};

function cleanJsonString(text) {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1) {
    return text;
  }
  
  return text.substring(firstBrace, lastBrace + 1);
}

export async function POST(request) {
  const flowLogger = new FlowLogger('ai_enhance_streaming');
  
  try {
    console.log('🚀 Starting streaming AI enhancement...');
    flowLogger.logStep('auth_start', { message: 'Starting authentication' });

    // 1. Authenticate the user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      flowLogger.logError('auth_failed', new Error('Missing authorization header'));
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    flowLogger.logStep('auth_success', { userId });

    // 2. Parse request body
    const { originalQuery, contacts, trackCosts = false, mode = 'batch' } = await request.json();
    
    flowLogger.logStep('request_parsed', {
      originalQuery: originalQuery?.substring(0, 100) + '...',
      contactsCount: contacts?.length,
      trackCosts,
      mode
    });

    if (!originalQuery || !contacts || !Array.isArray(contacts)) {
      const error = new Error('Original query and contacts array are required');
      flowLogger.logError('validation_failed', error);
      return NextResponse.json({ 
        error: 'Original query and contacts array are required' 
      }, { status: 400 });
    }

    if (contacts.length === 0) {
      return NextResponse.json({ insights: [] });
    }

    // 3. Get user's subscription
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) {
      const error = new Error('User not found in database');
      flowLogger.logError('user_not_found', error);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';

    // 4. Check subscription level
    if (!['business', 'enterprise'].includes(subscriptionLevel)) {
      const error = new Error('Insufficient subscription level for AI enhancement');
      flowLogger.logError('insufficient_subscription', error);
      return NextResponse.json({ 
        error: 'AI result enhancement requires Business subscription or higher',
        requiredFeature: 'BUSINESS_AI_SEARCH'
      }, { status: 403 });
    }

    const modelName = subscriptionLevel === 'enterprise' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    // 5. Handle streaming mode
    if (mode === 'streaming') {
      return handleStreamingMode(model, originalQuery, contacts, modelName, userId, trackCosts, flowLogger);
    }

    // 6. Handle batch mode (existing functionality)
    return handleBatchMode(model, originalQuery, contacts, modelName, userId, trackCosts, flowLogger);

  } catch (error) {
    flowLogger.logError('api_error', error);
    
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json({ error: 'Authentication expired. Please sign in again.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handle streaming mode - process contacts one by one
 */
async function handleStreamingMode(model, originalQuery, contacts, modelName, userId, trackCosts, flowLogger) {
  try {
    console.log('🔄 Starting streaming mode for', contacts.length, 'contacts');
    
    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        let totalCosts = {
          aiEnhancement: 0,
          totalTokensInput: 0,
          totalTokensOutput: 0
        };

        const processedInsights = [];
        let processedCount = 0;

        try {
          // Send initial message
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            type: 'start',
            total: contacts.length,
            query: originalQuery
          }) + '\n'));

          // Process each contact individually
          for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            
            try {
              console.log(`🔍 Processing contact ${i + 1}/${contacts.length}: ${contact.name}`);
              
              // Send progress update
              controller.enqueue(new TextEncoder().encode(JSON.stringify({
                type: 'progress',
                contactIndex: i,
                contactName: contact.name,
                processed: processedCount,
                total: contacts.length
              }) + '\n'));

              const insight = await analyzeContactMatch(
                model, 
                originalQuery, 
                contact, 
                totalCosts, 
                modelName, 
                flowLogger, 
                i
              );

              processedCount++;

              if (insight && insight.confidence >= 7) {
                processedInsights.push(insight);
                
                // Send individual result
                controller.enqueue(new TextEncoder().encode(JSON.stringify({
                  type: 'result',
                  insight,
                  contactIndex: i,
                  processed: processedCount,
                  total: contacts.length,
                  confidence: insight.confidence
                }) + '\n'));
              } else {
                // Send filtered result
                controller.enqueue(new TextEncoder().encode(JSON.stringify({
                  type: 'filtered',
                  contactIndex: i,
                  contactName: contact.name,
                  reason: insight ? 'low_confidence' : 'analysis_failed',
                  confidence: insight?.confidence || 0,
                  processed: processedCount,
                  total: contacts.length
                }) + '\n'));
              }

              // Small delay to prevent overwhelming the client
              await new Promise(resolve => setTimeout(resolve, 100));

            } catch (contactError) {
              console.error(`❌ Error processing contact ${contact.name}:`, contactError);
              
              controller.enqueue(new TextEncoder().encode(JSON.stringify({
                type: 'error',
                contactIndex: i,
                contactName: contact.name,
                error: contactError.message,
                processed: processedCount,
                total: contacts.length
              }) + '\n'));
            }
          }

          // Calculate final costs
          if (trackCosts && totalCosts.totalTokensInput > 0) {
            const modelPrices = GEMINI_PRICING[modelName];
            if (modelPrices) {
              const inputCost = (totalCosts.totalTokensInput / 1000000) * modelPrices.inputPricePerMillionTokens;
              const outputCost = (totalCosts.totalTokensOutput / 1000000) * modelPrices.outputPricePerMillionTokens;
              totalCosts.aiEnhancement = inputCost + outputCost;
            }
          }

          // Send final completion message
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            type: 'complete',
            insights: processedInsights,
            stats: {
              totalProcessed: processedCount,
              totalContacts: contacts.length,
              insightsGenerated: processedInsights.length,
              filteredOut: processedCount - processedInsights.length,
              costs: trackCosts ? totalCosts : undefined
            },
            metadata: {
              originalQuery,
              model: modelName,
              timestamp: new Date().toISOString()
            }
          }) + '\n'));

        } catch (streamError) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            type: 'stream_error',
            error: streamError.message
          }) + '\n'));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('❌ Streaming mode error:', error);
    return NextResponse.json({ error: 'Streaming failed' }, { status: 500 });
  }
}

/**
 * Handle batch mode (existing functionality)
 */
async function handleBatchMode(model, originalQuery, contacts, modelName, userId, trackCosts, flowLogger) {
  const startTime = Date.now();
  let totalCosts = {
    aiEnhancement: 0,
    totalTokensInput: 0,
    totalTokensOutput: 0
  };

  try {
    // Process all contacts in parallel (existing behavior)
    const insights = await Promise.all(
      contacts.map((contact, index) => 
        analyzeContactMatch(model, originalQuery, contact, totalCosts, modelName, flowLogger, index)
      )
    );

    const validInsights = insights.filter(insight => {
      return insight !== null && insight.confidence >= 7;
    });

    // Calculate costs
    if (trackCosts && totalCosts.totalTokensInput > 0) {
      const modelPrices = GEMINI_PRICING[modelName];
      if (modelPrices) {
        const inputCost = (totalCosts.totalTokensInput / 1000000) * modelPrices.inputPricePerMillionTokens;
        const outputCost = (totalCosts.totalTokensOutput / 1000000) * modelPrices.outputPricePerMillionTokens;
        totalCosts.aiEnhancement = inputCost + outputCost;
      }
    }

    const responseData = {
      insights: validInsights,
      costs: trackCosts ? { aiEnhancement: totalCosts.aiEnhancement } : undefined,
      metadata: {
        originalQuery,
        contactsAnalyzed: contacts.length,
        insightsGenerated: validInsights.length,
        filteredLowConfidence: insights.length - validInsights.length,
        model: modelName,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Batch mode error:', error);
    return NextResponse.json({
      insights: [],
      costs: trackCosts ? { aiEnhancement: 0 } : undefined,
      error: 'AI analysis temporarily unavailable',
      metadata: {
        originalQuery,
        contactsAnalyzed: contacts.length,
        insightsGenerated: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Analyze why a specific contact matches the search query
 */
async function analyzeContactMatch(model, query, contact, costTracker, modelName, flowLogger, contactIndex) {
  const contactLogger = new FlowLogger(`analyze_contact_${contactIndex}`, contact.id);
  
  try {
    const prompt = `
You are an AI networking assistant analyzing why a contact matches a search query. 

SEARCH QUERY: "${query}"

CONTACT INFORMATION:
- Name: ${contact.name || 'Unknown'}
- Email: ${contact.email || 'Not provided'}
- Company: ${contact.company || 'Not provided'}
- Notes: ${contact.notes || 'No notes available'}
- Message: ${contact.message || 'No message'}
- Vector Similarity Score: ${contact.vectorScore ? (contact.vectorScore * 100).toFixed(1) + '%' : 'Not available'}

TASK: Analyze why this contact matches the search query and provide:

1. MATCH EXPLANATION (2-3 sentences): Explain clearly why this contact is relevant to the search query.
2. RELEVANCE FACTORS (3-5 bullet points): List the specific factors that make this contact relevant.
3. ACTION SUGGESTIONS (2-3 suggestions): Provide specific, actionable suggestions for how the user should engage with this contact based on the search context.
4. CONFIDENCE SCORE (1-10): Rate how confident you are that this contact truly matches what the user is looking for.

FORMAT YOUR RESPONSE AS JSON:
{
  "explanation": "...",
  "factors": ["...", "...", "..."],
  "suggestions": ["...", "...", "..."],
  "confidence": 8
}`;

    const geminiRequestId = await GeminiLogger.logRequest(
      modelName, 
      prompt, 
      { pending: true }, 
      { contactId: contact.id, contactIndex }
    );

    const result = await model.generateContent(prompt);
    
    // Log token usage
    if (result.response.usageMetadata && costTracker) {
      const usage = result.response.usageMetadata;
      costTracker.totalTokensInput += usage.promptTokenCount || 0;
      costTracker.totalTokensOutput += usage.candidatesTokenCount || 0;
    }
    
    const response = await result.response;
    const rawText = response.text();
    
    // Log the complete interaction
    await GeminiLogger.logRequest(
      modelName, 
      prompt, 
      result, 
      { contactId: contact.id, contactIndex, stage: 'complete' }
    );

    const jsonString = cleanJsonString(rawText);
    
    let analysis;
    try {
      analysis = JSON.parse(jsonString);
    } catch (parseError) {
      contactLogger.logError('json_parse_failed', parseError);
      throw parseError;
    }

    if (!analysis.explanation || !analysis.factors || !analysis.suggestions || !analysis.confidence) {
      const error = new Error('Invalid AI response structure');
      contactLogger.logError('invalid_response_structure', error);
      return null;
    }

    const finalResult = {
      contactId: contact.id,
      explanation: analysis.explanation,
      factors: analysis.factors,
      suggestions: analysis.suggestions,
      confidence: analysis.confidence,
      analysisTimestamp: new Date().toISOString(),
      modelUsed: modelName
    };

    contactLogger.complete({
      success: true,
      confidence: analysis.confidence
    });

    return finalResult;

  } catch (error) {
    contactLogger.logError('analysis_failed', error);
    return null;
  }
}