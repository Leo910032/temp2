//lib/services/serviceEnterprise/server/enterpriseSecurityService.js


import { adminDb } from '@/lib/firebaseAdmin';

export class EnterpriseSecurityService {

  /**
   * The main function for logging security events. It intelligently decides
   * where to log the event based on the context provided.
   */
  static async logSecurityEvent({
    // Optional context - if these are provided, the log is organization-specific
    session, 
    organizationId,

    // Required context for all events
    action,
    details = {},
    severity = 'MEDIUM',

    // Unauthenticated context - can be null for events like failed logins
    userId = null,
    ipAddress = null,
    userAgent = null
  }) {
    try {
      // Determine the context from the provided data
      const logUserId = session?.userId || userId;
      const logOrgId = session?.organizationId || organizationId;
      const logIp = session?.ipAddress || ipAddress;
      const logUa = session?.userAgent || userAgent;

      console.log(`🔐 Security Event: ${action} by ${logUserId || 'anonymous'}`);
      
      const securityLog = {
        action,
        details,
        severity,
        timestamp: new Date(),
        createdAt: new Date().toISOString(),
        type: 'security_event',
        // Only include fields if they exist
        ...(logUserId && { userId: logUserId }),
        ...(logOrgId && { organizationId: logOrgId }),
        ...(logIp && { ipAddress: logIp }),
        ...(logUa && { userAgent: logUa }),
      };

      // ✅ INTELLIGENT ROUTING LOGIC
      let logRef;
      if (logOrgId) {
        // If we have an organization ID, log it to the secure subcollection.
        logRef = adminDb.collection('organizations').doc(logOrgId).collection('securityLogs').doc();
        console.log(`   -> Logging to organization: ${logOrgId}`);
      } else {
        // If there's no organization context, log it to the top-level collection.
        logRef = adminDb.collection('TopLevelSecurityLogs').doc();
        console.log(`   -> Logging to top-level security collection.`);
      }

      await logRef.set(securityLog);

      // Also log to general audit for compliance (backward compatibility)
      if (logUserId) {
        await this._legacyAuditLog({
          userId: logUserId,
          action,
          details: {
            ...details,
            severity,
            ipAddress: logIp,
            eventType: 'security'
          },
          organizationId: logOrgId
        });
      }

      console.log('✅ Security event logged successfully');

    } catch (error) {
      console.error('❌ CRITICAL: Failed to log security event:', error);
      // Don't throw - logging failures shouldn't break operations
    }
  }

  /**
   * Legacy audit logging for backward compatibility
   * @private
   */
  static async _legacyAuditLog(eventDetails) {
    try {
      if (!eventDetails.userId || !eventDetails.action) {
        console.warn('Audit log event missing required fields (userId, action).');
        return;
      }
      const auditLog = {
        timestamp: new Date().toISOString(),
        severity: 'info',
        ...eventDetails,
      };
      await adminDb.collection('AuditLogs').add(auditLog);
    } catch (error) {
      console.error('CRITICAL: Failed to log legacy audit event.', error);
    }
  }

  /**
   * Main legacy audit function - preserved for backward compatibility
   */
  static async logAuditEvent(eventDetails) {
    return this._legacyAuditLog(eventDetails);
  }

  /**
   * Log authentication attempts - handles both authenticated and anonymous users
   */
  static async logAuthAttempt(userId, success, ipAddress, userAgent, reason = null) {
    return this.logSecurityEvent({
      userId, // Can be null for failed login attempts
      action: success ? 'AUTH_SUCCESS' : 'AUTH_FAILURE',
      details: {
        success,
        reason,
        timestamp: new Date().toISOString()
      },
      severity: success ? 'LOW' : 'MEDIUM',
      ipAddress,
      userAgent
    });
  }

  /**
   * Log permission violations - uses session if available
   */
  static async logPermissionViolation({ session, userId, attemptedAction, teamId, ipAddress, userAgent }) {
    return this.logSecurityEvent({
      session, // Pass the whole session if available
      userId: session?.userId || userId, // Fallback to direct userId
      action: 'PERMISSION_VIOLATION',
      details: { 
        attemptedAction, 
        teamId,
        timestamp: new Date().toISOString()
      },
      severity: 'HIGH',
      ipAddress: session?.ipAddress || ipAddress,
      userAgent: session?.userAgent || userAgent
    });
  }

  /**
   * Log suspicious activity - can handle anonymous users
   */
  static async logSuspiciousActivity({ session, userId, activity, details, ipAddress, userAgent }) {
    return this.logSecurityEvent({
      session,
      userId: session?.userId || userId, // Can be null
      action: 'SUSPICIOUS_ACTIVITY',
      details: {
        activity,
        ...details,
        timestamp: new Date().toISOString()
      },
      severity: 'HIGH',
      ipAddress: session?.ipAddress || ipAddress,
      userAgent: session?.userAgent || userAgent
    });
  }

  /**
   * Log CORS violations - specifically for middleware usage
   */
  static async logCorsViolation({ origin, ipAddress, userAgent, requestPath, method }) {
    return this.logSecurityEvent({
      // No session or userId - this is anonymous
      action: 'CORS_VIOLATION',
      details: {
        origin,
        requestPath,
        method,
        message: 'Request blocked due to invalid origin',
        timestamp: new Date().toISOString()
      },
      severity: 'HIGH',
      ipAddress,
      userAgent
    });
  }

