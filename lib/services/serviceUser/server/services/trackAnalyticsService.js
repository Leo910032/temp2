// lib/services/serviceUser/server/services/trackAnalyticsService.js
/**
 * Server-side Analytics Tracking Service
 *
 * Handles all server-side analytics operations:
 * - Writing analytics data to Firestore
 * - Aggregating metrics (daily, weekly, monthly)
 * - Processing time-on-profile data
 * - Calculating retention rates
 * - Managing analytics storage
 */

import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { ANALYTICS_EVENT_TYPES } from '../../constants/analyticsConstants';

/**
 * Get date keys for aggregations
 * @returns {Object} - Date keys for different time periods
 */
function getDateKeys() {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Calculate week number (ISO 8601)
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;

    // Month key
    const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

    // Year key
    const yearKey = `${now.getFullYear()}`;

    return { today, weekKey, monthKey, yearKey };
}

/**
 * Main Analytics Service
 */
export class TrackAnalyticsService {
    /**
     * Track a profile view event
     * @param {Object} data - View event data
     * @param {string} data.userId - Profile owner's user ID
     * @param {string} data.username - Profile owner's username
     * @param {Object} data.sessionData - Session information
     * @returns {Promise<Object>}
     */
    static async trackView({ userId, username, sessionData }) {
        try {
            console.log(`📊 TrackAnalyticsService: Processing view for ${username} (${userId})`);

            const analyticsRef = adminDb.collection('Analytics').doc(userId);
            const { today, weekKey, monthKey, yearKey } = getDateKeys();
            const increment = FieldValue.increment(1);

            // Build update payload
            const updatePayload = {
                lastUpdated: new Date(),
                username: username || 'unknown',

                // View counters
                totalViews: increment,
                [`dailyViews.${today}`]: increment,
                [`weeklyViews.${weekKey}`]: increment,
                [`monthlyViews.${monthKey}`]: increment,
                [`yearlyViews.${yearKey}`]: increment,

                // Last view timestamp
                lastViewAt: new Date()
            };

            // Add traffic source data
            if (sessionData?.trafficSource?.source) {
                const sourceKey = sessionData.trafficSource.source.replace(/\./g, '_'); // Sanitize dots
                updatePayload[`trafficSources.${sourceKey}.views`] = increment;
                updatePayload[`trafficSources.${sourceKey}.lastView`] = new Date();
                updatePayload[`trafficSources.${sourceKey}.medium`] = sessionData.trafficSource.medium;
                updatePayload[`trafficSources.${sourceKey}.type`] = sessionData.trafficSource.type;
            }

            // Add referrer data
            if (sessionData?.originalReferrer && sessionData.originalReferrer !== 'direct') {
                const referrerKey = sessionData.originalReferrer.replace(/\./g, '_').substring(0, 50);
                updatePayload[`referrers.${referrerKey}.views`] = increment;
                updatePayload[`referrers.${referrerKey}.lastView`] = new Date();
            }

            // Add UTM data
            if (sessionData?.utm) {
                const utmCampaign = sessionData.utm.utm_campaign?.replace(/\./g, '_').substring(0, 50);
                if (utmCampaign) {
                    updatePayload[`campaigns.${utmCampaign}.views`] = increment;
                    updatePayload[`campaigns.${utmCampaign}.lastView`] = new Date();
                    updatePayload[`campaigns.${utmCampaign}.source`] = sessionData.utm.utm_source;
                    updatePayload[`campaigns.${utmCampaign}.medium`] = sessionData.utm.utm_medium;
                }
            }

            // Geo data (if available)
            if (sessionData?.country) {
                updatePayload[`geoData.${sessionData.country}.views`] = increment;
            }

            // Device data
            if (sessionData?.userAgent) {
                const isMobile = /mobile|android|iphone|ipad/i.test(sessionData.userAgent);
                const deviceType = isMobile ? 'mobile' : 'desktop';
                updatePayload[`deviceStats.${deviceType}.views`] = increment;
            }

            // Perform the update
            await analyticsRef.set(updatePayload, { merge: true });

            console.log('✅ TrackAnalyticsService: View tracked successfully');

            return { success: true, message: 'View tracked' };

        } catch (error) {
            console.error('❌ TrackAnalyticsService: Error tracking view:', error);
            throw error;
        }
    }

