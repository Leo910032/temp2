//////////////////////////////////////////////
// lib/services/serviceEnterprise/client/services/EnhancedTeamService.js
// Phase 3: Enhanced team service with proper structure

"use client"
import { BaseService } from '../abstractions/BaseService';
/*import { IInvitationService } from '../interfaces/ISubscriptionService';*/
import { EnterpriseApiClient } from '../core/apiClient';

export class EnhancedTeamService extends BaseService {
  constructor() {
    super('TeamService');
  }

  async getUserTeams() {
    return this.cachedRequest(
      'user_teams',
      () => EnterpriseApiClient.get('/api/enterprise/teams'),
      'teamData'
    );
  }

  async createTeam(teamData) {
    this.validateParams(teamData, ['name']);
    
    if (!teamData.name || teamData.name.trim().length < 2) {
      throw new Error('Team name must be at least 2 characters long');
    }

    const result = await EnterpriseApiClient.post('/api/enterprise/teams', {
      name: teamData.name.trim(),
      description: teamData.description?.trim() || '',
      settings: teamData.settings || {}
    });


    // Invalidate team-related caches
    this.invalidateTeamCaches();
    
    return result;
  }

  async getTeamMembers(teamId) {
    this.validateParams({ teamId }, ['teamId']);
    
    return this.cachedRequest(
      'members',
      () => EnterpriseApiClient.get(`/api/enterprise/teams/${teamId}/members`),
      'teamMembers',
      { teamId }
    );
  }

