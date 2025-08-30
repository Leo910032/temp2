"use client"

// lib/services/serviceEnterprise/client/optimizedEnterpriseService.js
// 🚀 HIGHLY OPTIMIZED VERSION with request deduplication and smart caching

import { auth } from '@/important/firebase';

// ==================== ADVANCED CACHING & DEDUPLICATION ====================

class AdvancedEnterpriseCache {
  constructor() {
    this.cache = new Map();
    this.expirationTimes = new Map();
    this.pendingRequests = new Map(); // 🔥 NEW: Request deduplication
    this.stats = { hits: 0, misses: 0, deduplicated: 0 };
    
    // 🔥 LONGER TTL for better performance
    this.ttlConfig = {
      userContext: 10 * 60 * 1000,    // 10 minutes - user data changes rarely
      subscriptionStatus: 15 * 60 * 1000, // 15 minutes - subscription rarely changes
      teamData: 5 * 60 * 1000,        // 5 minutes - team data changes moderately
      teamMembers: 2 * 60 * 1000,     // 2 minutes - member list changes frequently
      invitations: 1 * 60 * 1000,     // 1 minute - invitations change frequently
      permissions: 5 * 60 * 1000,     // 5 minutes - permissions change rarely
      batchData: 2 * 60 * 1000,       // 2 minutes - batch operations
      impersonatedAnalytics: 30 * 1000 // 30 seconds - analytics change frequently
    };
  }
  
  // 🔥 NEW: Request deduplication - prevent multiple identical requests
  async getOrFetch(key, fetchFn, category = 'default') {
    // Check cache first
    const cached = this.get(key);
    if (cached) {
      this.stats.hits++;
      return cached;
    }

    // Check if request is already pending
    if (this.pendingRequests.has(key)) {
      console.log(`🔄 Deduplicating request: ${key}`);
      this.stats.deduplicated++;
      return await this.pendingRequests.get(key);
    }

    // Create new request
    console.log(`🌐 New API call: ${key}`);
    this.stats.misses++;
    
    const requestPromise = fetchFn().then(result => {
      // Cache the result
      const ttl = this.ttlConfig[category] || this.ttlConfig.default || (5 * 60 * 1000);
      this.set(key, result, ttl);
      
      // Remove from pending requests
      this.pendingRequests.delete(key);
      
      return result;
    }).catch(error => {
      // Remove from pending requests on error
      this.pendingRequests.delete(key);
      throw error;
    });

    // Store pending request
    this.pendingRequests.set(key, requestPromise);
    
    return await requestPromise;
  }

  set(key, value, ttl = 5 * 60 * 1000) {
    this.cache.set(key, value);
    this.expirationTimes.set(key, Date.now() + ttl);
  }

  get(key) {
    const expirationTime = this.expirationTimes.get(key);
    
    if (!expirationTime || Date.now() > expirationTime) {
      this.cache.delete(key);
      this.expirationTimes.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }

  invalidate(pattern) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.expirationTimes.delete(key);
      this.pendingRequests.delete(key); // 🔥 Also clear pending requests
    });
    
    console.log(`🧹 Invalidated ${keysToDelete.length} cache entries for: ${pattern}`);
  }

  clear() {
    this.cache.clear();
    this.expirationTimes.clear();
    this.pendingRequests.clear();
    this.stats = { hits: 0, misses: 0, deduplicated: 0 };
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(1) + '%' : '0%',
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size
    };
  }

  // ✅ NEW: Method to update stats for specific operations
  updateOperationStats(operation, duration, success = true) {
    if (!this.operationStats) {
      this.operationStats = {};
    }
    
    if (!this.operationStats[operation]) {
      this.operationStats[operation] = {
        count: 0,
        totalDuration: 0,
        successCount: 0,
        errorCount: 0,
        avgDuration: 0
      };
    }
    
    const opStats = this.operationStats[operation];
    opStats.count++;
    opStats.totalDuration += duration;
    
    if (success) {
      opStats.successCount++;
    } else {
      opStats.errorCount++;
    }
    
    opStats.avgDuration = Math.round(opStats.totalDuration / opStats.count);
    
    console.log(`📊 ${operation}: ${duration}ms (avg: ${opStats.avgDuration}ms, success: ${opStats.successCount}/${opStats.count})`);
  }
}

// Global cache instance
const cache = new AdvancedEnterpriseCache();

// ==================== AUTH HELPERS ====================

const getAuthHeaders = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  const token = await user.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// ✅ FIXED: Define the updateCacheStats function
const updateCacheStats = (operation, duration, success = true) => {
  cache.updateOperationStats(operation, duration, success);
};

