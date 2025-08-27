// lib/config/costOptimizedEventDetectionConfig.js - Budget-friendly configuration

export const COST_OPTIMIZED_CONFIG = {
    // API COST CONTROLS
    BUDGET_LIMITS: {
        MAX_API_CALLS_PER_SESSION: 10,           // Reduced from 50+
        MAX_COST_PER_SESSION: 0.10,              // $0.10 budget cap
        MAX_LOCATIONS_TO_PROCESS: 5,             // Process only top 5 locations
        EMERGENCY_STOP_ON_QUOTA: true,           // Stop immediately on quota errors
        CACHE_FIRST_STRATEGY: true               // Always check cache before API
    },

    // FIELD OPTIMIZATION FOR COST REDUCTION
    FIELD_MASKS: {
        // MINIMAL: ~$0.004 per request (cheapest)
        MINIMAL: [
            'places.id',
            'places.displayName',
            'places.location',
            'places.types'
        ],
        
        // STANDARD: ~$0.006 per request
        STANDARD: [
            'places.id',
            'places.displayName',
            'places.location',
            'places.types',
            'places.rating',
            'places.businessStatus',
            'places.formattedAddress'
        ],
        
        // ENHANCED: ~$0.010 per request (use sparingly)
        ENHANCED: [
            'places.id',
            'places.displayName',
            'places.location',
            'places.types',
            'places.rating',
            'places.userRatingCount',
            'places.businessStatus',
            'places.formattedAddress',
            'places.priceLevel',
            'places.photos'
        ]
    },

    // AGGRESSIVE LOCATION DEDUPLICATION
    LOCATION_OPTIMIZATION: {
        // More aggressive rounding = better deduplication = fewer API calls
        COORDINATE_PRECISION: 500,               // ~220m precision (vs 1000 = 110m)
        MIN_DISTANCE_BETWEEN_SEARCHES: 300,     // Minimum 300m between API calls
        PRIORITIZE_BY_CONTACT_COUNT: true,      // Process locations with most contacts first
        MAX_UNIQUE_LOCATIONS: 5                 // Hard cap on unique locations to search
    },

    // SEARCH PARAMETER OPTIMIZATION
    SEARCH_LIMITS: {
        MAX_RESULTS_PER_LOCATION: 8,            // Reduced from 20
        MAX_RADIUS_METERS: 1000,                // Smaller radius = fewer results
        MAX_TEXT_SEARCH_QUERIES: 2,             // Reduced from 8
        VENUE_TYPES_LIMIT: 4,                   // Limit venue types to search
        BATCH_SIZE: 1,                          // Process one location at a time
        RATE_LIMIT_DELAY_MS: 200                // Conservative rate limiting
    },

    // COST-EFFECTIVE VENUE TYPES (prioritize high-value types)
    PRIORITY_VENUE_TYPES: [
        'convention_center',     // High value for business contacts
        'university',           // Good for academic/research contacts  
        'stadium',              // Clear event indicator
        'event_venue'           // Generic but reliable
    ],

    // SECONDARY VENUE TYPES (use only if budget allows)
    SECONDARY_VENUE_TYPES: [
        'performing_arts_theater',
        'community_center',
        'museum',
        'art_gallery'
    ],

    // INTELLIGENT CACHING STRATEGY
    CACHE_STRATEGY: {
        MEMORY_CACHE_TTL: 1800,                 // 30 minutes
        PERSISTENT_CACHE_TTL: 14400,            // 4 hours
        AGGRESSIVE_CACHE_KEYS: true,            // Use broader cache keys
        CACHE_NEGATIVE_RESULTS: true,           // Cache "no results" to avoid re-querying
        MAX_CACHE_SIZE: 1000                    // Limit cache memory usage
    },

    // SIMPLE SCORING (no additional API calls)
    VENUE_SCORING: {
        VENUE_TYPE_WEIGHT: 0.6,                 // 60% weight on venue type
        NAME_KEYWORD_WEIGHT: 0.4,               // 40% weight on name keywords
        MINIMUM_SCORE_THRESHOLD: 0.3,           // Lower threshold for cost savings
        HIGH_CONFIDENCE_THRESHOLD: 0.7,         // Conservative high confidence
        SKIP_DETAILED_ANALYSIS: true            // No additional API calls for details
    },

    // COST TRACKING
    COST_ESTIMATION: {
        MINIMAL_FIELD_COST: 0.004,              // Per request with minimal fields
        STANDARD_FIELD_COST: 0.006,             // Per request with standard fields
        ENHANCED_FIELD_COST: 0.010,             // Per request with enhanced fields
        TRACK_SESSION_COSTS: true,              // Monitor costs in real-time
        WARN_AT_PERCENTAGE: 0.8,                // Warn at 80% of budget
        STOP_AT_PERCENTAGE: 1.0                 // Hard stop at 100% of budget
    },

    // FREE OPTIMIZATION METHODS (no API costs)
    FREE_GROUPING_METHODS: {
        COMPANY_GROUPING: {
            ENABLED: true,
            MIN_GROUP_SIZE: 2,
            CONFIDENCE_MAPPING: {
                2: 'low',
                3: 'medium', 
                5: 'high'
            }
        },
        
        TIME_BASED_GROUPING: {
            ENABLED: true,
            TIME_WINDOW_HOURS: 3,
            MIN_GROUP_SIZE: 2,
            MAX_DAYS_BACK: 30
        },
        
        LOCATION_CLUSTERING: {
            ENABLED: true,
            DISTANCE_THRESHOLD_KM: 0.5,         // 500m clusters
            MIN_GROUP_SIZE: 2,
            USE_SIMPLE_CLUSTERING: true         // Avoid complex algorithms
        }
    },

    // QUOTA PROTECTION
    QUOTA_MANAGEMENT: {
        MONITOR_RESPONSE_HEADERS: true,         // Watch for quota warnings
        EXPONENTIAL_BACKOFF: true,              // Back off on errors
        MAX_RETRIES: 1,                         // Reduce retries to save quota
        CIRCUIT_BREAKER_THRESHOLD: 3,          // Stop after 3 consecutive errors
        GRACEFUL_DEGRADATION: true             // Fall back to free methods
    },

    // CITY-SPECIFIC OPTIMIZATIONS (cost-aware)
    CITY_OPTIMIZATIONS: {
        'las vegas': {
            maxRadius: 800,                     // Smaller radius for dense areas
            priorityTypes: ['convention_center'],
            maxLocations: 3,                    // Limit searches in expensive areas
            textQueries: ['CES', 'NAB Show']    // Specific, targeted queries
        },
        'austin': {
            maxRadius: 1000,
            priorityTypes: ['university', 'convention_center'],
            maxLocations: 4,
            textQueries: ['SXSW', 'conference center']
        },
        'san francisco': {
            maxRadius: 600,                     // Very dense, small radius
            priorityTypes: ['convention_center', 'university'],
            maxLocations: 2,                    // Expensive market, limit searches
            textQueries: ['tech conference']
        },
        'new york': {
            maxRadius: 500,                     // Ultra dense
            priorityTypes: ['convention_center'],
            maxLocations: 2,
            textQueries: ['conference center']
        },
        'default': {
            maxRadius: 1000,
            priorityTypes: ['convention_center', 'university'],
            maxLocations: 5,
            textQueries: ['conference center', 'convention hall']
        }
    },

    // PERFORMANCE vs COST TRADE-OFFS
    PERFORMANCE_MODES: {
        BUDGET: {
            description: 'Maximum cost savings, basic functionality',
            maxApiCalls: 5,
            fieldLevel: 'minimal',
            maxLocations: 3,
            cacheAggressive: true,
            skipTextSearch: true
        },
        
        BALANCED: {
            description: 'Good balance of features and cost',
            maxApiCalls: 10,
            fieldLevel: 'standard', 
            maxLocations: 5,
            cacheAggressive: true,
            skipTextSearch: false
        },
        
        PREMIUM: {
            description: 'Full features, higher cost',
            maxApiCalls: 20,
            fieldLevel: 'enhanced',
            maxLocations: 8,
            cacheAggressive: false,
            skipTextSearch: false
        }
    }
};

