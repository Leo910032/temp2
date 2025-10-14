// lib/services/serviceContact/server/exchangeService.js
// Server-side exchange service for handling contact exchange submissions

import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export class ExchangeService {

  /**
   * Submit exchange contact to target profile
   */
  static async submitExchangeContact(submissionData) {
    const startTime = Date.now();

    try {
      console.log('📝 ExchangeService: Submitting exchange contact');

      const { userId, username, contact, metadata } = submissionData;

      // Validate submission data
      this.validateSubmissionData(submissionData);

      // Find target user
      const targetUserId = await this.findTargetUser(userId, username);

      // Verify exchange is enabled
      const userData = await this.verifyExchangeEnabled(targetUserId);

      // Prepare contact data
      const contactData = this.prepareContactData(contact, metadata);

      // Add to target user's contacts
      const contactId = await this.addExchangeContactToProfile(targetUserId, contactData);

      // Log exchange activity
      await this.logExchangeActivity({
        targetUserId,
        contactId,
        submissionData,
        success: true
      });

      const totalTime = Date.now() - startTime;
      console.log(`✅ ExchangeService: Contact submitted successfully in ${totalTime}ms:`, contactId);

      return {
        success: true,
        contactId,
        submittedAt: contactData.submittedAt,
        targetProfile: {
          userId: targetUserId,
          username: userData.username,
          displayName: userData.profile?.displayName || userData.displayName
        },
        timing: `${totalTime}ms`
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ ExchangeService: Error submitting exchange contact after ${totalTime}ms:`, error);

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
   * Validate submission data
   */
  static validateSubmissionData(submissionData) {
    if (!submissionData || typeof submissionData !== 'object') {
      throw new Error('Submission data must be an object');
    }

    if (!submissionData.contact) {
      throw new Error('Contact data is required');
    }

    const { contact } = submissionData;

    if (!contact.name || !contact.email) {
      throw new Error('Name and email are required');
    }

    if (!submissionData.userId && !submissionData.username) {
      throw new Error('Target profile identifier required');
    }

    return true;
  }

  /**
   * Find target user by userId or username
   */
  static async findTargetUser(userId, username) {
    if (userId) {
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (userDoc.exists) {
        return userId;
      }
    }

    if (username) {
      const userQuery = await adminDb
        .collection('users')
        .where('username', '==', username.toLowerCase())
        .limit(1)
        .get();

      if (!userQuery.empty) {
        return userQuery.docs[0].id;
      }
    }

    throw new Error('Profile not found');
  }

  /**
   * Verify exchange is enabled for target user
   */
  static async verifyExchangeEnabled(userId) {
    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new Error('Profile not found');
    }

    const userData = userDoc.data();
    const settings = userData.settings || {};

    if (settings.contactExchangeEnabled === false) {
      throw new Error('Exchange not enabled for this profile');
    }

    return userData;
  }

  /**
   * Prepare contact data for storage
   */
  static prepareContactData(contact, metadata = {}) {
    const now = new Date().toISOString();
    const contactId = `exchange_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate incoming contact data
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 prepareContactData - Processing contact:', {
        name: contact.name,
        email: contact.email,
        dynamicFieldsCount: contact.dynamicFields?.length || 0
      });
    }

    // Ensure dynamicFields is an array and filter out any standard fields that leaked through
    // Use exact matches for standard field names to avoid false positives (e.g., "Company tagline" should not match "Company")
    // Store as object format: { "CompanyTagline": "value" }
    const standardFieldExactMatches = ['name', 'email', 'phone', 'company', 'job title', 'jobtitle', 'website', 'message', 'address', 'id', 'lastmodified', 'submittedat', 'status', 'source'];
    let cleanedDynamicFields = {};

    if (Array.isArray(contact.dynamicFields)) {
      const validFields = contact.dynamicFields.filter(field => {
        // Each field should be an object with label and value
        if (!field || typeof field !== 'object') {
          console.warn('⚠️ Invalid dynamic field (not an object):', field);
          return false;
        }

        // First check if field has isDynamic=false or type=standard
        if (field.isDynamic === false || field.type === 'standard') {
          console.warn(`⚠️ prepareContactData: Filtered out non-dynamic field "${field.label}" (isDynamic=false or type=standard)`);
          return false;
        }

        // Check if this field is actually a standard field using EXACT match
        const label = field.label?.toLowerCase().trim() || '';
        const isStandardField = standardFieldExactMatches.some(stdField => {
          // Exact match only - "company" should not match "company tagline"
          return label === stdField || label === stdField.replace(' ', '');
        });

        if (isStandardField) {
          console.warn(`⚠️ prepareContactData: Filtered out standard field "${field.label}" from dynamicFields (exact match)`);
          return false;
        }

        return true;
      });

      // Convert array to object format: { "CompanyTagline": "value", "LinkedIn": "url" }
      cleanedDynamicFields = {};
      validFields.forEach(field => {
        // Convert label to camelCase key (remove spaces, capitalize words)
        const key = field.label
          .split(' ')
          .map((word, index) => {
            word = word.trim();
            if (index === 0) {
              // First word: capitalize first letter
              return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }
            // Other words: capitalize first letter
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          })
          .join('');

        cleanedDynamicFields[key] = field.value;
      });

      console.log(`✅ prepareContactData: Cleaned dynamicFields - kept ${Object.keys(cleanedDynamicFields).length} out of ${contact.dynamicFields.length} fields`);
      if (Object.keys(cleanedDynamicFields).length > 0) {
        console.log('   Dynamic fields:', Object.entries(cleanedDynamicFields).map(([k, v]) => `${k}: ${v}`).join(', '));
      }
    }

    const preparedData = {
      id: contactId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone || '',
      company: contact.company || '',
      jobTitle: contact.jobTitle || '',
      website: contact.website || '',
      message: contact.message || '',
      location: contact.location || null,
      dynamicFields: cleanedDynamicFields,
      status: 'new',
      source: 'exchange_form',
      submittedAt: now,
      lastModified: now,
      metadata: {
        userAgent: metadata.userAgent || '',
        referrer: metadata.referrer || '',
        sessionId: metadata.sessionId || '',
        timezone: metadata.timezone || 'unknown',
        language: metadata.language || 'unknown',
        ip: metadata.ip || 'unknown',
        submissionTime: now,
        hasScannedData: !!(metadata.scannedCard)
      }
    };

    return preparedData;
  }

  /**
   * Add exchange contact to user's profile
   */
  static async addExchangeContactToProfile(userId, contactData) {
    const contactsRef = adminDb.collection('Contacts').doc(userId);
    const contactsDoc = await contactsRef.get();

    let existingContacts = [];
    if (contactsDoc.exists) {
      existingContacts = contactsDoc.data().contacts || [];
    }

    // Check for recent duplicate (same email within 24 hours)
    const recentDuplicate = this.findRecentDuplicate(existingContacts, contactData.email);

    if (recentDuplicate) {
      console.log(`⚠️ ExchangeService: Recent duplicate found, updating existing: ${recentDuplicate.id}`);

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

    await contactsRef.set({
      contacts: updatedContacts,
      lastUpdated: FieldValue.serverTimestamp(),
      totalContacts: updatedContacts.length,
      exchange: {
        totalReceived: (contactsDoc.data()?.exchange?.totalReceived || 0) + 1,
        lastExchangeDate: new Date().toISOString(),
      }
    }, { merge: true });

    return contactData.id;
  }

  /**
   * Find recent duplicate contact
   */
  static findRecentDuplicate(existingContacts, email) {
    if (!email) return null;

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return existingContacts.find(contact =>
      contact.email === email &&
      contact.source === 'exchange_form' &&
      new Date(contact.submittedAt) > last24Hours
    );
  }

  /**
   * Check rate limits for exchange submissions
   */
  static async checkExchangeRateLimit(ip, maxSubmissions = 60, windowMinutes = 60) {
    try {
      if (!ip || ip === 'unknown') return true;

      const now = Date.now();
      const windowMs = windowMinutes * 60 * 1000;
      const cacheKey = `exchange_rate_limit_${ip}`;

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
