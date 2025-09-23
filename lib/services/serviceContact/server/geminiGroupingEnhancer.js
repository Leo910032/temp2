//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// lib/services/serviceContact/server/geminiGroupingEnhancer.js
// Updated with subscription-based model selection and cost budgeting

import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  SUBSCRIPTION_LEVELS, 
  CONTACT_FEATURES, 
  hasContactFeature,
  AI_FEATURE_MATRIX,
  getAIFeaturesForLevel
} from '../client/constants/contactConstants.js'
import { CostTrackingService } from './costTrackingService.js'; 
import { logGeminiEnhancementUsage } from '../../logging/usageLogger.js';

/**
 * Updated model configuration - removed test models, focused on production
 */
const MODELS = {
  // Standard model for all tiers
  'gemini-2.0-flash': { 
    id: 'gemini-2.0-flash',
    inputPrice: 0.10,
    outputPrice: 0.40,
    isActive: true,
    tier: 'standard',
    description: 'Fast and efficient for most AI grouping tasks'
  },
  
  // Premium model for Enterprise deep analysis only
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro', 
    inputPrice: 1.25,
    outputPrice: 10.00,
    isActive: false,
    tier: 'premium',
    description: 'Advanced model for complex strategic analysis'
  }
};

export class GeminiGroupingEnhancer {
  
  /**
   * Get the appropriate model based on subscription and deep analysis setting
   */
  static getModelForSubscription(subscriptionLevel, useDeepAnalysis = false) {
    // Only Enterprise can use deep analysis
    if (subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE && useDeepAnalysis) {
      console.log(`🧠 [Model Selection] Enterprise user requesting deep analysis - using premium model`);
      return MODELS['gemini-2.5-pro'];
    }
    
    // All other users get standard model
    console.log(`⚡ [Model Selection] Standard model for ${subscriptionLevel} user`);
    return MODELS['gemini-2.0-flash'];
  }

  /**
   * Calculate estimated cost before operation
   */
  static estimateOperationCost(subscriptionLevel, options = {}) {
    const useDeepAnalysis = options.useDeepAnalysis && subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE;
    const availableFeatures = getAIFeaturesForLevel(subscriptionLevel);
    
    let estimatedCost = 0;
    let featuresCount = 0;
    
    // Count enabled features that are available for this subscription
    if (options.groupByCompany !== false && availableFeatures.smartCompanyMatching) {
      estimatedCost += useDeepAnalysis ? 0.005 : 0.0002;
      featuresCount++;
    }
    
    if (options.groupByIndustry && availableFeatures.industryDetection) {
      estimatedCost += useDeepAnalysis ? 0.010 : 0.0004;
      featuresCount++;
    }
    
    if (options.groupByRelationships && availableFeatures.relationshipDetection) {
      estimatedCost += useDeepAnalysis ? 0.020 : 0.001;
      featuresCount++;
    }
    
    // Minimum cost and realistic baseline
    const finalCost = Math.max(estimatedCost, 0.0001);
    
    console.log(`💰 [Cost Estimation] ${subscriptionLevel} user, ${featuresCount} features, deep analysis: ${useDeepAnalysis}, estimated: $${finalCost.toFixed(6)}`);
    
    return {
      estimatedCost: finalCost,
      featuresCount,
      useDeepAnalysis,
      model: useDeepAnalysis ? 'gemini-2.5-pro' : 'gemini-2.0-flash'
    };
  }