// COST CALCULATION UTILITIES
export const CostCalculator = {
    estimateSessionCost(options = {}) {
        const {
            contactsWithLocation = 0,
            fieldLevel = 'minimal',
            enableTextSearch = false,
            cacheHitRate = 0.7
        } = options;

        const config = COST_OPTIMIZED_CONFIG;
        const fieldCost = config.COST_ESTIMATION[`${fieldLevel.toUpperCase()}_FIELD_COST`] || 0.006;
        
        // Estimate unique locations after deduplication
        const estimatedUniqueLocations = Math.min(
            Math.ceil(contactsWithLocation / 3), // Assume 3:1 deduplication ratio
            config.BUDGET_LIMITS.MAX_LOCATIONS_TO_PROCESS
        );
        
        // Account for cache hits
        const actualApiCalls = Math.ceil(estimatedUniqueLocations * (1 - cacheHitRate));
        
        let totalCost = actualApiCalls * fieldCost;
        
        // Add text search costs if enabled
        if (enableTextSearch) {
            const textSearchCalls = Math.min(actualApiCalls, config.SEARCH_LIMITS.MAX_TEXT_SEARCH_QUERIES);
            totalCost += textSearchCalls * fieldCost;
        }
        
        return {
            estimatedCost: totalCost.toFixed(4),
            apiCalls: actualApiCalls,
            fieldCost: fieldCost,
            withinBudget: totalCost <= config.BUDGET_LIMITS.MAX_COST_PER_SESSION,
            breakdown: {
                nearbySearchCost: (actualApiCalls * fieldCost).toFixed(4),
                textSearchCost: enableTextSearch ? (Math.min(actualApiCalls, 2) * fieldCost).toFixed(4) : '0.0000',
                cacheSavings: (estimatedUniqueLocations * cacheHitRate * fieldCost).toFixed(4)
            }
        };
    },

    recommendPerformanceMode(contactsCount, budgetLimit = 0.10) {
        const modes = COST_OPTIMIZED_CONFIG.PERFORMANCE_MODES;
        
        if (budgetLimit <= 0.05) {
            return {
                mode: 'BUDGET',
                config: modes.BUDGET,
                reason: 'Low budget requires maximum cost optimization'
            };
        }
        
        if (contactsCount > 100 || budgetLimit <= 0.10) {
            return {
                mode: 'BALANCED', 
                config: modes.BALANCED,
                reason: 'Good balance of features and cost for medium datasets'
            };
        }
        
        return {
            mode: 'PREMIUM',
            config: modes.PREMIUM,
            reason: 'Full features available within budget'
        };
    }
};

