// lib/services/serviceContact/server/publicScanService.js

import { adminDb } from '@/lib/firebaseAdmin';
import { CostTrackingService } from './costTrackingService';
import { BusinessCardOCR } from './businessCardService/businessCardOCR';
import { BusinessCardQR } from './businessCardService/businessCardQR';
import { BusinessCardFieldExtractor } from './businessCardService/businessCardFieldExtractor';
import { BusinessCardAI } from './businessCardService/businessCardAI';
import jwt from 'jsonwebtoken';

/**
 * Server-side service for public business card scanning
 * Handles all business logic for the public scan endpoint
 * Reuses existing business card processing services
 */
export class PublicScanService {
  /**
   * Main method to process a public business card scan
   */
  static async processScan(scanData) {
    const { images, scanToken, language = 'en', requestId } = scanData;

    console.log(`📇 [${requestId}] Processing public scan with language: ${language}`);
    console.log(`[${requestId}] Processing images for side(s): ${Object.keys(images || {}).join(', ')}`);

    // Verify token
    const tokenData = await this.verifyPublicScanToken(scanToken);
    if (!tokenData) {
      throw new Error('Invalid or expired scan token');
    }
    const { profileOwnerId, profileOwnerName } = tokenData;

    // Check budget
    const costCheck = await CostTrackingService.canAffordOperation(
      profileOwnerId,
      0.003 * Object.keys(images).length,
      1
    );
    if (!costCheck.canAfford) {
      const error = new Error('Profile owner has insufficient AI budget');
      error.code = 'BUDGET_EXCEEDED';
      throw error;
    }

    // Process all images
    const scanStartTime = Date.now();
    const scanPromises = [];
    const sidesToScan = [];

    if (images.front) {
      sidesToScan.push('front');
      scanPromises.push(this.processEnhancedBusinessCardScan(
        profileOwnerId,
        images.front,
        { isPublicScan: true, requestId, language, side: 'front' }
      ));
    }
    if (images.back) {
      sidesToScan.push('back');
      scanPromises.push(this.processEnhancedBusinessCardScan(
        profileOwnerId,
        images.back,
        { isPublicScan: true, requestId, language, side: 'back' }
      ));
    }

    const individualScanResults = await Promise.all(scanPromises);
    const mergedResult = this.mergeServerSideResults(individualScanResults);
    const scanDuration = Date.now() - scanStartTime;

    // Generate personalized message
    let personalizedMessage = null;
    if (mergedResult.success && mergedResult.parsedFields.length > 0) {
      const clientName = this.extractNameFromFields(mergedResult.parsedFields);
      if (clientName) {
        personalizedMessage = await this.generatePersonalizedMessage(clientName, profileOwnerName, language);
      }
    }

    // Record cost
    const actualCost = this.calculateScanCost(mergedResult, scanDuration);
    await CostTrackingService.recordSeparatedUsage(
      profileOwnerId,
      actualCost,
      'gemini-1.5-flash',
      'public_card_scan_enhanced',
      {
        requestId,
        scanDuration,
        fieldsDetected: mergedResult.parsedFields?.length || 0,
        dynamicFields: mergedResult.metadata?.dynamicFieldsCount || 0,
        hasQRCode: mergedResult.metadata?.hasQRCode || false,
        clientName: this.extractNameFromFields(mergedResult.parsedFields) || 'unknown',
        sidesScanned: sidesToScan,
        scanMode: sidesToScan.length > 1 ? 'multi_side_combined' : sidesToScan[0] || 'single_side'
      },
      'api_call'
    );

    // Mark token as used
    await this.markTokenAsUsed(scanToken);

    console.log(`✅ [${requestId}] Enhanced public scan completed for ${sidesToScan.join(' & ')} in ${scanDuration}ms`);

    return {
      success: true,
      parsedFields: mergedResult.parsedFields || [],
      personalizedMessage,
      metadata: {
        ...mergedResult.metadata,
        scanDuration: `${scanDuration}ms`,
        sidesProcessed: sidesToScan,
        enhancedProcessing: true
      }
    };
  }

