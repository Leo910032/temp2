// lib/services/serviceContact/server/businessCardService.js
/**
 * Main Business Card Service - Orchestrates the entire scanning pipeline
 * Routes between Basic (Pro tier) and AI-Enhanced (Premium+ tiers) scanning
 */

import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { ContactCRUDService } from './ContactCRUDService';
import { ContactSecurityService } from './contactSecurityService';
import { CONTACT_LIMITS, CONTACT_FEATURES, CONTACT_ACTIVITIES } from '../../constants';

// Import specialized processors
import { BusinessCardOCR } from './businessCardOCR';
import { BusinessCardQR } from './businessCardQR';
import { BusinessCardFieldExtractor } from './businessCardFieldExtractor';
import { BusinessCardAI } from './businessCardAI';

// ====================================================================
// Helper Functions
// ====================================================================

async function canAffordOperation(session, estimatedCost, requiredRuns) {
    const { subscriptionLevel, aiUsage } = session;
    const limits = CONTACT_LIMITS[subscriptionLevel] || CONTACT_LIMITS.base;

    const currentCost = aiUsage?.totalCost || 0;
    const currentRuns = aiUsage?.totalRuns || 0;

    if ((currentCost + estimatedCost) > limits.aiCostBudget) {
        console.warn(`[Affordability] User ${session.userId} blocked. Cost limit exceeded.`);
        return false;
    }
    if ((currentRuns + requiredRuns) > limits.maxAiRunsPerMonth) {
        console.warn(`[Affordability] User ${session.userId} blocked. Run limit exceeded.`);
        return false;
    }
    return true;
}

