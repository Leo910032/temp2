// lib/services/serviceContact/server/businessCardService.js
// Server-side business card scanning service following enterprise pattern

import { ContactSecurityService } from './contactSecurityService';
import { ContactValidationService } from './contactValidationService';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { 
  CONTACT_ACTIVITIES,
  CONTACT_FEATURES
} from '../client/services/constants/contactConstants.js';

export class BusinessCardService {

  // ==================== BUSINESS CARD PROCESSING ====================
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
   * Process business card scan from base64 image data
   */
    /**
   * Process business card scan from base64 image data
   */
  static async processBusinessCardScan(userId, imageBase64) {
    // ADDED: Import the new logger function
    const { logBusinessCardUsage } = await import('@/lib/services/logging/usageLogger');
    let apiCost = 0; // ADDED: Initialize cost tracker
    let finalResult;

    try {
      console.log('📇 BusinessCardService: Processing business card scan for user:', userId);

      await this.validateScanAccess(userId);
      await ContactSecurityService.checkRateLimit(userId, 'scan');
      const validatedImageData = this.validateAndSanitizeImageData(imageBase64);
      const ocrResult = await this.performOCRProcessing(validatedImageData);
      const qrResult = await this.processQRCodes(validatedImageData);
      const scanResult = this.mergeScanResults(ocrResult, qrResult);
      
      // Enhance with AI processing
      const enhancedResult = await this.enhanceWithGeminiAI(scanResult);
      apiCost = enhancedResult.cost; // ADDED: Capture the cost from the AI step

      // Validate and structure the final result
      finalResult = this.structureScanResult(enhancedResult);

      // Log audit event (different from usage logging)
      await ContactSecurityService.logContactActivity({
        userId,
        action: CONTACT_ACTIVITIES.BUSINESS_CARD_SCANNED,
        details: {
          fieldsDetected: finalResult.parsedFields.length,
          confidence: finalResult.metadata.confidence,
          hasQRCode: finalResult.metadata.hasQRCode,
          processingMethod: finalResult.metadata.processingMethod
        }
      });

      console.log('✅ BusinessCardService: Scan completed successfully');
      
    } catch (error) {
      console.error('❌ BusinessCardService: Error processing scan:', error);
      finalResult = this.createFallbackResult(error.message);
    }

    // ========================================================================
    // ADDED: Final usage and cost logging block (runs on success or failure)
    // ========================================================================
    const logData = {
        userId,
        status: finalResult.success ? 'success' : 'error',
        cost: apiCost,
        model: finalResult.metadata.aiProcessed ? 'gemini-1.5-flash' : 'none',
        details: {
            fieldsDetected: finalResult.metadata.fieldsWithData || 0,
            overallConfidence: finalResult.metadata.confidence || 0,
            processingMethod: finalResult.metadata.processingMethod || 'error_fallback',
            hasQRCode: finalResult.metadata.hasQRCode || false,
            error: finalResult.error || null
        }
    };
    logBusinessCardUsage(logData);
    // ========================================================================

    return finalResult;
  }

  /**
   * Validate user has access to business card scanning
   */
  static async validateScanAccess(userId) {
    try {
      // Import ContactService to check feature access
      const { ContactService } = await import('./contactService');
      await ContactService.validateFeatureAccess(userId, CONTACT_FEATURES.BUSINESS_CARD_SCANNER);
      
      return true;
    } catch (error) {
      throw new Error('Business card scanning requires a Pro or Enterprise subscription');
    }
  }

  /**
   * Validate and sanitize base64 image data
   */
  static validateAndSanitizeImageData(imageBase64) {
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error('Invalid image data: must be a base64 string');
    }

