// lib/services/serviceContact/server/contactSecurityService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export class ContactSecurityService {
  
  /**
   * Log contact activity for audit trail
   */
  static async logContactActivity({ userId, action, contactId = null, details = {} }) {
    try {
      const activityLog = {
        userId,
        action,
        contactId,
        details,
        timestamp: new Date().toISOString(),
        userAgent: details.userAgent || 'server',
        ip: details.ip || 'server'
      };

      // Store in audit log collection
      await adminDb.collection('ContactAuditLogs').add(activityLog);

      console.log('📝 Contact activity logged:', { userId, action, contactId });
      return true;

    } catch (error) {
      console.error('❌ Error logging contact activity:', error);
      // Don't throw - audit logging shouldn't break the main operation
      return false;
    }
  }

  /**
   * Validate user permissions for contact operations
   */
  static async validateContactPermissions(userId, operation, contactId = null) {
    try {
      // Get user's account data
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';

      // Check basic permissions based on subscription
      switch (operation) {
        case 'create':
        case 'read':
        case 'update':
        case 'delete':
          // Basic operations available to all subscription levels that have contacts enabled
          return this.hasBasicContactAccess(subscriptionLevel);

        case 'bulk_operations':
          return this.hasAdvancedFeature(subscriptionLevel, 'BULK_OPERATIONS');

        case 'export':
          return this.hasAdvancedFeature(subscriptionLevel, 'EXPORT_DATA');

        case 'business_card_scan':
          return this.hasAdvancedFeature(subscriptionLevel, 'BUSINESS_CARD_SCANNER');

        case 'team_sharing':
          return this.hasAdvancedFeature(subscriptionLevel, 'TEAM_SHARING');

        default:
          return false;
      }

    } catch (error) {
      console.error('❌ Error validating contact permissions:', error);
      return false;
    }
  }

  /**
   * Check if user has basic contact access
   */
  static hasBasicContactAccess(subscriptionLevel) {
    const levelsWithContactAccess = ['pro', 'premium', 'business', 'enterprise'];
    return levelsWithContactAccess.includes(subscriptionLevel);
  }

  /**
   * Check if user has advanced feature access
   */
  static hasAdvancedFeature(subscriptionLevel, feature) {
    // Import feature constants
    const featureMap = {
      'BULK_OPERATIONS': ['business', 'enterprise'],
      'EXPORT_DATA': ['pro', 'premium', 'business', 'enterprise'],
      'BUSINESS_CARD_SCANNER': ['pro', 'premium', 'business', 'enterprise'],
      'TEAM_SHARING': ['premium', 'business', 'enterprise'],
      'ADVANCED_GROUPS': ['premium', 'business', 'enterprise'],
      'API_ACCESS': ['enterprise']
    };

    const requiredLevels = featureMap[feature] || [];
    return requiredLevels.includes(subscriptionLevel);
  }

  /**
   * Sanitize contact data to prevent XSS and injection attacks
   */
  static sanitizeContactData(contactData) {
    const sanitized = {};
    
    // List of allowed fields
    const allowedFields = [
      'name', 'email', 'phone', 'company', 'jobTitle', 'website', 
      'message', 'status', 'source', 'location', 'details', 'tags'
    ];

    allowedFields.forEach(field => {
      if (contactData[field] !== undefined) {
        if (typeof contactData[field] === 'string') {
          // Basic XSS prevention - remove HTML tags and escape special chars
          sanitized[field] = this.sanitizeString(contactData[field]);
        } else if (field === 'location' && typeof contactData[field] === 'object') {
          // Sanitize location object
          sanitized[field] = this.sanitizeLocation(contactData[field]);
        } else if (field === 'details' && Array.isArray(contactData[field])) {
          // Sanitize details array
          sanitized[field] = this.sanitizeDetailsArray(contactData[field]);
        } else if (field === 'tags' && Array.isArray(contactData[field])) {
          // Sanitize tags array
          sanitized[field] = contactData[field].map(tag => 
            typeof tag === 'string' ? this.sanitizeString(tag) : ''
          ).filter(tag => tag.length > 0);
        } else {
          sanitized[field] = contactData[field];
        }
      }
    });

    return sanitized;
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input) {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>\"']/g, '') // Remove dangerous characters
      .trim()
      .substring(0, 1000); // Limit length
  }

  /**
   * Sanitize location object
   */
  static sanitizeLocation(location) {
    if (!location || typeof location !== 'object') return null;

    return {
      latitude: typeof location.latitude === 'number' ? location.latitude : null,
      longitude: typeof location.longitude === 'number' ? location.longitude : null,
      address: typeof location.address === 'string' ? this.sanitizeString(location.address) : null,
      accuracy: typeof location.accuracy === 'number' ? location.accuracy : null
    };
  }

  /**
   * Sanitize details array
   */
  static sanitizeDetailsArray(details) {
    if (!Array.isArray(details)) return [];

    return details
      .filter(detail => detail && typeof detail === 'object')
      .map(detail => ({
        label: typeof detail.label === 'string' ? this.sanitizeString(detail.label) : '',
        value: typeof detail.value === 'string' ? this.sanitizeString(detail.value) : '',
        type: typeof detail.type === 'string' ? this.sanitizeString(detail.type) : 'custom'
      }))
      .filter(detail => detail.label && detail.value)
      .slice(0, 20); // Limit number of details
  }

  /**
   * Rate limiting for contact operations
   */
  static async checkRateLimit(userId, operation) {
    try {
      const now = Date.now();
      const timeWindow = 60 * 1000; // 1 minute
      const rateLimits = {
        create: 10, // 10 creates per minute
        update: 20, // 20 updates per minute
        delete: 5,  // 5 deletes per minute
        scan: 3     // 3 scans per minute
      };

      const limit = rateLimits[operation] || 10;
      const cacheKey = `rate_limit_${userId}_${operation}`;

      // Get from cache (in production, use Redis)
      const rateLimitDoc = await adminDb.collection('RateLimits').doc(cacheKey).get();
      
      let requests = [];
      if (rateLimitDoc.exists) {
        requests = rateLimitDoc.data().requests || [];
      }

      // Remove old requests outside time window
      requests = requests.filter(timestamp => now - timestamp < timeWindow);

      // Check if limit exceeded
      if (requests.length >= limit) {
        throw new Error(`Rate limit exceeded. Maximum ${limit} ${operation} operations per minute.`);
      }

      // Add current request
      requests.push(now);

      // Update cache
      await adminDb.collection('RateLimits').doc(cacheKey).set({
        requests,
        lastUpdated: FieldValue.serverTimestamp()
      });

      return true;

    } catch (error) {
      if (error.message.includes('Rate limit exceeded')) {
        throw error;
      }
      
      console.error('❌ Error checking rate limit:', error);
      // If rate limiting fails, allow the operation (fail open)
      return true;
    }
  }

  /**
   * Validate contact data ownership
   */
  static async validateContactOwnership(userId, contactId) {
    try {
      const contactDoc = await adminDb.collection('Contacts').doc(userId).get();
      
      if (!contactDoc.exists) {
        return false;
      }

      const contacts = contactDoc.data().contacts || [];
      return contacts.some(contact => (contact.id || contact._id) === contactId);

    } catch (error) {
      console.error('❌ Error validating contact ownership:', error);
      return false;
    }
  }

  /**
   * Get user's contact operation history
   */
  static async getContactActivityLog(userId, limit = 100) {
    try {
      const logsQuery = adminDb
        .collection('ContactAuditLogs')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit);

      const logsSnapshot = await logsQuery.get();
      
      return logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    } catch (error) {
      console.error('❌ Error getting contact activity log:', error);
      return [];
    }
  }

  /**
   * Clean up old audit logs (call periodically)
   */
  static async cleanupOldAuditLogs(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const oldLogsQuery = adminDb
        .collection('ContactAuditLogs')
        .where('timestamp', '<', cutoffDate.toISOString())
        .limit(500); // Process in batches

      const oldLogsSnapshot = await oldLogsQuery.get();
      
      if (oldLogsSnapshot.empty) {
        return 0;
      }

      const batch = adminDb.batch();
      oldLogsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      
      console.log(`🧹 Cleaned up ${oldLogsSnapshot.size} old contact audit logs`);
      return oldLogsSnapshot.size;

    } catch (error) {
      console.error('❌ Error cleaning up old audit logs:', error);
      return 0;
    }
  }
}