  /**
   * Log general security threats - for middleware and anonymous contexts
   */
  static async logSecurityThreat({ threatType, origin, ipAddress, userAgent, details = {} }) {
    return this.logSecurityEvent({
      // No session or userId - anonymous threat
      action: 'SECURITY_THREAT',
      details: {
        threatType,
        origin,
        ...details,
        timestamp: new Date().toISOString()
      },
      severity: 'CRITICAL',
      ipAddress,
      userAgent
    });
  }

  /**
   * Get security events for a user (for investigation purposes)
   */
  static async getUserSecurityEvents(userId, organizationId = null, limit = 50) {
    try {
      let query;
      
      if (organizationId) {
        // Search in organization-specific logs
        query = adminDb.collection('organizations')
          .doc(organizationId)
          .collection('securityLogs')
          .where('userId', '==', userId);
      } else {
        // Search in top-level logs (legacy support)
        query = adminDb.collection('TopLevelSecurityLogs')
          .where('userId', '==', userId);
      }

      const events = await query
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return events.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp)
      }));
    } catch (error) {
      console.error('Error fetching user security events:', error);
      return [];
    }
  }

  /**
   * Check for suspicious patterns (rate limiting, etc.)
   */
  static async checkSuspiciousActivity(userId, action, ipAddress, organizationId = null) {
    try {
      // Check for too many failed attempts in last hour
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      let query;
      if (organizationId) {
        query = adminDb.collection('organizations')
          .doc(organizationId)
          .collection('securityLogs');
      } else {
        query = adminDb.collection('TopLevelSecurityLogs');
      }

      // Check by userId if available, otherwise by IP
      const searchField = userId ? 'userId' : 'ipAddress';
      const searchValue = userId || ipAddress;

      if (!searchValue) {
        return {
          isSuspicious: false,
          reason: 'No identifier available for pattern check',
          shouldBlock: false
        };
      }

      const recentFailures = await query
        .where(searchField, '==', searchValue)
        .where('action', 'in', ['AUTH_FAILURE', 'PERMISSION_VIOLATION', 'CORS_VIOLATION'])
        .where('timestamp', '>=', oneHourAgo)
        .get();

      const failureCount = recentFailures.size;

      // Flag as suspicious if too many failures
      if (failureCount > 10) {
        await this.logSuspiciousActivity({
          userId,
          activity: 'EXCESSIVE_FAILURES',
          details: {
            failureCount,
            timeWindow: '1 hour',
            triggeredByAction: action,
            searchField,
            searchValue
          },
          ipAddress
        });
        
        return {
          isSuspicious: true,
          reason: `${failureCount} failures in the last hour`,
          shouldBlock: failureCount > 20
        };
      }

      return {
        isSuspicious: false,
        reason: null,
        shouldBlock: false
      };

    } catch (error) {
      console.error('Error checking suspicious activity:', error);
      return {
        isSuspicious: false,
        reason: 'Error checking patterns',
        shouldBlock: false
      };
    }
  }

  /**
   * Clean up old security logs (call this periodically)
   */
  static async cleanupOldSecurityLogs(daysToKeep = 180) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      console.log(`🧹 Cleaning up security logs older than ${daysToKeep} days...`);
      
      // Clean up top-level logs
      const oldLogsQuery = adminDb.collection('TopLevelSecurityLogs')
        .where('timestamp', '<', cutoffDate)
        .limit(100);
      
      const snapshot = await oldLogsQuery.get();
      
      if (!snapshot.empty) {
        const batch = adminDb.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`✅ Cleaned up ${snapshot.docs.length} top-level security logs`);
      }
      
      // Note: Organization-specific logs would need separate cleanup logic
      // iterating through organizations
      
      return snapshot.docs.length;
      
    } catch (error) {
      console.error('❌ Error cleaning up old security logs:', error);
      return 0;
    }
  }

  /**
   * Team-specific audit logging - preserved for backward compatibility
   */
  static async logTeamAction({ userId, organizationId, action, resourceId, details }) {
    return this.logSecurityEvent({
      userId,
      organizationId,
      action,
      details: {
        resourceType: 'team',
        resourceId,
        ...details
      },
      severity: 'INFO'
    });
  }
}

// ✅ EXPORT ALL NEEDED FUNCTIONS FOR BACKWARD COMPATIBILITY
export async function logAuditEvent(eventDetails) {
  return EnterpriseSecurityService.logAuditEvent(eventDetails);
}

export async function logSecurityEvent(eventDetails) {
  return EnterpriseSecurityService.logSecurityEvent(eventDetails);
}

export async function logAuthAttempt(userId, success, ipAddress, userAgent, reason = null) {
  return EnterpriseSecurityService.logAuthAttempt(userId, success, ipAddress, userAgent, reason);
}





// ✅ NEW EXPORTS FOR MIDDLEWARE AND ANONYMOUS USAGE
export async function logCorsViolation(options) {
  return EnterpriseSecurityService.logCorsViolation(options);
}

export async function logSecurityThreat(options) {
  return EnterpriseSecurityService.logSecurityThreat(options);
}

export async function logPermissionViolation(options) {
  return EnterpriseSecurityService.logPermissionViolation(options);
}

export async function logSuspiciousActivity(options) {
  return EnterpriseSecurityService.logSuspiciousActivity(options);
}

export async function checkSuspiciousActivity(userId, action, ipAddress, organizationId = null) {
  return EnterpriseSecurityService.checkSuspiciousActivity(userId, action, ipAddress, organizationId);
}
