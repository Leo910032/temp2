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
  // lib/services/serviceEnterprise/client/services/EnhancedAnalyticsService.js
// Add these methods to the existing EnhancedAnalyticsService class

// ==================== MISSING METHODS FROM TRANSITION SERVICE ====================

/**
 * Get current user's own analytics data
 */
async getCurrentUserAnalytics(period = 'all') {
  const endpoint = `/api/user/analytics?period=${period}`;
  
  return this.cachedRequest(
    'current_user_analytics',
    () => EnterpriseApiClient.get(endpoint),
    'analytics',
    { period }
  );
}

/**
 * Get analytics for a team member (using impersonation)
 */
async getTeamMemberAnalytics(memberId, teamId, period = '30d') {
  this.validateParams({ memberId, teamId }, ['memberId', 'teamId']);
  
  const endpoint = `/api/user/analytics/impersonate/${memberId}?teamId=${teamId}&period=${period}`;
  
  return this.cachedRequest(
    'team_member_analytics',
    () => EnterpriseApiClient.get(endpoint),
    'analytics',
    { memberId, teamId, period }
  );
}

/**
 * Get aggregated team analytics by fetching all member data
 */
async getAggregatedTeamAnalytics(teamId, currentUserId) {
  this.validateParams({ teamId, currentUserId }, ['teamId', 'currentUserId']);
  
  return this.cachedRequest(
    'aggregated_team_analytics',
    async () => {
      console.log('Fetching aggregated team analytics for team:', teamId);
      
      // Get team service
      const { ServiceFactory } = await import('../factories/ServiceFactory');
      const teamService = ServiceFactory.getTeamService();
      
      // First get team members
      const membersData = await teamService.getTeamMembers(teamId);
      const members = membersData.members || [];
      
      if (members.length === 0) {
        return this.getEmptyAnalytics(members);
      }

      // Fetch analytics for each member
      const analyticsPromises = members.map(async (member) => {
        try {
          if (member.id === currentUserId) {
            // For current user, get their own analytics
            const analytics = await this.getCurrentUserAnalytics();
            return {
              userId: member.id,
              member,
              analytics,
              error: null
            };
          } else {
            // For other team members, use impersonation
            const result = await this.getTeamMemberAnalytics(member.id, teamId, '30d');
            return {
              userId: member.id,
              member,
              analytics: result.analytics || result,
              error: null
            };
          }
        } catch (error) {
          console.error(`Failed to fetch analytics for member ${member.id}:`, error);
          return {
            userId: member.id,
            member,
            analytics: null,
            error: error.message
          };
        }
      });

      // Wait for all analytics to be fetched
      const analyticsResults = await Promise.allSettled(analyticsPromises);
      
      // Process successful results
      const validAnalytics = analyticsResults
        .filter(result => result.status === 'fulfilled' && result.value.analytics)
        .map(result => result.value);

      console.log(`Successfully fetched analytics for ${validAnalytics.length}/${members.length} members`);

      if (validAnalytics.length === 0) {
        return this.getEmptyAnalytics(members);
      }

      // Aggregate team analytics
      const teamAnalytics = this.aggregateAnalyticsData(validAnalytics);
      
      // Add metadata
      teamAnalytics.lastUpdated = new Date().toISOString();
      teamAnalytics.dataQuality = {
        membersWithData: validAnalytics.length,
        totalMembers: members.length,
        coverage: Math.round((validAnalytics.length / members.length) * 100),
        errors: analyticsResults.filter(r => r.status === 'rejected').length
      };

      console.log('Team analytics aggregated:', {
        totalClicks: teamAnalytics.totalClicks,
        totalViews: teamAnalytics.totalViews,
        memberCount: validAnalytics.length,
        coverage: `${teamAnalytics.dataQuality.coverage}%`
      });

      return teamAnalytics;
    },
    'analytics',
    { teamId, currentUserId }
  );
}

/**
 * Helper: Get empty analytics structure
 */
getEmptyAnalytics(members) {
  return {
    totalClicks: 0,
    totalViews: 0,
    totalContacts: 0,
    todayClicks: 0,
    todayViews: 0,
    yesterdayClicks: 0,
    yesterdayViews: 0,
    thisWeekClicks: 0,
    thisWeekViews: 0,
    thisMonthClicks: 0,
    thisMonthViews: 0,
    avgClicksPerMember: 0,
    avgViewsPerMember: 0,
    avgContactsPerMember: 0,
    clickLeaderboard: [],
    viewLeaderboard: [],
    contactLeaderboard: [],
    topTeamLinks: [],
    teamTrafficSources: {},
    dataQuality: {
      membersWithData: 0,
      totalMembers: members.length,
      coverage: 0,
      errors: 0
    }
  };
}

/**
 * Helper: Aggregate analytics data from multiple members
 */
