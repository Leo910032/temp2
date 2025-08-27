// app/api/user/contacts/places/details/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// In-memory cache for Place Details results
const detailsCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for place details

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
    const emoji = level === 'INFO' ? '📋' : level === 'SUCCESS' ? '✅' : level === 'WARNING' ? '⚠️' : '❌';
    const costStats = costTracker.getStats();
    
    console.log(`${emoji} [PLACES-DETAILS] ${timestamp} - ${message}`, {
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

// API cost configuration for Place Details
const API_COSTS = {
    placeDetailsEssentials: 0.005, // $5.00 per 1,000 requests for "Place Details Essentials"
                                  // This is the cost when NOT part of a free Autocomplete session.
                                  // If used with a session token, Google bills the session, not this call.
    contactFields: 0.003,      // $3.00 per 1,000 for Contact Data
    atmosphereFields: 0.005    // $5.00 per 1,000 for Atmosphere Data
};

function getCacheKey(placeId, fields) {
    // Sort fields to ensure consistent cache key
    const sortedFields = [...fields].sort().join(',');
    return `${placeId}_${sortedFields}`;
}

function getCachedResult(placeId, fields) {
    const key = getCacheKey(placeId, fields);
    const cached = detailsCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        costTracker.addCacheHit();
        logWithCostTracking('INFO', 'Cache hit - returning cached place details', {
            placeId: placeId,
            cacheKey: key,
            cachedAt: new Date(cached.timestamp).toISOString()
        });
        return cached.data;
    }
    
    if (cached) {
        detailsCache.delete(key); // Remove expired cache
    }
    
    costTracker.addCacheMiss();
    return null;
}

function setCachedResult(placeId, fields, data) {
    const key = getCacheKey(placeId, fields);
    detailsCache.set(key, {
        data: data,
        timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (detailsCache.size > 500) { // Keep this smaller than autocomplete cache
        const oldestKey = detailsCache.keys().next().value;
        detailsCache.delete(oldestKey);
    }
}

export async function POST(request) {
    const startTime = Date.now();
    let userId = null;
    costTracker.reset();

    try {
        logWithCostTracking('INFO', 'Places Details API called');

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
                const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; 


        const body = await request.json();
        const { place_id, sessiontoken, fields = [] } = body; 

        if (!place_id) {
            return NextResponse.json({ error: 'Place ID is required' }, { status: 400 });
        }

        // Define default and allowed fields for this endpoint
        const requestedFields = fields.length > 0 ? fields : [
            'place_id', 'name', 'formatted_address', 'geometry', 'types',
            // Add commonly used basic fields here. Avoid premium fields by default.
            // If you need phone, website, etc., you'll need to explicitly request them
            // AND update API_COSTS to account for them.
            // Example: 'formatted_phone_number', 'website', 'opening_hours', 'rating'
        ];
        
        // Ensure only allowed fields are requested if a strict policy is needed.
        // For now, we trust the client to request sensible fields within billing limits.

        const cacheKey = getCacheKey(place_id, requestedFields);
        const cachedResult = getCachedResult(place_id, requestedFields);
        
        if (cachedResult) {
            const processingTime = Date.now() - startTime;
            const finalCostStats = costTracker.getStats(); // Get stats AFTER cache hit/miss logic
            
            const logData = {
                userId: userId,
                feature: "placesDetails",
                status: "success",
                timestamp: FieldValue.serverTimestamp(),
                cost: parseFloat(finalCostStats.totalCost),
                apiCalls: finalCostStats.apiCallsUsed,
                processingTimeMs: processingTime,
                placeId: place_id,
                cacheHitRate: finalCostStats.cacheHitRate,
                details: { wasFromCache: true }
            };
            await saveUsageLogToDatabase(logData);

            return NextResponse.json({
                result: cachedResult.result,
                status: 'OK',
                metadata: {
                    placeId: place_id,
                    apiCallsUsed: finalCostStats.apiCallsUsed,
                    totalCost: finalCostStats.totalCost,
                    cacheHitRate: `${finalCostStats.cacheHitRate}%`,
                    processingTimeMs: processingTime,
                    optimized: true
                }
            });
        }
        
        const baseUrl = 'https://maps.googleapis.com/maps/api/place/details/json';
        const params = new URLSearchParams({
            place_id: place_id,
            key: apiKey,
            fields: requestedFields.join(','), // Comma-separated list of fields
            sessiontoken: sessiontoken // Crucial for session-based billing
        });

        const apiUrl = `${baseUrl}?${params.toString()}`;
        
        // Calculate estimated cost for this specific details call
        let estimatedApiCost = API_COSTS.placeDetailsEssentials; // Base cost for essential details
        if (requestedFields.includes('formatted_phone_number') || requestedFields.includes('website')) {
            estimatedApiCost += API_COSTS.contactFields;
        }
        if (requestedFields.includes('rating') || requestedFields.includes('user_ratings_total') || requestedFields.includes('price_level') || requestedFields.includes('reviews')) {
            estimatedApiCost += API_COSTS.atmosphereFields;
        }

        logWithCostTracking('INFO', `Making API call`, {
            endpoint: baseUrl,
            placeId: place_id,
            fields: requestedFields,
            sessiontoken: sessiontoken,
            estimatedCost: `$${estimatedApiCost.toFixed(4)}`
        });

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Google API error: ${response.status}`);
        }

        const data = await response.json();

        // Add the calculated cost to the tracker
        costTracker.addCost(estimatedApiCost);

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
            if (data.status === 'REQUEST_DENIED') {
                throw new Error('API request denied. Check API key configuration.');
            }
            if (data.status === 'OVER_QUERY_LIMIT') {
                throw new Error('API quota exceeded. Please try again later.');
            }
            throw new Error(`API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
        }

        setCachedResult(place_id, requestedFields, data);

        const processingTime = Date.now() - startTime;
        const finalCostStats = costTracker.getStats();

        const logData = {
            userId: userId,
            feature: "placesDetails",
            status: "success",
            timestamp: FieldValue.serverTimestamp(),
            cost: parseFloat(finalCostStats.totalCost),
            apiCalls: finalCostStats.apiCallsUsed,
            processingTimeMs: processingTime,
            placeId: place_id,
            cacheHitRate: finalCostStats.cacheHitRate,
            details: {
                fieldsRequested: requestedFields,
                wasFromCache: false,
                sessionTokenUsed: sessiontoken
            }
        };
        await saveUsageLogToDatabase(logData);

        return NextResponse.json({
            result: data.result || null,
            status: data.status,
            metadata: {
                placeId: place_id,
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

        logWithCostTracking('ERROR', 'Error in Places Details', {
            error: error.message,
            costIncurred: `$${finalCostStats.totalCost}`,
            userId: userId
        });

        if (userId) {
            const errorLogData = {
                userId: userId,
                feature: "placesDetails",
                status: "error",
                timestamp: FieldValue.serverTimestamp(),
                cost: parseFloat(finalCostStats.totalCost),
                apiCalls: finalCostStats.apiCallsUsed,
                processingTimeMs: processingTime,
                placeId: request.body?.place_id || 'unknown',
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
            error: 'Failed to get place details',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            costIncurred: finalCostStats.totalCost
        }, { status: 500 });
    }
}

export async function GET(request) {
    return NextResponse.json({
        message: 'Google Places Details API Endpoint',
        version: '1.0',
        description: 'Retrieves comprehensive details for a specific place_id.',
        optimizations: {
            intelligentCaching: 'In-memory cache with 24-hour TTL',
            sessionTokenUsage: 'Supports session tokens for billing optimization (client must provide from autocomplete session)'
        },
        pricingNotes: 'Base cost is $0.005/request. If linked to an Autocomplete session token, the Place Details call is free, and the session is billed at $0.017. Additional costs apply for Contact Data ($0.003) and Atmosphere Data ($0.005) fields if requested.',
        usage: {
            method: 'POST',
            endpoint: '/api/user/contacts/places/details',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer <firebase-auth-token>'
            },
            body: {
                place_id: 'string (required) - The ID of the place to retrieve details for.',
                sessiontoken: 'string (required) - A UUID string from the originating autocomplete session.',
                fields: 'array (optional) - List of fields to return. Defaults to basic fields if not provided. Requesting specific fields can impact cost.'
            }
        }
    });
}