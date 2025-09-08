// app/api/user/contacts/ai-enhance-results/route.js - ENHANCED WITH VECTOR SIMILARITY OPTIMIZATION
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AdvancedLogger, GeminiLogger, FlowLogger } from '@/lib/services/logging/advancedLogger';

// Initialize Gemini for the "Researcher" job
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

/**
 * Generate similarity-aware AI prompt
 */
function generateSimilarityAwarePrompt(query, contact) {
  const vectorScore = contact.vectorScore || contact._vectorScore || 0;
  const similarityTier = contact.similarityTier || 'unknown';
  const similarityExplanation = contact.similarityExplanation || `${(vectorScore * 100).toFixed(1)}% semantic similarity`;

  let contextualGuidance = '';
  
  switch (similarityTier) {
    case 'high':
      contextualGuidance = `This contact has HIGH semantic similarity to your query (${similarityExplanation}). Focus on validating and exploring their specific expertise level, recent experience, and practical skills.`;
      break;
    case 'medium':
      contextualGuidance = `This contact has MODERATE semantic similarity to your query (${similarityExplanation}). Look for transferable skills, related experience, or potential for growth in this area.`;
      break;
    case 'low':
      contextualGuidance = `This contact has LOWER semantic similarity to your query (${similarityExplanation}). Examine if they have any indirect experience, related background, or valuable network connections.`;
      break;
    default:
      contextualGuidance = `Analyze this contact's relevance to your query with their semantic similarity context.`;
  }

  return `
You are an AI networking assistant analyzing why a contact matches a search query.

SEARCH QUERY: "${query}"

VECTOR SIMILARITY CONTEXT: ${contextualGuidance}

CONTACT INFORMATION:
- Name: ${contact.name || 'Unknown'}
- Email: ${contact.email || 'Not provided'}
- Company: ${contact.company || 'Not provided'}
- Notes: ${contact.notes || 'No notes available'}
- Message: ${contact.message || 'No message'}
- Vector Similarity: ${similarityExplanation}
- Similarity Tier: ${similarityTier.toUpperCase()}

ANALYSIS INSTRUCTIONS:
Given the ${similarityTier} semantic similarity, provide:

1. MATCH EXPLANATION (2-3 sentences): Explain why this contact is relevant, considering both the semantic similarity and specific details.

2. RELEVANCE FACTORS (3-5 bullet points): List specific factors that make this contact relevant, weighing both semantic indicators and concrete evidence.

3. ACTION SUGGESTIONS (2-3 suggestions): Provide specific, actionable suggestions for engagement based on the similarity level and contact details.

4. CONFIDENCE SCORE (1-10): Rate your confidence that this contact matches what the user seeks, considering:
   - High similarity contacts: Start with baseline 7-8 confidence, adjust based on specifics
   - Medium similarity contacts: Start with baseline 5-6 confidence, adjust based on evidence
   - Low similarity contacts: Start with baseline 3-4 confidence, require strong evidence to score higher

FORMAT YOUR RESPONSE AS JSON:
{
  "explanation": "...",
  "factors": ["...", "...", "..."],
  "suggestions": ["...", "...", "..."],
  "confidence": 8
}`;
}

