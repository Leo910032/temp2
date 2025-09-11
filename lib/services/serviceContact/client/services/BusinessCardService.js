// lib/services/serviceContact/client/services/BusinessCardService.js - ENHANCED WITH COST TRACKING
// Client-side business card scanning service with front/back support and cost tracking

import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';
import { ContactErrorHandler } from '../core/contactErrorHandler';

export class BusinessCardService extends BaseContactService {
  constructor() {
    super('BusinessCardService');
  }

  // ==================== BUSINESS CARD SCANNING ====================

  /**
   * Scan business card from various image sources
   * Enhanced to support multiple images (front/back)
   */
  async scanBusinessCard(imageData, options = {}) {
    try {
      console.log('📇 BusinessCardService: Starting business card scan');

      if (!imageData) {
        throw new Error('No image data provided');
      }

      const {
        side = 'front',
        trackCost = true,
        userId = null
      } = options;

      // Check cost before processing if tracking is enabled
      if (trackCost && userId) {
        const costCheck = await this.checkScanCost(userId);
        if (!costCheck.canAfford) {
          throw new Error(`Cannot afford scan: ${costCheck.reason}`);
        }
      }

      // Process the image data into base64 format
      const processedBase64 = await this.processImageData(imageData);

      // Validate the processed data
      this.validateImageBase64(processedBase64);

      // Make API request to scan the business card
      const result = await ContactApiClient.post('/api/user/contacts/scan', {
        imageBase64: processedBase64,
        side,
        trackCost,
        metadata: {
          scanId: this.generateScanId(),
          timestamp: new Date().toISOString(),
          clientVersion: '2.0.0'
        }
      });

      console.log('✅ BusinessCardService: Scan completed successfully');
      return result;

    } catch (error) {
      console.error('❌ BusinessCardService: Scan failed:', error);
      throw ContactErrorHandler.handle(error, 'scanBusinessCard');
    }
  }

  /**
   * Scan multiple card sides (front and back)
   */
  async scanMultipleSides(imageDataArray, options = {}) {
    try {
      console.log('📇 BusinessCardService: Starting multi-side scan');

      if (!Array.isArray(imageDataArray) || imageDataArray.length === 0) {
        throw new Error('No image data provided for multi-side scan');
      }

      const {
        trackCost = true,
        userId = null
      } = options;

      // Check total cost for all sides
      if (trackCost && userId) {
        const totalCostCheck = await this.checkMultiScanCost(userId, imageDataArray.length);
        if (!totalCostCheck.canAfford) {
          throw new Error(`Cannot afford multi-side scan: ${totalCostCheck.reason}`);
        }
      }

      const results = [];
      const sides = ['front', 'back', 'additional'];

      for (let i = 0; i < imageDataArray.length; i++) {
        const imageData = imageDataArray[i];
        const side = sides[i] || `side_${i + 1}`;

        console.log(`📇 Processing ${side} side (${i + 1}/${imageDataArray.length})`);

        try {
          const result = await this.scanBusinessCard(imageData, {
            side,
            trackCost,
            userId
          });

          results.push({
            side,
            result,
            success: true
          });

        } catch (error) {
          console.error(`❌ Failed to scan ${side} side:`, error);
          results.push({
            side,
            error: error.message,
            success: false
          });
        }
      }

      // Merge results from all sides
      const mergedResult = this.mergeSideResults(results);

      console.log('✅ BusinessCardService: Multi-side scan completed');
      return mergedResult;

    } catch (error) {
      console.error('❌ BusinessCardService: Multi-side scan failed:', error);
      throw ContactErrorHandler.handle(error, 'scanMultipleSides');
    }
  }

