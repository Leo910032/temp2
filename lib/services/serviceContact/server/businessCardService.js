// lib/services/serviceContact/server/businessCardService.js
/**
 * Main Business Card Service - Orchestrates the entire scanning pipeline
 * Routes between Basic (Pro tier) and AI-Enhanced (Premium+ tiers) scanning
 */

import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { ContactCRUDService } from './ContactCRUDService';
import { ContactSecurityService } from './contactSecurityService';
import { CONTACT_LIMITS, CONTACT_FEATURES, CONTACT_ACTIVITIES } from '../client/constants/contactConstants.js';
import { BUSINESS_CARD_AI_CONFIG } from '../../constants/aiCosts.js';
import { API_COSTS } from '../../constants/apiCosts.js';
import { CostTrackingService } from './costTrackingService.js';

// Import specialized processors
import { BusinessCardOCR } from './businessCardService/businessCardOCR';
import { BusinessCardQR } from './businessCardService/businessCardQR';
import { BusinessCardFieldExtractor } from './businessCardService/businessCardFieldExtractor';
import { BusinessCardAI } from './businessCardService/businessCardAI';

// ====================================================================
// Main Business Card Service
// ====================================================================

export class BusinessCardService {
    
    /**
     * Main entry point for business card scanning
     * Routes to appropriate processing pipeline based on subscription tier
     */
    static async processScanRequest({ imageBase64, side, session }) {
        const requestId = `scan_${session.userId.slice(-4)}_${Date.now()}`;
        console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
        console.log(`║  BUSINESS CARD SCAN REQUEST                                    ║`);
        console.log(`╠════════════════════════════════════════════════════════════════╣`);
        console.log(`║  Request ID:      ${requestId.padEnd(42)}║`);
        console.log(`║  User ID:         ${session.userId.slice(-12).padEnd(42)}║`);
        console.log(`║  Subscription:    ${session.subscriptionLevel.toUpperCase().padEnd(42)}║`);
        console.log(`║  Side:            ${side.toUpperCase().padEnd(42)}║`);
        console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

        try {
            // Validate and sanitize image
            const validatedImage = this._validateAndSanitizeImage(imageBase64);

            // Check rate limits
            await ContactSecurityService.checkRateLimit(session.userId, 'scan');

            let scanResult;
            let fallbackReason = null;

            // Route based on permissions with affordability check
            if (session.permissions[CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER]) {
                console.log(`[BusinessCardService] ✨ User has AI_ENHANCED_CARD_SCANNER permission`);

                // Check if user can afford AI scanning
                const costEstimate = this._getCostEstimateForTier(session.subscriptionLevel);
                console.log(`[BusinessCardService] 💰 Checking AI affordability - Estimated cost: $${costEstimate.estimated.toFixed(6)}`);

                const affordabilityCheck = await CostTrackingService.canAffordOperation(
                    session.userId,
                    costEstimate.estimated,
                    1 // requires 1 run
                );

                if (affordabilityCheck.canAfford) {
                    console.log(`[BusinessCardService] ✅ User can afford AI scan - Routing to → AI-ENHANCED PIPELINE\n`);

                    scanResult = await this._processAiEnhancedPipeline(validatedImage, {
                        side, requestId, session
                    });
                } else {
                    // User has AI permission but exceeded limits - fall back to basic
                    console.warn(`[BusinessCardService] ⚠️ User exceeded AI limits (${affordabilityCheck.reason})`);
                    console.warn(`[BusinessCardService] ⚠️ Falling back to → BASIC PIPELINE (No AI)\n`);

                    fallbackReason = affordabilityCheck.reason;
                    scanResult = await this._processBasicPipeline(validatedImage, {
                        side, requestId, session
                    });

                    // Add fallback info to result
                    scanResult.limitReached = true;
                    scanResult.fallbackReason = fallbackReason;
                    scanResult.remainingBudget = affordabilityCheck.remainingBudget;
                    scanResult.remainingRuns = affordabilityCheck.remainingRuns;
                }

            } else if (session.permissions[CONTACT_FEATURES.BASIC_CARD_SCANNER]) {
                console.log(`[BusinessCardService] 📄 User has BASIC_CARD_SCANNER permission`);
                console.log(`[BusinessCardService] 📄 Routing to → BASIC PIPELINE (No AI)\n`);

                scanResult = await this._processBasicPipeline(validatedImage, {
                    side, requestId, session
                });

            } else {
                throw new Error('User does not have permission for any scanner feature.');
            }

            // Cost tracking is now handled by BusinessCardAI via CostTrackingService
            // No need for manual recording here

            // Log activity
            await ContactSecurityService.logContactActivity({
                userId: session.userId,
                action: CONTACT_ACTIVITIES.BUSINESS_CARD_SCANNED,
                details: {
                    fieldsDetected: scanResult.parsedFields?.length || 0,
                    confidence: scanResult.metadata?.confidence || 0,
                    hasQRCode: scanResult.metadata?.hasQRCode || false,
                    processingMethod: scanResult.metadata?.processingMethod
                }
            });

            console.log(`[BusinessCardService] ✅ [${requestId}] Scan complete.`);
            return scanResult;

        } catch (error) {
            console.error(`[BusinessCardService] ❌ [${requestId}] Error:`, error);
            
            if (error.message === 'PLAN_LIMIT_EXCEEDED') {
                throw error;
            }
            
            return this._createFallbackResult(error.message);
        }
    }

