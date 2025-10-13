// lib/services/serviceAdmin/server/analyticsService.js
// Server-side service for platform analytics operations

import { adminDb } from '@/lib/firebaseAdmin';

/**
 * Analytics Service - Server-side operations for platform analytics
 *
 * Architecture:
 * - Processes analytics data from Firestore
 * - Aggregates platform-wide statistics
 * - Provides insights into usage patterns
 */
export class AnalyticsService {

  /**
   * Get platform-wide analytics summary
   * @returns {Promise<Object>} Analytics summary with API usage data
   */
  static async getPlatformAnalytics() {
    const startTime = Date.now();
    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║  ANALYTICS SERVICE - GET PLATFORM ANALYTICS                    ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

    try {
      // Fetch all analytics documents
      console.log('[AnalyticsService] 📊 Fetching all analytics data...');
      const analyticsSnapshot = await adminDb.collection('Analytics').get();

      if (analyticsSnapshot.empty) {
        return {
          summary: this._getEmptySummary(),
          apiUsage: this._getEmptyApiUsage(),
          timestamp: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime
        };
      }

      console.log(`[AnalyticsService] 📊 Found ${analyticsSnapshot.size} analytics documents`);

      // Process all analytics documents
      const allAnalytics = [];
      analyticsSnapshot.forEach(doc => {
        try {
          const data = doc.data();
          allAnalytics.push({
            userId: doc.id,
            username: data.username || 'N/A',
            ...data
          });
        } catch (error) {
          console.error(`[AnalyticsService] Error processing analytics document ${doc.id}:`, error);
        }
      });

      // Fetch API usage data (AI and API usage)
      console.log('[AnalyticsService] 💰 Fetching API usage data...');
      const apiUsageData = await this._getPlatformApiUsage();

      // Calculate aggregated statistics
      const summary = this._calculatePlatformSummary(allAnalytics);

      // Get top performers
      const topPerformers = this._getTopPerformers(allAnalytics);

      // Get recent activity
      const recentActivity = this._getRecentActivity(allAnalytics);

      // Calculate trends
      const trends = this._calculateTrends(allAnalytics);

      const processingTime = Date.now() - startTime;

      console.log(`[AnalyticsService] ✅ Analytics processing complete (${processingTime}ms)`);

      return {
        summary,
        apiUsage: apiUsageData,
        topPerformers,
        recentActivity,
        trends,
        timestamp: new Date().toISOString(),
        processingTimeMs: processingTime
      };

    } catch (error) {
      console.error('[AnalyticsService] ❌ Error fetching analytics:', error);
      throw error;
    }
  }