  /**
   * Main method: Enhanced with cost tracking and budget enforcement
   */
  static async enhanceGrouping(contacts, subscriptionLevel, userId, options = {}) {
    console.log(`🤖 [Gemini Enhancer] Starting AI enhancement for ${subscriptionLevel} user with ${contacts.length} contacts`);
    console.log(`🤖 [Gemini Enhancer] Received options:`, options); // Add a log to be sure

    try {
      // Step 1: Get cost estimate
      const costEstimate = this.estimateOperationCost(subscriptionLevel, options);
      console.log(`📊 [Gemini Enhancer] Estimated cost: $${costEstimate.estimatedCost.toFixed(6)}`);
      
      // Step 2: Check if user can afford this operation
      const affordabilityCheck = await CostTrackingService.canAffordOperation(
        userId, 
        costEstimate.estimatedCost,
        1 // require 1 run
      );
      
      if (!affordabilityCheck.canAfford) {
        console.log(`❌ [Gemini Enhancer] User cannot afford operation: ${affordabilityCheck.reason}`);
        
        // Return appropriate error based on reason
        if (affordabilityCheck.reason === 'budget_exceeded') {
          throw new Error(`Monthly AI budget exceeded. Used: $${affordabilityCheck.currentUsage.toFixed(4)}, Limit: Budget limit reached. Please upgrade your plan or wait until next month.`);
        } else if (affordabilityCheck.reason === 'runs_exceeded') {
          throw new Error(`Monthly AI runs limit exceeded. Used: ${affordabilityCheck.currentRuns} runs. Please upgrade your plan or wait until next month.`);
        }
        
        throw new Error('AI operation not available on current plan');
      }
      
      // Step 3: Select model and get available features
      const selectedModel = this.getModelForSubscription(subscriptionLevel, options.useDeepAnalysis);
      const availableFeatures = getAIFeaturesForLevel(subscriptionLevel);
      
      console.log(`🎯 [Gemini Enhancer] Using model: ${selectedModel.id}, Available features:`, Object.keys(availableFeatures).filter(k => availableFeatures[k]));
      
      // Step 4: Run AI enhancements based on available features
      const enhancements = [];
      let totalCost = 0;
      
      const featuresRan = {
        smartCompanyMatching: { ran: false, groupsCreated: 0, cost: 0 },
        industryDetection: { ran: false, groupsCreated: 0, cost: 0 },
        relationshipDetection: { ran: false, groupsCreated: 0, cost: 0 },
      };

      // Smart Company Matching (Available for Pro+)
      if (availableFeatures.smartCompanyMatching && options.useSmartCompanyMatching) {
        try {
          const companyEnhancement = await this.smartCompanyMatching(contacts, selectedModel);
          enhancements.push(...companyEnhancement.groups);
          totalCost += companyEnhancement.cost;
          featuresRan.smartCompanyMatching.ran = true;
          featuresRan.smartCompanyMatching.groupsCreated = companyEnhancement.groups.length;
          featuresRan.smartCompanyMatching.cost = companyEnhancement.cost;
                    console.log(`✅ Smart company matching ran.`);

          // Record usage immediately after each feature
          await CostTrackingService.recordUsage(
            userId, 
            companyEnhancement.cost, 
            selectedModel.id, 
            'smart_company_matching',
            { contactsProcessed: contacts.length, groupsCreated: companyEnhancement.groups.length }
          );
          
          console.log(`✅ Smart company matching: ${companyEnhancement.groups.length} groups, ${companyEnhancement.cost.toFixed(6)}`);
        } catch (error) {
          console.error('❌ Smart company matching failed:', error);
        }
      }

      // Industry Detection (Available for Premium+)
      if (availableFeatures.industryDetection && options.useIndustryDetection && contacts.length >= 10) {
        try {
          const industryEnhancement = await this.industryGrouping(contacts, selectedModel);
          enhancements.push(...industryEnhancement.groups);
          totalCost += industryEnhancement.cost;
          featuresRan.industryDetection.ran = true;
          featuresRan.industryDetection.groupsCreated = industryEnhancement.groups.length;
          featuresRan.industryDetection.cost = industryEnhancement.cost;
                    console.log(`✅ Industry detection ran.`);

          await CostTrackingService.recordUsage(
            userId, 
            industryEnhancement.cost, 
            selectedModel.id, 
            'industry_detection',
            { contactsProcessed: contacts.length, groupsCreated: industryEnhancement.groups.length }
          );
          
          console.log(`✅ Industry detection: ${industryEnhancement.groups.length} groups, ${industryEnhancement.cost.toFixed(6)}`);
        } catch (error) {
          console.error('❌ Industry detection failed:', error);
        }
      }

      // Relationship Detection (Available for Business+)
      if (availableFeatures.relationshipDetection && options.useRelationshipDetection && contacts.length >= 5) {
        try {
          const relationshipEnhancement = await this.relationshipDetection(contacts, selectedModel);
          enhancements.push(...relationshipEnhancement.groups);
          totalCost += relationshipEnhancement.cost;
          featuresRan.relationshipDetection.ran = true;
          featuresRan.relationshipDetection.groupsCreated = relationshipEnhancement.groups.length;
          featuresRan.relationshipDetection.cost = relationshipEnhancement.cost;
                    console.log(`✅ Relationship detection ran.`);

          await CostTrackingService.recordUsage(
            userId, 
            relationshipEnhancement.cost, 
            selectedModel.id, 
            'relationship_detection',
            { contactsProcessed: contacts.length, groupsCreated: relationshipEnhancement.groups.length }
          );
          
          console.log(`✅ Relationship detection: ${relationshipEnhancement.groups.length} groups, ${relationshipEnhancement.cost.toFixed(6)}`);
        } catch (error) {
          console.error('❌ Relationship detection failed:', error);
        }
      }
      
      // Step 5: Log overall usage for analytics
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
          model: selectedModel.id,
          subscriptionLevel: subscriptionLevel,
          contactsProcessed: contacts.length,
          useDeepAnalysis: options.useDeepAnalysis || false,
          details: {
            totalGroupsCreated: enhancements.length,
            features: featuresRan,
            costEstimate: costEstimate.estimatedCost,
            actualCost: totalCost
          }
        };
        logGeminiEnhancementUsage(logData);
      }

