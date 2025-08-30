"use client"
import { useState, useEffect, useCallback, useRef } from 'react';

// lib/services/serviceEnterprise/client/transitionService.js
// 🚀 TRANSITION SERVICE - Provides missing functions temporarily

import { auth } from '@/important/firebase';

// Import existing working functions from your current service
import {
  getEnterpriseSubscriptionStatus,
  validateEnterpriseOperation,
  hasEnterpriseAccess
} from './enterpriseSubscriptionService';

// ==================== BASIC CACHE ====================
const simpleCache = new Map();
const cacheExpiry = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getCachedData(key) {
  const expiry = cacheExpiry.get(key);
  if (expiry && Date.now() > expiry) {
    simpleCache.delete(key);
    cacheExpiry.delete(key);
    return null;
  }
  return simpleCache.get(key);
}

function setCachedData(key, data) {
  simpleCache.set(key, data);
  cacheExpiry.set(key, Date.now() + CACHE_TTL);
}

// ==================== API HELPERS ====================
async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  const token = await user.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// ==================== CORE FUNCTIONS ====================

/**
 * 🚀 Get user context with caching
 */
export async function getUserContext() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');
  
  const cacheKey = `user_context_${userId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/enterprise/user/context', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch user context');
    }

    const data = await response.json();
    const userContext = data.userContext;
    
    setCachedData(cacheKey, userContext);
    return userContext;
  } catch (error) {
    console.error('Error fetching user context:', error);
    throw error;
  }
}

/**
 * 🚀 Get team members with caching
 */
export async function getTeamMembers(teamId) {
  const cacheKey = `team_members_${teamId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/enterprise/teams/${teamId}/members`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch team members');
    }

    const result = await response.json();
    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching team members:', error);
    throw error;
  }
}

/**
 * 🚀 Get team invitations with caching
 */
export async function getTeamInvitations(teamId) {
  const cacheKey = `team_invitations_${teamId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/enterprise/invitations?teamId=${teamId}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch invitations');
    }

    const data = await response.json();
    const invitations = data.invitations || [];
    
    setCachedData(cacheKey, invitations);
    return invitations;
  } catch (error) {
    console.error('Error fetching team invitations:', error);
    throw error;
  }
}

/**
 * 🚀 Get user teams with caching
 */
export async function getUserTeams() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');
  
  const cacheKey = `user_teams_${userId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/enterprise/teams', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch teams');
    }

    const data = await response.json();
    
    // Convert teams to array format
    let teamsArray = [];
    if (data.teams && typeof data.teams === 'object') {
      teamsArray = Object.keys(data.teams).map(teamId => ({
        id: teamId,
        ...data.teams[teamId]
      }));
    } else if (Array.isArray(data.teams)) {
      teamsArray = data.teams;
    }
    
    const result = {
      ...data,
      teams: teamsArray
    };
    
    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching user teams:', error);
    throw error;
  }
}
// Add these functions to your transitionService.js file

/**
 * Get current user's own analytics data

export async function getCurrentUserAnalytics() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');
  
  const cacheKey = `user_analytics_${userId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/user/analytics', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch analytics');
    }

    const result = await response.json();
    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching current user analytics:', error);
    throw error;
  }
}
 */
/**
 * Get analytics for a team member (using impersonation)
 */
