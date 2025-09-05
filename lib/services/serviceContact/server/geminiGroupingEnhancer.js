// lib/services/serviceContact/server/geminiGroupingEnhancer.js
// AI-Enhanced Grouping using Gemini 1.5 Flash (same as your business card scanner)

import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  SUBSCRIPTION_LEVELS, 
  CONTACT_FEATURES, 
  hasContactFeature 
} from '../client/services/constants/contactConstants';
import { logGeminiEnhancementUsage } from '@/lib/services/logging/usageLogger';
/**
 * Configuration object for all available Gemini models.
 * Prices are per 1,000,000 tokens for standard, small-context requests.
 * 
 * To test a different model, set its `isActive` flag to `true` and others to `false`.
 */
const MODELS = {
  // --- Efficiency Tier (Fastest, Lowest Cost) ---
  'gemini-2.0-flash-lite': { 
    id: 'gemini-2.0-flash-lite', // CORRECTED: Direct API model ID
    inputPrice: 0.075,
    outputPrice: 0.30,
    isActive: false 
  },
  'gemini-1.5-flash': { //NOT AVAIBLE
    id: 'gemini-1.5-flash-latest', // Using '-latest' is a best practice
    inputPrice: 0.075,
    outputPrice: 0.30,
    isActive: true // <<< SET THIS TO true TO USE THIS MODEL
  },

  // --- Balanced Tier (Good balance of cost, speed, and intelligence) ---
  'gemini-2.5-flash-lite': { 
    id: 'gemini-2.5-flash-lite', // Note: 2.5 lite is not yet a distinct API model, often falls back to 1.5 Flash
    inputPrice: 0.10,
    outputPrice: 0.40,
    isActive: false 
  },
  'gemini-2.0-flash': { 
    id: 'gemini-2.0-flash',
    inputPrice: 0.10,
    outputPrice: 0.40,
    isActive: false 
  },
  'gemini-2.5-flash': { 
    id: 'gemini-2.5-flash', // Note: 2.5 Flash is not yet a distinct API model, often falls back to 1.5 Flash
    inputPrice: 0.30,
    outputPrice: 2.50,
    isActive: false 
  },
  
  // --- Intelligence Tier (Highest Quality, Highest Cost) ---
  
  'gemini-1.5-pro': { //NOT AVAIBLE
    id: 'gemini-1.5-pro-latest',
    inputPrice: 1.25,
    outputPrice: 5.00,
    isActive: false 
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro', // Note: 2.5 Pro is not yet a distinct API model, often falls back to 1.5 Pro
    inputPrice: 1.25,
    outputPrice: 10.00,
    isActive: false
  }
};

// Find the currently active model from the configuration above
const ACTIVE_MODEL = Object.values(MODELS).find(model => model.isActive);
if (!ACTIVE_MODEL) {
  throw new Error("CRITICAL: No active model is selected in GeminiGroupingEnhancer's MODELS config.");
}
export class GeminiGroupingEnhancer {
  // Add this new static method to your GeminiGroupingEnhancer class


   /**
   * Calculates the actual cost of a Gemini API call based on the active model's pricing.
   * @param {object} usageMetadata - The metadata object from the Gemini API response.
   * @returns {number} The calculated cost in USD.
   */
  static calculateRealCost(usageMetadata) {
    if (!usageMetadata) {
      console.warn('⚠️ [Gemini Cost] No usage metadata found, returning fallback cost.');
      return 0.001;
    }

    const { promptTokenCount, candidatesTokenCount } = usageMetadata;
    const { inputPrice, outputPrice } = ACTIVE_MODEL;

    const inputCost = (promptTokenCount / 1000000) * inputPrice;
    const outputCost = (candidatesTokenCount / 1000000) * outputPrice;
    
    const totalCost = inputCost + outputCost;

    console.log(`💰 [Gemini Cost - ${ACTIVE_MODEL.id}] Input: ${promptTokenCount} tokens ($${inputCost.toFixed(6)}), Output: ${candidatesTokenCount} tokens ($${outputCost.toFixed(6)}), Total: $${totalCost.toFixed(6)}`);

    return totalCost;
  }
  