    // Remove data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    // Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cleanBase64)) {
      throw new Error('Invalid base64 format');
    }

    // Check size constraints
    if (cleanBase64.length < 100) {
      throw new Error('Image data too small');
    }

    const estimatedSize = cleanBase64.length * 0.75; // Base64 is ~33% larger
    if (estimatedSize > 15 * 1024 * 1024) { // 15MB limit
      throw new Error('Image too large (max 15MB)');
    }

    console.log('✅ Image data validated:', {
      base64Length: cleanBase64.length,
      estimatedSizeKB: Math.round(estimatedSize / 1024)
    });

    return cleanBase64;
  }

  /**
   * Perform OCR processing on the image
   */
  static async performOCRProcessing(imageBase64) {
    try {
      console.log('🔍 Performing OCR processing...');

      // Here you would integrate with your preferred OCR service
      // Examples: Google Vision API, AWS Textract, Azure Computer Vision, Tesseract.js
      
      // For this example, I'll show the structure for Google Vision API
      const ocrResult = await this.callGoogleVisionAPI(imageBase64);
      
      // Alternative: Use AWS Textract
      // const ocrResult = await this.callAWSTextract(imageBase64);
      
      // Alternative: Use Azure Computer Vision
      // const ocrResult = await this.callAzureComputerVision(imageBase64);

      return this.processOCRResponse(ocrResult);

    } catch (error) {
      console.error('❌ OCR processing failed:', error);
      return {
        success: false,
        text: '',
        confidence: 0,
        blocks: [],
        error: error.message
      };
    }
  }

/**
   * Call Google Vision API for OCR
   * ✅ IMPROVED: Added languageHints for multi-language support
   */
  static async callGoogleVisionAPI(imageBase64) {
    try {
      const vision = await import('@google-cloud/vision');
      const credentials = {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
      const client = new vision.ImageAnnotatorClient({ projectId: credentials.project_id, credentials });

      const request = {
        image: { content: imageBase64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        // --- NEW: Tell Google Vision which languages to expect ---
        imageContext: {
          languageHints: ["en", "es", "fr", "it", "vi", "zh"], // English, Spanish, French, Italian, Vietnamese, Chinese
        },
      };

      const [result] = await client.annotateImage(request);
      
      return {
        success: true,
        fullText: result.fullTextAnnotation?.text || '',
        textAnnotations: result.textAnnotations || [],
        confidence: this.calculateOCRConfidence(result.textAnnotations),
        provider: 'google-vision'
      };
    } catch (error) {
      console.error("Google Vision Auth Details:", { /* ... auth details ... */ });
      throw new Error(`Google Vision API error: ${error.message}`);
    }
  }
    /**
   * ⭐ FINAL VERSION: Enhance results with Google Gemini AI using a more robust prompt and JSON parsing.
   */
  static async enhanceWithGeminiAI(scanResult) {
    console.log('--- ✅ EXECUTING V3 PROMPT FOR AI ENHANCEMENT ---');
    console.log('🤖 Enhancing with improved Gemini AI processing...');

    const textToProcess = scanResult.extractedText;
    console.log('--- TEXT SENT TO GEMINI: ---\n' + textToProcess + '\n---------------------------');

    if (!textToProcess || textToProcess.trim().length < 10) {
      console.warn('⚠️ Not enough text to process with AI.');
      const qrFields = scanResult.hasQRCode && scanResult.parsedQRData?.contactData 
        ? this.convertQRDataToFields(scanResult.parsedQRData.contactData) 
        : [];
      return { ...scanResult, extractedFields: qrFields, aiProcessed: false, aiModel: 'none', cost: 0 };
    }

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set in environment variables.");
      }
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        You are an expert business card information extractor. Your task is to analyze the raw text extracted from a business card and accurately identify and structure the contact information. The text might be messy, contain OCR errors, or have unusual layouts. Use your best judgment.

        Follow these rules precisely:
        1.  Identify these key fields: name, email, phone, company, jobTitle, website, address.
        2.  Combine first and last names into a single 'name' field.
        3.  Clean up phone numbers: remove parentheses, dashes, and spaces. Include the country code if present.
        4.  Distinguish between the person's name and the company name. The company name often has suffixes like 'Inc.', 'LLC', or is associated with a logo.
        5.  Combine all parts of an address (street, city, state, zip) into a single 'address' field.
        6.  If a field is not present on the card, DO NOT include its key in the JSON.
        
        Format: Provide your response ONLY as a valid JSON object. Do not include any other text, explanations, or markdown formatting like \`\`\`json.

        Here is the business card text:
        ---
        ${textToProcess}
        ---
      `;

      const result = await model.generateContent(prompt);

      // ADDED: Calculate real cost from API response
      const usageMetadata = result.response.usageMetadata;
      const realCost = this.calculateRealCost(usageMetadata);

      const response = await result.response;
      const responseText = response.text();
      
      console.log('--- RAW AI RESPONSE: ---\n' + responseText + '\n-------------------------');

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("AI did not return a valid JSON object.");
      }
      const jsonString = jsonMatch[0];
      const parsedJson = JSON.parse(jsonString);

      let extractedFields = [];
      for (const [key, value] of Object.entries(parsedJson)) {
        if (value && typeof value === 'string' && value.trim().length > 0) {
          extractedFields.push({
            label: this.normalizeFieldLabel(key),
            value: value.trim(),
            type: this.getFieldType(this.normalizeFieldLabel(key)),
            confidence: 0.9,
            source: 'gemini-ai'
          });
        }
      }
      
      if (scanResult.hasQRCode && scanResult.parsedQRData?.contactData) {
        const qrFields = this.convertQRDataToFields(scanResult.parsedQRData.contactData);
        extractedFields.push(...qrFields);
      }

      const cleanedFields = this.cleanAndDeduplicateFields(extractedFields);
      const scoredFields = this.scoreAndValidateFields(cleanedFields);

      return {
        ...scanResult,
        extractedFields: scoredFields,
        aiProcessed: true,
        aiModel: 'gemini-1.5-flash',
        cost: realCost // MODIFIED: Return the calculated real cost
      };

    } catch (error) {
      console.error('❌ Gemini AI enhancement failed:', error);
      const basicFields = this.extractContactFieldsBasic(scanResult.extractedText);
      return {
        ...scanResult,
        extractedFields: basicFields,
        aiProcessed: false,
        aiError: error.message,
        aiModel: 'failed_fallback_to_regex',
        cost: 0.005 // MODIFIED: Return an estimated cost on failure
      };
    }
  }
  /**
   * Process OCR response into structured format
   */
  static processOCRResponse(ocrResult) {
    if (!ocrResult.success) {
      return ocrResult;
    }

    let extractedText = '';
    let textBlocks = [];

    if (ocrResult.provider === 'google-vision') {
      extractedText = ocrResult.fullText;
      textBlocks = ocrResult.textAnnotations.map(annotation => ({
        text: annotation.description,
        confidence: annotation.confidence || 0,
        boundingBox: annotation.boundingPoly
      }));
    } else if (ocrResult.provider === 'aws-textract') {
      const textBlocks = ocrResult.blocks.filter(block => block.BlockType === 'LINE');
      extractedText = textBlocks.map(block => block.Text).join('\n');
    }

    return {
      success: true,
      text: extractedText,
      blocks: textBlocks,
      confidence: ocrResult.confidence,
      provider: ocrResult.provider
    };
  }