aggregateAnalyticsData(validAnalytics) {
  const teamAnalytics = {
    totalClicks: 0,
    totalViews: 0,
    totalContacts: 0,
    todayClicks: 0,
    todayViews: 0,
    yesterdayClicks: 0,
    yesterdayViews: 0,
    thisWeekClicks: 0,
    thisWeekViews: 0,
    thisMonthClicks: 0,
    thisMonthViews: 0,
    memberAnalytics: validAnalytics
  };

  // Sum up the analytics
  validAnalytics.forEach(({ member, analytics }) => {
    teamAnalytics.totalClicks += analytics.totalClicks || 0;
    teamAnalytics.totalViews += analytics.totalViews || 0;
    teamAnalytics.todayClicks += analytics.todayClicks || 0;
    teamAnalytics.todayViews += analytics.todayViews || 0;
    teamAnalytics.yesterdayClicks += analytics.yesterdayClicks || 0;
    teamAnalytics.yesterdayViews += analytics.yesterdayViews || 0;
    teamAnalytics.thisWeekClicks += analytics.thisWeekClicks || 0;
    teamAnalytics.thisWeekViews += analytics.thisWeekViews || 0;
    teamAnalytics.thisMonthClicks += analytics.thisMonthClicks || 0;
    teamAnalytics.thisMonthViews += analytics.thisMonthViews || 0;
    
    // For contacts, use member data if available
    const memberContacts = member.contactCount || 0;
    teamAnalytics.totalContacts += memberContacts;
  });

  // Calculate averages
  const memberCount = validAnalytics.length;
  teamAnalytics.avgClicksPerMember = memberCount > 0 ? Math.round(teamAnalytics.totalClicks / memberCount) : 0;
  teamAnalytics.avgViewsPerMember = memberCount > 0 ? Math.round(teamAnalytics.totalViews / memberCount) : 0;
  teamAnalytics.avgContactsPerMember = memberCount > 0 ? Math.round(teamAnalytics.totalContacts / memberCount) : 0;

  // Create comprehensive leaderboards
  teamAnalytics.clickLeaderboard = this.createLeaderboard(validAnalytics, 'clicks');
  teamAnalytics.viewLeaderboard = this.createLeaderboard(validAnalytics, 'views');
  teamAnalytics.contactLeaderboard = this.createLeaderboard(validAnalytics, 'contacts');

  // Get top performing links across the team
  teamAnalytics.topTeamLinks = this.getTopTeamLinks(validAnalytics);

  // Aggregate traffic sources across the team
  teamAnalytics.teamTrafficSources = this.getTeamTrafficSources(validAnalytics);

  return teamAnalytics;
}

/**
 * Helper: Create leaderboard for specific metric
 */
createLeaderboard(validAnalytics, type) {
  const getMetricValue = (analytics, metric) => {
    switch (metric) {
      case 'clicks': return analytics.totalClicks || 0;
      case 'views': return analytics.totalViews || 0;
      case 'contacts': return analytics.member?.contactCount || 0;
      default: return 0;
    }
  };

  return validAnalytics
    .map(({ member, analytics }) => ({
      ...member,
      [`total${type.charAt(0).toUpperCase() + type.slice(1, -1)}`]: getMetricValue(analytics, type),
      [`today${type.charAt(0).toUpperCase() + type.slice(1, -1)}`]: 
        type === 'contacts' ? 0 : (analytics[`today${type.charAt(0).toUpperCase() + type.slice(1, -1)}`] || 0),
      [`yesterday${type.charAt(0).toUpperCase() + type.slice(1, -1)}`]: 
        type === 'contacts' ? 0 : (analytics[`yesterday${type.charAt(0).toUpperCase() + type.slice(1, -1)}`] || 0),
      [`thisWeek${type.charAt(0).toUpperCase() + type.slice(1, -1)}`]: 
        type === 'contacts' ? 0 : (analytics[`thisWeek${type.charAt(0).toUpperCase() + type.slice(1, -1)}`] || 0)
    }))
    .sort((a, b) => getMetricValue(b, type) - getMetricValue(a, type))
    .slice(0, 5);
}

/**
 * Helper: Get top team links
 */
getTopTeamLinks(validAnalytics) {
  const allTopLinks = [];
  
  validAnalytics.forEach(({ member, analytics }) => {
    if (analytics.topLinks && analytics.topLinks.length > 0) {
      analytics.topLinks.forEach(link => {
        allTopLinks.push({
          ...link,
          ownerName: member.displayName || member.email,
          ownerId: member.id
        });
      });
    }
  });

  return allTopLinks
    .sort((a, b) => (b.totalClicks || 0) - (a.totalClicks || 0))
    .slice(0, 10);
}

/**
 * Helper: Get team traffic sources
 */
getTeamTrafficSources(validAnalytics) {
  const teamTrafficSources = {};
  
  validAnalytics.forEach(({ analytics }) => {
    if (analytics.trafficSources) {
      Object.entries(analytics.trafficSources).forEach(([source, data]) => {
        if (!teamTrafficSources[source]) {
          teamTrafficSources[source] = {
            clicks: 0,
            views: 0,
            medium: data.medium || 'unknown'
          };
        }
        teamTrafficSources[source].clicks += data.clicks || 0;
        teamTrafficSources[source].views += data.views || 0;
      });
    }
  });

  return teamTrafficSources;
} 
}