// lib/services/serviceContact/server/geminiGroupingEnhancer.js
// AI-Enhanced Grouping using Gemini 1.5 Flash (same as your business card scanner)

import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  SUBSCRIPTION_LEVELS, 
  CONTACT_FEATURES, 
  hasContactFeature 
} from '../client/services/constants/contactConstants';
import { logGeminiEnhancementUsage } from '@/lib/services/logging/usageLogger';

export class GeminiGroupingEnhancer {
  // Add this new static method to your GeminiGroupingEnhancer class

  /**
   * Calculates the actual cost of a Gemini API call based on token usage.
   * @param {object} usageMetadata - The metadata object from the Gemini API response.
   * @returns {number} The calculated cost in USD.
   */
    static calculateRealCost(usageMetadata) {
    if (!usageMetadata) {
      console.warn('⚠️ [Gemini Cost] No usage metadata found, returning fallback cost.');
      return 0.001; // Return a minimal fallback cost
    }

    const { promptTokenCount, candidatesTokenCount } = usageMetadata;

    // Prices for Gemini 1.5 Flash (for requests <= 128k tokens) per 1M tokens
    const INPUT_PRICE_PER_MILLION_TOKENS = 0.075;
    const OUTPUT_PRICE_PER_MILLION_TOKENS = 0.30;

    const inputCost = (promptTokenCount / 1000000) * INPUT_PRICE_PER_MILLION_TOKENS;
    const outputCost = (candidatesTokenCount / 1000000) * OUTPUT_PRICE_PER_MILLION_TOKENS;
    
    const totalCost = inputCost + outputCost;

    console.log(`💰 [Gemini Cost] Input: ${promptTokenCount} tokens ($${inputCost.toFixed(6)}), Output: ${candidatesTokenCount} tokens ($${outputCost.toFixed(6)}), Total: $${totalCost.toFixed(6)}`);

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
  static async enhanceGrouping(contacts, subscriptionLevel, userId, options = {}) {
    console.log(`🤖 [Gemini Enhancer] Starting AI enhancement for ${subscriptionLevel} user with ${contacts.length} contacts`);
    
    const enhancements = [];
    let totalCost = 0;
    
    // ADDED: A small object to track which features ran for the log
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
        featuresRan.smartCompanyMatching.ran = true; // ADDED
        featuresRan.smartCompanyMatching.groupsCreated = companyEnhancement.groups.length; // ADDED
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
        featuresRan.industryDetection.ran = true; // ADDED
        featuresRan.industryDetection.groupsCreated = industryEnhancement.groups.length; // ADDED
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
        featuresRan.relationshipDetection.ran = true; // ADDED
        featuresRan.relationshipDetection.groupsCreated = relationshipEnhancement.groups.length; // ADDED
        console.log(`✅ Relationship detection: ${relationshipEnhancement.groups.length} groups created`);
      } catch (error) {
        console.error('❌ Relationship detection failed:', error);
      }
    }
    
    // ADDED: The entire logging block below
    // ========================================================================
    // LOGGING API USAGE AND COST TO DATABASE
    // This happens asynchronously and does not block the response to the user.
    // ========================================================================
    if (userId) { // Only log if a userId was provided
      const aiProcessed = enhancements.length > 0;
      let status = 'no_op'; // Default status if nothing ran or created groups
      if (aiProcessed) {
        // Check if all attempted features produced groups
        const allSucceeded = Object.values(featuresRan).every(f => !f.ran || (f.ran && f.groupsCreated > 0));
        status = allSucceeded ? 'success' : 'partial_success';
      }

      const logData = {
        userId: userId,
        status: status,
        cost: totalCost,
        model: 'gemini-1.5-flash',
        subscriptionLevel: subscriptionLevel,
        contactsProcessed: contacts.length,
        details: {
          totalGroupsCreated: enhancements.length,
          features: featuresRan
        }
      };
      // Call the logger service (don't wait for it to complete to avoid slowing down response)
      logGeminiEnhancementUsage(logData);
    } else {
        console.warn('⚠️ [Gemini Enhancer] No userId provided, skipping usage logging.');
    }
    // ========================================================================
    // END OF ADDED LOGGING BLOCK
    // ========================================================================

    return {
      enhancedGroups: enhancements,
      totalCost,
      aiProcessed: enhancements.length > 0,
      aiModel: 'gemini-1.5-flash',
      subscriptionLevel
    };
  }