   /**
   * Determine if user can access AI grouping features based on subscription
   */
  static canUseAIGrouping(subscriptionLevel, feature) {
    const aiFeatures = {
      'SMART_COMPANY_MATCHING': [SUBSCRIPTION_LEVELS.PREMIUM, SUBSCRIPTION_LEVELS.BUSINESS, SUBSCRIPTION_LEVELS.ENTERPRISE],
      'INDUSTRY_DETECTION': [SUBSCRIPTION_LEVELS.BUSINESS, SUBSCRIPTION_LEVELS.ENTERPRISE],
      'RELATIONSHIP_DETECTION': [SUBSCRIPTION_LEVELS.ENTERPRISE]
    };
    
    return aiFeatures[feature]?.includes(subscriptionLevel?.toLowerCase()) || false;
  }

 /**
   * Main method: Enhance contact grouping with AI based on subscription level
   * MODIFIED: Added 'userId' to the function signature for logging purposes
   */
 
  /**
   * Main method: Enhance contact grouping with AI based on subscription level
   */
  static async enhanceGrouping(contacts, subscriptionLevel, userId, options = {}) {
    console.log(`🤖 [Gemini Enhancer] Starting AI enhancement for ${subscriptionLevel} user with ${contacts.length} contacts using model: ${ACTIVE_MODEL.id}`);
    
    const enhancements = [];
    let totalCost = 0;
    
    const featuresRan = {
        smartCompanyMatching: { ran: false, groupsCreated: 0 },
        industryDetection: { ran: false, groupsCreated: 0 },
        relationshipDetection: { ran: false, groupsCreated: 0 },
    };

    // Premium Feature: Smart Company Matching
    if (this.canUseAIGrouping(subscriptionLevel, 'SMART_COMPANY_MATCHING')) {
      try {
        const companyEnhancement = await this.smartCompanyMatching(contacts);
        enhancements.push(...companyEnhancement.groups);
        totalCost += companyEnhancement.cost;
        featuresRan.smartCompanyMatching.ran = true;
        featuresRan.smartCompanyMatching.groupsCreated = companyEnhancement.groups.length;
        console.log(`✅ Smart company matching: ${companyEnhancement.groups.length} groups created`);
      } catch (error) {
        console.error('❌ Smart company matching failed:', error);
      }
    }

    // Business Feature: Industry Detection  
    if (this.canUseAIGrouping(subscriptionLevel, 'INDUSTRY_DETECTION') && contacts.length >= 10) {
      try {
        const industryEnhancement = await this.industryGrouping(contacts);
        enhancements.push(...industryEnhancement.groups);
        totalCost += industryEnhancement.cost;
        featuresRan.industryDetection.ran = true;
        featuresRan.industryDetection.groupsCreated = industryEnhancement.groups.length;
        console.log(`✅ Industry detection: ${industryEnhancement.groups.length} groups created`);
      } catch (error) {
        console.error('❌ Industry detection failed:', error);
      }
    }

    // Enterprise Feature: Relationship Detection
    if (this.canUseAIGrouping(subscriptionLevel, 'RELATIONSHIP_DETECTION') && contacts.length >= 5) {
      try {
        const relationshipEnhancement = await this.relationshipDetection(contacts);
        enhancements.push(...relationshipEnhancement.groups);
        totalCost += relationshipEnhancement.cost;
        featuresRan.relationshipDetection.ran = true;
        featuresRan.relationshipDetection.groupsCreated = relationshipEnhancement.groups.length;
        console.log(`✅ Relationship detection: ${relationshipEnhancement.groups.length} groups created`);
      } catch (error) {
        console.error('❌ Relationship detection failed:', error);
      }
    }
    
    if (userId) {
      const aiProcessed = enhancements.length > 0;
      let status = 'no_op';
      if (aiProcessed) {
        const allSucceeded = Object.values(featuresRan).every(f => !f.ran || (f.ran && f.groupsCreated > 0));
        status = allSucceeded ? 'success' : 'partial_success';
      }

      const logData = {
        userId: userId,
        status: status,
        cost: totalCost,
        model: ACTIVE_MODEL.id,
        subscriptionLevel: subscriptionLevel,
        contactsProcessed: contacts.length,
        details: {
          totalGroupsCreated: enhancements.length,
          features: featuresRan
        }
      };
      logGeminiEnhancementUsage(logData);
    } else {
        console.warn('⚠️ [Gemini Enhancer] No userId provided, skipping usage logging.');
    }

    return {
      enhancedGroups: enhancements,
      totalCost,
      aiProcessed: enhancements.length > 0,
      aiModel: ACTIVE_MODEL.id,
      subscriptionLevel
    };
  }

