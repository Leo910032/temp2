// lib/services/serviceContact/client/services/ExchangeService.js
// Exchange service for contact sharing functionality following enterprise pattern

import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';
import { ContactErrorHandler } from '../core/contactErrorHandler';
import { validateContactData } from '../../constants/contactConstants';

export class ExchangeService extends BaseContactService {
  constructor() {
    super('ExchangeService');
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

  // ==================== CONTACT EXCHANGE OPERATIONS ====================

  /**
   * Submit contact via exchange form
   */
  async submitExchangeContact(exchangeData) {
    try {
      // Validate required exchange data
      this.validateExchangeData(exchangeData);

      // Validate contact data structure
      const contactValidation = validateContactData(exchangeData.contact);
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

      const result = await ContactApiClient.post('/api/user/contacts/exchange/submit', submissionData);

      // Invalidate relevant caches
      this.invalidateCache(['profile_verify', 'exchange']);

      return result;

    } catch (error) {
      throw ContactErrorHandler.handle(error, 'submitExchangeContact');
    }
  }

  /**
   * Get exchange statistics for a profile
   */
  async getExchangeStats(profileId) {
    this.validateParams({ profileId }, ['profileId']);

    try {
      return this.cachedRequest(
        'exchange_stats',
        () => ContactApiClient.get(`/api/user/contacts/exchange/stats/${profileId}`),
        'analytics',
        { profileId }
      );
    } catch (error) {
      throw ContactErrorHandler.handle(error, 'getExchangeStats');
    }
  }

  /**
   * Get exchange history (for profile owners)
   */
  async getExchangeHistory(filters = {}) {
    try {
      const { limit = 50, offset = 0, status, dateRange } = filters;

      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());
      if (status) params.append('status', status);
      if (dateRange?.start) params.append('startDate', dateRange.start);
      if (dateRange?.end) params.append('endDate', dateRange.end);

      const url = `/api/user/contacts/exchange/history${params.toString() ? `?${params.toString()}` : ''}`;

      return this.cachedRequest(
        'exchange_history',
        () => ContactApiClient.get(url),
        'contacts',
        filters
      );

    } catch (error) {
      throw ContactErrorHandler.handle(error, 'getExchangeHistory');
    }
  }

  // ==================== LOCATION SERVICES ====================