  /**
   * Merge results from multiple card sides
   */
  mergeSideResults(sideResults) {
    const mergedFields = new Map();
    const metadata = {
      sidesProcessed: sideResults.length,
      successfulSides: sideResults.filter(r => r.success).length,
      hasQRCode: false,
      totalCost: 0,
      processedAt: new Date().toISOString(),
      sideDetails: []
    };

    sideResults.forEach(({ side, result, success, error }) => {
      if (success && result) {
        // Track metadata
        if (result.metadata?.hasQRCode) {
          metadata.hasQRCode = true;
        }
        if (result.metadata?.cost) {
          metadata.totalCost += result.metadata.cost;
        }

        metadata.sideDetails.push({
          side,
          success: true,
          fieldsFound: result.parsedFields?.length || 0,
          hasQRCode: result.metadata?.hasQRCode || false,
          cost: result.metadata?.cost || 0
        });

        // Merge fields
        if (result.parsedFields) {
          result.parsedFields.forEach(field => {
            const key = field.label.toLowerCase();
            const existingField = mergedFields.get(key);

            if (!existingField) {
              // New field - add with side info
              mergedFields.set(key, {
                ...field,
                source: `${field.source}_${side}`,
                sides: [side]
              });
            } else {
              // Field exists - merge or keep higher confidence
              if (field.confidence > existingField.confidence) {
                mergedFields.set(key, {
                  ...field,
                  source: `${field.source}_${side}`,
                  sides: [...existingField.sides, side],
                  previousValue: existingField.value
                });
              } else {
                // Keep existing but note this side had it too
                existingField.sides.push(side);
                if (field.value !== existingField.value) {
                  existingField.alternativeValues = existingField.alternativeValues || [];
                  existingField.alternativeValues.push({
                    value: field.value,
                    side,
                    confidence: field.confidence
                  });
                }
              }
            }
          });
        }
      } else {
        // Failed side
        metadata.sideDetails.push({
          side,
          success: false,
          error,
          cost: 0
        });
      }
    });

    // Add scan summary field
    mergedFields.set('scan_summary', {
      label: 'Scan Summary',
      value: this.generateScanSummary(metadata),
      type: 'custom',
      confidence: 1.0,
      source: 'system',
      sides: metadata.sideDetails.map(d => d.side)
    });

    return {
      success: metadata.successfulSides > 0,
      parsedFields: Array.from(mergedFields.values()),
      metadata
    };
  }

  /**
   * Generate scan summary text
   */
  generateScanSummary(metadata) {
    const parts = [];
    
    parts.push(`Processed ${metadata.sidesProcessed} side(s)`);
    parts.push(`${metadata.successfulSides} successful`);
    
    if (metadata.hasQRCode) {
      parts.push('QR code detected');
    }
    
    if (metadata.totalCost > 0) {
      parts.push(`Cost: $${metadata.totalCost.toFixed(4)}`);
    }
    
    return parts.join(' • ');
  }

  // ==================== COST TRACKING METHODS ====================

  /**
   * Check if user can afford a single scan
   */
  async checkScanCost(userId) {
    try {
      const response = await ContactApiClient.get('/api/user/contacts/scan/cost-check');
      return response;
    } catch (error) {
      console.error('❌ Failed to check scan cost:', error);
      return { canAfford: false, reason: 'cost_check_failed' };
    }
  }

  /**
   * Check if user can afford multiple scans
   */
  async checkMultiScanCost(userId, scanCount) {
    try {
      const response = await ContactApiClient.get(`/api/user/contacts/scan/cost-check?count=${scanCount}`);
      return response;
    } catch (error) {
      console.error('❌ Failed to check multi-scan cost:', error);
      return { canAfford: false, reason: 'cost_check_failed' };
    }
  }

  /**
   * Get cost estimate for scanning
   */
  async getCostEstimate(scanCount = 1) {
    try {
      const response = await ContactApiClient.get(`/api/user/contacts/scan/cost-estimate?count=${scanCount}`);
      return response;
    } catch (error) {
      console.error('❌ Failed to get cost estimate:', error);
      return { estimated: 0, currency: 'USD' };
    }
  }

