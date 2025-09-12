// app/api/user/contacts/ai-enhance-results/route.js - UPDATED WITH STRATEGIC QUESTIONS
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

// ====================================================================
// MODIFICATION #1: Create a helper function for language instructions
// ====================================================================
function getLanguageInstruction(languageCode = 'en') {
  switch (languageCode.toLowerCase()) {
    case 'fr':
      return "FORMATEZ VOTRE RÉPONSE EN FRANÇAIS.";
    case 'es':
      return "FORMATEA TU RESPUESTA EN ESPAÑOL.";
    case 'vm': // Assuming 'vm' is for Vietnamese
      return "ĐỊNH DẠNG PHẢN HỒI CỦA BẠN BẰNG TIẾNG VIỆT.";
    case 'zh':
      return "请用中文格式化您的回答。";
    case 'en':
    default:
      return "FORMAT YOUR RESPONSE IN ENGLISH.";
  }
}

/**
 * Generate enhanced prompt with strategic questions instead of generic suggestions
 */
function generateSimilarityAwarePrompt(query, contact, queryLanguage = 'en') {
    if (contact.dynamicFields && contact.dynamicFields.length > 0) {
    console.log(`🤖 [AIEnhance] Contact ${contact.name} has ${contact.dynamicFields.length} dynamic fields:`, 
      contact.dynamicFields.map(f => `${f.label}: ${f.value}`));
  }
  const vectorScore = contact.vectorScore || contact._vectorScore || 0;
  const rerankScore = contact.rerankScore;
  const similarityTier = contact.similarityTier || 'unknown';
  const similarityExplanation = contact.similarityExplanation || `${(vectorScore * 100).toFixed(1)}% semantic similarity`;

  let contextualGuidance = '';
  let rerankContext = ''; 
 
  // Build rerank context if available
  if (rerankScore !== undefined && rerankScore !== null) {
    const rerankPercentage = (rerankScore * 100).toFixed(1);
    rerankContext = `This contact was also processed through advanced reranking with a score of ${rerankPercentage}%, indicating ${
      rerankScore >= 0.8 ? 'very high' : 
      rerankScore >= 0.6 ? 'high' : 
      rerankScore >= 0.4 ? 'moderate' : 'lower'
    } relevance when the query and contact details are analyzed together.`;
  }
  
  switch (similarityTier) {
    case 'high':
      contextualGuidance = `This contact has HIGH semantic similarity to your query (${similarityExplanation}). ${rerankContext} Focus on validating and exploring their specific expertise level, recent experience, and practical skills.`;
      break;
    case 'medium':
      contextualGuidance = `This contact has MODERATE semantic similarity to your query (${similarityExplanation}). ${rerankContext} Look for transferable skills, related experience, or potential for growth in this area.`;
      break;
    case 'low':
      contextualGuidance = `This contact has LOWER semantic similarity to your query (${similarityExplanation}). ${rerankContext} Examine if they have any indirect experience, related background, or valuable network connections.`;
      break;
    default:
      contextualGuidance = `Analyze this contact's relevance to your query with their semantic similarity context. ${rerankContext}`;
  }

  const outputLanguageInstruction = getLanguageInstruction(queryLanguage);

  return `
You are an AI networking assistant analyzing why a contact matches a search query.

SEARCH QUERY: "${query}"

VECTOR & RERANK SIMILARITY CONTEXT: ${contextualGuidance}

CONTACT INFORMATION:
- Name: ${contact.name || 'Unknown'}
- Email: ${contact.email || 'Not provided'}
- Company: ${contact.company || 'Not provided'}
- Job Title: ${contact.jobTitle || 'Not provided'}
- Phone: ${contact.phone || 'Not provided'}
- Website: ${contact.website || 'Not provided'}
- Notes: ${contact.notes || 'No notes available'}
- Message: ${contact.message || 'No message'}
${contact.dynamicFields && contact.dynamicFields.length > 0 ? 
  contact.dynamicFields.map(field => `- ${field.label}: ${field.value || 'Not provided'}`).join('\n') + '\n' : 
  ''}
- Vector Similarity: ${similarityExplanation}
- Similarity Tier: ${similarityTier.toUpperCase()}
${rerankScore !== undefined ? `- Rerank Score: ${(rerankScore * 100).toFixed(1)}%` : ''}

ANALYSIS INSTRUCTIONS:
Given the ${similarityTier} semantic similarity${rerankScore !== undefined ? ' and rerank score' : ''}, provide:

1. MATCH EXPLANATION (2-3 sentences): Explain why this contact is relevant, considering both the semantic similarity${rerankScore !== undefined ? ', rerank score,' : ''} and specific details.

2. RELEVANCE FACTORS (3-5 bullet points): List specific factors that make this contact relevant, weighing semantic indicators, ${rerankScore !== undefined ? 'rerank analysis, ' : ''}and concrete evidence.

3. STRATEGIC QUESTIONS (3 questions): Instead of generic suggestions, generate 3 strategic research questions that could be answered through web searches to create perfect conversation starters with this contact. Focus on:
   - Recent company/industry developments
   - Professional achievements or changes  
   - Current market trends affecting their role

4. CONFIDENCE SCORE (1-10): Rate your confidence that this contact matches what the user seeks, considering:
   - High similarity contacts${rerankScore !== undefined ? ' with high rerank scores' : ''}: Start with baseline 7-8 confidence, adjust based on specifics
   - Medium similarity contacts${rerankScore !== undefined ? ' with moderate rerank scores' : ''}: Start with baseline 5-6 confidence, adjust based on evidence
   - Low similarity contacts${rerankScore !== undefined ? ' with lower rerank scores' : ''}: Start with baseline 3-4 confidence, require strong evidence to score higher
   ${rerankScore !== undefined ? '- Factor in the rerank score as validation of the vector similarity assessment' : ''}

${outputLanguageInstruction}

FORMAT YOUR RESPONSE AS JSON:
{
  "explanation": "...",
  "factors": ["...", "...", "..."],
  "strategicQuestions": [
    {
      "question": "What recent announcements has [Company] made?",
      "searchQuery": "[Company] recent news announcements 2024",
      "category": "company_updates"
    },
    {
      "question": "What are the latest trends in [Industry/Role]?", 
      "searchQuery": "[Industry] trends 2024 [Role]",
      "category": "industry_trends"
    },
    {
      "question": "Has [Name] been mentioned in recent industry news?",
      "searchQuery": "[Name] [Company] recent news",
      "category": "personal_updates"
    }
  ],
  "confidence": 8
}`;
}