    /**
     * Create contact from scan results
     */
    static async createContactFromScan({ parsedFields, session }) {
        console.log(`[BusinessCardService] Creating contact from scan for user: ${session.userId}`);
        
        const contactData = this._mapFieldsToContact(parsedFields);

        const newContact = await ContactCRUDService.createContact({
            contactData,
            session
        });
        
        console.log(`[BusinessCardService] Successfully created contact ${newContact.id}`);
        return newContact.id;
    }

    // ====================================================================
    // Processing Pipelines
    // ====================================================================

    /**
     * Basic pipeline for Pro tier users
     * OCR + QR Code + Pattern Matching (no generative AI)
     */
    static async _processBasicPipeline(imageBase64, { side, requestId, session }) {
        try {
            console.log(`[BusinessCardService] 📄 ============================================`);
            console.log(`[BusinessCardService] 📄 BASIC PIPELINE (Pro Tier - No AI)`);
            console.log(`[BusinessCardService] 📄 ============================================`);

            // Step 1: OCR Processing
            console.log(`[BusinessCardService] 📄 Step 1/6: Running OCR...`);
            const ocrResult = await BusinessCardOCR.processImage(imageBase64);
            console.log(`[BusinessCardService] 📄 OCR Result: ${ocrResult.success ? '✅ Success' : '❌ Failed'} - Confidence: ${ocrResult.confidence}`);

            // Step 2: QR Code Processing
            console.log(`[BusinessCardService] 📄 Step 2/6: Scanning for QR codes...`);
            const qrResult = await BusinessCardQR.processImage(imageBase64);
            console.log(`[BusinessCardService] 📄 QR Result: ${qrResult.hasQRCode ? '✅ QR Code Found' : '❌ No QR Code'}`);

            // Step 3: Merge results
            console.log(`[BusinessCardService] 📄 Step 3/6: Merging OCR and QR data...`);
            const mergedData = this._mergeOcrAndQr(ocrResult, qrResult);
            console.log(`[BusinessCardService] 📄 Merged text length: ${mergedData.extractedText?.length || 0} characters`);

            // Step 4: Extract fields using pattern matching
            console.log(`[BusinessCardService] 📄 Step 4/6: Extracting fields with pattern matching (regex)...`);
            const extractedFields = BusinessCardFieldExtractor.extractFieldsBasic(
                mergedData.extractedText,
                mergedData.qrData
            );
            console.log(`[BusinessCardService] 📄 Extracted ${extractedFields.length} raw fields using regex`);

            // Step 5: Clean and validate
            console.log(`[BusinessCardService] 📄 Step 5/6: Cleaning and validating fields...`);
            const cleanedFields = BusinessCardFieldExtractor.cleanAndDeduplicateFields(extractedFields);
            const validatedFields = BusinessCardFieldExtractor.validateFields(cleanedFields);
            console.log(`[BusinessCardService] 📄 Final result: ${validatedFields.length} validated fields`);

            // Step 6: Track usage (Google Vision API cost)
            console.log(`[BusinessCardService] 📄 Step 6/6: Recording usage in ApiUsage...`);
            const visionApiCost = API_COSTS.GOOGLE_VISION.DOCUMENT_TEXT_DETECTION.PER_REQUEST;
            try {
                await CostTrackingService.recordUsage({
                    userId: session.userId,
                    usageType: 'ApiUsage',
                    feature: 'business_card_scan_basic',
                    cost: visionApiCost, // $0.0015 per Google Vision API call
                    isBillableRun: true, // Basic scan counts as API operation
                    provider: 'google_vision_ocr',
                    sessionId: null, // Single-side basic scan = standalone operation
                    metadata: {
                        side,
                        subscriptionLevel: session.subscriptionLevel,
                        fieldsExtracted: validatedFields.length,
                        hasQRCode: qrResult.hasQRCode,
                        method: 'basic_ocr_qr',
                        requestId,
                        ocrConfidence: ocrResult.confidence
                    }
                });
                console.log(`[BusinessCardService] 📄 ✅ Usage recorded in ApiUsage - Cost: $${visionApiCost.toFixed(6)}`);
            } catch (trackingError) {
                console.error(`[BusinessCardService] 📄 ⚠️ Failed to track usage:`, trackingError.message);
                // Don't fail the scan if tracking fails
            }

            // Step 7: Structure final result
            const finalResult = this._structureFinalResult(validatedFields, {
                ocrSuccess: ocrResult.success,
                qrSuccess: qrResult.success,
                hasQRCode: qrResult.hasQRCode,
                method: 'basic_ocr_qr',
                cost: visionApiCost,
                aiProcessed: false,
                side,
                requestId
            });

            console.log(`[BusinessCardService] 📄 ============================================`);
            console.log(`[BusinessCardService] 📄 BASIC PIPELINE COMPLETE`);
            console.log(`[BusinessCardService] 📄 • Method: Google Vision OCR + Pattern Matching (No AI)`);
            console.log(`[BusinessCardService] 📄 • Fields Found: ${validatedFields.length}`);
            console.log(`[BusinessCardService] 📄 • Cost: $${visionApiCost.toFixed(6)} (Google Vision API)`);
            console.log(`[BusinessCardService] 📄 • Processing Time: Fast`);
            console.log(`[BusinessCardService] 📄 ============================================`);
            
            console.log(`[BusinessCardService] 📄 📋 ============ FINAL RESULT JSON ============`);
            console.log(JSON.stringify(finalResult, null, 2));
            console.log(`[BusinessCardService] 📄 📋 ============================================\n`);
            
            return finalResult;

        } catch (error) {
            console.error(`[BusinessCardService] 📄 ❌ Basic pipeline failed:`, error);
            return this._createFallbackResult(error.message);
        }
    }
    static async processBothSides({ frontImage, backImage, session }) {
    // OCR both sides
    const frontOcr = await BusinessCardOCR.processImage(frontImage);
    const backOcr = await BusinessCardOCR.processImage(backImage);
    
    // QR both sides
    const frontQr = await BusinessCardQR.processImage(frontImage);
    const backQr = await BusinessCardQR.processImage(backImage);
    
    // Merge text from BOTH sides
    const combinedText = [
        frontOcr.text || '',
        backOcr.text || ''
    ].filter(t => t.trim()).join('\n\n--- BACK SIDE ---\n\n');
    
    // Send combined text to AI ONCE
    const aiResult = await BusinessCardAI.enhanceWithGemini({
        extractedText: combinedText, // ← Combined text
        qrData: frontQr.parsedQRData || backQr.parsedQRData,
        side: 'both',
        subscriptionLevel: session.subscriptionLevel,
        language: session.language || 'en'
    });
    
    // Return merged result
    return this._structureFinalResult(/* ... */);
}

