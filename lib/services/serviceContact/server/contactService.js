// lib/services/serviceContact/server/contactService.js
// Main contact server service following enterprise pattern

import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { ContactSecurityService } from './contactSecurityService.js';
import { ContactValidationService } from './contactValidationService';
import { 
  CONTACT_STATUS, 
  CONTACT_FEATURES,
  CONTACT_SOURCES, 
  CONTACT_ACTIVITIES,
  ADVANCED_GROUPS,
  CONTACT_ERROR_CODES 
} from '../client/services/constants/contactConstants.js';

export class ContactService {

  // ==================== CORE CONTACT OPERATIONS ====================

  
  /**
   * Get contacts for a user with filtering and pagination
   */
  static async getUserContacts(userId, filters = {}) {
    try {
      console.log('📋 Getting user contacts:', { userId, filters });

      const { status, search, limit = 25, offset = 0 } = filters;

      // Get user's contact document
      const contactDoc = await adminDb.collection('Contacts').doc(userId).get();
      
      if (!contactDoc.exists) {
        return {
          contacts: [],
          total: 0,
          hasMore: false   
        };
      }

      let contacts = contactDoc.data().contacts || [];
      contacts.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

      // Apply filters
      if (status && status !== 'all') {
        contacts = contacts.filter(contact => contact.status === status);
      }

      if (search && search.trim()) {
        const searchTerm = search.toLowerCase();
        contacts = contacts.filter(contact => {
          const searchableText = [
            contact.name,
            contact.email,
            contact.phone,
            contact.company,
            contact.message,
            ...(contact.details || []).map(d => `${d.label} ${d.value}`)
          ].join(' ').toLowerCase();
          
          return searchableText.includes(searchTerm);
        });
      }

      // Calculate pagination
      const total = contacts.length;
      const paginatedContacts = contacts.slice(offset, offset + limit);

      // Enrich contacts with display data
      const enrichedContacts = paginatedContacts.map(contact => ({
        ...contact,
        isRecent: this.isRecentContact(contact.submittedAt),
        hasLocation: !!(contact.location && contact.location.latitude),
        displayName: contact.name || 'Unnamed Contact'
      }));

      console.log('✅ Contacts retrieved successfully:', {
        total,
        returned: paginatedContacts.length,
        hasMore: offset + limit < total
      });

      return {
        contacts: enrichedContacts,
        total,
        hasMore: offset + limit < total,
        filters: {
          status,
          search,
          limit,
          offset
        }
      };

    } catch (error) {
      console.error('❌ Error getting user contacts:', error);
      throw error;
    }
  }

  /**
   * Get single contact by ID
   */
  static async getContact(userId, contactId) {
    try {
      console.log('📋 Getting contact:', { userId, contactId });

      const contactDoc = await adminDb.collection('Contacts').doc(userId).get();
      
      if (!contactDoc.exists) {
        throw new Error('User has no contacts');
      }

      const contacts = contactDoc.data().contacts || [];
      const contact = contacts.find(c => (c.id || c._id) === contactId);

      if (!contact) {
        throw new Error('Contact not found');
      }

      console.log('✅ Contact found:', contact.name);
      return contact;

    } catch (error) {
      console.error('❌ Error getting contact:', error);
      throw error;
    }
  }