/**
   * PREMIUM FEATURE: Smart Company Matching
   * Normalizes company names and finds variants that should be grouped together
   */
  static async smartCompanyMatching(contacts) {
    const companies = [...new Set(contacts.map(c => c.company).filter(Boolean))];
    
    if (companies.length < 2 || companies.length > 50) {
      return { groups: [], cost: 0 };
    }

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `You are an expert at normalizing and matching company names. Analyze these company names and group variants of the same company together.

Company names: ${JSON.stringify(companies)}

Rules:
- Group obvious variants (Microsoft Corp, Microsoft Inc, Microsoft)  
- Group subsidiaries with parents where obvious (YouTube with Google/Alphabet)
- Keep separate companies separate (don't merge Apple and Microsoft)
- Remove common suffixes (Inc, Corp, LLC, Ltd) when grouping
- Account for acquisitions (Instagram → Meta/Facebook)

Return ONLY a valid JSON object in this exact format:
{
  "groups": [
    {
      "canonical_name": "Microsoft", 
      "variants": ["Microsoft Corp", "Microsoft Inc", "Microsoft"],
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
      
      // ADDED: Calculate real cost from API response
      const usageMetadata = result.response.usageMetadata;
      const realCost = this.calculateRealCost(usageMetadata);

      const response = await result.response;
      const responseText = response.text();
      
      console.log('🤖 Gemini company matching response:', responseText.substring(0, 200));
      // ==================== LOGGING ADDED ====================
      console.log(`\n-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=`);
      console.log(`⬅️ [Gemini Output - smartCompanyMatching]`);
      console.log(responseText);
      console.log(`-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n`);
      // =======================================================
      // Parse JSON response (same robust parsing as your business card scanner)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("AI did not return valid JSON for company matching");
      }
      
      const parsedJson = JSON.parse(jsonMatch[0]);
      const aiGroups = parsedJson.groups || [];

      // Convert AI groups to contact groups
      const contactGroups = [];
      aiGroups.forEach(aiGroup => {
        if (aiGroup.variants && aiGroup.variants.length >= 2) {
          // Find contacts for these company variants
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
                aiModel: 'gemini-1.5-flash',
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
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
}`;
      // ==================== LOGGING ADDED ====================
      console.log(`\n-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=`);
      console.log(`➡️ [Gemini Input - industryGrouping]`);
      console.log(prompt);
      console.log(`-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n`);
      // =======================================================

      const result = await model.generateContent(prompt);

      // ADDED: Calculate real cost from API response
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
            aiModel: 'gemini-1.5-flash',
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
   * ENTERPRISE FEATURE: Relationship Detection
   * Finds potential business relationships, partnerships, client connections
   */
  static async relationshipDetection(contacts) {
    const contactData = contacts.map(c => ({
      id: c.id,
      name: c.name,
      company: c.company || 'Unknown',
      title: c.jobTitle || '',
      email: c.email || '',
      // Include any notes/messages that might indicate relationships
      notes: c.message || c.details?.find(d => d.label.toLowerCase().includes('note'))?.value || ''
    }));

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Analyze these business contacts for potential relationships, partnerships, or business connections. Look for:

- Client/vendor relationships
- Companies in the same supply chain  
- Complementary business services
- People who likely work together on projects
- Strategic partnerships or alliances

Contacts: ${JSON.stringify(contactData.slice(0, 20))} ${contactData.length > 20 ? '...(truncated)' : ''}

Return ONLY valid JSON:
{
  "relationship_groups": [
    {
      "relationship_type": "client_vendor", 
      "group_name": "Payment Processing Partners",
      "contact_ids": ["id1", "id2"],
      "reasoning": "Stripe processes payments for e-commerce companies"
    }
  ]
}`;     // ==================== LOGGING ADDED ====================
      console.log(`\n-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=`);
      console.log(`➡️ [Gemini Input - relationshipDetection]`);
      console.log(prompt);
      console.log(`-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n`);
      // =======================================================

      const result = await model.generateContent(prompt);

      // ADDED: Calculate real cost from API response
      const usageMetadata = result.response.usageMetadata;
      const realCost = this.calculateRealCost(usageMetadata);

      const response = await result.response;
      const responseText = response.text();
    // ==================== LOGGING ADDED ====================
      console.log(`\n-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=`);
      console.log(`⬅️ [Gemini Output - relationshipDetection]`);
      console.log(responseText);
      console.log(`-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n`);
      // =======================================================
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("AI did not return valid JSON for relationship detection");
      }
      
      const parsedJson = JSON.parse(jsonMatch[0]);
      const relationshipGroups = parsedJson.relationship_groups || [];

      const contactGroups = relationshipGroups
        .filter(group => group.contact_ids && group.contact_ids.length >= 2)
        .map(group => ({
          id: `ai_relationship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: group.group_name,
          type: 'ai_relationship',
          contactIds: group.contact_ids,
          description: `AI-detected relationship: ${group.reasoning}`,
          metadata: {
            aiGenerated: true,
            aiModel: 'gemini-1.5-flash',
            relationshipType: group.relationship_type,
            reasoning: group.reasoning,
            confidence: 0.7, // Lower confidence for relationship detection
            feature: 'relationship_detection'
          },
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString()
        }));

      return { 
        groups: contactGroups, 
        cost: realCost // MODIFIED: Use calculated real cost
      };

    } catch (error) {
      console.error('❌ Relationship detection failed:', error);
      return { groups: [], cost: 0.01 };
    }
  }
}