
// lib/services/serviceContact/client/core/contactErrorHandler.js
// Contact error handler following enterprise pattern

"use client"
import { ContactApiError } from './contactApiClient';

export class ContactErrorHandler {
  static handle(error, context = '') {
    console.error(`❌ Contact Error ${context}:`, error);

    if (error instanceof ContactApiError) {
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

    if (error.isSubscriptionError) {
      return {
        type: 'subscription',
        message: 'This feature requires a subscription upgrade.',
        retry: false,
        showUpgrade: true
      };
    }

    if (error.isValidationError) {
      return {
        type: 'validation',
        message: error.message || 'Invalid data provided',
        retry: false
      };
    }

    if (error.isServerError) {
      return {
        type: 'server',
        message: 'Server error. Please try again in a moment.',
        retry: true
      };
    }

    if (error.status === 404) {
      return {
        type: 'notfound',
        message: 'Contact or resource not found',
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