"use client"
import { BaseService } from '../abstractions/BaseService';
import { EnterpriseApiClient } from '../core/apiClient';

export class EnhancedAnalyticsService extends BaseService {
  constructor() {
    super('AnalyticsService');
  }

  /**
   * Get aggregated analytics for a specific team.
   * @param {string} teamId The ID of the team.
   * @returns {Promise<object>} The aggregated team analytics data.
   */
  async getTeamAnalytics(teamId) {
    this.validateParams({ teamId }, ['teamId']);
    const endpoint = `/api/enterprise/teams/${teamId}/analytics`;
    
    // Use a short TTL for analytics data to keep it relatively fresh
    return this.cachedRequest(
      'team_analytics',
      () => EnterpriseApiClient.get(endpoint),
      'analytics', // Uses the 30-second TTL from your CacheManager
      { teamId }
    );
  }
   /**
   * ✅ ADD THIS METHOD: Get the current user's own analytics data.
   * @param {string} period The time period for the analytics (e.g., '7d', '30d').
   * @returns {Promise<object>} The user's analytics data.
   */
  async getUserAnalytics(period = '30d') {
    const endpoint = `/api/user/analytics?period=${period}`;
    
    // Use a short TTL for analytics data to keep it relatively fresh
    return this.cachedRequest(
      'user_analytics',
      () => EnterpriseApiClient.get(endpoint),
      'analytics',
      { period } // Add period to cache key to store different time ranges
    );
  }
  /**
   * Get analytics for the currently authenticated user.
   * @param {string} period The time period for the analytics (e.g., '7d', '30d').
   * @returns {Promise<object>} The user's analytics data.
   */
  async getUserAnalytics(period = 'all') {
    // The endpoint can be simple as the user is identified by their auth token
    const endpoint = `/api/user/analytics?period=${period}`;
    
    // Use a short TTL to keep user analytics fresh
    return this.cachedRequest(
      'user_analytics',
      () => EnterpriseApiClient.get(endpoint),
      'analytics', // Uses the 30-second TTL
      { period } // Add period to the cache key
    );
  } 
  /**
   * Get analytics data for another user (impersonation)
   * Requires CAN_VIEW_TEAM_ANALYTICS permission
   */
   async getImpersonatedAnalytics(targetUserId, teamId, period = '30d') {
    this.validateParams({ targetUserId, teamId }, ['targetUserId', 'teamId']);
    const endpoint = `/api/user/analytics/impersonate/${targetUserId}?teamId=${teamId}&period=${period}`;
    return this.cachedRequest(
      'impersonated_analytics',
      () => EnterpriseApiClient.get(endpoint),
      'impersonatedAnalytics',
      { targetUserId, teamId, period }
    );
  }
  
  /**
   * Check if current user can impersonate analytics for a target user
   */
  async canImpersonateAnalytics(targetUserId, teamId) {
    this.validateParams({ targetUserId, teamId }, ['targetUserId', 'teamId']);
    const endpoint = `/api/enterprise/teams/${teamId}/members/${targetUserId}/can-impersonate`;
    return this.cachedRequest(
        `can_impersonate_${targetUserId}_${teamId}`,
        async () => {
            const data = await EnterpriseApiClient.get(endpoint);
            return data.canImpersonate || false;
        },
        'permissions'
    );
  } 
  
  /**
   * Get impersonation history for audit purposes (for managers/owners)
   */
  async getImpersonationAuditLog(teamId, limit = 50) {
    this.validateParams({ teamId }, ['teamId']);
    const endpoint = `/api/enterprise/teams/${teamId}/audit-logs?action=ANALYTICS_IMPERSONATION&limit=${limit}`;
    return this.cachedRequest(
      'audit_log',
      () => EnterpriseApiClient.get(endpoint),
      'permissions',
      { teamId, limit }
    );
  }
}