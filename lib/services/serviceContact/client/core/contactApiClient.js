// lib/services/serviceContact/client/core/contactApiClient.js
// Contact API client following enterprise pattern

"use client"
import { auth } from '@/important/firebase';

/**
 * Contact API Client for all contact operations
 * Follows the same pattern as EnterpriseApiClient
 */
export class ContactApiClient {
  static async getAuthHeaders() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const token = await user.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  static getRequestMetadata() {
    return {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
  }

  static async makeRequest(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers: customHeaders = {},
      timeout = 10000,
      responseType = 'json'
    } = options;

    try {
      // Get auth headers
      const authHeaders = await this.getAuthHeaders();
      const headers = { ...authHeaders, ...customHeaders };

      // Build request config
      const config = {
        method,
        headers,
        ...(body && { body: JSON.stringify(body) })
      };

      // Add timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      config.signal = controller.signal;

      // Make request
      const response = await fetch(endpoint, config);
      clearTimeout(timeoutId);

      // Handle response
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ContactApiError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData.code,
          errorData.details
        );
      }

      switch (responseType) {
        case 'blob':
          return await response.blob();
        case 'text':
          return await response.text();
        default: // 'json'
          return await response.json();
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ContactApiError('Request timeout', 408, 'TIMEOUT');
      }
      
      if (error instanceof ContactApiError) {
        throw error;
      }

      throw new ContactApiError(
        error.message || 'Network error',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  // Convenience methods
  static async get(endpoint, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'GET' });
  }

  static async post(endpoint, body, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'POST', body });
  }

  static async put(endpoint, body, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'PUT', body });
  }

  static async patch(endpoint, body, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'PATCH', body });
  }

  static async delete(endpoint, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'DELETE' });
  }
}

/**
 * Custom error class for contact operations
 */
export class ContactApiError extends Error {
  constructor(message, status = 0, code = null, details = null) {
    super(message);
    this.name = 'ContactApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }

  get isNetworkError() {
    return this.status === 0 || this.code === 'NETWORK_ERROR';
  }

  get isServerError() {
    return this.status >= 500;
  }

  get isValidationError() {
    return this.status === 400;
  }

  get isSubscriptionError() {
    return this.code === 'SUBSCRIPTION_REQUIRED';
  }
}
