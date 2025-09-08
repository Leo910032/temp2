// app/api/user/contacts/ai-enhance-results/route.js - FIXED WITH SEPARATED COST TRACKING
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';

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

export async function POST(request) {
  const enhanceId = `enhance_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  console.log(`🤖 [AIEnhance] [${enhanceId}] Starting AI enhancement request`);
  
  try {
    // 1. Authenticate the user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [AIEnhance] [${enhanceId}] Missing authorization header`);
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    console.log(`👤 [AIEnhance] [${enhanceId}] User authenticated: ${userId}`);

    // 2. Parse request body
    const { 
      originalQuery, 
      contacts, 
      trackCosts = true, 
      mode = 'batch',
      processingStrategy = 'standard',
      vectorOptimized = false
    } = await request.json();
    
    console.log(`📝 [AIEnhance] [${enhanceId}] Request params:`, {
      queryLength: originalQuery?.length,
      contactsCount: contacts?.length,
      trackCosts,
      mode,
      processingStrategy,
      vectorOptimized
    });

    if (!originalQuery || !contacts || !Array.isArray(contacts)) {
      console.log(`❌ [AIEnhance] [${enhanceId}] Invalid request parameters`);
      return NextResponse.json({ 
        error: 'Original query and contacts array are required' 
      }, { status: 400 });
    }

    if (contacts.length === 0) {
      return NextResponse.json({ insights: [] });
    }

    // 3. Get user's subscription
    console.log(`👤 [AIEnhance] [${enhanceId}] Fetching user subscription...`);
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`❌ [AIEnhance] [${enhanceId}] User not found in database`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';
    console.log(`👤 [AIEnhance] [${enhanceId}] Subscription level: ${subscriptionLevel}`);

    // 4. Check subscription level
    if (!['business', 'enterprise'].includes(subscriptionLevel)) {
      console.log(`❌ [AIEnhance] [${enhanceId}] Insufficient subscription level`);
      return NextResponse.json({ 
        error: 'AI result enhancement requires Business subscription or higher',
        requiredFeature: 'BUSINESS_AI_SEARCH'
      }, { status: 403 });
    }

    const modelName = subscriptionLevel === 'enterprise' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    console.log(`🧠 [AIEnhance] [${enhanceId}] Model selected: ${modelName}`);

    // 5. Cost tracking check
    if (trackCosts) {
      console.log(`💰 [AIEnhance] [${enhanceId}] Checking cost affordability...`);
      
      // Estimate cost based on contacts and model
      const avgPromptLength = 1500; // Estimated average prompt length
      const avgResponseLength = 300; // Estimated average response length
      const estimatedInputTokens = contacts.length * avgPromptLength;
      const estimatedOutputTokens = contacts.length * avgResponseLength;
      
      const modelPrices = GEMINI_PRICING[modelName];
      const estimatedCost = (estimatedInputTokens / 1000000) * modelPrices.inputPricePerMillionTokens +
                           (estimatedOutputTokens / 1000000) * modelPrices.outputPricePerMillionTokens;
      
      console.log(`💰 [AIEnhance] [${enhanceId}] Estimated cost: $${estimatedCost.toFixed(6)}`);
      
      const affordabilityCheck = await CostTrackingService.canAffordOperation(
        userId, 
        estimatedCost,
        1
      );
      
      console.log(`💰 [AIEnhance] [${enhanceId}] Affordability check:`, {
        canAfford: affordabilityCheck.canAfford,
        reason: affordabilityCheck.reason
      });

      if (!affordabilityCheck.canAfford) {
        console.log(`❌ [AIEnhance] [${enhanceId}] User cannot afford operation`);
        return NextResponse.json({
          error: `AI enhancement not available: ${affordabilityCheck.reason}`,
          details: {
            estimatedCost,
            reason: affordabilityCheck.reason
          }
        }, { status: 403 });
      }
    }

    // 6. Handle streaming mode with separated cost tracking
    if (mode === 'streaming') {
      return handleEnhancedStreamingModeWithSeparatedTracking(
        model, 
        originalQuery, 
        contacts, 
        modelName, 
        userId, 
        trackCosts, 
        enhanceId,
        { processingStrategy, vectorOptimized }
      );
    }

    // 7. Handle batch mode with separated cost tracking
    return handleBatchModeWithSeparatedTracking(model, originalQuery, contacts, modelName, userId, trackCosts, enhanceId);

  } catch (error) {
    console.error(`❌ [AIEnhance] [${enhanceId}] API error:`, {
      message: error.message,
      stack: error.stack
    });
    
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json({ error: 'Authentication expired. Please sign in again.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Enhanced streaming mode with separated cost tracking
 */
async function handleEnhancedStreamingModeWithSeparatedTracking(model, originalQuery, contacts, modelName, userId, trackCosts, enhanceId, options = {}) {
  const { processingStrategy = 'standard', vectorOptimized = false } = options;
  
  try {
    console.log(`🔄 [AIEnhance] [${enhanceId}] Starting enhanced streaming mode with separated tracking`);
    
    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        let totalCosts = 0;
        let totalApiCalls = 0;
        let successfulRuns = 0;
        let filteredContacts = 0;
        const processedInsights = [];
        let processedCount = 0;

        try {
          // Send initial message
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
                return scoreB - scoreA;
              })
            : contacts;

          // Process each contact individually
          for (let i = 0; i < contactsToProcess.length; i++) {
            const contact = contactsToProcess[i];
            
            try {
              console.log(`🔄 [AIEnhance] [${enhanceId}] Processing contact ${i + 1}/${contactsToProcess.length}: ${contact.name}`);
              
              // Send progress update
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

              // Generate prompt and call Gemini
              const prompt = generateSimilarityAwarePrompt(originalQuery, contact);
              const result = await model.generateContent(prompt);
              
              // Calculate cost for this API call
              const usage = result.response.usageMetadata;
              const inputTokens = usage?.promptTokenCount || 0;
              const outputTokens = usage?.candidatesTokenCount || 0;
              
              const modelPrices = GEMINI_PRICING[modelName];
              const apiCallCost = (inputTokens / 1000000) * modelPrices.inputPricePerMillionTokens +
                                 (outputTokens / 1000000) * modelPrices.outputPricePerMillionTokens;
              
              totalCosts += apiCallCost;
              totalApiCalls++;
              
              // Record the API call cost (always billable)
              if (trackCosts) {
                await CostTrackingService.recordSeparatedUsage(
                  userId,
                  apiCallCost,
                  modelName,
                  'ai_contact_analysis',
                  {
                    contactId: contact.id,
                    contactName: contact.name,
                    inputTokens,
                    outputTokens,
                    enhanceId,
                    contactIndex: i
                  },
                  'api_call' // This is an API call cost
                );
              }
              
              processedCount++;
              
              // Parse and analyze the response
              const response = await result.response;
              const rawText = response.text();
              const jsonString = cleanJsonString(rawText);
              
              let analysis;
              try {
                analysis = JSON.parse(jsonString);
              } catch (parseError) {
                console.error(`❌ [AIEnhance] [${enhanceId}] JSON parse failed for ${contact.name}:`, parseError);
                filteredContacts++;
                continue;
              }

              if (!analysis.explanation || !analysis.factors || !analysis.suggestions || !analysis.confidence) {
                console.error(`❌ [AIEnhance] [${enhanceId}] Invalid response structure for ${contact.name}`);
                filteredContacts++;
                continue;
              }

              const confidenceThreshold = getConfidenceThreshold(contact.similarityTier);
              
              if (analysis.confidence >= confidenceThreshold) {
                // This is a successful run - counts toward AI run limits
                successfulRuns++;
                
                if (trackCosts) {
                  await CostTrackingService.recordSeparatedUsage(
                    userId,
                    0, // No additional cost for successful run tracking
                    modelName,
                    'ai_enhancement_success',
                    {
                      contactId: contact.id,
                      contactName: contact.name,
                      confidence: analysis.confidence,
                      threshold: confidenceThreshold,
                      enhanceId,
                      contactIndex: i
                    },
                    'successful_run' // This counts toward run limits
                  );
                }

                const insight = {
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
                  },
                  billing: {
                    apiCallCost,
                    countsAsRun: true,
                    contactIndex: i
                  }
                };

                processedInsights.push(insight);
                
                // Send individual result
                controller.enqueue(new TextEncoder().encode(JSON.stringify({
                  type: 'result',
                  insight,
                  contactIndex: i,
                  contactId: contact.id,
                  processed: processedCount,
                  total: contactsToProcess.length,
                  confidence: analysis.confidence,
                  similarityTier: contact.similarityTier,
                  vectorScore: contact.vectorScore || contact._vectorScore,
                  hybridScore: calculateHybridScore(contact.vectorScore || contact._vectorScore, analysis.confidence)
                }) + '\n'));
                
                console.log(`✅ [AIEnhance] [${enhanceId}] Successful run recorded for ${contact.name}: confidence ${analysis.confidence}/${confidenceThreshold}`);
                
              } else {
                // Low confidence - API call was paid for but doesn't count as successful run
                filteredContacts++;
                console.log(`🚫 [AIEnhance] [${enhanceId}] Contact filtered (paid but not counted): ${contact.name} - confidence ${analysis.confidence}/${confidenceThreshold}`);
                
                // Send filtered result
                controller.enqueue(new TextEncoder().encode(JSON.stringify({
                  type: 'filtered',
                  contactIndex: i,
                  contactId: contact.id,
                  contactName: contact.name,
                  reason: `Low confidence (${analysis.confidence}/${confidenceThreshold} required for ${contact.similarityTier || 'unknown'} similarity)`,
                  confidence: analysis.confidence,
                  processed: processedCount,
                  total: contactsToProcess.length,
                  similarityTier: contact.similarityTier,
                  vectorScore: contact.vectorScore || contact._vectorScore
                }) + '\n'));
              }

              // Small delay to prevent overwhelming the client
              await new Promise(resolve => setTimeout(resolve, 100));

            } catch (contactError) {
              console.error(`❌ [AIEnhance] [${enhanceId}] Error processing contact ${contact.name}:`, contactError);
              
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

          // Send final completion message with enhanced stats
          const summary = {
            totalContactsProcessed: contacts.length,
            totalApiCalls,
            successfulRuns,
            filteredContacts,
            totalCosts,
            apiCallEfficiency: totalApiCalls > 0 ? (successfulRuns / totalApiCalls * 100).toFixed(1) + '%' : '0%',
            averageCostPerApiCall: totalApiCalls > 0 ? (totalCosts / totalApiCalls).toFixed(6) : '0',
            averageCostPerSuccessfulRun: successfulRuns > 0 ? (totalCosts / successfulRuns).toFixed(6) : '0'
          };

          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            type: 'complete',
            insights: processedInsights,
            billing: summary,
            stats: {
              totalProcessed: processedCount,
              totalContacts: contactsToProcess.length,
              insightsGenerated: processedInsights.length,
              filteredOut: filteredContacts,
              costs: trackCosts ? { aiEnhancement: totalCosts } : undefined,
              processingStrategy,
              vectorOptimized,
              similarityBreakdown: getSimilarityBreakdown(contactsToProcess, processedInsights)
            },
            metadata: {
              originalQuery,
              model: modelName,
              timestamp: new Date().toISOString(),
              enhanceId
            }
          }) + '\n'));

          console.log(`📊 [AIEnhance] [${enhanceId}] Enhancement complete:`, summary);

        } catch (streamError) {
          console.error(`❌ [AIEnhance] [${enhanceId}] Stream error:`, streamError);
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
    console.error(`❌ [AIEnhance] [${enhanceId}] Enhanced streaming mode error:`, error);
    return NextResponse.json({ error: 'Streaming failed' }, { status: 500 });
  }
}