  /**
   * Get user's scanning usage statistics
   */
  async getUsageStats() {
    try {
      const response = await ContactApiClient.get('/api/user/contacts/scan/usage-stats');
      return response;
    } catch (error) {
      console.error('❌ Failed to get usage stats:', error);
      return { 
        monthlyScans: 0, 
        monthlyCost: 0, 
        remainingBudget: 0,
        subscriptionLevel: 'base'
      };
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Generate unique scan ID
   */
  generateScanId() {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Process various image data formats into base64
   */
  async processImageData(imageData) {
    console.log('🔄 Processing image data:', {
      type: typeof imageData,
      constructor: imageData?.constructor?.name,
      isFile: imageData instanceof File,
      isBlob: imageData instanceof Blob,
      isArray: Array.isArray(imageData)
    });

    // Handle different input formats
    if (Array.isArray(imageData)) {
      return this.processArrayInput(imageData);
    }
    
    if (imageData instanceof File || imageData instanceof Blob) {
      return this.convertFileToBase64(imageData);
    }
    
    if (imageData instanceof FileList) {
      return this.processFileList(imageData);
    }
    
    if (typeof imageData === 'string') {
      return this.processStringInput(imageData);
    }
    
    if (imageData?.target?.files) {
      return this.processEventInput(imageData);
    }
    
    if (imageData?.imageBase64) {
      return this.processObjectInput(imageData);
    }

    throw new Error('Unsupported image data format');
  }

  /**
   * Process array input (drag & drop, multiple selection)
   */
  async processArrayInput(imageArray) {
    if (imageArray.length === 0) {
      throw new Error('Array is empty, no file to process');
    }
    
    const firstItem = imageArray[0];
    if (!(firstItem instanceof File) && !(firstItem instanceof Blob)) {
      throw new Error(`Array contains invalid item: ${typeof firstItem}`);
    }
    
    console.log('📁 Processing first file from array:', firstItem.name || 'unnamed blob');
    return this.convertFileToBase64(firstItem);
  }

  /**
   * Process FileList input
   */
  async processFileList(fileList) {
    if (fileList.length === 0) {
      throw new Error('FileList is empty, no file to process');
    }
    
    const file = fileList[0];
    console.log('📁 Processing first file from FileList:', file.name);
    return this.convertFileToBase64(file);
  }

  /**
   * Process string input (data URL or base64)
   */
  processStringInput(stringData) {
    if (stringData.startsWith('data:image/')) {
      // Data URL format
      console.log('🔗 Processing data URL');
      const base64Part = stringData.split(',')[1];
      if (!base64Part || base64Part.length < 100) {
        throw new Error('Data URL contains invalid base64 data');
      }
      return base64Part;
    }
    
    // Assume pure base64 string
    console.log('📝 Processing base64 string');
    if (stringData.length < 100) {
      throw new Error('Base64 string too short');
    }
    
    // Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(stringData)) {
      throw new Error('Invalid base64 format');
    }
    
    return stringData;
  }

  /**
   * Process event input (file input events)
   */
  async processEventInput(eventData) {
    const file = eventData.target.files[0];
    if (!file) {
      throw new Error('No file selected in event');
    }
    
    console.log('📂 Processing file from event:', file.name);
    return this.convertFileToBase64(file);
  }

  /**
   * Process object input with imageBase64 property
   */
  processObjectInput(objectData) {
    const imageBase64 = objectData.imageBase64;
    
    if (imageBase64.startsWith('data:image/')) {
      const base64Part = imageBase64.split(',')[1];
      if (!base64Part || base64Part.length < 100) {
        throw new Error('Object imageBase64 property contains invalid data');
      }
      return base64Part;
    }
    
    return imageBase64;
  }

  /**
   * Convert File or Blob to base64
   */
  convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
      // Validate file
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }

      if (file.size === 0) {
        reject(new Error('File is empty'));
        return;
      }

      if (file.size > 15 * 1024 * 1024) {
        reject(new Error('File too large (max 15MB)'));
        return;
      }

      // Validate file type if available
      if (file.type && !file.type.startsWith('image/')) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
          reject(new Error(`Invalid file type: ${file.type}. Must be JPEG, PNG, WebP, or GIF`));
          return;
        }
      }

      console.log('🔄 Converting file to base64:', {
        name: file.name || 'unnamed blob',
        size: file.size,
        type: file.type
      });

      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const result = event.target.result;
          
          if (!result || typeof result !== 'string') {
            reject(new Error('FileReader returned invalid result'));
            return;
          }

          if (!result.startsWith('data:')) {
            reject(new Error('FileReader result is not a data URL'));
            return;
          }

          const base64Part = result.split(',')[1];
          if (!base64Part || base64Part.length < 100) {
            reject(new Error('Could not extract valid base64 data'));
            return;
          }

          console.log('✅ File converted to base64:', {
            originalSize: file.size,
            base64Length: base64Part.length,
            estimatedSize: Math.round(base64Part.length * 0.75)
          });

          resolve(base64Part);
        } catch (error) {
          reject(new Error(`Error processing FileReader result: ${error.message}`));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onabort = () => reject(new Error('File reading was aborted'));

      reader.readAsDataURL(file);
    });
  }

  /**
   * Validate base64 image data
   */
  validateImageBase64(base64Data) {
    if (!base64Data || typeof base64Data !== 'string') {
      throw new Error('Base64 data must be a string');
    }

    if (base64Data.length < 100) {
      throw new Error('Base64 data too short');
    }

    // Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(base64Data)) {
      throw new Error('Invalid base64 format');
    }

    // Check estimated size (base64 is ~33% larger than binary)
    const estimatedSize = base64Data.length * 0.75;
    if (estimatedSize > 15 * 1024 * 1024) {
      throw new Error('Image too large after processing');
    }

    console.log('✅ Base64 validation passed:', {
      length: base64Data.length,
      estimatedSizeKB: Math.round(estimatedSize / 1024)
    });
  }

  // ==================== ADVANCED FEATURES ====================

  /**
   * Create contact from scanned business card fields
   */
  async createContactFromScan(scannedFields) {
    try {
      if (!scannedFields || !Array.isArray(scannedFields)) {
        throw new Error('Scanned fields array is required');
      }

      // Extract contact data from scanned fields
      const contactData = this.extractContactDataFromScan(scannedFields);
      
      // Import ContactService to create the contact
      const { ContactServiceFactory } = await import('../factories/ContactServiceFactory');
      const contactService = ContactServiceFactory.getContactService();
      
      return await contactService.createContact(contactData);

    } catch (error) {
      console.error('❌ Error creating contact from scan:', error);
      throw ContactErrorHandler.handle(error, 'createContactFromScan');
    }
  }

