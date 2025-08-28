// lib/services/serviceEnterprise/client/interfaces/ISubscriptionService.js
// Phase 3: Interface definitions for better type safety and documentation

export const ISubscriptionService = {
  // Core subscription methods
  async getStatus() {
    throw new Error('Method must be implemented');
  },
  
  async validateOperation(operation, context) {
    throw new Error('Method must be implemented');
  },
  
  async getFeatures() {
    throw new Error('Method must be implemented');
  },

  async checkFeatures(features) {
    throw new Error('Method must be implemented');
  },

  async getOperationPermissions() {
    throw new Error('Method must be implemented');
  },

  // Convenience methods
  async hasEnterpriseAccess() {
    throw new Error('Method must be implemented');
  },

  async hasFeature(feature) {
    throw new Error('Method must be implemented');
  },

  async canPerformOperation(operation, context) {
    throw new Error('Method must be implemented');
  }
};

export const ITeamService = {
  // Team management
  async getUserTeams() {
    throw new Error('Method must be implemented');
  },

  async createTeam(teamData) {
    throw new Error('Method must be implemented');
  },

  async getTeamMembers(teamId) {
    throw new Error('Method must be implemented');
  },

  async updateMemberRole(teamId, memberId, newRole) {
    throw new Error('Method must be implemented');
  },

  async removeMember(teamId, memberId) {
    throw new Error('Method must be implemented');
  },

  // Permissions
  async getTeamPermissions(teamId) {
    throw new Error('Method must be implemented');
  },

  async updateTeamPermissions(teamId, permissions) {
    throw new Error('Method must be implemented');
  }
};

export const IInvitationService = {
  // Invitation management
  async sendInvitation(teamId, email, role) {
    throw new Error('Method must be implemented');
  },

  async getTeamInvitations(teamId) {
    throw new Error('Method must be implemented');
  },

  async resendInvitation(invitationId) {
    throw new Error('Method must be implemented');
  },

  async revokeInvitation(invitationId) {
    throw new Error('Method must be implemented');
  },

  async verifyInvitation(email, code) {
    throw new Error('Method must be implemented');
  },

  async acceptInvitation(invitationId) {
    throw new Error('Method must be implemented');
  },

  // Bulk operations
  async bulkResendInvitations(invitationIds) {
    throw new Error('Method must be implemented');
  },

  async bulkRevokeInvitations(invitationIds) {
    throw new Error('Method must be implemented');
  }
};