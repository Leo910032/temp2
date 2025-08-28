

// lib/services/serviceEnterprise/client/core/cacheManager.js
// 🎯 PHASE 2: Simplified and unified caching strategy

"use client"

export class CacheManager {
  constructor() {
    this.cache = new Map();
    this.expirationTimes = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    
    // TTL configurations by data type
    this.ttlConfig = {
      userContext: 10 * 60 * 1000,      // 10 minutes
      subscriptionStatus: 15 * 60 * 1000, // 15 minutes  
      teamData: 5 * 60 * 1000,          // 5 minutes
      teamMembers: 2 * 60 * 1000,       // 2 minutes
      invitations: 1 * 60 * 1000,       // 1 minute
      permissions: 5 * 60 * 1000,       // 5 minutes
      analytics: 30 * 1000              // 30 seconds
    };
  }

  set(key, value, category = 'default') {
    const ttl = this.ttlConfig[category] || this.defaultTTL;
    this.cache.set(key, value);
    this.expirationTimes.set(key, Date.now() + ttl);
    
    console.log(`📦 Cached: ${key} (TTL: ${ttl}ms)`);
  }

  get(key) {
    const expirationTime = this.expirationTimes.get(key);
    
    if (!expirationTime || Date.now() > expirationTime) {
      this.cache.delete(key);
      this.expirationTimes.delete(key);
      return null;
    }
    
    console.log(`✅ Cache hit: ${key}`);
    return this.cache.get(key);
  }

  invalidate(pattern) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.expirationTimes.delete(key);
    });
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Invalidated ${keysToDelete.length} cache entries for: ${pattern}`);
    }
  }

  clear() {
    this.cache.clear();
    this.expirationTimes.clear();
    console.log('🧹 Cache cleared');
  }

  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Global cache instance
export const globalCache = new CacheManager();
