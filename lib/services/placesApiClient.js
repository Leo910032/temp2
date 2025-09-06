// lib/services/placesApiClient.js - COST-OPTIMIZED Google Places API Client

export class OptimizedPlacesApiClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        // IMPORTANT: Using standard Places API (New) endpoint, NOT Enterprise
        this.baseUrl = 'https://places.googleapis.com/v1/places';
        this.requestCount = 0;
        this.rateLimitDelay = 150; // Slightly higher delay to be safe
        this.retryAttempts = 2; // Reduced retry attempts to save costs
        
        // COST OPTIMIZATION: Minimal field mask to reduce per-request cost
        this.minimalFieldMask = [
            'places.id',
            'places.displayName',
            'places.location',
            'places.types'
        ].join(',');
        
        // Standard field mask for when we need more data
        this.standardFieldMask = [
            'places.id',
            'places.displayName', 
            'places.location',
            'places.types',
            'places.rating',
            'places.businessStatus',
            'places.formattedAddress'
        ].join(',');
        
        // Enhanced field mask only when absolutely necessary
        this.enhancedFieldMask = [
            'places.id',
            'places.displayName', 
            'places.location',
            'places.types',
            'places.rating',
            'places.userRatingCount',
            'places.businessStatus',
            'places.formattedAddress',
            'places.priceLevel'
        ].join(',');
    }

    // COST OPTIMIZATION: Rate limiting with exponential backoff
    async rateLimitedRequest(requestFn) {
        const delay = this.rateLimitDelay + (this.requestCount * 25); // More conservative scaling
        await new Promise(resolve => setTimeout(resolve, delay));
        this.requestCount++;
        return requestFn();
    }

    // COST OPTIMIZATION: Reduced retry attempts
    async withRetry(requestFn, attempts = this.retryAttempts) {
        for (let i = 0; i < attempts; i++) {
            try {
                return await this.rateLimitedRequest(requestFn);
            } catch (error) {
                if (i === attempts - 1) throw error;
                
                // Longer backoff to avoid quota issues
                const retryDelay = Math.pow(2, i) * 2000; // 2s, 4s instead of 1s, 2s
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                
                console.warn(`API request attempt ${i + 1} failed, retrying...`, error.message);
            }
        }
    }

    // OPTIMIZED: Standard Nearby Search (NON-Enterprise)
    async searchNearby(location, options = {}) {
        const {
            radius = 1000,
            includedTypes = [],
            maxResults = 10, // REDUCED default from 20 to 10
            rankPreference = 'POPULARITY',
            fieldLevel = 'minimal' // NEW: Control field complexity
        } = options;

        // COST OPTIMIZATION: Choose appropriate field mask
        let fieldMask;
        switch (fieldLevel) {
            case 'minimal':
                fieldMask = this.minimalFieldMask;
                break;
            case 'enhanced':
                fieldMask = this.enhancedFieldMask;
                break;
            default:
                fieldMask = this.standardFieldMask;
        }

        const requestBody = {
            locationRestriction: {
                circle: {
                    center: {
                        latitude: location.latitude,
                        longitude: location.longitude
                    },
                    radius: Math.min(radius, 2000) // Cap radius to control costs
                }
            },
            maxResultCount: Math.min(maxResults, 15), // Hard cap to control costs
            rankPreference: rankPreference
        };

        // Only add includedTypes if provided and reasonable
        if (includedTypes.length > 0 && includedTypes.length <= 5) {
            requestBody.includedTypes = includedTypes;
        }

        const requestFn = async () => {
            console.log(`🔍 [COST-OPTIMIZED] Nearby search with ${fieldLevel} fields, max ${maxResults} results`);
            
            const response = await fetch(`${this.baseUrl}:searchNearby`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': fieldMask // CRITICAL: This reduces cost significantly
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                // Handle quota exceeded specifically
                if (response.status === 429) {
                    throw new Error(`API quota exceeded: ${errorData.error?.message || 'Rate limit hit'}`);
                }
                
                throw new Error(`Places API searchNearby failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();
            console.log(`✅ [COST-OPTIMIZED] Found ${result.places?.length || 0} places (cost-optimized request)`);
            
            return result;
        };

        return this.withRetry(requestFn);
    }

    // OPTIMIZED: Text Search with cost controls
    async searchText(query, location, options = {}) {
        const {
            radius = 1500,
            maxResults = 8, // REDUCED from 10
            fieldLevel = 'minimal'
        } = options;

        // COST OPTIMIZATION: Choose field mask
        const fieldMask = fieldLevel === 'enhanced' ? this.enhancedFieldMask : 
                          fieldLevel === 'standard' ? this.standardFieldMask : 
                          this.minimalFieldMask;

        const requestBody = {
            textQuery: query,
            maxResultCount: Math.min(maxResults, 10), // Hard cap
            locationBias: {
                circle: {
                    center: {
                        latitude: location.latitude,
                        longitude: location.longitude
                    },
                    radius: Math.min(radius, 2500) // Cap radius
                }
            }
        };

        const requestFn = async () => {
            console.log(`🔍 [COST-OPTIMIZED] Text search: "${query}" with ${fieldLevel} fields`);
            
            const response = await fetch(`${this.baseUrl}:searchText`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': fieldMask
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 429) {
                    throw new Error(`API quota exceeded: ${errorData.error?.message || 'Rate limit hit'}`);
                }
                throw new Error(`Places API searchText failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();
            console.log(`✅ [COST-OPTIMIZED] Text search found ${result.places?.length || 0} places`);
            
            return result;
        };

        return this.withRetry(requestFn);
    }

    // COST OPTIMIZATION: Intelligent batching with cost controls
    async batchSearchNearby(locations, options = {}) {
        const {
            maxBatchSize = 3, // REDUCED from 5
            fieldLevel = 'minimal',
            ...searchOptions
        } = options;

        const results = [];
        const errors = [];
        let totalCost = 0;

        // Process in smaller batches to control costs
        const batches = [];
        for (let i = 0; i < locations.length; i += maxBatchSize) {
            batches.push(locations.slice(i, i + maxBatchSize));
        }

        console.log(`💰 [COST-CONTROL] Processing ${locations.length} locations in ${batches.length} batches (max ${maxBatchSize} per batch)`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            
            console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} locations)`);

            for (let i = 0; i < batch.length; i++) {
                const location = batch[i];
                
                try {
                    const data = await this.searchNearby(location, {
                        ...searchOptions,
                        fieldLevel: fieldLevel
                    });
                    
                    results.push({
                        location,
                        data,
                        success: true,
                        index: batchIndex * maxBatchSize + i,
                        estimatedCost: this.estimateRequestCost(fieldLevel, data.places?.length || 0)
                    });
                    
                    totalCost += this.estimateRequestCost(fieldLevel, data.places?.length || 0);
                    
                } catch (error) {
                    console.error(`❌ Error in batch ${batchIndex + 1}, location ${i + 1}:`, error.message);
                    
                    errors.push({
                        location,
                        error: error.message,
                        index: batchIndex * maxBatchSize + i
                    });
                    
                    results.push({
                        location,
                        data: { places: [] },
                        success: false,
                        error: error.message,
                        index: batchIndex * maxBatchSize + i
                    });
                }

                // COST PROTECTION: Stop if we're hitting quota issues
                if (errors.length > 2 && errors.slice(-2).every(e => e.error.includes('quota'))) {
                    console.warn('🚨 Multiple quota errors detected, stopping batch processing');
                    break;
                }
            }

            // Inter-batch delay to respect rate limits
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return {
            results,
            errors,
            totalRequests: results.filter(r => r.success).length,
            successRate: (results.filter(r => r.success).length / locations.length * 100).toFixed(1),
            estimatedTotalCost: totalCost.toFixed(4),
            costBreakdown: {
                successfulRequests: results.filter(r => r.success).length,
                averageCostPerRequest: results.filter(r => r.success).length > 0 ? 
                    (totalCost / results.filter(r => r.success).length).toFixed(4) : 0
            }
        };
    }

    // COST OPTIMIZATION: Smarter contextual search with limits
    async contextualTextSearch(location, context = {}) {
        const {
            dateRange = 'current',
            eventTypes = [],
            city = null,
            maxQueries = 3, // REDUCED from 8
            fieldLevel = 'minimal'
        } = context;

        // Generate fewer, more targeted queries
        const queries = this.generateOptimizedQueries(dateRange, eventTypes, city, maxQueries);
        const results = [];
        let totalCost = 0;

        console.log(`🎯 [COST-OPTIMIZED] Contextual search with ${queries.length} targeted queries`);

        for (const query of queries) {
            try {
                const data = await this.searchText(query, location, {
                    radius: 1500,
                    maxResults: 6, // REDUCED
                    fieldLevel: fieldLevel
                });
                
                if (data.places && data.places.length > 0) {
                    const cost = this.estimateRequestCost(fieldLevel, data.places.length);
                    totalCost += cost;
                    
                    results.push({
                        query,
                        places: data.places,
                        count: data.places.length,
                        estimatedCost: cost
                    });
                    
                    console.log(`✅ Query "${query}" → ${data.places.length} places (cost: $${cost.toFixed(4)})`);
                } else {
                    console.log(`ℹ️ Query "${query}" → no results`);
                }
                
            } catch (error) {
                console.error(`❌ Query "${query}" failed:`, error.message);
                
                // Stop on quota errors
                if (error.message.includes('quota')) {
                    console.warn('🚨 Quota exceeded, stopping contextual search');
                    break;
                }
            }
        }

        console.log(`💰 Contextual search total estimated cost: $${totalCost.toFixed(4)}`);
        return results;
    }

    // COST ESTIMATION: Help track spending
    estimateRequestCost(fieldLevel, resultCount = 1) {
        // Approximate costs for Places API (New) - non-enterprise
        const baseCosts = {
            minimal: 0.004,   // Basic fields
            standard: 0.006,  // Standard fields  
            enhanced: 0.010   // More fields
        };
        
        return baseCosts[fieldLevel] || baseCosts.standard;
    }

    // OPTIMIZATION: Generate fewer, better queries
    generateOptimizedQueries(dateRange, eventTypes, city, maxQueries) {
        const queries = [];
        
        // Prioritize high-value queries
        if (city) {
            const cityLower = city.toLowerCase();
            if (cityLower.includes('las vegas')) {
                queries.push('CES convention center', 'strip conference venues');
            } else if (cityLower.includes('austin')) {
                queries.push('SXSW venues', 'downtown conference center');
            } else if (cityLower.includes('san francisco')) {
                queries.push('tech conference venues', 'Moscone Center events');
            }
        }
        
        // Add general queries only if we have room
        if (queries.length < maxQueries) {
            queries.push('conference center', 'convention hall');
        }
        
        // Fill remaining slots with event-specific queries
        if (eventTypes.includes('convention_center') && queries.length < maxQueries) {
            queries.push('trade show venue');
        }
        
        return queries.slice(0, maxQueries);
    }

    // MONITORING: Track API usage and costs
    getUsageStats() {
        return {
            requestCount: this.requestCount,
            averageDelay: this.rateLimitDelay + (this.requestCount * 25),
            estimatedSessionCost: (this.requestCount * 0.006).toFixed(4), // Rough estimate
            rateLimitStrategy: 'conservative',
            fieldOptimization: 'enabled',
            batchSizeLimit: 3,
            costControlsActive: true
        };
    }

    // Reset for new session
    resetUsageTracking() {
        this.requestCount = 0;
        console.log('📊 Usage tracking reset');
    }
}

// Export factory with cost warnings
export const createOptimizedPlacesApiClient = (apiKey) => {
    if (!apiKey) {
        throw new Error('Google Maps API key is required');
    }
    
    console.log('🏗️ [COST-OPTIMIZED] Creating Places API client with cost controls');
    console.log('💡 Cost optimizations active:');
    console.log('   ✅ Minimal field masks by default');
    console.log('   ✅ Reduced batch sizes');
    console.log('   ✅ Conservative rate limiting');
    console.log('   ✅ Quota protection');
    console.log('   ✅ Cost estimation and tracking');
    
    return new OptimizedPlacesApiClient(apiKey);
};  