/**
 * FIXED: Extract contact data from scanned business card fields
 * This method now properly handles exact field mapping to prevent taglines from overwriting company names
 */
extractContactDataFromScan(scannedFields) {
  console.log('🔍 Extracting contact data from scanned fields:', scannedFields);
  
  const contactData = {
    source: 'business_card_scan',
    status: 'new',
    submittedAt: new Date().toISOString()
  };

  // Enhanced field mapping with exact matching to prevent conflicts
  scannedFields.forEach((field, index) => {
    const label = field.label.trim();
    const labelLower = label.toLowerCase();
    const value = field.value.trim();

    console.log(`🔍 Processing field ${index}: "${label}" = "${value}"`);

    if (!value) {
      console.log(`⚠️ Skipping empty field: ${label}`);
      return;
    }

    // FIXED: Use exact matching instead of includes() to prevent conflicts
    switch (labelLower) {
      case 'name':
      case 'full name':
      case 'person name':
        contactData.name = value;
        console.log(`✅ Mapped to name: ${value}`);
        break;
        
      case 'email':
      case 'email address':
        contactData.email = value.toLowerCase();
        console.log(`✅ Mapped to email: ${value}`);
        break;
        
      case 'phone':
      case 'phone number':
      case 'telephone':
      case 'tel':
      case 'mobile':
        contactData.phone = value;
        console.log(`✅ Mapped to phone: ${value}`);
        break;
        
      case 'company':
      case 'organization':
      case 'company name':
        // CRITICAL: Only map if it's exactly "company", not "company tagline"
        if (labelLower === 'company' || labelLower === 'organization' || labelLower === 'company name') {
          contactData.company = value;
          console.log(`✅ Mapped to company: ${value}`);
        }
        break;
        
      case 'job title':
      case 'title':
      case 'position':
      case 'role':
        contactData.jobTitle = value;
        console.log(`✅ Mapped to jobTitle: ${value}`);
        break;
        
      case 'website':
      case 'url':
      case 'web':
        contactData.website = this.normalizeWebsiteUrl(value);
        console.log(`✅ Mapped to website: ${contactData.website}`);
        break;
        
      case 'address':
      case 'location':
      case 'street address':
        contactData.address = value;
        console.log(`✅ Mapped to address: ${value}`);
        break;
        
      default:
        // All other fields (including "Company Tagline") are stored as details only
        console.log(`📋 Field "${label}" stored as detail only (not mapped to main contact)`);
        break;
    }
  });

  // Ensure we have at least a name
  if (!contactData.name) {
    // Try to find a name from other fields or use fallback
    const nameField = scannedFields.find(f => 
      f.label.toLowerCase().includes('name') && f.value.trim()
    );
    contactData.name = nameField ? nameField.value.trim() : 'Unnamed Contact';
    console.log(`🔧 Generated fallback name: ${contactData.name}`);
  }

  // Store all scanned fields as details (this preserves everything including taglines)
  contactData.details = scannedFields.filter(f => f.value.trim() !== '');

  console.log('🎯 Final contact data mapping:', {
    name: contactData.name,
    email: contactData.email,
    phone: contactData.phone,
    company: contactData.company,
    jobTitle: contactData.jobTitle,
    website: contactData.website,
    totalDetails: contactData.details.length
  });

  return contactData;
}

