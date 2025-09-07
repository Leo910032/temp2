// app/api/user/contacts/ai-enhance-results/route.js - WITH ADVANCED LOGGING
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AdvancedLogger, GeminiLogger, FlowLogger } from '@/lib/services/logging/advancedLogger';

// Initialize Gemini for the "Researcher" job
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Accurate Pricing Structure ---
const GEMINI_PRICING = {
  'gemini-2.5-flash': {
    inputPricePerMillionTokens: 0.30,
    outputPricePerMillionTokens:  2.50,
    longContextInputPrice: 0.30,
    longContextOutputPrice: 2.50,
  },
  'gemini-2.5-pro': {
    inputPricePerMillionTokens: 1.25,
    outputPricePerMillionTokens: 10.00,
    longContextInputPrice: 2.50,
    longContextOutputPrice: 15.00,
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
  // Initialize flow logger for this entire request
  const flowLogger = new FlowLogger('ai_enhance_results');
  
  try {
    AdvancedLogger.info('API', 'ai_enhance_start', {
      endpoint: '/api/user/contacts/ai-enhance-results',
      method: 'POST'
    });

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
    
    flowLogger.logStep('auth_success', {
      userId,
      userEmail: decodedToken.email,
      authProvider: decodedToken.firebase?.sign_in_provider
    });

    AdvancedLogger.info('API', 'user_authenticated', {
      userId,
      email: decodedToken.email
    });

    // 2. Parse request body
    flowLogger.logStep('parse_request', { message: 'Parsing request body' });
    
    const { originalQuery, contacts, trackCosts = false } = await request.json();
    
    flowLogger.logStep('request_parsed', {
      originalQuery: originalQuery?.substring(0, 100) + (originalQuery?.length > 100 ? '...' : ''),
      contactsCount: contacts?.length,
      trackCosts,
      queryLength: originalQuery?.length
    });

    if (!originalQuery || !contacts || !Array.isArray(contacts)) {
      const error = new Error('Original query and contacts array are required');
      flowLogger.logError('validation_failed', error);
      return NextResponse.json({ 
        error: 'Original query and contacts array are required' 
      }, { status: 400 });
    }

    if (contacts.length === 0) {
      flowLogger.logStep('empty_contacts', { message: 'No contacts to process' });
      return NextResponse.json({ insights: [] });
    }

    // 3. Get user's subscription from the database
    flowLogger.logStep('fetch_subscription', { message: 'Fetching user subscription data' });
    
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) {
      const error = new Error('User not found in database');
      flowLogger.logError('user_not_found', error);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';

    flowLogger.logStep('subscription_fetched', {
      subscriptionLevel,
      hasAccountType: !!userData.accountType,
      userDataKeys: Object.keys(userData)
    });

    // 4. Check if user has AI Researcher access
    if (!['business', 'enterprise'].includes(subscriptionLevel)) {
      const error = new Error('Insufficient subscription level for AI enhancement');
      flowLogger.logError('insufficient_subscription', error, { 
        required: ['business', 'enterprise'],
        actual: subscriptionLevel 
      });
      return NextResponse.json({ 
        error: 'AI result enhancement requires Business subscription or higher',
        requiredFeature: 'BUSINESS_AI_SEARCH'
      }, { status: 403 });
    }

    // 5. Initialize cost tracking
    const startTime = Date.now();
    let totalCosts = {
      aiEnhancement: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0
    };

    flowLogger.logStep('cost_tracking_init', {
      trackCosts,
      subscriptionLevel,
      startTime
    });

    // 6. Use Gemini to analyze and synthesize the results
    try {
      const modelName = subscriptionLevel === 'enterprise' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
      
      flowLogger.logStep('model_selected', {
        modelName,
        subscriptionLevel,
        tierMapping: { enterprise: 'gemini-2.5-pro', business: 'gemini-2.5-flash' }
      });

      AdvancedLogger.info('AI', 'gemini_model_init', {
        modelName,
        subscriptionLevel,
        contactsToAnalyze: contacts.length
      });

      // Process each contact with detailed logging
      const insights = await Promise.all(
        contacts.map((contact, index) => 
          analyzeContactMatch(model, originalQuery, contact, totalCosts, modelName, flowLogger, index)
        )
      );

      flowLogger.logStep('analysis_complete', {
        totalInsights: insights.length,
        successfulAnalyses: insights.filter(i => i !== null).length,
        failedAnalyses: insights.filter(i => i === null).length
      });

      // --- CONFIDENCE FILTER LOGIC ---
      const validInsights = insights.filter(insight => {
        if (insight === null) return false;
        
        if (insight.confidence < 7) {
          AdvancedLogger.debug('AI', 'low_confidence_filter', {
            contactId: insight.contactId,
            confidence: insight.confidence,
            threshold: 7,
            modelName
          });
          return false;
        }
        
        return true;
      });

      flowLogger.logStep('confidence_filtering', {
        totalInsights: insights.length,
        validInsights: validInsights.length,
        filteredOut: insights.length - validInsights.length,
        confidenceThreshold: 7
      });

      // --- DYNAMIC COST CALCULATION ---
      if (trackCosts && totalCosts.totalTokensInput > 0) {
        const modelPrices = GEMINI_PRICING[modelName];
        if (modelPrices) {
          const isLongContext = totalCosts.totalTokensInput > 200000;
          const inputPrice = isLongContext ? modelPrices.longContextInputPrice : modelPrices.inputPricePerMillionTokens;
          const outputPrice = isLongContext ? modelPrices.longContextOutputPrice : modelPrices.outputPricePerMillionTokens;
          const inputCost = (totalCosts.totalTokensInput / 1000000) * inputPrice;
          const outputCost = (totalCosts.totalTokensOutput / 1000000) * outputPrice;
          totalCosts.aiEnhancement = inputCost + outputCost;
          
          flowLogger.logStep('cost_calculation', {
            modelName,
            isLongContext,
            inputTokens: totalCosts.totalTokensInput,
            outputTokens: totalCosts.totalTokensOutput,
            inputCost,
            outputCost,
            totalCost: totalCosts.aiEnhancement,
            pricing: { inputPrice, outputPrice }
          });

          AdvancedLogger.info('Cost', 'ai_enhancement_cost', {
            modelName,
            inputTokens: totalCosts.totalTokensInput,
            outputTokens: totalCosts.totalTokensOutput,
            inputCost,
            outputCost,
            totalCost: totalCosts.aiEnhancement
          });
        } else {
          AdvancedLogger.warn('Cost', 'pricing_not_found', {
            modelName,
            availableModels: Object.keys(GEMINI_PRICING)
          });
          totalCosts.aiEnhancement = 0;
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
          confidenceThreshold: 7,
          model: modelName,
          tier: subscriptionLevel,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };

      flowLogger.complete({
        success: true,
        insightsGenerated: validInsights.length,
        totalCost: totalCosts.aiEnhancement,
        duration: Date.now() - startTime
      });

      AdvancedLogger.info('API', 'ai_enhance_success', {
        insightsGenerated: validInsights.length,
        totalCost: totalCosts.aiEnhancement,
        duration: Date.now() - startTime,
        userId
      });

      return NextResponse.json(responseData);

    } catch (aiError) {
      flowLogger.logError('ai_analysis_failed', aiError, {
        modelName: subscriptionLevel === 'enterprise' ? 'gemini-2.5-pro' : 'gemini-2.5-flash',
        contactsCount: contacts.length
      });

      AdvancedLogger.error('AI', 'analysis_failed', {
        error: aiError.message,
        stack: aiError.stack,
        contactsCount: contacts.length,
        userId
      });

      return NextResponse.json({
        insights: [],
        costs: trackCosts ? { aiEnhancement: 0 } : undefined,
        error: 'AI analysis temporarily unavailable',
        metadata: {
          originalQuery,
          contactsAnalyzed: contacts.length,
          insightsGenerated: 0,
          error: aiError.message,
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    flowLogger.logError('api_error', error);
    
    AdvancedLogger.error('API', 'ai_enhance_error', {
      error: error.message,
      stack: error.stack,
      code: error.code
    });

    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json({ error: 'Authentication expired. Please sign in again.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Analyze why a specific contact matches the search query with detailed logging
 */
async function analyzeContactMatch(model, query, contact, costTracker, modelName, flowLogger, contactIndex) {
  const contactLogger = new FlowLogger(`analyze_contact_${contactIndex}`, contact.id);
  
  try {
    contactLogger.logStep('analysis_start', {
      contactName: contact.name,
      contactId: contact.id,
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      modelName
    });

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
}

`;
    
    contactLogger.logStep('prompt_prepared', {
      promptLength: prompt.length,
      promptWordCount: prompt.split(' ').length,
      contactFields: {
        hasName: !!contact.name,
        hasEmail: !!contact.email,
        hasCompany: !!contact.company,
        hasNotes: !!contact.notes,
        hasMessage: !!contact.message,
        hasVectorScore: !!contact.vectorScore
      }
    });

    AdvancedLogger.debug('Gemini', 'contact_analysis_request', {
      contactId: contact.id,
      contactName: contact.name,
      promptLength: prompt.length,
      modelName
    });

    // Log the Gemini request
    const geminiRequestId = await GeminiLogger.logRequest(
      modelName, 
      prompt, 
      { pending: true }, 
      { contactId: contact.id, contactIndex }
    );

    contactLogger.logStep('gemini_request_sent', {
      geminiRequestId,
      modelName
    });

    const result = await model.generateContent(prompt);
    
    contactLogger.logStep('gemini_response_received', {
      hasResponse: !!result.response,
      hasUsageMetadata: !!result.response?.usageMetadata
    });

    // Log token usage
    if (result.response.usageMetadata && costTracker) {
      const usage = result.response.usageMetadata;
      costTracker.totalTokensInput += usage.promptTokenCount || 0;
      costTracker.totalTokensOutput += usage.candidatesTokenCount || 0;
      
      contactLogger.logStep('token_usage_tracked', {
        promptTokens: usage.promptTokenCount,
        outputTokens: usage.candidatesTokenCount,
        totalInput: costTracker.totalTokensInput,
        totalOutput: costTracker.totalTokensOutput
      });

      AdvancedLogger.debug('Cost', 'token_usage', {
        contactId: contact.id,
        modelName,
        promptTokens: usage.promptTokenCount,
        outputTokens: usage.candidatesTokenCount,
        runningTotalInput: costTracker.totalTokensInput,
        runningTotalOutput: costTracker.totalTokensOutput
      });
    }
    
    const response = await result.response;
    const rawText = response.text();
    
    contactLogger.logStep('response_text_extracted', {
      responseLength: rawText.length,
      responsePreview: rawText.substring(0, 200000) + (rawText.length > 20000000 ? '...' : '')
    });

    // Log the complete Gemini interaction
    await GeminiLogger.logRequest(
      modelName, 
      prompt, 
      result, 
      { contactId: contact.id, contactIndex, stage: 'complete' }
    );

    const jsonString = cleanJsonString(rawText);
    
    contactLogger.logStep('json_extraction', {
      originalLength: rawText.length,
      extractedLength: jsonString.length,
      extractionNeeded: rawText !== jsonString
    });

    let analysis;
    try {
      analysis = JSON.parse(jsonString);
     // ✅ FIX: Added the full `explanation` to your existing log structure.
      contactLogger.logStep('json_parsed', {
        hasExplanation: !!analysis.explanation,
        explanation: analysis.explanation, // Log the full explanation text
        hasFactors: !!analysis.factors,
        hasSuggestions: !!analysis.suggestions,
        hasConfidence: !!analysis.confidence,
        factors: analysis.factors,           // Log the full array
        suggestions: analysis.suggestions, // Log the full array
        confidence: analysis.confidence
      });
    } catch (parseError) {
      contactLogger.logError('json_parse_failed', parseError, {
        rawText: rawText.substring(0, 500),
        cleanedJson: jsonString.substring(0, 500)
      });
      throw parseError;
    }

    if (!analysis.explanation || !analysis.factors || !analysis.suggestions || !analysis.confidence) {
      const error = new Error('Invalid AI response structure');
      contactLogger.logError('invalid_response_structure', error, {
        hasExplanation: !!analysis.explanation,
        hasFactors: !!analysis.factors,
        hasSuggestions: !!analysis.suggestions,
        hasConfidence: !!analysis.confidence
      });
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
      confidence: analysis.confidence,
      factorsCount: analysis.factors.length,
      suggestionsCount: analysis.suggestions.length
    });

    AdvancedLogger.info('AI', 'contact_analysis_success', {
      contactId: contact.id,
      contactName: contact.name,
      confidence: analysis.confidence,
      modelName
    });

    return finalResult;

  } catch (error) {
    contactLogger.logError('analysis_failed', error);
    
    AdvancedLogger.error('AI', 'contact_analysis_failed', {
      contactId: contact.id,
      contactName: contact.name,
      error: error.message,
      modelName
    });
    
    return null;
  }
}