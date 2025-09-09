// lib/services/serviceContact/server/smartIcebreakerService.js
// Real-time intelligence gathering service for dynamic icebreaker generation

import { GoogleGenerativeAI } from '@google/generative-ai';
import { CostTrackingService } from './costTrackingService';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Pricing constants
const SEARCH_API_PRICING = {
  'serpapi': 5.00 / 1000,          // $5 per 1000 searches
  'brave_search': 2.50 / 1000,    // $2.50 per 1000 searches (example)
  'google_search': 5.00 / 1000    // $5 per 1000 searches
};

const GEMINI_PRICING = {
  'gemini-2.5-flash': {
    inputPricePerMillionTokens: 0.30,
    outputPricePerMillionTokens: 2.50,
  }
};

export class SmartIcebreakerService {

  /**
   * Phase 1: Generate strategic questions during initial AI enhancement
   * This replaces the generic "actionSuggestions" with intelligent questions
   */
  static generateStrategicQuestions(query, contact, subscriptionLevel = 'business') {
    const operationId = `strategic_questions_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`🎯 [SmartIcebreaker] [${operationId}] Generating strategic questions for: ${contact.name}`);

    const prompt = `You are an expert networking strategist. Generate 3 strategic research questions about this contact that would help create perfect conversation starters.

CONTACT INFORMATION:
- Name: ${contact.name || 'Unknown'}
- Company: ${contact.company || 'Not provided'}
- Job Title: ${contact.jobTitle || 'Not provided'}
- Notes: ${contact.notes || 'No notes available'}
- Industry Context: ${this.inferIndustryFromContact(contact)}

SEARCH QUERY CONTEXT: "${query}"

Generate exactly 3 strategic questions that could be answered through web searches to create highly relevant, timely icebreakers. Focus on:
1. Recent company/industry developments
2. Professional achievements or changes
3. Current market trends affecting their role

Format as JSON:
{
  "questions": [
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
  ]
}`;

    console.log(`🎯 [SmartIcebreaker] [${operationId}] Strategic questions generated for: ${contact.name}`);
    
    // Return a mock response for now - this would be called by the existing AI enhancement
    return {
      questions: [
        {
          question: `What recent announcements has ${contact.company || 'their company'} made?`,
          searchQuery: `"${contact.company}" recent news announcements 2024`,
          category: "company_updates"
        },
        {
          question: `What are the latest trends in ${this.inferIndustryFromContact(contact)}?`,
          searchQuery: `${this.inferIndustryFromContact(contact)} trends 2024`,
          category: "industry_trends"
        },
        {
          question: `Has ${contact.name} been mentioned in recent industry news?`,
          searchQuery: `"${contact.name}" "${contact.company}" recent news`,
          category: "personal_updates"
        }
      ]
    };
  }

  /**
   * Phase 2: On-demand smart icebreaker generation with web search
   * This is the expensive operation triggered by user click
   */
  static async generateSmartIcebreakers(userId, contactId, strategicQuestions, options = {}) {
    const operationId = `smart_icebreaker_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    console.log(`🚀 [SmartIcebreaker] [${operationId}] Starting smart icebreaker generation`);
    
    const {
      trackCosts = true,
      searchProvider = 'serpapi',
      maxSearches = 3,
      subscriptionLevel = 'business'
    } = options;

    let totalCosts = 0;
    let searchCosts = 0;
    let llmCosts = 0;
    let searchResults = [];

    try {
      // Step 1: Check if user can afford this operation
      if (trackCosts) {
        const estimatedCost = this.estimateIcebreakerCost(maxSearches, searchProvider);
        console.log(`💰 [SmartIcebreaker] [${operationId}] Estimated cost: $${estimatedCost.toFixed(6)}`);
        
        const affordabilityCheck = await CostTrackingService.canAffordOperation(
          userId,
          estimatedCost,
          1 // This counts as 1 AI run
        );

        if (!affordabilityCheck.canAfford) {
          console.log(`❌ [SmartIcebreaker] [${operationId}] User cannot afford operation`);
          throw new Error(`Smart icebreaker generation not available: ${affordabilityCheck.reason}`);
        }
      }

      // Step 2: Perform web searches for each strategic question
      console.log(`🔍 [SmartIcebreaker] [${operationId}] Executing ${strategicQuestions.length} web searches`);
      
      for (let i = 0; i < Math.min(strategicQuestions.length, maxSearches); i++) {
        const question = strategicQuestions[i];
        console.log(`🔍 [SmartIcebreaker] [${operationId}] Search ${i + 1}: ${question.searchQuery}`);
        
        try {
          const searchResult = await this.performWebSearch(question.searchQuery, searchProvider);
          const searchCost = SEARCH_API_PRICING[searchProvider] || SEARCH_API_PRICING['serpapi'];
          
          searchCosts += searchCost;
          searchResults.push({
            question: question.question,
            category: question.category,
            results: searchResult.results || [],
            cost: searchCost
          });

          // Record the search API cost
          if (trackCosts) {
            await CostTrackingService.recordSeparatedUsage(
              userId,
              searchCost,
              `${searchProvider}_search`,
              'smart_icebreaker_search',
              {
                searchQuery: question.searchQuery,
                category: question.category,
                contactId,
                operationId,
                searchIndex: i
              },
              'api_call'
            );
          }

          console.log(`✅ [SmartIcebreaker] [${operationId}] Search ${i + 1} completed: $${searchCost.toFixed(6)}`);
          
        } catch (searchError) {
          console.error(`❌ [SmartIcebreaker] [${operationId}] Search ${i + 1} failed:`, searchError);
          // Continue with other searches even if one fails
          searchResults.push({
            question: question.question,
            category: question.category,
            results: [],
            error: searchError.message
          });
        }
      }

      // Step 3: Get the contact data for context
      console.log(`📋 [SmartIcebreaker] [${operationId}] Fetching contact data...`);
      const contact = await this.getContactData(userId, contactId);
      
      if (!contact) {
        throw new Error('Contact not found');
      }

      // Step 4: Generate final icebreakers using LLM with search results
      console.log(`🧠 [SmartIcebreaker] [${operationId}] Generating final icebreakers with LLM`);
      const icebreakerResult = await this.synthesizeIcebreakers(contact, searchResults, subscriptionLevel);
      
      llmCosts = icebreakerResult.cost;
      totalCosts = searchCosts + llmCosts;

      // Record the LLM API cost
      if (trackCosts) {
        await CostTrackingService.recordSeparatedUsage(
          userId,
          llmCosts,
          'gemini-2.5-flash',
          'smart_icebreaker_synthesis',
          {
            contactId,
            operationId,
            inputTokens: icebreakerResult.inputTokens,
            outputTokens: icebreakerResult.outputTokens,
            searchResultsCount: searchResults.length
          },
          'api_call'
        );

        // Record the successful run (this counts toward AI run limits)
        await CostTrackingService.recordSeparatedUsage(
          userId,
          0,
          'smart_icebreaker_system',
          'smart_icebreaker_success',
          {
            contactId,
            operationId,
            totalCost: totalCosts,
            searchCosts,
            llmCosts,
            searchCount: searchResults.length
          },
          'successful_run'
        );
      }

      const finalResult = {
        success: true,
        contactId,
        icebreakers: icebreakerResult.icebreakers,
        searchResults: searchResults.map(sr => ({
          question: sr.question,
          category: sr.category,
          hasResults: sr.results.length > 0,
          error: sr.error
        })),
        costs: {
          total: totalCosts,
          searches: searchCosts,
          llm: llmCosts,
          breakdown: {
            searchApiCalls: searchResults.length,
            llmTokensInput: icebreakerResult.inputTokens,
            llmTokensOutput: icebreakerResult.outputTokens
          }
        },
        metadata: {
          operationId,
          timestamp: new Date().toISOString(),
          searchProvider,
          subscriptionLevel
        }
      };

      console.log(`✅ [SmartIcebreaker] [${operationId}] Smart icebreakers generated successfully:`, {
        totalCost: `$${totalCosts.toFixed(6)}`,
        searchCost: `$${searchCosts.toFixed(6)}`,
        llmCost: `$${llmCosts.toFixed(6)}`,
        icebreakersCount: icebreakerResult.icebreakers.length
      });

      return finalResult;

    } catch (error) {
      console.error(`❌ [SmartIcebreaker] [${operationId}] Generation failed:`, error);
      
      // Still record any costs that were incurred
      if (trackCosts && (searchCosts > 0 || llmCosts > 0)) {
        console.log(`💰 [SmartIcebreaker] [${operationId}] Recording partial costs from failed operation`);
        // The individual API costs were already recorded above
      }

      throw error;
    }
  }

