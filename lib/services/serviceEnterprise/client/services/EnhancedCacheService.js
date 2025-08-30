// lib/services/serviceEnterprise/client/services/EnhancedCacheService.js
// Phase 3: Centralized cache management service

"use client"
import { BaseService } from '../abstractions/BaseService';
import { globalCache } from '../core/cacheManager';

export class EnhancedCacheService extends BaseService {
  constructor() {
    super('CacheService');
  }

  /**
   * Get statistics about the global cache
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    return globalCache.getStats();
  }

  /**
   * Clear all caches managed by the global cache manager
   */
  clearAllCaches() {
    globalCache.clear();
    console.log('🧹 All enterprise caches cleared via service');
  }

  /**
   * Clear only analytics-related caches
   */
  clearAnalyticsCaches() {
    globalCache.invalidate('analytics_');
    console.log('🧹 Analytics caches cleared via service');
  }

  /**
   * Invalidate specific cache patterns
   * @param {string[]} patterns - An array of patterns to invalidate
   */
  invalidateCache(patterns = []) {
    super.invalidateCache(patterns);
  }
}
