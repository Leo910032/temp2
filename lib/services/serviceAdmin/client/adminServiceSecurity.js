// lib/services/serviceAdmin/client/adminServiceSecurity.js
/**
 * Client-side service for admin security operations
 *
 * Follows the same architecture pattern as:
 * - lib/services/serviceAdmin/client/adminServiceAnalytics.js
 * - lib/services/serviceAdmin/client/adminService.js
 *
 * This service handles communication between the UI and the API layer for
 * security-related operations like fetching security logs.
 */

import { ContactApiClient } from '@/lib/services/core/ApiClient';

export class AdminServiceSecurity {
  /**
   * Fetch top-level security logs (platform-wide, no organization context)
   *
   * @param {Object} filters - Filter options
   * @param {string} filters.severity - Severity level filter (ALL, CRITICAL, HIGH, MEDIUM, LOW)
   * @param {number} filters.limit - Number of logs to fetch (default 50)
   * @param {string} filters.action - Action type filter (ALL or specific action)
   * @returns {Promise<Object>} - { logs: Array, timestamp: string }
   * @throws {Error} - If request fails or user is not authorized
   */
  static async fetchTopLevelSecurityLogs(filters = {}) {
    try {
      console.log('🔒 [AdminServiceSecurity] Fetching top-level security logs with filters:', filters);

      // Build query parameters
      const params = new URLSearchParams();
      if (filters.severity && filters.severity !== 'ALL') {
        params.append('severity', filters.severity);
      }
      if (filters.limit) {
        params.append('limit', filters.limit.toString());
      }
      if (filters.action && filters.action !== 'ALL') {
        params.append('action', filters.action);
      }

      const queryString = params.toString();
      const url = `/api/admin/security/logs${queryString ? `?${queryString}` : ''}`;

      console.log('🔒 [AdminServiceSecurity] Fetching from URL:', url);

      // Use ContactApiClient for authenticated requests
      const response = await ContactApiClient.get(url);

      console.log('✅ [AdminServiceSecurity] Security logs fetched successfully:', {
        logCount: response.logs?.length || 0,
        timestamp: response.timestamp
      });

      return response;

    } catch (error) {
      console.error('❌ [AdminServiceSecurity] Error fetching security logs:', {
        message: error.message,
        status: error.status,
        isAuthError: error.isAuthError
      });

      // Re-throw with enhanced error information
      throw error;
    }
  }

  /**
   * Get security statistics for the dashboard
   *
   * @returns {Promise<Object>} - Security statistics
   */
  static async fetchSecurityStats() {
    try {
      console.log('📊 [AdminServiceSecurity] Fetching security statistics...');

      const response = await ContactApiClient.get('/api/admin/security/stats');

      console.log('✅ [AdminServiceSecurity] Security stats fetched successfully');

      return response;

    } catch (error) {
      console.error('❌ [AdminServiceSecurity] Error fetching security stats:', error);
      throw error;
    }
  }

  /**
   * Format security log data for display
   * Helper method for components
   *
   * @param {Array} logs - Raw security logs from API
   * @returns {Array} - Formatted logs
   */
  static formatSecurityLogs(logs) {
    if (!Array.isArray(logs)) return [];

    return logs.map(log => ({
      ...log,
      formattedTimestamp: this._formatTimestamp(log.timestamp || log.createdAt),
      severityLevel: this._getSeverityLevel(log.severity),
      userIdShort: log.userId ? log.userId.substring(0, 12) + '...' : 'anonymous'
    }));
  }

  /**
   * Get severity level number (for sorting/filtering)
   * @private
   */
  static _getSeverityLevel(severity) {
    const levels = {
      'CRITICAL': 4,
      'HIGH': 3,
      'MEDIUM': 2,
      'LOW': 1
    };
    return levels[severity?.toUpperCase()] || 0;
  }

  /**
   * Format timestamp for display
   * @private
   */
  static _formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return 'Invalid date';
    }
  }
}
