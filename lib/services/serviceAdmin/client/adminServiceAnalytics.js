// lib/services/serviceAdmin/client/adminServiceAnalytics.js
// Client-side service for admin analytics operations
// Follows the same pattern as RulesGroupService.js

"use client"
import { ContactApiClient } from '@/lib/services/core/ApiClient';

/**
 * Admin Analytics Service - Client-side operations for admin analytics
 *
 * Architecture:
 * - Handles all analytics API communication
 * - Uses ContactApiClient for authenticated requests
 * - Provides clean interface for UI components
 * - Includes error handling and logging
 */
export class AdminServiceAnalytics {

  /**
   * Fetch platform-wide analytics summary
   * @returns {Promise<Object>} Platform analytics data
   */
  static async fetchPlatformAnalytics() {
    console.log("📊 [AdminServiceAnalytics] Fetching platform analytics...");

    try {
      const result = await ContactApiClient.get(
        '/api/admin/analytics',
        { timeout: 30000 } // 30 second timeout
      );

      console.log("✅ [AdminServiceAnalytics] Platform analytics fetched successfully:", {
        totalUsers: result.summary?.totalUsers,
        activeUsers: result.summary?.activeUsers,
        totalViews: result.summary?.totalViews,
        totalClicks: result.summary?.totalClicks
      });

      return result;
    } catch (error) {
      console.error("❌ [AdminServiceAnalytics] Failed to fetch platform analytics:", error);
      throw error;
    }
  }

  /**
   * Fetch analytics for a specific user
   * @param {string} userId - User ID to fetch analytics for
   * @returns {Promise<Object>} User analytics data
   */
  static async fetchUserAnalytics(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`📊 [AdminServiceAnalytics] Fetching analytics for user: ${userId}`);