  async updateMemberRole(teamId, memberId, newRole) {
    this.validateParams({ teamId, memberId, newRole }, ['teamId', 'memberId', 'newRole']);
    
    const validRoles = ['employee', 'team_lead', 'manager', 'owner'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}. Must be one of: ${validRoles.join(', ')}`);
    }

    const result = await EnterpriseApiClient.put(
      `/api/enterprise/teams/${teamId}/members/${memberId}/role`,
      { role: newRole }
    );

    // Invalidate member-related caches
    this.invalidateMemberCaches(teamId);
    
    return result;
  }

  async removeMember(teamId, memberId) {
    this.validateParams({ teamId, memberId }, ['teamId', 'memberId']);
    
    const result = await EnterpriseApiClient.delete(
      `/api/enterprise/teams/${teamId}/members/${memberId}`
    );

    // Invalidate member-related caches
    this.invalidateMemberCaches(teamId);
    
    return result;
  }

  // ✅ ADD THIS METHOD
  async updateTeamPermissions(teamId, permissions) {
    this.validateParams({ teamId, permissions }, ['teamId', 'permissions']);
    
    if (!permissions || typeof permissions !== 'object') {
      throw new Error('Permissions must be an object');
    }

    const result = await EnterpriseApiClient.put(
      `/api/enterprise/teams/${teamId}/permissions`,
      { permissions }
    );

    // Invalidate permission and team-related caches
    this.invalidatePermissionCaches(teamId);
    
    return result;
  }
  async getTeamPermissions(teamId) {
    this.validateParams({ teamId }, ['teamId']);
    
    return this.cachedRequest(
      'permissions',
      () => EnterpriseApiClient.get(`/api/enterprise/teams/${teamId}/permissions`),
      'permissions',
      { teamId }
    );
  }

  async updateTeamPermissions(teamId, permissions) {
    this.validateParams({ teamId, permissions }, ['teamId', 'permissions']);
    
    if (!permissions || typeof permissions !== 'object') {
      throw new Error('Permissions must be an object');
    }

    const result = await EnterpriseApiClient.put(
      `/api/enterprise/teams/${teamId}/permissions`,
      { permissions }
    );

    // Invalidate permission-related caches
    this.invalidatePermissionCaches(teamId);
    
    return result;
  }

  // Enhanced team management methods
  async getTeamDetails(teamId) {
    this.validateParams({ teamId }, ['teamId']);
    
    // Get both members and permissions in parallel
    const [members, permissions] = await Promise.all([
      this.getTeamMembers(teamId),
      this.getTeamPermissions(teamId).catch(() => null) // Graceful fallback
    ]);

    return {
      teamId,
      members: members.members || [],
      permissions: permissions?.permissions || null,
      memberCount: members.members?.length || 0,
      teamInfo: members.teamInfo || {}
    };
  }

  async bulkUpdateMemberRoles(teamId, roleUpdates) {
    this.validateParams({ teamId, roleUpdates }, ['teamId', 'roleUpdates']);
    
    if (!Array.isArray(roleUpdates)) {
      throw new Error('Role updates must be an array');
    }

    const results = await Promise.allSettled(
      roleUpdates.map(update => 
        this.updateMemberRole(teamId, update.memberId, update.newRole)
      )
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    return {
      total: roleUpdates.length,
      successful: successCount,
      failed: failureCount,
      results: results.map((result, index) => ({
        memberId: roleUpdates[index].memberId,
        newRole: roleUpdates[index].newRole,
        success: result.status === 'fulfilled',
        error: result.status === 'rejected' ? result.reason.message : null
      }))
    };
  }

   // ✅ CORRECTED: Specialized cache management using dynamic keys
  invalidateTeamCaches() {
    // This invalidates the main list of teams for the user.
    this.invalidateCache(['teamservice_user_teams']); 
  }

  invalidateMemberCaches(teamId) {
    this.invalidateCache([
      // Use getCacheKey to generate the EXACT key to invalidate
      this.getCacheKey('members', { teamId }),
      this.getCacheKey('permissions', { teamId }),
      'teamservice_user_teams' // Still invalidate the main list
    ]);
  }
  invalidatePermissionCaches(teamId) {
    this.invalidateCache([
      // Use getCacheKey to generate the EXACT key to invalidate
      this.getCacheKey('permissions', { teamId }),
      this.getCacheKey('members', { teamId }) // Member permissions might change too
    ]);
  }
  // lib/services/serviceEnterprise/client/services/EnhancedTeamService.js
// Add these methods to the existing EnhancedTeamService class

// ==================== MISSING METHODS FROM OPTIMIZED SERVICE ====================

/**
 * Enhanced team data batch fetch (combines members, invitations, permissions)
 */
async getTeamDataBatch(teamId) {
  this.validateParams({ teamId }, ['teamId']);
  
  return this.cachedRequest(
    'team_batch',
    async () => {
      console.log('🚀 Executing BATCH team data fetch for:', teamId);
      
      // Import services to avoid circular dependencies
      const { ServiceFactory } = await import('../factories/ServiceFactory');
      
      // Parallel fetch of team-specific data
      const [members, invitations, permissions, userContext] = await Promise.allSettled([
        this.getTeamMembers(teamId),
        ServiceFactory.getInvitationService().getTeamInvitations(teamId),
        this.getTeamPermissions(teamId).catch(() => null), // Graceful fallback
        ServiceFactory.getSubscriptionService().getUserContext().catch(() => null)
      ]);

      const result = {
        userContext: userContext.status === 'fulfilled' ? userContext.value : null,
        members: members.status === 'fulfilled' ? (members.value.members || members.value) : [],
        invitations: invitations.status === 'fulfilled' ? invitations.value : [],
        permissions: permissions.status === 'fulfilled' ? permissions.value : null,
        teamInfo: members.status === 'fulfilled' ? (members.value.teamInfo || {}) : {},
        errors: []
      };

      // Handle errors gracefully
      [userContext, members, invitations, permissions].forEach((promiseResult, index) => {
        if (promiseResult.status === 'rejected') {
          const errorNames = ['userContext', 'members', 'invitations', 'permissions'];
          result.errors.push({
            service: errorNames[index],
            error: promiseResult.reason.message
          });
        }
      });

      console.log('✅ BATCH team data completed:', {
        teamId,
        hasUserContext: !!result.userContext,
        memberCount: Array.isArray(result.members) ? result.members.length : 0,
        invitationCount: result.invitations.length || 0,
        hasPermissions: !!result.permissions,
        errorCount: result.errors.length
      });

      return result;
    },
    'batchData',
    { teamId }
  );
}

/**
 * Get comprehensive team statistics
 */
async getTeamStats(teamId) {
  this.validateParams({ teamId }, ['teamId']);
  
  return this.cachedRequest(
    'team_stats',
    async () => {
      const [members, invitations] = await Promise.all([
        this.getTeamMembers(teamId),
        import('../factories/ServiceFactory').then(({ ServiceFactory }) => 
          ServiceFactory.getInvitationService().getTeamInvitations(teamId)
        ).catch(() => [])
      ]);

      const membersList = Array.isArray(members) ? members : (members.members || []);
      const invitationsList = Array.isArray(invitations) ? invitations : [];

      // Calculate statistics
      const stats = {
        totalMembers: membersList.length,
        totalInvitations: invitationsList.length,
        
        // Member role breakdown
        membersByRole: {},
        
        // Invitation statistics
        pendingInvitations: 0,
        expiredInvitations: 0,
        expiringSoonInvitations: 0,
        
        // Dates
        lastActivity: null,
        averageJoinTime: null
      };

      // Process members
      membersList.forEach(member => {
        const role = member.role || 'employee';
        stats.membersByRole[role] = (stats.membersByRole[role] || 0) + 1;
      });

      // Process invitations
      const now = new Date();
      invitationsList.forEach(invitation => {
        if (invitation.status === 'pending') {
          stats.pendingInvitations++;
          
          const expiresAt = invitation.expiresAt?.toDate ? 
            invitation.expiresAt.toDate() : 
            new Date(invitation.expiresAt);
          
          if (now > expiresAt) {
            stats.expiredInvitations++;
          } else {
            const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
            if (hoursUntilExpiry < 24) {
              stats.expiringSoonInvitations++;
            }
          }
        }
      });

      return stats;
    },
    'teamData',
    { teamId }
  );
}

/**
 * Get team details with enhanced information
 */
async getTeamDetails(teamId) {
  this.validateParams({ teamId }, ['teamId']);
  
  // Get both members and permissions in parallel
  const [members, permissions, stats] = await Promise.allSettled([
    this.getTeamMembers(teamId),
    this.getTeamPermissions(teamId).catch(() => null),
    this.getTeamStats(teamId).catch(() => null)
  ]);

  const membersData = members.status === 'fulfilled' ? members.value : { members: [], teamInfo: {} };
  const permissionsData = permissions.status === 'fulfilled' ? permissions.value : null;
  const statsData = stats.status === 'fulfilled' ? stats.value : null;

  return {
    teamId,
    members: Array.isArray(membersData) ? membersData : (membersData.members || []),
    permissions: permissionsData,
    stats: statsData,
    memberCount: Array.isArray(membersData) ? membersData.length : (membersData.members?.length || 0),
    teamInfo: membersData.teamInfo || {},
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Preload team data for better performance
 */
async preloadTeamData(teamId) {
  try {
    console.log(`⚡ Preloading team data for: ${teamId}`);
    
    // Start preloading in background
    Promise.allSettled([
      this.getTeamDataBatch(teamId),
      this.getTeamMembers(teamId),
      this.getTeamPermissions(teamId)
    ]).catch(console.warn);
    
    console.log(`⚡ Team data preload initiated for: ${teamId}`);
    return { success: true, teamId };
  } catch (error) {
    console.warn(`⚠️ Team preload failed for ${teamId}:`, error);
    return { success: false, teamId, error: error.message };
  }
}
}