 /**
   * PREMIUM FEATURE: Smart Company Matching
   */
  static async smartCompanyMatching(contacts) {
    const companies = [...new Set(contacts.map(c => c.company).filter(Boolean))];
    
    if (companies.length < 2 || companies.length > 50) {
      return { groups: [], cost: 0 };
    }

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: ACTIVE_MODEL.id });

      const prompt = `You are an expert corporate structure analyst specializing in identifying relationships between company names.
Your primary task is to analyze the following list of company names and create groups ONLY for names that represent the same core entity.

A group is valid under two conditions:
1. It combines multiple variations of the same company name (e.g., 'Microsoft' and 'Microsoft Corp').
2. It combines a well-known subsidiary with its parent company if BOTH are present in the list (e.g., 'GitHub' and 'Microsoft').

Company names to analyze: ${JSON.stringify(companies)}

CRITICAL RULES:
- **VALID GROUPS ONLY:** A group MUST contain two or more related company names from the input list. Do NOT create groups for single, unrelated companies.
- **PRIORITIZE PARENTS:** When grouping a subsidiary with its parent, the parent company MUST be the 'canonical_name'. Your knowledge of major tech acquisitions is crucial.
- **NO MERGING COMPETITORS:** Do not merge unrelated companies (e.g., do not group 'AWS' and 'Microsoft').
- **EMPTY IS VALID:** If no valid groups can be formed according to these rules, you MUST return an empty "groups" array: \`{"groups": []}\`.

EXAMPLES of desired grouping:
- Input: ["Microsoft", "Microsoft Inc.", "Apple"] -> Output Group: { "canonical_name": "Microsoft", "variants": ["Microsoft", "Microsoft Inc."] }
- Input: ["GitHub", "Microsoft", "GitLab"] -> Output Group: { "canonical_name": "Microsoft", "variants": ["GitHub", "Microsoft"] }
- Input: ["YouTube", "Google", "Facebook"] -> Output Group: { "canonical_name": "Google", "variants": ["YouTube", "Google"] }

Your response must be ONLY the valid JSON object in the exact format below. Do not include any explanations, markdown, or other text.
{
  "groups": [
    {
      "canonical_name": "Example Parent", 
      "variants": ["Example Parent", "Example Subsidiary", "Example Variant Inc"],
      "confidence": 0.95
    }
  ]
}`;
// ==================== LOGGING ADDED ====================
      console.log(`\n-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=`);
      console.log(`➡️ [Gemini Input - smartCompanyMatching]`);
      console.log(prompt);
      console.log(`-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n`);
      // =======================================================
   
          const result = await model.generateContent(prompt);
      
      const usageMetadata = result.response.usageMetadata;
      const realCost = this.calculateRealCost(usageMetadata);

      const response = await result.response;
      const responseText = response.text();
       // ==================== LOGGING ADDED ====================
      console.log(`\n-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=`);
      console.log(`⬅️ [Gemini Output - smartCompanyMatching]`);
      console.log(responseText);
      console.log(`-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n`);
      // =======================================================
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("AI did not return valid JSON for company matching");
      }
      
      const parsedJson = JSON.parse(jsonMatch[0]);
      const aiGroups = parsedJson.groups || [];

      const contactGroups = [];
      aiGroups.forEach(aiGroup => {
        if (aiGroup.variants && aiGroup.variants.length >= 2) {
          const groupContacts = contacts.filter(contact => 
            aiGroup.variants.some(variant => 
              contact.company?.toLowerCase().trim() === variant.toLowerCase().trim()
            )
          );

          if (groupContacts.length >= 2) {
            contactGroups.push({
              id: `ai_company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: `${aiGroup.canonical_name} Team`,
              type: 'ai_company',
              contactIds: groupContacts.map(c => c.id),
              description: `AI-grouped ${aiGroup.canonical_name} contacts (${aiGroup.variants.join(', ')})`,
              metadata: {
                aiGenerated: true,
                aiModel:   ACTIVE_MODEL.id,
                canonicalName: aiGroup.canonical_name,
                variants: aiGroup.variants,
                confidence: aiGroup.confidence || 0.8,
                feature: 'smart_company_matching'
              },
              createdAt: new Date().toISOString(),
              lastModified: new Date().toISOString()
            });
          }
        }
      });

      return { 
        groups: contactGroups, 
        cost: realCost // MODIFIED: Use calculated real cost
      };

    } catch (error) {
      console.error('❌ Gemini company matching failed:', error);
      return { groups: [], cost: 0.005 }; // Still count partial cost
    }
  }


 /**
   * BUSINESS FEATURE: Industry Detection and Clustering  
   */
  static async industryGrouping(contacts) {
    const contactSummaries = contacts.map(c => ({
      id: c.id,
      company: c.company || 'Unknown',
      title: c.jobTitle || c.details?.find(d => d.label.toLowerCase().includes('title'))?.value || ''
    }));

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: ACTIVE_MODEL.id });

      const prompt = `Analyze these business contacts and group them by industry/business domain. Look at company names and job titles to determine industries.

Contacts: ${JSON.stringify(contactSummaries)}

Create industry groups with at least 2 contacts each. Common industries include:
- Technology/Software
- Healthcare/Medical  
- Finance/Banking
- Retail/E-commerce
- Manufacturing
- Consulting
- Media/Entertainment

Return ONLY valid JSON:
{
  "industry_groups": [
    {
      "industry": "Technology",
      "contact_ids": ["id1", "id2"],
      "reasoning": "Software companies and tech roles"
    }
  ]
}`;   // ==================== LOGGING ADDED ====================
      console.log(`\n-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=`);
      console.log(`➡️ [Gemini Input - industryGrouping]`);
      console.log(prompt);
      console.log(`-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n`);
      // =======================================================

     
      const result = await model.generateContent(prompt);

      const usageMetadata = result.response.usageMetadata;
      const realCost = this.calculateRealCost(usageMetadata);

      const response = await result.response;
      const responseText = response.text();
// ==================== LOGGING ADDED ====================
      console.log(`\n-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=`);
      console.log(`⬅️ [Gemini Output - industryGrouping]`);
      console.log(responseText);
      console.log(`-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n`);
      // =======================================================

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("AI did not return valid JSON for industry grouping");
      }
      
      const parsedJson = JSON.parse(jsonMatch[0]);
      const industryGroups = parsedJson.industry_groups || [];

      const contactGroups = industryGroups
        .filter(group => group.contact_ids && group.contact_ids.length >= 2)
        .map(group => ({
          id: `ai_industry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${group.industry} Professionals`,
          type: 'ai_industry',
          contactIds: group.contact_ids,
          description: `AI-grouped ${group.industry} contacts: ${group.reasoning}`,
          metadata: {
            aiGenerated: true,
            aiModel:  ACTIVE_MODEL.id,
            industry: group.industry,
            reasoning: group.reasoning,
            confidence: 0.8,
            feature: 'industry_detection'
          },
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString()
        }));

      return { 
        groups: contactGroups, 
        cost: realCost // MODIFIED: Use calculated real cost
      };

    } catch (error) {
      console.error('❌ Industry grouping failed:', error);
      return { groups: [], cost: 0.005 };
    }
  }

/**
 * ENTERPRISE FEATURE: Relationship Detection - FINAL FIXED VERSION
 */
static async relationshipDetection(contacts) {
  const contactData = contacts.map(c => ({
    id: c.id,
    name: c.name,
    company: c.company || 'Unknown',
    title: c.jobTitle || '',
    email: c.email || '',
    notes: c.message || c.details?.find(d => d.label.toLowerCase().includes('note'))?.value || ''
  }));

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: ACTIVE_MODEL.id });

    const prompt = `You are a strategic relationship analyst. Your task is to form groups based on personal interactions and specific action items recorded in the 'notes' field for each contact.

Rules:
1. **Prioritize the 'notes' field.** Groups based on specific notes are most valuable.
2. **Justify with evidence.** Your 'reasoning' MUST quote key phrases from notes.
3. **Create Actionable Groups.** Name groups based on shared context or next steps.
4. **Minimum Size.** Only create groups with at least 2 contacts.
5. **Output Format.** Return ONLY valid JSON in the exact format below.

Your response must be ONLY the valid JSON object below. Do not include any explanations, markdown, or other text.
{
  "relationship_groups": [
    {
      "relationship_type": "networking_followup",
      "group_name": "Conference Follow-ups",
      "contact_ids": ["contact_id_A", "contact_id_B"],
      "reasoning": "Both contacts mention 'met at conference' in their notes."
    }
  ]
}

Contacts to analyze:
${JSON.stringify(contactData)}`;

    // Logging
    console.log(`\n-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=`);
    console.log(`➡️ [Gemini Input - relationshipDetection]`);
    console.log(prompt);
    console.log(`-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n`);

    const result = await model.generateContent(prompt);
    
    const usageMetadata = result.response.usageMetadata;
    const realCost = this.calculateRealCost(usageMetadata);
    
    const response = await result.response;
    const responseText = response.text();
    
    console.log(`\n-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=`);
    console.log(`⬅️ [Gemini Output - relationshipDetection]`);
    console.log(responseText);
    console.log(`-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n`);
   
    // COMPREHENSIVE PARSING LOGIC - handles all possible formats
    let relationshipGroups = [];
    
    try {
      // Remove any markdown formatting
      const cleanedResponse = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      
      // Try to extract any JSON structure
      let jsonMatch = cleanedResponse.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        console.warn("⚠️ No JSON structure found in response");
        throw new Error("No valid JSON found in response");
      }
      
      const parsedResponse = JSON.parse(jsonMatch[0]);
      console.log("🔍 Parsed response type:", Array.isArray(parsedResponse) ? 'array' : 'object');
      
      // Handle all possible response formats
      if (Array.isArray(parsedResponse)) {
        // Format 1: Direct array of groups
        console.log("📋 Processing direct array format");
        relationshipGroups = parsedResponse;
        
      } else if (parsedResponse.relationship_groups && Array.isArray(parsedResponse.relationship_groups)) {
        // Format 2: Object with relationship_groups property (expected format)
        console.log("📋 Processing expected object format");
        relationshipGroups = parsedResponse.relationship_groups;
        
      } else if (parsedResponse.groups && Array.isArray(parsedResponse.groups)) {
        // Format 3: Object with groups property
        console.log("📋 Processing alternative object format");
        relationshipGroups = parsedResponse.groups;
        
      } else if (parsedResponse.relationship_type) {
        // Format 4: Single group object - wrap in array
        console.log("📋 Processing single group format");
        relationshipGroups = [parsedResponse];
        
      } else {
        // Format 5: Unknown structure - try to extract groups from any array property
        console.log("📋 Processing unknown format, searching for arrays");
        const arrayProperties = Object.values(parsedResponse).filter(val => Array.isArray(val));
        if (arrayProperties.length > 0) {
          relationshipGroups = arrayProperties[0];
        } else {
          console.warn("⚠️ No array properties found in response");
          relationshipGroups = [];
        }
      }
      
    } catch (parseError) {
      console.error("❌ JSON parsing failed:", parseError);
      console.error("Raw response:", responseText);
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }

    // Validate and process groups
    if (!Array.isArray(relationshipGroups)) {
      console.warn("⚠️ Relationship groups is not an array, converting to empty array");
      relationshipGroups = [];
    }

    console.log(`🔍 Found ${relationshipGroups.length} potential relationship groups`);

    const contactGroups = relationshipGroups
      .filter((group, index) => {
        // Validate group structure
        if (!group || typeof group !== 'object') {
          console.warn(`⚠️ Invalid group object at index ${index}:`, group);
          return false;
        }
        
        // Check for contact_ids array
        const contactIds = group.contact_ids || group.contactIds || [];
        if (!Array.isArray(contactIds) || contactIds.length < 2) {
          console.warn(`⚠️ Group "${group.group_name || group.name || 'Unknown'}" has insufficient contacts (${contactIds.length})`);
          return false;
        }
        
        // Verify contacts exist in our data
        const validContactIds = contactIds.filter(id => 
          contactData.some(contact => contact.id === id)
        );
        
        if (validContactIds.length < 2) {
          console.warn(`⚠️ Group "${group.group_name || group.name || 'Unknown'}" has insufficient valid contacts (${validContactIds.length})`);
          return false;
        }
        
        console.log(`✅ Valid group: "${group.group_name || group.name || 'Unknown'}" with ${validContactIds.length} contacts`);
        return true;
      })
      .map((group, index) => {
        const contactIds = group.contact_ids || group.contactIds || [];
        const validContactIds = contactIds.filter(id => 
          contactData.some(contact => contact.id === id)
        );
        
        return {
          id: `ai_relationship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: group.group_name || group.name || `Relationship Group ${index + 1}`,
          type: 'ai_relationship',
          contactIds: validContactIds,
          description: `AI-detected relationship: ${group.reasoning || 'No reasoning provided'}`,
          metadata: {
            aiGenerated: true,
            aiModel: ACTIVE_MODEL.id,
            relationshipType: group.relationship_type || 'unknown',
            reasoning: group.reasoning || 'No reasoning provided',
            confidence: 0.85,
            feature: 'relationship_detection'
          },
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString()
        };
      });

    console.log(`✅ Relationship detection completed: ${contactGroups.length} valid groups created`);

    return { 
      groups: contactGroups, 
      cost: realCost
    };

  } catch (error) {
    console.error('❌ Relationship detection failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return { groups: [], cost: 0.01 };
  }
}
}