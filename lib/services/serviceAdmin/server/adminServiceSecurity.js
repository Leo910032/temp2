// lib/services/serviceAdmin/server/adminServiceSecurity.js
/**
 * Server-side service for admin security operations
 *
 * Follows the same architecture pattern as:
 * - lib/services/serviceAdmin/server/analyticsService.js
 * - lib/services/serviceAdmin/server/adminService.js
 *
 * This service contains business logic for fetching and processing
 * security-related data from Firestore.
 */

import { adminDb } from '@/lib/firebaseAdmin';

export class AdminServiceSecurity {
  /**
   * Get top-level security logs (platform-wide, no organization context)
   *
   * These logs come from the TopLevelSecurityLogs collection which stores
   * security events that don't have an organization context (e.g., failed
   * login attempts, authentication issues, etc.)
   *
   * @param {Object} filters - Filter options
   * @param {string} filters.severity - Filter by severity level
   * @param {number} filters.limit - Number of logs to return (max 200)
   * @param {string} filters.action - Filter by action type
   * @returns {Promise<Object>} - { logs: Array, count: number }
   */
  static async getTopLevelSecurityLogs(filters = {}) {
    try {
      console.log('🔒 [AdminServiceSecurity] Fetching top-level security logs...');
      console.log('🔒 [AdminServiceSecurity] Filters:', filters);

      const { severity, limit = 50, action } = filters;
      const maxLimit = Math.min(limit, 200);

      // Build Firestore query
      let query = adminDb.collection('TopLevelSecurityLogs');

      // Apply severity filter if specified
      if (severity && severity !== 'ALL') {
        console.log(`🔍 [AdminServiceSecurity] Filtering by severity: ${severity}`);
        query = query.where('severity', '==', severity.toUpperCase());
      }

      // Apply action filter if specified
      if (action && action !== 'ALL') {
        console.log(`🔍 [AdminServiceSecurity] Filtering by action: ${action}`);
        query = query.where('action', '==', action);
      }

      // Order by timestamp (most recent first) and limit
      query = query.orderBy('timestamp', 'desc').limit(maxLimit);

      console.log('📊 [AdminServiceSecurity] Executing query...');
      const snapshot = await query.get();

      console.log(`✅ [AdminServiceSecurity] Query completed. Found ${snapshot.size} logs`);

      // Process logs
      const logs = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          ...data,
          // Ensure timestamp is serializable
          timestamp: data.timestamp?.toDate?.()
            ? data.timestamp.toDate().toISOString()
            : data.timestamp,
          createdAt: data.createdAt?.toDate?.()
            ? data.createdAt.toDate().toISOString()
            : data.createdAt
        });
      });

      console.log('✅ [AdminServiceSecurity] Logs processed successfully');

      // Log severity breakdown
      const severityBreakdown = logs.reduce((acc, log) => {
        acc[log.severity || 'UNKNOWN'] = (acc[log.severity || 'UNKNOWN'] || 0) + 1;
        return acc;
      }, {});
      console.log('📊 [AdminServiceSecurity] Severity breakdown:', severityBreakdown);

      return {
        logs: logs,
        count: logs.length
      };

    } catch (error) {
      console.error('❌ [AdminServiceSecurity] Error fetching security logs:', {
        message: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to fetch security logs: ${error.message}`);
    }
  }

  /**
   * Get security statistics for the dashboard
   *
   * Returns aggregated statistics about security events:
   * - Total logs count
   * - Breakdown by severity
   * - Recent critical/high severity events
   * - Top action types
   *
   * @param {number} days - Number of days to look back (default 30)
   * @returns {Promise<Object>} - Security statistics
   */
  static async getSecurityStats(days = 30) {
    try {
      console.log(`📊 [AdminServiceSecurity] Fetching security stats for last ${days} days...`);

      // Calculate date threshold
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);

      // Fetch all logs in the time range
      const snapshot = await adminDb
        .collection('TopLevelSecurityLogs')
        .where('timestamp', '>=', dateThreshold)
        .get();

      console.log(`✅ [AdminServiceSecurity] Found ${snapshot.size} logs in date range`);

      // Process logs and calculate stats
      const stats = {
        totalLogs: snapshot.size,
        bySeverity: {
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0,
          UNKNOWN: 0
        },
        byAction: {},
        recentCritical: [],
        dateRange: {
          from: dateThreshold.toISOString(),
          to: new Date().toISOString(),
          days: days
        }
      };

      snapshot.forEach(doc => {
        const data = doc.data();

        // Count by severity
        const severity = data.severity || 'UNKNOWN';
        stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;

        // Count by action
        const action = data.action || 'UNKNOWN';
        stats.byAction[action] = (stats.byAction[action] || 0) + 1;

        // Collect recent critical events
        if (severity === 'CRITICAL' && stats.recentCritical.length < 10) {
          stats.recentCritical.push({
            id: doc.id,
            action: data.action,
            timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
            userId: data.userId,
            details: data.details
          });
        }
      });

      // Sort actions by frequency
      stats.topActions = Object.entries(stats.byAction)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      console.log('✅ [AdminServiceSecurity] Security stats calculated:', {
        totalLogs: stats.totalLogs,
        criticalCount: stats.bySeverity.CRITICAL,
        highCount: stats.bySeverity.HIGH,
        topActions: stats.topActions.length
      });

      return stats;

    } catch (error) {
      console.error('❌ [AdminServiceSecurity] Error fetching security stats:', error);
      throw new Error(`Failed to fetch security stats: ${error.message}`);
    }
  }

  /**
   * Get security logs for a specific user across all contexts
   * (both top-level and organization-specific)
   *
   * @param {string} userId - User ID to search for
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - User's security logs
   */
  static async getUserSecurityLogs(userId, options = {}) {
    try {
      console.log(`🔍 [AdminServiceSecurity] Fetching security logs for user: ${userId}`);

      const { limit = 50 } = options;
      const maxLimit = Math.min(limit, 200);

      // Fetch from top-level collection
      const topLevelSnapshot = await adminDb
        .collection('TopLevelSecurityLogs')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(maxLimit)
        .get();

      const logs = [];
      topLevelSnapshot.forEach(doc => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          source: 'top_level',
          ...data,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        });
      });

      // Sort by timestamp
      logs.sort((a, b) => {
        const timeA = new Date(a.timestamp || a.createdAt).getTime();
        const timeB = new Date(b.timestamp || b.createdAt).getTime();
        return timeB - timeA;
      });

      console.log(`✅ [AdminServiceSecurity] Found ${logs.length} logs for user ${userId}`);

      return {
        userId: userId,
        logs: logs.slice(0, maxLimit),
        count: logs.length
      };

    } catch (error) {
      console.error('❌ [AdminServiceSecurity] Error fetching user security logs:', error);
      throw new Error(`Failed to fetch user security logs: ${error.message}`);
    }
  }
}
