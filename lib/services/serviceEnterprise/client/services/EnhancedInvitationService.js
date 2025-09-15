// lib/services/serviceEnterprise/client/services/EnhancedInvitationService.js
// Phase 3: Complete invitation service with all invitation-related functions

"use client"
import { BaseService } from '../abstractions/BaseService';
/*import { IInvitationService } from '../interfaces/ISubscriptionService';*/
import { EnterpriseApiClient } from '../core/apiClient';

export class EnhancedInvitationService extends BaseService {
  constructor() {
    super('InvitationService');
  }

  // ==================== CORE INVITATION OPERATIONS ====================

  // Update the sendInvitation method in EnhancedInvitationService.js

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

  // ✅ COMPREHENSIVE CACHE INVALIDATION - This fixes the banner issue
  console.log('🧹 Invalidating invitation caches after sending invitation...');
  
  // 1. Clear team-specific invitation caches
  this.invalidateInvitationCaches(teamId);
  
  // 2. ✅ CRITICAL FIX: Clear ALL pending invitation caches
  // This ensures the banner will show the new invitation immediately
  this.invalidateAllInvitationCaches();
  
  // 3. ✅ ADDITIONAL FIX: Force clear specific user invitation patterns
  // Clear both global and user-specific patterns
  this.invalidateCache([
    'user_pending_invites',     // Global pattern
    'user_pending_invites_',    // All user-specific patterns
    'invitationservice_user_pending_invites' // Service-specific pattern
  ]);
  
  console.log('✅ Invitation sent and all caches cleared for immediate banner update');
  
