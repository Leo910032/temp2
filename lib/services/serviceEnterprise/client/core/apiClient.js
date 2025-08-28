// lib/services/serviceEnterprise/client/core/apiClient.js
// 🎯 PHASE 2: Base API client with unified error handling and auth

"use client"
import { auth } from '@/important/firebase';

/**
 * Base API Client for all enterprise operations
 * Centralizes authentication, error handling, and request metadata
 */
export class EnterpriseApiClient {
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
      timeout = 10000
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
        throw new EnterpriseApiError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData.code,
          errorData.details
        );
      }

      return await response.json();

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new EnterpriseApiError('Request timeout', 408, 'TIMEOUT');
      }
      
      if (error instanceof EnterpriseApiError) {
        throw error;
      }

      throw new EnterpriseApiError(
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
 * Custom error class for better error handling
 */
export class EnterpriseApiError extends Error {
  constructor(message, status = 0, code = null, details = null) {
    super(message);
    this.name = 'EnterpriseApiError';
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
}