/**
 * Get confidence threshold based on similarity tier
 */
function getConfidenceThreshold(similarityTier) {
  switch (similarityTier) {
    case 'high': return 5;    // Lower threshold for high similarity
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
  console.log(`🤖 [AIEnhance] [${enhanceId}] Starting AI enhancement request with strategic questions`);
  
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
      vectorOptimized = false,
      queryLanguage = 'en'
    } = await request.json();
    
    console.log(`📝 [AIEnhance] [${enhanceId}] Request params:`, {
      queryLength: originalQuery?.length,
      contactsCount: contacts?.length,
      trackCosts,
      mode,
      processingStrategy,
      vectorOptimized,
      queryLanguage
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
      const avgResponseLength = 400; // Estimated average response length (longer for strategic questions)
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
        { processingStrategy, vectorOptimized },
        queryLanguage
      );
    }

    // 7. Handle batch mode with separated cost tracking
    return handleBatchModeWithSeparatedTracking(model, originalQuery, contacts, modelName, userId, trackCosts, enhanceId, queryLanguage);

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
 * Enhanced streaming mode with separated cost tracking and strategic questions
 */
async function handleEnhancedStreamingModeWithSeparatedTracking(model, originalQuery, contacts, modelName, userId, trackCosts, enhanceId, options = {}, queryLanguage = 'en') {
  const { processingStrategy = 'standard', vectorOptimized = false } = options;
  
  try {
    console.log(`🔄 [AIEnhance] [${enhanceId}] Starting enhanced streaming mode with strategic questions`);
    
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
              const prompt = generateSimilarityAwarePrompt(originalQuery, contact, queryLanguage);
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
                  'ai_contact_analysis_strategic',
                  {
                    contactId: contact.id,
                    contactName: contact.name,
                    inputTokens,
                    outputTokens,
                    enhanceId,
                    contactIndex: i,
                    feature: 'strategic_questions'
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

              // Updated validation for strategic questions
              if (!analysis.explanation || !analysis.factors || !analysis.strategicQuestions || !analysis.confidence) {
                console.error(`❌ [AIEnhance] [${enhanceId}] Invalid response structure for ${contact.name}`);
                filteredContacts++;
                continue;
              }

              // Validate strategic questions format
              if (!Array.isArray(analysis.strategicQuestions) || analysis.strategicQuestions.length !== 3) {
                console.error(`❌ [AIEnhance] [${enhanceId}] Invalid strategic questions format for ${contact.name}`);
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
                    'ai_enhancement_strategic_success',
                    {
                      contactId: contact.id,
                      contactName: contact.name,
                      confidence: analysis.confidence,
                      threshold: confidenceThreshold,
                      enhanceId,
                      contactIndex: i,
                      strategicQuestionsCount: analysis.strategicQuestions.length
                    },
                    'successful_run' // This counts toward run limits
                  );
                }

                const insight = {
                  contactId: contact.id,
                  explanation: analysis.explanation,
                  factors: analysis.factors,
                  strategicQuestions: analysis.strategicQuestions, // NEW: Store strategic questions
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
                  hybridScore: calculateHybridScore(contact.vectorScore || contact._vectorScore, analysis.confidence),
                  hasStrategicQuestions: true
                }) + '\n'));
                
                console.log(`✅ [AIEnhance] [${enhanceId}] Successful run recorded for ${contact.name}: confidence ${analysis.confidence}/${confidenceThreshold} with ${analysis.strategicQuestions.length} strategic questions`);
                
              } else {
                // Low confidence - API call was paid for but doesn't count as successful run
                filteredContacts++;
                console.log(`🚫 [AIEnhance] [${enhanceId}] Contact filtered (paid but not counted): ${contact.name} - confidence ${analysis.confidence}/${confidenceThreshold}`);
                
                // Send filtered result
              // Send filtered result
   // Send filtered result
controller.enqueue(new TextEncoder().encode(JSON.stringify({
    type: 'filtered',
    contactIndex: i,
    // ==========================================================
    // ✅ THE FIX IS HERE: Add the contactId to the payload
    // ==========================================================
    contactId: contact.id, 
    contactName: contact.name,
    reason: `Low confidence (${analysis.confidence}/${confidenceThreshold} required for ${contact.similarityTier || 'unknown'} similarity)`,
    confidence: analysis.confidence,
    threshold: confidenceThreshold, 
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
            averageCostPerSuccessfulRun: successfulRuns > 0 ? (totalCosts / successfulRuns).toFixed(6) : '0',
            strategicQuestionsGenerated: processedInsights.reduce((sum, insight) => sum + (insight.strategicQuestions?.length || 0), 0)
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
              similarityBreakdown: getSimilarityBreakdown(contactsToProcess, processedInsights),
              feature: 'strategic_questions'
            },
            metadata: {
              originalQuery,
              model: modelName,
              timestamp: new Date().toISOString(),
              enhanceId
            }
          }) + '\n'));

          console.log(`📊 [AIEnhance] [${enhanceId}] Enhancement complete with strategic questions:`, summary);

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
 * Handle batch mode with separated cost tracking and strategic questions
 */
