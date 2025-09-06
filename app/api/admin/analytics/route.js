// app/api/admin/analytics/route.js - Enhanced with Business Card Scanning Analytics

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { isServerAdmin } from '@/lib/serverAdminAuth';

// API Pricing Constants
const PRICING = {
    // Auto-grouping API (Google Places API Nearby Search)
    groupGeneration: {
        freeLimit: 5000, // For Nearby Search
        costPerCallAfterFree: 0.032 // $32.00 per 1,000 for Nearby Search Pro
    },
    // Places Search API (Text Search)
    placesSearch: {
        freeLimit: 10000, // 10,000 free for Text Search Essentials
        pricing: [
            { min: 0, max: 10000, cost: 0 },
            { min: 10001, max: Infinity, cost: 0.032 } // $32.00 per 1,000 for Text Search Pro
        ]
    },
    // Places Autocomplete API
    placesAutocomplete: {
        freeLimit: 10000, // 10,000 free for Autocomplete Requests
        pricing: [
            { min: 0, max: 10000, cost: 0 },
            { min: 10001, max: Infinity, cost: 0.00283 } // $2.83 per 1,000 for Autocomplete Requests
        ]
    },
    // Places Details API
    placesDetails: {
        freeLimit: 10000, // 10,000 free for Place Details Essentials
        pricing: [
            { min: 0, max: 10000, cost: 0 },
            { min: 10001, max: Infinity, cost: 0.005 } // $5.00 per 1,000 for Place Details Essentials
        ]
    },
    // NEW: Business Card Scanning API (Google Vision API)
    businessCardScan: {
        freeLimit: 1000, // 1,000 free scans per month
        pricing: [
            { min: 0, max: 1000, cost: 0 },
            { min: 1001, max: 5000000, cost: 0.0015 }, // $1.50 per 1,000 scans
            { min: 5000001, max: Infinity, cost: 0.0006 } // $0.60 per 1,000 scans for volume
        ]
    }
};

// Calculate costs based on usage and pricing tiers
function calculateCosts(apiCalls, apiType) {
    const pricing = PRICING[apiType];
    
    if (!pricing) {
        return {
            totalCalls: apiCalls,
            freeCalls: 0,
            paidCalls: apiCalls,
            totalCost: 0,
            freeLimit: 0,
            usagePercentage: 0,
            message: "Pricing not defined for this API type."
        };
    }

    // Handle APIs with a simple free limit and flat rate after (groupGeneration)
    if (apiType === 'groupGeneration') {
        const freeCallsUsed = Math.min(apiCalls, pricing.freeLimit);
        const paidCalls = Math.max(0, apiCalls - freeCallsUsed);
        const totalCost = paidCalls * pricing.costPerCallAfterFree;
        
        return {
            totalCalls: apiCalls,
            freeCalls: freeCallsUsed,
            paidCalls: paidCalls,
            totalCost: parseFloat(totalCost.toFixed(4)),
            freeLimit: pricing.freeLimit,
            usagePercentage: pricing.freeLimit > 0 ? (apiCalls / pricing.freeLimit) * 100 : (apiCalls > 0 ? 100 : 0)
        };
    }
    
    // Handle APIs with tiered pricing (all others including businessCardScan)
    let totalCost = 0;
    let remainingCalls = apiCalls;
    let freeCallsUsed = 0;
    let paidCalls = 0;
    let effectiveFreeLimit = pricing.pricing[0]?.max || 0; // Assuming first tier is free

    for (const tier of pricing.pricing) {
        if (remainingCalls <= 0) break;
        
        const tierMin = tier.min;
        const tierMax = tier.max || Infinity;
        
        // Calculate calls within the current tier
        const callsInTier = Math.min(remainingCalls, (tierMax - tierMin + 1));
        
        if (tier.cost === 0) {
            freeCallsUsed += callsInTier;
        } else {
            paidCalls += callsInTier;
        }
        
        totalCost += callsInTier * tier.cost;
        remainingCalls -= callsInTier;
    }
    
    return {
        totalCalls: apiCalls,
        freeCalls: freeCallsUsed,
        paidCalls: paidCalls,
        totalCost: parseFloat(totalCost.toFixed(4)),
        freeLimit: effectiveFreeLimit,
        usagePercentage: effectiveFreeLimit > 0 ? (apiCalls / effectiveFreeLimit) * 100 : (apiCalls > 0 ? 100 : 0)
    };
}

