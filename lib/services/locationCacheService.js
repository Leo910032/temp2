// lib/services/locationCacheService.js - Persistent caching for locations and events

export class LocationCacheService {
    constructor() {
        this.memoryCache = new Map();
        this.persistentCachePrefix = 'loc_cache_';
        this.eventCachePrefix = 'event_cache_';
        this.groupCachePrefix = 'group_cache_';
        
        // Cache configuration
        this.cacheConfig = {
            // Short-term cache (memory)
            memoryTTL: 10 * 60 * 1000,        // 10 minutes
            // Medium-term cache (localStorage)
            localStorageTTL: 60 * 60 * 1000,  // 1 hour
            // Long-term cache (for events)
            eventTTL: 4 * 60 * 60 * 1000,     // 4 hours
            // Group suggestions cache
            groupTTL: 30 * 60 * 1000,         // 30 minutes
            
            // Cache size limits
            maxMemoryEntries: 100,
            maxLocalStorageEntries: 500,
            
            // Cleanup intervals
            cleanupInterval: 5 * 60 * 1000    // 5 minutes
        };
        
        // Performance tracking
        this.stats = {
            memoryHits: 0,
            memoryMisses: 0,
            localStorageHits: 0,
            localStorageMisses: 0,
            cacheWrites: 0,
            cacheCleanups: 0
        };
        
        // Start periodic cleanup
        this.startCleanupTimer();
    }

    // Generate consistent cache keys
    generateLocationKey(latitude, longitude, radius, eventTypes = []) {
        const roundedLat = Math.round(latitude * 1000) / 1000;
        const roundedLng = Math.round(longitude * 1000) / 1000;
        const sortedTypes = [...eventTypes].sort().join(',');
        return `${this.persistentCachePrefix}${roundedLat}_${roundedLng}_${radius}_${sortedTypes}`;
    }

    generateEventKey(eventId, date = null) {
        const dateStr = date || new Date().toDateString();
        return `${this.eventCachePrefix}${eventId}_${dateStr}`;
    }

    generateGroupKey(contactIds, eventIds = []) {
        const sortedContactIds = [...contactIds].sort().join(',');
        const sortedEventIds = [...eventIds].sort().join(',');
        return `${this.groupCachePrefix}${sortedContactIds}_${sortedEventIds}`;
    }

