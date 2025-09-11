// lib/services/serviceContact/client/services/EnhancedExchangeService.js
// Enhanced client-side exchange service with integrated business card scanning

import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';
import { ContactErrorHandler } from '../core/contactErrorHandler';

export class EnhancedExchangeService extends BaseContactService {
  constructor() {
    super('EnhancedExchangeService');
  }

  // ==================== PROFILE VERIFICATION ====================

  /**
   * Verify if a profile exists by username
   */
  async verifyProfileByUsername(username) {
    this.validateParams({ username }, ['username']);

    try {
      return this.cachedRequest(
        'profile_verify',
        () => ContactApiClient.get(`/api/user/contacts/exchange/verify?username=${encodeURIComponent(username)}`),
        { username }
      );
    } catch (error) {
      throw ContactErrorHandler.handle(error, 'verifyProfileByUsername');
    }
  }

  /**
   * Verify if a profile exists by user ID
   */
  async verifyProfileByUserId(userId) {
    this.validateParams({ userId }, ['userId']);

    try {
      return this.cachedRequest(
        'profile_verify',
        () => ContactApiClient.get(`/api/user/contacts/exchange/verify?userId=${encodeURIComponent(userId)}`),
        'longTerm',
        { userId }
      );
    } catch (error) {
      throw ContactErrorHandler.handle(error, 'verifyProfileByUserId');
    }
  }

  // ==================== SECURE SCAN TOKEN MANAGEMENT ====================

  /**
   * Request a secure scanning token for public business card scanning
   */
  async requestScanToken(profileIdentifier, identifierType = 'username') {
    try {
      console.log('🔐 EnhancedExchangeService: Requesting secure scan token');

      const result = await ContactApiClient.post('/api/user/contacts/exchange/scan-token', {
        [identifierType]: profileIdentifier,
        requestedAt: new Date().toISOString(),
        clientInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });

      if (!result.success || !result.scanToken) {
        throw new Error('Failed to obtain scan token');
      }

      console.log('✅ EnhancedExchangeService: Scan token obtained successfully');
      
      // Cache the token for this session
      this.cacheScanToken(result.scanToken, result.expiresAt);
      
      return result;

    } catch (error) {
      console.error('❌ EnhancedExchangeService: Scan token request failed:', error);
      throw ContactErrorHandler.handle(error, 'requestScanToken');
    }
  }

  /**
   * Cache scan token securely in session storage
   */
  cacheScanToken(token, expiresAt) {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const tokenData = {
          token,
          expiresAt,
          cachedAt: new Date().toISOString()
        };
        sessionStorage.setItem('exchange_scan_token', JSON.stringify(tokenData));
      }
    } catch (error) {
      console.warn('Failed to cache scan token:', error);
    }
  }

  /**
   * Get cached scan token if valid
   */
  getCachedScanToken() {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const cached = sessionStorage.getItem('exchange_scan_token');
        if (cached) {
          const tokenData = JSON.parse(cached);
          if (new Date(tokenData.expiresAt) > new Date()) {
            return tokenData.token;
          } else {
            sessionStorage.removeItem('exchange_scan_token');
          }
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to get cached scan token:', error);
      return null;
    }
  }

  // ==================== BUSINESS CARD SCANNING ====================
/**
 * Use a pre-generated scan token from server-side generation
 * This bypasses the client-side token request for better UX
 */
usePreGeneratedScanToken(token, expiresAt = null) {
  try {
    console.log('🔐 EnhancedExchangeService: Using pre-generated scan token');
    
    // Calculate expiry if not provided (default 1 hour)
    const expiry = expiresAt || new Date(Date.now() + 3600000).toISOString();
    
    // Cache the token
    this.cacheScanToken(token, expiry);
    
    console.log('✅ EnhancedExchangeService: Pre-generated token cached successfully');
    return true;
    
  } catch (error) {
    console.error('❌ EnhancedExchangeService: Failed to cache pre-generated token:', error);
    return false;
  }
}

 
/**
 * Modified scan method that prefers cached tokens over new requests
 */