    try {
      const result = await ContactApiClient.get(
        `/api/admin/analytics/user/${userId}`,
        { timeout: 30000 }
      );

      console.log("✅ [AdminServiceAnalytics] User analytics fetched successfully:", {
        userId,
        username: result.username,
        totalViews: result.totalViews,
        totalClicks: result.totalClicks
      });

      return result;
    } catch (error) {
      console.error("❌ [AdminServiceAnalytics] Failed to fetch user analytics:", error);
      throw error;
    }
  }

  // ============================================================================
  // FUTURE METHODS (COMMENTED OUT - To be implemented step by step)
  // ============================================================================

  /**
   * Fetch analytics for a specific date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Analytics data for date range
   */
  // static async fetchAnalyticsByDateRange(startDate, endDate) {
  //   console.log(`📊 [AdminServiceAnalytics] Fetching analytics for range: ${startDate} to ${endDate}`);
  //
  //   try {
  //     const result = await ContactApiClient.post(
  //       '/api/admin/analytics/range',
  //       { startDate, endDate },
  //       { timeout: 30000 }
  //     );
  //
  //     console.log("✅ [AdminServiceAnalytics] Date range analytics fetched successfully");
  //     return result;
  //   } catch (error) {
  //     console.error("❌ [AdminServiceAnalytics] Failed to fetch date range analytics:", error);
  //     throw error;
  //   }
  // }

  /**
   * Export analytics data
   * @param {Object} filters - Export filters
   * @returns {Promise<Blob>} Export file
   */
  // static async exportAnalytics(filters = {}) {
  //   console.log("📥 [AdminServiceAnalytics] Exporting analytics with filters:", filters);
  //
  //   try {
  //     const result = await ContactApiClient.post(
  //       '/api/admin/analytics/export',
  //       { filters },
  //       {
  //         timeout: 60000,
  //         responseType: 'blob'
  //       }
  //     );
  //
  //     console.log("✅ [AdminServiceAnalytics] Analytics exported successfully");
  //     return result;
  //   } catch (error) {
  //     console.error("❌ [AdminServiceAnalytics] Failed to export analytics:", error);
  //     throw error;
  //   }
  // }

  /**
   * Fetch real-time analytics (websocket or polling)
   * @param {Function} callback - Callback for real-time updates
   * @returns {Function} Cleanup function
   */
  // static subscribeToRealTimeAnalytics(callback) {
  //   console.log("📡 [AdminServiceAnalytics] Subscribing to real-time analytics...");
  //
  //   // Implementation would depend on your real-time infrastructure
  //   // (Firebase Realtime Database, WebSockets, Server-Sent Events, etc.)
  //
  //   // Return cleanup function
  //   return () => {
  //     console.log("📡 [AdminServiceAnalytics] Unsubscribing from real-time analytics");
  //   };
  // }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Format analytics data for display
   * @param {Object} analytics - Raw analytics data
   * @returns {Object} Formatted analytics data
   */
  static formatAnalyticsData(analytics) {
    if (!analytics) return null;

    return {
      ...analytics,
      summary: {
        ...analytics.summary,
        totalUsers: analytics.summary?.totalUsers || 0,
        activeUsers: analytics.summary?.activeUsers || 0,
        totalViews: analytics.summary?.totalViews || 0,
        totalClicks: analytics.summary?.totalClicks || 0,
        totalEngagement: analytics.summary?.totalEngagement || 0,
        clickThroughRate: analytics.summary?.clickThroughRate || 0,
        averageViewsPerUser: analytics.summary?.averageViewsPerUser || 0,
        averageClicksPerUser: analytics.summary?.averageClicksPerUser || 0
      },
      topPerformers: analytics.topPerformers || [],
      recentActivity: analytics.recentActivity || [],
      trends: analytics.trends || {}
    };
  }

  /**
   * Format user analytics data for display
   * @param {Object} userAnalytics - Raw user analytics data
   * @returns {Object} Formatted user analytics data
   */
  static formatUserAnalyticsData(userAnalytics) {
    if (!userAnalytics) return null;

    return {
      ...userAnalytics,
      totalViews: userAnalytics.totalViews || 0,
      totalClicks: userAnalytics.totalClicks || 0,
      totalEngagement: (userAnalytics.totalViews || 0) + (userAnalytics.totalClicks || 0),
      clickThroughRate: userAnalytics.totalViews > 0
        ? Math.round((userAnalytics.totalClicks / userAnalytics.totalViews) * 10000) / 100
        : 0,
      dailyStats: userAnalytics.dailyStats || [],
      weeklyStats: userAnalytics.weeklyStats || [],
      monthlyStats: userAnalytics.monthlyStats || [],
      linkClicks: userAnalytics.linkClicks || [],
      trafficSources: userAnalytics.trafficSources || [],
      deviceStats: userAnalytics.deviceStats || []
    };
  }

  /**
   * Calculate engagement metrics
   * @param {number} views - Total views
   * @param {number} clicks - Total clicks
   * @returns {Object} Calculated metrics
   */
  static calculateEngagementMetrics(views, clicks) {
    return {
      totalEngagement: views + clicks,
      clickThroughRate: views > 0 ? Math.round((clicks / views) * 10000) / 100 : 0,
      engagementRate: views > 0 ? Math.round(((views + clicks) / views) * 100) : 0
    };
  }

  /**
   * Format number with commas
   * @param {number} num - Number to format
   * @returns {string} Formatted number
   */
  static formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString();
  }

  /**
   * Format percentage
   * @param {number} value - Percentage value
   * @returns {string} Formatted percentage
   */
  static formatPercentage(value) {
    if (value === null || value === undefined) return '0%';
    return `${Math.round(value * 100) / 100}%`;
  }

  /**
   * Get trend indicator (up/down/neutral)
   * @param {number} change - Percentage change
   * @returns {Object} Trend indicator
   */
  static getTrendIndicator(change) {
    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
      value: Math.abs(change),
      formatted: `${change > 0 ? '+' : ''}${change}%`,
      icon: change > 0 ? '↑' : change < 0 ? '↓' : '→',
      color: change > 0 ? 'green' : change < 0 ? 'red' : 'gray'
    };
  }
}
