// lib/services/serviceContact/server/queryEnhancementService.js
// Query enhancement service using Gemini 2.5 Flash Preview via Firebase AI Logic
// Handles query expansion, language detection, and intelligent caching

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { redisClient, generateCacheKey } from './redisClient';
import { CostTrackingService } from './costTrackingService';
import { GEMINI_PRICING } from '@/lib/services/constants/aiCosts';
import { COMMON_EXPANSIONS } from './data/commonExpansions';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

/**
 * QueryEnhancementService
 * 
 * Architecture:
 * - 3-tier caching: Static → Redis → Gemini AI
 * - Language detection for automatic rerank model selection
 * - Cost tracking with sessionId support
 * - Fallback to original query on errors
 * 
 * Flow:
 * 1. Check static cache (common terms)
 * 2. Check Redis cache (24h TTL)
 * 3. Call Gemini 2.5 Flash for enhancement
 * 4. Store in Redis for future use
 */
export class QueryEnhancementService {

  /**
   * Enhance a search query with AI-powered expansion and language detection
   * 
   * @param {string} originalQuery - Original user query
   * @param {object} options - Enhancement options
   * @returns {Promise<object>} Enhanced query with metadata
   */
  static async enhanceQuery(originalQuery, options = {}) {
    const {
      sessionId = null,
      userId = null,
      enhanceId = `enhance_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
    } = options;

    console.log(`🚀 [QueryEnhancement] [${enhanceId}] Starting query enhancement:`, {
      query: originalQuery.substring(0, 100),
      sessionId: sessionId || 'none',
      queryLength: originalQuery.length
    });

    const startTime = Date.now();

    try {
      // Step 1: Check static cache for exact matches
      console.log(`📦 [QueryEnhancement] [${enhanceId}] Step 1: Checking static cache...`);
      const staticResult = this._checkStaticCache(originalQuery);
      
      if (staticResult) {
        const duration = Date.now() - startTime;
        console.log(`✅ [QueryEnhancement] [${enhanceId}] ⚡ Static cache HIT (${duration}ms):`, {
          original: originalQuery,
          enhanced: staticResult.enhancedQuery.substring(0, 100),
          language: staticResult.language,
          cacheType: 'static'
        });

        return {
          originalQuery,
          enhancedQuery: staticResult.enhancedQuery,
          language: staticResult.language,
          metadata: {
            cached: true,
            cacheType: 'static',
            duration,
            enhanceId,
            sessionId
          }
        };
      }
      console.log(`   ⏭️ Static cache miss, checking Redis...`);

      // Step 2: Check Redis cache
      console.log(`📦 [QueryEnhancement] [${enhanceId}] Step 2: Checking Redis cache...`);
      const redisResult = await this._checkRedisCache(originalQuery, enhanceId);
      
      if (redisResult) {
        const duration = Date.now() - startTime;
        console.log(`✅ [QueryEnhancement] [${enhanceId}] ⚡ Redis cache HIT (${duration}ms):`, {
          original: originalQuery,
          enhanced: redisResult.enhancedQuery.substring(0, 100),
          language: redisResult.language,
          cacheType: 'redis',
          ttl: `${redisResult.ttl}s remaining`
        });

        return {
          originalQuery,
          enhancedQuery: redisResult.enhancedQuery,
          language: redisResult.language,
          metadata: {
            cached: true,
            cacheType: 'redis',
            ttl: redisResult.ttl,
            duration,
            enhanceId,
            sessionId
          }
        };
      }
      console.log(`   ⏭️ Redis cache miss, calling Gemini AI...`);

      // Step 3: Call Gemini 2.5 Flash for enhancement
      console.log(`🤖 [QueryEnhancement] [${enhanceId}] Step 3: Calling Gemini 2.5 Flash...`);
      const aiResult = await this._callGeminiEnhancement(originalQuery, enhanceId, sessionId, userId);

      // Step 4: Cache the result in Redis
      console.log(`💾 [QueryEnhancement] [${enhanceId}] Step 4: Caching result in Redis...`);
      await this._cacheInRedis(originalQuery, aiResult, enhanceId);

      const totalDuration = Date.now() - startTime;
      console.log(`✅ [QueryEnhancement] [${enhanceId}] Enhancement complete (${totalDuration}ms):`, {
        original: originalQuery,
        enhanced: aiResult.enhancedQuery.substring(0, 100),
        language: aiResult.language,
        cost: aiResult.cost,
        cacheType: 'none (fresh from AI)'
      });

      return {
        originalQuery,
        enhancedQuery: aiResult.enhancedQuery,
        language: aiResult.language,
        metadata: {
          cached: false,
          cacheType: 'ai',
          duration: totalDuration,
          cost: aiResult.cost,
          tokensUsed: aiResult.tokensUsed,
          enhanceId,
          sessionId
        }
      };

    } catch (error) {
      console.error(`❌ [QueryEnhancement] [${enhanceId}] Enhancement failed:`, {
        message: error.message,
        query: originalQuery
      });

      // Fallback: return original query with detected language
      const fallbackLanguage = this._detectLanguageFallback(originalQuery);
      
      console.log(`🔄 [QueryEnhancement] [${enhanceId}] Using fallback (original query):`, {
        language: fallbackLanguage,
        reason: error.message
      });

      return {
        originalQuery,
        enhancedQuery: originalQuery, // Use original as enhanced
        language: fallbackLanguage,
        metadata: {
          cached: false,
          cacheType: 'fallback',
          error: error.message,
          duration: Date.now() - startTime,
          enhanceId,
          sessionId
        }
      };
    }
  }

  /**
   * Check static cache for common terms
   * @private
   */
  static _checkStaticCache(query) {
    const normalizedQuery = query.trim().toLowerCase();
    
    // Exact match
    for (const [key, value] of Object.entries(COMMON_EXPANSIONS)) {
      if (normalizedQuery === key.toLowerCase()) {
        return value;
      }
    }
    
    // Check if query contains a cached term (for partial matches)
    // Example: "Senior CEO" would match "CEO"
    for (const [key, value] of Object.entries(COMMON_EXPANSIONS)) {
      if (normalizedQuery.includes(key.toLowerCase()) && key.length >= 3) {
        console.log(`   📌 Partial match found: "${key}" in "${query}"`);
        return value;
      }
    }
    
    return null;
  }

  /**
   * Check Redis cache
   * @private
   */
  static async _checkRedisCache(query, enhanceId) {
    try {
      const cacheKey = generateCacheKey('query_enhancement', query.trim().toLowerCase());
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        const ttl = await redisClient.ttl(cacheKey);
        return {
          ...cached,
          ttl
        };
      }
      
      return null;
    } catch (error) {
      console.warn(`⚠️ [QueryEnhancement] [${enhanceId}] Redis cache check failed:`, error.message);
      return null;
    }
  }

  /**
   * Call Gemini 2.5 Flash for query enhancement
   * @private
   */
  static async _callGeminiEnhancement(query, enhanceId, sessionId, userId) {
    const aiStartTime = Date.now();
    
    try {
      // Initialize Firebase AI with Developer API backend
      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_apiKey,
        authDomain: process.env.NEXT_PUBLIC_authDomain,
        projectId: process.env.NEXT_PUBLIC_projectId,
        storageBucket: process.env.NEXT_PUBLIC_storageBucket,
        messagingSenderId: process.env.NEXT_PUBLIC_messagingSenderId,
        appId: process.env.NEXT_PUBLIC_appId
      };
      
      // Initialize Firebase App (client SDK)
      const { initializeApp: initClientApp, getApps: getClientApps } = await import('firebase/app');
      const apps = getClientApps();
      const firebaseApp = apps.length > 0 ? apps[0] : initClientApp(firebaseConfig);
      
      // Initialize AI with Gemini Developer API backend
      const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
      
      // Create model
      const model = getGenerativeModel(ai, { model: 'gemini-2.0-flash' });

      // Build prompt
      const prompt = this._buildEnhancementPrompt(query);
      
      console.log(`   📝 Sending prompt to Gemini (${prompt.length} chars)`);
      
      // Call Gemini
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.enhancedQuery || !parsed.language) {
        throw new Error('Missing required fields in Gemini response');
      }

      // Estimate cost (Firebase AI doesn't provide usage metadata for Developer API)
      const estimatedInputTokens = Math.ceil(prompt.length / 4);
      const estimatedOutputTokens = Math.ceil(text.length / 4);
      
      const modelPrices = GEMINI_PRICING['gemini-2.5-flash'] || {
        inputPricePerMillionTokens: 0.075,
        outputPricePerMillionTokens: 0.30
      };
      
      const cost = (estimatedInputTokens / 1000000) * modelPrices.inputPricePerMillionTokens +
                   (estimatedOutputTokens / 1000000) * modelPrices.outputPricePerMillionTokens;

      const aiDuration = Date.now() - aiStartTime;
      
      console.log(`   ✅ Gemini response received (${aiDuration}ms):`, {
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        cost: cost.toFixed(6),
        language: parsed.language
      });

      // Track cost
      if (userId) {
        await CostTrackingService.recordUsage({
          userId,
          usageType: 'AIUsage',
          feature: 'query_enhancement',
          cost,
          isBillableRun: false,
          provider: 'gemini-2.5-flash',
          metadata: {
            inputTokens: estimatedInputTokens,
            outputTokens: estimatedOutputTokens,
            queryLength: query.length,
            enhanceId
          },
          sessionId,
          stepLabel: 'Query Enhancement'
        });
        
        console.log(`   💰 Cost tracked: $${cost.toFixed(6)} for user ${userId}`);
      }

      return {
        enhancedQuery: parsed.enhancedQuery,
        language: parsed.language,
        synonyms: parsed.synonyms || [],
        cost,
        tokensUsed: { 
          inputTokens: estimatedInputTokens, 
          outputTokens: estimatedOutputTokens 
        },
        duration: aiDuration
      };

    } catch (error) {
      console.error(`❌ [QueryEnhancement] [${enhanceId}] Gemini call failed:`, error.message);
      throw error;
    }
  }

  /**
   * Build enhancement prompt for Gemini
   * @private
   */
  static _buildEnhancementPrompt(query) {
    return `You are a query enhancement AI for a professional contact search system.

Your task: Enhance the search query with synonyms, related terms, and alternative phrasings to improve semantic search results. Also detect the language of the query.

ORIGINAL QUERY: "${query}"

INSTRUCTIONS:
1. Expand the query with relevant synonyms and related terms
2. Include abbreviations and full forms (e.g., "CEO" → "Chief Executive Officer, CEO, President")
3. Add common variations and related job titles/terms
4. Detect the query language (eng, fra, spa, deu, ita, por, etc.)
5. Keep the enhancement focused and relevant - don't add generic noise

EXAMPLES:
Input: "CEO startup Paris"
Output: {
  "enhancedQuery": "CEO, Chief Executive Officer, President, Founder, startup, Paris, entrepreneur, directeur général",
  "language": "eng",
  "synonyms": ["CEO", "Chief Executive Officer", "President", "Founder", "Directeur Général"]
}

Input: "ingénieur IA machine learning"
Output: {
  "enhancedQuery": "ingénieur, engineer, IA, AI, intelligence artificielle, artificial intelligence, machine learning, ML, apprentissage automatique, data scientist",
  "language": "fra",
  "synonyms": ["ingénieur", "engineer", "IA", "AI", "machine learning"]
}

Input: "founder fintech blockchain"
Output: {
  "enhancedQuery": "founder, co-founder, entrepreneur, fintech, financial technology, blockchain, crypto, cryptocurrency, web3, DeFi, startup",
  "language": "eng",
  "synonyms": ["founder", "entrepreneur", "fintech", "blockchain", "crypto"]
}

RULES:
- Keep enhancedQuery concise (max 150 characters)
- Language codes: eng (English), fra (French), spa (Spanish), deu (German), ita (Italian), por (Portuguese), etc.
- If multilingual query, choose the dominant language
- Include both English and local terms when relevant

RESPOND ONLY WITH VALID JSON:`;
  }

  /**
   * Cache result in Redis
   * @private
   */
  static async _cacheInRedis(query, result, enhanceId) {
    try {
      const cacheKey = generateCacheKey('query_enhancement', query.trim().toLowerCase());
      const cacheData = {
        enhancedQuery: result.enhancedQuery,
        language: result.language,
        synonyms: result.synonyms,
        cachedAt: new Date().toISOString()
      };
      
      const ttl = 86400; // 24 hours
      const success = await redisClient.set(cacheKey, cacheData, ttl);
      
      if (success) {
        console.log(`   💾 Cached in Redis (TTL: ${ttl}s)`);
      } else {
        console.warn(`   ⚠️ Redis caching failed (non-critical)`);
      }
    } catch (error) {
      console.warn(`⚠️ [QueryEnhancement] [${enhanceId}] Redis caching error:`, error.message);
      // Non-critical error, continue
    }
  }

  /**
   * Fallback language detection (simple heuristic)
   * @private
   */
  static _detectLanguageFallback(query) {
    const lowerQuery = query.toLowerCase();
    
    // French indicators
    const frenchIndicators = ['ingénieur', 'directeur', 'président', 'société', 'entreprise', 'développeur'];
    const frenchMatches = frenchIndicators.filter(word => lowerQuery.includes(word)).length;
    
    if (frenchMatches >= 1) {
      return 'fra';
    }
    
    // Spanish indicators
    const spanishIndicators = ['ingeniero', 'director', 'empresa', 'desarrollador'];
    const spanishMatches = spanishIndicators.filter(word => lowerQuery.includes(word)).length;
    
    if (spanishMatches >= 1) {
      return 'spa';
    }
    
    // Default to English
    return 'eng';
  }

  /**
   * Clear query enhancement cache
   * Useful for testing or cache invalidation
   */
  static async clearCache() {
    try {
      const pattern = 'query_enhancement:*';
      const cleared = await redisClient.clearPattern(pattern);
      console.log(`🗑️ [QueryEnhancement] Cleared ${cleared} cached queries`);
      return cleared;
    } catch (error) {
      console.error('❌ [QueryEnhancement] Cache clear failed:', error.message);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats() {
    try {
      const redisStats = await redisClient.getStats();
      return {
        staticCacheSize: Object.keys(COMMON_EXPANSIONS).length,
        redisConnected: redisStats?.connected || false,
        redisStats
      };
    } catch (error) {
      console.error('❌ [QueryEnhancement] Stats error:', error.message);
      return null;
    }
  }
}