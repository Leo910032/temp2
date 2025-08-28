
// lib/services/serviceEnterprise/client/core/errorHandler.js
// 🎯 PHASE 2: Centralized error handling

"use client"
import { EnterpriseApiError } from './apiClient';

export class ErrorHandler {
  static handle(error, context = '') {
    console.error(`❌ Enterprise Error ${context}:`, error);

    if (error instanceof EnterpriseApiError) {
      return this.handleApiError(error);
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        type: 'network',
        message: 'Network connection failed. Please check your internet connection.',
        retry: true
      };
    }

    return {
      type: 'unknown',
      message: error.message || 'An unexpected error occurred',
      retry: false
    };
  }

  static handleApiError(error) {
    if (error.isAuthError) {
      return {
        type: 'auth',
        message: error.status === 401 
          ? 'Authentication required. Please log in again.'
          : 'Access denied. You may not have permission for this action.',
        retry: false,
        redirectToLogin: error.status === 401
      };
    }

    if (error.isServerError) {
      return {
        type: 'server',
        message: 'Server error. Please try again in a moment.',
        retry: true
      };
    }

    if (error.status === 400) {
      return {
        type: 'validation',
        message: error.message || 'Invalid request data',
        retry: false
      };
    }

    if (error.status === 404) {
      return {
        type: 'notfound',
        message: 'Requested resource not found',
        retry: false
      };
    }

    return {
      type: 'api',
      message: error.message || 'API request failed',
      retry: error.status >= 500
    };
  }

  static getUserFriendlyMessage(error) {
    const handled = this.handle(error);
    return handled.message;
  }
}