    /**
     * Track a link click event
     * @param {Object} data - Click event data
     * @param {string} data.userId - Profile owner's user ID
     * @param {Object} data.linkData - Link information
     * @param {Object} data.sessionData - Session information
     * @returns {Promise<Object>}
     */
    static async trackClick({ userId, linkData, sessionData }) {
        try {
            console.log(`📊 TrackAnalyticsService: Processing click on "${linkData.linkTitle}"`);

            const analyticsRef = adminDb.collection('Analytics').doc(userId);
            const { today, weekKey, monthKey, yearKey } = getDateKeys();
            const increment = FieldValue.increment(1);

            // Build update payload
            const updatePayload = {
                lastUpdated: new Date(),

                // Click counters
                totalClicks: increment,
                [`dailyClicks.${today}`]: increment,
                [`weeklyClicks.${weekKey}`]: increment,
                [`monthlyClicks.${monthKey}`]: increment,
                [`yearlyClicks.${yearKey}`]: increment,

                // Last click timestamp
                lastClickAt: new Date(),

                // Per-link statistics
                [`linkClicks.${linkData.linkId}.totalClicks`]: increment,
                [`linkClicks.${linkData.linkId}.lastClicked`]: new Date(),
                [`linkClicks.${linkData.linkId}.title`]: linkData.linkTitle,
                [`linkClicks.${linkData.linkId}.url`]: linkData.linkUrl,
                [`linkClicks.${linkData.linkId}.type`]: linkData.linkType || 'custom',

                // Per-link time-based statistics
                [`linkClicks.${linkData.linkId}.dailyClicks.${today}`]: increment,
                [`linkClicks.${linkData.linkId}.weeklyClicks.${weekKey}`]: increment,
                [`linkClicks.${linkData.linkId}.monthlyClicks.${monthKey}`]: increment
            };

            // Add traffic source data for clicks
            if (sessionData?.trafficSource?.source) {
                const sourceKey = sessionData.trafficSource.source.replace(/\./g, '_');
                updatePayload[`trafficSources.${sourceKey}.clicks`] = increment;
                updatePayload[`trafficSources.${sourceKey}.lastClick`] = new Date();
            }

            // Add detailed referrer data for this specific click
            if (sessionData?.sessionId) {
                updatePayload[`linkClicks.${linkData.linkId}.referrerData.${sessionData.sessionId}`] = {
                    source: sessionData.trafficSource?.source || 'unknown',
                    medium: sessionData.trafficSource?.medium || 'unknown',
                    campaign: sessionData.utm?.utm_campaign || '',
                    originalReferrer: sessionData.originalReferrer || '',
                    clickedAt: new Date(),
                    utmParams: sessionData.utm || {}
                };
            }

            // Device data for clicks
            if (sessionData?.userAgent) {
                const isMobile = /mobile|android|iphone|ipad/i.test(sessionData.userAgent);
                const deviceType = isMobile ? 'mobile' : 'desktop';
                updatePayload[`deviceStats.${deviceType}.clicks`] = increment;
                updatePayload[`linkClicks.${linkData.linkId}.deviceStats.${deviceType}`] = increment;
            }

            // Perform the update
            await analyticsRef.set(updatePayload, { merge: true });

            console.log('✅ TrackAnalyticsService: Click tracked successfully');

            return { success: true, message: 'Click tracked' };

        } catch (error) {
            console.error('❌ TrackAnalyticsService: Error tracking click:', error);
            throw error;
        }
    }

    /**
     * Track time spent on profile
     * @param {Object} data - Time tracking data
     * @param {string} data.userId - Profile owner's user ID
     * @param {number} data.duration - Time in milliseconds
     * @param {Object} data.sessionData - Session information
     * @returns {Promise<Object>}
     */
    static async trackTimeOnProfile({ userId, duration, sessionData }) {
        try {
            console.log(`📊 TrackAnalyticsService: Processing time tracking for ${userId} (${duration}ms)`);

            const analyticsRef = adminDb.collection('Analytics').doc(userId);
            const { today, weekKey, monthKey } = getDateKeys();
            const durationSeconds = Math.round(duration / 1000);

            const updatePayload = {
                lastUpdated: new Date(),

                // Total time tracking
                totalTimeSpent: FieldValue.increment(durationSeconds),
                [`dailyTimeSpent.${today}`]: FieldValue.increment(durationSeconds),
                [`weeklyTimeSpent.${weekKey}`]: FieldValue.increment(durationSeconds),
                [`monthlyTimeSpent.${monthKey}`]: FieldValue.increment(durationSeconds),

                // Session count
                totalSessions: FieldValue.increment(1),
                [`dailySessions.${today}`]: FieldValue.increment(1)
            };

            // Calculate average session time (this will be computed on read)
            await analyticsRef.set(updatePayload, { merge: true });

            console.log('✅ TrackAnalyticsService: Time tracked successfully');

            return { success: true, message: 'Time tracked' };

        } catch (error) {
            console.error('❌ TrackAnalyticsService: Error tracking time:', error);
            throw error;
        }
    }

