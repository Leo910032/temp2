// lib/services/serviceEnterprise/client/abstractions/BaseService.js
// Phase 3: Base abstraction for all enterprise services

"use client"
import { EnterpriseApiClient } from '../core/apiClient';
import { globalCache } from '../core/cacheManager';
import { ErrorHandler } from '../core/errorHandler';

export class BaseService {
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

   // ✅ FIXED: This method is now much simpler and delegates correctly.
  async cachedRequest(operation, requestFn, category = 'default', params = {}) {
    const cacheKey = this.getCacheKey(operation, params);
    
    try {
      // The new CacheManager handles everything: checking the cache,
      // handling pending requests (deduplication), and executing the function on a miss.
      // We just need to pass it the key AND the function to run.
      return await globalCache.get(cacheKey, requestFn, category);

    } catch (error) {
      // Error handling remains the same, but we re-throw the handled object
      // for better context in the calling function.
      const handled = ErrorHandler.handle(error, `${this.serviceName}.${operation}`);
      throw handled;
    }
  }

  // Standard invalidation patterns
  invalidateCache(patterns = []) {
    if (patterns.length === 0) {
      patterns = [this.cachePrefix];
    }
    
    patterns.forEach(pattern => {
      globalCache.invalidate(pattern);
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








