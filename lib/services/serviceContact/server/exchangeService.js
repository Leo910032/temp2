// lib/services/serviceContact/server/exchangeService.js
// Server-side exchange service following enterprise pattern

import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { ContactSecurityService } from './contactSecurityService';
import { ContactValidationService } from './contactValidationService';
import { 
  CONTACT_STATUS, 
  CONTACT_SOURCES, 
  CONTACT_ACTIVITIES,
  CONTACT_ERROR_CODES 
} from '../client/services/constants/contactConstants';

export class ExchangeService {

  // ==================== PROFILE VERIFICATION ====================

  /**
   * Find user by username for exchange
   */
  static async findUserByUsername(username) {
    try {
      console.log('🔍 ExchangeService: Looking up user by username:', username);
      
      if (!username || typeof username !== 'string') {
        throw new Error('Valid username is required');
      }

      const querySnapshot = await adminDb.collection('AccountData')
        .where('username', '==', username.trim())
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        console.log('❌ ExchangeService: No user found with username:', username);
        return null;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      // Verify user is active and has exchange enabled
      if (userData.accountStatus === 'suspended' || userData.accountStatus === 'deleted') {
        console.log('❌ ExchangeService: User account is not active:', username);
        return null;
      }

      console.log('✅ ExchangeService: Found user:', {
        userId: userDoc.id,
        username: userData.username,
        displayName: userData.displayName
      });

      return {
        userId: userDoc.id,
        username: userData.username,
        displayName: userData.displayName,
        profilePicture: userData.profilePicture,
        accountType: userData.accountType,
        exchangeEnabled: userData.exchangeEnabled !== false // Default to true
      };

    } catch (error) {
      console.error('❌ ExchangeService: Error looking up user:', error);
      throw error;
    }
  }

  /**
   * Find user by ID for exchange
   */
  static async findUserById(userId) {
    try {
      console.log('🔍 ExchangeService: Looking up user by ID:', userId);
      
      if (!userId || typeof userId !== 'string') {
        throw new Error('Valid user ID is required');
      }

      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      
      if (!userDoc.exists) {
        console.log('❌ ExchangeService: No user found with ID:', userId);
        return null;
      }

      const userData = userDoc.data();
      
      // Verify user is active and has exchange enabled
      if (userData.accountStatus === 'suspended' || userData.accountStatus === 'deleted') {
        console.log('❌ ExchangeService: User account is not active:', userId);
        return null;
      }

      console.log('✅ ExchangeService: Found user by ID:', {
        userId,
        username: userData.username,
        displayName: userData.displayName
      });

      return {
        userId,
        username: userData.username,
        displayName: userData.displayName,
        profilePicture: userData.profilePicture,
        accountType: userData.accountType,
        exchangeEnabled: userData.exchangeEnabled !== false
      };

    } catch (error) {
      console.error('❌ ExchangeService: Error looking up user by ID:', error);
      throw error;
    }
  }

  /**
   * Verify profile exists and is available for exchange
   */
  static async verifyProfile(identifier, type = 'username') {
    try {
      let profileData;

      if (type === 'username') {
        profileData = await this.findUserByUsername(identifier);
      } else if (type === 'userId') {
        profileData = await this.findUserById(identifier);
      } else {
        throw new Error('Invalid identifier type');
      }

      if (!profileData) {
        return {
          exists: false,
          available: false,
          error: 'Profile not found'
        };
      }

      if (!profileData.exchangeEnabled) {
        return {
          exists: true,
          available: false,
          error: 'Exchange not enabled for this profile'
        };
      }

      return {
        exists: true,
        available: true,
        profile: {
          userId: profileData.userId,
          username: profileData.username,
          displayName: profileData.displayName,
          profilePicture: profileData.profilePicture
        }
      };

    } catch (error) {
      console.error('❌ ExchangeService: Error verifying profile:', error);
      throw error;
    }
  }

  // ==================== EXCHANGE SUBMISSION ====================

