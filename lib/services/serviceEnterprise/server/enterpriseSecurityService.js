// lib/services/serviceEnterprise/server/enterpriseSecurityService.js
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
   * Log security-related events with enhanced metadata
   */
 // In lib/services/serviceEnterprise/server/enterpriseSecurityService.js

static async logSecurityEvent({
    userId,
    action,
    details = {},
    severity = 'MEDIUM',
    ipAddress = null,
    userAgent = null
}) {
    try {
        console.log(`🔐 Security Event: ${action} by ${userId || 'anonymous'}`);
        
        const securityLog = {
            action,
            details,
            severity,
            timestamp: new Date(),
            createdAt: new Date().toISOString(),
            type: 'security_event'
        };

        // Only add fields if they have values (avoid undefined)
        if (userId) securityLog.userId = userId;
        if (ipAddress) securityLog.ipAddress = ipAddress;
        if (userAgent) securityLog.userAgent = userAgent;

        // Store in SecurityLogs collection for better organization
        await adminDb.collection('SecurityLogs').add(securityLog);
        
        // Also log to general audit for compliance (only if we have userId)
        if (userId) {
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
        }

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
    return this.logSecurityEvent({  // ✅ Fixed
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
        // Check for too many failed attempts in last hour
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);

        let recentFailures;
        let searchIdentifier;
        let searchValue;

        // Determine search strategy based on available identifiers
        if (userId) {
            // Search by userId for authenticated users
            searchIdentifier = 'userId';
            searchValue = userId;
            
            recentFailures = await adminDb.collection('SecurityLogs')
                .where('userId', '==', userId)
                .where('action', 'in', ['AUTH_FAILURE', 'PERMISSION_VIOLATION', 'CORS_VIOLATION', 'USERNAME_VALIDATION_FAILURE'])
                .where('timestamp', '>=', oneHourAgo)
                .get();
                
        } else if (ipAddress && ipAddress !== '127.0.0.1') {
            // Search by IP address for anonymous users (skip localhost)
            searchIdentifier = 'ipAddress';
            searchValue = ipAddress;
            
            recentFailures = await adminDb.collection('SecurityLogs')
                .where('ipAddress', '==', ipAddress)
                .where('action', 'in', ['AUTH_FAILURE', 'PERMISSION_VIOLATION', 'CORS_VIOLATION', 'USERNAME_VALIDATION_FAILURE'])
                .where('timestamp', '>=', oneHourAgo)
                .get();
                
        } else {
            // No reliable identifier available
            console.log('No reliable identifier for suspicious activity check');
            return {
                isSuspicious: false,
                reason: 'No identifier available for pattern analysis',
                shouldBlock: false
            };
        }

        const failureCount = recentFailures.size;
        
        console.log(`Suspicious activity check: ${failureCount} recent failures for ${searchIdentifier}=${searchValue}`);

        // Define thresholds based on user type
        const suspiciousThreshold = userId ? 15 : 10; // Higher threshold for authenticated users
        const blockingThreshold = userId ? 25 : 20;

        // Flag as suspicious if too many failures
        if (failureCount > suspiciousThreshold) {
            // Log the suspicious activity detection
            await this.logSuspiciousActivity(
                userId,
                'EXCESSIVE_FAILURES',
                {
                    failureCount,
                    timeWindow: '1 hour',
                    triggeredByAction: action,
                    searchIdentifier,
                    searchValue: searchValue.substring(0, 8) + '***' // Partial value for privacy
                },
                ipAddress,
                null
            );
            
            return {
                isSuspicious: true,
                reason: `${failureCount} failures in the last hour`,
                shouldBlock: failureCount > blockingThreshold
            };
        }

        return {
            isSuspicious: false,
            reason: null,
            shouldBlock: false
        };

    } catch (error) {
        console.error('Error checking suspicious activity:', error);
        
        // If it's an index error, provide helpful guidance
        if (error.message && error.message.includes('index')) {
            console.error('Firestore index required. Create the composite index in the Firebase console.');
            console.error('The error contains a URL to create the required index.');
        }
        
        // Don't block operations due to monitoring failures
        return {
            isSuspicious: false,
            reason: 'Error checking patterns - monitoring unavailable',
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

// ✅ EXPORT ALL NEEDED FUNCTIONS
export async function logAuditEvent(eventDetails) {
  return EnterpriseSecurityService.logAuditEvent(eventDetails);
}

export async function logSecurityEvent(eventDetails) {
  return EnterpriseSecurityService.logSecurityEvent(eventDetails);
}

export async function logAuthAttempt(userId, success, ipAddress, userAgent, reason = null) {
  return EnterpriseSecurityService.logAuthAttempt(userId, success, ipAddress, userAgent, reason);
}

export async function logPermissionViolation(userId, attemptedAction, teamId, ipAddress, userAgent) {
  return EnterpriseSecurityService.logPermissionViolation(userId, attemptedAction, teamId, ipAddress, userAgent);
}

export async function checkSuspiciousActivity(userId, action, ipAddress) {
  return EnterpriseSecurityService.checkSuspiciousActivity(userId, action, ipAddress);
}

export async function logSuspiciousActivity(userId, activity, details, ipAddress, userAgent) {
  return EnterpriseSecurityService.logSuspiciousActivity(userId, activity, details, ipAddress, userAgent);
}