// lib/services/serviceContact/client/services/BusinessCardService.js
// Client-side business card scanning service following enterprise pattern

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
   * Handles File, Blob, base64 string, data URL, and other formats
   */
  async scanBusinessCard(imageData) {
    try {
      console.log('📇 BusinessCardService: Starting business card scan');

      if (!imageData) {
        throw new Error('No image data provided');
      }

      // Process the image data into base64 format
      const processedBase64 = await this.processImageData(imageData);

      // Validate the processed data
      this.validateImageBase64(processedBase64);

      // Make API request to scan the business card
      const result = await ContactApiClient.post('/api/user/contacts/scan', {
        imageBase64: processedBase64
      });

      console.log('✅ BusinessCardService: Scan completed successfully');
      return result;

    } catch (error) {
      console.error('❌ BusinessCardService: Scan failed:', error);
      throw ContactErrorHandler.handle(error, 'scanBusinessCard');
    }
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

  // ==================== HELPER METHODS ====================

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
   * Extract contact data from scanned business card fields
   */
  extractContactDataFromScan(scannedFields) {
    const contactData = {
      source: 'business_card_scan',
      status: 'new',
      submittedAt: new Date().toISOString()
    };

    // Map scanned fields to contact data
    scannedFields.forEach(field => {
      const label = field.label.toLowerCase();
      const value = field.value.trim();

      if (!value) return;

      if (label.includes('name')) {
        contactData.name = value;
      } else if (label.includes('email')) {
        contactData.email = value.toLowerCase();
      } else if (label.includes('phone') || label.includes('tel')) {
        contactData.phone = value;
      } else if (label.includes('company')) {
        contactData.company = value;
      } else if (label.includes('title') || label.includes('position')) {
        contactData.jobTitle = value;
      } else if (label.includes('website') || label.includes('url')) {
        contactData.website = value;
      }
    });

    // Ensure we have at least a name
    if (!contactData.name) {
      contactData.name = 'Unnamed Contact';
    }

    // Store all scanned fields as details
    contactData.details = scannedFields.filter(f => f.value.trim() !== '');

    return contactData;
  }

  /**
   * Validate image data input (helper for external validation)
   */
  validateImageDataInput(imageData) {
    try {
      if (!imageData) {
        return { isValid: false, error: 'No image data provided' };
      }

      // This method can be used by components to validate before scanning
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Get supported image formats
   */
  getSupportedFormats() {
    return {
      fileTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
      maxFileSize: 15 * 1024 * 1024, // 15MB
      inputTypes: [
        'File objects',
        'Blob objects',
        'Base64 strings',
        'Data URLs',
        'FileList objects',
        'Arrays of files',
        'File input events'
      ]
    };
  }

  /**
   * Estimate scan success probability
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
        message: `Estimated success rate: ${quality}`
      };
    } catch (error) {
      return { score: 0, quality: 'error', message: error.message };
    }
  }
}