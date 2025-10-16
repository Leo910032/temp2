// lib/services/serviceContact/server/rerankService.js
// Server-side service for contact reranking operations
// Handles Pinecone rerank API calls and document preparation

import { Pinecone } from '@pinecone-database/pinecone';
import { API_COSTS } from '@/lib/services/constants/apiCosts';
import { SEMANTIC_SEARCH_CONFIG } from '@/lib/services/serviceContact/client/constants/contactConstants';

// Initialize Pinecone client
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

/**
 * RerankService
 *
 * Architecture:
 * - Builds searchable documents from contact data
 * - Calls Pinecone Rerank API
 * - Calculates hybrid scores combining vector + rerank scores
 * - Returns reranked contacts with metadata
 */
export class RerankService {
  /**
   * Rerank contacts using Pinecone API
   *
   * @param {string} query - Search query
   * @param {Array} contacts - Array of contacts to rerank
   * @param {object} options - Rerank options
   * @returns {Promise<object>} Reranked results with metadata
   */
  static async rerankContacts(query, contacts, options = {}) {
    const {
      model = SEMANTIC_SEARCH_CONFIG.RERANK_MODELS.MULTILINGUAL,
      topN = SEMANTIC_SEARCH_CONFIG.DEFAULT_RERANK_TOP_N,
      minRerankScore = null, // Minimum rerank relevance threshold (if null, use topN)
      subscriptionLevel = 'premium',
      rerankId = `rerank_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      isFactualQuery = false // Flag to use minimal document for simple, factual queries
    } = options;

    console.log(`🔄 [RerankService] [${rerankId}] Starting rerank:`, {
      query: query.substring(0, 50) + '...',
      contactsCount: contacts.length,
      model,
      topN,
      queryType: isFactualQuery ? 'factual (minimal document)' : 'semantic (rich document)'
    });

    try {
      // Step 1: Build documents for reranking
      console.log(`📄 [RerankService] [${rerankId}] Building documents...`);
      const documents = contacts.map(contact =>
        this._buildRerankDocument(contact, subscriptionLevel, isFactualQuery)
      );

      console.log(`📄 [RerankService] [${rerankId}] Built ${documents.length} documents`, {
        avgLength: Math.round(documents.reduce((sum, doc) => sum + doc.length, 0) / documents.length),
        sampleDoc: documents[0]?.substring(0, 200) + '...'
      });

      // Summary log of fields used for reranking
      console.log(`📊 [RerankService] [${rerankId}] RERANK DOCUMENT SUMMARY:`);
      console.log(`   ├─ Query Type: ${isFactualQuery ? 'FACTUAL (minimal fields)' : 'SEMANTIC (rich fields)'}`);
      console.log(`   ├─ Subscription: ${subscriptionLevel}`);
      console.log(`   ├─ Documents Built: ${documents.length}`);
      console.log(`   └─ Field Strategy: ${isFactualQuery ? 'name, company, jobTitle only' : 'All available fields based on subscription'}`);

      // Step 2: Detect query language
      const queryLanguage = this._detectQueryLanguage(query);
      console.log(`🌐 [RerankService] [${rerankId}] Detected query language: ${queryLanguage}`);
// Step 3: Call Pinecone Rerank API
console.log(`🔄 [RerankService] [${rerankId}] Calling Pinecone Rerank API...`);
const rerankStartTime = Date.now();

// Decide whether to use threshold filtering or topN limit
const useThresholdFiltering = minRerankScore !== null && minRerankScore > 0;
const pineconeTopN = useThresholdFiltering
  ? contacts.length  // Request all results, we'll filter by threshold
  : Math.min(topN, contacts.length);  // Use traditional topN limit

console.log(`🎯 [RerankService] [${rerankId}] Rerank strategy:`, {
  useThresholdFiltering,
  minRerankScore: minRerankScore || 'N/A',
  pineconeTopN
});

// CRITICAL DEBUG: Log all parameters before API call
console.log(`🔍 [RerankService] [${rerankId}] API call parameters:`, {
  model: {
    type: typeof model,
    value: model,
    isDefined: model !== undefined,
    isNull: model === null
  },
  query: {
    type: typeof query,
    value: query?.substring(0, 50),
    length: query?.length,
    isDefined: query !== undefined,
    isNull: query === null
  },
  documents: {
    type: typeof documents,
    isArray: Array.isArray(documents),
    length: documents?.length,
    isDefined: documents !== undefined,
    isNull: documents === null,
    firstItemType: typeof documents?.[0],
    firstItemLength: documents?.[0]?.length
  },
  options: {
    topN: {
      type: typeof pineconeTopN,
      value: pineconeTopN,
      isDefined: pineconeTopN !== undefined
    },
    returnDocuments: false
  }
});

// Validate parameters before calling API
if (!model || typeof model !== 'string') {
  throw new Error(`Invalid model parameter: ${model}`);
}
if (!query || typeof query !== 'string') {
  throw new Error(`Invalid query parameter: ${query}`);
}
if (!Array.isArray(documents) || documents.length === 0) {
  throw new Error(`Invalid documents parameter: must be non-empty array`);
}
if (!documents.every(doc => typeof doc === 'string')) {
  throw new Error(`Invalid documents: all elements must be strings`);
}
if (typeof pineconeTopN !== 'number' || pineconeTopN < 1) {
  throw new Error(`Invalid topN parameter: ${pineconeTopN}`);
}

console.log(`✅ [RerankService] [${rerankId}] All parameters validated`);

// FIXED: Try with positional parameters (based on Pinecone SDK pattern)
console.log(`🚀 [RerankService] [${rerankId}] Calling pc.inference.rerank() with positional params...`);

let rerankResponse;
try {
  // Attempt #1: Positional parameters (model, query, documents, options)
  rerankResponse = await pc.inference.rerank(
    model,           // 1st: model name
    query,           // 2nd: query string
    documents,       // 3rd: documents array
    {                // 4th: options object
      topN: pineconeTopN,
      returnDocuments: false
    }
  );
  console.log(`✅ [RerankService] [${rerankId}] API call succeeded with positional params`);
} catch (positionalError) {
  console.error(`❌ [RerankService] [${rerankId}] Positional params failed:`, positionalError.message);
  
  // Attempt #2: Try object syntax as fallback
  console.log(`🔄 [RerankService] [${rerankId}] Retrying with object syntax...`);
  try {
    rerankResponse = await pc.inference.rerank({
      model: model,
      query: query,
      documents: documents,
      topN: pineconeTopN,
      returnDocuments: false
    });
    console.log(`✅ [RerankService] [${rerankId}] API call succeeded with object syntax`);
  } catch (objectError) {
    console.error(`❌ [RerankService] [${rerankId}] Object syntax also failed:`, objectError.message);
    
    // Both attempts failed, throw detailed error
    throw new Error(`Pinecone rerank API failed with both syntaxes. Positional: ${positionalError.message}, Object: ${objectError.message}`);
  }
}

const rerankDuration = Date.now() - rerankStartTime;

// Debug the response structure
console.log(`🔍 [RerankService] [${rerankId}] API response structure:`, {
  responseType: typeof rerankResponse,
  isNull: rerankResponse === null,
  isUndefined: rerankResponse === undefined,
  keys: rerankResponse ? Object.keys(rerankResponse) : [],
  hasData: !!rerankResponse?.data,
  dataType: typeof rerankResponse?.data,
  dataIsArray: Array.isArray(rerankResponse?.data),
  dataLength: rerankResponse?.data?.length
});

// Get raw results from Pinecone before filtering
const rawResults = rerankResponse.data || [];
const rawCount = rawResults.length;




      
      const rawScoreRange = rawCount > 0 ? {
        min: Math.min(...rawResults.map(r => r.score)),
        max: Math.max(...rawResults.map(r => r.score))
      } : { min: 0, max: 0 };

      console.log(`🔄 [RerankService] [${rerankId}] Pinecone API complete:`, {
        duration: `${rerankDuration}ms`,
        resultsReturned: rawCount,
        scoreRange: rawCount > 0 ? `${rawScoreRange.min.toFixed(4)} - ${rawScoreRange.max.toFixed(4)}` : 'N/A'
      });

      // Apply threshold filtering if minRerankScore is provided
      let filteredResults = rawResults;
      let filteringStats = null;

      if (useThresholdFiltering) {
        console.log(`🎯 [RerankService] [${rerankId}] Applying rerank threshold filter: ${minRerankScore} (${(minRerankScore * 100).toFixed(0)}% minimum relevance)`);

        filteredResults = rawResults.filter(result => result.score >= minRerankScore);
        const filteredCount = filteredResults.length;
        const removedCount = rawCount - filteredCount;
        const filteredScoreRange = filteredCount > 0 ? {
          min: Math.min(...filteredResults.map(r => r.score)),
          max: Math.max(...filteredResults.map(r => r.score))
        } : { min: 0, max: 0 };

        console.log(`✅ [RerankService] [${rerankId}] After threshold filter:`, {
          kept: filteredCount,
          removed: removedCount,
          scoreRange: filteredCount > 0 ? `${filteredScoreRange.min.toFixed(4)} - ${filteredScoreRange.max.toFixed(4)}` : 'N/A'
        });

        // Apply fallback limit if too many results passed threshold
        const fallbackLimit = 30; // From CONFIDENCE_THRESHOLDS.FALLBACK_MAX_RESULTS.rerank
        let fallbackApplied = false;

        if (filteredCount > fallbackLimit) {
          console.log(`⚠️  [RerankService] [${rerankId}] Too many results (${filteredCount}) passed threshold. Applying fallback limit: ${fallbackLimit}`);
          filteredResults = filteredResults.slice(0, fallbackLimit);
          fallbackApplied = true;
        }

        filteringStats = {
          thresholdUsed: minRerankScore,
          rawCount,
          filteredCount,
          removedCount,
          rawScoreRange,
          filteredScoreRange,
          fallbackApplied,
          fallbackLimit: fallbackApplied ? fallbackLimit : null,
          finalCount: filteredResults.length
        };

        if (removedCount > 0) {
          console.log(`📉 [RerankService] [${rerankId}] Filtered out: ${removedCount} contacts below ${(minRerankScore * 100).toFixed(0)}% relevance threshold`);
        }

        if (filteredCount === 0) {
          console.log(`⚠️  [RerankService] [${rerankId}] WARNING: No results passed rerank threshold. Consider lowering threshold.`);
        }

        if (fallbackApplied) {
          console.log(`🔒 [RerankService] [${rerankId}] Fallback limit applied: ${filteredResults.length} final results`);
        }
      } else {
        console.log(`ℹ️  [RerankService] [${rerankId}] Using traditional topN limit: ${topN}`);
      }

      // Step 4: Calculate cost
      const modelPrice = this._getModelPrice(model);
      const actualCost = contacts.length * modelPrice;

      console.log(`💰 [RerankService] [${rerankId}] Cost: $${actualCost.toFixed(6)}`);

      // Step 5: Reorder contacts based on rerank scores
      console.log(`📊 [RerankService] [${rerankId}] Processing rerank results...`);
      const rerankedContacts = filteredResults.map((result, rank) => {
        const originalContact = contacts[result.index];
        const vectorScore = originalContact._vectorScore || originalContact.searchMetadata?.vectorSimilarity || 0;

        return {
          ...originalContact,
          searchMetadata: {
            ...originalContact.searchMetadata,
            rerankScore: result.score,
            rerankRank: rank + 1,
            originalVectorRank: result.index + 1,
            hybridScore: (vectorScore * 0.3) + (result.score * 0.7), // Weight rerank score higher
            rerankModel: model,
            queryLanguage
          }
        };
      });

      const result = {
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
          rerankId,
          thresholdFiltering: filteringStats
        }
      };

      console.log(`✅ [RerankService] [${rerankId}] Reranking complete:`, {
        originalCount: contacts.length,
        rerankedCount: rerankedContacts.length,
        cost: actualCost.toFixed(6),
        queryLanguage,
        duration: `${rerankDuration}ms`
      });

      return result;

    } catch (error) {
      console.error(`❌ [RerankService] [${rerankId}] Reranking failed:`, {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Build a searchable document from contact data
   * @private
   * @param {object} contact - Contact data
   * @param {string} subscriptionLevel - User's subscription level
   * @param {boolean} isFactualQuery - If true, builds minimal document for factual queries
   */
  static _buildRerankDocument(contact, subscriptionLevel, isFactualQuery = false) {
    const fieldsUsed = []; // Track which fields are included for logging

    // DEBUG: Log contact data structure for first contact
    if (!this._hasLoggedContactStructure) {
      console.log(`🔍 [RerankDoc] Sample contact data structure for debugging:`);
      console.log(`   ├─ name: ${contact.name}`);
      console.log(`   ├─ email: ${contact.email}`);
      console.log(`   ├─ company (top-level): ${contact.company || 'null'}`);
      console.log(`   ├─ jobTitle (top-level): ${contact.jobTitle || 'null'}`);
      console.log(`   ├─ details array length: ${contact.details?.length || 0}`);
      console.log(`   ├─ dynamicFields array length: ${contact.dynamicFields?.length || 0}`);
      if (contact.details?.length > 0) {
        console.log(`   ├─ details labels: [${contact.details.map(d => d.label).join(', ')}]`);
      }
      this._hasLoggedContactStructure = true;
    }

    // Minimal document for factual queries
    if (isFactualQuery) {
      const parts = [];

      if (contact.name) {
        parts.push(`Name: ${contact.name}`);
        fieldsUsed.push('name');
      }

      const company = this._extractCompany(contact);
      if (company) {
        parts.push(`Company: ${company}`);
        fieldsUsed.push('company');
      }

      const jobTitle = this._extractJobTitle(contact);
      if (jobTitle) {
        parts.push(`Title: ${jobTitle}`);
        fieldsUsed.push('jobTitle');
      }

      console.log(`   📋 [RerankDoc] Contact: ${contact.name} | Mode: MINIMAL (factual query) | Fields: [${fieldsUsed.join(', ')}]`);

      return parts.join('. ') + '.';
    }

    // Original rich document building for semantic/complex queries
    let document = `[Contact Name]: ${contact.name || 'Unknown'}\n`;
    fieldsUsed.push('name');

    document += `[Email]: ${contact.email || 'No email'}\n`;
    fieldsUsed.push('email');

    const company = this._extractCompany(contact);
    document += `[Company]: ${company || 'No company'}\n`;
    fieldsUsed.push('company');

    const jobTitle = this._extractJobTitle(contact);
    if (jobTitle) {
      document += `[Job Title]: ${jobTitle}\n`;
      fieldsUsed.push('jobTitle');
    }

    // Include dynamic fields for all subscription levels
    if (contact.dynamicFields && Array.isArray(contact.dynamicFields)) {
      let dynamicFieldCount = 0;
      contact.dynamicFields.forEach(field => {
        if (field.value && field.label) {
          document += `[${field.label}]: ${field.value}\n`;
          dynamicFieldCount++;
        }
      });
      if (dynamicFieldCount > 0) {
        fieldsUsed.push(`dynamicFields (${dynamicFieldCount})`);
      }
    }

    // Include all details for Premium+ users
    const isPremiumOrHigher = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);
    if (isPremiumOrHigher) {
      if (contact.notes) {
        document += `[Notes]: ${contact.notes}\n`;
        fieldsUsed.push('notes');
      }

      if (contact.message) {
        document += `[Message]: ${contact.message}\n`;
        fieldsUsed.push('message');
      }

      if (contact.website) {
        document += `[Website]: ${contact.website}\n`;
        fieldsUsed.push('website');
      }

      // Event information
      if (contact.eventInfo) {
        if (contact.eventInfo.eventName) {
          document += `[Event]: ${contact.eventInfo.eventName}\n`;
          fieldsUsed.push('eventInfo.eventName');
        }
        if (contact.eventInfo.eventType) {
          document += `[Event Type]: ${contact.eventInfo.eventType}\n`;
          fieldsUsed.push('eventInfo.eventType');
        }
        if (contact.eventInfo.venue) {
          document += `[Venue]: ${contact.eventInfo.venue}\n`;
          fieldsUsed.push('eventInfo.venue');
        }
        if (contact.eventInfo.eventDates) {
          document += `[Event Dates]: ${contact.eventInfo.eventDates}\n`;
          fieldsUsed.push('eventInfo.eventDates');
        }
      }

      // Location
      if (contact.location) {
        const locationParts = [];

        if (contact.location.address) {
          locationParts.push(contact.location.address);
        }

        if (contact.location.city) locationParts.push(contact.location.city);
        if (contact.location.state) locationParts.push(contact.location.state);
        if (contact.location.country) locationParts.push(contact.location.country);

        if (locationParts.length > 0) {
          document += `[Location]: ${locationParts.join(', ')}\n`;
          fieldsUsed.push('location');
        }
      }

      // Source context
      if (contact.originalSource) {
        const sourceLabel = contact.originalSource
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        document += `[How We Met]: ${sourceLabel}\n`;
        fieldsUsed.push('originalSource');
      }
    }

    console.log(`   📋 [RerankDoc] Contact: ${contact.name} | Mode: RICH (semantic query) | Subscription: ${subscriptionLevel} | Fields: [${fieldsUsed.join(', ')}]`);

    return document.trim();
  }

  /**
   * Extract job title from contact object
   * @private
   */
  static _extractJobTitle(contact) {
    if (contact.jobTitle) {
      return contact.jobTitle;
    }

    if (contact.details && Array.isArray(contact.details)) {
      const jobField = contact.details.find(d =>
        d.label?.toLowerCase() === 'job title' ||
        d.label?.toLowerCase() === 'title' ||
        d.label?.toLowerCase() === 'position' ||
        d.label?.toLowerCase() === 'role'
      );
      if (jobField?.value) {
        console.log(`   ℹ️  Extracted job title from details array: ${jobField.value}`);
        return jobField.value;
      }
    }

    if (contact.dynamicFields && Array.isArray(contact.dynamicFields)) {
      const jobField = contact.dynamicFields.find(f =>
        f.label?.toLowerCase().includes('job') ||
        f.label?.toLowerCase().includes('title') ||
        f.label?.toLowerCase().includes('position') ||
        f.label?.toLowerCase().includes('role')
      );
      if (jobField?.value) {
        console.log(`   ℹ️  Extracted job title from dynamicFields: ${jobField.value}`);
        return jobField.value;
      }
    }

    return null;
  }

  /**
   * Extract company from contact object
   * @private
   */
  static _extractCompany(contact) {
    if (contact.company) {
      return contact.company;
    }

    if (contact.details && Array.isArray(contact.details)) {
      const companyField = contact.details.find(d =>
        d.label?.toLowerCase() === 'company' ||
        d.label?.toLowerCase() === 'organization' ||
        d.label?.toLowerCase() === 'employer'
      );
      if (companyField?.value) {
        console.log(`   ℹ️  Extracted company from details array: ${companyField.value}`);
        return companyField.value;
      }
    }

    if (contact.dynamicFields && Array.isArray(contact.dynamicFields)) {
      const companyField = contact.dynamicFields.find(f =>
        f.label?.toLowerCase().includes('company') ||
        f.label?.toLowerCase().includes('organization')
      );
      if (companyField?.value) {
        console.log(`   ℹ️  Extracted company from dynamicFields: ${companyField.value}`);
        return companyField.value;
      }
    }

    return null;
  }

  /**
   * Detect query language for multilingual support
   * @private
   */
  static _detectQueryLanguage(query) {
    const frenchIndicators = [
      'expert', 'spécialiste', 'ingénieur', 'directeur', 'responsable',
      'développeur', 'consultant', 'manager', 'chef', 'analyste',
      'pour', 'dans', 'avec', 'entreprise', 'société', 'équipe',
      'intelligence artificielle', 'données', 'numérique', 'digital'
    ];

    const lowerQuery = query.toLowerCase();
    const frenchMatches = frenchIndicators.filter(word => lowerQuery.includes(word)).length;

    return frenchMatches >= 2 ? 'fr' : 'en';
  }

  /**
   * Get pricing for a specific rerank model
   * @private
   */
  static _getModelPrice(model) {
    // Get from API_COSTS.PINECONE_RERANK
    if (API_COSTS.PINECONE_RERANK) {
      // Check for specific model pricing
      if (model === 'pinecone-rerank-v0' && API_COSTS.PINECONE_RERANK.PINECONE_RERANK_V0) {
        return API_COSTS.PINECONE_RERANK.PINECONE_RERANK_V0.PER_REQUEST;
      }
      if (model === 'bge-reranker-v2-m3' && API_COSTS.PINECONE_RERANK.BGE_RERANKER_V2_M3) {
        return API_COSTS.PINECONE_RERANK.BGE_RERANKER_V2_M3.PER_REQUEST;
      }
      if (model === 'cohere-rerank-v3.5' && API_COSTS.PINECONE_RERANK.COHERE_RERANK_V3_5) {
        return API_COSTS.PINECONE_RERANK.COHERE_RERANK_V3_5.PER_REQUEST;
      }
    }

    // Fallback to default pricing
    return 0.002; // $2.00 per 1,000 requests
  }

  /**
   * Estimate cost for a rerank operation
   *
   * @param {number} contactCount - Number of contacts to rerank
   * @param {string} model - Rerank model to use
   * @returns {object} Cost estimate
   */
  static estimateCost(contactCount, model = SEMANTIC_SEARCH_CONFIG.RERANK_MODELS.MULTILINGUAL) {
    const modelPrice = this._getModelPrice(model);
    const estimatedCost = contactCount * modelPrice;

    return {
      contactCount,
      modelPrice,
      estimatedCost
    };
  }
}