export async function POST(request) {
  const flowLogger = new FlowLogger('ai_enhance_streaming');
  
  try {
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
    const { 
      originalQuery, 
      contacts, 
      trackCosts = false, 
      mode = 'batch',
      processingStrategy = 'standard',
      vectorOptimized = false
    } = await request.json();
    
    flowLogger.logStep('request_parsed', {
      originalQuery: originalQuery?.substring(0, 100) + '...',
      contactsCount: contacts?.length,
      trackCosts,
      mode,
      processingStrategy,
      vectorOptimized
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

    flowLogger.logStep('model_selected', {
      modelName,
      subscriptionLevel,
      vectorOptimized,
      processingStrategy
    });

    // 5. Handle streaming mode with vector optimization
    if (mode === 'streaming') {
      return handleEnhancedStreamingMode(
        model, 
        originalQuery, 
        contacts, 
        modelName, 
        userId, 
        trackCosts, 
        flowLogger,
        { processingStrategy, vectorOptimized }
      );
    }

    // 6. Handle batch mode
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
 * Enhanced streaming mode with vector similarity processing
 */
async function handleEnhancedStreamingMode(model, originalQuery, contacts, modelName, userId, trackCosts, flowLogger, options = {}) {
  const { processingStrategy = 'standard', vectorOptimized = false } = options;
  
  try {
    console.log('Starting enhanced streaming mode:', {
      contactsCount: contacts.length,
      processingStrategy,
      vectorOptimized
    });
    
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
          // Send initial message with strategy info
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            type: 'start',
            total: contacts.length,
            query: originalQuery,
            processingStrategy,
            vectorOptimized
          }) + '\n'));

          // Sort contacts by vector similarity if optimized
          const contactsToProcess = vectorOptimized 
            ? [...contacts].sort((a, b) => {
                const scoreA = a.vectorScore || a._vectorScore || 0;
                const scoreB = b.vectorScore || b._vectorScore || 0;
                return scoreB - scoreA; // Process highest similarity first
              })
            : contacts;

          console.log('Contact processing order:', contactsToProcess.map(c => ({
            name: c.name,
            tier: c.similarityTier,
            score: (c.vectorScore || c._vectorScore || 0).toFixed(3)
          })));

          // Process each contact individually with enhanced prompting
          for (let i = 0; i < contactsToProcess.length; i++) {
            const contact = contactsToProcess[i];
            
            try {
              console.log(`Processing contact ${i + 1}/${contactsToProcess.length}: ${contact.name} (${contact.similarityTier || 'unknown'} similarity)`);
              
              // Send progress update with similarity info
              controller.enqueue(new TextEncoder().encode(JSON.stringify({
                type: 'progress',
                contactIndex: i,
                contactId: contact.id,
                contactName: contact.name,
                processed: processedCount,
                total: contactsToProcess.length,
                similarityTier: contact.similarityTier,
                vectorScore: contact.vectorScore || contact._vectorScore
              }) + '\n'));

              const insight = await analyzeContactMatchWithSimilarity(
                model, 
                originalQuery, 
                contact, 
                totalCosts, 
                modelName, 
                flowLogger, 
                i
              );

              processedCount++;

              if (insight && insight.confidence >= getConfidenceThreshold(contact.similarityTier)) {
                processedInsights.push(insight);
                
                // Send individual result with similarity context
                controller.enqueue(new TextEncoder().encode(JSON.stringify({
                  type: 'result',
                  insight,
                  contactIndex: i,
                  contactId: contact.id,
                  processed: processedCount,
                  total: contactsToProcess.length,
                  confidence: insight.confidence,
                  similarityTier: contact.similarityTier,
                  vectorScore: contact.vectorScore || contact._vectorScore,
                  hybridScore: calculateHybridScore(contact.vectorScore || contact._vectorScore, insight.confidence)
                }) + '\n'));
              } else {
                // Send filtered result with reason
                const filterReason = insight ? 
                  `Low confidence (${insight.confidence}/${getConfidenceThreshold(contact.similarityTier)} required for ${contact.similarityTier || 'unknown'} similarity)` : 
                  'Analysis failed';
                
                controller.enqueue(new TextEncoder().encode(JSON.stringify({
                  type: 'filtered',
                  contactIndex: i,
                  contactId: contact.id,
                  contactName: contact.name,
                  reason: filterReason,
                  confidence: insight?.confidence || 0,
                  processed: processedCount,
                  total: contactsToProcess.length,
                  similarityTier: contact.similarityTier,
                  vectorScore: contact.vectorScore || contact._vectorScore
                }) + '\n'));
              }

              // Small delay to prevent overwhelming the client
              await new Promise(resolve => setTimeout(resolve, 100));

            } catch (contactError) {
              console.error(`Error processing contact ${contact.name}:`, contactError);
              
              controller.enqueue(new TextEncoder().encode(JSON.stringify({
                type: 'error',
                contactIndex: i,
                contactId: contact.id,
                contactName: contact.name,
                error: contactError.message,
                processed: processedCount,
                total: contactsToProcess.length,
                similarityTier: contact.similarityTier
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

          // Send final completion message with enhanced stats
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            type: 'complete',
            insights: processedInsights,
            stats: {
              totalProcessed: processedCount,
              totalContacts: contactsToProcess.length,
              insightsGenerated: processedInsights.length,
              filteredOut: processedCount - processedInsights.length,
              costs: trackCosts ? totalCosts : undefined,
              processingStrategy,
              vectorOptimized,
              similarityBreakdown: getSimilarityBreakdown(contactsToProcess, processedInsights)
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
    console.error('Enhanced streaming mode error:', error);
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
        analyzeContactMatchWithSimilarity(model, originalQuery, contact, totalCosts, modelName, flowLogger, index)
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
    console.error('Batch mode error:', error);
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
 * Enhanced contact analysis with similarity-aware prompting
 */
async function analyzeContactMatchWithSimilarity(model, query, contact, costTracker, modelName, flowLogger, contactIndex) {
  const contactLogger = new FlowLogger(`analyze_contact_${contactIndex}`, contact.id);
  
  try {
    contactLogger.logStep('analysis_start', {
      contactName: contact.name,
      contactId: contact.id,
      similarityTier: contact.similarityTier,
      vectorScore: contact.vectorScore || contact._vectorScore,
      modelName
    });

    // Use similarity-aware prompt
    const prompt = generateSimilarityAwarePrompt(query, contact);
    
    contactLogger.logStep('prompt_prepared', {
      promptLength: prompt.length,
      similarityContext: contact.similarityTier,
      vectorScore: contact.vectorScore || contact._vectorScore
    });

    const geminiRequestId = await GeminiLogger.logRequest(
      modelName, 
      prompt, 
      { pending: true }, 
      { 
        contactId: contact.id, 
        contactIndex,
        similarityTier: contact.similarityTier,
        vectorScore: contact.vectorScore || contact._vectorScore
      }
    );

    const result = await model.generateContent(prompt);
    
    // Log token usage
    if (result.response.usageMetadata && costTracker) {
      const usage = result.response.usageMetadata;
      costTracker.totalTokensInput += usage.promptTokenCount || 0;
      costTracker.totalTokensOutput += usage.candidatesTokenCount || 0;
      
      contactLogger.logStep('token_usage_tracked', {
        promptTokens: usage.promptTokenCount,
        outputTokens: usage.candidatesTokenCount
      });
    }
    
    const response = await result.response;
    const rawText = response.text();
    
    // Log the complete interaction
    await GeminiLogger.logRequest(
      modelName, 
      prompt, 
      result, 
      { 
        contactId: contact.id, 
        contactIndex, 
        stage: 'complete',
        similarityTier: contact.similarityTier
      }
    );

    const jsonString = cleanJsonString(rawText);
    
    let analysis;
    try {
      analysis = JSON.parse(jsonString);
      
      contactLogger.logStep('json_parsed', {
        hasExplanation: !!analysis.explanation,
        hasFactors: !!analysis.factors,
        hasSuggestions: !!analysis.suggestions,
        hasConfidence: !!analysis.confidence,
        confidence: analysis.confidence,
        similarityTier: contact.similarityTier
      });
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
      modelUsed: modelName,
      similarityContext: {
        tier: contact.similarityTier,
        vectorScore: contact.vectorScore || contact._vectorScore,
        hybridScore: calculateHybridScore(contact.vectorScore || contact._vectorScore, analysis.confidence)
      }
    };

    contactLogger.complete({
      success: true,
      confidence: analysis.confidence,
      similarityTier: contact.similarityTier,
      hybridScore: finalResult.similarityContext.hybridScore
    });

    return finalResult;

  } catch (error) {
    contactLogger.logError('analysis_failed', error);
    return null;
  }
}

/**
 * Get confidence threshold based on similarity tier
 */
function getConfidenceThreshold(similarityTier) {
  switch (similarityTier) {
    case 'high': return 6;    // Lower threshold for high similarity
    case 'medium': return 7;  // Standard threshold
    case 'low': return 8;     // Higher threshold for low similarity
    default: return 7;        // Default threshold
  }
}

/**
 * Calculate hybrid score combining vector similarity and AI confidence
 */
function calculateHybridScore(vectorScore, aiConfidence) {
  if (!vectorScore || !aiConfidence) return 0;
  
  const normalizedAI = aiConfidence / 10;
  const hybridScore = (vectorScore * 0.4) + (normalizedAI * 0.6);
  
  return Math.round(hybridScore * 1000) / 1000;
}

/**
 * Get similarity breakdown for stats
 */
function getSimilarityBreakdown(contactsProcessed, insights) {
  const breakdown = {
    high: { processed: 0, insights: 0 },
    medium: { processed: 0, insights: 0 },
    low: { processed: 0, insights: 0 },
    unknown: { processed: 0, insights: 0 }
  };

  contactsProcessed.forEach(contact => {
    const tier = contact.similarityTier || 'unknown';
    if (breakdown[tier]) {
      breakdown[tier].processed++;
    }
  });

  insights.forEach(insight => {
    const tier = insight.similarityContext?.tier || 'unknown';
    if (breakdown[tier]) {
      breakdown[tier].insights++;
    }
  });

  return breakdown;
}