// BUDGET MONITORING UTILITIES
export const BudgetMonitor = {
    sessionBudget: 0,
    sessionSpent: 0,
    warningThreshold: 0.8,
    
    initSession(budgetLimit) {
        this.sessionBudget = budgetLimit;
        this.sessionSpent = 0;
        console.log(`💰 Budget monitor initialized: ${budgetLimit} limit`);
    },
    
    addCost(amount, description = '') {
        this.sessionSpent += amount;
        const percentage = this.sessionSpent / this.sessionBudget;
        
        console.log(`💳 Cost added: ${amount.toFixed(4)} - ${description}`);
        console.log(`💰 Session total: ${this.sessionSpent.toFixed(4)} / ${this.sessionBudget} (${(percentage * 100).toFixed(1)}%)`);
        
        if (percentage >= 1.0) {
            console.warn('🚨 BUDGET EXCEEDED - STOPPING ALL API CALLS');
            return { status: 'BUDGET_EXCEEDED', canContinue: false };
        }
        
        if (percentage >= this.warningThreshold) {
            console.warn(`⚠️ Budget warning: ${(percentage * 100).toFixed(1)}% used`);
            return { status: 'BUDGET_WARNING', canContinue: true };
        }
        
        return { status: 'OK', canContinue: true };
    },
    
    getRemainingBudget() {
        return Math.max(0, this.sessionBudget - this.sessionSpent);
    },
    
    canAfford(estimatedCost) {
        return (this.sessionSpent + estimatedCost) <= this.sessionBudget;
    },
    
    getStats() {
        const percentage = this.sessionSpent / this.sessionBudget;
        return {
            budgetLimit: this.sessionBudget,
            amountSpent: this.sessionSpent.toFixed(4),
            percentageUsed: (percentage * 100).toFixed(1),
            remaining: this.getRemainingBudget().toFixed(4),
            status: percentage >= 1.0 ? 'EXCEEDED' : 
                   percentage >= this.warningThreshold ? 'WARNING' : 'OK'
        };
    }
};