    /**
     * AI-Enhanced pipeline for Premium+ tier users
     * OCR + QR Code + Gemini AI Enhancement
     */
    static async _processAiEnhancedPipeline(imageBase64, { side, requestId, session }) {
        // Generate a session ID for multi-step tracking
        const sessionId = `session_scan_${Date.now()}_${session.userId.slice(-4)}`;

        try {
            console.log(`[BusinessCardService] 🤖 ============================================`);
            console.log(`[BusinessCardService] 🤖 AI-ENHANCED PIPELINE (Premium+ Tier)`);
            console.log(`[BusinessCardService] 🤖 ============================================`);
            console.log(`[BusinessCardService] 🤖 Session ID: ${sessionId}`);

            // Step 1: OCR Processing
            console.log(`[BusinessCardService] 🤖 Step 1/7: Running OCR...`);
            const ocrResult = await BusinessCardOCR.processImage(imageBase64);
            console.log(`[BusinessCardService] 🤖 OCR Result: ${ocrResult.success ? '✅ Success' : '❌ Failed'} - Confidence: ${ocrResult.confidence}`);

            // Record OCR cost as Step 0
            const ocrCost = API_COSTS.GOOGLE_VISION.DOCUMENT_TEXT_DETECTION.PER_REQUEST;
            await CostTrackingService.recordUsage({
                userId: session.userId,
                usageType: 'ApiUsage',
                feature: 'business_card_scan_ocr',
                cost: ocrCost,
                isBillableRun: false,
                provider: 'google_vision_ocr',
                sessionId: sessionId,
                metadata: {
                    requestId: requestId,
                    side: side,
                    method: 'document_text_detection',
                    ocrConfidence: ocrResult.confidence || 0,
                    subscriptionLevel: session.subscriptionLevel
                }
            });
            console.log(`[BusinessCardService] 🤖 ✅ Step 0: OCR recorded - Cost: $${ocrCost.toFixed(6)}`);

            // Step 2: QR Code Processing
            console.log(`[BusinessCardService] 🤖 Step 2/7: Scanning for QR codes...`);
            const qrResult = await BusinessCardQR.processImage(imageBase64);
            console.log(`[BusinessCardService] 🤖 QR Result: ${qrResult.hasQRCode ? '✅ QR Code Found' : '❌ No QR Code'}`);

            // Step 3: Merge results
            console.log(`[BusinessCardService] 🤖 Step 3/7: Merging OCR and QR data...`);
            const mergedData = this._mergeOcrAndQr(ocrResult, qrResult);
            console.log(`[BusinessCardService] 🤖 Merged text length: ${mergedData.extractedText?.length || 0} characters`);

            // Step 4: AI Enhancement with Gemini (will be recorded as Step 1)
            console.log(`[BusinessCardService] 🤖 Step 4/7: Enhancing with ${BUSINESS_CARD_AI_CONFIG.MODEL_DISPLAY_NAME} (${session.subscriptionLevel})...`);
            const aiResult = await BusinessCardAI.enhanceWithGemini({
                extractedText: mergedData.extractedText,
                qrData: mergedData.qrData,
                imageBase64,
                side,
                subscriptionLevel: session.subscriptionLevel,
                language: session.language || 'en',
                userId: session.userId,
                trackCosts: true,
                sessionId: sessionId  // Pass session ID for multi-step tracking
            });
            
            if (aiResult.aiProcessed) {
                console.log(`[BusinessCardService] 🤖 AI Enhancement: ✅ Success`);
                console.log(`[BusinessCardService] 🤖 • Standard Fields: ${aiResult.standardFields.length}`);
                console.log(`[BusinessCardService] 🤖 • Dynamic Fields: ${aiResult.dynamicFields.length}`);
                console.log(`[BusinessCardService] 🤖 • AI Cost: ${aiResult.cost.toFixed(6)}`);
                console.log(`[BusinessCardService] 🤖 ✅ Step 1: AI Enhancement recorded - Cost: $${aiResult.cost.toFixed(6)}`);
            } else {
                console.log(`[BusinessCardService] 🤖 AI Enhancement: ❌ Failed - Falling back to pattern matching`);
            }

            // Step 5: Merge AI results with pattern-matched fields
            console.log(`[BusinessCardService] 🤖 Step 5/7: Merging AI results with pattern matching...`);
            const basicFields = BusinessCardFieldExtractor.extractFieldsBasic(
                mergedData.extractedText,
                mergedData.qrData
            );

            const combinedFields = this._mergeAiAndBasicFields(
                aiResult.standardFields,
                aiResult.dynamicFields,
                basicFields
            );
            console.log(`[BusinessCardService] 🤖 Combined: ${combinedFields.length} total fields`);

            // Step 6: Clean and validate
            console.log(`[BusinessCardService] 🤖 Step 6/7: Cleaning and validating...`);
            const cleanedFields = BusinessCardFieldExtractor.cleanAndDeduplicateFields(combinedFields);
            const validatedFields = BusinessCardFieldExtractor.validateFields(cleanedFields);
            console.log(`[BusinessCardService] 🤖 Final result: ${validatedFields.length} validated fields`);

            // Step 7: Finalize session
            console.log(`[BusinessCardService] 🤖 Step 7/7: Finalizing session...`);
            const totalCost = ocrCost + (aiResult.cost || 0);
            try {
                await CostTrackingService.finalizeSession(session.userId, sessionId);
                console.log(`[BusinessCardService] 🤖 ✅ Session finalized: ${sessionId}`);
                console.log(`[BusinessCardService] 🤖 ✅ Total cost: $${totalCost.toFixed(6)} (OCR: $${ocrCost.toFixed(6)} + AI: $${(aiResult.cost || 0).toFixed(6)})`);
            } catch (sessionError) {
                console.error(`[BusinessCardService] ⚠️ Failed to finalize session:`, sessionError.message);
                // Don't fail the entire operation if session finalization fails
            }

            // Structure final result
            const finalResult = this._structureFinalResult(validatedFields, {
                ocrSuccess: ocrResult.success,
                qrSuccess: qrResult.success,
                hasQRCode: qrResult.hasQRCode,
                method: 'ai_enhanced_gemini',
                cost: aiResult.cost,
                aiProcessed: true,
                side,
                requestId,
                subscriptionLevel: session.subscriptionLevel
            });

            console.log(`[BusinessCardService] 🤖 ============================================`);
            console.log(`[BusinessCardService] 🤖 AI-ENHANCED PIPELINE COMPLETE`);
            console.log(`[BusinessCardService] 🤖 • Method: ${BUSINESS_CARD_AI_CONFIG.MODEL_DISPLAY_NAME} + Pattern Matching`);
            console.log(`[BusinessCardService] 🤖 • Fields Found: ${validatedFields.length}`);
            console.log(`[BusinessCardService] 🤖 • Total Cost: $${totalCost.toFixed(6)}`);
            console.log(`[BusinessCardService] 🤖 • Processing Time: AI-powered (slower but more accurate)`);
            console.log(`[BusinessCardService] 🤖 ============================================`);

            return finalResult;

        } catch (error) {
            console.error(`[BusinessCardService] 🤖 ❌ AI pipeline failed:`, error);
            
            // Fallback to basic pipeline if AI fails
            console.log(`[BusinessCardService] 🤖 ⚠️ Falling back to basic pipeline due to AI failure`);
            return this._processBasicPipeline(imageBase64, { side, requestId, session });
        }
    }

