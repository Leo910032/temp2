// lib/services/serviceContact/server/businessCardService.js
// Server-side business card scanning service following enterprise pattern

import { ContactSecurityService } from './contactSecurityService';
import { ContactValidationService } from './contactValidationService';
import { 
  CONTACT_ACTIVITIES,
  CONTACT_FEATURES
} from '../client/services/constants/contactConstants.js';

export class BusinessCardService {

  // ==================== BUSINESS CARD PROCESSING ====================

  /**
   * Process business card scan from base64 image data
   */
  static async processBusinessCardScan(userId, imageBase64) {
    try {
      console.log('📇 BusinessCardService: Processing business card scan for user:', userId);

      // Validate subscription access
      await this.validateScanAccess(userId);

      // Check rate limits
      await ContactSecurityService.checkRateLimit(userId, 'scan');

      // Validate and sanitize image data
      const validatedImageData = this.validateAndSanitizeImageData(imageBase64);

      // Perform OCR processing
      const ocrResult = await this.performOCRProcessing(validatedImageData);

      // Process QR codes if present
      const qrResult = await this.processQRCodes(validatedImageData);

      // Merge OCR and QR results
      const scanResult = this.mergeScanResults(ocrResult, qrResult);

      // Enhance with AI processing
      const enhancedResult = await this.enhanceWithAI(scanResult, validatedImageData);

      // Validate and structure the final result
      const finalResult = this.structureScanResult(enhancedResult);

      // Log audit event
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
      return finalResult;

    } catch (error) {
      console.error('❌ BusinessCardService: Error processing scan:', error);
      
      // Return graceful fallback result
      return this.createFallbackResult(error.message);
    }
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
   */
  /**
   * ✅ FIXED: Call Google Vision API for OCR using credentials from .env.local
   */
  static async callGoogleVisionAPI(imageBase64) {
    try {
      const vision = await import('@google-cloud/vision');

      // Use the credentials directly from your .env.local file
      // This is more secure and flexible than relying on a key file.
      const credentials = {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        // The private key needs to have newline characters correctly interpreted
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
      
      const client = new vision.ImageAnnotatorClient({
        projectId: credentials.project_id,
        credentials,
      });

      const request = {
        image: { content: imageBase64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], // DOCUMENT_TEXT_DETECTION is generally better for business cards
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
      // Add more detailed logging for auth errors
      console.error("Google Vision Auth Details:", {
        projectId: process.env.FIREBASE_PROJECT_ID ? 'Loaded' : 'MISSING',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? 'Loaded' : 'MISSING',
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? 'Loaded' : 'MISSING'
      });
      throw new Error(`Google Vision API error: ${error.message}`);
    }
  }

  /**


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