  /**
   * Submit exchange contact to target profile
   */
  static async submitExchangeContact(submissionData) {
    try {
      console.log('📝 ExchangeService: Submitting exchange contact');

      // Validate submission data
      const validation = this.validateSubmissionData(submissionData);
      if (!validation.isValid) {
        throw new Error(`Invalid submission data: ${validation.errors.join(', ')}`);
      }

      // Find target user
      let targetUser;
      if (submissionData.userId) {
        targetUser = await this.findUserById(submissionData.userId);
      } else if (submissionData.username) {
        targetUser = await this.findUserByUsername(submissionData.username);
      } else {
        throw new Error('Target profile identifier required');
      }

      if (!targetUser) {
        throw new Error('Target profile not found');
      }

      if (!targetUser.exchangeEnabled) {
        throw new Error('Exchange not enabled for target profile');
      }

      // Check rate limits
      await this.checkExchangeRateLimit(submissionData.metadata?.ip);

      // Prepare contact data
      const contactData = this.prepareContactData(submissionData.contact, submissionData.metadata);

      // Add to target user's contacts
      const contactId = await this.addExchangeContactToProfile(targetUser.userId, contactData);

      // Log exchange activity
      await this.logExchangeActivity({
        targetUserId: targetUser.userId,
        contactId,
        submissionData,
        success: true
      });

      console.log('✅ ExchangeService: Contact submitted successfully:', contactId);

      return {
        success: true,
        contactId,
        submittedAt: contactData.submittedAt,
        targetProfile: {
          userId: targetUser.userId,
          username: targetUser.username,
          displayName: targetUser.displayName
        }
      };

    } catch (error) {
      console.error('❌ ExchangeService: Error submitting exchange contact:', error);
      
      // Log failed attempt
      try {
        await this.logExchangeActivity({
          targetUserId: submissionData.userId || 'unknown',
          submissionData,
          success: false,
          error: error.message
        });
      } catch (logError) {
        console.error('❌ ExchangeService: Error logging failed attempt:', logError);
      }

      throw error;
    }
  }

  /**
   * Add exchange contact to user's profile
   */
  static async addExchangeContactToProfile(userId, contactData) {
    try {
      console.log('💾 ExchangeService: Adding exchange contact to profile:', userId);
      
      const contactsRef = adminDb.collection('Contacts').doc(userId);
      const contactsDoc = await contactsRef.get();
      
      let existingContacts = [];
      if (contactsDoc.exists) {
        existingContacts = contactsDoc.data().contacts || [];
      }

      // Check for recent duplicate (same email within 24 hours)
      const recentDuplicate = this.findRecentDuplicate(existingContacts, contactData);
      if (recentDuplicate) {
        console.log('⚠️ ExchangeService: Recent duplicate found, updating existing:', recentDuplicate.id);
        
        // Update existing contact with new information
        const updatedContacts = existingContacts.map(contact => 
          contact.id === recentDuplicate.id 
            ? { ...contact, ...contactData, lastModified: new Date().toISOString() }
            : contact
        );

        await contactsRef.update({
          contacts: updatedContacts,
          lastUpdated: FieldValue.serverTimestamp()
        });

        return recentDuplicate.id;
      }

      // Add new contact to the beginning of the array
      const updatedContacts = [contactData, ...existingContacts];

      // Update contact document with enhanced statistics
      await contactsRef.set({
        contacts: updatedContacts,
        lastUpdated: FieldValue.serverTimestamp(),
        totalContacts: updatedContacts.length,
        statistics: this.calculateContactStatistics(updatedContacts),
        exchange: {
          totalReceived: (contactsDoc.data()?.exchange?.totalReceived || 0) + 1,
          lastExchangeDate: new Date().toISOString(),
          recentExchanges: this.getRecentExchangeCount(updatedContacts)
        }
      }, { merge: true });

      console.log('✅ ExchangeService: Contact added successfully:', contactData.id);
      
      return contactData.id;

    } catch (error) {
      console.error('❌ ExchangeService: Error adding contact to profile:', error);
      throw error;
    }
  }

  // ==================== EXCHANGE ANALYTICS ====================