/**
 * Handle batch mode with separated cost tracking
 */
async function handleBatchModeWithSeparatedTracking(model, originalQuery, contacts, modelName, userId, trackCosts, enhanceId) {
  console.log(`📦 [AIEnhance] [${enhanceId}] Starting batch mode with separated tracking`);
  
  let totalCosts = 0;
  let totalApiCalls = 0;
  let successfulRuns = 0;
  let filteredContacts = 0;
  const results = [];
  
  try {
    // Process each contact individually (not in parallel to maintain cost tracking accuracy)
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      try {
        console.log(`🔍 [AIEnhance] [${enhanceId}] Processing contact ${i + 1}/${contacts.length}: ${contact.name}`);
        
        // Generate prompt and call Gemini
        const prompt = generateSimilarityAwarePrompt(originalQuery, contact);
        const result = await model.generateContent(prompt);
        
        // Calculate cost for this API call
        const usage = result.response.usageMetadata;
        const inputTokens = usage?.promptTokenCount || 0;
        const outputTokens = usage?.candidatesTokenCount || 0;
        
        const modelPrices = GEMINI_PRICING[modelName];
        const apiCallCost = (inputTokens / 1000000) * modelPrices.inputPricePerMillionTokens +
                           (outputTokens / 1000000) * modelPrices.outputPricePerMillionTokens;
        
        totalCosts += apiCallCost;
        totalApiCalls++;
        
        // Record the API call cost (always billable)
        if (trackCosts) {
          await CostTrackingService.recordSeparatedUsage(
            userId,
            apiCallCost,
            modelName,
            'ai_contact_analysis',
            {
              contactId: contact.id,
              contactName: contact.name,
              inputTokens,
              outputTokens,
              enhanceId,
              contactIndex: i
            },
            'api_call'
          );
        }
        
        // Parse and analyze the response
        const response = await result.response;
        const rawText = response.text();
        const jsonString = cleanJsonString(rawText);
        
        let analysis;
        try {
          analysis = JSON.parse(jsonString);
        } catch (parseError) {
          console.error(`❌ [AIEnhance] [${enhanceId}] JSON parse failed for ${contact.name}:`, parseError);
          filteredContacts++;
          continue;
        }

        if (!analysis.explanation || !analysis.factors || !analysis.suggestions || !analysis.confidence) {
          console.error(`❌ [AIEnhance] [${enhanceId}] Invalid response structure for ${contact.name}`);
          filteredContacts++;
          continue;
        }

        const confidenceThreshold = getConfidenceThreshold(contact.similarityTier);
        
        if (analysis.confidence >= confidenceThreshold) {
          // This is a successful run - counts toward AI run limits
          successfulRuns++;
          
          if (trackCosts) {
            await CostTrackingService.recordSeparatedUsage(
              userId,
              0, // No additional cost for successful run tracking
              modelName,
              'ai_enhancement_success',
              {
                contactId: contact.id,
                contactName: contact.name,
                confidence: analysis.confidence,
                threshold: confidenceThreshold,
                enhanceId,
                contactIndex: i
              },
              'successful_run'
            );
          }
          
          results.push({
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
            },
            billing: {
              apiCallCost,
              countsAsRun: true,
              contactIndex: i
            }
          });
          
          console.log(`✅ [AIEnhance] [${enhanceId}] Successful run for ${contact.name}: confidence ${analysis.confidence}/${confidenceThreshold}`);
          
        } else {
          // Low confidence - API call was paid for but doesn't count as successful run
          filteredContacts++;
          console.log(`🚫 [AIEnhance] [${enhanceId}] Contact filtered (paid but not counted): ${contact.name} - confidence ${analysis.confidence}/${confidenceThreshold}`);
        }
        
      } catch (error) {
        console.error(`❌ [AIEnhance] [${enhanceId}] Error processing ${contact.name}:`, error);
        // API call might have failed, so we don't increment costs
      }
    }

    const summary = {
      totalContactsProcessed: contacts.length,
      totalApiCalls,
      successfulRuns,
      filteredContacts,
      totalCosts,
      apiCallEfficiency: totalApiCalls > 0 ? (successfulRuns / totalApiCalls * 100).toFixed(1) + '%' : '0%',
      averageCostPerApiCall: totalApiCalls > 0 ? (totalCosts / totalApiCalls).toFixed(6) : '0',
      averageCostPerSuccessfulRun: successfulRuns > 0 ? (totalCosts / successfulRuns).toFixed(6) : '0'
    };

    console.log(`📊 [AIEnhance] [${enhanceId}] Batch enhancement complete:`, summary);

    const responseData = {
      insights: results,
      billing: summary,
      costs: trackCosts ? { aiEnhancement: totalCosts } : undefined,
      metadata: {
        originalQuery,
        contactsAnalyzed: contacts.length,
        insightsGenerated: results.length,
        filteredLowConfidence: filteredContacts,
        model: modelName,
        timestamp: new Date().toISOString(),
        enhanceId
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error(`❌ [AIEnhance] [${enhanceId}] Batch mode error:`, error);
    return NextResponse.json({
      insights: [],
      costs: trackCosts ? { aiEnhancement: 0 } : undefined,
      error: 'AI analysis temporarily unavailable',
      metadata: {
        originalQuery,
        contactsAnalyzed: contacts.length,
        insightsGenerated: 0,
        error: error.message,
        timestamp: new Date().toISOString(),
        enhanceId
      }
    });
  }
}