  /**
   * Get current user location
   */
 async getCurrentLocation(options = {}) {
    const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 15000,        // Increased timeout to give it more time
        maximumAge: 60000,     // Allow a cached position up to 1 minute old
    };
    const finalOptions = { ...defaultOptions, ...options };

    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error('Geolocation is not supported by this browser'));
        }

        let attempts = 0;
        const maxAttempts = 3;
        const targetAccuracy = 100; // Our goal is accuracy better than 100 meters

        const tryGetLocation = () => {
            attempts++;
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    console.log(`🎯 Location attempt ${attempts}: accuracy ${Math.round(accuracy)}m`);

                    // If accuracy is good enough, or we've run out of attempts, resolve.
                    if (accuracy <= targetAccuracy || attempts >= maxAttempts) {
                        resolve({
                            latitude,
                            longitude,
                            accuracy: Math.round(accuracy),
                            timestamp: new Date(position.timestamp).toISOString(),
                        });
                    } else {
                        // Accuracy is poor, try again after a short delay.
                        setTimeout(tryGetLocation, 1500);
                    }
                },
                (error) => {
                    // If we can retry, do so. Otherwise, reject.
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
                    // On retries, force a fresh reading.
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
        state: result.state, // 'granted', 'denied', 'prompt'
        supported: true
      };
    } catch (error) {
      return { state: 'unavailable', supported: false };
    }
  }

  // ==================== VALIDATION AND SANITIZATION ====================

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
   * Sanitize contact data for submission
   */
  sanitizeContactData(contactData) {
    const sanitized = {
      name: this.sanitizeString(contactData.name),
      email: this.sanitizeEmail(contactData.email),
      phone: this.sanitizeString(contactData.phone),
      company: this.sanitizeString(contactData.company),
      message: this.sanitizeString(contactData.message, 500)
    };

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
   * Prepare submission metadata
   */
  prepareSubmissionMetadata(metadata = {}) {
    return {
      userAgent: metadata.userAgent ? metadata.userAgent.substring(0, 500) : '',
      referrer: metadata.referrer ? metadata.referrer.substring(0, 500) : '',
      sessionId: metadata.sessionId || this.generateSessionId(),
      timezone: metadata.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: metadata.language || navigator.language || 'en',
      submissionTime: new Date().toISOString()
    };
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `exchange_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== UTILITY METHODS ====================

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
   * Sanitize location data
   */
  sanitizeLocation(location) {
    if (!location || typeof location !== 'object') return null;

    const sanitized = {};

    if (typeof location.latitude === 'number' && !isNaN(location.latitude)) {
      sanitized.latitude = Math.round(location.latitude * 1000000) / 1000000; // 6 decimal places
    }

    if (typeof location.longitude === 'number' && !isNaN(location.longitude)) {
      sanitized.longitude = Math.round(location.longitude * 1000000) / 1000000; // 6 decimal places
    }

    if (typeof location.accuracy === 'number' && location.accuracy > 0) {
      sanitized.accuracy = Math.round(location.accuracy);
    }

    if (location.timestamp) {
      sanitized.timestamp = new Date(location.timestamp).toISOString();
    }

    // Only return location if we have valid coordinates
    if (sanitized.latitude && sanitized.longitude) {
      return sanitized;
    }

    return null;
  }

  /**
   * Format exchange for display
   */
  formatExchangeForDisplay(exchange) {
    return {
      ...exchange,
      displayName: exchange.name || 'Anonymous Contact',
      displayEmail: exchange.email || 'No email provided',
      displayPhone: exchange.phone || 'No phone provided',
      displayCompany: exchange.company || 'No company provided',
      isRecent: this.isRecentExchange(exchange.submittedAt),
      hasLocation: !!(exchange.location && exchange.location.latitude),
      formattedDate: this.formatDate(exchange.submittedAt)
    };
  }

  /**
   * Check if exchange is recent (within last 24 hours)
   */
  isRecentExchange(submittedAt) {
    if (!submittedAt) return false;
    
    const exchangeDate = new Date(submittedAt);
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    return exchangeDate > oneDayAgo;
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
      return 'Invalid date';
    }
  }

  /**
   * Get supported exchange features
   */
  getSupportedFeatures() {
    return {
      geolocation: !!navigator.geolocation,
      permissions: !!navigator.permissions,
      notifications: !!window.Notification,
      localStorage: !!window.localStorage,
      sessionStorage: !!window.sessionStorage
    };
  }

  /**
   * Estimate submission success rate based on data quality
   */
  estimateSubmissionSuccess(contactData) {
    let score = 0;
    let maxScore = 0;

    // Required fields
    maxScore += 20;
    if (contactData.name && contactData.name.trim().length > 0) score += 20;

    maxScore += 20;
    if (contactData.email && this.validateEmailFormat(contactData.email)) score += 20;

    // Optional but valuable fields
    maxScore += 10;
    if (contactData.phone && contactData.phone.trim().length > 0) score += 10;

    maxScore += 10;
    if (contactData.company && contactData.company.trim().length > 0) score += 10;

    maxScore += 5;
    if (contactData.message && contactData.message.trim().length > 0) score += 5;

    maxScore += 10;
    if (contactData.location && contactData.location.latitude) score += 10;

    const percentage = Math.round((score / maxScore) * 100);
    
    return {
      percentage,
      score,
      maxScore,
      quality: percentage >= 80 ? 'excellent' : percentage >= 60 ? 'good' : percentage >= 40 ? 'fair' : 'poor'
    };
  }

  /**
   * Validate email format
   */
  validateEmailFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
