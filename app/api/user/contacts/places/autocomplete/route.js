// app/api/user/contacts/places/autocomplete/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid'; // To generate session tokens

// In-memory cache for autocomplete results
const autocompleteCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cost tracker for monitoring API usage for this specific API route
const costTracker = {
    sessionCost: 0,
    requestCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    
    addCost(amount) { 
        this.sessionCost += amount; 
        this.requestCount++; 
    },
    addCacheHit() { this.cacheHits++; },
    addCacheMiss() { this.cacheMisses++; },
    
    getStats() {
        return {
            totalCost: this.sessionCost.toFixed(4),
            apiCallsUsed: this.requestCount,
            cacheHitRate: this.cacheHits + this.cacheMisses > 0 ? 
                Math.round(this.cacheHits / (this.cacheHits + this.cacheMisses) * 100) : 0,
        };
    },
    
    reset() { 
        this.sessionCost = 0; 
        this.requestCount = 0; 
        this.cacheHits = 0; 
        this.cacheMisses = 0; 
    }
};

// Enhanced logging function for this API
const logWithCostTracking = (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    const emoji = level === 'INFO' ? '📝' : level === 'SUCCESS' ? '✔️' : level === 'WARNING' ? '⚠️' : '❌';
    const costStats = costTracker.getStats();
    
    console.log(`${emoji} [PLACES-AUTOCOMPLETE] ${timestamp} - ${message}`, {
        ...data,
        currentRequestCost: `$${costStats.totalCost}`, // Renamed for clarity for single request context
        apiCallsInRequest: costStats.apiCallsUsed,
        cacheHitRate: `${costStats.cacheHitRate}%`,
    });
};

// Function to save usage log to database
async function saveUsageLogToDatabase(logData) {
    try {
        await adminDb.collection('UsageLogs').add(logData);
        logWithCostTracking('SUCCESS', 'Usage log successfully saved to database.', { 
            userId: logData.userId,
            feature: logData.feature
        });
    } catch (error) {
        console.error("🔥 CRITICAL: Failed to save usage log to database:", error);
    }
}

// API cost configuration for Autocomplete
const API_COSTS = {
    autocompleteRequest: 0.00283, // $2.83 per 1,000 requests for "Autocomplete Requests"
                                 // Note: Session usage pricing is more complex for direct API calls,
                                 // this is a conservative per-request cost for logging.
};

function getCacheKey(query, sessiontoken) {
    return `${query.toLowerCase().trim()}_${sessiontoken}`;
}

function getCachedResult(query, sessiontoken) {
    const key = getCacheKey(query, sessiontoken);
    const cached = autocompleteCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        costTracker.addCacheHit();
        logWithCostTracking('INFO', 'Cache hit - returning cached autocomplete results', {
            query: query,
            cacheKey: key,
            cachedAt: new Date(cached.timestamp).toISOString()
        });
        return cached.data;
    }
    
    if (cached) {
        autocompleteCache.delete(key); // Remove expired cache
    }
    
    costTracker.addCacheMiss();
    return null;
}

function setCachedResult(query, sessiontoken, data) {
    const key = getCacheKey(query, sessiontoken);
    autocompleteCache.set(key, {
        data: data,
        timestamp: Date.now()
    });
    
    // Clean up old cache entries to prevent memory leaks
    if (autocompleteCache.size > 1000) {
        const oldestKey = autocompleteCache.keys().next().value;
        autocompleteCache.delete(oldestKey);
    }
}

