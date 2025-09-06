
// lib/services/serviceContact/client/core/contactCacheManager.js
// Contact cache manager following enterprise pattern

"use client"

const TTL = {
  DEFAULT: 5 * 60 * 1000,       // 5 minutes
  CONTACTS: 2 * 60 * 1000,      // 2 minutes
  GROUPS: 5 * 60 * 1000,        // 5 minutes
  ANALYTICS: 30 * 1000,         // 30 seconds
  SUBSCRIPTION: 10 * 60 * 1000, // 10 minutes
  LONG_TERM: 30 * 60 * 1000,    // 30 minutes
};

const cacheConfig = {
  default: { ttl: TTL.DEFAULT },
  contacts: { ttl: TTL.CONTACTS },
  groups: { ttl: TTL.GROUPS },
  analytics: { ttl: TTL.ANALYTICS },
  subscription: { ttl: TTL.SUBSCRIPTION },
  longTerm: { ttl: TTL.LONG_TERM }
};

export class ContactCacheManager {
  constructor() {
    this.cache = new Map();
    this.expirationTimes = new Map();
    this.pending = new Map();
    
    this.hits = 0;
    this.misses = 0;
    this.deduplicated = 0;
  }

  async get(key, requestFn, category = 'default', ttlOverride = null) {
    // Check for pending requests (request deduplication)
    if (this.pending.has(key)) {
      console.log(`🔄 Deduplicating contact request: ${key}`);
      this.deduplicated++;
      return this.pending.get(key);
    }

    // Check cache
    const now = Date.now();
    if (this.cache.has(key) && now < this.expirationTimes.get(key)) {
      console.log(`✅ Contact cache hit: ${key}`);
      this.hits++;
      return Promise.resolve(this.cache.get(key));
    }

    // Cache miss: make the API call
    this.misses++;
    console.log(`❌ Contact cache miss: ${key}`);

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
    console.log(`🗑️ Invalidating contact cache with pattern: ${pattern}`);
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
    this.hits = 0;
    this.misses = 0;
    this.deduplicated = 0;
  }

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
      hitRate: hitRate.toFixed(2),
    };
  }
}

export const contactCache = new ContactCacheManager();