      return {
        enhancedGroups: enhancements,
        totalCost,
        aiProcessed: enhancements.length > 0,
        aiModel: selectedModel.id,
        subscriptionLevel,
        useDeepAnalysis: options.useDeepAnalysis || false,
        featuresUsed: Object.keys(featuresRan).filter(f => featuresRan[f].ran),
        remainingBudget: affordabilityCheck.remainingBudget - totalCost
      };

    } catch (error) {
      console.error('❌ [Gemini Enhancer] Enhancement failed:', error);
      throw error;
    }
  }

  /**
   * Calculate the actual cost of a Gemini API call
   */
  static calculateRealCost(usageMetadata, model) {
    if (!usageMetadata) {
      console.warn('⚠️ [Gemini Cost] No usage metadata found, returning fallback cost.');
      return 0.001;
    }

    const { promptTokenCount, candidatesTokenCount } = usageMetadata;
    const { inputPrice, outputPrice } = model;

    const inputCost = (promptTokenCount / 1000000) * inputPrice;
    const outputCost = (candidatesTokenCount / 1000000) * outputPrice;
    
    const totalCost = inputCost + outputCost;

    console.log(`💰 [Gemini Cost - ${model.id}] Input: ${promptTokenCount} tokens (${inputCost.toFixed(6)}), Output: ${candidatesTokenCount} tokens (${outputCost.toFixed(6)}), Total: ${totalCost.toFixed(6)}`);

    return totalCost;
  }
  
  /**
   * Determine if user can access AI grouping features based on subscription
   */
  static canUseAIGrouping(subscriptionLevel, feature) {
    const availableFeatures = getAIFeaturesForLevel(subscriptionLevel);
    return availableFeatures[feature] || false;
  }

  /**
   * PREMIUM FEATURE: Smart Company Matching - Updated to use dynamic model
   */
  static async smartCompanyMatching(contacts, model) {
    const companies = [...new Set(contacts.map(c => c.company).filter(Boolean))];
    
    if (companies.length < 2 || companies.length > 50) {
      return { groups: [], cost: 0 };
    }

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const geminiModel = genAI.getGenerativeModel({ model: model.id });

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

      const result = await geminiModel.generateContent(prompt);
      
      const usageMetadata = result.response.usageMetadata;
      const realCost = this.calculateRealCost(usageMetadata, model);

      const response = await result.response;
      const responseText = response.text();
      
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
                aiModel: model.id,
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
        cost: realCost
      };

    } catch (error) {
      console.error('❌ Gemini company matching failed:', error);
      return { groups: [], cost: 0.005 };
    }
  }

  /**
   * BUSINESS FEATURE: Industry Detection - Updated to use dynamic model
   */
  static async industryGrouping(contacts, model) {
    const contactSummaries = contacts.map(c => ({
      id: c.id,
      company: c.company || 'Unknown',
      title: c.jobTitle || c.details?.find(d => d.label.toLowerCase().includes('title'))?.value || ''
    }));

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const geminiModel = genAI.getGenerativeModel({ model: model.id });

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

      const result = await geminiModel.generateContent(prompt);

      const usageMetadata = result.response.usageMetadata;
      const realCost = this.calculateRealCost(usageMetadata, model);

      const response = await result.response;
      const responseText = response.text();

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
            aiModel: model.id,
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
        cost: realCost
      };

    } catch (error) {
      console.error('❌ Industry grouping failed:', error);
      return { groups: [], cost: 0.005 };
    }
  }

  /**
   * ENTERPRISE FEATURE: Relationship Detection - Updated to use dynamic model
   */
  static async relationshipDetection(contacts, model) {
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
      const geminiModel = genAI.getGenerativeModel({ model: model.id });

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

      const result = await geminiModel.generateContent(prompt);
      
      const usageMetadata = result.response.usageMetadata;
      const realCost = this.calculateRealCost(usageMetadata, model); 
      
      const response = await result.response;
      const responseText = response.text();
     
      // Comprehensive parsing logic
      let relationshipGroups = [];
      
      try {
        const cleanedResponse = responseText
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
        
        let jsonMatch = cleanedResponse.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        
        if (!jsonMatch) {
          throw new Error("No valid JSON found in response");
        }
        
        const parsedResponse = JSON.parse(jsonMatch[0]);
        
        if (Array.isArray(parsedResponse)) {
          relationshipGroups = parsedResponse;
        } else if (parsedResponse.relationship_groups && Array.isArray(parsedResponse.relationship_groups)) {
          relationshipGroups = parsedResponse.relationship_groups;
        } else if (parsedResponse.groups && Array.isArray(parsedResponse.groups)) {
          relationshipGroups = parsedResponse.groups;
        } else if (parsedResponse.relationship_type) {
          relationshipGroups = [parsedResponse];
        } else {
          const arrayProperties = Object.values(parsedResponse).filter(val => Array.isArray(val));
          if (arrayProperties.length > 0) {
            relationshipGroups = arrayProperties[0];
          } else {
            relationshipGroups = [];
          }
        }
        
      } catch (parseError) {
        console.error("❌ JSON parsing failed:", parseError);
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }

      if (!Array.isArray(relationshipGroups)) {
        relationshipGroups = [];
      }

      const contactGroups = relationshipGroups
        .filter((group, index) => {
          if (!group || typeof group !== 'object') {
            return false;
          }
          
          const contactIds = group.contact_ids || group.contactIds || [];
          if (!Array.isArray(contactIds) || contactIds.length < 2) {
            return false;
          }
          
          const validContactIds = contactIds.filter(id => 
            contactData.some(contact => contact.id === id)
          );
          
          return validContactIds.length >= 2;
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
              aiModel: model.id,
              relationshipType: group.relationship_type || 'unknown',
              reasoning: group.reasoning || 'No reasoning provided',
              confidence: 0.85,
              feature: 'relationship_detection'
            },
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
          };
        });

      return { 
        groups: contactGroups, 
        cost: realCost
      };

    } catch (error) {
      console.error('❌ Relationship detection failed:', error);
      return { groups: [], cost: 0.01 };
    }
  }
}