    // ====================================================================
    // Helper Methods
    // ====================================================================

    static _validateAndSanitizeImage(imageBase64) {
        if (!imageBase64 || typeof imageBase64 !== 'string') {
            throw new Error('Invalid image data: must be a base64 string');
        }

        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        
        if (!base64Regex.test(cleanBase64)) {
            throw new Error('Invalid base64 format');
        }

        if (cleanBase64.length < 100) {
            throw new Error('Image data too small');
        }

        const estimatedSize = cleanBase64.length * 0.75;
        if (estimatedSize > 15 * 1024 * 1024) {
            throw new Error('Image too large (max 15MB)');
        }

        return cleanBase64;
    }

    static _mergeOcrAndQr(ocrResult, qrResult) {
        return {
            ocrSuccess: ocrResult.success,
            qrSuccess: qrResult.success,
            hasQRCode: qrResult.hasQRCode,
            extractedText: ocrResult.text || '',
            qrData: qrResult.parsedQRData || null,
            textBlocks: ocrResult.blocks || [],
            confidence: ocrResult.confidence || 0
        };
    }

    static _mergeAiAndBasicFields(aiStandard, aiDynamic, basicFields) {
        const allFields = [
            ...aiStandard.map(f => ({ ...f, source: 'ai-gemini' })),
            ...aiDynamic.map(f => ({ ...f, source: 'ai-gemini-dynamic' })),
            ...basicFields.map(f => ({ ...f, source: f.source || 'pattern-match' }))
        ];
        
        return allFields;
    }

