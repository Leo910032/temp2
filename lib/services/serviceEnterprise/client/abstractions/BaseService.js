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

  // Standard cached request pattern
  async cachedRequest(operation, requestFn, category = 'default', params = {}) {
    const cacheKey = this.getCacheKey(operation, params);
    
    try {
      // Check cache first
      const cached = globalCache.get(cacheKey);
      if (cached) {
        console.log(`Cache hit: ${cacheKey}`);
        return cached;
      }

      // Execute request
      const result = await requestFn();
      
      // Cache result
      globalCache.set(cacheKey, result, category);
      console.log(`Cached result: ${cacheKey}`);
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, `${this.serviceName}.${operation}`);
      throw new Error(handled.message);
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