  /**
   * Get analytics for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User analytics
   */
  static async getUserAnalytics(userId) {
    console.log(`[AnalyticsService] 📊 Fetching analytics for user: ${userId}`);

    try {
      const analyticsDoc = await adminDb.collection('Analytics').doc(userId).get();

      if (!analyticsDoc.exists) {
        return {
          found: false,
          userId,
          message: 'No analytics data found for this user'
        };
      }

      const data = analyticsDoc.data();

      return {
        found: true,
        userId,
        username: data.username || 'N/A',
        totalViews: data.totalViews || 0,
        totalClicks: data.totalClicks || 0,
        dailyStats: this._extractDailyStats(data),
        weeklyStats: this._extractWeeklyStats(data),
        monthlyStats: this._extractMonthlyStats(data),
        yearlyStats: this._extractYearlyStats(data),
        linkClicks: this._extractLinkClicks(data),
        trafficSources: this._extractTrafficSources(data),
        deviceStats: this._extractDeviceStats(data),
        referrers: this._extractReferrers(data),
        lastUpdated: data.lastUpdated?.toDate?.()?.toISOString?.() || null
      };

    } catch (error) {
      console.error('[AnalyticsService] ❌ Error fetching user analytics:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS - API Usage
  // ============================================================================

  /**
   * Get platform-wide API usage (AIUsage and ApiUsage)
   * @private
   */
  static async _getPlatformApiUsage() {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      console.log(`[AnalyticsService] 💰 Processing API usage for month: ${currentMonth}`);

      // Get all users from users collection
      const usersSnapshot = await adminDb.collection('users').get();
      const userIds = usersSnapshot.docs.map(doc => doc.id);

      console.log(`[AnalyticsService] 💰 Found ${userIds.length} users to check for usage data`);

      // Fetch AI and API usage for all users in parallel
      const aiUsagePromises = userIds.map(userId =>
        adminDb.collection('AIUsage')
          .doc(userId)
          .collection('monthly')
          .doc(currentMonth)
          .get()
          .then(doc => ({ userId, data: doc.exists ? doc.data() : null }))
          .catch(err => {
            console.error(`Error fetching AIUsage for ${userId}:`, err);
            return { userId, data: null };
          })
      );

      const apiUsagePromises = userIds.map(userId =>
        adminDb.collection('ApiUsage')
          .doc(userId)
          .collection('monthly')
          .doc(currentMonth)
          .get()
          .then(doc => ({ userId, data: doc.exists ? doc.data() : null }))
          .catch(err => {
            console.error(`Error fetching ApiUsage for ${userId}:`, err);
            return { userId, data: null };
          })
      );

      // Fetch SessionUsage data for multi-step operations
      const sessionUsagePromises = userIds.map(userId =>
        adminDb.collection('SessionUsage')
          .doc(userId)
          .collection('sessions')
          .where('status', '==', 'completed')
          .get()
          .then(snapshot => {
            const sessions = snapshot.docs
              .map(doc => doc.data())
              .filter(session => {
                // Filter sessions for current month
                const sessionMonth = session.createdAt?.toDate?.()?.toISOString().slice(0, 7) ||
                                    session.lastUpdatedAt?.toDate?.()?.toISOString().slice(0, 7);
                return sessionMonth === currentMonth;
              });
            return { userId, sessions };
          })
          .catch(err => {
            console.error(`Error fetching SessionUsage for ${userId}:`, err);
            return { userId, sessions: [] };
          })
      );

      const [aiUsageResults, apiUsageResults, sessionUsageResults] = await Promise.all([
        Promise.all(aiUsagePromises),
        Promise.all(apiUsagePromises),
        Promise.all(sessionUsagePromises)
      ]);

      // Aggregate AI usage (with session data)
      const aiUsage = this._aggregateUsageData(aiUsageResults, 'AI', sessionUsageResults);

      // Aggregate API usage (with session data)
      const apiUsage = this._aggregateUsageData(apiUsageResults, 'API', sessionUsageResults);

      // Calculate combined totals
      const combined = {
        totalCost: aiUsage.totalCost + apiUsage.totalCost,
        totalApiCalls: aiUsage.totalApiCalls + apiUsage.totalApiCalls,
        totalOperations: aiUsage.totalRuns + apiUsage.totalRuns,
        averageCostPerOperation: 0
      };

      if (combined.totalOperations > 0) {
        combined.averageCostPerOperation = combined.totalCost / combined.totalOperations;
      }

      console.log(`[AnalyticsService] 💰 API Usage Summary:`, {
        aiCost: `$${aiUsage.totalCost.toFixed(4)}`,
        apiCost: `$${apiUsage.totalCost.toFixed(4)}`,
        totalCost: `$${combined.totalCost.toFixed(4)}`,
        totalCalls: combined.totalApiCalls
      });

      return {
        ai: aiUsage,
        api: apiUsage,
        combined,
        month: currentMonth
      };

    } catch (error) {
      console.error('[AnalyticsService] ❌ Error fetching platform API usage:', error);
      return this._getEmptyApiUsage();
    }
  }

  /**
   * Aggregate usage data from multiple users, including SessionUsage data
   * @private
   */
  static _aggregateUsageData(usageResults, usageType, sessionUsageResults = []) {
    const aggregated = {
      type: usageType,
      totalCost: 0,
      totalRuns: 0,
      totalApiCalls: 0,
      userCount: 0,
      featureBreakdown: {},
      providerBreakdown: {},
      topFeatures: [],
      topProviders: []
    };

    // Process regular usage data (ApiUsage/AIUsage collections)
    usageResults.forEach(({ userId, data }) => {
      if (!data) return;

      aggregated.userCount++;
      aggregated.totalCost += Number(data.totalCost) || 0;
      aggregated.totalRuns += Number(data.totalRuns) || 0;
      aggregated.totalApiCalls += Number(data.totalApiCalls) || 0;

      // Aggregate feature breakdown
      if (data.featureBreakdown) {
        Object.entries(data.featureBreakdown).forEach(([feature, stats]) => {
          if (!aggregated.featureBreakdown[feature]) {
            aggregated.featureBreakdown[feature] = {
              cost: 0,
              apiCalls: 0,
              billableRuns: 0
            };
          }
          aggregated.featureBreakdown[feature].cost += Number(stats.cost) || 0;
          aggregated.featureBreakdown[feature].apiCalls += Number(stats.apiCalls) || 0;
          aggregated.featureBreakdown[feature].billableRuns += Number(stats.billableRuns) || 0;
        });
      }

      // Aggregate provider breakdown
      if (data.providerBreakdown) {
        Object.entries(data.providerBreakdown).forEach(([provider, stats]) => {
          if (!aggregated.providerBreakdown[provider]) {
            aggregated.providerBreakdown[provider] = {
              cost: 0,
              apiCalls: 0,
              billableRuns: 0
            };
          }
          aggregated.providerBreakdown[provider].cost += Number(stats.cost) || 0;
          aggregated.providerBreakdown[provider].apiCalls += Number(stats.apiCalls) || 0;
          aggregated.providerBreakdown[provider].billableRuns += Number(stats.billableRuns) || 0;
        });
      }
    });

    // Process SessionUsage data (multi-step operations)
    console.log(`[AnalyticsService] 📋 Processing ${sessionUsageResults.length} users' session data...`);

    sessionUsageResults.forEach(({ userId, sessions }) => {
      if (!sessions || sessions.length === 0) return;

      console.log(`[AnalyticsService] 📋 User ${userId}: Processing ${sessions.length} sessions`);

      sessions.forEach(session => {
        // NOTE: Do NOT add session.totalCost here - it would be double-counted!
        // Instead, we'll add costs from individual steps that match this usage type
        // Session totalRuns is added only once for the first matching step to avoid double-counting

        let sessionRunsCounted = false; // Track if we've counted this session's runs

        // Process each step in the session
        if (session.steps && Array.isArray(session.steps)) {
          console.log(`[AnalyticsService] 📋 Session has ${session.steps.length} steps`);
          session.steps.forEach((step, stepIndex) => {
            // Only include steps matching the current usage type
            // usageType is 'AI' or 'API', step.usageType is 'AIUsage' or 'ApiUsage'
            // Case-insensitive comparison to handle 'ApiUsage' vs 'APIUsage'
            const expectedUsageType = usageType + 'Usage'; // 'AIUsage' or 'APIUsage'
            const stepUsageType = step.usageType; // From DB: 'AIUsage' or 'ApiUsage'
            const isMatch = stepUsageType?.toLowerCase() === expectedUsageType.toLowerCase();

            // Only log detailed info if it's a match (reduces noise in logs)
            if (!isMatch) {
              return; // Skip silently - this is expected when filtering by usage type
            }

            console.log(`[AnalyticsService] 📋 Step ${stepIndex}: provider=${step.provider}, feature=${step.feature}, usageType=${stepUsageType}`);

            aggregated.totalApiCalls += 1;

            // Add this step's cost to the aggregated total
            const stepCost = Number(step.cost) || 0;
            aggregated.totalCost += stepCost;
            console.log(`[AnalyticsService] ✅ Step ${stepIndex} included - cost: $${stepCost.toFixed(4)}, totalCost now $${aggregated.totalCost.toFixed(4)}, totalApiCalls now ${aggregated.totalApiCalls}`);

            // Add session runs only once per session (to avoid double-counting across usage types)
            if (!sessionRunsCounted) {
              aggregated.totalRuns += Number(session.totalRuns) || 0;
              sessionRunsCounted = true;
              console.log(`[AnalyticsService] 📋 Added session totalRuns: ${session.totalRuns}`);
            }

            // Aggregate by feature
            const feature = step.feature;
            if (!aggregated.featureBreakdown[feature]) {
              aggregated.featureBreakdown[feature] = {
                cost: 0,
                apiCalls: 0,
                billableRuns: 0
              };
            }
            aggregated.featureBreakdown[feature].cost += Number(step.cost) || 0;
            aggregated.featureBreakdown[feature].apiCalls += 1;
            if (step.isBillableRun) {
              aggregated.featureBreakdown[feature].billableRuns += 1;
            }

            // Aggregate by provider
            const provider = step.provider;
            if (!aggregated.providerBreakdown[provider]) {
              aggregated.providerBreakdown[provider] = {
                cost: 0,
                apiCalls: 0,
                billableRuns: 0
              };
            }
            aggregated.providerBreakdown[provider].cost += Number(step.cost) || 0;
            aggregated.providerBreakdown[provider].apiCalls += 1;
            if (step.isBillableRun) {
              aggregated.providerBreakdown[provider].billableRuns += 1;
            }
          });
        }
      });
    });

    // Get top 5 features by cost
    aggregated.topFeatures = Object.entries(aggregated.featureBreakdown)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    // Get top 5 providers by cost
    aggregated.topProviders = Object.entries(aggregated.providerBreakdown)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    // Calculate efficiency metrics
    if (aggregated.totalApiCalls > 0) {
      aggregated.efficiency = aggregated.totalRuns / aggregated.totalApiCalls;
      aggregated.costPerApiCall = aggregated.totalCost / aggregated.totalApiCalls;
    }

    if (aggregated.totalRuns > 0) {
      aggregated.costPerRun = aggregated.totalCost / aggregated.totalRuns;
    }

    return aggregated;
  }

  /**
   * Get empty API usage object
   * @private
   */
  static _getEmptyApiUsage() {
    const emptyUsage = {
      type: '',
      totalCost: 0,
      totalRuns: 0,
      totalApiCalls: 0,
      userCount: 0,
      featureBreakdown: {},
      providerBreakdown: {},
      topFeatures: [],
      topProviders: [],
      efficiency: 0,
      costPerApiCall: 0,
      costPerRun: 0
    };

    return {
      ai: { ...emptyUsage, type: 'AI' },
      api: { ...emptyUsage, type: 'API' },
      combined: {
        totalCost: 0,
        totalApiCalls: 0,
        totalOperations: 0,
        averageCostPerOperation: 0
      },
      month: new Date().toISOString().slice(0, 7)
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS - Platform Analytics
  // ============================================================================

  /**
   * Calculate platform-wide summary statistics
   * @private
   */
  static _calculatePlatformSummary(allAnalytics) {
    const summary = {
      totalUsers: allAnalytics.length,
      activeUsers: 0,
      totalViews: 0,
      totalClicks: 0,
      totalLinks: 0,
      totalEngagement: 0,
      averageViewsPerUser: 0,
      averageClicksPerUser: 0,
      clickThroughRate: 0,
      topTrafficSource: null,
      topDevice: null
    };

    // Aggregate totals
    const trafficSourceTotals = {};
    const deviceTotals = {};
    const today = new Date().toISOString().split('T')[0];

    allAnalytics.forEach(analytics => {
      // Total views and clicks
      summary.totalViews += analytics.totalViews || 0;
      summary.totalClicks += analytics.totalClicks || 0;

      // Count active users (users with activity today)
      const dailyViews = this._extractFieldsByPrefix(analytics, 'dailyViews.');
      if (dailyViews[today] > 0) {
        summary.activeUsers++;
      }

      // Count total links
      const linkClicks = this._extractFieldsByPrefix(analytics, 'linkClicks.');
      const uniqueLinks = new Set();
      Object.keys(linkClicks).forEach(key => {
        const linkId = key.split('.')[0];
        uniqueLinks.add(linkId);
      });
      summary.totalLinks += uniqueLinks.size;

      // Aggregate traffic sources
      const trafficSources = this._extractFieldsByPrefix(analytics, 'trafficSources.');
      Object.keys(trafficSources).forEach(key => {
        const parts = key.split('.');
        if (parts.length >= 2 && parts[1] === 'views') {
          const source = parts[0];
          trafficSourceTotals[source] = (trafficSourceTotals[source] || 0) + trafficSources[key];
        }
      });

      // Aggregate device stats
      const deviceStats = this._extractFieldsByPrefix(analytics, 'deviceStats.');
      Object.keys(deviceStats).forEach(key => {
        const parts = key.split('.');
        if (parts.length >= 2 && parts[1] === 'views') {
          const device = parts[0];
          deviceTotals[device] = (deviceTotals[device] || 0) + deviceStats[key];
        }
      });
    });

    // Calculate averages
    summary.totalEngagement = summary.totalViews + summary.totalClicks;
    summary.averageViewsPerUser = summary.totalUsers > 0
      ? Math.round(summary.totalViews / summary.totalUsers)
      : 0;
    summary.averageClicksPerUser = summary.totalUsers > 0
      ? Math.round(summary.totalClicks / summary.totalUsers)
      : 0;
    summary.clickThroughRate = summary.totalViews > 0
      ? Math.round((summary.totalClicks / summary.totalViews) * 10000) / 100  // 2 decimal places
      : 0;

    // Find top traffic source
    if (Object.keys(trafficSourceTotals).length > 0) {
      const topSource = Object.entries(trafficSourceTotals)
        .sort(([, a], [, b]) => b - a)[0];
      summary.topTrafficSource = {
        name: topSource[0],
        views: topSource[1]
      };
    }

    // Find top device
    if (Object.keys(deviceTotals).length > 0) {
      const topDev = Object.entries(deviceTotals)
        .sort(([, a], [, b]) => b - a)[0];
      summary.topDevice = {
        name: topDev[0],
        views: topDev[1]
      };
    }

    return summary;
  }

  /**
   * Get top performing users
   * @private
   */
  static _getTopPerformers(allAnalytics) {
    return allAnalytics
      .map(a => ({
        userId: a.userId,
        username: a.username,
        totalViews: a.totalViews || 0,
        totalClicks: a.totalClicks || 0,
        totalEngagement: (a.totalViews || 0) + (a.totalClicks || 0)
      }))
      .sort((a, b) => b.totalEngagement - a.totalEngagement)
      .slice(0, 10);  // Top 10
  }

  /**
   * Get recent activity
   * @private
   */
  static _getRecentActivity(allAnalytics) {
    const activities = [];

    allAnalytics.forEach(analytics => {
      if (analytics.lastViewAt) {
        activities.push({
          userId: analytics.userId,
          username: analytics.username,
          type: 'view',
          timestamp: analytics.lastViewAt.toDate?.()?.toISOString?.() || null
        });
      }
      if (analytics.lastClickAt) {
        activities.push({
          userId: analytics.userId,
          username: analytics.username,
          type: 'click',
          timestamp: analytics.lastClickAt.toDate?.()?.toISOString?.() || null
        });
      }
    });

    return activities
      .filter(a => a.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20);  // Last 20 activities
  }

  /**
   * Calculate trends
   * @private
   */
  static _calculateTrends(allAnalytics) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let todayViews = 0;
    let yesterdayViews = 0;
    let todayClicks = 0;
    let yesterdayClicks = 0;

    allAnalytics.forEach(analytics => {
      const dailyViews = this._extractFieldsByPrefix(analytics, 'dailyViews.');
      const dailyClicks = this._extractFieldsByPrefix(analytics, 'dailyClicks.');

      todayViews += dailyViews[todayStr] || 0;
      yesterdayViews += dailyViews[yesterdayStr] || 0;
      todayClicks += dailyClicks[todayStr] || 0;
      yesterdayClicks += dailyClicks[yesterdayStr] || 0;
    });

    return {
      viewsChange: yesterdayViews > 0
        ? Math.round(((todayViews - yesterdayViews) / yesterdayViews) * 100)
        : 0,
      clicksChange: yesterdayClicks > 0
        ? Math.round(((todayClicks - yesterdayClicks) / yesterdayClicks) * 100)
        : 0,
      todayViews,
      yesterdayViews,
      todayClicks,
      yesterdayClicks
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS - User Analytics
  // ============================================================================

  /**
   * Extract daily statistics
   * @private
   */
  static _extractDailyStats(data) {
    const dailyViews = this._extractFieldsByPrefix(data, 'dailyViews.');
    const dailyClicks = this._extractFieldsByPrefix(data, 'dailyClicks.');

    // Get last 30 days
    const stats = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      stats.push({
        date: dateStr,
        views: dailyViews[dateStr] || 0,
        clicks: dailyClicks[dateStr] || 0
      });
    }

    return stats;
  }

  /**
   * Extract weekly statistics
   * @private
   */
  static _extractWeeklyStats(data) {
    const weeklyViews = this._extractFieldsByPrefix(data, 'weeklyViews.');
    const weeklyClicks = this._extractFieldsByPrefix(data, 'weeklyClicks.');

    return Object.keys({ ...weeklyViews, ...weeklyClicks })
      .sort()
      .map(week => ({
        week,
        views: weeklyViews[week] || 0,
        clicks: weeklyClicks[week] || 0
      }));
  }

  /**
   * Extract monthly statistics
   * @private
   */
  static _extractMonthlyStats(data) {
    const monthlyViews = this._extractFieldsByPrefix(data, 'monthlyViews.');
    const monthlyClicks = this._extractFieldsByPrefix(data, 'monthlyClicks.');

    return Object.keys({ ...monthlyViews, ...monthlyClicks })
      .sort()
      .map(month => ({
        month,
        views: monthlyViews[month] || 0,
        clicks: monthlyClicks[month] || 0
      }));
  }

  /**
   * Extract yearly statistics
   * @private
   */
  static _extractYearlyStats(data) {
    const yearlyViews = this._extractFieldsByPrefix(data, 'yearlyViews.');
    const yearlyClicks = this._extractFieldsByPrefix(data, 'yearlyClicks.');

    return Object.keys({ ...yearlyViews, ...yearlyClicks })
      .sort()
      .map(year => ({
        year,
        views: yearlyViews[year] || 0,
        clicks: yearlyClicks[year] || 0
      }));
  }

  /**
   * Extract link clicks data
   * @private
   */
  static _extractLinkClicks(data) {
    const linkClicksData = this._extractFieldsByPrefix(data, 'linkClicks.');
    const links = {};

    Object.keys(linkClicksData).forEach(key => {
      const parts = key.split('.');
      if (parts.length < 2) return;

      const linkId = parts[0];
      const property = parts.slice(1).join('.');

      if (!links[linkId]) {
        links[linkId] = { id: linkId };
      }

      // Handle nested properties
      if (property.includes('.')) {
        const [mainProp, ...subProps] = property.split('.');
        if (!links[linkId][mainProp]) {
          links[linkId][mainProp] = {};
        }
        links[linkId][mainProp][subProps.join('.')] = linkClicksData[key];
      } else {
        links[linkId][property] = linkClicksData[key];
      }
    });

    return Object.values(links);
  }

  /**
   * Extract traffic sources
   * @private
   */
  static _extractTrafficSources(data) {
    const trafficData = this._extractFieldsByPrefix(data, 'trafficSources.');
    const sources = {};

    Object.keys(trafficData).forEach(key => {
      const parts = key.split('.');
      if (parts.length < 2) return;

      const source = parts[0];
      const property = parts[1];

      if (!sources[source]) {
        sources[source] = { name: source };
      }

      sources[source][property] = trafficData[key];
    });

    return Object.values(sources);
  }

  /**
   * Extract device statistics
   * @private
   */
  static _extractDeviceStats(data) {
    const deviceData = this._extractFieldsByPrefix(data, 'deviceStats.');
    const devices = {};

    Object.keys(deviceData).forEach(key => {
      const parts = key.split('.');
      if (parts.length < 2) return;

      const device = parts[0];
      const property = parts[1];

      if (!devices[device]) {
        devices[device] = { name: device };
      }

      devices[device][property] = deviceData[key];
    });

    return Object.values(devices);
  }

  /**
   * Extract referrers
   * @private
   */
  static _extractReferrers(data) {
    const referrerData = this._extractFieldsByPrefix(data, 'referrers.');
    const referrers = {};

    Object.keys(referrerData).forEach(key => {
      const parts = key.split('.');
      if (parts.length < 2) return;

      const referrer = parts[0];
      const property = parts[1];

      if (!referrers[referrer]) {
        referrers[referrer] = { name: referrer };
      }

      referrers[referrer][property] = referrerData[key];
    });

    return Object.values(referrers);
  }

  /**
   * Extract fields by prefix (helper for flattened Firestore structure)
   * @private
   */
  static _extractFieldsByPrefix(data, prefix) {
    const result = {};
    Object.keys(data).forEach(key => {
      if (key.startsWith(prefix)) {
        const cleanKey = key.replace(prefix, '');
        result[cleanKey] = data[key];
      }
    });
    return result;
  }

  /**
   * Get empty summary object
   * @private
   */
  static _getEmptySummary() {
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalViews: 0,
      totalClicks: 0,
      totalLinks: 0,
      totalEngagement: 0,
      averageViewsPerUser: 0,
      averageClicksPerUser: 0,
      clickThroughRate: 0,
      topTrafficSource: null,
      topDevice: null
    };
  }
}