/**
 * Enhanced method: Normalize website URL to include protocol
 */
normalizeWebsiteUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmedUrl = url.trim();
  
  // If already has protocol, return as-is
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }
  
  // If starts with www., add https://
  if (trimmedUrl.startsWith('www.')) {
    return `https://${trimmedUrl}`;
  }
  
  // If it looks like a domain (contains a dot and no spaces), add https://
  if (trimmedUrl.includes('.') && !trimmedUrl.includes(' ')) {
    return `https://${trimmedUrl}`;
  }
  
  // Otherwise, return as-is (might not be a valid URL)
  return trimmedUrl;
}

/**
 * NEW METHOD: Normalize website URL to include protocol
 */
normalizeWebsiteUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmedUrl = url.trim();
  
  // If already has protocol, return as-is
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }
  
  // If starts with www., add https://
  if (trimmedUrl.startsWith('www.')) {
    return `https://${trimmedUrl}`;
  }
  
  // If it looks like a domain (contains a dot and no spaces), add https://
  if (trimmedUrl.includes('.') && !trimmedUrl.includes(' ')) {
    return `https://${trimmedUrl}`;
  }
  
  // Otherwise, return as-is (might not be a valid URL)
  return trimmedUrl;
}

// SOLUTION 2: Update server-side validation (in ContactValidationService or similar)
// Add this method to handle website validation:

static validateWebsiteUrl(url) {
  if (!url || typeof url !== 'string') {
    return { isValid: true, normalizedUrl: '' }; // Empty is OK
  }

  let normalizedUrl = url.trim();
  
  // Auto-prepend https:// if missing protocol
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    if (normalizedUrl.startsWith('www.') || normalizedUrl.includes('.')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
  }
  
  // Now validate the URL
  try {
    const urlObj = new URL(normalizedUrl);
    
    // Check if it's a valid protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        isValid: false,
        error: 'Website must use http:// or https:// protocol',
        normalizedUrl
      };
    }
    
    return {
      isValid: true,
      normalizedUrl: urlObj.toString()
    };
    
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid website URL format',
      normalizedUrl
    };
  }
}

// SOLUTION 3: Update the field validation in BusinessCardService server-side
// In businessCardService.js, update the validateFieldValue method:

static validateFieldValue(label, value) {
  const errors = [];
  let normalizedValue = value;
  
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
      // FIX: Use the new website validation logic
      const websiteValidation = this.validateWebsiteUrl(value);
      if (!websiteValidation.isValid) {
        errors.push(websiteValidation.error);
      } else {
        normalizedValue = websiteValidation.normalizedUrl;
      }
      break;
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    normalizedValue // Return the normalized value
  };
}

