// lib/services/serviceEnterprise/client/services/EnhancedTeamService.js
// Phase 3: Enhanced team service with proper structure

"use client"
import { BaseService } from '../abstractions/BaseService';
import { ITeamService } from '../interfaces/ISubscriptionService';
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

  // Specialized cache management
  invalidateTeamCaches() {
    this.invalidateCache(['team_', 'user_teams']);
  }

  invalidateMemberCaches(teamId) {
    this.invalidateCache([
      `team_members_${teamId}`,
      `team_permissions_${teamId}`,
      'user_teams'
    ]);
  }

  invalidatePermissionCaches(teamId) {
    this.invalidateCache([
      `team_permissions_${teamId}`,
      `team_members_${teamId}`
    ]);
  }
}
