// lib/services/serviceContact/server/aiEnhanceService.js
// Server-side service for AI-powered contact enhancement
// Handles Gemini API calls for contact analysis with strategic questions

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_PRICING } from '@/lib/services/constants/aiCosts';
import { AI_CONFIDENCE_THRESHOLDS } from '@/lib/services/serviceContact/client/constants/contactConstants';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * AIEnhanceService
 *
 * Architecture:
 * - Generates prompts based on similarity context
 * - Calls Gemini API (Flash or Pro based on subscription)
 * - Analyzes contacts and generates strategic questions
 * - Returns insights with confidence scores
 * - Supports both batch and streaming modes
 */
export class AIEnhanceService {
  /**
   * Enhance search results with AI analysis (Batch mode)
   *
   * @param {string} query - Original search query
   * @param {Array} contacts - Array of contacts to enhance
   * @param {object} options - Enhancement options
   * @returns {Promise<object>} Enhanced results with insights
   */
  static async enhanceResults(query, contacts, options = {}) {
    const {
      subscriptionLevel = 'business',
      queryLanguage = 'en',
      enhanceId = `enhance_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
    } = options;

    console.log(`🤖 [AIEnhanceService] [${enhanceId}] Starting batch enhancement`);

    const modelName = subscriptionLevel === 'enterprise' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    let totalCosts = 0;
    let totalApiCalls = 0;
    let successfulRuns = 0;
    let filteredContacts = 0;
    const results = [];

    try {
      // Process each contact individually
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];

        try {
          console.log(`🔍 [AIEnhanceService] [${enhanceId}] Processing ${i + 1}/${contacts.length}: ${contact.name}`);

          // Generate prompt
          const prompt = this._generateSimilarityAwarePrompt(query, contact, queryLanguage);

          // Call Gemini
          const result = await model.generateContent(prompt);

          // Calculate cost
          const usage = result.response.usageMetadata;
          const inputTokens = usage?.promptTokenCount || 0;
          const outputTokens = usage?.candidatesTokenCount || 0;

          const modelPrices = GEMINI_PRICING[modelName];
          const apiCallCost = (inputTokens / 1000000) * modelPrices.inputPricePerMillionTokens +
                             (outputTokens / 1000000) * modelPrices.outputPricePerMillionTokens;

          totalCosts += apiCallCost;
          totalApiCalls++;

          // Parse response
          const response = await result.response;
          const rawText = response.text();
          const jsonString = this._cleanJsonString(rawText);

          let analysis;
          try {
            analysis = JSON.parse(jsonString);
          } catch (parseError) {
            console.error(`❌ [AIEnhanceService] [${enhanceId}] JSON parse failed for ${contact.name}`);
            filteredContacts++;
            continue;
          }

          // Validate response structure
          if (!analysis.explanation || !analysis.factors || !analysis.strategicQuestions || !analysis.confidence) {
            console.error(`❌ [AIEnhanceService] [${enhanceId}] Invalid response structure for ${contact.name}`);
            filteredContacts++;
            continue;
          }

          // Validate strategic questions
          if (!Array.isArray(analysis.strategicQuestions) || analysis.strategicQuestions.length !== 3) {
            console.error(`❌ [AIEnhanceService] [${enhanceId}] Invalid strategic questions for ${contact.name}`);
            filteredContacts++;
            continue;
          }

          // Check confidence threshold
          const confidenceThreshold = this._getConfidenceThreshold(contact.similarityTier);

          if (analysis.confidence >= confidenceThreshold) {
            successfulRuns++;

            results.push({
              contactId: contact.id,
              explanation: analysis.explanation,
              factors: analysis.factors,
              strategicQuestions: analysis.strategicQuestions,
              confidence: analysis.confidence,
              analysisTimestamp: new Date().toISOString(),
              modelUsed: modelName,
              similarityContext: {
                tier: contact.similarityTier,
                vectorScore: contact.vectorScore || contact._vectorScore,
                hybridScore: this._calculateHybridScore(
                  contact.vectorScore || contact._vectorScore,
                  analysis.confidence
                )
              },
              billing: {
                apiCallCost,
                countsAsRun: true,
                contactIndex: i
              }
            });

            console.log(`✅ [AIEnhanceService] [${enhanceId}] Success: ${contact.name} (${analysis.confidence}/${confidenceThreshold})`);
          } else {
            filteredContacts++;
            console.log(`🚫 [AIEnhanceService] [${enhanceId}] Filtered: ${contact.name} (${analysis.confidence}/${confidenceThreshold})`);
          }

        } catch (error) {
          console.error(`❌ [AIEnhanceService] [${enhanceId}] Error processing ${contact.name}:`, error);
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

      console.log(`📊 [AIEnhanceService] [${enhanceId}] Batch complete:`, summary);

      return {
        insights: results,
        billing: summary,
        costs: { aiEnhancement: totalCosts },
        metadata: {
          originalQuery: query,
          contactsAnalyzed: contacts.length,
          insightsGenerated: results.length,
          filteredLowConfidence: filteredContacts,
          model: modelName,
          timestamp: new Date().toISOString(),
          enhanceId,
          feature: 'strategic_questions'
        }
      };

    } catch (error) {
      console.error(`❌ [AIEnhanceService] [${enhanceId}] Batch mode error:`, error);
      throw error;
    }
  }

  /**
   * Create a streaming response for AI enhancement
   *
   * @param {string} query - Original search query
   * @param {Array} contacts - Array of contacts to enhance
   * @param {object} options - Enhancement options
   * @returns {ReadableStream} Streaming response
   */
  static createStreamingResponse(query, contacts, options = {}) {
    const {
      subscriptionLevel = 'business',
      queryLanguage = 'en',
      vectorOptimized = false,
      enhanceId = `enhance_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
    } = options;

    console.log(`🔄 [AIEnhanceService] [${enhanceId}] Starting streaming mode`);

    const modelName = subscriptionLevel === 'enterprise' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    return new ReadableStream({
      start: async (controller) => {
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

          // Send start event
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            type: 'start',
            total: contactsToProcess.length,
            query,
            strategy: 'strategic_questions'
          }) + '\n'));

