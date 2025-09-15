// lib/services/client/core/genericCacheManager.js
"use client";

/**
 * A simple, generic in-memory cache manager for client-side services.
 * Each instance of this class manages its own separate cache.
 */
export class GenericCacheManager {
    constructor(cacheName = 'generic') {
        this.cacheName = cacheName;
        // Use a Map for better performance on frequent additions/deletions.
        this.cache = new Map();
        this.expirationTimes = new Map();
        
        // In development, attach to window for persistence across hot reloads.
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            const devCacheKey = `__dev_cache_${cacheName}`;
            if (!window[devCacheKey]) {
                window[devCacheKey] = {
                    cache: new Map(),
                    expirationTimes: new Map(),
                };
            }
            this.cache = window[devCacheKey].cache;
            this.expirationTimes = window[devCacheKey].expirationTimes;
        }
    }

    set(key, value, durationMs = 5 * 60 * 1000) { // Default 5 minutes
        console.log(`[Cache - ${this.cacheName}] SET: key=${key}, duration=${durationMs}ms`);
        this.cache.set(key, value);
        this.expirationTimes.set(key, Date.now() + durationMs);
    }

    get(key) {
        const now = Date.now();
        const expiry = this.expirationTimes.get(key);

        if (expiry && now < expiry) {
            console.log(`[Cache - ${this.cacheName}] HIT: key=${key}`);
            return this.cache.get(key);
        }

        // If expired, delete the stale data.
        if (expiry) {
            console.log(`[Cache - ${this.cacheName}] EXPIRED: key=${key}`);
            this.cache.delete(key);
            this.expirationTimes.delete(key);
        } else {
            console.log(`[Cache - ${this.cacheName}] MISS: key=${key}`);
        }
        
        return null;
    }

    invalidate(prefix) {
        console.log(`[Cache - ${this.cacheName}] INVALIDATE: prefix=${prefix}`);
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                this.expirationTimes.delete(key);
            }
        }
    }

    clear() {
        console.log(`[Cache - ${this.cacheName}] CLEAR: All entries removed.`);
        this.cache.clear();
        this.expirationTimes.clear();
    }
}