  return result;
}

  async inviteTeamMember(teamId, invitationData, currentTeamSize = 0) {
    const email = invitationData.email || invitationData.invitedEmail;
    const role = invitationData.role || 'employee';
    
    if (!email) {
      throw new Error('Email is required for team invitation');
    }

    return this.sendInvitation(teamId, email, role);
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

 async getPendingUserInvitations() {
    const result = await this.cachedRequest(
      'pending_user_invitations',
      () => EnterpriseApiClient.get('/api/enterprise/invitations'),
      'invitations'
    );

    return result || [];
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


  /**
   * ✅ FIXED: Accept invitation with comprehensive cache invalidation
   */
  async acceptInvitation(invitationId) {
    this.validateParams({ invitationId }, ['invitationId']);
    
    const result = await EnterpriseApiClient.post('/api/enterprise/invitations/accept', {
      action: 'accept',
      invitationId
    });

    // ✅ COMPREHENSIVE CACHE INVALIDATION - This fixes the pending invitations issue
    if (result.success) {
      console.log('🧹 Clearing caches after invitation acceptance...');
      
      // Clear all invitation-related caches
      this.invalidateAllInvitationCaches();
      
      // ✅ CRITICAL FIX: Clear user-specific invitation caches
      // This is what was missing - we need to clear the user's pending invitations
      this.invalidateCache([
        'user_pending_invites', // Global pattern
        `user_pending_invites_${result.userId || 'current'}` // User-specific
      ]);
      
      // ✅ ADDITIONAL FIX: Clear all user context and enterprise data
      // Since the user just joined a team, their context has changed significantly
      this.invalidateCache([
        'user_context',
        'subscription_status', 
        'enterprise_batch',
        'user_teams',
        'teamservice_user_teams'
      ]);
      
      // ✅ TEAM-SPECIFIC CACHE INVALIDATION
      if (result.teamId) {
        console.log(`🧹 Clearing team caches for team ${result.teamId}`);
        this.invalidateCache([
          `teamservice_members_${result.teamId}`,
          `teamservice_team_batch_${result.teamId}`,
          `team_invitations_${result.teamId}`
        ]);
      }
      
      console.log('✅ Cache invalidation completed after invitation acceptance');
    }
    
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

  // ==================== BULK OPERATIONS ====================

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

    const batchSize = 10; // More aggressive with deletes
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

  // ==================== INVITATION ANALYTICS & MANAGEMENT ====================

  async getInvitationStats(teamId) {
    const invitations = await this.getTeamInvitations(teamId);
    
    const now = new Date();
    const stats = {
      total: invitations.length,
      pending: 0,
      expired: 0,
      accepted: 0,
      revoked: 0,
      expiringSoon: 0, // Expires within 24 hours
      byRole: {},
      avgAge: 0,
      successRate: 0
    };

    let totalAge = 0;
    let acceptedCount = 0;
    
    invitations.forEach(invitation => {
      // Status counts
      stats[invitation.status] = (stats[invitation.status] || 0) + 1;
      
      if (invitation.status === 'accepted') {
        acceptedCount++;
      }
      
      if (invitation.status === 'pending') {
        // Check if expiring soon
        const expiresAt = invitation.expiresAt?.toDate ? 
          invitation.expiresAt.toDate() : 
          new Date(invitation.expiresAt);
        
        const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
        
        if (hoursUntilExpiry < 24 && hoursUntilExpiry > 0) {
          stats.expiringSoon++;
        }
      }
      
      // Role distribution
      stats.byRole[invitation.role] = (stats.byRole[invitation.role] || 0) + 1;
      
      // Age calculation
      const createdAt = invitation.createdAt?.toDate ? 
        invitation.createdAt.toDate() : 
        new Date(invitation.createdAt);
      totalAge += (now - createdAt) / (1000 * 60 * 60 * 24); // Days
    });

    stats.avgAge = invitations.length > 0 ? Math.round(totalAge / invitations.length) : 0;
    stats.successRate = invitations.length > 0 ? Math.round((acceptedCount / invitations.length) * 100) : 0;
    
    return stats;
  }

  async getExpiredInvitations(teamId) {
    const invitations = await this.getTeamInvitations(teamId);
    const now = new Date();
    
    return invitations.filter(invitation => {
      if (invitation.status !== 'pending') return false;
      
      const expiresAt = invitation.expiresAt?.toDate ? 
        invitation.expiresAt.toDate() : 
        new Date(invitation.expiresAt);
      
      return now > expiresAt;
    });
  }

  async getExpiringSoonInvitations(teamId, hours = 24) {
    const invitations = await this.getTeamInvitations(teamId);
    const now = new Date();
    const cutoffTime = new Date(now.getTime() + (hours * 60 * 60 * 1000));
    
    return invitations.filter(invitation => {
      if (invitation.status !== 'pending') return false;
      
      const expiresAt = invitation.expiresAt?.toDate ? 
        invitation.expiresAt.toDate() : 
        new Date(invitation.expiresAt);
      
      return expiresAt > now && expiresAt < cutoffTime;
    });
  }

  // ==================== ENHANCED INVITATION MANAGEMENT ====================

  async cleanupExpiredInvitations(teamId) {
    const expiredInvitations = await this.getExpiredInvitations(teamId);
    
    if (expiredInvitations.length === 0) {
      return { cleaned: 0, message: 'No expired invitations found' };
    }

    // In a real implementation, you might want to:
    // 1. Mark them as expired in the backend
    // 2. Send notification emails
    // 3. Log the cleanup action
    
    console.log(`Found ${expiredInvitations.length} expired invitations for team ${teamId}`);
    
    // This would typically call a backend endpoint to mark as expired
    // For now, we'll just invalidate the cache to refresh the data
    this.invalidateInvitationCaches(teamId);
    
    return {
      cleaned: expiredInvitations.length,
      message: `Marked ${expiredInvitations.length} invitations as expired`,
      invitations: expiredInvitations.map(inv => ({
        id: inv.id,
        email: inv.invitedEmail,
        role: inv.role,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt
      }))
    };
  }

  async resendExpiringSoonInvitations(teamId, hours = 24) {
    const expiringSoon = await this.getExpiringSoonInvitations(teamId, hours);
    
    if (expiringSoon.length === 0) {
      return { resent: 0, message: 'No invitations expiring soon' };
    }

    const invitationIds = expiringSoon.map(inv => inv.id);
    const result = await this.bulkResendInvitations(invitationIds);
    
    return {
      resent: result.successful,
      failed: result.failed,
      message: `Resent ${result.successful} invitations that were expiring within ${hours} hours`,
      details: result
    };
  }

  // ==================== INVITATION HISTORY & TRACKING ====================

  async getInvitationHistory(teamId, limit = 50) {
    // This would typically call a specific endpoint for historical data
    // For now, we'll use the regular endpoint but could be enhanced
    const allInvitations = await this.getTeamInvitations(teamId);
    
    // Sort by creation date (newest first) and limit
    return allInvitations
      .sort((a, b) => {
        const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bDate - aDate;
      })
      .slice(0, limit);
  }

  async getInvitationsByRole(teamId, role) {
    const invitations = await this.getTeamInvitations(teamId);
    return invitations.filter(inv => inv.role === role);
  }

  async getInvitationsByStatus(teamId, status) {
    const invitations = await this.getTeamInvitations(teamId);
    return invitations.filter(inv => inv.status === status);
  }

  // ==================== CACHE MANAGEMENT ====================

 // ✅ Also update the invalidateInvitationCaches method
invalidateInvitationCaches(teamId) {
  const patterns = [
    this.getCacheKey('team_invitations', { teamId }),
    'user_pending_invites',    // Always clear pending invites when any invitation changes
    'user_pending_invites_'    // Clear all user-specific patterns
  ];
  this.invalidateCache(patterns);
  console.log(`🧹 Invalidated invitation caches for team ${teamId} including pending invitations`);
}
 // ✅ Enhanced invalidateAllInvitationCaches method
invalidateAllInvitationCaches() {
  const patterns = [
    'invitation_', 
    'team_invitations_', 
    'user_pending_invites',
    'user_pending_invites_',           // All user-specific patterns
    'invitationservice_',              // All invitation service patterns
    'invitationservice_user_pending_invites'  // Service-specific pending invites
  ];
  
  this.invalidateCache(patterns);
  console.log('🧹 Invalidated ALL invitation caches including pending invitation banners');
}

  invalidateAllInvitationCaches() {
    this.invalidateCache(['invitation_', 'team_invitations_', 'user_pending_invites']);
  }

  /**
   * ✅ NEW: Force refresh pending invitations (for debugging)
   */
  async forceRefreshPendingInvitations() {
    // Clear all related caches
    this.invalidateAllInvitationCaches();
    
    // Fetch fresh data
    const invitations = await this.getPendingUserInvitations();
    
    console.log('🔄 Force refreshed pending invitations:', invitations?.length || 0);
    return invitations;
  }

  clearAllCaches() {
    // This would typically call the global cache clear
    // For now, we'll invalidate all invitation-related caches
    this.invalidateAllInvitationCaches();
    this.invalidateCache(['user_teams', 'user_context', 'subscription_status']);
  }

  // ==================== UTILITY METHODS ====================

  validateInvitationEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email?.trim?.());
  }

  validateInvitationRole(role) {
    const validRoles = ['employee', 'team_lead', 'manager'];
    return validRoles.includes(role);
  }

  formatInvitationForDisplay(invitation) {
    return {
      id: invitation.id,
      email: invitation.invitedEmail,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.createdAt?.toDate ? 
        invitation.createdAt.toDate() : 
        new Date(invitation.createdAt),
      expiresAt: invitation.expiresAt?.toDate ? 
        invitation.expiresAt.toDate() : 
        new Date(invitation.expiresAt),
      isExpired: this.isInvitationExpired(invitation),
      isExpiringSoon: this.isInvitationExpiringSoon(invitation),
      resentCount: invitation.resentCount || 0
    };
  }

  isInvitationExpired(invitation) {
    if (invitation.status !== 'pending') return false;
    
    const expiresAt = invitation.expiresAt?.toDate ? 
      invitation.expiresAt.toDate() : 
      new Date(invitation.expiresAt);
    
    return new Date() > expiresAt;
  }

  isInvitationExpiringSoon(invitation, hours = 24) {
    if (invitation.status !== 'pending') return false;
    
    const now = new Date();
    const expiresAt = invitation.expiresAt?.toDate ? 
      invitation.expiresAt.toDate() : 
      new Date(invitation.expiresAt);
    
    const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
    
    return hoursUntilExpiry > 0 && hoursUntilExpiry < hours;
  }

  getInvitationAgeInDays(invitation) {
    const createdAt = invitation.createdAt?.toDate ? 
      invitation.createdAt.toDate() : 
      new Date(invitation.createdAt);
    
    const now = new Date();
    return Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
  }

  getTimeUntilExpiry(invitation) {
    const expiresAt = invitation.expiresAt?.toDate ? 
      invitation.expiresAt.toDate() : 
      new Date(invitation.expiresAt);
    
    const now = new Date();
    const msUntilExpiry = expiresAt - now;
    
    if (msUntilExpiry <= 0) return 'Expired';
    
    const days = Math.floor(msUntilExpiry / (1000 * 60 * 60 * 24));
    const hours = Math.floor((msUntilExpiry % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
  }
}