          // Process each contact
          for (let i = 0; i < contactsToProcess.length; i++) {
            const contact = contactsToProcess[i];

            try {
              // Send progress event
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
              const prompt = this._generateSimilarityAwarePrompt(query, contact, queryLanguage);
              const result = await model.generateContent(prompt);

              // Calculate cost
              const usage = result.response.usageMetadata;
              const inputTokens = usage?.promptTokenCount || 0;
              const outputTokens = usage?.candidatesTokenCount || 0;

              const modelPrices = GEMINI_PRICING[modelName];
              const apiCallCost = (inputTokens / 1000000) * modelPrices.inputPricePerMillionTokens +
                                 (outputTokens / 1000000) * modelPrices.outputPricePerMillionTokens;

              totalCosts += apiCallCost;
              totalApiCalls++;
              processedCount++;

              // Parse response
              const response = await result.response;
              const rawText = response.text();
              const jsonString = this._cleanJsonString(rawText);

              let analysis;
              try {
                analysis = JSON.parse(jsonString);
              } catch (parseError) {
                console.error(`❌ [AIEnhanceService] [${enhanceId}] JSON parse failed for ${contact.name}`);
                filteredContacts++;
                continue;
              }

              // Validate
              if (!analysis.explanation || !analysis.factors || !analysis.strategicQuestions || !analysis.confidence) {
                console.error(`❌ [AIEnhanceService] [${enhanceId}] Invalid structure for ${contact.name}`);
                filteredContacts++;
                continue;
              }

              if (!Array.isArray(analysis.strategicQuestions) || analysis.strategicQuestions.length !== 3) {
                console.error(`❌ [AIEnhanceService] [${enhanceId}] Invalid questions for ${contact.name}`);
                filteredContacts++;
                continue;
              }

              const confidenceThreshold = this._getConfidenceThreshold(contact.similarityTier);

              if (analysis.confidence >= confidenceThreshold) {
                successfulRuns++;

                const insight = {
                  contactId: contact.id,
                  explanation: analysis.explanation,
                  factors: analysis.factors,
                  strategicQuestions: analysis.strategicQuestions,
                  confidence: analysis.confidence,
                  analysisTimestamp: new Date().toISOString(),
                  modelUsed: modelName,
                  similarityContext: {
                    tier: contact.similarityTier,
                    vectorScore: contact.vectorScore || contact._vectorScore,
                    hybridScore: this._calculateHybridScore(
                      contact.vectorScore || contact._vectorScore,
                      analysis.confidence
                    )
                  },
                  billing: {
                    apiCallCost,
                    countsAsRun: true,
                    contactIndex: i
                  }
                };

                processedInsights.push(insight);

                // Send result event
                controller.enqueue(new TextEncoder().encode(JSON.stringify({
                  type: 'result',
                  insight,
                  contactIndex: i,
                  contactId: contact.id,
                  processed: processedCount,
                  total: contactsToProcess.length,
                  confidence: analysis.confidence,
                  similarityTier: contact.similarityTier,
                  hasStrategicQuestions: true
                }) + '\n'));

              } else {
                filteredContacts++;

                // Send filtered event
                controller.enqueue(new TextEncoder().encode(JSON.stringify({
                  type: 'filtered',
                  contactIndex: i,
                  contactId: contact.id,
                  contactName: contact.name,
                  reason: `Low confidence (${analysis.confidence}/${confidenceThreshold})`,
                  confidence: analysis.confidence,
                  threshold: confidenceThreshold,
                  processed: processedCount,
                  total: contactsToProcess.length
                }) + '\n'));
              }

              // Small delay to prevent overwhelming
              await new Promise(resolve => setTimeout(resolve, 100));

            } catch (contactError) {
              console.error(`❌ [AIEnhanceService] [${enhanceId}] Error: ${contact.name}`, contactError);

              // Send error event
              controller.enqueue(new TextEncoder().encode(JSON.stringify({
                type: 'error',
                contactIndex: i,
                contactId: contact.id,
                contactName: contact.name,
                error: contactError.message,
                processed: processedCount,
                total: contactsToProcess.length
              }) + '\n'));
            }
          }