/**
 * ========================================
 * ANALYTICS IMPERSONATION FUNCTIONS
 * ========================================
 */



// ==================== OPTIMIZED CORE FUNCTIONS ====================

/**
 * 🚀 OPTIMIZED: Get user context with aggressive caching
 */
export async function getUserContext() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');
  
  const cacheKey = `user_context_${userId}`;
  
  return await cache.getOrFetch(
    cacheKey,
    async () => {
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
      return data.userContext;
    },
    'userContext'
  );
}

/**
 * 🚀 OPTIMIZED: Get subscription status with long-term caching
 */
export async function getEnterpriseSubscriptionStatus() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');
  
  const cacheKey = `subscription_status_${userId}`;
  
  return await cache.getOrFetch(
    cacheKey,
    async () => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/enterprise/subscription/status', {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get subscription status');
      }

      return await response.json();
    },
    'subscriptionStatus'
  );
}

/**
 * 🚀 OPTIMIZED: Get team members with smart caching
 */
export async function getTeamMembers(teamId) {
  const cacheKey = `team_members_${teamId}`;
  
  return await cache.getOrFetch(
    cacheKey,
    async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/enterprise/teams/${teamId}/members`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch team members');
      }

      return await response.json();
    },
    'teamMembers'
  );
}

/**
 * 🚀 OPTIMIZED: Get team invitations with smart caching
 */
export async function getTeamInvitations(teamId) {
  const cacheKey = `team_invitations_${teamId}`;
  
  return await cache.getOrFetch(
    cacheKey,
    async () => {
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
      return data.invitations || [];
    },
    'invitations'
  );
}
/**
 * 🚀 OPTIMIZED: Get user teams with enhanced caching
 */
export async function getUserTeams() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');
  
  const cacheKey = `user_teams_${userId}`;
  
  return await cache.getOrFetch(
    cacheKey,
    async () => {
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
      
      // Transform teams object to array for consistency
      let teamsArray = [];
      if (data.teams && typeof data.teams === 'object') {
        teamsArray = Object.keys(data.teams).map(teamId => ({
          id: teamId,
          ...data.teams[teamId]
        }));
      } else if (Array.isArray(data.teams)) {
        teamsArray = data.teams;
      }
      
      return {
        ...data,
        teams: teamsArray
      };
    },
    'teamData'
  );
}

// ==================== 🔥 NEW: BATCH OPERATIONS ====================

/**
 * 🚀 ULTIMATE OPTIMIZATION: Batch fetch all enterprise data in one go
 * This reduces multiple API calls to a single optimized batch operation
 */
export async function getEnterpriseDataBatch() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');
  
  const cacheKey = `enterprise_batch_${userId}`;
  
  return await cache.getOrFetch(
    cacheKey,
    async () => {
      console.log('🚀 Executing BATCH enterprise data fetch');
      
      // Parallel fetch of all core data
      const [subscriptionStatus, userContext, userTeams] = await Promise.allSettled([
        getEnterpriseSubscriptionStatus(),
        getUserContext(),
        getUserTeams()
      ]);

      // Process results and handle any failures gracefully
      const result = {
        subscriptionStatus: subscriptionStatus.status === 'fulfilled' ? subscriptionStatus.value : null,
        userContext: userContext.status === 'fulfilled' ? userContext.value : null,
        userTeams: userTeams.status === 'fulfilled' ? userTeams.value : { teams: [] },
        errors: []
      };

      // Collect any errors for debugging
      [subscriptionStatus, userContext, userTeams].forEach((promiseResult, index) => {
        if (promiseResult.status === 'rejected') {
          const errorNames = ['subscriptionStatus', 'userContext', 'userTeams'];
          result.errors.push({
            service: errorNames[index],
            error: promiseResult.reason.message
          });
        }
      });

      console.log('✅ BATCH enterprise data completed:', {
        hasSubscription: !!result.subscriptionStatus,
        hasUserContext: !!result.userContext,
        teamsCount: result.userTeams.teams?.length || 0,
        errorCount: result.errors.length
      });

      return result;
    },
    'batchData'
  );
}

/**
 * 🚀 OPTIMIZED: Batch fetch team-specific data
 */
export async function getTeamDataBatch(teamId) {
  const cacheKey = `team_batch_${teamId}`;
  
  return await cache.getOrFetch(
    cacheKey,
    async () => {
      console.log('🚀 Executing BATCH team data fetch for:', teamId);
      
      // Parallel fetch of team-specific data
      const [userContext, members, invitations] = await Promise.allSettled([
        getUserContext(),
        getTeamMembers(teamId),
        getTeamInvitations(teamId)
      ]);

      const result = {
        userContext: userContext.status === 'fulfilled' ? userContext.value : null,
        members: members.status === 'fulfilled' ? members.value : { members: [] },
        invitations: invitations.status === 'fulfilled' ? invitations.value : [],
        errors: []
      };

      // Handle errors gracefully
      [userContext, members, invitations].forEach((promiseResult, index) => {
        if (promiseResult.status === 'rejected') {
          const errorNames = ['userContext', 'members', 'invitations'];
          result.errors.push({
            service: errorNames[index],
            error: promiseResult.reason.message
          });
        }
      });

      console.log('✅ BATCH team data completed:', {
        teamId,
        hasUserContext: !!result.userContext,
        memberCount: result.members.members?.length || 0,
        invitationCount: result.invitations.length || 0,
        errorCount: result.errors.length
      });

      return result;
    },
    'batchData'
  );
}

// ==================== SMART CACHE INVALIDATION ====================

// Update your invalidateRelatedCaches function in optimizedEnterpriseService.js

function invalidateRelatedCaches(operation, context = {}) {
  const { teamId, userId } = context;
  
  switch (operation) {
    case 'team_operation':
      if (teamId) {
        cache.invalidate(`team_${teamId}`);
        cache.invalidate(`team_batch_${teamId}`);
        cache.invalidate(`team_permissions_${teamId}`); // Add permissions cache
      }
      cache.invalidate('user_teams');
      cache.invalidate('enterprise_batch');
      break;
      
    case 'user_operation':
      if (userId) {
        cache.invalidate(`user_context_${userId}`);
        cache.invalidate(`subscription_status_${userId}`);
        cache.invalidate(`enterprise_batch_${userId}`);
      }
      break;
      
    case 'invitation_operation':
      if (teamId) {
        cache.invalidate(`team_invitations_${teamId}`);
        cache.invalidate(`team_batch_${teamId}`);
      }
      break;
      
    case 'member_operation':
      if (teamId) {
        cache.invalidate(`team_members_${teamId}`);
        cache.invalidate(`team_batch_${teamId}`);
        cache.invalidate(`team_permissions_${teamId}`); // Add permissions cache
      }
      cache.invalidate('user_teams');
      break;

    case 'permission_operation': // New case for permission changes
      if (teamId) {
        cache.invalidate(`team_permissions_${teamId}`);
        cache.invalidate(`team_batch_${teamId}`);
        cache.invalidate(`user_context_`); // Invalidate all user contexts since permissions changed
      }
      break;

    case 'analytics_operation':
      if (userId && teamId) {
        cache.invalidate(`impersonated_analytics_${userId}_${teamId}`);
        cache.invalidate(`can_impersonate_${userId}_${teamId}`);
      }
      break;
  }
}

// ==================== OPTIMIZED MUTATION OPERATIONS ====================

/**
 * 🚀 OPTIMIZED: Update member role with smart cache invalidation
 */
export async function updateMemberRole(teamId, memberId, newRole) {
  try {
    console.log('🔄 Updating member role:', { teamId, memberId, newRole });
    
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

    const result = await response.json();
    
    // Smart cache invalidation
    invalidateRelatedCaches('member_operation', { teamId });
    
    console.log('✅ Member role updated successfully');
    return result;
  } catch (error) {
    console.error('❌ Error updating member role:', error);
    throw error;
  }
}

/**
 * 🚀 OPTIMIZED: Remove team member with smart cache invalidation
 */
export async function removeTeamMember(teamId, memberId) {
  try {
    console.log('👤 Removing team member:', { teamId, memberId });
    
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/enterprise/teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to remove team member');
    }

    const result = await response.json();
    
    // Smart cache invalidation
    invalidateRelatedCaches('member_operation', { teamId });
    
    console.log('✅ Member removed successfully');
    return result;
  } catch (error) {
    console.error('❌ Error removing team member:', error);
    throw error;
  }
}

/**
 * 🚀 OPTIMIZED: Invite team member with smart cache invalidation
 */
export async function inviteTeamMember(teamId, invitationData, currentTeamSize = 0) {
  try {
    const email = invitationData.email || invitationData.invitedEmail;
    const role = invitationData.role || 'employee';
    
    console.log('📧 Inviting team member:', { teamId, email, role });
    
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

    const result = await response.json();
    
    // Smart cache invalidation
    invalidateRelatedCaches('invitation_operation', { teamId });
    
    console.log('✅ Invitation sent successfully');
    return result;
  } catch (error) {
    console.error('❌ Error sending team invitation:', error);
    throw error;
  }
}

/**
 * 🚀 OPTIMIZED: Resend invitation with smart cache invalidation
 */
export async function resendInvitation(invitationId) {
  try {
    console.log('🔄 Resending invitation:', invitationId);
    
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

    const result = await response.json();
    
    // Smart cache invalidation for invitations
    cache.invalidate('team_invitations');
    cache.invalidate('team_batch');
    
    console.log('✅ Invitation resent successfully');
    return result;
  } catch (error) {
    console.error('❌ Error resending invitation:', error);
    throw error;
  }
}

/**
 * 🚀 OPTIMIZED: Revoke invitation with smart cache invalidation
 */
export async function revokeInvitation(invitationId) {
  try {
    console.log('🚫 Revoking invitation:', invitationId);
    
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/enterprise/invitations?invitationId=${invitationId}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to revoke invitation');
    }

    const result = await response.json();
    
    // Smart cache invalidation for invitations
    cache.invalidate('team_invitations');
    cache.invalidate('team_batch');
    
    console.log('✅ Invitation revoked successfully');
    return result;
  } catch (error) {
    console.error('❌ Error revoking invitation:', error);
    throw error;
  }
}
// ==================== BULK OPERATIONS ====================

export async function bulkResendInvitations(invitationIds) {
  try {
    console.log('🔄 Bulk resending invitations:', invitationIds);
    
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

    const result = await response.json();
    
    // Smart cache invalidation
    cache.invalidate('team_invitations');
    cache.invalidate('team_batch');
    
    console.log('✅ Bulk invitation resend completed');
    return result;
  } catch (error) {
    console.error('❌ Error bulk resending invitations:', error);
    throw error;
  }
}

export async function bulkRevokeInvitations(invitationIds) {
  try {
    console.log('🚫 Bulk revoking invitations:', invitationIds);
    
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

    const result = await response.json();
    
    // Smart cache invalidation
    cache.invalidate('team_invitations');
    cache.invalidate('team_batch');
    
    console.log('✅ Bulk invitation revoke completed');
    return result;
  } catch (error) {
    console.error('❌ Error bulk revoking invitations:', error);
    throw error;
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * 🚀 Get cache statistics for debugging
 */
export function getCacheStats() {
  return cache.getStats();
}

/**
 * 🚀 Clear all caches
 */
export function clearAllCaches() {
  cache.clear();
  console.log('🧹 All caches cleared');
}

/**
 * 🚀 Clear analytics-specific caches
 */
export function clearAnalyticsCaches() {
  cache.invalidate('impersonated_analytics');
  cache.invalidate('can_impersonate');
  cache.invalidate('audit_log');
  console.log('🧹 Analytics caches cleared');
}

/**
 * 🚀 Preload enterprise data (call this early in app lifecycle)
 */
export async function preloadEnterpriseData() {
  try {
    console.log('⚡ Preloading enterprise data...');
    
    // Start preloading in background without awaiting
    const userId = auth.currentUser?.uid;
    if (userId) {
      // These will populate the cache for later use
      getEnterpriseDataBatch().catch(console.warn);
      getUserTeams().catch(console.warn);
    }
    
    console.log('⚡ Preload initiated');
  } catch (error) {
    console.warn('⚠️ Preload failed:', error);
  }
}
// Add these functions to your optimizedEnterpriseService.js

/**
 * Get team permissions with caching
 */
export async function getTeamPermissions(teamId) {
  const cacheKey = `team_permissions_${teamId}`;
  
  return await cache.getOrFetch(
    cacheKey,
    async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/enterprise/teams/${teamId}/permissions`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Team permissions endpoint doesn't exist yet - return null for defaults
          console.warn('Team permissions API not available yet, using defaults');
          return null;
        }
        
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch team permissions');
      }

      const data = await response.json();
      return data.permissions;
    },
    'permissions'
  );
}

/**
 * Update team permissions with smart cache invalidation
 */
export async function updateTeamPermissions(teamId, permissions) {
  try {
    console.log('Updating team permissions:', { teamId, permissions });
    
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/enterprise/teams/${teamId}/permissions`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ permissions })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update team permissions');
    }

    const result = await response.json();
    
    // Smart cache invalidation for permission changes
    invalidateRelatedCaches('permission_operation', { teamId });
    
    console.log('Team permissions updated successfully');
    return result;
  } catch (error) {
    console.error('Error updating team permissions:', error);
    throw error;
  }
}

// ==================== COMPATIBILITY EXPORTS ====================

// Re-export other functions that don't need optimization
export { 
  verifyInvitation, 
    createTeam
} from './optimizedEnterpriseService';

export {
  hasEnterpriseAccess,
  validateEnterpriseOperation,
  ENTERPRISE_FEATURES
} from './enterpriseSubscriptionService';