async function recordUsage(session, actualCost, model, feature, metadata) {
    if (!session?.userId) {
        console.error('[Usage Recording] Cannot record usage: Invalid session or userId.');
        return;
    }
    
    const usageRef = adminDb.collection('AIUsage').doc(session.userId);
    const logRef = usageRef.collection('logs').doc();

    const usageData = {
        totalCost: FieldValue.increment(actualCost),
        totalRuns: FieldValue.increment(1),
        lastUsedAt: FieldValue.serverTimestamp(),
        [`${feature}_runs`]: FieldValue.increment(1),
    };

    const logData = {
        createdAt: FieldValue.serverTimestamp(),
        feature,
        cost: actualCost,
        model,
        ...metadata,
    };

    try {
        await adminDb.runTransaction(async (transaction) => {
            transaction.set(usageRef, usageData, { merge: true });
            transaction.set(logRef, logData);
        });
        console.log(`[Usage Recording] Successfully recorded usage for user ${session.userId}. Cost: ${actualCost}`);
    } catch (error) {
        console.error(`[Usage Recording] Failed to record usage for user ${session.userId}:`, error);
    }
}

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
        console.log(`[BusinessCardService] 📇 [${requestId}] Starting scan for user: ${session.userId} (${session.subscriptionLevel}), side: ${side}`);

        try {
            // Validate and sanitize image
            const validatedImage = this._validateAndSanitizeImage(imageBase64);

            // Check rate limits
            await ContactSecurityService.checkRateLimit(session.userId, 'scan');

            let scanResult;

            // Route based on permissions
            if (session.permissions[CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER]) {
                console.log(`[BusinessCardService] ✨ Routing to AI-Enhanced Pipeline`);
                
                const costEstimate = this._getCostEstimateForTier(session.subscriptionLevel);
                const isAffordable = await canAffordOperation(session, costEstimate.estimated, 1);
                
                if (!isAffordable) {
                    throw new Error('PLAN_LIMIT_EXCEEDED');
                }

                scanResult = await this._processAiEnhancedPipeline(validatedImage, {
                    side, requestId, session
                });

            } else if (session.permissions[CONTACT_FEATURES.BASIC_CARD_SCANNER]) {
                console.log(`[BusinessCardService] 📄 Routing to Basic Pipeline (Pro tier)`);
                
                scanResult = await this._processBasicPipeline(validatedImage, {
                    side, requestId, session
                });

            } else {
                throw new Error('User does not have permission for any scanner feature.');
            }

            // Record usage only if AI was used
            const actualCost = scanResult.metadata?.cost || 0;
            if (actualCost > 0) {
                await recordUsage(session, actualCost, 'gemini-1.5-flash', 'business_card_scan', {
                    side,
                    fieldsFound: (scanResult.standardFields?.length || 0) + (scanResult.dynamicFields?.length || 0),
                    success: scanResult.success,
                    requestId
                });
            }

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
            console.log(`[BusinessCardService] 🔍 Starting basic pipeline`);

            // Step 1: OCR Processing
            const ocrResult = await BusinessCardOCR.processImage(imageBase64);

            // Step 2: QR Code Processing
            const qrResult = await BusinessCardQR.processImage(imageBase64);

            // Step 3: Merge results
            const mergedData = this._mergeOcrAndQr(ocrResult, qrResult);

            // Step 4: Extract fields using pattern matching
            const extractedFields = BusinessCardFieldExtractor.extractFieldsBasic(
                mergedData.extractedText,
                mergedData.qrData
            );

            // Step 5: Clean and validate
            const cleanedFields = BusinessCardFieldExtractor.cleanAndDeduplicateFields(extractedFields);
            const validatedFields = BusinessCardFieldExtractor.validateFields(cleanedFields);

            // Step 6: Structure final result
            const finalResult = this._structureFinalResult(validatedFields, {
                ocrSuccess: ocrResult.success,
                qrSuccess: qrResult.success,
                hasQRCode: qrResult.hasQRCode,
                method: 'basic_ocr_qr',
                cost: 0,
                aiProcessed: false,
                side,
                requestId
            });

            console.log(`[BusinessCardService] ✅ Basic pipeline found ${validatedFields.length} fields`);
            return finalResult;

        } catch (error) {
            console.error(`[BusinessCardService] ❌ Basic pipeline failed:`, error);
            return this._createFallbackResult(error.message);
        }
    }

    /**
     * AI-Enhanced pipeline for Premium+ tier users
     * OCR + QR Code + Gemini AI Enhancement
     */
    static async _processAiEnhancedPipeline(imageBase64, { side, requestId, session }) {
        try {
            console.log(`[BusinessCardService] 🤖 Starting AI-enhanced pipeline`);

            // Step 1: OCR Processing
            const ocrResult = await BusinessCardOCR.processImage(imageBase64);

            // Step 2: QR Code Processing
            const qrResult = await BusinessCardQR.processImage(imageBase64);

            // Step 3: Merge results
            const mergedData = this._mergeOcrAndQr(ocrResult, qrResult);

            // Step 4: AI Enhancement with Gemini
            const aiResult = await BusinessCardAI.enhanceWithGemini({
                extractedText: mergedData.extractedText,
                qrData: mergedData.qrData,
                imageBase64,
                side,
                subscriptionLevel: session.subscriptionLevel,
                language: session.language || 'en'
            });

            // Step 5: Merge AI results with pattern-matched fields
            const basicFields = BusinessCardFieldExtractor.extractFieldsBasic(
                mergedData.extractedText,
                mergedData.qrData
            );
            
            const combinedFields = this._mergeAiAndBasicFields(
                aiResult.standardFields,
                aiResult.dynamicFields,
                basicFields
            );

            // Step 6: Clean and validate
            const cleanedFields = BusinessCardFieldExtractor.cleanAndDeduplicateFields(combinedFields);
            const validatedFields = BusinessCardFieldExtractor.validateFields(cleanedFields);

            // Step 7: Structure final result
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

            console.log(`[BusinessCardService] ✅ AI pipeline found ${validatedFields.length} fields (AI cost: $${aiResult.cost.toFixed(4)})`);
            return finalResult;

        } catch (error) {
            console.error(`[BusinessCardService] ❌ AI pipeline failed:`, error);
            
            // Fallback to basic pipeline if AI fails
            console.log(`[BusinessCardService] ⚠️ Falling back to basic pipeline`);
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
        return { estimated: 0.002 };
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
}