// Helper method for website URL validation
static validateWebsiteUrl(url) {
  if (!url || typeof url !== 'string') {
    return { isValid: true, normalizedUrl: '' };
  }

  let normalizedUrl = url.trim();
  
  // Auto-prepend https:// if missing protocol
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    if (normalizedUrl.includes('.') && !normalizedUrl.includes(' ')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
  }
  
  try {
    const urlObj = new URL(normalizedUrl);
    return {
      isValid: true,
      normalizedUrl: urlObj.toString()
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid website URL format',
      normalizedUrl
    };
  }
}

  /**
   * Batch scan multiple business cards
   */
  async batchScanCards(imageDataArray, options = {}) {
    try {
      console.log(`📇 Starting batch scan of ${imageDataArray.length} cards`);

      const {
        trackCost = true,
        userId = null,
        maxConcurrent = 3
      } = options;

      // Check total cost for batch operation
      if (trackCost && userId) {
        const batchCostCheck = await this.checkMultiScanCost(userId, imageDataArray.length);
        if (!batchCostCheck.canAfford) {
          throw new Error(`Cannot afford batch scan: ${batchCostCheck.reason}`);
        }
      }

      const results = [];
      
      // Process in batches to avoid overwhelming the API
      for (let i = 0; i < imageDataArray.length; i += maxConcurrent) {
        const batch = imageDataArray.slice(i, i + maxConcurrent);
        
        const batchPromises = batch.map(async (imageData, index) => {
          const cardNumber = i + index + 1;
          
          try {
            console.log(`📇 Processing card ${cardNumber}/${imageDataArray.length}`);
            
            const result = await this.scanBusinessCard(imageData, {
              trackCost,
              userId,
              side: 'single'
            });

            return {
              cardNumber,
              success: true,
              result
            };
            
          } catch (error) {
            console.error(`❌ Failed to scan card ${cardNumber}:`, error);
            return {
              cardNumber,
              success: false,
              error: error.message
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const summary = {
        totalCards: imageDataArray.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };

      console.log('✅ Batch scan completed:', summary);
      return summary;

    } catch (error) {
      console.error('❌ Batch scan failed:', error);
      throw ContactErrorHandler.handle(error, 'batchScanCards');
    }
  }

  /**
   * Get supported image formats and limits
   */
  getSupportedFormats() {
    return {
      fileTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
      maxFileSize: 15 * 1024 * 1024, // 15MB
      maxDimensions: { width: 4096, height: 4096 },
      inputTypes: [
        'File objects',
        'Blob objects',
        'Base64 strings',
        'Data URLs',
        'FileList objects',
        'Arrays of files',
        'File input events'
      ],
      scanModes: [
        'single_side',
        'front_and_back',
        'batch_processing'
      ]
    };
  }

  /**
   * Estimate scan success probability based on image analysis
   */
  estimateScanSuccess(imageData) {
    try {
      let score = 50; // Base score

      // Check if we have valid image data
      if (!imageData) {
        return { score: 0, quality: 'none', message: 'No image provided' };
      }

      // Boost score based on file type
      if (imageData instanceof File) {
        score += 20;
        if (imageData.type === 'image/jpeg' || imageData.type === 'image/jpg') {
          score += 10; // JPEG is often best for photos
        }
        
        // Check file size (sweet spot is 500KB - 5MB)
        if (imageData.size >= 500000 && imageData.size <= 5000000) {
          score += 10;
        } else if (imageData.size < 100000) {
          score -= 20; // Too small, probably low quality
        }
      }

      const quality = score >= 80 ? 'excellent' : 
                     score >= 60 ? 'good' : 
                     score >= 40 ? 'fair' : 'poor';

      return {
        score: Math.min(score, 100),
        quality,
        message: `Estimated success rate: ${quality}`,
        recommendations: this.getQualityRecommendations(score)
      };
    } catch (error) {
      return { 
        score: 0, 
        quality: 'error', 
        message: error.message,
        recommendations: []
      };
    }
  }

  /**
   * Get quality improvement recommendations
   */
  getQualityRecommendations(score) {
    const recommendations = [];
    
    if (score < 60) {
      recommendations.push('Ensure good lighting when taking photos');
      recommendations.push('Keep the camera steady to avoid blur');
      recommendations.push('Make sure text is clearly visible and in focus');
    }
    
    if (score < 40) {
      recommendations.push('Try cleaning the card surface');
      recommendations.push('Avoid shadows and glare');
      recommendations.push('Take photo perpendicular to the card surface');
    }
    
    return recommendations;
  }

  /**
   * Validate image data input (helper for external validation)
   */
  validateImageDataInput(imageData) {
    try {
      if (!imageData) {
        return { isValid: false, error: 'No image data provided' };
      }

      // Check file size if it's a File object
      if (imageData instanceof File) {
        if (imageData.size > 15 * 1024 * 1024) {
          return { isValid: false, error: 'File too large (max 15MB)' };
        }
        
        if (!imageData.type.startsWith('image/')) {
          return { isValid: false, error: 'Invalid file type' };
        }
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }

  /**
 * Scan business card using public API with secure token
 * This method is specifically for the exchange form integration
 */
async scanPublicBusinessCard(imageData, scanToken) {
  try {
    console.log('📇 BusinessCardService: Starting public business card scan');

    if (!imageData) {
      throw new Error('No image data provided');
    }

    if (!scanToken) {
      throw new Error('Secure scan token is required for public scanning');
    }

    // Process the image data into base64 format
    const processedBase64 = await this.processImageData(imageData);

    // Validate the processed data
    this.validateImageBase64(processedBase64);

    // Make API request to public scan endpoint
    const result = await this.callPublicScanAPI(processedBase64, scanToken);

    console.log('✅ BusinessCardService: Public scan completed successfully');
    return result;

  } catch (error) {
    console.error('❌ BusinessCardService: Public scan failed:', error);
    throw ContactErrorHandler.handle(error, 'scanPublicBusinessCard');
  }
}
/**
 * Call the public business card scan API
 */
async callPublicScanAPI(imageBase64, scanToken) {
  try {
    const response = await fetch('/api/user/contacts/scan/public', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        scanToken
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Public scan failed');
    }

    return {
      success: true,
      parsedFields: result.parsedFields || [],
      personalizedMessage: result.personalizedMessage,
      metadata: {
        ...result.metadata,
        isPublicScan: true,
        scanMethod: 'public_api'
      }
    };

  } catch (error) {
    console.error('❌ Public scan API call failed:', error);
    
    // Enhanced error handling for specific cases
    if (error.message.includes('budget') || error.message.includes('BUDGET_EXCEEDED')) {
      throw new Error('AI budget exceeded for this profile. The profile owner needs to upgrade their plan.');
    }
    
    if (error.message.includes('rate limit') || error.message.includes('RATE_LIMIT_EXCEEDED')) {
      throw new Error('Too many scan attempts. Please try again in a few minutes.');
    }
    
    if (error.message.includes('token') || error.message.includes('INVALID_TOKEN')) {
      throw new Error('Scan session expired. Please refresh the page and try again.');
    }
    
    if (error.message.includes('origin') || error.message.includes('CSRF')) {
      throw new Error('Security error. Please ensure you are accessing this page directly.');
    }

    throw error;
  }
}

/*
 * Estimate public scan capability and cost
 */
async estimatePublicScanCost() {
  try {
    // This would typically call a cost estimation endpoint
    // For now, return a conservative estimate
    return {
      estimated: 0.002,
      currency: 'USD',
      features: [
        'OCR text extraction',
        'QR code detection',
        'AI field mapping',
        'Personalized message generation'
      ],
      processingTime: '2-5 seconds',
      accuracy: 'High (90%+ for clear images)'
    };
  } catch (error) {
    console.error('❌ Failed to estimate public scan cost:', error);
    return {
      estimated: 0.002,
      currency: 'USD',
      error: 'Unable to fetch current pricing'
    };
  }
}
/**
 * Check if public scanning is available for the current session
 */
isPublicScanningAvailable() {
  try {
    // Check browser capabilities
    const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasFileApi = !!(window.File && window.FileReader && window.FileList && window.Blob);
    const hasCanvas = !!document.createElement('canvas').getContext;
    
    return {
      available: hasCamera || hasFileApi,
      capabilities: {
        camera: hasCamera,
        fileUpload: hasFileApi,
        imageProcessing: hasCanvas
      },
      recommendation: hasCamera ? 'camera' : hasFileApi ? 'upload' : 'not_available'
    };
  } catch (error) {
    console.error('❌ Error checking public scan availability:', error);
    return {
      available: false,
      error: error.message
    };
  }
}
 /* Get optimized camera constraints for business card scanning
 */
getOptimalCameraConstraints() {
  return {
    video: {
      facingMode: 'environment', // Use back camera on mobile
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      aspectRatio: { ideal: 16/9 },
      // Advanced constraints for better business card capture
      focusMode: { ideal: 'continuous' },
      exposureMode: { ideal: 'continuous' },
      whiteBalanceMode: { ideal: 'continuous' }
    }
  };
}
/**
 * Validate image quality for business card scanning
 */
validateImageForBusinessCard(imageData) {
  const validation = {
    isValid: true,
    warnings: [],
    recommendations: []
  };

  try {
    if (imageData instanceof File) {
      // Check file size
      if (imageData.size < 50000) { // 50KB
        validation.warnings.push('Image file is very small, which may affect scan quality');
        validation.recommendations.push('Try taking a higher resolution photo');
      }
      
      if (imageData.size > 10000000) { // 10MB
        validation.isValid = false;
        validation.warnings.push('Image file is too large');
        validation.recommendations.push('Please compress the image or use a smaller file');
      }

      // Check file type
      if (!imageData.type.startsWith('image/')) {
        validation.isValid = false;
        validation.warnings.push('File is not an image');
        validation.recommendations.push('Please select a JPEG, PNG, or WebP image file');
      }
    }

    // Add general recommendations
    validation.recommendations.push(
      'Ensure the business card is well-lit and clearly visible',
      'Avoid shadows and glare on the card surface',
      'Keep the camera steady and perpendicular to the card'
    );

  } catch (error) {
    validation.isValid = false;
    validation.warnings.push('Error validating image: ' + error.message);
  }

  return validation;
}
/**
 * Format public scan results for display in exchange form
 */
formatPublicScanResults(scanResult) {
  if (!scanResult || !scanResult.parsedFields) {
    return {
      formData: {},
      confidence: 0,
      hasPersonalizedMessage: false
    };
  }

  const formData = {};
  let totalConfidence = 0;
  let fieldCount = 0;

  // Map parsed fields to form fields
  scanResult.parsedFields.forEach(field => {
    const label = field.label.toLowerCase();
    const value = field.value.trim();
    
    if (value && field.confidence > 0.5) { // Only use high-confidence fields
      switch (label) {
        case 'name':
          formData.name = value;
          break;
        case 'email':
          formData.email = value;
          break;
        case 'phone':
          formData.phone = value;
          break;
        case 'company':
          formData.company = value;
          break;
        case 'job title':
        case 'title':
          formData.jobTitle = value;
          break;
      }
      
      totalConfidence += field.confidence;
      fieldCount++;
    }
  });

  const averageConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;

  return {
    formData,
    confidence: averageConfidence,
    hasPersonalizedMessage: !!scanResult.personalizedMessage,
    personalizedMessage: scanResult.personalizedMessage,
    fieldsPopulated: Object.keys(formData).length,
    processingTime: scanResult.metadata?.processingTime,
    hasQRCode: scanResult.metadata?.hasQRCode || false
  };
}

/**
 * Generate scan session analytics for debugging
 */
generateScanAnalytics(scanResult, startTime) {
  const endTime = Date.now();
  const totalTime = endTime - startTime;

  return {
    sessionId: `public_scan_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    timing: {
      totalTime: `${totalTime}ms`,
      serverProcessing: scanResult.metadata?.processingTime || 'unknown',
      networkTime: `${totalTime - (parseInt(scanResult.metadata?.processingTime) || 0)}ms`
    },
    results: {
      success: scanResult.success,
      fieldsDetected: scanResult.parsedFields?.length || 0,
      averageConfidence: this.calculateAverageConfidence(scanResult.parsedFields),
      hasPersonalizedMessage: !!scanResult.personalizedMessage,
      hasQRCode: scanResult.metadata?.hasQRCode || false
    },
    quality: {
      processingMethod: scanResult.metadata?.scanMethod || 'unknown',
      estimatedCost: scanResult.metadata?.cost || 'unknown'
    }
  };
}

/**
 * Calculate average confidence from parsed fields
 */
calculateAverageConfidence(parsedFields) {
  if (!parsedFields || parsedFields.length === 0) return 0;
  
  const totalConfidence = parsedFields.reduce((sum, field) => sum + (field.confidence || 0), 0);
  return Math.round((totalConfidence / parsedFields.length) * 100) / 100;
}

/**
 * Handle scan errors with user-friendly messages
 */
handlePublicScanError(error) {
  const errorMappings = {
    'budget': {
      userMessage: 'AI scanning budget exceeded for this profile',
      suggestion: 'Please fill the form manually or ask the profile owner to upgrade their plan',
      severity: 'warning'
    },
    'rate limit': {
      userMessage: 'Too many scan attempts',
      suggestion: 'Please wait a few minutes before trying again',
      severity: 'info'
    },
    'token': {
      userMessage: 'Scan session expired',
      suggestion: 'Please refresh the page and try again',
      severity: 'warning'
    },
    'network': {
      userMessage: 'Connection error during scanning',
      suggestion: 'Please check your internet connection and try again',
      severity: 'error'
    },
    'image': {
      userMessage: 'Unable to process the image',
      suggestion: 'Please try a clearer photo or upload a different image',
      severity: 'warning'
    }
  };

  const errorType = Object.keys(errorMappings).find(type => 
    error.message.toLowerCase().includes(type)
  );

  if (errorType) {
    return {
      ...errorMappings[errorType],
      originalError: error.message,
      timestamp: new Date().toISOString()
    };
  }

  return {
    userMessage: 'Scanning failed',
    suggestion: 'Please try again or fill the form manually',
    severity: 'error',
    originalError: error.message,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get scan troubleshooting tips
 */
getTroubleshootingTips() {
  return {
    imageQuality: [
      'Ensure the business card is well-lit',
      'Avoid shadows and reflections',
      'Keep the camera steady',
      'Make sure all text is clearly visible'
    ],
    technicalIssues: [
      'Check your internet connection',
      'Try refreshing the page',
      'Clear your browser cache',
      'Make sure camera permissions are granted'
    ],
    alternatives: [
      'Try uploading a photo instead of using the camera',
      'Take multiple photos and choose the clearest one',
      'Fill the form manually if scanning continues to fail'
    ]
  };
}
}