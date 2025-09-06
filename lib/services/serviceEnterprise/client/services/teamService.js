
// lib/services/serviceEnterprise/client/services/teamService.js
// 🎯 PHASE 2: Consolidated team service (removes duplicates)
 {/**
"use client"
import { EnterpriseApiClient } from '../core/apiClient';
import { globalCache } from '../core/cacheManager';
import { ErrorHandler } from '../core/errorHandler';

export class TeamService {

 
  static async getUserTeams() {
    const cacheKey = 'user_teams';
    
    try {
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const data = await EnterpriseApiClient.get('/api/enterprise/teams');
      globalCache.set(cacheKey, data, 'teamData');
      
      return data;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'getUserTeams');
      throw new Error(handled.message);
    }
  }

  /**
   * Create new team
   
  static async createTeam(teamData) {
    try {
      const result = await EnterpriseApiClient.post('/api/enterprise/teams', teamData);
      
      // Invalidate related caches
      this.invalidateTeamCaches();
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'createTeam');
      throw new Error(handled.message);
    }
  }

  /**
   * Get team members
   
  static async getTeamMembers(teamId) {
    const cacheKey = `team_members_${teamId}`;
    
    try {
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const data = await EnterpriseApiClient.get(`/api/enterprise/teams/${teamId}/members`);
      globalCache.set(cacheKey, data, 'teamMembers');
      
      return data;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'getTeamMembers');
      throw new Error(handled.message);
    }
  }

  /**
   * Update member role
   */
  static async updateMemberRole(teamId, memberId, newRole) {
    try {
      const result = await EnterpriseApiClient.put(
        `/api/enterprise/teams/${teamId}/members/${memberId}/role`,
        { role: newRole }
      );
      
      // Invalidate related caches
      this.invalidateMemberCaches(teamId);
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'updateMemberRole');
      throw new Error(handled.message);
    }
  }

  /**
   * Remove team member
   
  static async removeMember(teamId, memberId) {
    try {
      const result = await EnterpriseApiClient.delete(
        `/api/enterprise/teams/${teamId}/members/${memberId}`
      );
      
      // Invalidate related caches
      this.invalidateMemberCaches(teamId);
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'removeMember');
      throw new Error(handled.message);
    }
  }

  /**
   * Get team permissions
   
  static async getTeamPermissions(teamId) {
    const cacheKey = `team_permissions_${teamId}`;
    
    try {
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const data = await EnterpriseApiClient.get(`/api/enterprise/teams/${teamId}/permissions`);
      globalCache.set(cacheKey, data, 'permissions');
      
      return data;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'getTeamPermissions');
      throw new Error(handled.message);
    }
  }

  /**
   * Update team permissions
   
  static async updateTeamPermissions(teamId, permissions) {
    try {
      const result = await EnterpriseApiClient.put(
        `/api/enterprise/teams/${teamId}/permissions`,
        { permissions }
      );
      
      // Invalidate related caches
      this.invalidatePermissionCaches(teamId);
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'updateTeamPermissions');
      throw new Error(handled.message);
    }
  }

  // Cache invalidation helpers
  static invalidateTeamCaches() {
    globalCache.invalidate('user_teams');
    globalCache.invalidate('team_');
  }

  static invalidateMemberCaches(teamId) {
    globalCache.invalidate(`team_members_${teamId}`);
    globalCache.invalidate(`team_permissions_${teamId}`);
    globalCache.invalidate('user_teams');
  }

  static invalidatePermissionCaches(teamId) {
    globalCache.invalidate(`team_permissions_${teamId}`);
    globalCache.invalidate(`team_members_${teamId}`);
  }
}
   */}