          // Send complete event
          const summary = {
            totalContactsProcessed: contacts.length,
            totalApiCalls,
            successfulRuns,
            filteredContacts,
            totalCosts,
            apiCallEfficiency: totalApiCalls > 0 ? (successfulRuns / totalApiCalls * 100).toFixed(1) + '%' : '0%',
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
              costs: { aiEnhancement: totalCosts },
              feature: 'strategic_questions'
            },
            metadata: {
              originalQuery: query,
              model: modelName,
              timestamp: new Date().toISOString(),
              enhanceId
            }
          }) + '\n'));

          console.log(`📊 [AIEnhanceService] [${enhanceId}] Streaming complete:`, summary);

        } catch (streamError) {
          console.error(`❌ [AIEnhanceService] [${enhanceId}] Stream error:`, streamError);
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            type: 'stream_error',
            error: streamError.message
          }) + '\n'));
        } finally {
          controller.close();
        }
      }
    });
  }

  /**
   * Generate similarity-aware prompt with strategic questions
   * @private
   */
  static _generateSimilarityAwarePrompt(query, contact, queryLanguage = 'en') {
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

    const outputLanguageInstruction = this._getLanguageInstruction(queryLanguage);

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

3. STRATEGIC QUESTIONS (3 questions): Generate 3 strategic research questions that could be answered through web searches to create perfect conversation starters with this contact. Focus on:
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
   * Get language instruction for prompt
   * @private
   */
  static _getLanguageInstruction(languageCode = 'en') {
    switch (languageCode.toLowerCase()) {
      case 'fr':
        return "FORMATEZ VOTRE RÉPONSE EN FRANÇAIS.";
      case 'es':
        return "FORMATEA TU RESPUESTA EN ESPAÑOL.";
      case 'vm':
        return "ĐỊNH DẠNG PHẢN HỒI CỦA BẠN BẰNG TIẾNG VIỆT.";
      case 'zh':
        return "请用中文格式化您的回答。";
      case 'en':
      default:
        return "FORMAT YOUR RESPONSE IN ENGLISH.";
    }
  }

  /**
   * Clean JSON string from LLM response
   * @private
   */
  static _cleanJsonString(text) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      return text;
    }

    return text.substring(firstBrace, lastBrace + 1);
  }

  /**
   * Get confidence threshold based on similarity tier
   * @private
   */
  static _getConfidenceThreshold(similarityTier) {
    return AI_CONFIDENCE_THRESHOLDS[similarityTier] || AI_CONFIDENCE_THRESHOLDS.default;
  }

  /**
   * Calculate hybrid score
   * @private
   */
  static _calculateHybridScore(vectorScore, aiConfidence) {
    if (!vectorScore || !aiConfidence) return 0;

    const normalizedAI = aiConfidence / 10;
    const hybridScore = (vectorScore * 0.4) + (normalizedAI * 0.6);

    return Math.round(hybridScore * 1000) / 1000;
  }

  /**
   * Estimate cost for AI enhancement
   *
   * @param {number} contactCount - Number of contacts to enhance
   * @param {string} subscriptionLevel - User's subscription level
   * @returns {object} Cost estimate
   */
  static estimateCost(contactCount, subscriptionLevel = 'business') {
    const modelName = subscriptionLevel === 'enterprise' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const modelPrices = GEMINI_PRICING[modelName];

    const avgPromptLength = 1500; // Estimated average prompt length
    const avgResponseLength = 400; // Estimated average response length

    const estimatedInputTokens = contactCount * avgPromptLength;
    const estimatedOutputTokens = contactCount * avgResponseLength;

    const estimatedCost = (estimatedInputTokens / 1000000) * modelPrices.inputPricePerMillionTokens +
                         (estimatedOutputTokens / 1000000) * modelPrices.outputPricePerMillionTokens;

    return {
      contactCount,
      modelName,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCost
    };
  }
}