    static _structureFinalResult(fields, metadata) {
        // Split into standard and dynamic fields
        const standardLabels = ['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Website', 'Address'];
        const standardFields = fields.filter(f => standardLabels.includes(f.label));
        const dynamicFields = fields.filter(f => !standardLabels.includes(f.label));

        const fieldsWithData = fields.filter(f => f.value && f.value.trim().length > 0);
        const hasRequiredFields = ['Name', 'Email'].every(label => 
            fields.find(f => f.label === label && f.value && f.value.trim().length > 0)
        );

        return {
            success: metadata.ocrSuccess || metadata.qrSuccess,
            standardFields,
            dynamicFields,
            parsedFields: fields,
            metadata: {
                ...metadata,
                fieldsCount: fields.length,
                fieldsWithData: fieldsWithData.length,
                hasRequiredFields,
                processedAt: new Date().toISOString(),
                confidence: this._calculateOverallConfidence(fields)
            }
        };
    }

    static _calculateOverallConfidence(fields) {
        const fieldsWithData = fields.filter(f => f.value && f.value.trim().length > 0 && f.confidence);
        
        if (fieldsWithData.length === 0) return 0;
        
        const totalConfidence = fieldsWithData.reduce((sum, field) => sum + (field.confidence || 0), 0);
        return Math.round((totalConfidence / fieldsWithData.length) * 100) / 100;
    }

    static _mapFieldsToContact(parsedFields) {
        const contactData = {};
        const fieldToKeyMap = {
            'Name': 'displayName',
            'Email': 'email',
            'Phone': 'phone',
            'Company': 'company',
            'Job Title': 'jobTitle',
            'Website': 'website',
            'Address': 'address',
            'LinkedIn': 'linkedin',
        };

        parsedFields.forEach(field => {
            const key = fieldToKeyMap[field.label];
            if (key && !contactData[key]) {
                contactData[key] = field.value;
            }
        });

        return contactData;
    }

