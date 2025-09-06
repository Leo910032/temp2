// lib/services/serviceContact/client/core/contactApiClient.js
// Contact API client following enterprise pattern - ENHANCED ERROR HANDLING

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

  static async getAuthToken() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return await user.getIdToken();
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
      timeout = 30000,
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

      // Log the request for debugging
      console.log(`[ContactApiClient] ${method} ${endpoint}`, {
        body,
        headers: { ...headers, Authorization: '[REDACTED]' }
      });

      // Make request
      const response = await fetch(endpoint, config);
      clearTimeout(timeoutId);

      // Enhanced error handling with detailed logging
      if (!response.ok) {
        let errorData = {};
        let errorText = '';
        
        try {
          // Try to get JSON error response
          const responseText = await response.text();
          errorText = responseText;
          
          if (responseText) {
            errorData = JSON.parse(responseText);
          }
        } catch (parseError) {
          console.warn('[ContactApiClient] Failed to parse error response:', parseError);
          errorData = { error: errorText || `HTTP ${response.status}` };
        }

        // Enhanced error logging
        console.error(`[ContactApiClient] Request failed:`, {
          endpoint,
          method,
          status: response.status,
          statusText: response.statusText,
          errorData,
          errorText: errorText.substring(0, 500) // Log first 500 chars
        });

        throw new ContactApiError(
          errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData.code,
          errorData.details || errorData
        );
      }

      // Success logging
      console.log(`[ContactApiClient] ${method} ${endpoint} - Success (${response.status})`);

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
        console.error('[ContactApiClient] Request timeout:', endpoint);
        throw new ContactApiError('Request timeout', 408, 'TIMEOUT');
      }
      
      if (error instanceof ContactApiError) {
        throw error;
      }

      // Enhanced network error logging
      console.error('[ContactApiClient] Network error:', {
        endpoint,
        method,
        error: error.message,
        stack: error.stack
      });

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
    return this.code === 'SUBSCRIPTION_REQUIRED' || this.code === 'SUBSCRIPTION_LIMIT_EXCEEDED';
  }

  get isBudgetError() {
    return this.code === 'BUDGET_EXCEEDED' || this.message?.includes('budget exceeded');
  }

  // Enhanced error information
  toString() {
    return `ContactApiError: ${this.message} (Status: ${this.status}, Code: ${this.code})`;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      details: this.details
    };
  }
}