  /**
   * Create new contact
   */
  static async createContact(userId, contactData) {
    try {
      console.log('📝 Creating contact:', { userId, name: contactData.name });

      // Validate contact data
      const validation = ContactValidationService.validateContactData(contactData);
      if (!validation.isValid) {
        throw new Error(`Invalid contact data: ${validation.errors.join(', ')}`);
      }

      // Check for subscription limits
      await this.checkContactLimits(userId, 'create');

      // Prepare contact data
      const newContact = {
        ...contactData,
        id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: contactData.status || CONTACT_STATUS.NEW,
        source: contactData.source || CONTACT_SOURCES.MANUAL,
        submittedAt: contactData.submittedAt || new Date().toISOString(),
        lastModified: new Date().toISOString(),
        createdBy: userId
      };

      // Get or create user's contact document
      const contactDocRef = adminDb.collection('Contacts').doc(userId);
      const contactDoc = await contactDocRef.get();

      let contacts = [];
      if (contactDoc.exists) {
        contacts = contactDoc.data().contacts || [];
      }

      // Add new contact
      contacts.push(newContact);

      // Update document
      await contactDocRef.set({
        contacts,
        lastUpdated: FieldValue.serverTimestamp(),
        totalContacts: contacts.length
      }, { merge: true });

      // Log audit event
      await ContactSecurityService.logContactActivity({
        userId,
        action: CONTACT_ACTIVITIES.CREATED,
        contactId: newContact.id,
        details: {
          name: newContact.name,
          email: newContact.email,
          source: newContact.source
        }
      });

      console.log('✅ Contact created successfully:', newContact.id);
      return { contact: newContact, success: true };

    } catch (error) {
      console.error('❌ Error creating contact:', error);
      throw error;
    }
  }

// lib/services/serviceContact/server/contactService.js

// ... (imports)

// ... inside the ContactService class

static async updateContact(userId, contactId, updates) {
  try {
    console.log('📝 Updating contact:', { userId, contactId, updates });

    // Validate update data
    if (updates.name !== undefined || updates.email !== undefined) {
      const validation = ContactValidationService.validateContactData(updates);
      if (!validation.isValid) {app/api/user/contacts/[contactId]/route.js
code

        throw new Error(`Invalid contact data: ${validation.errors.join(', ')}`);
      }
    }

    const contactDocRef = adminDb.collection('Contacts').doc(userId);
    const contactDoc = await contactDocRef.get();

    if (!contactDoc.exists) {
      throw new Error('User has no contacts');
    }

    const contacts = contactDoc.data().contacts || [];
    const contactIndex = contacts.findIndex(c => (c.id || c._id) === contactId);

    if (contactIndex === -1) {
      throw new Error('Contact not found');
    }

    const originalContact = { ...contacts[contactIndex] };
    
    // ✅ NEW LOG: See the contact state BEFORE the update
    console.log('🔵 ORIGINAL contact state:', JSON.stringify(originalContact, null, 2));

    // Update contact
    contacts[contactIndex] = {
      ...contacts[contactIndex],
      ...updates,
      lastModified: new Date().toISOString()
    };
    
    // ✅ NEW LOG: See the contact state AFTER the update
    console.log('🟢 UPDATED contact state:', JSON.stringify(contacts[contactIndex], null, 2));

    // Save updated contacts
    await contactDocRef.update({
      contacts,
      lastUpdated: FieldValue.serverTimestamp()
    });

    const changes = this.getChangedFields(originalContact, contacts[contactIndex]);
    const cleanedChanges = ContactSecurityService.cleanUndefinedValues(changes);

    // ✅ NEW LOG: See the specific changes being sent to the audit log
    console.log('⚪️ CHANGES for audit log:', JSON.stringify(cleanedChanges, null, 2));

    // Log audit event with cleaned data
    await ContactSecurityService.logContactActivity({
      userId,
      action: CONTACT_ACTIVITIES.UPDATED,
      contactId,
      details: {
        changes: cleanedChanges
      }
    });

    console.log('✅ Contact updated successfully:', contactId);
    return { contact: contacts[contactIndex], success: true };

  } catch (error) {
    console.error('❌ Error updating contact:', error);
    throw error;
  }
}

  /**
   * Delete contact
   */
  static async deleteContact(userId, contactId) {
    try {
      console.log('🗑️ Deleting contact:', { userId, contactId });

      const contactDocRef = adminDb.collection('Contacts').doc(userId);
      const contactDoc = await contactDocRef.get();

      if (!contactDoc.exists) {
        throw new Error('User has no contacts');
      }

      const contacts = contactDoc.data().contacts || [];
      const contactIndex = contacts.findIndex(c => (c.id || c._id) === contactId);

      if (contactIndex === -1) {
        throw new Error('Contact not found');
      }

      const deletedContact = contacts[contactIndex];

      // Remove contact from array
      contacts.splice(contactIndex, 1);

      // Update document
      await contactDocRef.update({
        contacts,
        lastUpdated: FieldValue.serverTimestamp(),
        totalContacts: contacts.length
      });

      // Log audit event
      await ContactSecurityService.logContactActivity({
        userId,
        action: CONTACT_ACTIVITIES.DELETED,
        contactId,
        details: {
          name: deletedContact.name,
          email: deletedContact.email
        }
      });

      console.log('✅ Contact deleted successfully:', contactId);
      return { success: true, deletedContact };

    } catch (error) {
      console.error('❌ Error deleting contact:', error);
      throw error;
    }
  }

  /**
   * Update contact status
   */
  static async updateContactStatus(userId, contactId, newStatus) {
    try {
      console.log('🔄 Updating contact status:', { userId, contactId, newStatus });

      if (!Object.values(CONTACT_STATUS).includes(newStatus)) {
        throw new Error('Invalid contact status');
      }

      const result = await this.updateContact(userId, contactId, {
        status: newStatus,
        statusChangedAt: new Date().toISOString()
      });

      // Log specific audit event
      await ContactSecurityService.logContactActivity({
        userId,
        action: CONTACT_ACTIVITIES.STATUS_CHANGED,
        contactId,
        details: {
          newStatus,
          timestamp: new Date().toISOString()
        }
      });

      return result;

    } catch (error) {
      console.error('❌ Error updating contact status:', error);
      throw error;
    }
  }

