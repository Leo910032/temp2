// lib/services/serviceEnterprise/client/services/EnhancedInvitationService.js
// Phase 3: Enhanced invitation service with robust error handling

"use client"
import { BaseService } from '../abstractions/BaseService';
import { IInvitationService } from '../interfaces/ISubscriptionService';
import { EnterpriseApiClient } from '../core/apiClient';

export class EnhancedInvitationService extends BaseService {
  constructor() {
    super('InvitationService');
  }

  async sendInvitation(teamId, email, role) {
    this.validateParams({ teamId, email, role }, ['teamId', 'email', 'role']);
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Please provide a valid email address');
    }

    // Role validation
    const validRoles = ['employee', 'team_lead', 'manager'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
    }

    const result = await EnterpriseApiClient.post('/api/enterprise/invitations', {
      teamId,
      invitedEmail: email.trim().toLowerCase(),
      role
    });

    // Invalidate invitation caches
    this.invalidateInvitationCaches(teamId);
    
    return result;
  }

  async getTeamInvitations(teamId) {
    this.validateParams({ teamId }, ['teamId']);
    
    const result = await this.cachedRequest(
      'team_invitations',
      () => EnterpriseApiClient.get(`/api/enterprise/invitations?teamId=${teamId}`),
      'invitations',
      { teamId }
    );
    
    return result.invitations || [];
  }

  async resendInvitation(invitationId) {
    this.validateParams({ invitationId }, ['invitationId']);
    
    const result = await EnterpriseApiClient.patch('/api/enterprise/invitations', {
      invitationId,
      action: 'resend'
    });

    // Invalidate all invitation caches since we don't know the teamId
    this.invalidateAllInvitationCaches();
    
    return result;
  }

  async revokeInvitation(invitationId) {
    this.validateParams({ invitationId }, ['invitationId']);
    
    const result = await EnterpriseApiClient.delete(
      `/api/enterprise/invitations?invitationId=${invitationId}`
    );

    // Invalidate all invitation caches
    this.invalidateAllInvitationCaches();
    
    return result;
  }

  async verifyInvitation(email, code) {
    this.validateParams({ email, code }, ['email', 'code']);
    
    // Input validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Please provide a valid email address');
    }

    if (!code || code.trim().length !== 6) {
      throw new Error('Invitation code must be 6 characters long');
    }

    return EnterpriseApiClient.post('/api/enterprise/invitations/verify', {
      email: email.trim().toLowerCase(),
      code: code.trim().toUpperCase()
    });
  }

  async acceptInvitation(invitationId) {
    this.validateParams({ invitationId }, ['invitationId']);
    
    const result = await EnterpriseApiClient.post('/api/enterprise/invitations/accept', {
      action: 'accept',
      invitationId
    });

    // Clear all caches since user context will change significantly
    globalCache.clear();
    
    return result;
  }

  // Enhanced bulk operations with progress tracking
  async bulkResendInvitations(invitationIds, onProgress = null) {
    this.validateParams({ invitationIds }, ['invitationIds']);
    
    if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
      throw new Error('Invitation IDs must be a non-empty array');
    }

    // Process in batches for better performance and user feedback
    const batchSize = 5;
    const results = [];
    
    for (let i = 0; i < invitationIds.length; i += batchSize) {
      const batch = invitationIds.slice(i, i + batchSize);
      
      try {
        const batchResult = await EnterpriseApiClient.patch('/api/enterprise/invitations/bulk', {
          invitationIds: batch,
          action: 'resend'
        });
        
        results.push(...(batchResult.results || []));
        
        // Report progress
        if (onProgress) {
          onProgress({
            completed: Math.min(i + batchSize, invitationIds.length),
            total: invitationIds.length,
            currentBatch: Math.floor(i / batchSize) + 1,
            totalBatches: Math.ceil(invitationIds.length / batchSize)
          });
        }
        
      } catch (error) {
        // Add failed batch to results
        batch.forEach(id => {
          results.push({
            id,
            success: false,
            error: error.message
          });
        });
      }
    }

    this.invalidateAllInvitationCaches();
    
    return {
      total: invitationIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  async bulkRevokeInvitations(invitationIds, onProgress = null) {
    this.validateParams({ invitationIds }, ['invitationIds']);
    
    if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
      throw new Error('Invitation IDs must be a non-empty array');
    }

    // Similar batching strategy as bulk resend
    const batchSize = 10; // Can be more aggressive with deletes
    const results = [];
    
    for (let i = 0; i < invitationIds.length; i += batchSize) {
      const batch = invitationIds.slice(i, i + batchSize);
      
      try {
        const batchResult = await EnterpriseApiClient.delete('/api/enterprise/invitations/bulk', {
          body: { invitationIds: batch }
        });
        
        results.push(...(batchResult.results || []));
        
        if (onProgress) {
          onProgress({
            completed: Math.min(i + batchSize, invitationIds.length),
            total: invitationIds.length
          });
        }
        
      } catch (error) {
        batch.forEach(id => {
          results.push({
            id,
            success: false,
            error: error.message
          });
        });
      }
    }

    this.invalidateAllInvitationCaches();
    
    return {
      total: invitationIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  // Advanced invitation management
  async getInvitationStats(teamId) {
    const invitations = await this.getTeamInvitations(teamId);
    
    const now = new Date();
    const stats = {
      total: invitations.length,
      pending: 0,
      expired: 0,
      expiringSoon: 0, // Expires within 24 hours
      byRole: {},
      avgAge: 0
    };

    let totalAge = 0;
    
    invitations.forEach(invitation => {
      // Status counts
      if (invitation.status === 'pending') {
        stats.pending++;
        
        // Check if expiring soon
        const expiresAt = new Date(invitation.expiresAt);
        const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
        
        if (hoursUntilExpiry < 24 && hoursUntilExpiry > 0) {
          stats.expiringSoon++;
        }
      } else if (invitation.status === 'expired') {
        stats.expired++;
      }
      
      // Role distribution
      stats.byRole[invitation.role] = (stats.byRole[invitation.role] || 0) + 1;
      
      // Age calculation
      const createdAt = new Date(invitation.createdAt);
      totalAge += (now - createdAt) / (1000 * 60 * 60 * 24); // Days
    });

    stats.avgAge = invitations.length > 0 ? Math.round(totalAge / invitations.length) : 0;
    
    return stats;
  }

  // Cache management
  invalidateInvitationCaches(teamId) {
    this.invalidateCache([`team_invitations_${teamId}`]);
  }

  invalidateAllInvitationCaches() {
    this.invalidateCache(['invitation_', 'team_invitations_']);
  }
}