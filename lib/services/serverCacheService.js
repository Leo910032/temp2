// lib/services/serverCacheService.js - Server-side cache using memory only

export class ServerCacheService {
    constructor() {
        this.memoryCache = new Map();
        this.persistentCachePrefix = 'loc_cache_';
        this.eventCachePrefix = 'event_cache_';
        this.groupCachePrefix = 'group_cache_';
        
        // Cache configuration for server-side
        this.cacheConfig = {
            // Memory cache only (no localStorage on server)
            memoryTTL: 30 * 60 * 1000,        // 30 minutes
            eventTTL: 4 * 60 * 60 * 1000,     // 4 hours for events
            groupTTL: 30 * 60 * 1000,         // 30 minutes for groups
            
            // Memory cache size limits
            maxMemoryEntries: 500,            // Increased for server
            
            // Cleanup intervals
            cleanupInterval: 10 * 60 * 1000   // 10 minutes
        };
        
        // Performance tracking
        this.stats = {
            memoryHits: 0,
            memoryMisses: 0,
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

    // Memory-only cache get
    async get(key, type = 'location') {
        // Try memory cache
        if (this.memoryCache.has(key)) {
            const entry = this.memoryCache.get(key);
            if (this.isValidEntry(entry, this.getTTLForType(type))) {
                this.stats.memoryHits++;
                console.log(`💾 Memory cache HIT for key: ${key.substring(0, 50)}...`);
                return entry.data;
            } else {
                this.memoryCache.delete(key);
            }
        }
        
        this.stats.memoryMisses++;
        console.log(`❌ Cache MISS for key server : ${key.substring(0, 50)}...`);
        return null;
    }

    // Memory-only cache set
    async set(key, data, type = 'location') {
        const entry = {
            data: data,
            timestamp: Date.now(),
            type: type,
            size: this.estimateSize(data)
        };

        // Set in memory cache with size management
        this.setMemoryCache(key, data, entry);
        this.stats.cacheWrites++;
        
        console.log(`💾 Data cached in memory with key: ${key.substring(0, 50)}... (size: ${entry.size} bytes)`);
    }

    // Set memory cache with size management
    setMemoryCache(key, data, entry) {
        // Remove oldest entries if cache is full
        while (this.memoryCache.size >= this.cacheConfig.maxMemoryEntries) {
            const oldestKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(oldestKey);
        }

        this.memoryCache.set(key, {
            data: data,
            timestamp: Date.now(),
            type: entry.type,
            size: entry.size
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
                return this.cacheConfig.memoryTTL;
        }
    }

    // Check if cache entry is still valid
    isValidEntry(entry, ttl) {
        return entry && entry.timestamp && (Date.now() - entry.timestamp) < ttl;
    }

    // Estimate data size for cache management
    estimateSize(data) {
        try {
            return JSON.stringify(data).length * 2; // Rough estimate in bytes
        } catch (error) {
            return 1000; // Default size if estimation fails
        }
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

    // Cleanup methods
    cleanupMemoryCache() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, entry] of this.memoryCache.entries()) {
            const ttl = this.getTTLForType(entry.type || 'location');
            if (!this.isValidEntry(entry, ttl)) {
                this.memoryCache.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned ${cleanedCount} expired entries from memory cache`);
        }
        
        this.stats.cacheCleanups++;
        return cleanedCount;
    }

    // Start periodic cleanup timer
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupMemoryCache();
        }, this.cacheConfig.cleanupInterval);
        
        console.log(`⏰ Server cache cleanup timer started (interval: ${this.cacheConfig.cleanupInterval}ms)`);
    }

    // Clear all caches
    clearAll() {
        this.memoryCache.clear();
        
        // Reset stats
        this.stats = {
            memoryHits: 0,
            memoryMisses: 0,
            cacheWrites: 0,
            cacheCleanups: 0
        };
        
        console.log(`🗑️ Cleared all server memory caches`);
    }

    // Get cache statistics
    getStats() {
        const memoryTotal = this.stats.memoryHits + this.stats.memoryMisses;
        
        return {
            memory: {
                hits: this.stats.memoryHits,
                misses: this.stats.memoryMisses,
                hitRate: memoryTotal > 0 ? ((this.stats.memoryHits / memoryTotal) * 100).toFixed(1) : '0.0',
                size: this.memoryCache.size,
                maxSize: this.cacheConfig.maxMemoryEntries
            },
            overall: {
                totalHits: this.stats.memoryHits,
                totalMisses: this.stats.memoryMisses,
                overallHitRate: memoryTotal > 0 ? ((this.stats.memoryHits / memoryTotal) * 100).toFixed(1) : '0.0',
                cacheWrites: this.stats.cacheWrites,
                cacheCleanups: this.stats.cacheCleanups
            },
            serverInfo: {
                memoryOnly: true,
                localStorageAvailable: false,
                environment: 'server-side'
            }
        };
    }

    // Export cache data for debugging
    exportCacheData() {
        const data = {
            memoryCache: {},
            stats: this.stats,
            config: this.cacheConfig,
            environment: 'server-side'
        };
        
        // Export memory cache
        for (const [key, value] of this.memoryCache.entries()) {
            data.memoryCache[key] = {
                ...value,
                dataSize: this.estimateSize(value.data)
            };
        }
        
        return data;
    }

    // Cache warming for predictive loading (server-specific)
    async warmCacheForLocations(locations, eventTypes = []) {
        console.log(`🔥 Warming server cache for ${locations.length} locations`);
        
        const radiusOptions = [500, 1000, 2000]; // Common radius values
        const warmingTargets = [];
        
        locations.forEach(location => {
            radiusOptions.forEach(radius => {
                const key = this.generateLocationKey(
                    location.latitude, 
                    location.longitude, 
                    radius, 
                    eventTypes
                );
                
                if (!this.memoryCache.has(key)) {
                    warmingTargets.push({
                        location: location,
                        radius: radius,
                        eventTypes: eventTypes,
                        priority: this.calculateWarmingPriority(location),
                        cacheKey: key
                    });
                }
            });
        });
        
        // Sort by priority and return high-priority items for immediate warming
        warmingTargets.sort((a, b) => b.priority - a.priority);
        
        console.log(`🎯 Identified ${warmingTargets.length} server cache warming opportunities`);
        return warmingTargets.slice(0, 20); // Limit to top 20 priorities for server
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
        
        // Higher priority for business/conference areas
        if (location.metadata && location.metadata.context) {
            if (location.metadata.context.includes('business') || 
                location.metadata.context.includes('conference')) {
                priority += 5;
            }
        }
        
        return priority;
    }

    // Server-specific performance monitoring
    getPerformanceMetrics() {
        const memoryUsageBytes = this.memoryCache.size * 1000; // Rough estimate
        const memoryUsageMB = (memoryUsageBytes / 1024 / 1024).toFixed(2);
        
        return {
            cacheSize: this.memoryCache.size,
            memoryUsageMB: memoryUsageMB,
            hitRate: this.getStats().overall.overallHitRate,
            totalOperations: this.stats.memoryHits + this.stats.memoryMisses,
            efficiency: {
                hitsPerSecond: this.stats.memoryHits / (Date.now() / 1000),
                writesPerSecond: this.stats.cacheWrites / (Date.now() / 1000)
            },
            environment: 'server-side-memory-only'
        };
    }
}

// Export singleton instance for server-side use
export const serverCacheService = new ServerCacheService();