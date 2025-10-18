// lib/services/serviceAdmin/client/adminServiceSessions.js
// Client-side service for admin session operations

"use client"
import { ContactApiClient } from '@/lib/services/core/ApiClient';

/**
 * Admin Service Sessions - Client-side operations for session usage analytics
 *
 * Architecture:
 * - Handles all session API communication
 * - Uses ContactApiClient for authenticated requests
 * - Provides clean interface for UI components
 * - Includes error handling and logging
 */
export class AdminServiceSessions {

  /**
   * Fetch sessions for a user
   * @param {string} userId - User ID
   * @param {Object} filters - Optional filters { status, limit }
   * @returns {Promise<Object>} { sessions, count, stats }
   */
  static async fetchUserSessions(userId, filters = {}) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { status = 'all', limit = 50 } = filters;

    console.log(`📊 [AdminServiceSessions] Fetching sessions for user: ${userId}`, { status, limit });

    try {
      // Build query parameters
      const params = new URLSearchParams({
        userId,
        status,
        limit: limit.toString()
      });

      const result = await ContactApiClient.get(
        `/api/admin/sessions?${params.toString()}`,
        { timeout: 30000 } // 30 second timeout
      );

      console.log("✅ [AdminServiceSessions] Sessions fetched successfully:", {
        userId,
        count: result.count,
        status,
        limit
      });

      return result;
    } catch (error) {
      console.error("❌ [AdminServiceSessions] Failed to fetch sessions:", error);
      throw error;
    }
  }

  /**
   * Fetch specific session detail
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session object
   */
  static async fetchSessionDetail(userId, sessionId) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    console.log(`📋 [AdminServiceSessions] Fetching session detail: ${sessionId} for user: ${userId}`);

    try {
      const params = new URLSearchParams({ userId });

      const result = await ContactApiClient.get(
        `/api/admin/sessions/${sessionId}?${params.toString()}`,
        { timeout: 30000 }
      );

      console.log("✅ [AdminServiceSessions] Session detail fetched successfully:", {
        sessionId,
        userId
      });

      return result;
    } catch (error) {
      console.error("❌ [AdminServiceSessions] Failed to fetch session detail:", error);
      throw error;
    }
  }

  /**
   * Fetch session statistics
   * @param {string} userId - User ID
   * @param {number} days - Days to look back (default 30)
   * @returns {Promise<Object>} Statistics object
   */
  static async fetchSessionStats(userId, days = 30) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`📊 [AdminServiceSessions] Fetching session stats for user: ${userId} (${days} days)`);

    try {
      const params = new URLSearchParams({
        userId,
        days: days.toString()
      });

      const result = await ContactApiClient.get(
        `/api/admin/sessions/stats?${params.toString()}`,
        { timeout: 30000 }
      );

      console.log("✅ [AdminServiceSessions] Session stats fetched successfully");
      return result;
    } catch (error) {
      console.error("❌ [AdminServiceSessions] Failed to fetch session stats:", error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Format session data for UI display
   * @param {Object} session - Raw session object
   * @returns {Object} Formatted session
   */
  static formatSessionData(session) {
    if (!session) return null;

    return {
      ...session,
      totalCost: Number(session.totalCost) || 0,
      totalRuns: Number(session.totalRuns) || 0,
      formattedCost: this.formatCost(session.totalCost),
      formattedDuration: this.formatDuration(session.createdAt, session.completedAt),
      statusColor: this.getStatusColor(session.status),
      featureDisplay: this.formatFeatureName(session.feature)
    };
  }

  /**
   * Format cost for display
   * @param {number} cost - Cost in dollars
   * @returns {string} Formatted cost
   */
  static formatCost(cost) {
    if (cost === null || cost === undefined) return '$0.00000';
    const numCost = Number(cost);
    if (numCost === 0) return '$0.00000';
    if (numCost < 0.00001) return '<$0.00001';
    return `$${numCost.toFixed(5)}`;
  }

  /**
   * Format duration between timestamps
   * @param {string} startTime - Start timestamp (ISO string)
   * @param {string} endTime - End timestamp (ISO string)
   * @returns {string} Formatted duration
   */
  static formatDuration(startTime, endTime) {
    if (!startTime) return 'N/A';
    if (!endTime) return 'Ongoing';

    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const durationMs = end - start;
      const durationSeconds = durationMs / 1000;

      if (durationSeconds < 60) {
        return `${durationSeconds.toFixed(1)}s`;
      } else if (durationSeconds < 3600) {
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = Math.floor(durationSeconds % 60);
        return `${minutes}m ${seconds}s`;
      } else {
        const hours = Math.floor(durationSeconds / 3600);
        const minutes = Math.floor((durationSeconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
      }
    } catch (error) {
      console.warn('[AdminServiceSessions] Failed to format duration:', error);
      return 'N/A';
    }
  }

  /**
   * Format time for display
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Formatted time
   */
  static formatTime(timestamp) {
    if (!timestamp) return 'N/A';

    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.warn('[AdminServiceSessions] Failed to format time:', error);
      return 'N/A';
    }
  }

  /**
   * Format date for display
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Formatted date
   */
  static formatDate(timestamp) {
    if (!timestamp) return 'N/A';

    try {
      return new Date(timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('[AdminServiceSessions] Failed to format date:', error);
      return 'N/A';
    }
  }

  /**
   * Get status color class
   * @param {string} status - Session status
   * @returns {Object} Color configuration
   */
  static getStatusColor(status) {
    const colors = {
      completed: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-600',
        icon: 'text-green-600'
      },
      'in-progress': {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-600',
        icon: 'text-blue-600'
      },
      abandoned: {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-600',
        icon: 'text-gray-600'
      }
    };

    return colors[status] || colors.abandoned;
  }

  /**
   * Get step border color class
   * @param {boolean} isBillableRun - Whether step is billable
   * @returns {string} CSS class string
   */
  static getStepBorderColor(isBillableRun) {
    if (isBillableRun) {
      return 'border-yellow-400 bg-yellow-50';
    }
    return 'border-gray-300 bg-white';
  }

  /**
   * Format feature name for display
   * @param {string} feature - Feature identifier
   * @returns {string} Formatted name
   */
  static formatFeatureName(feature) {
    if (!feature) return 'Unknown';
    return feature
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Format provider name for display
   * @param {string} provider - Provider identifier
   * @returns {string} Formatted name
   */
  static formatProviderName(provider) {
    if (!provider) return 'Unknown';

    // Handle special cases
    const specialCases = {
      'google_maps': 'Google Maps',
      'google_vision_ocr': 'Google Vision OCR',
      'gemini-2.0-flash': 'Gemini 2.0 Flash',
      'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite'
    };

    if (specialCases[provider]) {
      return specialCases[provider];
    }

    return provider
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Calculate execution time for a step
   * @param {Object} currentStep - Current step object
   * @param {Object} previousStep - Previous step object (if any)
   * @returns {number|null} Execution time in milliseconds, or null if cannot calculate
   */
  static calculateStepExecutionTime(currentStep, previousStep) {
    if (!currentStep || !currentStep.timestamp) return null;
    if (!previousStep || !previousStep.timestamp) return null;

    try {
      const currentTime = new Date(currentStep.timestamp);
      const previousTime = new Date(previousStep.timestamp);
      return currentTime - previousTime;
    } catch (error) {
      console.warn('[AdminServiceSessions] Failed to calculate step execution time:', error);
      return null;
    }
  }

  /**
   * Format execution time for display
   * @param {number} milliseconds - Execution time in milliseconds
   * @returns {string} Formatted execution time
   */
  static formatExecutionTime(milliseconds) {
    if (milliseconds === null || milliseconds === undefined) return 'N/A';
    if (milliseconds < 0) return 'N/A';

    // Less than 1 second
    if (milliseconds < 1000) {
      return `${Math.round(milliseconds)}ms`;
    }

    // Less than 1 minute
    if (milliseconds < 60000) {
      const seconds = (milliseconds / 1000).toFixed(1);
      return `${seconds}s`;
    }

    // 1 minute or more
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.round((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Calculate summary statistics from sessions array
   * @param {Array} sessions - Array of session objects
   * @returns {Object} Summary statistics
   */
  static calculateSummary(sessions) {
    if (!sessions || sessions.length === 0) {
      return {
        totalSessions: 0,
        totalCost: 0,
        totalSteps: 0,
        averageCost: 0,
        completedCount: 0,
        inProgressCount: 0,
        abandonedCount: 0
      };
    }

    const summary = {
      totalSessions: sessions.length,
      totalCost: 0,
      totalSteps: 0,
      averageCost: 0,
      completedCount: 0,
      inProgressCount: 0,
      abandonedCount: 0
    };

    sessions.forEach(session => {
      summary.totalCost += Number(session.totalCost) || 0;
      summary.totalSteps += session.steps?.length || 0;

      if (session.status === 'completed') summary.completedCount++;
      else if (session.status === 'in-progress') summary.inProgressCount++;
      else if (session.status === 'abandoned') summary.abandonedCount++;
    });

    summary.averageCost = summary.totalSessions > 0
      ? summary.totalCost / summary.totalSessions
      : 0;

    return summary;
  }
}