/**
   * ✅ FIXED: Process QR codes using the correct import for `sharp`
   */
  static async processQRCodes(imageBase64) {
    try {
      console.log('🔳 Processing QR codes...');
      
      // When using dynamic import for sharp, you often need to access the .default property
      const sharpModule = await import('sharp');
      const sharp = sharpModule.default;
      
      const jsQRModule = await import('jsqr');
      const jsQR = jsQRModule.default;
      
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      
      const { data, info } = await sharp(imageBuffer)
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });

      const imageData = {
        data: new Uint8ClampedArray(data),
        width: info.width,
        height: info.height
      };

      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (qrCode) {
        console.log('✅ QR code detected:', qrCode.data);
        return {
          success: true,
          hasQRCode: true,
          qrData: qrCode.data,
          qrLocation: qrCode.location,
          parsedQRData: this.parseQRData(qrCode.data)
        };
      }

      return { success: true, hasQRCode: false, qrData: null };

    } catch (error) {
      console.error('❌ QR code processing failed:', error);
      return { success: false, hasQRCode: false, error: error.message };
    }
  }

  /**
   * Parse QR code data (often contains vCard or contact info)
   */
  static parseQRData(qrData) {
    try {
      // Check if it's a vCard format
      if (qrData.startsWith('BEGIN:VCARD')) {
        return this.parseVCard(qrData);
      }
      
      // Check if it's a URL
      if (qrData.startsWith('http://') || qrData.startsWith('https://')) {
        return {
          type: 'url',
          url: qrData
        };
      }
      
      // Check if it's formatted contact data
      if (qrData.includes('@') && qrData.includes('\n')) {
        return this.parseStructuredContactData(qrData);
      }
      
      return {
        type: 'text',
        data: qrData
      };
      
    } catch (error) {
      return {
        type: 'raw',
        data: qrData,
        parseError: error.message
      };
    }
  }

  /**
   * Parse vCard data from QR code
   */
  static parseVCard(vCardData) {
    const lines = vCardData.split('\n');
    const contactData = {};
    
    lines.forEach(line => {
      if (line.startsWith('FN:')) {
        contactData.name = line.substring(3);
      } else if (line.startsWith('EMAIL:')) {
        contactData.email = line.substring(6);
      } else if (line.startsWith('TEL:')) {
        contactData.phone = line.substring(4);
      } else if (line.startsWith('ORG:')) {
        contactData.company = line.substring(4);
      } else if (line.startsWith('TITLE:')) {
        contactData.jobTitle = line.substring(6);
      } else if (line.startsWith('URL:')) {
        contactData.website = line.substring(4);
      }
    });
    
    return {
      type: 'vcard',
      contactData
    };
  }

  /**
   * Merge OCR and QR results
   */
  static mergeScanResults(ocrResult, qrResult) {
    const mergedResult = {
      ocrSuccess: ocrResult.success,
      qrSuccess: qrResult.success,
      hasQRCode: qrResult.hasQRCode,
      extractedText: ocrResult.text || '',
      qrData: qrResult.qrData,
      parsedQRData: qrResult.parsedQRData,
      textBlocks: ocrResult.blocks || [],
      confidence: ocrResult.confidence || 0
    };

    return mergedResult;
  }

  /**
   * Enhance results with AI processing
   */
  static async enhanceWithAI(scanResult, imageBase64) {
    try {
      console.log('🤖 Enhancing with AI processing...');
      
      // Extract contact fields from text using AI/pattern matching
      const extractedFields = this.extractContactFields(scanResult.extractedText);
      
      // Merge with QR code data if available
      if (scanResult.hasQRCode && scanResult.parsedQRData?.contactData) {
        const qrFields = this.convertQRDataToFields(scanResult.parsedQRData.contactData);
        extractedFields.push(...qrFields);
      }
      
      // Remove duplicates and clean up fields
      const cleanedFields = this.cleanAndDeduplicateFields(extractedFields);
      
      // Validate and score the results
      const scoredFields = this.scoreAndValidateFields(cleanedFields);
      
      return {
        ...scanResult,
        extractedFields: scoredFields,
        aiProcessed: true
      };
      
    } catch (error) {
      console.error('❌ AI enhancement failed:', error);
      
      // Return basic extraction as fallback
      const basicFields = this.extractContactFieldsBasic(scanResult.extractedText);
      
      return {
        ...scanResult,
        extractedFields: basicFields,
        aiProcessed: false,
        aiError: error.message
      };
    }
  }

  /**
   * Extract contact fields from text using pattern matching
   */
  static extractContactFields(text) {
    const fields = [];
    
    if (!text) return fields;
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Email extraction
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex);
    if (emails) {
      emails.forEach(email => {
        fields.push({
          label: 'Email',
          value: email.toLowerCase(),
          type: 'standard',
          confidence: 0.9,
          source: 'regex'
        });
      });
    }
    
    // Phone extraction
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phones = text.match(phoneRegex);
    if (phones) {
      phones.forEach(phone => {
        fields.push({
          label: 'Phone',
          value: phone,
          type: 'standard',
          confidence: 0.8,
          source: 'regex'
        });
      });
    }
    
    // Website extraction
    const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/g;
    const urls = text.match(urlRegex);
    if (urls) {
      urls.forEach(url => {
        fields.push({
          label: 'Website',
          value: url.startsWith('http') ? url : `http://${url}`,
          type: 'custom',
          confidence: 0.7,
          source: 'regex'
        });
      });
    }
    
    // Name extraction (first line that doesn't match email/phone/url patterns)
    const potentialNames = lines.filter(line => {
      return !emailRegex.test(line) && 
             !phoneRegex.test(line) && 
             !urlRegex.test(line) && 
             line.length > 2 && 
             line.length < 50 &&
             !/^\d+$/.test(line); // Not just numbers
    });
    
    if (potentialNames.length > 0) {
      fields.push({
        label: 'Name',
        value: potentialNames[0],
        type: 'standard',
        confidence: 0.6,
        source: 'heuristic'
      });
    }
    
    // Company extraction (look for common business indicators)
    const companyIndicators = /\b(inc|llc|ltd|corp|corporation|company|co\.|group|enterprises|solutions|services)\b/i;
    const potentialCompanies = lines.filter(line => 
      companyIndicators.test(line) && 
      !emailRegex.test(line) && 
      !phoneRegex.test(line)
    );
    
    if (potentialCompanies.length > 0) {
      fields.push({
        label: 'Company',
        value: potentialCompanies[0],
        type: 'standard',
        confidence: 0.7,
        source: 'heuristic'
      });
    }
    
    // Job title extraction (common titles)
    const titleRegex = /\b(manager|director|president|ceo|cto|cfo|vp|vice president|senior|jr|junior|analyst|consultant|engineer|developer|designer|marketing|sales|account)\b/i;
    const potentialTitles = lines.filter(line => 
      titleRegex.test(line) && 
      !emailRegex.test(line) && 
      !phoneRegex.test(line) &&
      line.length < 100
    );
    
    if (potentialTitles.length > 0) {
      fields.push({
        label: 'Job Title',
        value: potentialTitles[0],
        type: 'custom',
        confidence: 0.6,
        source: 'heuristic'
      });
    }
    
    return fields;
  }

  /**
   * Convert QR data to field format
   */
  static convertQRDataToFields(qrContactData) {
    const fields = [];
    
    Object.entries(qrContactData).forEach(([key, value]) => {
      if (value && typeof value === 'string' && value.trim().length > 0) {
        fields.push({
          label: this.normalizeFieldLabel(key),
          value: value.trim(),
          type: 'standard',
          confidence: 0.95, // QR codes are very reliable
          source: 'qr_code'
        });
      }
    });
    
    return fields;
  }

  /**
   * Clean and deduplicate extracted fields
   */
  static cleanAndDeduplicateFields(fields) {
    // Remove empty fields
    const nonEmptyFields = fields.filter(field => 
      field.value && field.value.trim().length > 0
    );
    
    // Group by label
    const fieldGroups = {};
    nonEmptyFields.forEach(field => {
      const normalizedLabel = this.normalizeFieldLabel(field.label);
      if (!fieldGroups[normalizedLabel]) {
        fieldGroups[normalizedLabel] = [];
      }
      fieldGroups[normalizedLabel].push(field);
    });
    
    // Keep the highest confidence field for each label
    const deduplicatedFields = [];
    Object.entries(fieldGroups).forEach(([label, groupFields]) => {
      // Sort by confidence (highest first)
      groupFields.sort((a, b) => b.confidence - a.confidence);
      
      // Take the highest confidence field
      const bestField = groupFields[0];
      bestField.label = label;
      
      deduplicatedFields.push(bestField);
    });
    
    return deduplicatedFields;
  }

  /**
   * Normalize field labels to standard format
   */
  static normalizeFieldLabel(label) {
    const normalizedLabel = label.toLowerCase().trim();
    
    // Map variations to standard labels
    const labelMap = {
      'name': 'Name',
      'full name': 'Name',
      'email': 'Email',
      'email address': 'Email',
      'phone': 'Phone',
      'phone number': 'Phone',
      'tel': 'Phone',
      'telephone': 'Phone',
      'company': 'Company',
      'organization': 'Company',
      'org': 'Company',
      'job title': 'Job Title',
      'title': 'Job Title',
      'position': 'Job Title',
      'website': 'Website',
      'web': 'Website',
      'url': 'Website',
      'address': 'Address',
      'location': 'Address'
    };
    
    return labelMap[normalizedLabel] || this.capitalizeFirstLetter(label);
  }

  /**
   * Score and validate extracted fields
   */
  static scoreAndValidateFields(fields) {
    return fields.map(field => {
      const validation = this.validateFieldValue(field.label, field.value);
      
      return {
        ...field,
        isValid: validation.isValid,
        validationErrors: validation.errors,
        adjustedConfidence: validation.isValid ? field.confidence : field.confidence * 0.5
      };
    });
  }

  /**
   * Validate individual field values
   */
  static validateFieldValue(label, value) {
    const errors = [];
    
    switch (label.toLowerCase()) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push('Invalid email format');
        }
        break;
        
      case 'phone':
        const cleanPhone = value.replace(/[\s\-\(\)\.]/g, '');
        if (cleanPhone.length < 10 || cleanPhone.length > 15) {
          errors.push('Phone number length invalid');
        }
        break;
        
      case 'website':
        try {
          new URL(value.startsWith('http') ? value : `http://${value}`);
        } catch {
          errors.push('Invalid website URL');
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Structure the final scan result
   */
  static structureScanResult(enhancedResult) {
    // Ensure we have all required fields with fallbacks
    const requiredFields = ['Name', 'Email', 'Phone', 'Company'];
    const existingFields = enhancedResult.extractedFields || [];
    
    const finalFields = [];
    
    // Add extracted fields
    existingFields.forEach(field => {
      finalFields.push({
        label: field.label,
        value: field.value,
        type: this.getFieldType(field.label),
        confidence: field.adjustedConfidence || field.confidence,
        source: field.source,
        isValid: field.isValid
      });
    });
    
    // Add missing required fields as empty
    requiredFields.forEach(requiredField => {
      if (!finalFields.find(f => f.label === requiredField)) {
        finalFields.push({
          label: requiredField,
          value: '',
          type: 'standard',
          confidence: 0,
          source: 'placeholder',
          isValid: false
        });
      }
    });
    
    // Add a note field for additional information
    if (!finalFields.find(f => f.label === 'Note')) {
      finalFields.push({
        label: 'Note',
        value: this.generateScanNote(enhancedResult),
        type: 'custom',
        confidence: 1.0,
        source: 'system',
        isValid: true
      });
    }
    
    // Calculate overall success metrics
    const fieldsWithData = finalFields.filter(f => f.value && f.value.trim().length > 0);
    const hasRequiredFields = ['Name', 'Email'].every(field => 
      finalFields.find(f => f.label === field && f.value && f.value.trim().length > 0)
    );
    
    return {
      success: enhancedResult.ocrSuccess || enhancedResult.qrSuccess,
      parsedFields: finalFields,
      metadata: {
        hasQRCode: enhancedResult.hasQRCode || false,
        fieldsCount: finalFields.length,
        fieldsWithData: fieldsWithData.length,
        hasRequiredFields,
        processedAt: new Date().toISOString(),
        processingMethod: this.determineProcessingMethod(enhancedResult),
        confidence: this.calculateOverallConfidence(finalFields),
        ocrProvider: enhancedResult.ocrSuccess ? 'enabled' : 'failed',
        qrCodeData: enhancedResult.qrData || null,
        aiProcessed: enhancedResult.aiProcessed || false
      }
    };
  }

  /**
   * Generate scan note with helpful information
   */
  static generateScanNote(enhancedResult) {
    const notes = [];
    
    if (enhancedResult.hasQRCode) {
      notes.push('✅ QR code detected and processed');
    }
    
    if (enhancedResult.ocrSuccess) {
      notes.push('✅ Text extraction successful');
    } else {
      notes.push('⚠️ Text extraction had issues');
    }
    
    if (enhancedResult.aiProcessed) {
      notes.push('✅ AI enhancement applied');
    }
    
    if (!enhancedResult.extractedFields || enhancedResult.extractedFields.length === 0) {
      notes.push('⚠️ No contact fields automatically detected. Please fill manually.');
    }
    
    return notes.join('. ') + '.';
  }

  /**
   * Determine the processing method used
   */
  static determineProcessingMethod(result) {
    if (result.hasQRCode && result.ocrSuccess) {
      return 'hybrid_qr_ocr';
    } else if (result.hasQRCode) {
      return 'qr_code_only';
    } else if (result.ocrSuccess) {
      return 'ocr_only';
    } else {
      return 'basic_processing';
    }
  }

  /**
   * Calculate overall confidence score
   */
  static calculateOverallConfidence(fields) {
    const fieldsWithData = fields.filter(f => f.value && f.value.trim().length > 0);
    
    if (fieldsWithData.length === 0) {
      return 0;
    }
    
    const totalConfidence = fieldsWithData.reduce((sum, field) => sum + field.confidence, 0);
    return Math.round((totalConfidence / fieldsWithData.length) * 100) / 100;
  }

  /**
   * Get field type classification
   */
  static getFieldType(label) {
    const standardFields = ['Name', 'Email', 'Phone', 'Company'];
    return standardFields.includes(label) ? 'standard' : 'custom';
  }

  /**
   * Create fallback result for errors
   */
  static createFallbackResult(errorMessage) {
    const fallbackFields = [
      { label: 'Name', value: '', type: 'standard' },
      { label: 'Email', value: '', type: 'standard' },
      { label: 'Phone', value: '', type: 'standard' },
      { label: 'Company', value: '', type: 'standard' },
      { label: 'Job Title', value: '', type: 'custom' },
      { 
        label: 'Note', 
        value: `Scan failed: ${errorMessage}. Please fill manually.`, 
        type: 'custom' 
      }
    ];
    
    return {
      success: false,
      error: errorMessage,
      parsedFields: fallbackFields,
      metadata: {
        hasQRCode: false,
        fieldsCount: fallbackFields.length,
        fieldsWithData: 1, // Only the note field
        hasRequiredFields: false,
        processedAt: new Date().toISOString(),
        processingMethod: 'error_fallback',
        confidence: 0,
        note: `Scanning error: ${errorMessage}`
      }
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate OCR confidence from Google Vision response
   */
  static calculateOCRConfidence(textAnnotations) {
    if (!textAnnotations || textAnnotations.length === 0) {
      return 0;
    }
    
    const confidenceScores = textAnnotations
      .filter(annotation => typeof annotation.confidence === 'number')
      .map(annotation => annotation.confidence);
    
    if (confidenceScores.length === 0) {
      return 0.5; // Default confidence if not provided
    }
    
    const averageConfidence = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
    return Math.round(averageConfidence * 100) / 100;
  }

  /**
   * Calculate confidence from AWS Textract response
   */
  static calculateTextractConfidence(blocks) {
    if (!blocks || blocks.length === 0) {
      return 0;
    }
    
    const textBlocks = blocks.filter(block => 
      block.BlockType === 'LINE' && 
      typeof block.Confidence === 'number'
    );
    
    if (textBlocks.length === 0) {
      return 0.5;
    }
    
    const totalConfidence = textBlocks.reduce((sum, block) => sum + block.Confidence, 0);
    return Math.round((totalConfidence / textBlocks.length) / 100 * 100) / 100;
  }

  /**
   * Basic field extraction as fallback
   */
  static extractContactFieldsBasic(text) {
    const fields = [];
    
    if (!text) return fields;
    
    // Very basic email extraction
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      fields.push({
        label: 'Email',
        value: emailMatch[0],
        type: 'standard',
        confidence: 0.8,
        source: 'basic_regex'
      });
    }
    
    // Basic phone extraction
    const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
      fields.push({
        label: 'Phone',
        value: phoneMatch[0],
        type: 'standard',
        confidence: 0.7,
        source: 'basic_regex'
      });
    }
    
    return fields;
  }

  /**
   * Parse structured contact data from QR
   */
  static parseStructuredContactData(data) {
    const lines = data.split('\n');
    const contactData = {};
    
    lines.forEach(line => {
      if (line.includes('@')) {
        contactData.email = line.trim();
      } else if (/^\+?\d/.test(line)) {
        contactData.phone = line.trim();
      } else if (line.length > 2 && line.length < 50) {
        if (!contactData.name) {
          contactData.name = line.trim();
        } else if (!contactData.company) {
          contactData.company = line.trim();
        }
      }
    });
    
    return {
      type: 'structured',
      contactData
    };
  }

  /**
   * Capitalize first letter of string
   */
  static capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  }
}