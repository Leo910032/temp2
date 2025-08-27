//lib/services/serviceEnterprise/server/enterpriseSecurityService.js
import { adminDb } from '@/lib/firebaseAdmin';

export class EnterpriseSecurityService {

  static async logAuditEvent(eventDetails) {
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
      console.error('CRITICAL: Failed to log audit event.', error);
    }
  }

  /**
   * ✅ ADDITIONAL SECURITY METHODS FOR IMPERSONATION
   */
  
  /**
   * Log security-related events with enhanced metadata
   */
  static async logSecurityEvent({
    userId,
    action,
    details = {},
    severity = 'MEDIUM',
    ipAddress = null,
    userAgent = null
  }) {
    try {
      console.log(`🔐 Security Event: ${action} by ${userId}`);
      
      const securityLog = {
        userId,
        action,
        details,
        severity,
        ipAddress,
        userAgent,
        timestamp: new Date(),
        createdAt: new Date().toISOString(),
        type: 'security_event'
      };

      // ✅ Store in SecurityLogs collection for better organization
      await adminDb.collection('SecurityLogs').add(securityLog);
      
      // ✅ Also log to general audit for compliance
      await this.logAuditEvent({
        userId,
        action,
        details: {
          ...details,
          severity,
          ipAddress,
          eventType: 'security'
        }
      });

      console.log('✅ Security event logged successfully');
    } catch (error) {
      console.error('❌ CRITICAL: Failed to log security event:', error);
      // Don't throw - logging failures shouldn't break operations
    }
  }

  /**
   * Log authentication attempts
   */
  static async logAuthAttempt(userId, success, ipAddress, userAgent, reason = null) {
    return this.logSecurityEvent({
      userId,
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
   * Log permission violations
   */
  static async logPermissionViolation(userId, attemptedAction, teamId, ipAddress, userAgent) {
    return this.logSecurityEvent({
      userId,
      action: 'PERMISSION_VIOLATION',
      details: {
        attemptedAction,
        teamId,
        timestamp: new Date().toISOString()
      },
      severity: 'HIGH',
      ipAddress,
      userAgent
    });
  }

  /**
   * Log suspicious activity
   */
  static async logSuspiciousActivity(userId, activity, details, ipAddress, userAgent) {
    return this.logSecurityEvent({
      userId,
      action: 'SUSPICIOUS_ACTIVITY',
      details: {
        activity,
        ...details,
        timestamp: new Date().toISOString()
      },
      severity: 'HIGH',
      ipAddress,
      userAgent
    });
  }

  /**
   * Get security events for a user (for investigation purposes)
   */
  static async getUserSecurityEvents(userId, limit = 50) {
    try {
      const events = await adminDb.collection('SecurityLogs')
        .where('userId', '==', userId)
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
  static async checkSuspiciousActivity(userId, action, ipAddress) {
    try {
      // ✅ Check for too many failed attempts in last hour
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const recentFailures = await adminDb.collection('SecurityLogs')
        .where('userId', '==', userId)
        .where('action', 'in', ['AUTH_FAILURE', 'PERMISSION_VIOLATION'])
        .where('timestamp', '>=', oneHourAgo)
        .get();

      const failureCount = recentFailures.size;

      // ✅ Flag as suspicious if too many failures
      if (failureCount > 10) {
        await this.logSuspiciousActivity(
          userId,
          'EXCESSIVE_FAILURES',
          {
            failureCount,
            timeWindow: '1 hour',
            triggeredByAction: action
          },
          ipAddress,
          null
        );
        
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
      
      const oldLogsQuery = adminDb.collection('SecurityLogs')
        .where('timestamp', '<', cutoffDate)
        .limit(100); // Process in batches
      
      const snapshot = await oldLogsQuery.get();
      
      if (snapshot.empty) {
        console.log('✅ No old security logs to clean up');
        return 0;
      }
      
      const batch = adminDb.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      console.log(`✅ Cleaned up ${snapshot.docs.length} old security logs`);
      return snapshot.docs.length;
      
    } catch (error) {
      console.error('❌ Error cleaning up old security logs:', error);
      return 0;
    }
  }
}

// ✅ EXPORT THE MISSING logSecurityEvent FUNCTION
export async function logSecurityEvent(eventDetails) {
  return EnterpriseSecurityService.logSecurityEvent(eventDetails);
}

// ✅ EXPORT OTHER USEFUL FUNCTIONS
export async function logAuthAttempt(userId, success, ipAddress, userAgent, reason = null) {
  return EnterpriseSecurityService.logAuthAttempt(userId, success, ipAddress, userAgent, reason);
}

export async function logPermissionViolation(userId, attemptedAction, teamId, ipAddress, userAgent) {
  return EnterpriseSecurityService.logPermissionViolation(userId, attemptedAction, teamId, ipAddress, userAgent);
}

export async function checkSuspiciousActivity(userId, action, ipAddress) {
  return EnterpriseSecurityService.checkSuspiciousActivity(userId, action, ipAddress);
}