// CACHING UTILITIES FOR COST OPTIMIZATION
export const CostOptimizedCache = {
    memoryCache: new Map(),
    maxCacheSize: 1000,
    defaultTTL: 1800000, // 30 minutes
    
    generateAggressiveKey(lat, lng, radius, types) {
        // More aggressive rounding for better cache hits
        const roundedLat = Math.round(lat * 100) / 100;  // ~1km precision
        const roundedLng = Math.round(lng * 100) / 100;
        const roundedRadius = Math.ceil(radius / 500) * 500; // Round to 500m increments
        const sortedTypes = types.slice(0, 2).sort().join(','); // Limit to 2 main types
        
        return `${roundedLat}_${roundedLng}_${roundedRadius}_${sortedTypes}`;
    },
    
    get(key) {
        const cached = this.memoryCache.get(key);
        if (!cached) return null;
        
        if (Date.now() > cached.expiry) {
            this.memoryCache.delete(key);
            return null;
        }
        
        console.log(`🎯 Cache HIT: ${key} (saved ~$0.006)`);
        return cached.data;
    },
    
    set(key, data, ttl = this.defaultTTL) {
        // Implement LRU eviction if cache is full
        if (this.memoryCache.size >= this.maxCacheSize) {
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
        }
        
        this.memoryCache.set(key, {
            data: data,
            expiry: Date.now() + ttl,
            createdAt: Date.now()
        });
        
        console.log(`💾 Cache SET: ${key}`);
    },
    
    getCacheStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;
        
        this.memoryCache.forEach((value) => {
            if (now > value.expiry) {
                expiredEntries++;
            } else {
                validEntries++;
            }
        });
        
        return {
            totalEntries: this.memoryCache.size,
            validEntries,
            expiredEntries,
            hitRate: '(tracked elsewhere)',
            estimatedSavings: `${(validEntries * 0.006).toFixed(4)}`
        };
    },
    
    clear() {
        this.memoryCache.clear();
        console.log('🧹 Cache cleared');
    }
};

// EXPORT DEFAULT CONFIG FUNCTION
export const getCostOptimizedConfig = (mode = 'BALANCED') => {
    const baseConfig = COST_OPTIMIZED_CONFIG;
    const modeConfig = baseConfig.PERFORMANCE_MODES[mode] || baseConfig.PERFORMANCE_MODES.BALANCED;
    
    return {
        ...baseConfig,
        ACTIVE_MODE: mode,
        CURRENT_LIMITS: {
            maxApiCalls: modeConfig.maxApiCalls,
            fieldLevel: modeConfig.fieldLevel,
            maxLocations: modeConfig.maxLocations,
            cacheAggressive: modeConfig.cacheAggressive,
            skipTextSearch: modeConfig.skipTextSearch
        }
    };
};

// HELPER FUNCTIONS FOR COST OPTIMIZATION
export const CostOptimizers = {
    // Reduce location list to most valuable ones
    prioritizeLocations(locations, maxCount = 5) {
        return locations
            .sort((a, b) => (b.contacts?.length || 0) - (a.contacts?.length || 0))
            .slice(0, maxCount);
    },
    
    // Choose minimal venue types for cost savings
    selectCostEffectiveVenueTypes(allTypes, maxTypes = 3) {
        const priority = COST_OPTIMIZED_CONFIG.PRIORITY_VENUE_TYPES;
        return allTypes.filter(type => priority.includes(type)).slice(0, maxTypes);
    },
    
    // Generate minimal, targeted search queries
    generateBudgetQueries(city, maxQueries = 2) {
        const cityConfig = COST_OPTIMIZED_CONFIG.CITY_OPTIMIZATIONS[city?.toLowerCase()] ||
                          COST_OPTIMIZED_CONFIG.CITY_OPTIMIZATIONS.default;
        
        return cityConfig.textQueries.slice(0, maxQueries);
    },
    
    // Calculate if operation is within budget
    checkBudgetCompliance(estimatedCost, remainingBudget) {
        return {
            canProceed: estimatedCost <= remainingBudget,
            willExceed: estimatedCost > remainingBudget,
            percentageOfBudget: (estimatedCost / remainingBudget * 100).toFixed(1),
            recommendation: estimatedCost <= remainingBudget * 0.5 ? 'SAFE' :
                           estimatedCost <= remainingBudget ? 'CAUTION' : 'STOP'
        };
    }
};