   static _getCostEstimateForTier(subscriptionLevel) {
    return { 
        estimated: BUSINESS_CARD_AI_CONFIG.ESTIMATED_COSTS.SINGLE_SIDE_SCAN,
        model: BUSINESS_CARD_AI_CONFIG.MODEL_DISPLAY_NAME
    };
}
    static _createFallbackResult(errorMessage) {
        const fallbackFields = [
            { label: 'Name', value: '', type: 'standard', confidence: 0 },
            { label: 'Email', value: '', type: 'standard', confidence: 0 },
            { label: 'Phone', value: '', type: 'standard', confidence: 0 },
            { label: 'Company', value: '', type: 'standard', confidence: 0 },
            { label: 'Note', value: `Scan failed: ${errorMessage}. Please fill manually.`, type: 'custom', confidence: 1 }
        ];
        
        return {
            success: false,
            error: errorMessage,
            standardFields: fallbackFields.filter(f => f.type === 'standard'),
            dynamicFields: [],
            parsedFields: fallbackFields,
            metadata: {
                hasQRCode: false,
                fieldsCount: fallbackFields.length,
                fieldsWithData: 1,
                hasRequiredFields: false,
                processedAt: new Date().toISOString(),
                processingMethod: 'error_fallback',
                confidence: 0,
                cost: 0
            }
        };
    }
    // Add this method to businessCardService.js
static async processBothSides({ frontImage, backImage, session }) {
    const requestId = `scan_${session.userId.slice(-4)}_${Date.now()}`;
    // Generate a unique session ID for multi-step operation tracking
    const sessionId = `session_scan_${Date.now()}_${session.userId.slice(-4)}`;

    // Detailed logging header
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  BUSINESS CARD SCAN REQUEST (BOTH SIDES)                      ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  Request ID:      ${requestId.padEnd(40)} ║`);
    console.log(`║  Session ID:      ${sessionId.padEnd(40)} ║`);
    console.log(`║  User ID:         ${session.userId.slice(-20).padEnd(40)} ║`);
    console.log(`║  Subscription:    ${session.subscriptionLevel.toUpperCase().padEnd(40)} ║`);
    console.log(`║  Sides:           FRONT + BACK${' '.repeat(38)} ║`);
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    try {
        // Validate both images
        const validatedFront = this._validateAndSanitizeImage(frontImage);
        const validatedBack = this._validateAndSanitizeImage(backImage);

        // Check rate limits
        await ContactSecurityService.checkRateLimit(session.userId, 'scan');

        // Check affordability (counts as 1 AI call, not 2)
        if (session.permissions[CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER]) {
            const costEstimate = this._getCostEstimateForTier(session.subscriptionLevel);
            const affordabilityCheck = await CostTrackingService.canAffordOperation(
                session.userId,
                costEstimate.estimated,
                session.subscriptionLevel
            );

            if (!affordabilityCheck.canAfford) {
                throw new Error('PLAN_LIMIT_EXCEEDED: ' + affordabilityCheck.reason);
            }
        }

        console.log(`[BusinessCardService] 🔄 Step 1/6: OCR processing both sides...`);
        // OCR both sides in parallel
        const [frontOcr, backOcr] = await Promise.all([
            BusinessCardOCR.processImage(validatedFront),
            BusinessCardOCR.processImage(validatedBack)
        ]);
        console.log(`[BusinessCardService] Front OCR: ${frontOcr.success ? '✅' : '❌'}, Back OCR: ${backOcr.success ? '✅' : '❌'}`);

        // Track OCR costs as separate steps for AI-enhanced tier
        if (session.permissions[CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER]) {
            const ocrCostPerImage = API_COSTS.GOOGLE_VISION.DOCUMENT_TEXT_DETECTION.PER_REQUEST;

            // Step 0: Front side OCR
            await CostTrackingService.recordUsage({
                userId: session.userId,
                usageType: 'ApiUsage',
                feature: 'business_card_scan_ocr_front',
                cost: ocrCostPerImage,
                isBillableRun: false,
                provider: 'google_vision_ocr',
                sessionId: sessionId,
                metadata: {
                    requestId: requestId,
                    side: 'front',
                    method: 'document_text_detection',
                    ocrConfidence: frontOcr.confidence || 0,
                    subscriptionLevel: session.subscriptionLevel
                }
            });
            console.log(`[BusinessCardService] 🔄 ✅ Step 0: Front OCR recorded - Cost: $${ocrCostPerImage.toFixed(6)}`);

            // Step 1: Back side OCR
            await CostTrackingService.recordUsage({
                userId: session.userId,
                usageType: 'ApiUsage',
                feature: 'business_card_scan_ocr_back',
                cost: ocrCostPerImage,
                isBillableRun: false,
                provider: 'google_vision_ocr',
                sessionId: sessionId,
                metadata: {
                    requestId: requestId,
                    side: 'back',
                    method: 'document_text_detection',
                    ocrConfidence: backOcr.confidence || 0,
                    subscriptionLevel: session.subscriptionLevel
                }
            });
            console.log(`[BusinessCardService] 🔄 ✅ Step 1: Back OCR recorded - Cost: $${ocrCostPerImage.toFixed(6)}`);
        }

        console.log(`[BusinessCardService] 🔄 Step 2/6: QR processing both sides...`);
        // QR scan both sides in parallel
        const [frontQr, backQr] = await Promise.all([
            BusinessCardQR.processImage(validatedFront),
            BusinessCardQR.processImage(validatedBack)
        ]);
        console.log(`[BusinessCardService] Front QR: ${frontQr.hasQRCode ? '✅' : '❌'}, Back QR: ${backQr.hasQRCode ? '✅' : '❌'}`);

        console.log(`[BusinessCardService] 🔄 Step 3/6: Merging text from both sides...`);
        // Combine text from BOTH sides
        const combinedText = [
            frontOcr.text || '',
            '--- BACK SIDE ---',
            backOcr.text || ''
        ].filter(t => t.trim()).join('\n\n');
        
        console.log(`[BusinessCardService] Combined text length: ${combinedText.length} characters`);

        // Choose QR data (prefer front, fallback to back)
        const qrData = frontQr.parsedQRData || backQr.parsedQRData;
        const hasQRCode = frontQr.hasQRCode || backQr.hasQRCode;

        let aiResult;
        let finalFields;

        // Route based on permissions with affordability check
        if (session.permissions[CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER]) {
            console.log(`[BusinessCardService] 🔄 Step 4/6: Checking AI affordability for double-sided scan...`);

            // Check if user can afford AI scanning (double-sided costs more)
            const costEstimate = this._getCostEstimateForTier(session.subscriptionLevel);
            const doubleSidedCost = costEstimate.estimated * 2; // Approximate double cost

            const affordabilityCheck = await CostTrackingService.canAffordOperation(
                session.userId,
                doubleSidedCost,
                1 // requires 1 run
            );

            if (affordabilityCheck.canAfford) {
                console.log(`[BusinessCardService] 🔄 ✅ User can afford double-sided AI scan`);
                console.log(`[BusinessCardService] 🔄 Step 5/6: Enhancing with AI (will be tracked as Step 2)...`);

                // Send COMBINED text to AI (one call) - will be tracked as Step 2
                aiResult = await BusinessCardAI.enhanceWithGemini({
                    extractedText: combinedText, // ← COMBINED TEXT
                    qrData: qrData,
                    side: 'both',
                    subscriptionLevel: session.subscriptionLevel,
                    language: session.language || 'en',
                    userId: session.userId,
                    trackCosts: true,
                    sessionId: sessionId  // ← Pass sessionId for multi-step tracking
                });
                console.log(`[BusinessCardService] 🔄 ✅ Step 2: AI Enhancement recorded - Cost: $${(aiResult.cost || 0).toFixed(6)}`);
            } else {
                console.warn(`[BusinessCardService] 🔄 ⚠️ User exceeded AI limits (${affordabilityCheck.reason})`);
                console.warn(`[BusinessCardService] 🔄 ⚠️ Falling back to pattern matching only`);

                // Fall back to basic extraction
                aiResult = {
                    aiProcessed: false,
                    standardFields: [],
                    dynamicFields: [],
                    cost: 0,
                    limitReached: true,
                    fallbackReason: affordabilityCheck.reason
                };
            }

            // Merge AI results with pattern matching
            const basicFields = BusinessCardFieldExtractor.extractFieldsBasic(combinedText, qrData);
            const combinedFields = this._mergeAiAndBasicFields(
                aiResult.standardFields || [],
                aiResult.dynamicFields || [],
                basicFields
            );

            console.log(`[BusinessCardService] 🔄 Step 6/6: Cleaning and validating...`);
            const cleanedFields = BusinessCardFieldExtractor.cleanAndDeduplicateFields(combinedFields);
            finalFields = BusinessCardFieldExtractor.validateFields(cleanedFields);

        } else {
            console.log(`[BusinessCardService] 📄 User has BASIC_CARD_SCANNER permission`);
            console.log(`[BusinessCardService] 📄 Routing to → BASIC PIPELINE (No AI) - BOTH SIDES\n`);

            console.log(`[BusinessCardService] 📄 ============================================`);
            console.log(`[BusinessCardService] 📄 BASIC PIPELINE - DOUBLE-SIDED (Pro Tier - No AI)`);
            console.log(`[BusinessCardService] 📄 ============================================`);

            console.log(`[BusinessCardService] 📄 Step 4/6: Extracting fields with pattern matching (regex)...`);
            const extractedFields = BusinessCardFieldExtractor.extractFieldsBasic(combinedText, qrData);
            console.log(`[BusinessCardService] 📄 Extracted ${extractedFields.length} raw fields using regex`);

            console.log(`[BusinessCardService] 📄 Step 5/6: Cleaning and validating fields...`);
            const cleanedFields = BusinessCardFieldExtractor.cleanAndDeduplicateFields(extractedFields);
            finalFields = BusinessCardFieldExtractor.validateFields(cleanedFields);
            console.log(`[BusinessCardService] 📄 Final result: ${finalFields.length} validated fields`);

            // Record OCR cost for both sides as TWO SEPARATE steps
            const ocrCostPerImage = API_COSTS.GOOGLE_VISION.DOCUMENT_TEXT_DETECTION.PER_REQUEST;

            console.log(`[BusinessCardService] 📄 Step 6/6: Recording usage in SessionUsage (2 steps)...`);

            // Step 0: Front side OCR
            await CostTrackingService.recordUsage({
                userId: session.userId,
                usageType: 'ApiUsage',
                feature: 'business_card_scan_basic_front',
                cost: ocrCostPerImage,
                isBillableRun: true, // Count double-sided scan as ONE billable API operation
                provider: 'google_vision_ocr',
                sessionId: sessionId,
                metadata: {
                    requestId: requestId,
                    side: 'front',
                    method: 'basic_ocr_qr',
                    ocrConfidence: frontOcr.confidence || 0,
                    subscriptionLevel: session.subscriptionLevel
                }
            });
            console.log(`[BusinessCardService] 📄 ✅ Step 0: Front side recorded - Cost: $${ocrCostPerImage.toFixed(6)}`);

            // Step 1: Back side OCR
            await CostTrackingService.recordUsage({
                userId: session.userId,
                usageType: 'ApiUsage',
                feature: 'business_card_scan_basic_back',
                cost: ocrCostPerImage,
                isBillableRun: false, // Don't double-count - already counted in front side
                provider: 'google_vision_ocr',
                sessionId: sessionId,
                metadata: {
                    requestId: requestId,
                    side: 'back',
                    method: 'basic_ocr_qr',
                    ocrConfidence: backOcr.confidence || 0,
                    subscriptionLevel: session.subscriptionLevel
                }
            });
            console.log(`[BusinessCardService] 📄 ✅ Step 1: Back side recorded - Cost: $${ocrCostPerImage.toFixed(6)}`);

            const totalOcrCost = ocrCostPerImage * 2;
            console.log(`[BusinessCardService] 📄 ✅ Total cost for both sides: $${totalOcrCost.toFixed(6)}`);

            console.log(`[BusinessCardService] 📄 ============================================`);
            console.log(`[BusinessCardService] 📄 BASIC PIPELINE COMPLETE - DOUBLE-SIDED`);
            console.log(`[BusinessCardService] 📄 • Method: Google Vision OCR + Pattern Matching (No AI)`);
            console.log(`[BusinessCardService] 📄 • Sides: FRONT + BACK`);
            console.log(`[BusinessCardService] 📄 • Fields Found: ${finalFields.length}`);
            console.log(`[BusinessCardService] 📄 • Cost: $${totalOcrCost.toFixed(6)} (Google Vision API × 2)`);
            console.log(`[BusinessCardService] 📄 • Processing Time: Fast`);
            console.log(`[BusinessCardService] 📄 ============================================\n`);

            // Finalize the session for basic tier
            try {
                await CostTrackingService.finalizeSession(session.userId, sessionId);
                console.log(`[BusinessCardService] 📄 ✅ Session finalized: ${sessionId}`);
            } catch (sessionError) {
                console.error(`[BusinessCardService] ⚠️ Failed to finalize session:`, sessionError.message);
                // Don't fail the entire operation if session finalization fails
            }

            aiResult = { cost: 0, aiProcessed: false };
        }

        // Structure final result
        const finalResult = this._structureFinalResult(finalFields, {
            ocrSuccess: frontOcr.success || backOcr.success,
            qrSuccess: frontQr.success || backQr.success,
            hasQRCode: hasQRCode,
            method: aiResult.aiProcessed ? 'ai_enhanced_gemini_both_sides' : 'basic_both_sides',
            cost: aiResult.cost || 0,
            aiProcessed: aiResult.aiProcessed || false,
            side: 'both',
            requestId,
            subscriptionLevel: session.subscriptionLevel
        });

        // Finalize the session if AI was processed
        if (aiResult.aiProcessed) {
            const ocrCost = API_COSTS.GOOGLE_VISION.DOCUMENT_TEXT_DETECTION.PER_REQUEST * 2; // 2 images
            const aiCost = aiResult.cost || 0;
            const totalCost = ocrCost + aiCost;

            try {
                await CostTrackingService.finalizeSession(session.userId, sessionId);
                console.log(`[BusinessCardService] 🔄 ✅ Session finalized: ${sessionId}`);
                console.log(`[BusinessCardService] 🔄 ✅ Total cost: $${totalCost.toFixed(6)} (OCR: $${ocrCost.toFixed(6)} + AI: $${aiCost.toFixed(6)})`);
            } catch (sessionError) {
                console.error(`[BusinessCardService] ⚠️ Failed to finalize session:`, sessionError.message);
                // Don't fail the entire operation if session finalization fails
            }
        }

        // Log the final result JSON
        console.log(`[BusinessCardService] 📄 📋 ============ FINAL RESULT JSON ============`);
        console.log(JSON.stringify(finalResult, null, 2));
        console.log(`[BusinessCardService] 📄 📋 ============================================\n`);

        // Log activity
        await ContactSecurityService.logContactActivity({
            userId: session.userId,
            action: CONTACT_ACTIVITIES.BUSINESS_CARD_SCANNED,
            details: {
                fieldsDetected: finalResult.parsedFields?.length || 0,
                confidence: finalResult.metadata?.confidence || 0,
                hasQRCode: hasQRCode,
                processingMethod: finalResult.metadata?.processingMethod,
                bothSides: true,
                sessionId: sessionId
            }
        });

        console.log(`[BusinessCardService] ✅ [${requestId}] Both-sided scan complete.`);

        return finalResult;

    } catch (error) {
        console.error(`[BusinessCardService] ❌ processBothSides failed:`, error);
        
        if (error.message === 'PLAN_LIMIT_EXCEEDED') {
            throw error;
        }
        
        return this._createFallbackResult(error.message);
    }
}
    
}