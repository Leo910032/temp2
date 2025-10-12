// lib/services/serviceContact/server/businessCardAI.js
/**
 * AI Enhancement Module for Business Card Scanning
 * Uses Google Gemini for intelligent field extraction
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { BUSINESS_CARD_AI_CONFIG } from '../../constants/aiCosts.js';
import { CONTACT_FEATURES, hasContactFeature } from '../client/constants/contactConstants.js';
import { CostTrackingService } from './costTrackingService.js';

export class BusinessCardAI {

    /**
     * Enhance extraction with Gemini AI
     * @param {string} userId - The user ID for cost tracking
     * @param {boolean} trackCosts - Whether to track costs (default: true)
     * @param {string|null} sessionId - Optional session ID for multi-step operations (default: null)
     */
    static async enhanceWithGemini({ extractedText, qrData, imageBase64, side, subscriptionLevel, language, userId, trackCosts = true, sessionId = null }) {
        console.log('[AI] 🤖 Starting Gemini enhancement...');
        console.log(`[AI] Text length: ${extractedText?.length || 0} characters`);

        // Validate we have enough text to process
        if (!extractedText || extractedText.trim().length < 10) {
            console.warn('[AI] ⚠️ Not enough text to process with AI.');
            return {
                standardFields: [],
                dynamicFields: [],
                cost: 0,
                aiProcessed: false,
                error: 'Insufficient text for AI processing'
            };
        }

        // Validate userId if cost tracking is enabled
        if (trackCosts && !userId) {
            console.warn('[AI] ⚠️ Cost tracking enabled but no userId provided. Disabling cost tracking.');
            trackCosts = false;
        }

        try {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error("GEMINI_API_KEY is not set in environment variables");
            }

            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: BUSINESS_CARD_AI_CONFIG.MODEL_NAME
            });

            // Build prompt
            const prompt = this._buildPrompt({
                extractedText,
                qrData,
                side,
                subscriptionLevel,
                language
            });

            console.log('[AI] Sending request to Gemini...');
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const responseText = response.text();

            console.log('[AI] Parsing JSON from response...');

            // Robust JSON extraction
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('[AI] ❌ Response did not contain JSON');
                throw new Error('AI did not return a valid JSON object');
            }

            const jsonString = jsonMatch[0];
            const parsedJson = JSON.parse(jsonString);

            // Process AI extracted fields
            const { standardFields, dynamicFields } = this._processAIFields(
                parsedJson,
                side,
                subscriptionLevel
            );

            // Calculate cost based on actual token usage
            const cost = this._calculateCost(response.usageMetadata);

            console.log(`[AI] ✅ Enhancement complete. Found ${standardFields.length} standard + ${dynamicFields.length} dynamic fields. Cost: $${cost.toFixed(6)}`);

            // Track costs using CostTrackingService if enabled
            if (trackCosts && userId) {
                try {
                    // If sessionId is provided, this will be recorded in SessionUsage
                    // If sessionId is null, this will be recorded in AIUsage
                    await CostTrackingService.recordUsage({
                        userId,
                        usageType: 'AIUsage',
                        feature: 'business_card_scan',
                        cost: cost,
                        isBillableRun: true,
                        provider: BUSINESS_CARD_AI_CONFIG.MODEL_NAME,
                        sessionId: sessionId, // null for single-side, provided for double-side
                        metadata: {
                            side,
                            subscriptionLevel,
                            standardFieldsCount: standardFields.length,
                            dynamicFieldsCount: dynamicFields.length,
                            fieldsExtracted: standardFields.length + dynamicFields.length,
                            inputTokens: response.usageMetadata?.promptTokenCount || 0,
                            outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
                            textLength: extractedText.length,
                            hasQrData: !!qrData?.contactData
                        }
                    });

                    const recordLocation = sessionId ? 'SessionUsage' : 'AIUsage';
                    console.log(`[AI] 💰 Cost tracked successfully in ${recordLocation}`);
                } catch (trackingError) {
                    console.error('[AI] ⚠️ Failed to track costs:', trackingError.message);
                    // Don't fail the entire operation if cost tracking fails
                }
            }

            return {
                standardFields,
                dynamicFields,
                cost,
                aiProcessed: true,
                model: BUSINESS_CARD_AI_CONFIG.MODEL_DISPLAY_NAME,
                modelId: BUSINESS_CARD_AI_CONFIG.MODEL_NAME,
                usage: {
                    inputTokens: response.usageMetadata?.promptTokenCount || 0,
                    outputTokens: response.usageMetadata?.candidatesTokenCount || 0
                }
            };

        } catch (error) {
            console.error('[AI] ❌ Enhancement failed:', error.message);
            return {
                standardFields: [],
                dynamicFields: [],
                cost: 0,
                aiProcessed: false,
                error: error.message
            };
        }
    }

    /**
     * Build Gemini prompt (based on your proven implementation)
     */
    static _buildPrompt({ extractedText, qrData, side, subscriptionLevel, language }) {
        const hasAiEnhanced = hasContactFeature(
            subscriptionLevel,
            CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER
        );

        const prompt = `You are an expert business card information extractor.

INSTRUCTIONS:
1. Extract ALL contact information from the business card text below
2. Return your response ONLY as a valid JSON object
3. Do NOT include markdown formatting like \`\`\`json
4. Do NOT include any explanations or additional text
5. Use null for fields you cannot find
6. If multiple phone numbers exist, include ALL of them separated by semicolons

REQUIRED FIELDS (extract if present):
- name: Full name of the person
- email: Email address (lowercase)
- phone: Phone number(s) - if multiple, separate with semicolon (;)
- company: Company/organization name
- jobTitle: Job title or position
- companyTagline: Company slogan or tagline
- website: Website URL (include https://)
- address: Physical address

${this._getAdditionalFieldsInstructions(subscriptionLevel)}

FORMATTING RULES:
- Email: Must be lowercase
- Phone: Keep country code if present (e.g., +1), remove other formatting. Multiple numbers separated by semicolon
- Website: Include full URL with https://
- All text: Trim whitespace

${qrData?.contactData ? `\nQR CODE DATA (most reliable, prioritize this):\n${JSON.stringify(qrData.contactData, null, 2)}\n` : ''}

BUSINESS CARD TEXT (${side} side):
---
${extractedText}
---

Return ONLY valid JSON with this structure:
{
  "name": "...",
  "email": "...",
  "phone": "...",
  "company": "...",
  "jobTitle": "...",
  "companyTagline": "...",
  "website": "...",
  "address": "..."
}`;

        return prompt;
    }

    /**
     * Get additional fields instructions based on subscription tier
     */
    static _getAdditionalFieldsInstructions(subscriptionLevel) {
        // Check if user has AI-enhanced scanner (premium+)
        const hasAiEnhanced = hasContactFeature(
            subscriptionLevel,
            CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER
        );

        if (hasAiEnhanced) {
            return `ADDITIONAL FIELDS (also extract):
- linkedin: LinkedIn URL
- twitter: Twitter/X handle or URL
- companyTagline: Company slogan or tagline
- certifications: Professional certifications
- facebook: Facebook URL (Business/Enterprise only)
- instagram: Instagram handle (Business/Enterprise only)
- skills: Key skills mentioned (Business/Enterprise only)
- department: Department name (Business/Enterprise only)
- fax: Fax number if present (Business/Enterprise only)`;
        }

        return ''; // Base and Pro tiers get standard fields only
    }

    /**
     * Process AI extracted fields
     */
    static _processAIFields(parsedJson, side, subscriptionLevel) {
        const standardFields = [];
        const dynamicFields = [];

        const standardFieldMap = {
            'name': 'Name',
            'email': 'Email',
            'phone': 'Phone',
            'company': 'Company',
            'jobtitle': 'Job Title',
            'website': 'Website',
            'address': 'Address'
        };

        for (const [key, value] of Object.entries(parsedJson)) {
            if (!value || value === null || (typeof value === 'string' && !value.trim())) {
                continue;
            }

            const normalizedKey = key.toLowerCase();
            const standardLabel = standardFieldMap[normalizedKey];

            if (standardLabel) {
                // Standard field
                standardFields.push({
                    label: standardLabel,
                    value: this._cleanValue(value, standardLabel),
                    type: 'standard',
                    confidence: 0.9,
                    source: `ai-gemini-${side}`
                });
            } else if (subscriptionLevel !== 'base' && subscriptionLevel !== 'pro') {
                // Dynamic field (only for premium+)
                const dynamicLabel = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();
                dynamicFields.push({
                    label: dynamicLabel,
                    value: this._cleanValue(value, dynamicLabel),
                    type: 'custom',
                    confidence: 0.85,
                    source: `ai-gemini-${side}-dynamic`
                });
            }
        }

        return { standardFields, dynamicFields };
    }

    /**
     * Clean and normalize field values
     */
    static _cleanValue(value, label) {
        if (typeof value !== 'string') {
            return String(value);
        }

        let cleaned = value.trim();

        switch (label.toLowerCase()) {
            case 'email':
                cleaned = cleaned.toLowerCase();
                break;

            case 'phone':
                // Handle multiple phone numbers separated by semicolon
                if (cleaned.includes(';')) {
                    const phones = cleaned.split(';').map(p => p.trim());
                    return phones.map(phone => phone.replace(/[^\d+]/g, '')).join('; ');
                }
                // Single phone number
                cleaned = cleaned.replace(/[^\d+]/g, '');
                break;

            case 'website':
                if (!cleaned.startsWith('http')) {
                    cleaned = 'https://' + cleaned;
                }
                break;
        }

        return cleaned;
    }

    /**
     * Calculate actual API cost based on token usage
     * Uses pricing from BUSINESS_CARD_AI_CONFIG
     */
    static _calculateCost(usageMetadata) {
        if (!usageMetadata) {
            return BUSINESS_CARD_AI_CONFIG.ESTIMATED_COSTS.SINGLE_SIDE_SCAN; // Fallback to estimated cost
        }

        const { promptTokenCount, candidatesTokenCount } = usageMetadata;

        // Use pricing from config
        const inputCost = (promptTokenCount / 1000000) * BUSINESS_CARD_AI_CONFIG.PRICING.INPUT_TEXT_PER_MILLION;
        const outputCost = (candidatesTokenCount / 1000000) * BUSINESS_CARD_AI_CONFIG.PRICING.OUTPUT_PER_MILLION;

        return inputCost + outputCost;
    }
}