  /**
   * Get exchange statistics for a profile
   */
  static async getExchangeStats(userId) {
    try {
      console.log('📊 ExchangeService: Getting exchange stats for:', userId);

      const contactDoc = await adminDb.collection('Contacts').doc(userId).get();
      
      if (!contactDoc.exists) {
        return this.getEmptyExchangeStats();
      }

      const data = contactDoc.data();
      const contacts = data.contacts || [];
      const exchangeContacts = contacts.filter(c => c.source === CONTACT_SOURCES.EXCHANGE_FORM);

      // Calculate time-based statistics
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = {
        total: exchangeContacts.length,
        last24Hours: exchangeContacts.filter(c => new Date(c.submittedAt) > last24Hours).length,
        last7Days: exchangeContacts.filter(c => new Date(c.submittedAt) > last7Days).length,
        last30Days: exchangeContacts.filter(c => new Date(c.submittedAt) > last30Days).length,
        withLocation: exchangeContacts.filter(c => c.location && c.location.latitude).length,
        byStatus: {
          new: exchangeContacts.filter(c => c.status === CONTACT_STATUS.NEW).length,
          viewed: exchangeContacts.filter(c => c.status === CONTACT_STATUS.VIEWED).length,
          archived: exchangeContacts.filter(c => c.status === CONTACT_STATUS.ARCHIVED).length
        },
        recentContacts: exchangeContacts
          .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
          .slice(0, 10)
          .map(contact => ({
            id: contact.id,
            name: contact.name,
            email: contact.email,
            submittedAt: contact.submittedAt,
            hasLocation: !!(contact.location && contact.location.latitude)
          })),
        locationAnalytics: this.calculateLocationAnalytics(exchangeContacts),
        dailyTrends: this.calculateDailyTrends(exchangeContacts, last30Days, now)
      };

      console.log('✅ ExchangeService: Exchange stats calculated');
      return { stats };

    } catch (error) {
      console.error('❌ ExchangeService: Error getting exchange stats:', error);
      throw error;
    }
  }

  /**
   * Get exchange history for profile owner
   */
  static async getExchangeHistory(userId, filters = {}) {
    try {
      console.log('📋 ExchangeService: Getting exchange history for:', userId);

      const { limit = 50, offset = 0, status, startDate, endDate } = filters;

      const contactDoc = await adminDb.collection('Contacts').doc(userId).get();
      
      if (!contactDoc.exists) {
        return {
          exchanges: [],
          total: 0,
          hasMore: false
        };
      }

      let exchanges = (contactDoc.data().contacts || [])
        .filter(c => c.source === CONTACT_SOURCES.EXCHANGE_FORM);

      // Apply filters
      if (status && status !== 'all') {
        exchanges = exchanges.filter(c => c.status === status);
      }

      if (startDate) {
        const start = new Date(startDate);
        exchanges = exchanges.filter(c => new Date(c.submittedAt) >= start);
      }

      if (endDate) {
        const end = new Date(endDate);
        exchanges = exchanges.filter(c => new Date(c.submittedAt) <= end);
      }

      // Sort by submission date (newest first)
      exchanges.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

      // Apply pagination
      const total = exchanges.length;
      const paginatedExchanges = exchanges.slice(offset, offset + limit);

      // Enhance exchanges with display data
      const enhancedExchanges = paginatedExchanges.map(exchange => ({
        ...exchange,
        isRecent: this.isRecentExchange(exchange.submittedAt),
        hasLocation: !!(exchange.location && exchange.location.latitude),
        formattedDate: this.formatDate(exchange.submittedAt),
        locationAccuracy: exchange.location?.accuracy ? `~${Math.round(exchange.location.accuracy)}m` : null
      }));

      console.log('✅ ExchangeService: Exchange history retrieved:', {
        total,
        returned: paginatedExchanges.length,
        hasMore: offset + limit < total
      });

      return {
        exchanges: enhancedExchanges,
        total,
        hasMore: offset + limit < total,
        filters: {
          status,
          startDate,
          endDate,
          limit,
          offset
        }
      };

    } catch (error) {
      console.error('❌ ExchangeService: Error getting exchange history:', error);
      throw error;
    }
  }

  // ==================== VALIDATION AND SECURITY ====================