export async function getTeamMemberAnalytics(memberId, teamId, period = '30d') {
  const cacheKey = `member_analytics_${memberId}_${teamId}_${period}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/user/analytics/impersonate/${memberId}?teamId=${teamId}&period=${period}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch member analytics');
    }

    const result = await response.json();
    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching team member analytics:', error);
    throw error;
  }
}

/**
 * Get aggregated team analytics by fetching all member data
 */
export async function getAggregatedTeamAnalytics(teamId, currentUserId) {
  const cacheKey = `team_analytics_aggregated_${teamId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    console.log('Fetching aggregated team analytics for team:', teamId);
    
    // First get team members
    const membersData = await getTeamMembers(teamId);
    const members = membersData.members || [];
    
    if (members.length === 0) {
      return null;
    }

    // Fetch analytics for each member
    const analyticsPromises = members.map(async (member) => {
      try {
        if (member.id === currentUserId) {
          // For current user, get their own analytics
          const analytics = await getCurrentUserAnalytics();
          return {
            userId: member.id,
            member,
            analytics,
            error: null
          };
        } else {
          // For other team members, use impersonation
          const result = await getTeamMemberAnalytics(member.id, teamId, '30d');
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
      const emptyAnalytics = {
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
          errors: analyticsResults.filter(r => r.status === 'rejected').length
        }
      };
      setCachedData(cacheKey, emptyAnalytics, 60000); // Cache for 1 minute
      return emptyAnalytics;
    }

    // Aggregate team analytics
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
    const clickLeaderboard = validAnalytics
      .map(({ member, analytics }) => ({
        ...member,
        totalClicks: analytics.totalClicks || 0,
        todayClicks: analytics.todayClicks || 0,
        yesterdayClicks: analytics.yesterdayClicks || 0,
        thisWeekClicks: analytics.thisWeekClicks || 0
      }))
      .sort((a, b) => b.totalClicks - a.totalClicks)
      .slice(0, 5);

    const viewLeaderboard = validAnalytics
      .map(({ member, analytics }) => ({
        ...member,
        totalViews: analytics.totalViews || 0,
        todayViews: analytics.todayViews || 0,
        yesterdayViews: analytics.yesterdayViews || 0,
        thisWeekViews: analytics.thisWeekViews || 0
      }))
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 5);

    const contactLeaderboard = validAnalytics
      .map(({ member }) => ({
        ...member,
        contactCount: member.contactCount || 0
      }))
      .sort((a, b) => b.contactCount - a.contactCount)
      .slice(0, 5);

    // Get top performing links across the team
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

    const topTeamLinks = allTopLinks
      .sort((a, b) => b.totalClicks - a.totalClicks)
      .slice(0, 10);

    // Aggregate traffic sources across the team
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

    const finalAnalytics = {
      ...teamAnalytics,
      clickLeaderboard,
      viewLeaderboard,
      contactLeaderboard,
      topTeamLinks,
      teamTrafficSources,
      lastUpdated: new Date().toISOString(),
      dataQuality: {
        membersWithData: validAnalytics.length,
        totalMembers: members.length,
        coverage: Math.round((validAnalytics.length / members.length) * 100),
        errors: analyticsResults.filter(r => r.status === 'rejected').length
      }
    };

    console.log('Team analytics aggregated:', {
      totalClicks: finalAnalytics.totalClicks,
      totalViews: finalAnalytics.totalViews,
      memberCount: memberCount,
      coverage: `${finalAnalytics.dataQuality.coverage}%`
    });

    // Cache the result for 2 minutes
    setCachedData(cacheKey, finalAnalytics, 120000);
    return finalAnalytics;

  } catch (error) {
    console.error('Error fetching team analytics:', error);
    throw error;
  }
}
// ==================== TEAM DATA BATCH ====================

/**
 * 🚀 Batch fetch team data (replaces multiple calls)
 */
export async function getTeamData(teamId) {
  console.log('🚀 Fetching team data batch for:', teamId);
  
  try {
    // Parallel fetch of team data
    const [userContext, members, invitations] = await Promise.all([
      getUserContext(),
      getTeamMembers(teamId),
      getTeamInvitations(teamId)
    ]);

    console.log('✅ Team data batch completed:', {
      teamId,
      hasUserContext: !!userContext,
      memberCount: members.members?.length || 0,
      invitationCount: invitations.length || 0
    });

    return {
      userContext,
      members: members.members || [],
      invitations: invitations || [],
      teamInfo: members.teamInfo || {}
    };
  } catch (error) {
    console.error('❌ Error batch fetching team data:', error);
    throw error;
  }
}

// ==================== MUTATION OPERATIONS ====================

/**
 * 🚀 Update member role
 */
export async function updateMemberRole(teamId, memberId, newRole) {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/enterprise/teams/${teamId}/members/${memberId}/role`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ role: newRole })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update member role');
    }

    // Clear related caches
    const patterns = [`team_members_${teamId}`, `user_context_`];
    patterns.forEach(pattern => {
      for (const key of simpleCache.keys()) {
        if (key.includes(pattern)) {
          simpleCache.delete(key);
          cacheExpiry.delete(key);
        }
      }
    });

    return await response.json();
  } catch (error) {
    console.error('Error updating member role:', error);
    throw error;
  }
}

/**
 * 🚀 Remove team member
 */
export async function removeTeamMember(teamId, memberId) {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/enterprise/teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to remove team member');
    }

    // Clear related caches
    const patterns = [`team_members_${teamId}`, `user_teams_`];
    patterns.forEach(pattern => {
      for (const key of simpleCache.keys()) {
        if (key.includes(pattern)) {
          simpleCache.delete(key);
          cacheExpiry.delete(key);
        }
      }
    });

    return await response.json();
  } catch (error) {
    console.error('Error removing team member:', error);
    throw error;
  }
}
export async function createTeam({ name, description }) {
  try {
    // Basic validation on the client-side
    if (!name || !name.trim()) {
      throw new Error('Team name cannot be empty.');
    }

    const headers = await getAuthHeaders();
    const payload = { name, description };

    const response = await fetch('/api/enterprise/teams', { // Assumes a POST endpoint at /api/enterprise/teams
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create the team.');
    }

    // ✅ CRITICAL: Clear caches that are now outdated
    // When a new team is created, the user's list of teams and their context (which includes team roles) has changed.
    console.log('Clearing user_teams and user_context caches after team creation.');
    const patternsToClear = [`user_teams_`, `user_context_`];
    patternsToClear.forEach(pattern => {
      for (const key of simpleCache.keys()) {
        if (key.startsWith(pattern)) {
          simpleCache.delete(key);
          cacheExpiry.delete(key);
        }
      }
    });

    return await response.json();
  } catch (error) {
    console.error('Error creating team:', error);
    throw error; // Re-throw the error so the UI can catch it and display a toast
  }
}

/**
 * 🚀 Invite team member
 */
export async function inviteTeamMember(teamId, invitationData, currentTeamSize = 0) {
  try {
    const email = invitationData.email || invitationData.invitedEmail;
    const role = invitationData.role || 'employee';
    
    if (!email) {
      throw new Error('Email is required for team invitation');
    }
    
    const headers = await getAuthHeaders();
    const payload = {
      teamId,
      invitedEmail: email,
      role: role
    };
    
    const response = await fetch(`/api/enterprise/invitations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send invitation');
    }

    // Clear invitation caches
    const patterns = [`team_invitations_${teamId}`];
    patterns.forEach(pattern => {
      for (const key of simpleCache.keys()) {
        if (key.includes(pattern)) {
          simpleCache.delete(key);
          cacheExpiry.delete(key);
        }
      }
    });

    return await response.json();
  } catch (error) {
    console.error('Error sending team invitation:', error);
    throw error;
  }
}

