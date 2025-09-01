"use client"

// Default Time-To-Live values in milliseconds
const TTL = {
  DEFAULT: 5 * 60 * 1000,       // 5 minutes
  TEAM_MEMBERS: 2 * 60 * 1000,  // 2 minutes
  ANALYTICS: 30 * 1000,         // 30 seconds
  PERMISSIONS: 10 * 60 * 1000,  // 10 minutes
  LONG_TERM: 30 * 60 * 1000,    // 30 minutes
};

// Configuration for each cache category
const cacheConfig = {
  default: { ttl: TTL.DEFAULT },
  teamData: { ttl: TTL.DEFAULT },
  teamMembers: { ttl: TTL.TEAM_MEMBERS },
  permissions: { ttl: TTL.PERMISSIONS },
  analytics: { ttl: TTL.ANALYTICS },
  longTerm: { ttl: TTL.LONG_TERM },
  batchData: { ttl: TTL.ANALYTICS } // Batch data should be fresh
};

export class CacheManager {
  constructor() {
    this.cache = new Map();
    this.expirationTimes = new Map();
    this.pending = new Map();
    
    // ✅ FIX: Initialize statistic counters
    this.hits = 0;
    this.misses = 0;
    this.deduplicated = 0;
  }

  async get(key, requestFn, category = 'default', ttlOverride = null) {
    // 1. Check for pending requests (request deduplication)
    if (this.pending.has(key)) {
      console.log(`🔄 Deduplicating request: ${key}`);
      this.deduplicated++; // ✅ Track deduplication
      return this.pending.get(key);
    }

    // 2. Check cache
    const now = Date.now();
    if (this.cache.has(key) && now < this.expirationTimes.get(key)) {
      console.log(`✅ Cache hit: ${key}`);
      this.hits++; // ✅ Track cache hits
      return Promise.resolve(this.cache.get(key));
    }

    // 3. Cache miss: make the API call
    this.misses++; // ✅ Track cache misses
    console.log(`❌ Cache miss: ${key}`);

    const promise = requestFn()
      .then(data => {
        this.set(key, data, category, ttlOverride);
        this.pending.delete(key);
        return data;
      })
      .catch(error => {
        this.pending.delete(key);
        throw error;
      });

    this.pending.set(key, promise);
    return promise;
  }

  set(key, value, category = 'default', ttlOverride = null) {
    const config = cacheConfig[category] || cacheConfig.default;
    const ttl = ttlOverride || config.ttl;
    const expirationTime = Date.now() + ttl;

    this.cache.set(key, value);
    this.expirationTimes.set(key, expirationTime);
  }

  invalidate(pattern) {
    console.log(`🗑️ Invalidating cache with pattern: ${pattern}`);
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        this.expirationTimes.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
    this.expirationTimes.clear();
    this.pending.clear();
    // ✅ FIX: Reset stats on clear
    this.hits = 0;
    this.misses = 0;
    this.deduplicated = 0;
  }

  // ✅ FIX: Implement the getStats method correctly
  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests === 0 ? 0 : ((this.hits / totalRequests) * 100);

    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pending.size,
      hits: this.hits,
      misses: this.misses,
      deduplicated: this.deduplicated,
      totalRequests: totalRequests,
      hitRate: hitRate.toFixed(2), // Return as a formatted string
    };
  }
}

export const globalCache = new CacheManager();