  /**
   * Validate submission data
   */
  static validateSubmissionData(submissionData) {
    const errors = [];

    if (!submissionData || typeof submissionData !== 'object') {
      errors.push('Submission data must be an object');
    }

    if (!submissionData.contact) {
      errors.push('Contact data is required');
    } else {
      const contactValidation = ContactValidationService.validateContactData(submissionData.contact);
      if (!contactValidation.isValid) {
        errors.push(...contactValidation.errors);
      }
    }

    if (!submissionData.userId && !submissionData.username) {
      errors.push('Target profile identifier required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check rate limits for exchange submissions
   */
  static async checkExchangeRateLimit(ip, maxSubmissions = 10, windowMinutes = 60) {
    try {
      if (!ip) return true; // Skip if IP not available

      const now = Date.now();
      const windowMs = windowMinutes * 60 * 1000;
      const cacheKey = `exchange_rate_limit_${ip}`;

      // Get from cache (in production, use Redis)
      const rateLimitDoc = await adminDb.collection('RateLimits').doc(cacheKey).get();
      
      let submissions = [];
      if (rateLimitDoc.exists) {
        submissions = rateLimitDoc.data().submissions || [];
      }

      // Remove old submissions outside time window
      submissions = submissions.filter(timestamp => now - timestamp < windowMs);

      // Check if limit exceeded
      if (submissions.length >= maxSubmissions) {
        throw new Error(`Exchange rate limit exceeded. Maximum ${maxSubmissions} submissions per ${windowMinutes} minutes.`);
      }

      // Add current submission
      submissions.push(now);

      // Update cache
      await adminDb.collection('RateLimits').doc(cacheKey).set({
        submissions,
        lastUpdated: FieldValue.serverTimestamp(),
        type: 'exchange_submission'
      });

      return true;

    } catch (error) {
      if (error.message.includes('rate limit exceeded')) {
        throw error;
      }
      
      console.error('❌ ExchangeService: Error checking rate limit:', error);
      // If rate limiting fails, allow the operation (fail open)
      return true;
    }
  }

  /**
   * Prepare contact data for storage
   */
  static prepareContactData(contactData, metadata = {}) {
    const now = new Date().toISOString();
    
    return {
      id: `exchange_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...ContactSecurityService.sanitizeContactData(contactData),
      status: CONTACT_STATUS.NEW,
      source: CONTACT_SOURCES.EXCHANGE_FORM,
      submittedAt: now,
      lastModified: now,
      metadata: {
        userAgent: metadata.userAgent || '',
        referrer: metadata.referrer || '',
        sessionId: metadata.sessionId || '',
        timezone: metadata.timezone || 'unknown',
        language: metadata.language || 'unknown',
        ip: metadata.ip || 'unknown',
        submissionTime: now
      }
    };
  }

  /**
   * Find recent duplicate contact
   */
  static findRecentDuplicate(existingContacts, newContact) {
    if (!newContact.email) return null;

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return existingContacts.find(contact => 
      contact.email === newContact.email &&
      contact.source === CONTACT_SOURCES.EXCHANGE_FORM &&
      new Date(contact.submittedAt) > last24Hours
    );
  }

  /**
   * Calculate contact statistics
   */
  static calculateContactStatistics(contacts) {
    return {
      totalSubmissions: contacts.length,
      newContacts: contacts.filter(c => c.status === CONTACT_STATUS.NEW).length,
      viewedContacts: contacts.filter(c => c.status === CONTACT_STATUS.VIEWED).length,
      archivedContacts: contacts.filter(c => c.status === CONTACT_STATUS.ARCHIVED).length,
      contactsWithLocation: contacts.filter(c => c.location && c.location.latitude).length,
      lastSubmissionDate: new Date().toISOString(),
      sources: {
        exchange_form: contacts.filter(c => c.source === CONTACT_SOURCES.EXCHANGE_FORM).length,
        business_card_scan: contacts.filter(c => c.source === CONTACT_SOURCES.BUSINESS_CARD_SCAN).length,
        manual: contacts.filter(c => c.source === CONTACT_SOURCES.MANUAL || !c.source).length,
        import: contacts.filter(c => c.source === CONTACT_SOURCES.IMPORT_CSV).length
      }
    };
  }

  /**
   * Get recent exchange count (last 7 days)
   */
  static getRecentExchangeCount(contacts) {
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return contacts.filter(c => 
      c.source === CONTACT_SOURCES.EXCHANGE_FORM &&
      new Date(c.submittedAt) > last7Days
    ).length;
  }

  /**
   * Log exchange activity
   */
  static async logExchangeActivity({ targetUserId, contactId, submissionData, success, error }) {
    try {
      const activityLog = {
        targetUserId,
        contactId: contactId || null,
        success,
        error: error || null,
        timestamp: new Date().toISOString(),
        metadata: {
          targetUsername: submissionData.username || null,
          contactEmail: submissionData.contact?.email || null,
          contactName: submissionData.contact?.name || null,
          hasLocation: !!(submissionData.contact?.location),
          ip: submissionData.metadata?.ip || 'unknown',
          userAgent: submissionData.metadata?.userAgent || 'unknown'
        }
      };

      await adminDb.collection('ExchangeAuditLogs').add(activityLog);
      
      console.log('📝 ExchangeService: Activity logged:', { targetUserId, success });
      return true;

    } catch (error) {
      console.error('❌ ExchangeService: Error logging activity:', error);
      // Don't throw - audit logging shouldn't break the main operation
      return false;
    }
  }

  // ==================== ANALYTICS HELPERS ====================

  /**
   * Calculate location analytics
   */
  static calculateLocationAnalytics(contacts) {
    const withLocation = contacts.filter(c => c.location && c.location.latitude);
    const withoutLocation = contacts.filter(c => !c.location || !c.location.latitude);
    
    return {
      withLocation: withLocation.length,
      withoutLocation: withoutLocation.length,
      locationPercentage: contacts.length > 0 ? (withLocation.length / contacts.length) * 100 : 0,
      averageAccuracy: withLocation.reduce((avg, contact) => {
        return avg + (contact.location.accuracy || 0);
      }, 0) / Math.max(withLocation.length, 1)
    };
  }

  /**
   * Calculate daily trends
   */
  static calculateDailyTrends(contacts, startDate, endDate) {
    const trends = [];
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayContacts = contacts.filter(contact => {
        const contactDate = new Date(contact.submittedAt);
        return contactDate >= dayStart && contactDate < dayEnd;
      });

      trends.push({
        date: dayStart.toISOString().split('T')[0],
        count: dayContacts.length
      });
    }

    return trends;
  }

  /**
   * Check if exchange is recent (within last 24 hours)
   */
  static isRecentExchange(submittedAt) {
    if (!submittedAt) return false;
    
    const exchangeDate = new Date(submittedAt);
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    return exchangeDate > oneDayAgo;
  }

  /**
   * Format date for display
   */
  static formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    
    try {
      const date = new Date(dateString);
      return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString(),
        relative: this.getRelativeTime(date),
        iso: date.toISOString()
      };
    } catch (error) {
      return 'Invalid date';
    }
  }

  /**
   * Get relative time (e.g., "2 hours ago")
   */
  static getRelativeTime(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks} week${diffInWeeks !== 1 ? 's' : ''} ago`;
    }

    return date.toLocaleDateString();
  }

  /**
   * Get empty exchange statistics
   */
  static getEmptyExchangeStats() {
    return {
      stats: {
        total: 0,
        last24Hours: 0,
        last7Days: 0,
        last30Days: 0,
        withLocation: 0,
        byStatus: {
          new: 0,
          viewed: 0,
          archived: 0
        },
        recentContacts: [],
        locationAnalytics: {
          withLocation: 0,
          withoutLocation: 0,
          locationPercentage: 0,
          averageAccuracy: 0
        },
        dailyTrends: []
      }
    };
  }

  /**
   * Clean up old exchange audit logs (call periodically)
   */
  static async cleanupOldExchangeLogs(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const oldLogsQuery = adminDb
        .collection('ExchangeAuditLogs')
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
      
      console.log(`🧹 ExchangeService: Cleaned up ${oldLogsSnapshot.size} old exchange audit logs`);
      return oldLogsSnapshot.size;

    } catch (error) {
      console.error('❌ ExchangeService: Error cleaning up old logs:', error);
      return 0;
    }
  }
}