async scanBusinessCard(imageData, options = {}) {
  try {
    console.log('📇 EnhancedExchangeService: Starting business card scan');

    const {
      profileIdentifier,
      identifierType = 'username',
      language = 'en',
      scanMode = 'single',
      retryOnTokenExpiry = true
    } = options;

    // Process image data
    const processedImageData = await this.processImageDataForScanning(imageData, scanMode);

    // Try to get cached token first (from pre-generation or previous requests)
    let scanToken = this.getCachedScanToken();
    
    if (!scanToken) {
      console.log('🔄 EnhancedExchangeService: No cached token found, requesting new one');
      
      if (!profileIdentifier) {
        throw new Error('Profile identifier required for new token generation');
      }
      
      const tokenResult = await this.requestScanToken(profileIdentifier, identifierType);
      scanToken = tokenResult.scanToken;
    } else {
      console.log('✅ EnhancedExchangeService: Using cached scan token');
    }

    // Perform the scan
    const scanResult = await this.performSecureScan(processedImageData, scanToken, language);

    console.log('✅ EnhancedExchangeService: Business card scan completed');
    return scanResult;

  } catch (error) {
    console.error('❌ EnhancedExchangeService: Business card scan failed:', error);
    
    // Handle token expiry with retry
    if (options.retryOnTokenExpiry && error.message.includes('token')) {
      console.log('🔄 EnhancedExchangeService: Retrying with new token');
      sessionStorage.removeItem('exchange_scan_token');
      return this.scanBusinessCard(imageData, { ...options, retryOnTokenExpiry: false });
    }
    
    throw ContactErrorHandler.handle(error, 'scanBusinessCard');
  }
}

  /**
   * Process image data for scanning (handles single/double side modes)
   */
  async processImageDataForScanning(imageData, scanMode) {
    console.log('🔄 EnhancedExchangeService: Processing image data for scanning');

    if (scanMode === 'single') {
      // Single image
      const base64Data = await this.convertToBase64(imageData);
      return { front: base64Data };
    } else if (scanMode === 'double') {
      // Two images (front and back)
      if (!Array.isArray(imageData) || imageData.length !== 2) {
        throw new Error('Double mode requires exactly 2 images (front and back)');
      }
      
      const [frontData, backData] = await Promise.all([
        this.convertToBase64(imageData[0]),
        this.convertToBase64(imageData[1])
      ]);
      
      return { front: frontData, back: backData };
    } else {
      throw new Error(`Unsupported scan mode: ${scanMode}`);
    }
  }

  /**
   * Convert various image formats to base64
   */
  async convertToBase64(imageInput) {
    if (typeof imageInput === 'string') {
      // Already base64 or data URL
      return imageInput.startsWith('data:') ? imageInput.split(',')[1] : imageInput;
    }
    
    if (imageInput instanceof File || imageInput instanceof Blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          resolve(result.split(',')[1]); // Remove data URL prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageInput);
      });
    }
    
    throw new Error('Unsupported image input format');
  }

  /**
   * Perform secure scan with token
   */
  async performSecureScan(processedImageData, scanToken, language) {
    try {
      console.log('📡 EnhancedExchangeService: Calling secure scan API');

      const response = await ContactApiClient.post('/api/user/contacts/exchange/scan', {
        images: processedImageData,
        scanToken,
        language,
        metadata: {
          scanId: this.generateScanId(),
          clientVersion: '2.0.0',
          timestamp: new Date().toISOString(),
          scanMode: Object.keys(processedImageData).length > 1 ? 'double' : 'single'
        }
      });

      if (!response.success) {
        throw new Error(response.error || 'Scan failed');
      }

      return {
        success: true,
        parsedFields: response.parsedFields || [],
        dynamicFields: response.dynamicFields || [],
        personalizedMessage: response.personalizedMessage,
        metadata: {
          ...response.metadata,
          enhancedProcessing: true,
          serviceVersion: '2.0.0'
        }
      };

    } catch (error) {
      console.error('❌ EnhancedExchangeService: Secure scan API call failed:', error);
      throw error;
    }
  }

  // ==================== CONTACT EXCHANGE OPERATIONS ====================

  /**
   * Submit contact via exchange form (enhanced with scan integration)
   */
  async submitExchangeContact(exchangeData) {
    try {
      console.log('📝 EnhancedExchangeService: Submitting exchange contact');

      // Validate exchange data
      this.validateExchangeData(exchangeData);

      // Validate contact data structure
      const contactValidation = this.validateContactData(exchangeData.contact);
      if (!contactValidation.isValid) {
        throw new Error(`Invalid contact data: ${contactValidation.errors.join(', ')}`);
      }

      // Prepare submission payload
      const submissionData = {
        contact: this.sanitizeContactData(exchangeData.contact),
        metadata: this.prepareSubmissionMetadata(exchangeData.metadata)
      };

      // Add target profile information
      if (exchangeData.targetUserId) {
        submissionData.userId = exchangeData.targetUserId;
      } else if (exchangeData.targetUsername) {
        submissionData.username = exchangeData.targetUsername;
      } else {
        throw new Error('Target profile information required');
      }

      // Submit through the proper API endpoint
      const result = await ContactApiClient.post('/api/user/contacts/exchange/submit', submissionData);

      // Invalidate relevant caches
      this.invalidateCache(['profile_verify', 'exchange']);

      console.log('✅ EnhancedExchangeService: Contact submitted successfully');
      return result;

    } catch (error) {
      console.error('❌ EnhancedExchangeService: Contact submission failed:', error);
      throw ContactErrorHandler.handle(error, 'submitExchangeContact');
    }
  }

  // ==================== LOCATION SERVICES ====================

  /**
   * Get current user location with enhanced accuracy
   */
  async getCurrentLocation(options = {}) {
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    };
    const finalOptions = { ...defaultOptions, ...options };

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by this browser'));
      }

      let attempts = 0;
      const maxAttempts = 3;
      const targetAccuracy = 100;

      const tryGetLocation = () => {
        attempts++;
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            console.log(`🎯 Location attempt ${attempts}: accuracy ${Math.round(accuracy)}m`);

            if (accuracy <= targetAccuracy || attempts >= maxAttempts) {
              resolve({
                latitude,
                longitude,
                accuracy: Math.round(accuracy),
                timestamp: new Date(position.timestamp).toISOString(),
              });
            } else {
              setTimeout(tryGetLocation, 1500);
            }
          },
          (error) => {
            if (attempts < maxAttempts && error.code !== error.PERMISSION_DENIED) {
              setTimeout(tryGetLocation, 2000);
            } else {
              let errorMessage = 'Failed to get location';
              if (error.code === error.PERMISSION_DENIED) errorMessage = 'Location permission denied';
              if (error.code === error.POSITION_UNAVAILABLE) errorMessage = 'Location information unavailable';
              if (error.code === error.TIMEOUT) errorMessage = 'Location request timeout';
              reject(new Error(errorMessage));
            }
          },
          {
            ...finalOptions,
            maximumAge: attempts > 1 ? 0 : finalOptions.maximumAge
          }
        );
      };

      tryGetLocation();
    });
  }

  /**
   * Check geolocation permission status
   */
  async checkLocationPermission() {
    if (!navigator.permissions) {
      return { state: 'unavailable', supported: false };
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return {
        state: result.state,
        supported: true
      };
    } catch (error) {
      return { state: 'unavailable', supported: false };
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Generate unique scan ID
   */
  generateScanId() {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate exchange submission data
   */
  validateExchangeData(exchangeData) {
    const errors = [];

    if (!exchangeData || typeof exchangeData !== 'object') {
      throw new Error('Exchange data must be an object');
    }

    if (!exchangeData.contact) {
      errors.push('Contact data is required');
    }

    if (!exchangeData.targetUserId && !exchangeData.targetUsername) {
      errors.push('Target profile information is required');
    }

    if (exchangeData.targetUsername && typeof exchangeData.targetUsername !== 'string') {
      errors.push('Target username must be a string');
    }

    if (exchangeData.targetUserId && typeof exchangeData.targetUserId !== 'string') {
      errors.push('Target user ID must be a string');
    }

    if (errors.length > 0) {
      throw new Error(`Exchange validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  /**
   * Validate contact data structure
   */
  validateContactData(contactData) {
    const errors = [];

    if (!contactData.name || !contactData.name.trim()) {
      errors.push('Name is required');
    }

    if (!contactData.email || !contactData.email.trim()) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) {
      errors.push('Invalid email format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize contact data for submission
   */
  sanitizeContactData(contactData) {
    const sanitized = {
      name: this.sanitizeString(contactData.name),
      email: this.sanitizeEmail(contactData.email),
      phone: this.sanitizeString(contactData.phone),
      company: this.sanitizeString(contactData.company),
      jobTitle: this.sanitizeString(contactData.jobTitle),
      website: this.normalizeWebsiteUrl(contactData.website),
      message: this.sanitizeString(contactData.message, 500)
    };

    // Handle dynamic fields
    if (Array.isArray(contactData.dynamicFields)) {
      sanitized.dynamicFields = contactData.dynamicFields.map(field => ({
        ...field,
        label: this.sanitizeString(field.label, 100),
        value: this.sanitizeString(field.value, 500)
      }));
    }

    // Handle location data
    if (contactData.location && typeof contactData.location === 'object') {
      sanitized.location = this.sanitizeLocation(contactData.location);
    }

    // Remove empty values
    Object.keys(sanitized).forEach(key => {
      if (!sanitized[key] && sanitized[key] !== 0) {
        delete sanitized[key];
      }
    });

    return sanitized;
  }

  /**
   * Sanitize string input
   */
  sanitizeString(input, maxLength = 200) {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>\"']/g, '') // Remove dangerous characters
      .trim()
      .substring(0, maxLength);
  }

  /**
   * Sanitize email input
   */
  sanitizeEmail(email) {
    if (!email || typeof email !== 'string') return '';
    
    return email
      .trim()
      .toLowerCase()
      .replace(/[<>\"']/g, '')
      .substring(0, 100);
  }

  /**
   * Normalize website URL
   */
  normalizeWebsiteUrl(url) {
    if (!url || typeof url !== 'string') {
      return '';
    }

    const trimmedUrl = url.trim();
    
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }
    
    if (trimmedUrl.startsWith('www.')) {
      return `https://${trimmedUrl}`;
    }
    
    if (trimmedUrl.includes('.') && !trimmedUrl.includes(' ')) {
      return `https://${trimmedUrl}`;
    }
    
    return trimmedUrl;
  }

  /**
   * Sanitize location data
   */
  sanitizeLocation(location) {
    if (!location || typeof location !== 'object') return null;

    const sanitized = {};

    if (typeof location.latitude === 'number' && !isNaN(location.latitude)) {
      sanitized.latitude = Math.round(location.latitude * 1000000) / 1000000;
    }

    if (typeof location.longitude === 'number' && !isNaN(location.longitude)) {
      sanitized.longitude = Math.round(location.longitude * 1000000) / 1000000;
    }

    if (typeof location.accuracy === 'number' && location.accuracy > 0) {
      sanitized.accuracy = Math.round(location.accuracy);
    }

    if (location.timestamp) {
      sanitized.timestamp = new Date(location.timestamp).toISOString();
    }

    return sanitized.latitude && sanitized.longitude ? sanitized : null;
  }

  /**
   * Prepare submission metadata
   */
  prepareSubmissionMetadata(metadata = {}) {
    return {
      userAgent: metadata.userAgent ? metadata.userAgent.substring(0, 500) : '',
      referrer: metadata.referrer ? metadata.referrer.substring(0, 500) : '',
      sessionId: metadata.sessionId || this.generateSessionId(),
      timezone: metadata.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: metadata.language || navigator.language || 'en',
      submissionTime: new Date().toISOString(),
      scannedCard: metadata.scannedCard || false,
      dynamicFieldCount: metadata.dynamicFieldCount || 0
    };
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `exchange_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get enhanced scanning capabilities
   */
  getScanningCapabilities() {
    return {
      available: true,
      supportedModes: ['single', 'double'],
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      maxFileSize: 15 * 1024 * 1024, // 15MB
      features: [
        'OCR text extraction',
        'QR code detection',
        'AI field mapping',
        'Dynamic field detection',
        'Personalized messaging',
        'Secure token authentication'
      ],
      security: [
        'Token-based authentication',
        'Rate limiting',
        'Cost tracking',
        'Session validation'
      ]
    };
  }
}