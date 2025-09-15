// lib/services/server/analyticsService.js

import { adminDb } from '@/lib/firebaseAdmin';

// --- Private Helper Functions ---
// These functions are scoped to this service and not exported.

/**
 * Generates key date strings for querying analytics data.
 * @returns {{today: string, yesterday: string, weekKey: string, monthKey: string}}
 */
function getDateKeys() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
    const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    return { today, yesterday, weekKey, monthKey };
}

/**
 * Processes the raw data from a Firestore analytics document into a clean, structured object.
 * This function handles both nested map data and flattened dot-notation data.
 * @param {object} rawData - The data from the Firestore document.
 * @returns {object} A structured analytics data object.
 */
function processAnalyticsData(rawData) {
    const safeData = rawData || {};
    const { today, weekKey, monthKey } = getDateKeys();

    const dailyViews = safeData.dailyViews || {};
    const dailyClicks = safeData.dailyClicks || {};
    const topLinks = [];
    const trafficSources = safeData.trafficSources || {};

    // --- Process Top Links (handles nested structure) ---
    if (safeData.linkClicks && typeof safeData.linkClicks === 'object') {
        Object.entries(safeData.linkClicks).forEach(([linkId, linkData]) => {
            if (linkData && typeof linkData === 'object') {
                topLinks.push({
                    linkId,
                    title: linkData.title || 'Untitled Link',
                    url: linkData.url || '',
                    type: linkData.type || 'custom',
                    totalClicks: linkData.totalClicks || 0,
                    todayClicks: linkData.dailyClicks?.[today] || 0,
                    weekClicks: linkData.weeklyClicks?.[weekKey] || 0,
                    monthClicks: linkData.monthlyClicks?.[monthKey] || 0,
                    lastClicked: linkData.lastClicked?.toDate?.().toISOString() || null,
                });
            }
        });
    }

    topLinks.sort((a, b) => b.totalClicks - a.totalClicks);

    // --- Calculate Traffic Source Stats ---
    const trafficSourceStats = {
        totalSources: Object.keys(trafficSources).length,
        topSource: null,
        socialTraffic: 0,
        searchTraffic: 0,
        directTraffic: 0,
        referralTraffic: 0
    };

    if (trafficSourceStats.totalSources > 0) {
        Object.entries(trafficSources).forEach(([_, sourceData]) => {
            const clicks = sourceData?.clicks || 0;
            const medium = sourceData?.medium || 'unknown';
            if (medium === 'social') trafficSourceStats.socialTraffic += clicks;
            else if (['search', 'organic'].includes(medium)) trafficSourceStats.searchTraffic += clicks;
            else if (medium === 'direct') trafficSourceStats.directTraffic += clicks;
            else if (medium === 'referral') trafficSourceStats.referralTraffic += clicks;
        });
    }

    // --- Build Final Processed Object ---
    return {
        totalViews: safeData.totalViews || 0,
        totalClicks: safeData.totalClicks || 0,
        thisMonthViews: safeData.monthlyViews?.[monthKey] || 0,
        thisMonthClicks: safeData.monthlyClicks?.[monthKey] || 0,
        thisWeekViews: safeData.weeklyViews?.[weekKey] || 0,
        thisWeekClicks: safeData.weeklyClicks?.[weekKey] || 0,
        dailyViews,
        dailyClicks,
        topLinks,
        trafficSources,
        trafficSourceStats
    };
}

// --- Public Service Class ---

export class AnalyticsService {
    /**
     * Fetches and processes all analytics data for a specific user.
     * @param {object} options
     * @param {string} options.userId - The UID of the user whose analytics are being requested.
     * @returns {Promise<object>} The processed analytics data.
     */
    static async getAnalyticsForUser({ userId }) {
        if (!userId) {
            throw new Error('AnalyticsService: userId is required.');
        }

        console.log(`📊 AnalyticsService: Fetching analytics for user: ${userId}`);

        const analyticsRef = adminDb.collection('Analytics').doc(userId);
        const analyticsDoc = await analyticsRef.get();

        if (!analyticsDoc.exists) {
            console.log(`🟡 AnalyticsService: No analytics document found for user: ${userId}. Returning empty state.`);
            // Return a default, empty analytics object
            return processAnalyticsData(null); 
        }
        
        const rawData = analyticsDoc.data();
        const processedData = processAnalyticsData(rawData);
        
        console.log(`✅ AnalyticsService: Successfully processed analytics for user: ${userId}`);
        return processedData;
    }
}