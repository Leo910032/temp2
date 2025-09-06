// lib/services/serviceEnterprise/server/enterpriseAuditService.js

import { adminDb } from '@/lib/firebaseAdmin';

export class EnterpriseAuditService {
  
  /**
   * ✅ Log team action with automatic context detection
   */
  static async logTeamAction({
    userId,
    organizationId,
    teamId,
    action,
    details = {},
    targetUserId = null,
    ipAddress = null,
    userAgent = null
  }) {
    try {
      console.log('📝 Logging team action:', { action, teamId, userId });

      // ✅ Get user information
      let userInfo = {};
      try {
        const userDoc = await adminDb.collection('AccountData').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userInfo = {
            displayName: userData.displayName,
            email: userData.email
          };
        }
      } catch (error) {
        console.warn('Could not fetch user info for audit log:', error);
      }

      // ✅ Create audit log entry
      const auditLog = {
        userId,
        userEmail: userInfo.email || 'Unknown',
        userDisplayName: userInfo.displayName || 'Unknown User',
        organizationId,
        action,
        resourceType: 'team',
        resourceId: teamId,
        details: {
          ...details,
          targetUserId,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date(),
        createdAt: new Date().toISOString(),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null
      };

      // ✅ Save to Firestore
      const docRef = await adminDb.collection('AuditLogs').add(auditLog);
      
      console.log('✅ Team action logged successfully:', docRef.id);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error logging team action:', error);
      // Don't throw - audit logging should not break main operations
      return null;
    }
  }

  /**
   * ✅ Convenience methods for common team actions
   */
  static async logMemberAdded(userId, organizationId, teamId, targetUserId, role, ipAddress, userAgent) {
    return this.logTeamAction({
      userId,
      organizationId,
      teamId,
      action: 'member_added',
      details: {
        role,
        description: `Added member with role: ${role}`
      },
      targetUserId,
      ipAddress,
      userAgent
    });
  }

  static async logMemberRemoved(userId, organizationId, teamId, targetUserId, ipAddress, userAgent) {
    return this.logTeamAction({
      userId,
      organizationId,
      teamId,
      action: 'member_removed',
      details: {
        description: 'Removed member from team'
      },
      targetUserId,
      ipAddress,
      userAgent
    });
  }

  static async logRoleUpdated(userId, organizationId, teamId, targetUserId, oldRole, newRole, ipAddress, userAgent) {
    return this.logTeamAction({
      userId,
      organizationId,
      teamId,
      action: 'role_updated',
      details: {
        oldRole,
        newRole,
        description: `Changed role from ${oldRole} to ${newRole}`
      },
      targetUserId,
      ipAddress,
      userAgent
    });
  }

  static async logInvitationSent(userId, organizationId, teamId, email, role, ipAddress, userAgent) {
    return this.logTeamAction({
      userId,
      organizationId,
      teamId,
      action: 'invitation_sent',
      details: {
        email,
        role,
        description: `Sent invitation to ${email} for ${role} role`
      },
      ipAddress,
      userAgent
    });
  }

  static async logInvitationRevoked(userId, organizationId, teamId, email, ipAddress, userAgent) {
    return this.logTeamAction({
      userId,
      organizationId,
      teamId,
      action: 'invitation_revoked',
      details: {
        email,
        description: `Revoked invitation for ${email}`
      },
      ipAddress,
      userAgent
    });
  }

  static async logInvitationResent(userId, organizationId, teamId, email, ipAddress, userAgent) {
    return this.logTeamAction({
      userId,
      organizationId,
      teamId,
      action: 'invitation_resent',
      details: {
        email,
        description: `Resent invitation to ${email}`
      },
      ipAddress,
      userAgent
    });
  }

  static async logPermissionsUpdated(userId, organizationId, teamId, changedRoles, ipAddress, userAgent) {
    return this.logTeamAction({
      userId,
      organizationId,
      teamId,
      action: 'team_permissions_updated',
      details: {
        affectedRoles: changedRoles,
        description: `Updated permissions for roles: ${changedRoles.join(', ')}`
      },
      ipAddress,
      userAgent
    });
  }