  /**
   * Check rate limit for public scans
   */
  static async checkPublicScanRateLimit(ip, maxScans = 200, windowMinutes = 60) {
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    const cacheKey = `public_scan_rate_${ip}`;

    const rateLimitDoc = await adminDb.collection('RateLimits').doc(cacheKey).get();

    let scans = [];
    if (rateLimitDoc.exists) {
      scans = rateLimitDoc.data().scans || [];
    }

    scans = scans.filter(timestamp => now - timestamp < windowMs);

    if (scans.length >= maxScans) {
      throw new Error(`Public scan rate limit exceeded. Max ${maxScans} scans per ${windowMinutes} minutes.`);
    }

    scans.push(now);
    await adminDb.collection('RateLimits').doc(cacheKey).set({
      scans,
      lastUpdated: new Date().toISOString(),
      type: 'public_scan'
    });
  }

  /**
   * Verify public scan token
   */
  static async verifyPublicScanToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

      if (decoded.purpose !== 'public_scan') {
        return null;
      }

      if (Date.now() > decoded.expires) {
        return null;
      }

      const tokenDoc = await adminDb.collection('ScanTokens').doc(decoded.tokenId).get();

      // Allow token to be used multiple times within 5 minutes for multi-side scanning
      if (tokenDoc.exists && tokenDoc.data().used) {
        const usedAt = tokenDoc.data().usedAt;
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        // If token was used more than 5 minutes ago, reject it
        if (usedAt < fiveMinutesAgo) {
          console.log('Token was used more than 5 minutes ago, rejecting');
          return null;
        }

        // Allow reuse within 5 minutes for multi-side scanning
        console.log('Token reused within 5 minutes for multi-side scan');
      }