/**
 * 🚀 Resend invitation
 */
export async function resendInvitation(invitationId) {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/enterprise/invitations', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        invitationId,
        action: 'resend'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to resend invitation');
    }

    // Clear invitation caches
    for (const key of simpleCache.keys()) {
      if (key.includes('team_invitations_')) {
        simpleCache.delete(key);
        cacheExpiry.delete(key);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Error resending invitation:', error);
    throw error;
  }
}
// Add these functions to your transitionService.js or optimizedEnterpriseService.js

/**
 * Get current user's own analytics data
 */
export async function getCurrentUserAnalytics() {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/user/analytics', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch analytics');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching current user analytics:', error);
    throw error;
  }
}

/**
 * Get analytics for a team member (using impersonation)

export async function getTeamMemberAnalytics(memberId, teamId, period = '30d') {
  const cacheKey = `member_analytics_${memberId}_${teamId}_${period}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/user/analytics/impersonate/${memberId}?teamId=${teamId}&period=${period}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch member analytics');
    }

    const result = await response.json();
    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching team member analytics:', error);
    throw error;
  }
}
 */
/**
 * Get aggregated team analytics by fetching all member data
 */
export async function getTeamAnalytics(teamId, currentUserId) {
  const cacheKey = `team_analytics_${teamId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    console.log('Fetching team analytics for team:', teamId);
    
    // First get team members
    const membersData = await getTeamMembers(teamId);
    const members = membersData.members || [];
    
    if (members.length === 0) {
      return null;
    }

    // Fetch analytics for each member
    const analyticsPromises = members.map(async (member) => {
      try {
        if (member.id === currentUserId) {
          // For current user, get their own analytics
          const analytics = await getCurrentUserAnalytics();
          return {
            userId: member.id,
            member,
            analytics,
            error: null
          };
        } else {
          // For other team members, use impersonation
          const result = await getTeamMemberAnalytics(member.id, teamId, '30d');
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
      const emptyAnalytics = {
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
          errors: analyticsResults.filter(r => r.status === 'rejected').length
        }
      };
      setCachedData(cacheKey, emptyAnalytics, 60000); // Cache for 1 minute
      return emptyAnalytics;
    }

    // Aggregate team analytics
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
    const clickLeaderboard = validAnalytics
      .map(({ member, analytics }) => ({
        ...member,
        totalClicks: analytics.totalClicks || 0,
        todayClicks: analytics.todayClicks || 0,
        yesterdayClicks: analytics.yesterdayClicks || 0,
        thisWeekClicks: analytics.thisWeekClicks || 0
      }))
      .sort((a, b) => b.totalClicks - a.totalClicks)
      .slice(0, 5);

    const viewLeaderboard = validAnalytics
      .map(({ member, analytics }) => ({
        ...member,
        totalViews: analytics.totalViews || 0,
        todayViews: analytics.todayViews || 0,
        yesterdayViews: analytics.yesterdayViews || 0,
        thisWeekViews: analytics.thisWeekViews || 0
      }))
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 5);

    const contactLeaderboard = validAnalytics
      .map(({ member }) => ({
        ...member,
        contactCount: member.contactCount || 0
      }))
      .sort((a, b) => b.contactCount - a.contactCount)
      .slice(0, 5);

    // Get top performing links across the team
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

    const topTeamLinks = allTopLinks
      .sort((a, b) => b.totalClicks - a.totalClicks)
      .slice(0, 10);

    // Aggregate traffic sources across the team
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

    const finalAnalytics = {
      ...teamAnalytics,
      clickLeaderboard,
      viewLeaderboard,
      contactLeaderboard,
      topTeamLinks,
      teamTrafficSources,
      lastUpdated: new Date().toISOString(),
      dataQuality: {
        membersWithData: validAnalytics.length,
        totalMembers: members.length,
        coverage: Math.round((validAnalytics.length / members.length) * 100),
        errors: analyticsResults.filter(r => r.status === 'rejected').length
      }
    };

    console.log('Team analytics aggregated:', {
      totalClicks: finalAnalytics.totalClicks,
      totalViews: finalAnalytics.totalViews,
      memberCount: memberCount,
      coverage: `${finalAnalytics.dataQuality.coverage}%`
    });

    // Cache the result for 2 minutes
    setCachedData(cacheKey, finalAnalytics, 120000);
    return finalAnalytics;

  } catch (error) {
    console.error('Error fetching team analytics:', error);
    throw error;
  }
} 

/**
 * 🚀 Revoke invitation
 */
export async function revokeInvitation(invitationId) {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/enterprise/invitations?invitationId=${invitationId}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to revoke invitation');
    }

    // Clear invitation caches
    for (const key of simpleCache.keys()) {
      if (key.includes('team_invitations_')) {
        simpleCache.delete(key);
        cacheExpiry.delete(key);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Error revoking invitation:', error);
    throw error;
  }
}

/**
 * 🚀 Bulk resend invitations
 */
export async function bulkResendInvitations(invitationIds) {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/enterprise/invitations/bulk', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        invitationIds,
        action: 'resend'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to bulk resend invitations');
    }

    // Clear invitation caches
    for (const key of simpleCache.keys()) {
      if (key.includes('team_invitations_')) {
        simpleCache.delete(key);
        cacheExpiry.delete(key);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Error bulk resending invitations:', error);
    throw error;
  }
}

/**
 * 🚀 Bulk revoke invitations
 */
export async function bulkRevokeInvitations(invitationIds) {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/enterprise/invitations/bulk', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({
        invitationIds
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to bulk revoke invitations');
    }

    // Clear invitation caches
    for (const key of simpleCache.keys()) {
      if (key.includes('team_invitations_')) {
        simpleCache.delete(key);
        cacheExpiry.delete(key);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Error bulk revoking invitations:', error);
    throw error;
  }
}

// ==================== REACT HOOK ====================

/**
 * 🚀 REACT HOOK: useEnterpriseData
 */
export function useEnterpriseData() {
  const [data, setData] = useState({
    teams: [],
    userRole: null,
    organizationId: null,
    organizationName: null,
    hasAccess: false,
    subscriptionLevel: null,
    features: [],
    limits: {},
    userContext: null,
    loading: true,
    error: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 Fetching enterprise data...');
      
      // Parallel fetch of core data
      const [subscriptionStatus, userContext, teamsData] = await Promise.all([
        getEnterpriseSubscriptionStatus(),
        getUserContext().catch(err => {
          console.warn('User context fetch failed:', err.message);
          return null;
        }),
        getUserTeams().catch(err => {
          console.warn('Teams fetch failed:', err.message);
          return { teams: [] };
        })
      ]);
      
      // Determine user role
      let effectiveUserRole = 'employee';
      
      if (userContext) {
        const roleHierarchy = { owner: 4, manager: 3, team_lead: 2, employee: 1 };
        const teamRoles = Object.values(userContext.teams || {}).map(team => team.role).filter(Boolean);
        
        if (teamRoles.length > 0) {
          effectiveUserRole = teamRoles.reduce((highest, currentRole) => {
            const currentValue = roleHierarchy[currentRole] || 0;
            const highestValue = roleHierarchy[highest] || 0;
            return currentValue > highestValue ? currentRole : highest;
          }, 'employee');
        }
        
        if (userContext.organizationRole && userContext.organizationRole !== 'employee') {
          const orgRoleValue = roleHierarchy[userContext.organizationRole] || 0;
          const teamRoleValue = roleHierarchy[effectiveUserRole] || 0;
          if (orgRoleValue > teamRoleValue) {
            effectiveUserRole = userContext.organizationRole;
          }
        }
      }
      
      console.log('✅ Enterprise data fetched:', {
        hasAccess: subscriptionStatus?.hasEnterpriseAccess || false,
        teamsCount: teamsData.teams?.length || 0,
        subscriptionLevel: subscriptionStatus?.accountType || 'free',
        effectiveUserRole,
        hasUserContext: !!userContext
      });
      
      setData({
        teams: Array.isArray(teamsData.teams) ? teamsData.teams : [],
        userRole: effectiveUserRole,
        organizationId: subscriptionStatus?.organization?.id || teamsData.organizationId,
        organizationName: subscriptionStatus?.organization?.name || teamsData.organizationName,
        hasAccess: subscriptionStatus?.hasEnterpriseAccess || false,
        subscriptionLevel: subscriptionStatus?.accountType || 'free',
        features: subscriptionStatus?.enterpriseFeatures || [],
        limits: subscriptionStatus?.limits || {},
        userContext: userContext,
        canUpgrade: subscriptionStatus?.canUpgrade || false,
        nextTier: subscriptionStatus?.nextTier,
        upgradeMessage: subscriptionStatus?.upgradeMessage
      });
    } catch (err) {
      console.error('❌ Enterprise data fetch error:', err);
      setError(err.message);
      setData(prevData => ({
        ...prevData,
        teams: [],
        hasAccess: false,
        loading: false,
        error: err.message
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      fetchData();
    } else {
      setData({
        teams: [],
        userRole: null,
        organizationId: null,
        organizationName: null,
        hasAccess: false,
        subscriptionLevel: null,
        features: [],
        limits: {},
        userContext: null,
        loading: false,
        error: null
      });
      setLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchData();
      } else {
        // Clear cache on logout
        simpleCache.clear();
        cacheExpiry.clear();
        setData({
          teams: [],
          userRole: null,
          organizationId: null,
          organizationName: null,
          hasAccess: false,
          subscriptionLevel: null,
          features: [],
          limits: {},
          userContext: null,
          loading: false,
          error: null
        });
        setLoading(false);
        setError(null);
      }
    });

    return unsubscribe;
  }, [fetchData]);

  return {
    ...data,
    loading,
    error,
    refetch: fetchData,
    hasFeature: (feature) => data.features.includes(feature),
    canPerformAction: (action, context = {}) => {
      const validation = validateEnterpriseOperation(
        action,
        data.userRole,
        data.subscriptionLevel,
        context
      );
      return validation.allowed;
    }
  };
}

/**
 * 🚀 REACT HOOK: useOptimizedTeamData  
 */
export function useOptimizedTeamData(teamId) {
  const [teamData, setTeamData] = useState({
    userContext: null,
    members: [],
    invitations: [],
    teamInfo: {},
    loading: true,
    error: null,
    lastUpdated: null
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetchTeamData = useCallback(async () => {
    if (!teamId || !auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 Fetching team data for:', teamId);
      
      // Use the batch function
      const batchResult = await getTeamData(teamId);
      
      if (!mountedRef.current) return;
      
      console.log('✅ Team data loaded:', {
        teamId,
        memberCount: batchResult.members?.length || 0,
        invitationCount: batchResult.invitations?.length || 0
      });
      
      setTeamData({
        userContext: batchResult.userContext,
        members: batchResult.members || [],
        invitations: batchResult.invitations || [],
        teamInfo: batchResult.teamInfo || {},
        loading: false,
        error: null,
        lastUpdated: new Date().toISOString()
      });
      
    } catch (err) {
      console.error('❌ Team data fetch error:', err);
      
      if (!mountedRef.current) return;
      
      setError(err.message);
      setTeamData(prevData => ({
        ...prevData,
        loading: false,
        error: err.message,
        lastUpdated: new Date().toISOString()
      }));
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [teamId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchTeamData();
    
    return () => {
      mountedRef.current = false;
    };
  }, [fetchTeamData]);

  return {
    ...teamData,
    loading,
    error,
    refetch: fetchTeamData,
    
    // Helper functions
    getMember: (memberId) => teamData.members.find(m => m.id === memberId),
    getInvitation: (inviteId) => teamData.invitations.find(i => i.id === inviteId),
    
    // Statistics
    stats: {
      totalMembers: teamData.members.length,
      totalInvitations: teamData.invitations.length,
      expiredInvitations: teamData.invitations.filter(i => {
        const expiresAt = new Date(i.expiresAt?.toDate ? i.expiresAt.toDate() : i.expiresAt);
        return new Date() > expiresAt;
      }).length
    }
  };
}

// ==================== PLACEHOLDER FUNCTIONS ====================



// ==================== EXISTING EXPORTS ====================
export { 
  hasEnterpriseAccess,
  validateEnterpriseOperation,
  getEnterpriseSubscriptionStatus
} from './enterpriseSubscriptionService';