  /**
   * Bulk update contacts
   */
  static async bulkUpdateContacts(userId, contactIds, updates) {
    try {
      console.log('📦 Bulk updating contacts:', { userId, count: contactIds.length });

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        throw new Error('Contact IDs must be a non-empty array');
      }

      const contactDocRef = adminDb.collection('Contacts').doc(userId);
      const contactDoc = await contactDocRef.get();

      if (!contactDoc.exists) {
        throw new Error('User has no contacts');
      }

      const contacts = contactDoc.data().contacts || [];
      let updatedCount = 0;

      // Update matching contacts
      contactIds.forEach(contactId => {
        const contactIndex = contacts.findIndex(c => (c.id || c._id) === contactId);
        if (contactIndex !== -1) {
          contacts[contactIndex] = {
            ...contacts[contactIndex],
            ...updates,
            lastModified: new Date().toISOString()
          };
          updatedCount++;
        }
      });

      if (updatedCount === 0) {
        throw new Error('No contacts found to update');
      }

      // Save updated contacts
      await contactDocRef.update({
        contacts,
        lastUpdated: FieldValue.serverTimestamp()
      });

      console.log('✅ Bulk update completed:', { updatedCount });
      return { success: true, updatedCount };

    } catch (error) {
      console.error('❌ Error bulk updating contacts:', error);
      throw error;
    }
  }

  // ==================== IMPORT/EXPORT OPERATIONS ====================

  /**
   * Import contacts from parsed data
   */