    /**
     * Get analytics for a user
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    static async getAnalytics(userId) {
        try {
            const analyticsRef = adminDb.collection('Analytics').doc(userId);
            const doc = await analyticsRef.get();

            if (!doc.exists) {
                return {
                    userId,
                    totalViews: 0,
                    totalClicks: 0,
                    totalTimeSpent: 0,
                    trafficSources: {},
                    linkClicks: {},
                    exists: false
                };
            }

            const data = doc.data();

            return {
                userId,
                exists: true,
                ...data
            };

        } catch (error) {
            console.error('❌ TrackAnalyticsService: Error fetching analytics:', error);
            throw error;
        }
    }

    /**
     * Calculate retention rate
     * @param {string} userId
     * @param {string} interval - 'daily', 'weekly', or 'monthly'
     * @returns {Promise<Object>}
     */
    static async calculateRetentionRate(userId, interval = 'weekly') {
        try {
            const analyticsRef = adminDb.collection('Analytics').doc(userId);
            const doc = await analyticsRef.get();

            if (!doc.exists) {
                return { retentionRate: 0, totalPeriods: 0, activePeriods: 0 };
            }

            const data = doc.data();
            const viewsField = `${interval}Views`;
            const views = data[viewsField] || {};

            const periods = Object.keys(views);
            const activePeriods = periods.filter(period => views[period] > 0);

            const retentionRate = periods.length > 0
                ? (activePeriods.length / periods.length) * 100
                : 0;

            return {
                retentionRate: Math.round(retentionRate * 100) / 100,
                totalPeriods: periods.length,
                activePeriods: activePeriods.length,
                interval
            };

        } catch (error) {
            console.error('❌ TrackAnalyticsService: Error calculating retention:', error);
            throw error;
        }
    }

    /**
     * Get top performing links
     * @param {string} userId
     * @param {number} limit - Number of top links to return
     * @returns {Promise<Array>}
     */
    static async getTopLinks(userId, limit = 10) {
        try {
            const analyticsRef = adminDb.collection('Analytics').doc(userId);
            const doc = await analyticsRef.get();

            if (!doc.exists) {
                return [];
            }

            const data = doc.data();
            const linkClicks = data.linkClicks || {};

            // Convert to array and sort by total clicks
            const links = Object.entries(linkClicks)
                .map(([linkId, linkData]) => ({
                    linkId,
                    ...linkData
                }))
                .sort((a, b) => (b.totalClicks || 0) - (a.totalClicks || 0))
                .slice(0, limit);

            return links;

        } catch (error) {
            console.error('❌ TrackAnalyticsService: Error getting top links:', error);
            throw error;
        }
    }

    /**
     * Clean up old analytics data (for GDPR compliance)
     * @param {string} userId
     * @param {number} daysToKeep - Number of days to keep data
     * @returns {Promise<Object>}
     */
    static async cleanupOldData(userId, daysToKeep = 365) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

            const analyticsRef = adminDb.collection('Analytics').doc(userId);
            const doc = await analyticsRef.get();

            if (!doc.exists) {
                return { success: true, deletedFields: 0 };
            }

            const data = doc.data();
            const updates = {};
            let deletedFields = 0;

            // Clean up old daily views
            if (data.dailyViews) {
                Object.keys(data.dailyViews).forEach(date => {
                    if (date < cutoffDateStr) {
                        updates[`dailyViews.${date}`] = FieldValue.delete();
                        deletedFields++;
                    }
                });
            }

            // Clean up old daily clicks
            if (data.dailyClicks) {
                Object.keys(data.dailyClicks).forEach(date => {
                    if (date < cutoffDateStr) {
                        updates[`dailyClicks.${date}`] = FieldValue.delete();
                        deletedFields++;
                    }
                });
            }

            if (deletedFields > 0) {
                await analyticsRef.update(updates);
                console.log(`🧹 Cleaned up ${deletedFields} old analytics fields for user ${userId}`);
            }

            return { success: true, deletedFields };

        } catch (error) {
            console.error('❌ TrackAnalyticsService: Error cleaning up data:', error);
            throw error;
        }
    }
}
