// lib/config/enterpriseConfig.js

export const enterpriseConfig = {
  // Invitation system settings
  invitations: {
    expirationDays: 7, // Invitations expire after 7 days
    codeLength: 6,
    codeCharacters: 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'
  },
  
  // Security and rate limiting
  security: {
    rateLimit: {
      windowMs: 60 * 1000, // 1 minute
      max: 30 
    },
    auditLogRetentionDays: {
      business: 90,
      enterprise: 365
    }
  },
  
  // Default settings for new organizations
  defaults: {
    organization: {
      subscriptionLevel: 'business',
      settings: {
        dataRetentionDays: 365,
        allowEmployeeDataExport: false,
        requireManagerApprovalForSharing: true,
        allowCrossTeamSharing: false,
        auditLogRetentionDays: 90
      },
      billing: {
        maxSeats: 10,
        billingEmail: ''
      }
    },
    team: {
      settings: {
        autoShareNewContacts: false,
        allowContactSharing: true,
        requireApprovalForNewMembers: true
      }
    }
  }
};