async function handleBatchModeWithSeparatedTracking(model, originalQuery, contacts, modelName, userId, trackCosts, enhanceId, queryLanguage = 'en') {
  console.log(`📦 [AIEnhance] [${enhanceId}] Starting batch mode with strategic questions`);
  
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
        const prompt = generateSimilarityAwarePrompt(originalQuery, contact, queryLanguage);
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
            'ai_contact_analysis_strategic',
            {
              contactId: contact.id,
              contactName: contact.name,
              inputTokens,
              outputTokens,
              enhanceId,
              contactIndex: i,
              feature: 'strategic_questions'
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

        // Updated validation for strategic questions
        if (!analysis.explanation || !analysis.factors || !analysis.strategicQuestions || !analysis.confidence) {
          console.error(`❌ [AIEnhance] [${enhanceId}] Invalid response structure for ${contact.name}`);
          filteredContacts++;
          continue;
        }

        // Validate strategic questions format
        if (!Array.isArray(analysis.strategicQuestions) || analysis.strategicQuestions.length !== 3) {
          console.error(`❌ [AIEnhance] [${enhanceId}] Invalid strategic questions format for ${contact.name}`);
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
              'ai_enhancement_strategic_success',
              {
                contactId: contact.id,
                contactName: contact.name,
                confidence: analysis.confidence,
                threshold: confidenceThreshold,
                enhanceId,
                contactIndex: i,
                strategicQuestionsCount: analysis.strategicQuestions.length
              },
              'successful_run'
            );
          }
          
          results.push({
            contactId: contact.id,
            explanation: analysis.explanation,
            factors: analysis.factors,
            strategicQuestions: analysis.strategicQuestions, // NEW: Store strategic questions
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
          
          console.log(`✅ [AIEnhance] [${enhanceId}] Successful run for ${contact.name}: confidence ${analysis.confidence}/${confidenceThreshold} with ${analysis.strategicQuestions.length} strategic questions`);
          
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
      averageCostPerSuccessfulRun: successfulRuns > 0 ? (totalCosts / successfulRuns).toFixed(6) : '0',
      strategicQuestionsGenerated: results.reduce((sum, result) => sum + (result.strategicQuestions?.length || 0), 0)
    };

    console.log(`📊 [AIEnhance] [${enhanceId}] Batch enhancement complete with strategic questions:`, summary);

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
        enhanceId,
        feature: 'strategic_questions'
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
        enhanceId,
        feature: 'strategic_questions'
      }
    });
  }
}