export async function GET(request) {
    console.log('📊 Enhanced Admin Analytics API with Business Card Scanning: Request received.');

    try {
        // 1. Admin Authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        if (!isServerAdmin(decodedToken.email)) {
            console.warn(`🚨 UNAUTHORIZED ADMIN ACCESS ATTEMPT by: ${decodedToken.email}`);
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        console.log(`✅ Admin access granted for: ${decodedToken.email}`);

        // 2. Fetch Usage Logs from Last 30 Days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const usageLogsRef = adminDb.collection('UsageLogs');
        const query = usageLogsRef
            .where('timestamp', '>=', thirtyDaysAgo)
            .orderBy('timestamp', 'desc');

        const snapshot = await query.get();

        if (snapshot.empty) {
            return NextResponse.json({
                message: "No usage data found for the last 30 days.",
                summary: {
                    groupGeneration: { totalCost: 0, totalApiCalls: 0, totalRuns: 0 },
                    placesSearch: { totalCost: 0, totalApiCalls: 0, totalRuns: 0 },
                    placesAutocomplete: { totalCost: 0, totalApiCalls: 0, totalRuns: 0 },
                    placesDetails: { totalCost: 0, totalApiCalls: 0, totalRuns: 0 },
                    businessCardScan: { totalCost: 0, totalApiCalls: 0, totalRuns: 0 }, // NEW
                    combined: { totalCost: 0, totalApiCalls: 0, totalRuns: 0 }
                },
                recentRuns: []
            });
        }
        
        // 3. Process and Categorize Logs by Feature
        const analytics = {
            groupGeneration: {
                totalCost: 0,
                totalApiCalls: 0,
                totalRuns: 0,
                logs: []
            },
            placesSearch: {
                totalCost: 0,
                totalApiCalls: 0,
                totalRuns: 0,
                logs: []
            },
            placesAutocomplete: {
                totalCost: 0,
                totalApiCalls: 0,
                totalRuns: 0,
                logs: []
            },
            placesDetails: {
                totalCost: 0,
                totalApiCalls: 0,
                totalRuns: 0,
                logs: []
            },
            businessCardScan: { // NEW
                totalCost: 0,
                totalApiCalls: 0,
                totalRuns: 0,
                logs: []
            }
        };

        const recentRuns = [];
        const userStats = {};

        snapshot.forEach(doc => {
            const log = {
                id: doc.id,
                ...doc.data(),
                // Convert Firestore Timestamp to ISO string for consistency
                timestamp: doc.data().timestamp ? doc.data().timestamp.toDate().toISOString() : null
            };
            
            // Categorize by feature type
            if (log.feature === 'autoGroupGeneration') {
                analytics.groupGeneration.totalRuns++;
                analytics.groupGeneration.totalCost += log.cost || 0;
                analytics.groupGeneration.totalApiCalls += log.apiCalls || 0;
                analytics.groupGeneration.logs.push(log);
            } else if (log.feature === 'placesSearch') {
                analytics.placesSearch.totalRuns++;
                analytics.placesSearch.totalCost += log.cost || 0;
                analytics.placesSearch.totalApiCalls += log.apiCalls || 0;
                analytics.placesSearch.logs.push(log);
            } else if (log.feature === 'placesAutocomplete') {
                analytics.placesAutocomplete.totalRuns++;
                analytics.placesAutocomplete.totalCost += log.cost || 0;
                analytics.placesAutocomplete.totalApiCalls += log.apiCalls || 0;
                analytics.placesAutocomplete.logs.push(log);
            } else if (log.feature === 'placesDetails') {
                analytics.placesDetails.totalRuns++;
                analytics.placesDetails.totalCost += log.cost || 0;
                analytics.placesDetails.totalApiCalls += log.apiCalls || 0;
                analytics.placesDetails.logs.push(log);
            } else if (log.feature === 'businessCardScan') { // NEW
                analytics.businessCardScan.totalRuns++;
                analytics.businessCardScan.totalCost += log.cost || 0;
                analytics.businessCardScan.totalApiCalls += log.visionApiCalls || log.scansProcessed || 1; // Use appropriate field
                analytics.businessCardScan.logs.push(log);
            }

            // Collect recent runs for detailed view (limit to 100 for performance)
            if (recentRuns.length < 100) {
                recentRuns.push({
                    id: log.id,
                    userId: log.userId,
                    feature: log.feature,
                    status: log.status,
                    cost: log.cost,
                    apiCalls: log.apiCalls || log.visionApiCalls || log.scansProcessed || 0,
                    processingTimeMs: log.processingTimeMs,
                    searchStrategy: log.searchStrategy || null,
                    subscription: log.subscriptionAtTimeOfRun || log.tierAtTimeOfScan,
                    timestamp: log.timestamp,
                    cacheHitRate: log.cacheHitRate || 0,
                    query: log.query || log.placeId || 'N/A',
                    details: log.details || {}
                });
            }
            
            // Track per-user stats
            if (log.userId) {
                if (!userStats[log.userId]) {
                    userStats[log.userId] = {
                        groupGeneration: { cost: 0, runs: 0, apiCalls: 0 },
                        placesSearch: { cost: 0, runs: 0, apiCalls: 0 },
                        placesAutocomplete: { cost: 0, runs: 0, apiCalls: 0 },
                        placesDetails: { cost: 0, runs: 0, apiCalls: 0 },
                        businessCardScan: { cost: 0, runs: 0, apiCalls: 0 }, // NEW
                        total: { cost: 0, runs: 0, apiCalls: 0 }
                    };
                }
                
                // Use a dynamic feature key for userStats
                const featureKey = log.feature === 'autoGroupGeneration' ? 'groupGeneration' :
                                   log.feature === 'placesSearch' ? 'placesSearch' :
                                   log.feature === 'placesAutocomplete' ? 'placesAutocomplete' :
                                   log.feature === 'placesDetails' ? 'placesDetails' :
                                   log.feature === 'businessCardScan' ? 'businessCardScan' : null; // NEW

                if (featureKey) {
                    userStats[log.userId][featureKey].cost += log.cost || 0;
                    userStats[log.userId][featureKey].runs += 1;
                    userStats[log.userId][featureKey].apiCalls += log.apiCalls || log.visionApiCalls || log.scansProcessed || 0;
                }
                
                userStats[log.userId].total.cost += log.cost || 0;
                userStats[log.userId].total.runs += 1;
                userStats[log.userId].total.apiCalls += log.apiCalls || log.visionApiCalls || log.scansProcessed || 0;
            }
        });

        // 4. Calculate Costs and Usage Statistics for all features
        const groupGenerationCosts = calculateCosts(analytics.groupGeneration.totalApiCalls, 'groupGeneration');
        const placesSearchCosts = calculateCosts(analytics.placesSearch.totalApiCalls, 'placesSearch');
        const placesAutocompleteCosts = calculateCosts(analytics.placesAutocomplete.totalApiCalls, 'placesAutocomplete');
        const placesDetailsCosts = calculateCosts(analytics.placesDetails.totalApiCalls, 'placesDetails');
        const businessCardScanCosts = calculateCosts(analytics.businessCardScan.totalApiCalls, 'businessCardScan'); // NEW

        // 5. Find Top Users
        const topUsers = Object.entries(userStats)
            .sort((a, b) => b[1].total.cost - a[1].total.cost)
            .slice(0, 10)
            .map(([userId, stats]) => ({
                userId,
                groupGeneration: stats.groupGeneration || { cost: 0, runs: 0, apiCalls: 0 },
                placesSearch: stats.placesSearch || { cost: 0, runs: 0, apiCalls: 0 },
                placesAutocomplete: stats.placesAutocomplete || { cost: 0, runs: 0, apiCalls: 0 },
                placesDetails: stats.placesDetails || { cost: 0, runs: 0, apiCalls: 0 },
                businessCardScan: stats.businessCardScan || { cost: 0, runs: 0, apiCalls: 0 }, // NEW
                total: stats.total || { cost: 0, runs: 0, apiCalls: 0 }
            }));

        // 6. Calculate Feature Usage Trends (last 7 days vs previous 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentLogs = recentRuns.filter(log => new Date(log.timestamp) >= sevenDaysAgo);
        const previousLogs = recentRuns.filter(log => {
            const logDate = new Date(log.timestamp);
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
            return logDate >= fourteenDaysAgo && logDate < sevenDaysAgo;
        });

        const trends = {
            groupGeneration: {
                recent: recentLogs.filter(log => log.feature === 'autoGroupGeneration').length,
                previous: previousLogs.filter(log => log.feature === 'autoGroupGeneration').length
            },
            placesSearch: {
                recent: recentLogs.filter(log => log.feature === 'placesSearch').length,
                previous: previousLogs.filter(log => log.feature === 'placesSearch').length
            },
            placesAutocomplete: {
                recent: recentLogs.filter(log => log.feature === 'placesAutocomplete').length,
                previous: previousLogs.filter(log => log.feature === 'placesAutocomplete').length
            },
            placesDetails: {
                recent: recentLogs.filter(log => log.feature === 'placesDetails').length,
                previous: previousLogs.filter(log => log.feature === 'placesDetails').length
            },
            businessCardScan: { // NEW
                recent: recentLogs.filter(log => log.feature === 'businessCardScan').length,
                previous: previousLogs.filter(log => log.feature === 'businessCardScan').length
            }
        };

        // 7. Prepare Enhanced Response
        const combinedTotalCost = analytics.groupGeneration.totalCost + 
                                  analytics.placesSearch.totalCost +
                                  analytics.placesAutocomplete.totalCost +
                                  analytics.placesDetails.totalCost +
                                  analytics.businessCardScan.totalCost; // NEW
        
        const combinedTotalApiCalls = analytics.groupGeneration.totalApiCalls +
                                      analytics.placesSearch.totalApiCalls +
                                      analytics.placesAutocomplete.totalApiCalls +
                                      analytics.placesDetails.totalApiCalls +
                                      analytics.businessCardScan.totalApiCalls; // NEW

        const combinedTotalRuns = analytics.groupGeneration.totalRuns +
                                  analytics.placesSearch.totalRuns +
                                  analytics.placesAutocomplete.totalRuns +
                                  analytics.placesDetails.totalRuns +
                                  analytics.businessCardScan.totalRuns; // NEW

        const summary = {
            period: "Last 30 Days",
            groupGeneration: {
                ...groupGenerationCosts,
                totalRuns: analytics.groupGeneration.totalRuns,
                averageCostPerRun: analytics.groupGeneration.totalRuns > 0 ? 
                    parseFloat((analytics.groupGeneration.totalCost / analytics.groupGeneration.totalRuns).toFixed(4)) : 0,
                trend: trends.groupGeneration.previous > 0 ? 
                    ((trends.groupGeneration.recent - trends.groupGeneration.previous) / trends.groupGeneration.previous * 100).toFixed(1) : 
                    trends.groupGeneration.recent > 0 ? 100 : 0
            },
            placesSearch: {
                ...placesSearchCosts,
                totalRuns: analytics.placesSearch.totalRuns,
                averageCostPerRun: analytics.placesSearch.totalRuns > 0 ? 
                    parseFloat((analytics.placesSearch.totalCost / analytics.placesSearch.totalRuns).toFixed(4)) : 0,
                trend: trends.placesSearch.previous > 0 ? 
                    ((trends.placesSearch.recent - trends.placesSearch.previous) / trends.placesSearch.previous * 100).toFixed(1) : 
                    trends.placesSearch.recent > 0 ? 100 : 0
            },
            placesAutocomplete: {
                ...placesAutocompleteCosts,
                totalRuns: analytics.placesAutocomplete.totalRuns,
                averageCostPerRun: analytics.placesAutocomplete.totalRuns > 0 ?
                    parseFloat((analytics.placesAutocomplete.totalCost / analytics.placesAutocomplete.totalRuns).toFixed(4)) : 0,
                trend: trends.placesAutocomplete.previous > 0 ?
                    ((trends.placesAutocomplete.recent - trends.placesAutocomplete.previous) / trends.placesAutocomplete.previous * 100).toFixed(1) :
                    trends.placesAutocomplete.recent > 0 ? 100 : 0
            },
            placesDetails: {
                ...placesDetailsCosts,
                totalRuns: analytics.placesDetails.totalRuns,
                averageCostPerRun: analytics.placesDetails.totalRuns > 0 ?
                    parseFloat((analytics.placesDetails.totalCost / analytics.placesDetails.totalRuns).toFixed(4)) : 0,
                trend: trends.placesDetails.previous > 0 ?
                    ((trends.placesDetails.recent - trends.placesDetails.previous) / trends.placesDetails.previous * 100).toFixed(1) :
                    trends.placesDetails.recent > 0 ? 100 : 0
            },
            businessCardScan: { // NEW
                ...businessCardScanCosts,
                totalRuns: analytics.businessCardScan.totalRuns,
                averageCostPerRun: analytics.businessCardScan.totalRuns > 0 ?
                    parseFloat((analytics.businessCardScan.totalCost / analytics.businessCardScan.totalRuns).toFixed(4)) : 0,
                trend: trends.businessCardScan.previous > 0 ?
                    ((trends.businessCardScan.recent - trends.businessCardScan.previous) / trends.businessCardScan.previous * 100).toFixed(1) :
                    trends.businessCardScan.recent > 0 ? 100 : 0,
                // Additional metrics specific to business card scanning
                successRate: analytics.businessCardScan.logs.length > 0 ?
                    (analytics.businessCardScan.logs.filter(log => log.status === 'success').length / analytics.businessCardScan.logs.length * 100).toFixed(1) : 0,
                averageProcessingTime: analytics.businessCardScan.logs.length > 0 ?
                    analytics.businessCardScan.logs.reduce((sum, log) => sum + (log.processingTimeMs || 0), 0) / analytics.businessCardScan.logs.length : 0,
                // Vision API specific metrics
                totalScansProcessed: analytics.businessCardScan.logs.reduce((sum, log) => sum + (log.scansProcessed || 1), 0),
                currentTier: businessCardScanCosts.usagePercentage < 100 ? 'free' : 
                            businessCardScanCosts.totalCalls <= 5000000 ? 'standard' : 'volume'
            },
            combined: {
                totalCost: parseFloat(combinedTotalCost.toFixed(4)),
                totalApiCalls: combinedTotalApiCalls,
                totalRuns: combinedTotalRuns,
                averageCostPerRun: combinedTotalRuns > 0 ? 
                    parseFloat((combinedTotalCost / combinedTotalRuns).toFixed(4)) : 0
            },
            topUsers: topUsers.slice(0, 5), // Top 5 users by cost
            healthMetrics: {
                averageProcessingTime: recentRuns.length > 0 ? 
                    recentRuns.reduce((sum, log) => sum + (log.processingTimeMs || 0), 0) / recentRuns.length : 0,
                successRate: recentRuns.length > 0 ? 
                    (recentRuns.filter(log => log.status === 'success').length / recentRuns.length * 100).toFixed(1) : 0,
                averageCacheHitRate: recentRuns.length > 0 ? 
                    recentRuns.reduce((sum, log) => sum + (log.cacheHitRate || 0), 0) / recentRuns.length : 0
            }
        };

        const responseData = {
            summary,
            recentRuns,
            userStats: topUsers,
            featureBreakdown: {
                groupGeneration: analytics.groupGeneration.logs.slice(0, 50),
                placesSearch: analytics.placesSearch.logs.slice(0, 50),
                placesAutocomplete: analytics.placesAutocomplete.logs.slice(0, 50),
                placesDetails: analytics.placesDetails.logs.slice(0, 50),
                businessCardScan: analytics.businessCardScan.logs.slice(0, 50) // NEW
            },
            pricing: PRICING
        };

        console.log('✅ Enhanced Admin Analytics API with Business Card Scanning: Successfully processed and sending data.', {
            groupGenerationRuns: analytics.groupGeneration.totalRuns,
            placesSearchRuns: analytics.placesSearch.totalRuns,
            placesAutocompleteRuns: analytics.placesAutocomplete.totalRuns,
            placesDetailsRuns: analytics.placesDetails.totalRuns,
            businessCardScanRuns: analytics.businessCardScan.totalRuns, // NEW
            totalCost: summary.combined.totalCost
        });

        return NextResponse.json(responseData);

    } catch (error) {
        console.error("💥 Enhanced Admin Analytics API Error:", error);
        if (error.code?.startsWith('auth/')) {
            return NextResponse.json({ error: 'Authentication error', details: error.message }, { status: 401 });
        }
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}