  /**
   * Perform web search using configured provider
   */
  static async performWebSearch(query, provider = 'serpapi') {
    const searchStartTime = Date.now();
    
    try {
      console.log(`🔍 [WebSearch] Searching with ${provider}: "${query}"`);
      
      if (provider === 'serpapi') {
        return await this.searchWithSerpApi(query);
      } else if (provider === 'brave_search') {
        return await this.searchWithBraveApi(query);
      } else {
        throw new Error(`Unsupported search provider: ${provider}`);
      }
      
    } catch (error) {
      console.error(`❌ [WebSearch] Search failed with ${provider}:`, error);
      throw error;
    } finally {
      const searchDuration = Date.now() - searchStartTime;
      console.log(`🔍 [WebSearch] Search completed in ${searchDuration}ms`);
    }
  }

  /**
   * Search using SerpApi (Google Search API)
   */
  static async searchWithSerpApi(query) {
    const apiKey = process.env.SERPAPI_API_KEY;
    
    if (!apiKey) {
      throw new Error('SERPAPI_API_KEY not configured');
    }

    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=3`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`SerpApi request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      results: (data.organic_results || []).slice(0, 3).map(result => ({
        title: result.title,
        snippet: result.snippet,
        link: result.link,
        source: 'serpapi'
      }))
    };
  }

  /**
   * Search using Brave Search API
   */
  static async searchWithBraveApi(query) {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    
    if (!apiKey) {
      throw new Error('BRAVE_SEARCH_API_KEY not configured');
    }

    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`;
    
    const response = await fetch(url, {
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Brave Search request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      results: (data.web?.results || []).slice(0, 3).map(result => ({
        title: result.title,
        snippet: result.description,
        link: result.url,
        source: 'brave_search'
      }))
    };
  }

  /**
   * Synthesize icebreakers using LLM with search results
   */
  static async synthesizeIcebreakers(contact, searchResults, subscriptionLevel) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // Build comprehensive prompt with search results
    const searchContext = searchResults.map((sr, index) => {
      const resultsText = sr.results.map(r => `- ${r.title}: ${r.snippet}`).join('\n');
      return `Question ${index + 1}: ${sr.question}
Category: ${sr.category}
Search Results:
${resultsText || 'No recent results found'}`;
    }).join('\n\n');

    const prompt = `You are an expert networking strategist. Using the real-time search results below, create 3 highly personalized, timely icebreakers for this contact.

CONTACT INFORMATION:
- Name: ${contact.name}
- Company: ${contact.company || 'Unknown'}
- Job Title: ${contact.jobTitle || 'Unknown'}
- Notes: ${contact.notes || 'No additional context'}

REAL-TIME SEARCH INTELLIGENCE:
${searchContext}

Create exactly 3 icebreakers that:
1. Reference specific, recent information from the search results
2. Are genuinely interesting and conversation-worthy
3. Show you've done your research without being stalky
4. Are appropriate for professional networking

Each icebreaker should be 1-2 sentences and feel natural in a LinkedIn message or in-person conversation.

Format as JSON:
{
  "icebreakers": [
    {
      "text": "I saw that [Company] just announced [specific thing] - how is that impacting your work in [area]?",
      "category": "company_news",
      "confidence": 9,
      "source": "recent search results"
    }
  ]
}`;

    console.log(`🧠 [LLM] Synthesizing icebreakers with ${searchContext.length} characters of search context`);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
    
    // Calculate costs
    const usage = result.response.usageMetadata;
    const inputTokens = usage?.promptTokenCount || 0;
    const outputTokens = usage?.candidatesTokenCount || 0;
    
    const modelPrices = GEMINI_PRICING['gemini-2.5-flash'];
    const cost = (inputTokens / 1000000) * modelPrices.inputPricePerMillionTokens +
                 (outputTokens / 1000000) * modelPrices.outputPricePerMillionTokens;

    console.log(`🧠 [LLM] Synthesis complete:`, {
      inputTokens,
      outputTokens,
      cost: `$${cost.toFixed(6)}`
    });

    try {
      // Clean and parse JSON response
      const jsonStart = rawText.indexOf('{');
      const jsonEnd = rawText.lastIndexOf('}');
      const jsonString = rawText.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonString);
      
      return {
        icebreakers: parsed.icebreakers || [],
        cost,
        inputTokens,
        outputTokens
      };
      
    } catch (parseError) {
      console.error(`❌ [LLM] Failed to parse icebreaker response:`, parseError);
      
      // Fallback: create basic icebreakers
      return {
        icebreakers: [
          {
            text: `I'd love to learn more about your work at ${contact.company || 'your company'}.`,
            category: 'general',
            confidence: 5,
            source: 'fallback'
          }
        ],
        cost,
        inputTokens,
        outputTokens
      };
    }
  }

  /**
   * Get contact data from Firestore
   */
  static async getContactData(userId, contactId) {
    try {
      const { ContactService } = await import('./contactService');
      return await ContactService.getContact(userId, contactId);
    } catch (error) {
      console.error(`❌ Failed to get contact data:`, error);
      return null;
    }
  }

  /**
   * Estimate total cost for icebreaker generation
   */
  static estimateIcebreakerCost(searchCount = 3, searchProvider = 'serpapi') {
    const searchCost = searchCount * (SEARCH_API_PRICING[searchProvider] || SEARCH_API_PRICING['serpapi']);
    
    // Estimate LLM cost (larger prompt with search results)
    const estimatedInputTokens = 2000; // Larger due to search results
    const estimatedOutputTokens = 300;
    
    const modelPrices = GEMINI_PRICING['gemini-2.5-flash'];
    const llmCost = (estimatedInputTokens / 1000000) * modelPrices.inputPricePerMillionTokens +
                    (estimatedOutputTokens / 1000000) * modelPrices.outputPricePerMillionTokens;
    
    return searchCost + llmCost;
  }

  /**
   * Check if user's subscription allows smart icebreakers
   */
  static canUseSmartIcebreakers(subscriptionLevel) {
    return ['business', 'enterprise'].includes(subscriptionLevel?.toLowerCase());
  }

  /**
   * Infer industry from contact information
   */
  static inferIndustryFromContact(contact) {
    const company = contact.company?.toLowerCase() || '';
    const jobTitle = contact.jobTitle?.toLowerCase() || '';
    const notes = contact.notes?.toLowerCase() || '';
    
    const allText = `${company} ${jobTitle} ${notes}`;
    
    // Tech indicators
    if (allText.includes('tech') || allText.includes('software') || allText.includes('ai') || 
        allText.includes('developer') || allText.includes('engineer')) {
      return 'technology';
    }
    
    // Finance indicators
    if (allText.includes('finance') || allText.includes('bank') || allText.includes('fintech') ||
        allText.includes('investment')) {
      return 'finance';
    }
    
    // Healthcare indicators
    if (allText.includes('health') || allText.includes('medical') || allText.includes('pharma')) {
      return 'healthcare';
    }
    
    // Default
    return 'business';
  }

  /**
   * Get usage statistics for smart icebreaker feature
   */
  static async getUsageStats(userId, timeframe = '30d') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      if (timeframe === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeframe === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else {
        startDate.setDate(startDate.getDate() - 30);
      }

      // This would query the AIUsage collection for smart icebreaker operations
      const usageData = await CostTrackingService.getDetailedUsage(userId, 1, true, 1000);
      
      const icebreakerOperations = usageData.recentOperations?.filter(op => 
        op.feature === 'smart_icebreaker_success' &&
        new Date(op.timestamp) >= startDate
      ) || [];

      const totalCost = icebreakerOperations.reduce((sum, op) => {
        return sum + (op.metadata?.totalCost || 0);
      }, 0);

      return {
        timeframe,
        totalGenerations: icebreakerOperations.length,
        totalCost,
        averageCostPerGeneration: icebreakerOperations.length > 0 ? totalCost / icebreakerOperations.length : 0,
        recentOperations: icebreakerOperations.slice(0, 10)
      };

    } catch (error) {
      console.error('Error getting smart icebreaker usage stats:', error);
      return {
        timeframe,
        totalGenerations: 0,
        totalCost: 0,
        averageCostPerGeneration: 0,
        recentOperations: []
      };
    }
  }
}