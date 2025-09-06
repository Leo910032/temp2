// lib/services/serviceContact/client/abstractions/BaseContactService.js
// Base abstraction for all contact services

"use client"
import { ContactApiClient } from '../core/contactApiClient';
import { contactCache } from '../core/contactCacheManager';
import { ContactErrorHandler } from '../core/contactErrorHandler';

export class BaseContactService {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.cachePrefix = serviceName.toLowerCase();
  }

  // Standard cache key generation
  getCacheKey(operation, params = {}) {
    const paramString = Object.keys(params).length > 0 
      ? '_' + Object.values(params).join('_')
      : '';
    return `${this.cachePrefix}_${operation}${paramString}`;
  }

  // Cached request with error handling
  async cachedRequest(operation, requestFn, category = 'default', params = {}) {
    const cacheKey = this.getCacheKey(operation, params);
    
    try {
      return await contactCache.get(cacheKey, requestFn, category);
    } catch (error) {
      const handled = ContactErrorHandler.handle(error, `${this.serviceName}.${operation}`);
      throw handled;
    }
  }

  // Standard invalidation patterns
  invalidateCache(patterns = []) {
    if (patterns.length === 0) {
      patterns = [this.cachePrefix];
    }
    
    patterns.forEach(pattern => {
      contactCache.invalidate(pattern);
    });
  }

  // Validate required parameters
  validateParams(params, required = []) {
    for (const param of required) {
      if (!params[param]) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }
}