    // Multi-tier cache get (memory -> localStorage -> null)
    async get(key, type = 'location') {
        // Try memory cache first
        if (this.memoryCache.has(key)) {
            const entry = this.memoryCache.get(key);
            if (this.isValidEntry(entry, this.cacheConfig.memoryTTL)) {
                this.stats.memoryHits++;
                console.log(`💾 Memory cache HIT for key: ${key.substring(0, 50)}...`);
                return entry.data;
            } else {
                this.memoryCache.delete(key);
            }
        }
        this.stats.memoryMisses++;

        // Try localStorage cache
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                const entry = JSON.parse(stored);
                const ttl = this.getTTLForType(type);
                
                if (this.isValidEntry(entry, ttl)) {
                    this.stats.localStorageHits++;
                    console.log(`💿 LocalStorage cache HIT for key: ${key.substring(0, 50)}...`);
                    
                    // Promote to memory cache
                    this.setMemoryCache(key, entry.data);
                    return entry.data;
                } else {
                    localStorage.removeItem(key);
                }
            }
        } catch (error) {
            console.warn('LocalStorage read error:', error);
        }
        
        this.stats.localStorageMisses++;
        console.log(`❌ Cache MISS for key local: ${key.substring(0, 50)}...`);
        return null;
    }

    // Multi-tier cache set
    async set(key, data, type = 'location') {
        const entry = {
            data: data,
            timestamp: Date.now(),
            type: type,
            size: this.estimateSize(data)
        };

        // Set in memory cache
        this.setMemoryCache(key, data);

        // Set in localStorage
        try {
            localStorage.setItem(key, JSON.stringify(entry));
            this.stats.cacheWrites++;
            console.log(`💾 Data cached with key: ${key.substring(0, 50)}... (size: ${entry.size} bytes)`);
        } catch (error) {
            console.warn('LocalStorage write error:', error);
            // If localStorage is full, try to clean up
            this.cleanupLocalStorage();
            try {
                localStorage.setItem(key, JSON.stringify(entry));
            } catch (retryError) {
                console.error('Failed to cache data even after cleanup:', retryError);
            }
        }
    }

    // Set memory cache with size management
    setMemoryCache(key, data) {
        // Remove oldest entries if cache is full
        if (this.memoryCache.size >= this.cacheConfig.maxMemoryEntries) {
            const oldestKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(oldestKey);
        }

        this.memoryCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    // Get appropriate TTL for cache type
    getTTLForType(type) {
        switch (type) {
            case 'event':
                return this.cacheConfig.eventTTL;
            case 'group':
                return this.cacheConfig.groupTTL;
            case 'location':
            default:
                return this.cacheConfig.localStorageTTL;
        }
    }

    // Check if cache entry is still valid
    isValidEntry(entry, ttl) {
        return entry && entry.timestamp && (Date.now() - entry.timestamp) < ttl;
    }

    // Estimate data size for cache management
    estimateSize(data) {
        return JSON.stringify(data).length * 2; // Rough estimate in bytes
    }

    // Location-specific caching methods
    async getLocationEvents(latitude, longitude, radius, eventTypes = []) {
        const key = this.generateLocationKey(latitude, longitude, radius, eventTypes);
        return this.get(key, 'location');
    }

    async setLocationEvents(latitude, longitude, radius, eventTypes, events) {
        const key = this.generateLocationKey(latitude, longitude, radius, eventTypes);
        return this.set(key, events, 'event');
    }

    // Event-specific caching methods
    async getEventDetails(eventId) {
        const key = this.generateEventKey(eventId);
        return this.get(key, 'event');
    }

    async setEventDetails(eventId, eventData) {
        const key = this.generateEventKey(eventId);
        return this.set(key, eventData, 'event');
    }

    // Group suggestions caching
    async getGroupSuggestions(contactIds, eventIds = []) {
        const key = this.generateGroupKey(contactIds, eventIds);
        return this.get(key, 'group');
    }

    async setGroupSuggestions(contactIds, eventIds, suggestions) {
        const key = this.generateGroupKey(contactIds, eventIds);
        return this.set(key, suggestions, 'group');
    }

    // Batch location processing with intelligent caching
    async batchGetLocationEvents(locations, radius, eventTypes = []) {
        const results = [];
        const cacheMisses = [];
        
        console.log(`🔍 Batch processing ${locations.length} locations for cached events`);
        
        // Check cache for each location
        for (let i = 0; i < locations.length; i++) {
            const location = locations[i];
            const cachedEvents = await this.getLocationEvents(
                location.latitude, 
                location.longitude, 
                radius, 
                eventTypes
            );
            
            if (cachedEvents) {
                results[i] = {
                    location: location,
                    events: cachedEvents,
                    fromCache: true
                };
            } else {
                results[i] = {
                    location: location,
                    events: null,
                    fromCache: false
                };
                cacheMisses.push({ index: i, location: location });
            }
        }
        
        const cacheHitRate = ((locations.length - cacheMisses.length) / locations.length * 100).toFixed(1);
        console.log(`📊 Batch cache performance: ${cacheHitRate}% hit rate (${cacheMisses.length} misses)`);
        
        return {
            results: results,
            cacheMisses: cacheMisses,
            cacheHitRate: parseFloat(cacheHitRate)
        };
    }

    // Intelligent cache warming for predictive loading
    async warmCache(locations, eventTypes = []) {
        console.log(`🔥 Warming cache for ${locations.length} locations`);
        
        const radiusOptions = [500, 1000, 2000]; // Common radius values
        const warmingPromises = [];
        
        locations.forEach(location => {
            radiusOptions.forEach(radius => {
                // Check if we already have this cached
                const key = this.generateLocationKey(
                    location.latitude, 
                    location.longitude, 
                    radius, 
                    eventTypes
                );
                
                if (!this.memoryCache.has(key)) {
                    // Add to warming queue (would trigger background API calls)
                    warmingPromises.push({
                        location: location,
                        radius: radius,
                        eventTypes: eventTypes,
                        priority: this.calculateWarmingPriority(location)
                    });
                }
            });
        });
        
        // Sort by priority and return high-priority items for immediate warming
        warmingPromises.sort((a, b) => b.priority - a.priority);
        
        console.log(`🎯 Identified ${warmingPromises.length} cache warming opportunities`);
        return warmingPromises.slice(0, 10); // Limit to top 10 priorities
    }

    // Calculate priority for cache warming
    calculateWarmingPriority(location) {
        let priority = 1;
        
        // Higher priority for locations with more contacts
        if (location.contactIds && location.contactIds.length > 0) {
            priority += location.contactIds.length * 2;
        }
        
        // Higher priority for recent locations
        if (location.metadata && location.metadata.timestamp) {
            const age = Date.now() - location.metadata.timestamp;
            const daysDiff = age / (1000 * 60 * 60 * 24);
            if (daysDiff < 1) priority += 10; // Very recent
            else if (daysDiff < 7) priority += 5; // Recent
        }
        
        // Higher priority for business/conference areas (simple heuristic)
        if (location.metadata && location.metadata.context) {
            if (location.metadata.context.includes('business') || 
                location.metadata.context.includes('conference')) {
                priority += 5;
            }
        }
        
        return priority;
    }

    // Cleanup methods
    cleanupMemoryCache() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, entry] of this.memoryCache.entries()) {
            if (!this.isValidEntry(entry, this.cacheConfig.memoryTTL)) {
                this.memoryCache.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned ${cleanedCount} expired entries from memory cache`);
        }
        
        return cleanedCount;
    }

    cleanupLocalStorage() {
        let cleanedCount = 0;
        const keysToRemove = [];
        
        try {
            // Find expired entries
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith(this.persistentCachePrefix) || 
                           key.startsWith(this.eventCachePrefix) || 
                           key.startsWith(this.groupCachePrefix))) {
                    
                    try {
                        const entry = JSON.parse(localStorage.getItem(key));
                        const ttl = this.getTTLForType(entry.type || 'location');
                        
                        if (!this.isValidEntry(entry, ttl)) {
                            keysToRemove.push(key);
                        }
                    } catch (parseError) {
                        // Invalid JSON, remove it
                        keysToRemove.push(key);
                    }
                }
            }
            
            // Remove expired entries
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                cleanedCount++;
            });
            
            // If still too many entries, remove oldest ones
            const remainingCacheKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith(this.persistentCachePrefix) || 
                           key.startsWith(this.eventCachePrefix) || 
                           key.startsWith(this.groupCachePrefix))) {
                    remainingCacheKeys.push(key);
                }
            }
            
            if (remainingCacheKeys.length > this.cacheConfig.maxLocalStorageEntries) {
                const entriesToRemove = remainingCacheKeys.length - this.cacheConfig.maxLocalStorageEntries;
                
                // Sort by timestamp and remove oldest
                const entriesWithTimestamp = remainingCacheKeys.map(key => {
                    try {
                        const entry = JSON.parse(localStorage.getItem(key));
                        return { key, timestamp: entry.timestamp || 0 };
                    } catch {
                        return { key, timestamp: 0 };
                    }
                }).sort((a, b) => a.timestamp - b.timestamp);
                
                for (let i = 0; i < entriesToRemove; i++) {
                    localStorage.removeItem(entriesWithTimestamp[i].key);
                    cleanedCount++;
                }
            }
            
        } catch (error) {
            console.error('Error during localStorage cleanup:', error);
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned ${cleanedCount} entries from localStorage cache`);
            this.stats.cacheCleanups++;
        }
        
        return cleanedCount;
    }

    // Start periodic cleanup timer
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupMemoryCache();
            this.cleanupLocalStorage();
        }, this.cacheConfig.cleanupInterval);
        
        console.log(`⏰ Cache cleanup timer started (interval: ${this.cacheConfig.cleanupInterval}ms)`);
    }

    // Clear all caches
    clearAll() {
        // Clear memory cache
        this.memoryCache.clear();
        
        // Clear localStorage cache
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith(this.persistentCachePrefix) || 
                           key.startsWith(this.eventCachePrefix) || 
                           key.startsWith(this.groupCachePrefix))) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
            console.log(`🗑️ Cleared all caches (${keysToRemove.length} localStorage entries)`);
        } catch (error) {
            console.error('Error clearing localStorage cache:', error);
        }
        
        // Reset stats
        this.stats = {
            memoryHits: 0,
            memoryMisses: 0,
            localStorageHits: 0,
            localStorageMisses: 0,
            cacheWrites: 0,
            cacheCleanups: 0
        };
    }

    // Get cache statistics
    getStats() {
        const memoryTotal = this.stats.memoryHits + this.stats.memoryMisses;
        const localStorageTotal = this.stats.localStorageHits + this.stats.localStorageMisses;
        const overallTotal = memoryTotal + localStorageTotal;
        
        return {
            memory: {
                hits: this.stats.memoryHits,
                misses: this.stats.memoryMisses,
                hitRate: memoryTotal > 0 ? ((this.stats.memoryHits / memoryTotal) * 100).toFixed(1) : '0.0',
                size: this.memoryCache.size,
                maxSize: this.cacheConfig.maxMemoryEntries
            },
            localStorage: {
                hits: this.stats.localStorageHits,
                misses: this.stats.localStorageMisses,
                hitRate: localStorageTotal > 0 ? ((this.stats.localStorageHits / localStorageTotal) * 100).toFixed(1) : '0.0'
            },
            overall: {
                totalHits: this.stats.memoryHits + this.stats.localStorageHits,
                totalMisses: this.stats.memoryMisses + this.stats.localStorageMisses,
                overallHitRate: overallTotal > 0 ? (((this.stats.memoryHits + this.stats.localStorageHits) / overallTotal) * 100).toFixed(1) : '0.0',
                cacheWrites: this.stats.cacheWrites,
                cacheCleanups: this.stats.cacheCleanups
            }
        };
    }

    // Export cache data for debugging
    exportCacheData() {
        const data = {
            memoryCache: {},
            localStorageCache: {},
            stats: this.stats,
            config: this.cacheConfig
        };
        
        // Export memory cache
        for (const [key, value] of this.memoryCache.entries()) {
            data.memoryCache[key] = value;
        }
        
        // Export localStorage cache
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith(this.persistentCachePrefix) || 
                           key.startsWith(this.eventCachePrefix) || 
                           key.startsWith(this.groupCachePrefix))) {
                    data.localStorageCache[key] = JSON.parse(localStorage.getItem(key));
                }
            }
        } catch (error) {
            console.error('Error exporting localStorage cache:', error);
        }
        
        return data;
    }
}

// Export singleton instance
export const locationCacheService = new LocationCacheService();