/**
   * Import contacts from parsed data
   * ✅ MODIFIED: Now uses the stricter validation and sanitation service for each row.
   */
  static async importContacts(userId, contactsData, source = 'import_csv') {
    try {
      console.log('📥 Importing contacts:', { userId, count: contactsData.length });

      if (!Array.isArray(contactsData) || contactsData.length === 0) {
        throw new Error('No contact data provided for import.');
      }

      await this.checkContactLimits(userId, 'import', contactsData.length);

      const contactDocRef = adminDb.collection('Contacts').doc(userId);
      const contactDoc = await contactDocRef.get();

      const existingContacts = contactDoc.exists ? contactDoc.data().contacts || [] : [];
      const existingEmails = new Set(existingContacts.map(c => c.email?.toLowerCase()).filter(Boolean));

      const newContacts = [];
      const errors = [];
      const duplicates = [];

      for (const [index, rawRowData] of contactsData.entries()) {
        const rowNumber = index + 2; // Assuming row 1 is the header

        try {
          // 1. Sanitize and validate the row using our new strict method
          const { sanitizedContact, validationResult } = ContactValidationService.sanitizeAndValidateImportRow(rawRowData);

          if (!validationResult.isValid) {
            errors.push({
              row: rowNumber,
              data: rawRowData,
              errors: validationResult.errors,
            });
            continue;
          }

          // 2. Check for duplicate email (both in DB and in the current file)
          const email = sanitizedContact.email?.toLowerCase();
          if (email) {
            if (existingEmails.has(email)) {
              duplicates.push({
                row: rowNumber,
                email: sanitizedContact.email,
              });
              continue;
            }
          }

          // 3. Prepare the final, clean contact object for creation
          const newContact = {
            ...sanitizedContact, // Use the clean, validated data
            id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: CONTACT_STATUS.NEW,
            source: source,
            submittedAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            createdBy: userId
          };

          newContacts.push(newContact);
          // Add the new email to our set to prevent duplicates within the same file
          if (email) {
            existingEmails.add(email);
          }

        } catch (error) {
          errors.push({
            row: rowNumber,
            data: rawRowData,
            errors: [error.message],
          });
        }
      }

      // Only proceed with database write if there are valid new contacts
      if (newContacts.length > 0) {
        const allContacts = [...existingContacts, ...newContacts];
        await contactDocRef.set({
          contacts: allContacts,
          lastUpdated: FieldValue.serverTimestamp(),
          totalContacts: allContacts.length
        }, { merge: true });

        await ContactSecurityService.logContactActivity({
          userId,
          action: CONTACT_ACTIVITIES.IMPORTED,
          details: { /* ... logging details ... */ }
        });
      }

      console.log('✅ Import completed:', {
        imported: newContacts.length,
        duplicates: duplicates.length,
        errors: errors.length
      });

      // Return a detailed result to the frontend
      return {
        success: true,
        imported: newContacts.length,
        duplicates: duplicates.length,
        errors: errors.length,
        duplicateList: duplicates,
        errorList: errors
      };

    } catch (error) {
      console.error('❌ Error importing contacts:', error);
      throw error;
    }
  }

  /**
   * Export contacts to various formats
   */
  static async exportContacts(userId, format = 'csv', filters = {}) {
    try {
      console.log('📤 Exporting contacts:', { userId, format, filters });

      // First, get all contacts that match the filters.
      // We set a high limit to ensure we get all of them for the export.
      const contactsResult = await this.getUserContacts(userId, { ...filters, limit: 10000, offset: 0 });
      
      // ✅ THE FIX: Correctly access the .contacts property from the result object.
      const contacts = contactsResult.contacts;

      if (!contacts || contacts.length === 0) {
        throw new Error('No contacts found matching the specified criteria to export.');
      }

      let exportData;
      let filename;
      let contentType;

      // ... (the switch statement for csv, json, vcf is correct)
      switch (format.toLowerCase()) {
        case 'json':
          exportData = JSON.stringify(contacts, null, 2);
          filename = `contacts_${new Date().toISOString().split('T')[0]}.json`;
          contentType = 'application/json';
          break;
        case 'csv':
          exportData = this.convertContactsToCSV(contacts);
          filename = `contacts_${new Date().toISOString().split('T')[0]}.csv`;
          contentType = 'text/csv';
          break;
        case 'vcf':
          exportData = this.convertContactsToVCF(contacts);
          filename = `contacts_${new Date().toISOString().split('T')[0]}.vcf`;
          contentType = 'text/vcard';
          break;
        default:
          throw new Error('Unsupported export format');
      }

      // Log the audit event (this is correct)
      await ContactSecurityService.logContactActivity({
        userId,
        action: CONTACT_ACTIVITIES.EXPORTED,
        details: {
          format,
          contactCount: contacts.length,
          filters
        }
      });

      console.log('✅ Export completed:', { format, count: contacts.length });

      return {
        data: exportData,
        filename,
        contentType,
        contactCount: contacts.length
      };

    } catch (error) {
      console.error('❌ Error exporting contacts:', error);
      throw error;
    }
  }

  // ==================== BUSINESS CARD SCANNING ====================

  /**
   * Process business card scan results
   */
  static async processBusinessCardScan(userId, imageBase64) {
    try {
      console.log('📇 Processing business card scan for user:', userId);

      // Validate image data
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        throw new Error('Invalid image data provided');
      }

      // Here you would integrate with your business card scanning service
      // For now, we'll simulate the scanning process
      const scanResult = await this.simulateBusinessCardScan(imageBase64);

      // Log audit event
      await ContactSecurityService.logContactActivity({
        userId,
        action: CONTACT_ACTIVITIES.BUSINESS_CARD_SCANNED,
        details: {
          fieldsDetected: scanResult.parsedFields.length,
          confidence: scanResult.metadata.hasRequiredFields ? 'high' : 'medium'
        }
      });

      console.log('✅ Business card scan completed');
      return scanResult;

    } catch (error) {
      console.error('❌ Error processing business card scan:', error);
      throw error;
    }
  }

  // ==================== SEARCH OPERATIONS ====================

  /**
   * Advanced search for contacts
   */
  static async searchContacts(userId, searchQuery, advancedFilters = {}) {
    try {
      console.log('🔍 Searching contacts:', { userId, searchQuery, advancedFilters });

      // Base filters
      const filters = {
        search: searchQuery,
        status: advancedFilters.status,
        limit: advancedFilters.limit || 100,
        offset: advancedFilters.offset || 0
      };

      // Get contacts using basic search
      let result = await this.getUserContacts(userId, filters);
      let contacts = result.contacts;

      // Apply advanced filters
      if (advancedFilters.hasLocation !== undefined) {
        contacts = contacts.filter(contact => {
          const hasLoc = !!(contact.location && contact.location.latitude);
          return advancedFilters.hasLocation ? hasLoc : !hasLoc;
        });
      }

      if (advancedFilters.source) {
        contacts = contacts.filter(contact => contact.source === advancedFilters.source);
      }

      if (advancedFilters.dateRange) {
        const { start, end } = advancedFilters.dateRange;
        if (start && end) {
          const startDate = new Date(start);
          const endDate = new Date(end);
          
          contacts = contacts.filter(contact => {
            const contactDate = new Date(contact.submittedAt);
            return contactDate >= startDate && contactDate <= endDate;
          });
        }
      }

      return {
        ...result,
        contacts,
        total: contacts.length
      };

    } catch (error) {
      console.error('❌ Error searching contacts:', error);
      throw error;
    }
  }

  // ==================== STATISTICS AND ANALYTICS ====================

  /**
   * Get contact statistics for user
   */
  static async getContactStats(userId) {
    try {
      console.log('📊 Getting contact statistics for user:', userId);

      const contactDoc = await adminDb.collection('Contacts').doc(userId).get();
      
      if (!contactDoc.exists) {
        return this.getEmptyStats();
      }

      const contacts = contactDoc.data().contacts || [];

      const stats = {
        total: contacts.length,
        byStatus: {
          new: contacts.filter(c => c.status === 'new').length,
          viewed: contacts.filter(c => c.status === 'viewed').length,
          archived: contacts.filter(c => c.status === 'archived').length
        },
        bySource: {},
        withLocation: contacts.filter(c => c.location && c.location.latitude).length,
        locationStats: {
          withLocation: contacts.filter(c => c.location && c.location.latitude).length,
          withoutLocation: contacts.filter(c => !c.location || !c.location.latitude).length
        },
        recentContacts: contacts
          .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
          .slice(0, 5),
        lastUpdated: new Date().toISOString()
      };

      // Calculate sources
      contacts.forEach(contact => {
        const source = contact.source || 'manual';
        stats.bySource[source] = (stats.bySource[source] || 0) + 1;
      });

      console.log('✅ Contact statistics calculated');
      return { stats };

    } catch (error) {
      console.error('❌ Error getting contact stats:', error);
      throw error;
    }
  }

  /**
   * Get contact analytics data
   */
  static async getContactAnalytics(userId, period = '30d') {
    try {
      console.log('📈 Getting contact analytics:', { userId, period });

      const contactDoc = await adminDb.collection('Contacts').doc(userId).get();
      
      if (!contactDoc.exists) {
        return this.getEmptyAnalytics();
      }

      const contacts = contactDoc.data().contacts || [];
      const now = new Date();
      let periodStart;

      // Calculate period start date
      switch (period) {
        case '7d':
          periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '6m':
          periodStart = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          periodStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Filter contacts for the period
      const periodContacts = contacts.filter(contact => 
        new Date(contact.submittedAt) >= periodStart
      );

      const analytics = {
        period,
        periodStart: periodStart.toISOString(),
        periodEnd: now.toISOString(),
        totalContacts: contacts.length,
        periodContacts: periodContacts.length,
        growthRate: this.calculateGrowthRate(contacts, periodStart),
        sourceDistribution: this.calculateSourceDistribution(periodContacts),
        statusDistribution: this.calculateStatusDistribution(periodContacts),
        locationAnalytics: this.calculateLocationAnalytics(periodContacts),
        dailyTrends: this.calculateDailyTrends(periodContacts, periodStart, now),
        topSources: this.getTopSources(periodContacts),
        engagement: this.calculateEngagementMetrics(contacts)
      };

      return { analytics };

    } catch (error) {
      console.error('❌ Error getting contact analytics:', error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Check contact limits based on subscription
   */
  static async checkContactLimits(userId, operation, count = 1) {
    try {
      // Get user's subscription data
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';

      // Import subscription limits from constants
      const { getContactLimits } = await import('../client/services/constants/contactConstants.js');
      const limits = getContactLimits(subscriptionLevel);

      if (limits.maxContacts === 0 && operation === 'create') {
        throw new Error('Contact features not available on your current plan');
      }

      if (limits.maxContacts > 0) {
        // Get current contact count
        const contactDoc = await adminDb.collection('Contacts').doc(userId).get();
        const currentCount = contactDoc.exists ? (contactDoc.data().contacts || []).length : 0;

        if (currentCount + count > limits.maxContacts) {
          throw new Error(`Contact limit reached (${limits.maxContacts}). Upgrade your plan for more contacts.`);
        }
      }

      return true;

    } catch (error) {
      console.error('Error checking contact limits:', error);
      throw error;
    }
  }

/**
 * Get changed fields between two contact objects
 * ✅ FIXED: Handle undefined values to prevent Firestore errors
 */
static getChangedFields(original, updated) {
  const changes = {};
  
  Object.keys(updated).forEach(key => {
    if (original[key] !== updated[key] && key !== 'lastModified') {
      changes[key] = {
        // ✅ Convert undefined to null for Firestore compatibility
        from: original[key] !== undefined ? original[key] : null,
        to: updated[key] !== undefined ? updated[key] : null
      };
    }
  });

  return changes;
}

  /**
   * Check if contact is recent (within last 7 days)
   */
  static isRecentContact(submittedAt) {
    if (!submittedAt) return false;
    
    const contactDate = new Date(submittedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return contactDate > sevenDaysAgo;
  }

  /**
   * Convert contacts to CSV format
   */
  static convertContactsToCSV(contacts) {
    const headers = ['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Website', 'Status', 'Source', 'Date Added'];
    
    const csvRows = [headers];
    
    contacts.forEach(contact => {
      csvRows.push([
        contact.name || '',
        contact.email || '',
        contact.phone || '',
        contact.company || '',
        contact.jobTitle || '',
        contact.website || '',
        contact.status || '',
        contact.source || '',
        contact.submittedAt || ''
      ]);
    });

    return csvRows.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }

  /**
   * Convert contacts to VCF format
   */
  static convertContactsToVCF(contacts) {
    return contacts.map(contact => {
      let vcard = 'BEGIN:VCARD\r\nVERSION:3.0\r\n';
      
      if (contact.name) vcard += `FN:${contact.name}\r\n`;
      if (contact.email) vcard += `EMAIL:${contact.email}\r\n`;
      if (contact.phone) vcard += `TEL:${contact.phone}\r\n`;
      if (contact.company) vcard += `ORG:${contact.company}\r\n`;
      if (contact.jobTitle) vcard += `TITLE:${contact.jobTitle}\r\n`;
      if (contact.website) vcard += `URL:${contact.website}\r\n`;
      
      vcard += 'END:VCARD\r\n';
      return vcard;
    }).join('\r\n');
  }

  /**
   * Simulate business card scanning (replace with actual OCR service)
   */
  static async simulateBusinessCardScan(imageBase64) {
    // This is a placeholder - replace with actual OCR/AI service
    return {
      success: true,
      parsedFields: [
        { label: 'Name', value: '', type: 'standard' },
        { label: 'Email', value: '', type: 'standard' },
        { label: 'Phone', value: '', type: 'standard' },
        { label: 'Company', value: '', type: 'standard' },
        { label: 'Job Title', value: '', type: 'custom' },
        { label: 'Website', value: '', type: 'custom' }
      ],
      metadata: {
        hasQRCode: false,
        fieldsCount: 6,
        fieldsWithData: 0,
        hasRequiredFields: false,
        processedAt: new Date().toISOString(),
        processingMethod: 'simulated'
      }
    };
  }

  /**
   * Calculate growth rate for analytics
   */
  static calculateGrowthRate(contacts, periodStart) {
    const currentPeriodContacts = contacts.filter(c => 
      new Date(c.submittedAt) >= periodStart
    );
    
    const previousPeriodStart = new Date(periodStart.getTime() - (Date.now() - periodStart.getTime()));
    const previousPeriodContacts = contacts.filter(c => {
      const date = new Date(c.submittedAt);
      return date >= previousPeriodStart && date < periodStart;
    });

    if (previousPeriodContacts.length === 0) {
      return currentPeriodContacts.length > 0 ? 100 : 0;
    }

    return ((currentPeriodContacts.length - previousPeriodContacts.length) / previousPeriodContacts.length) * 100;
  }

  /**
   * Calculate source distribution for analytics
   */
  static calculateSourceDistribution(contacts) {
    const distribution = {};
    contacts.forEach(contact => {
      const source = contact.source || 'manual';
      distribution[source] = (distribution[source] || 0) + 1;
    });
    return distribution;
  }
   /**
   * Calculate status distribution for analytics
   */
  static calculateStatusDistribution(contacts) {
    const distribution = {};
    contacts.forEach(contact => {
      const status = contact.status || 'new';
      distribution[status] = (distribution[status] || 0) + 1;
    });
  }
  /**
   * Calculate location analytics for contacts
   */
  static calculateLocationAnalytics(contacts) {
    const withLocation = contacts.filter(c => c.location && c.location.latitude);
    const withoutLocation = contacts.filter(c => !c.location || !c.location.latitude);
    
    return {
      withLocation: withLocation.length,
      withoutLocation: withoutLocation.length,
      locationPercentage: contacts.length > 0 ? (withLocation.length / contacts.length) * 100 : 0,
      locationAccuracy: withLocation.reduce((avg, contact) => {
        return avg + (contact.location.accuracy || 0);
      }, 0) / Math.max(withLocation.length, 1)
    };
  }

  /**
   * Calculate daily trends for analytics
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
   * Get top sources for analytics
   */
  static getTopSources(contacts) {
    const sourceCount = {};
    contacts.forEach(contact => {
      const source = contact.source || 'manual';
      sourceCount[source] = (sourceCount[source] || 0) + 1;
    });

    return Object.entries(sourceCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([source, count]) => ({ source, count }));
  }

  /**
   * Calculate engagement metrics
   */
  static calculateEngagementMetrics(contacts) {
    const total = contacts.length;
    if (total === 0) return { viewRate: 0, archiveRate: 0, averageDaysToView: 0 };

    const viewed = contacts.filter(c => c.status === 'viewed' || c.status === 'archived').length;
    const archived = contacts.filter(c => c.status === 'archived').length;

    // Calculate average days to view
    const viewedContacts = contacts.filter(c => c.statusChangedAt && c.status !== 'new');
    const averageDaysToView = viewedContacts.length > 0 
      ? viewedContacts.reduce((avg, contact) => {
          const submitted = new Date(contact.submittedAt);
          const statusChanged = new Date(contact.statusChangedAt);
          const days = (statusChanged.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24);
          return avg + days;
        }, 0) / viewedContacts.length
      : 0;

    return {
      viewRate: (viewed / total) * 100,
      archiveRate: (archived / total) * 100,
      averageDaysToView: Math.round(averageDaysToView * 100) / 100
    };
  }

  /**
   * Get empty statistics object
   */
  static getEmptyStats() {
    return {
      stats: {
        total: 0,
        byStatus: { new: 0, viewed: 0, archived: 0 },
        bySource: {},
        withLocation: 0,
        locationStats: { withLocation: 0, withoutLocation: 0 },
        recentContacts: [],
        lastUpdated: new Date().toISOString()
      }
    };
  }

  /**
   * Get empty analytics object
   */
  static getEmptyAnalytics() {
    return {
      analytics: {
        period: '30d',
        totalContacts: 0,
        periodContacts: 0,
        growthRate: 0,
        sourceDistribution: {},
        statusDistribution: {},
        locationAnalytics: { withLocation: 0, withoutLocation: 0, locationPercentage: 0, locationAccuracy: 0 },
        dailyTrends: [],
        topSources: [],
        engagement: { viewRate: 0, archiveRate: 0, averageDaysToView: 0 }
      }
    };
  }

  /**
   * Validate subscription level has required features
   */
  static async validateFeatureAccess(userId, feature) {
    try {
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';

      // Import feature checking from constants
      const { hasContactFeature } = await import('../client/services/constants/contactConstants.js');
      
      if (!hasContactFeature(subscriptionLevel, feature)) {
        throw new Error(`This feature requires a subscription upgrade. Current plan: ${subscriptionLevel}`);
      }

      return true;

    } catch (error) {
      console.error('Error validating feature access:', error);
      throw error;
    }
  }

  /**
   * Get subscription status for contacts
   */
  static async getSubscriptionStatus(userId) {
    try {
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      
      if (!userDoc.exists) {
        return {
          subscriptionLevel: 'base',
          canAccessContacts: false,
          features: [],
          limits: { maxContacts: 0, maxGroups: 0, maxShares: 0, canExport: false }
        };
      }

      const userData = userDoc.data();
      const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';

      // Import subscription utilities from constants
      const { hasContactFeature, getContactLimits, CONTACT_FEATURES } = await import('../client/services/constants/contactConstants.js');
      const limits = getContactLimits(subscriptionLevel);

      // Get available features for this subscription level
      const features = Object.values(CONTACT_FEATURES).filter(feature => 
        hasContactFeature(subscriptionLevel, feature)
      );

      return {
        subscriptionLevel,
        canAccessContacts: features.includes(CONTACT_FEATURES.BASIC_CONTACTS),
        features,
        limits,
        user: {
          displayName: userData.displayName,
          email: userData.email,
          username: userData.username
        }
      };

    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw error;
    }
  }
}

// =============================================================================
// --- CONTACT GROUP SERVICE ---
// =============================================================================

export class ContactGroupService {

  /**
   * Get all contact groups for a user
   */
  static async getContactGroups(userId) {
    try {
      console.log('📁 Getting contact groups for user:', userId);

      const groupsDoc = await adminDb.collection('ContactGroups').doc(userId).get();
      
      if (!groupsDoc.exists) {
        return { groups: [] };
      }

      const groups = groupsDoc.data().groups || [];

      console.log('✅ Contact groups retrieved:', groups.length);
      return { groups };

    } catch (error) {
      console.error('❌ Error getting contact groups:', error);
      throw error;
    }
  }

  /**
   * Create new contact group
   */
  static async createContactGroup(userId, groupData) {
    try {
      console.log('📁 Creating contact group:', { userId, name: groupData.name });

      // Validate group data
      const validation = this.validateGroupData(groupData);
      if (!validation.isValid) {
        throw new Error(`Invalid group data: ${validation.errors.join(', ')}`);
      }

      // Check subscription limits for groups
await ContactService.validateFeatureAccess(userId, CONTACT_FEATURES.BASIC_GROUPS);

      // Prepare group data
      const newGroup = {
        ...groupData,
        id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        createdBy: userId,
        type: groupData.type || 'custom'
      };

      // Get or create user's groups document
      const groupsDocRef = adminDb.collection('ContactGroups').doc(userId);
      const groupsDoc = await groupsDocRef.get();

      let groups = [];
      if (groupsDoc.exists) {
        groups = groupsDoc.data().groups || [];
      }

      // Add new group
      groups.push(newGroup);

      // Update document
      await groupsDocRef.set({
        groups,
        lastUpdated: FieldValue.serverTimestamp(),
        totalGroups: groups.length
      }, { merge: true });

      // Log audit event
      await ContactSecurityService.logContactActivity({
        userId,
        action: CONTACT_ACTIVITIES.GROUP_CREATED,
        details: {
          groupId: newGroup.id,
          name: newGroup.name,
          type: newGroup.type,
          contactCount: newGroup.contactIds.length
        }
      });

      console.log('✅ Contact group created successfully:', newGroup.id);
      return { group: newGroup, success: true };

    } catch (error) {
      console.error('❌ Error creating contact group:', error);
      throw error;
    }
  }

  /**
   * Generate automatic contact groups
   */
  static async generateAutoGroups(userId, options = {}) {
    try {
      console.log('🤖 Generating automatic contact groups:', userId);

      // Check subscription access for advanced groups
await ContactService.validateFeatureAccess(userId, CONTACT_FEATURES.ADVANCED_GROUPS);

      // Get user's contacts
      const contactsResult = await ContactService.getUserContacts(userId, { limit: 1000 });
      const contacts = contactsResult.contacts;

      if (contacts.length === 0) {
        return { groups: [], message: 'No contacts found to group' };
      }

      const autoGroups = [];
      const { 
        groupByCompany = true, 
        groupByLocation = false, 
        groupByEvents = false,
        minGroupSize = 2,
        maxGroups = 10
      } = options;

      // Group by company
      if (groupByCompany) {
        const companyGroups = this.groupContactsByCompany(contacts, minGroupSize);
        autoGroups.push(...companyGroups);
      }

      // Group by location (if location data available)
      if (groupByLocation) {
        const locationGroups = this.groupContactsByLocation(contacts, minGroupSize);
        autoGroups.push(...locationGroups);
      }

      // Group by time/events (contacts added on same day)
      if (groupByEvents) {
        const eventGroups = this.groupContactsByEvents(contacts, minGroupSize);
        autoGroups.push(...eventGroups);
      }

      // Limit number of groups
      const limitedGroups = autoGroups.slice(0, maxGroups);

      // Save auto-generated groups
      const groupsDocRef = adminDb.collection('ContactGroups').doc(userId);
      const groupsDoc = await groupsDocRef.get();

      let existingGroups = [];
      if (groupsDoc.exists) {
        existingGroups = groupsDoc.data().groups || [];
      }

      // Remove existing auto groups
      const manualGroups = existingGroups.filter(g => g.type !== 'auto_company' && g.type !== 'auto_location' && g.type !== 'auto_event');
      const allGroups = [...manualGroups, ...limitedGroups];

      // Update document
      await groupsDocRef.set({
        groups: allGroups,
        lastUpdated: FieldValue.serverTimestamp(),
        totalGroups: allGroups.length
      }, { merge: true });

      // Log audit event
      await ContactSecurityService.logContactActivity({
        userId,
        action: CONTACT_ACTIVITIES.GROUP_CREATED,
        details: {
          type: 'auto_generation',
          groupsGenerated: limitedGroups.length,
          totalContacts: contacts.length,
          options
        }
      });

      console.log('✅ Auto groups generated:', limitedGroups.length);
      return { groups: limitedGroups, success: true };

    } catch (error) {
      console.error('❌ Error generating auto groups:', error);
      throw error;
    }
  }

  /**
   * Delete contact group
   */
  static async deleteContactGroup(userId, groupId) {
    try {
      console.log('🗑️ Deleting contact group:', { userId, groupId });

      const groupsDocRef = adminDb.collection('ContactGroups').doc(userId);
      const groupsDoc = await groupsDocRef.get();

      if (!groupsDoc.exists) {
        throw new Error('User has no groups');
      }

      const groups = groupsDoc.data().groups || [];
      const groupIndex = groups.findIndex(g => g.id === groupId);

      if (groupIndex === -1) {
        throw new Error('Group not found');
      }

      const deletedGroup = groups[groupIndex];

      // Remove group from array
      groups.splice(groupIndex, 1);

      // Update document
      await groupsDocRef.update({
        groups,
        lastUpdated: FieldValue.serverTimestamp(),
        totalGroups: groups.length
      });

      // Log audit event
      await ContactSecurityService.logContactActivity({
        userId,
        action: CONTACT_ACTIVITIES.GROUP_DELETED,
        details: {
          groupId: deletedGroup.id,
          name: deletedGroup.name,
          type: deletedGroup.type,
          contactCount: deletedGroup.contactIds.length
        }
      });

      console.log('✅ Contact group deleted successfully:', groupId);
      return { success: true, deletedGroup };

    } catch (error) {
      console.error('❌ Error deleting contact group:', error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Validate group data
   */
  static validateGroupData(groupData) {
    const errors = [];

    if (!groupData.name || groupData.name.trim().length === 0) {
      errors.push('Group name is required');
    }

    if (groupData.name && groupData.name.length > 100) {
      errors.push('Group name must be less than 100 characters');
    }

    if (!groupData.contactIds || !Array.isArray(groupData.contactIds)) {
      errors.push('Contact IDs must be provided as an array');
    }

    if (groupData.contactIds && groupData.contactIds.length === 0) {
      errors.push('Group must contain at least one contact');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Group contacts by company
   */
  static groupContactsByCompany(contacts, minGroupSize) {
    const companyMap = {};
    
    contacts.forEach(contact => {
      const company = contact.company?.trim();
      if (company && company.length > 0) {
        if (!companyMap[company]) {
          companyMap[company] = [];
        }
        companyMap[company].push(contact.id);
      }
    });

    return Object.entries(companyMap)
      .filter(([, contactIds]) => contactIds.length >= minGroupSize)
      .map(([company, contactIds]) => ({
        id: `auto_company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${company} Team`,
        description: `Auto-generated group for ${company} contacts`,
        type: 'auto_company',
        contactIds,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        tags: ['auto-generated', 'company']
      }));
  }

  /**
   * Group contacts by location
   */
  static groupContactsByLocation(contacts, minGroupSize) {
    const locationMap = {};
    
    contacts.forEach(contact => {
      if (contact.location && contact.location.latitude) {
        // Simple location grouping by approximate coordinates
        const lat = Math.round(contact.location.latitude * 100) / 100;
        const lng = Math.round(contact.location.longitude * 100) / 100;
        const locationKey = `${lat},${lng}`;
        
        if (!locationMap[locationKey]) {
          locationMap[locationKey] = [];
        }
        locationMap[locationKey].push(contact.id);
      }
    });

    return Object.entries(locationMap)
      .filter(([, contactIds]) => contactIds.length >= minGroupSize)
      .map(([location, contactIds], index) => ({
        id: `auto_location_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `Location Group ${index + 1}`,
        description: `Auto-generated group for contacts near ${location}`,
        type: 'auto_location',
        contactIds,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        tags: ['auto-generated', 'location']
      }));
  }

  /**
   * Group contacts by events/time
   */
  static groupContactsByEvents(contacts, minGroupSize) {
    const eventMap = {};
    
    contacts.forEach(contact => {
      const date = new Date(contact.submittedAt).toISOString().split('T')[0];
      
      if (!eventMap[date]) {
        eventMap[date] = [];
      }
      eventMap[date].push(contact.id);
    });

    return Object.entries(eventMap)
      .filter(([, contactIds]) => contactIds.length >= minGroupSize)
      .map(([date, contactIds]) => ({
        id: `auto_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `Event ${date}`,
        description: `Auto-generated group for contacts added on ${date}`,
        type: 'auto_event',
        contactIds,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        tags: ['auto-generated', 'event', date]
      }));
  }
}

 