  static async logTeamSettingsChanged(userId, organizationId, teamId, changedFields, ipAddress, userAgent) {
    return this.logTeamAction({
      userId,
      organizationId,
      teamId,
      action: 'settings_changed',
      details: {
        changedFields,
        description: `Modified team settings: ${changedFields.join(', ')}`
      },
      ipAddress,
      userAgent
    });
  }

  /**
   * ✅ NEW: Log analytics impersonation events
   */
  static async logAnalyticsImpersonation({
    managerId,
    targetUserId,
    teamId,
    organizationId,
    period,
    dataTypes,
    requestId,
    ipAddress,
    userAgent
  }) {
    return this.logTeamAction({
      userId: managerId,
      organizationId,
      teamId,
      action: 'ANALYTICS_IMPERSONATION',
      details: {
        period,
        dataTypes,
        accessReason: 'Manager viewing team member analytics',
        requestId,
        description: `Manager accessed analytics for team member`
      },
      targetUserId,
      ipAddress,
      userAgent
    });
  }

  /**
   * ✅ Extract IP and User Agent from request (helper for API routes)
   */
  static getRequestMetadata(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0] : 
                     request.headers.get('x-real-ip') || 
                     request.ip || 
                     'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    return { ipAddress, userAgent };
  }

  /**
   * ✅ Clean up old audit logs (call this periodically)
   */
  static async cleanupOldLogs(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      console.log(`🧹 Cleaning up audit logs older than ${daysToKeep} days...`);
      
      const oldLogsQuery = adminDb.collection('AuditLogs')
        .where('timestamp', '<', cutoffDate)
        .limit(100); // Process in batches
      
      const snapshot = await oldLogsQuery.get();
      
      if (snapshot.empty) {
        console.log('✅ No old logs to clean up');
        return 0;
      }
      
      const batch = adminDb.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      console.log(`✅ Cleaned up ${snapshot.docs.length} old audit logs`);
      return snapshot.docs.length;
      
    } catch (error) {
      console.error('❌ Error cleaning up old audit logs:', error);
      return 0;
    }
  }
}

// ✅ EXPORT THE MISSING createAuditLogEntry FUNCTION
export async function createAuditLogEntry({
  teamId,
  action,
  performedBy,
  targetUserId = null,
  details = {},
  metadata = {}
}) {
  try {
    // ✅ Get organization ID from user context
    let organizationId = null;
    try {
      const userDoc = await adminDb.collection('AccountData').doc(performedBy).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        organizationId = userData.enterprise?.organizationId || null;
      }
    } catch (error) {
      console.warn('Could not fetch organization ID for audit log:', error);
    }

    return EnterpriseAuditService.logTeamAction({
      userId: performedBy,
      organizationId,
      teamId,
      action,
      details,
      targetUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent
    });
  } catch (error) {
    console.error('Error creating audit log entry:', error);
    return null;
  }
}

// ✅ EXPORT OTHER CONVENIENCE FUNCTIONS
export async function logMemberAdded(userId, organizationId, teamId, targetUserId, role, ipAddress, userAgent) {
  return EnterpriseAuditService.logMemberAdded(userId, organizationId, teamId, targetUserId, role, ipAddress, userAgent);
}

export async function logMemberRemoved(userId, organizationId, teamId, targetUserId, ipAddress, userAgent) {
  return EnterpriseAuditService.logMemberRemoved(userId, organizationId, teamId, targetUserId, ipAddress, userAgent);
}

export async function logRoleUpdated(userId, organizationId, teamId, targetUserId, oldRole, newRole, ipAddress, userAgent) {
  return EnterpriseAuditService.logRoleUpdated(userId, organizationId, teamId, targetUserId, oldRole, newRole, ipAddress, userAgent);
}

export async function logAnalyticsImpersonation(data) {
  return EnterpriseAuditService.logAnalyticsImpersonation(data);
}

export function getRequestMetadata(request) {
  return EnterpriseAuditService.getRequestMetadata(request);
}