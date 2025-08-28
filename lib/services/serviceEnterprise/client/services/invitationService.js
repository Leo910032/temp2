

// lib/services/serviceEnterprise/client/services/invitationService.js
// 🎯 PHASE 2: Consolidated invitation service

"use client"
import { EnterpriseApiClient } from '../core/apiClient';
import { globalCache } from '../core/cacheManager';
import { ErrorHandler } from '../core/errorHandler';

export class InvitationService {

  /**
   * Send team invitation
   */
  static async sendInvitation(teamId, email, role) {
    try {
      const result = await EnterpriseApiClient.post('/api/enterprise/invitations', {
        teamId,
        invitedEmail: email,
        role
      });
      
      // Invalidate invitation caches
      this.invalidateInvitationCaches(teamId);
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'sendInvitation');
      throw new Error(handled.message);
    }
  }

  /**
   * Get team invitations
   */
  static async getTeamInvitations(teamId) {
    const cacheKey = `team_invitations_${teamId}`;
    
    try {
      const cached = globalCache.get(cacheKey);
      if (cached) return cached;

      const data = await EnterpriseApiClient.get(`/api/enterprise/invitations?teamId=${teamId}`);
      globalCache.set(cacheKey, data.invitations || [], 'invitations');
      
      return data.invitations || [];
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'getTeamInvitations');
      throw new Error(handled.message);
    }
  }

  /**
   * Resend invitation
   */
  static async resendInvitation(invitationId) {
    try {
      const result = await EnterpriseApiClient.patch('/api/enterprise/invitations', {
        invitationId,
        action: 'resend'
      });
      
      // Invalidate invitation caches
      this.invalidateAllInvitationCaches();
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'resendInvitation');
      throw new Error(handled.message);
    }
  }

  /**
   * Revoke invitation
   */
  static async revokeInvitation(invitationId) {
    try {
      const result = await EnterpriseApiClient.delete(
        `/api/enterprise/invitations?invitationId=${invitationId}`
      );
      
      // Invalidate invitation caches
      this.invalidateAllInvitationCaches();
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'revokeInvitation');
      throw new Error(handled.message);
    }
  }

  /**
   * Verify invitation
   */
  static async verifyInvitation(email, code) {
    try {
      const result = await EnterpriseApiClient.post('/api/enterprise/invitations/verify', {
        email,
        code
      });
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'verifyInvitation');
      throw new Error(handled.message);
    }
  }

  /**
   * Accept invitation
   */
  static async acceptInvitation(invitationId) {
    try {
      const result = await EnterpriseApiClient.post('/api/enterprise/invitations/accept', {
        action: 'accept',
        invitationId
      });
      
      // Clear all caches since user context will change
      globalCache.clear();
      
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'acceptInvitation');
      throw new Error(handled.message);
    }
  }

  /**
   * Bulk operations
   */
  static async bulkResendInvitations(invitationIds) {
    try {
      const result = await EnterpriseApiClient.patch('/api/enterprise/invitations/bulk', {
        invitationIds,
        action: 'resend'
      });
      
      this.invalidateAllInvitationCaches();
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'bulkResendInvitations');
      throw new Error(handled.message);
    }
  }

  static async bulkRevokeInvitations(invitationIds) {
    try {
      const result = await EnterpriseApiClient.delete('/api/enterprise/invitations/bulk', {
        body: { invitationIds }
      });
      
      this.invalidateAllInvitationCaches();
      return result;
    } catch (error) {
      const handled = ErrorHandler.handle(error, 'bulkRevokeInvitations');
      throw new Error(handled.message);
    }
  }

  // Cache management
  static invalidateInvitationCaches(teamId) {
    globalCache.invalidate(`team_invitations_${teamId}`);
  }

  static invalidateAllInvitationCaches() {
    globalCache.invalidate('team_invitations_');
  }
}