export async function POST(request) {
    const startTime = Date.now();
    let userId = null;
    costTracker.reset();

    try {
        // Corrected log message for this API
        logWithCostTracking('INFO', 'Places Autocomplete API called');

        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        userId = decodedToken.uid;

        if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
            logWithCostTracking('ERROR', 'Google Maps API key not configured');
            return NextResponse.json({ 
                error: 'Google Maps API not configured' 
            }, { status: 500 });
        }
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; // Define apiKey here

        const body = await request.json();
        // Corrected: Destructure 'input' from the body, not 'place_id'
        const { input, sessiontoken, types = 'address' } = body; 

        // Corrected: Validate 'input' for autocomplete, not 'place_id'
        if (!input || input.trim().length < 3) {
            return NextResponse.json({ 
                predictions: [], 
                status: 'QUERY_TOO_SHORT',
                metadata: {
                    query: input,
                    apiCallsUsed: 0,
                    totalCost: '0.0000',
                    cacheHitRate: '0%',
                    processingTimeMs: Date.now() - startTime,
                    optimized: true
                }
            });
        }

        const cacheKey = `${input}_${sessiontoken}_${types}`;
        const cachedResult = getCachedResult(cacheKey, sessiontoken); // Pass sessiontoken to getCachedResult
        
        if (cachedResult) {
            const processingTime = Date.now() - startTime;
            const finalCostStats = costTracker.getStats(); // Get stats AFTER cache hit/miss logic

            const logData = {
                userId: userId,
                feature: "placesAutocomplete",
                status: "success",
                timestamp: FieldValue.serverTimestamp(),
                cost: parseFloat(finalCostStats.totalCost),
                apiCalls: finalCostStats.apiCallsUsed,
                processingTimeMs: processingTime,
                query: input,
                cacheHitRate: finalCostStats.cacheHitRate,
                details: { wasFromCache: true }
            };
            await saveUsageLogToDatabase(logData);

            return NextResponse.json({
                predictions: cachedResult.predictions,
                status: 'OK',
                metadata: {
                    query: input,
                    apiCallsUsed: finalCostStats.apiCallsUsed,
                    totalCost: finalCostStats.totalCost,
                    cacheHitRate: `${finalCostStats.cacheHitRate}%`,
                    processingTimeMs: processingTime,
                    optimized: true
                }
            });
        }
        
        const baseUrl = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
        const params = new URLSearchParams({
            input: input.trim(),
            key: apiKey,
            types: types,
            sessiontoken: sessiontoken // Crucial for session-based billing
        });

        const apiUrl = `${baseUrl}?${params.toString()}`;
        
        logWithCostTracking('INFO', `Making API call`, {
            endpoint: baseUrl,
            input: input,
            sessiontoken: sessiontoken,
            estimatedCost: `$${API_COSTS.autocompleteRequest.toFixed(4)}`
        });

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Google API error: ${response.status}`);
        }

        const data = await response.json();

        costTracker.addCost(API_COSTS.autocompleteRequest);

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
            if (data.status === 'REQUEST_DENIED') {
                throw new Error('API request denied. Check API key configuration.');
            }
            if (data.status === 'OVER_QUERY_LIMIT') {
                throw new Error('API quota exceeded. Please try again later.');
            }
            throw new Error(`API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
        }

        setCachedResult(cacheKey, sessiontoken, data); // Pass sessiontoken to setCachedResult

        const processingTime = Date.now() - startTime;
        const finalCostStats = costTracker.getStats();

        const logData = {
            userId: userId,
            feature: "placesAutocomplete",
            status: "success",
            timestamp: FieldValue.serverTimestamp(),
            cost: parseFloat(finalCostStats.totalCost),
            apiCalls: finalCostStats.apiCallsUsed,
            processingTimeMs: processingTime,
            query: input,
            cacheHitRate: finalCostStats.cacheHitRate,
            details: {
                predictionsCount: data.predictions?.length || 0,
                wasFromCache: false,
                sessionTokenUsed: sessiontoken
            }
        };
        await saveUsageLogToDatabase(logData);

        return NextResponse.json({
            predictions: data.predictions || [],
            status: data.status,
            metadata: {
                query: input,
                apiCallsUsed: finalCostStats.apiCallsUsed,
                totalCost: finalCostStats.totalCost,
                cacheHitRate: `${finalCostStats.cacheHitRate}%`,
                processingTimeMs: processingTime,
                searchedAt: new Date().toISOString(),
                optimized: true
            }
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        const finalCostStats = costTracker.getStats();

        logWithCostTracking('ERROR', 'Error in Places Autocomplete', {
            error: error.message,
            costIncurred: `$${finalCostStats.totalCost}`,
            userId: userId
        });

        if (userId) {
            const errorLogData = {
                userId: userId,
                feature: "placesAutocomplete",
                status: "error",
                timestamp: FieldValue.serverTimestamp(),
                cost: parseFloat(finalCostStats.totalCost),
                apiCalls: finalCostStats.apiCallsUsed,
                processingTimeMs: processingTime,
                query: request.body?.input || 'unknown', // Now correctly referencing 'input'
                cacheHitRate: finalCostStats.cacheHitRate,
                errorDetails: {
                    message: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }
            };
            await saveUsageLogToDatabase(errorLogData);
        }
        
        if (error.message.includes('quota') || error.message.includes('rate limit')) {
            return NextResponse.json({ 
                error: 'API quota exceeded. Please try again later.',
                retryAfter: 300,
                costIncurred: finalCostStats.totalCost
            }, { status: 429 });
        }
        
        return NextResponse.json({ 
            error: 'Failed to get autocomplete suggestions',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            costIncurred: finalCostStats.totalCost
        }, { status: 500 });
    }
}

export async function GET(request) {
    return NextResponse.json({
        message: 'Google Places Autocomplete API Endpoint',
        version: '1.0',
        description: 'Provides real-time place predictions as a user types, optimized for cost with session tokens.',
        optimizations: {
            intelligentCaching: 'In-memory cache with 5-minute TTL',
            sessionTokenUsage: 'Supports session tokens for billing optimization (client must provide)',
            queryValidation: 'Minimum 3 characters required'
        },
        pricingNotes: 'Each autocomplete request costs $0.00283. If linked to a subsequent Place Details request via a session token, Google may bill for an "Autocomplete Session" ($0.017/session) instead of individual requests, making this highly cost-effective.',
        usage: {
            method: 'POST',
            endpoint: '/api/user/contacts/places/autocomplete',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer <firebase-auth-token>'
            },
            body: {
                input: 'string (required) - The text string on which to search.',
                sessiontoken: 'string (optional) - A UUID string to identify a user session (recommended for billing optimization).',
                types: 'string (optional) - The type of place data to return, e.g., "address", "establishment". Defaults to "address".'
            }
        }
    });
}