      return {
        profileOwnerId: decoded.profileOwnerId,
        profileOwnerName: decoded.profileOwnerName,
        tokenId: decoded.tokenId
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Mark token as used
   */
  static async markTokenAsUsed(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded?.tokenId) {
        await adminDb.collection('ScanTokens').doc(decoded.tokenId).set({
          used: true,
          usedAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (error) {
      console.error('Failed to mark token as used:', error);
    }
  }

  /**
   * Process enhanced business card scan using existing services
   */
  static async processEnhancedBusinessCardScan(userId, imageBase64, options = {}) {
    try {
      const { side = 'front', language = 'en', requestId } = options;
      console.log(`📇 [${requestId}] Processing ${side} side with existing services`);

      // Validate image
      const validatedImage = this.validateAndSanitizeImage(imageBase64);

      // Step 1: OCR Processing using BusinessCardOCR
      console.log(`[${requestId}] Running OCR on ${side} side...`);
      const ocrResult = await BusinessCardOCR.processImage(validatedImage);
      console.log(`[${requestId}] OCR ${side}: ${ocrResult.success ? '✅' : '❌'}`);

      // Step 2: QR Code Processing using BusinessCardQR
      console.log(`[${requestId}] Scanning QR on ${side} side...`);
      const qrResult = await BusinessCardQR.processImage(validatedImage);
      console.log(`[${requestId}] QR ${side}: ${qrResult.hasQRCode ? '✅ Found' : '❌ None'}`);

      // Step 3: Merge OCR and QR results
      const mergedData = {
        ocrSuccess: ocrResult.success,
        qrSuccess: qrResult.success,
        hasQRCode: qrResult.hasQRCode,
        extractedText: ocrResult.text || '',
        qrData: qrResult.parsedQRData || null,
        textBlocks: ocrResult.blocks || [],
        confidence: ocrResult.confidence || 0
      };

      // Step 4: AI Enhancement using BusinessCardAI
      console.log(`[${requestId}] Enhancing ${side} side with AI...`);
      const aiResult = await BusinessCardAI.enhanceWithGemini({
        extractedText: mergedData.extractedText,
        qrData: mergedData.qrData,
        imageBase64: validatedImage,
        side,
        subscriptionLevel: 'premium', // Public scans use premium features
        language
      });

      // Step 5: Merge AI results with basic pattern matching
      console.log(`[${requestId}] Merging AI with pattern matching for ${side}...`);
      const basicFields = BusinessCardFieldExtractor.extractFieldsBasic(
        mergedData.extractedText,
        mergedData.qrData
      );

      const allFields = [
        ...(aiResult.standardFields || []).map(f => ({ ...f, source: 'ai-gemini', side })),
        ...(aiResult.dynamicFields || []).map(f => ({ ...f, source: 'ai-gemini-dynamic', side })),
        ...basicFields.map(f => ({ ...f, source: f.source || 'pattern-match', side }))
      ];

      // Step 6: Clean and validate using BusinessCardFieldExtractor
      console.log(`[${requestId}] Cleaning and validating ${side} fields...`);
      const cleanedFields = BusinessCardFieldExtractor.cleanAndDeduplicateFields(allFields);
      const validatedFields = BusinessCardFieldExtractor.validateFields(cleanedFields);

      console.log(`✅ [${requestId}] ${side} side completed: ${validatedFields.length} fields`);

      return {
        success: ocrResult.success || qrResult.success,
        parsedFields: validatedFields,
        metadata: {
          hasQRCode: qrResult.hasQRCode,
          fieldsCount: validatedFields.length,
          fieldsWithData: validatedFields.filter(f => f.value && f.value.trim().length > 0).length,
          dynamicFieldsCount: validatedFields.filter(f => f.type === 'dynamic').length,
          standardFieldsCount: validatedFields.filter(f => f.type === 'standard').length,
          processedAt: new Date().toISOString(),
          processingMethod: 'enhanced_ai_dynamic',
          confidence: this.calculateOverallConfidence(validatedFields),
          aiProcessed: aiResult.aiProcessed || false,
          cost: aiResult.cost || 0,
          side: side
        }
      };
    } catch (error) {
      console.error(`❌ [${options.requestId}] Enhanced scan error (${options.side}):`, error);
      return this.createFallbackResult(error.message);
    }
  }

  /**
   * Merge results from multiple card sides
   */
  static mergeServerSideResults(results) {
    const allFields = [];
    let overallSuccess = false;
    let combinedMetadata = {
      hasQRCode: false,
      dynamicFieldsCount: 0,
      fieldsCount: 0,
    };

    results.forEach(result => {
      if (result.success) {
        overallSuccess = true;
        if (result.parsedFields) {
          allFields.push(...result.parsedFields);
        }
        if (result.metadata?.hasQRCode) combinedMetadata.hasQRCode = true;
        if (result.metadata?.dynamicFieldsCount) {
          combinedMetadata.dynamicFieldsCount += result.metadata.dynamicFieldsCount;
        }
      }
    });

    // Use existing service for deduplication
    const mergedFields = BusinessCardFieldExtractor.cleanAndDeduplicateFields(allFields);
    combinedMetadata.fieldsCount = mergedFields.length;

    return {
      success: overallSuccess,
      parsedFields: mergedFields,
      metadata: combinedMetadata
    };
  }

  /**
   * Generate personalized message using AI
   */
  static async generatePersonalizedMessage(clientName, profileOwnerName, language = 'en') {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return {
          greeting: `Great connecting, ${clientName}!`,
          ctaText: "You should get your own at weavink.com.",
          url: "https://www.weavink.com",
          signature: `- ${profileOwnerName}`
        };
      }

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const languageMap = {
        en: 'English', es: 'Spanish', fr: 'French', de: 'German',
        it: 'Italian', pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese',
        ko: 'Korean', ar: 'Arabic', hi: 'Hindi', ru: 'Russian',
        nl: 'Dutch', sv: 'Swedish', no: 'Norwegian', da: 'Danish',
        fi: 'Finnish', pl: 'Polish', tr: 'Turkish', th: 'Thai', vi: 'Vietnamese'
      };

      const languageName = languageMap[language.toLowerCase()] || 'English';
      console.log(`🌍 Generating message in ${languageName} for ${clientName}`);

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: `You are a savvy networking assistant for a digital business card company. Write a short, memorable greeting after a business card exchange.

TONE: Clever, friendly, professional.

RULES:
1. Response MUST be in ${languageName}.
2. Short greeting, under 20 words.
3. Do NOT include "weavink.com" or call-to-action.
4. No quotation marks, explanations, or signature.`
      });

      const prompt = `Write a short, fun, professional greeting in ${languageName} from "${profileOwnerName}" to welcome "${clientName}".

Example ideas (for tone only):
- "Great connecting, ${clientName}! I've saved your details the modern way."
- "Pleasure to meet you, ${clientName}! Your card has been digitized."

Generate a new, original greeting in ${languageName}.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let messageText = response.text().trim().replace(/^["']|["']$/g, '');

      const ctaTextMap = {
        fr: "Créez la vôtre sur weavink.com.",
        es: "Consigue la tuya en weavink.com.",
        de: "Holen Sie sich Ihre eigene auf weavink.com.",
        en: "Get your own at weavink.com."
      };

      const personalizedObject = {
        greeting: messageText,
        ctaText: ctaTextMap[language.toLowerCase()] || ctaTextMap.en,
        url: "https://www.weavink.com",
        signature: `- ${profileOwnerName}`
      };

      console.log(`✅ Generated message:`, personalizedObject);
      return personalizedObject;
    } catch (error) {
      console.error('Failed to generate personalized message:', error);
      return {
        greeting: `Thanks for connecting, ${clientName}!`,
        ctaText: "Get your own digital card at weavink.com.",
        url: "https://www.weavink.com",
        signature: `- ${profileOwnerName}`
      };
    }
  }

  // ==================== HELPER METHODS ====================

  static extractNameFromFields(parsedFields) {
    const nameField = parsedFields.find(field =>
      field.label.toLowerCase().includes('name') && field.value.trim()
    );
    return nameField?.value.trim() || null;
  }

  static calculateScanCost(scanResult, duration) {
    let baseCost = 0.0015;
    if (scanResult.metadata?.hasQRCode) baseCost *= 1.2;
    if (scanResult.parsedFields?.length > 5) baseCost *= 1.1;
    if (duration > 10000) baseCost *= 1.3;
    else if (duration > 5000) baseCost *= 1.1;
    return Math.max(baseCost, 0.0001);
  }

  static validateAndSanitizeImage(imageBase64) {
    console.log('🔍 Validating image data:', {
      hasData: !!imageBase64,
      type: typeof imageBase64,
      isString: typeof imageBase64=== 'string',
      length: imageBase64?.length,
      preview: typeof imageBase64 === 'string' ? imageBase64.substring(0, 50) : 'NOT A STRING'
    });

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error(`Invalid image data: must be base64 string (got ${typeof imageBase64})`);
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

    console.log('✅ Image validated:', {
      base64Length: cleanBase64.length,
      estimatedSizeKB: Math.round(estimatedSize / 1024)
    });

    return cleanBase64;
  }

  static calculateOverallConfidence(fields) {
    const fieldsWithData = fields.filter(f => f.value && f.value.trim().length > 0 && f.confidence);

    if (fieldsWithData.length === 0) return 0;

    const totalConfidence = fieldsWithData.reduce((sum, field) => sum + (field.confidence || 0), 0);
    return Math.round((totalConfidence / fieldsWithData.length) * 100) / 100;
  }

  static createFallbackResult(errorMessage) {
    const fallbackFields = [
      { label: 'Name', value: '', type: 'standard', confidence: 0 },
      { label: 'Email', value: '', type: 'standard', confidence: 0 },
      { label: 'Phone', value: '', type: 'standard', confidence: 0 },
      { label: 'Company', value: '', type: 'standard', confidence: 0 },
      { label: 'Job Title', value: '', type: 'custom', confidence: 0 },
      {
        label: 'Note',
        value: `Scan failed: ${errorMessage}. Please fill manually.`,
        type: 'custom',
        confidence: 1
      }
    ];

    return {
      success: false,
      error: errorMessage,
      parsedFields: fallbackFields,
      metadata: {
        hasQRCode: false,
        fieldsCount: fallbackFields.length,
        fieldsWithData: 1,
        hasRequiredFields: false,
        processedAt: new Date().toISOString(),
        processingMethod: 'error_fallback',
        confidence: 0,
        note: `Scanning error: ${errorMessage}`
      }
    };
  }
}
