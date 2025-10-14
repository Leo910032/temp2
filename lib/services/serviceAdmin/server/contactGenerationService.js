// lib/services/serviceAdmin/server/contactGenerationService.js
// Server-side service for admin contact generation operations
// Follows the same pattern as adminService.js and analyticsService.js

import { adminDb } from '@/lib/firebaseAdmin';
import { generateRandomContacts } from './generators/generateRandomContacts.js';

/**
 * Contact Generation Service - Server-side operations for test contact generation
 *
 * Architecture:
 * - Handles all database operations
 * - Processes and enriches generated contacts
 * - Implements business logic for contact generation
 * - No direct HTTP handling (that's in API routes)
 */
export class ContactGenerationService {

  /**
   * Generate test contacts for a user
   * @param {string} userId - User ID to generate contacts for
   * @param {Object} options - Generation options
   * @param {string} generatedByAdminId - Admin user ID who generated the contacts
   * @returns {Promise<Object>} Generation result with statistics
   */
  static async generateTestContacts(userId, options = {}, generatedByAdminId = null) {
    console.log('🎲 [ContactGenerationService] Generating test contacts:', {
      userId,
      options,
      generatedByAdmin: generatedByAdminId
    });

    try {
      // Validate options
      const validatedOptions = this._validateOptions(options);

      // Generate raw contacts using utility function
      const rawContacts = generateRandomContacts(validatedOptions.count, {
        eventPercentage: validatedOptions.eventPercentage,
        locationPercentage: validatedOptions.locationPercentage,
        forceEventLocation: validatedOptions.forceEventLocation,
        forceRandomLocation: validatedOptions.forceRandomLocation,
        includeMessages: validatedOptions.includeMessages,
        messageProbability: validatedOptions.messageProbability,
        forceExchangeForm: validatedOptions.forceExchangeForm,
        includeNotes: validatedOptions.includeNotes,
        noteScenario: validatedOptions.noteScenario,
        noteComplexity: validatedOptions.noteComplexity,
        noteProbability: validatedOptions.noteProbability
      });

      // Enrich contacts with test data metadata
      const enrichedContacts = this._enrichContactsWithMetadata(
        rawContacts,
        generatedByAdminId,
        userId
      );

      // Get existing contacts
      const contactsRef = adminDb.collection('Contacts').doc(userId);
      const contactsDoc = await contactsRef.get();

      let existingContacts = [];
      if (contactsDoc.exists) {
        existingContacts = contactsDoc.data().contacts || [];
      }

      // Merge with existing contacts (new ones first)
      const allContacts = [...enrichedContacts, ...existingContacts];

      // Calculate statistics
      const statistics = this._calculateStatistics(allContacts, enrichedContacts);

      // Calculate insights for response
      const insights = this._calculateInsights(enrichedContacts, validatedOptions);

      // Save to Firebase
      await contactsRef.set({
        contacts: allContacts,
        lastUpdated: new Date().toISOString(),
        totalContacts: allContacts.length,
        statistics: statistics
      }, { merge: true });

      console.log('✅ [ContactGenerationService] Contacts generated successfully:', {
        userId,
        generated: enrichedContacts.length,
        total: allContacts.length,
        withEvents: insights.contactsFromEvents,
        withLocation: insights.contactsWithLocation,
        withMessages: insights.contactsWithMessages,
        withNotes: insights.contactsWithNotes
      });

      return {
        success: true,
        generated: enrichedContacts.length,
        totalContacts: allContacts.length,
        insights: insights,
        statistics: statistics,
        sampleContacts: enrichedContacts.slice(0, 3).map(contact => ({
          name: contact.name,
          company: contact.company,
          source: contact.source,
          hasLocation: !!contact.location,
          hasMessage: !!contact.message,
          hasNotes: !!contact.notes,
          eventInfo: contact.eventInfo?.eventName || null,
          testData: contact.testData,
          generatedBy: contact.generatedBy
        }))
      };

    } catch (error) {
      console.error('❌ [ContactGenerationService] Error generating contacts:', error);
      throw error;
    }
  }

  /**
   * Get generation info for a user (stats and capabilities)
   * @param {string} userId - User ID to get info for
   * @returns {Promise<Object>} Generation info with stats and options
   */
  static async getGenerationInfo(userId) {
    console.log('📊 [ContactGenerationService] Getting generation info:', { userId });

    try {
      let currentStats = null;
      let testDataInfo = null;

      if (userId) {
        const contactsRef = adminDb.collection('Contacts').doc(userId);
        const contactsDoc = await contactsRef.get();

        if (contactsDoc.exists) {
          const data = contactsDoc.data();
          const contacts = data.contacts || [];

          // Calculate regular stats
          currentStats = {
            totalContacts: contacts.length,
            withLocation: contacts.filter(c => c.location && c.location.latitude).length,
            fromEvents: contacts.filter(c => c.eventInfo).length,
            withMessages: contacts.filter(c => c.message && c.message.length > 0).length,
            withNotes: contacts.filter(c => c.notes && c.notes.length > 0).length,
            byStatus: {
              new: contacts.filter(c => c.status === 'new').length,
              viewed: contacts.filter(c => c.status === 'viewed').length,
              archived: contacts.filter(c => c.status === 'archived').length
            },
            bySource: {
              business_card_scan: contacts.filter(c => c.source === 'business_card_scan').length,
              exchange_form: contacts.filter(c => c.source === 'exchange_form').length,
              manual: contacts.filter(c => c.source === 'manual' || (!c.source && !c.testData)).length,
              admin_test: contacts.filter(c => c.source === 'admin_test' || c.testData === true).length
            }
          };

          // Test data specific info
          const testContacts = contacts.filter(c => c.testData === true);
          testDataInfo = {
            totalTestContacts: testContacts.length,
            testContactsWithLocation: testContacts.filter(c => c.location && c.location.latitude).length,
            testContactsFromEvents: testContacts.filter(c => c.eventInfo).length,
            testContactsWithMessages: testContacts.filter(c => c.message && c.message.length > 0).length,
            testContactsWithNotes: testContacts.filter(c => c.notes && c.notes.length > 0).length,
            testContactsByStatus: {
              new: testContacts.filter(c => c.status === 'new').length,
              viewed: testContacts.filter(c => c.status === 'viewed').length,
              archived: testContacts.filter(c => c.status === 'archived').length
            },
            lastTestGeneration: testContacts.length > 0 ?
              Math.max(...testContacts.map(c => new Date(c.generatedAt || c.submittedAt || 0).getTime())) : null,
            generatedByAdmins: [...new Set(testContacts.filter(c => c.generatedByAdmin).map(c => c.generatedByAdmin))],
            canCleanup: testContacts.length > 0
          };

          if (testDataInfo.lastTestGeneration) {
            testDataInfo.lastTestGeneration = new Date(testDataInfo.lastTestGeneration).toISOString();
          }
        }
      }

      // Get generation capabilities
      const generationOptions = this._getGenerationOptions();

      console.log('✅ [ContactGenerationService] Generation info retrieved');

      return {
        success: true,
        currentStats,
        testDataInfo,
        generationOptions
      };

    } catch (error) {
      console.error('❌ [ContactGenerationService] Error getting generation info:', error);
      throw error;
    }
  }

  /**
   * Cleanup test contacts for a user
   * @param {string} userId - User ID to cleanup test data for
   * @returns {Promise<Object>} Cleanup result with removed count
   */
  static async cleanupTestContacts(userId) {
    console.log('🧹 [ContactGenerationService] Cleaning up test contacts:', { userId });

    try {
      const contactsRef = adminDb.collection('Contacts').doc(userId);
      const contactsDoc = await contactsRef.get();

      if (!contactsDoc.exists) {
        return {
          success: true,
          message: 'No contacts found for user',
          removed: 0,
          remaining: 0
        };
      }

      const data = contactsDoc.data();
      const contacts = data.contacts || [];

      // Filter out test data
      const testContacts = contacts.filter(c => c.testData === true);
      const nonTestContacts = contacts.filter(c => !c.testData);

      // Recalculate statistics
      const statistics = this._calculateStatistics(nonTestContacts, []);

      // Save updated contacts
      await contactsRef.set({
        contacts: nonTestContacts,
        lastUpdated: new Date().toISOString(),
        totalContacts: nonTestContacts.length,
        statistics: statistics
      }, { merge: true });

      console.log('✅ [ContactGenerationService] Test contacts cleaned up:', {
        userId,
        removed: testContacts.length,
        remaining: nonTestContacts.length
      });

      return {
        success: true,
        message: `Successfully removed ${testContacts.length} test contacts`,
        removed: testContacts.length,
        remaining: nonTestContacts.length
      };

    } catch (error) {
      console.error('❌ [ContactGenerationService] Error cleaning up test contacts:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Validate and normalize generation options
   * @private
   */
  static _validateOptions(options) {
    return {
      count: Math.min(Math.max(parseInt(options.count) || 50, 1), 200), // 1-200 contacts
      eventPercentage: Math.min(Math.max(parseFloat(options.eventPercentage) || 0.4, 0), 1),
      locationPercentage: Math.min(Math.max(parseFloat(options.locationPercentage) || 0.7, 0), 1),
      forceEventLocation: Boolean(options.forceEventLocation),
      forceRandomLocation: Boolean(options.forceRandomLocation),
      includeMessages: Boolean(options.includeMessages),
      messageProbability: Math.min(Math.max(parseFloat(options.messageProbability) || 1.0, 0), 1),
      forceExchangeForm: Boolean(options.forceExchangeForm),
      includeNotes: options.includeNotes !== undefined ? Boolean(options.includeNotes) : true,
      noteScenario: options.noteScenario || 'mixed',
      noteComplexity: options.noteComplexity || 'medium',
      noteProbability: Math.min(Math.max(parseFloat(options.noteProbability) || 0.7, 0), 1)
    };
  }

  /**
   * Enrich contacts with test data metadata
   * @private
   */
  static _enrichContactsWithMetadata(contacts, generatedByAdminId, targetUserId) {
    return contacts.map(contact => ({
      ...contact,
      testData: true,
      source: contact.source || 'admin_test',
      generatedBy: 'admin_panel',
      generatedAt: new Date().toISOString(),
      generatedByAdmin: generatedByAdminId,
      generatedForUser: targetUserId
    }));
  }

  /**
   * Calculate statistics for all contacts
   * @private
   */
  static _calculateStatistics(allContacts, newContacts) {
    return {
      totalSubmissions: allContacts.length,
      newContacts: allContacts.filter(c => c.status === 'new').length,
      viewedContacts: allContacts.filter(c => c.status === 'viewed').length,
      archivedContacts: allContacts.filter(c => c.status === 'archived').length,
      contactsWithLocation: allContacts.filter(c => c.location && c.location.latitude).length,
      contactsWithMessages: allContacts.filter(c => c.message && c.message.length > 0).length,
      contactsWithNotes: allContacts.filter(c => c.notes && c.notes.length > 0).length,
      lastSubmissionDate: new Date().toISOString(),
      sources: {
        exchange_form: allContacts.filter(c => c.source === 'exchange_form').length,
        business_card_scan: allContacts.filter(c => c.source === 'business_card_scan').length,
        manual: allContacts.filter(c => c.source === 'manual' || (!c.source && !c.testData)).length,
        import: allContacts.filter(c => c.source === 'import' || c.source === 'import_csv').length,
        admin_test: allContacts.filter(c => c.source === 'admin_test' || c.testData === true).length
      },
      testDataStats: {
        totalTestContacts: allContacts.filter(c => c.testData === true).length,
        testContactsWithLocation: allContacts.filter(c => c.testData === true && c.location && c.location.latitude).length,
        testContactsFromEvents: allContacts.filter(c => c.testData === true && c.eventInfo).length,
        testContactsWithMessages: allContacts.filter(c => c.testData === true && c.message && c.message.length > 0).length,
        testContactsWithNotes: allContacts.filter(c => c.testData === true && c.notes && c.notes.length > 0).length,
        lastTestGeneration: new Date().toISOString(),
        generatedByAdmins: [...new Set(allContacts.filter(c => c.generatedByAdmin).map(c => c.generatedByAdmin))].length
      }
    };
  }

  /**
   * Calculate insights for generated contacts
   * @private
   */
  static _calculateInsights(contacts, options) {
    return {
      eventsRepresented: [...new Set(contacts.filter(c => c.eventInfo).map(c => c.eventInfo.eventName))],
      companiesRepresented: [...new Set(contacts.map(c => c.company))],
      contactsFromEvents: contacts.filter(c => c.eventInfo).length,
      contactsWithLocation: contacts.filter(c => c.location).length,
      contactsWithMessages: contacts.filter(c => c.message && c.message.length > 0).length,
      contactsWithNotes: contacts.filter(c => c.notes && c.notes.length > 0).length,
      sourceDistribution: {
        business_card_scan: contacts.filter(c => c.source === 'business_card_scan').length,
        exchange_form: contacts.filter(c => c.source === 'exchange_form').length,
        manual: contacts.filter(c => c.source === 'manual').length,
        admin_test: contacts.filter(c => c.source === 'admin_test').length
      },
      testDataInsights: {
        allMarkedAsTestData: contacts.every(c => c.testData === true),
        generationTimestamp: new Date().toISOString(),
        messageGenerationEnabled: options.includeMessages || false,
        expectedMessagesCount: options.includeMessages ? Math.round(options.count * (options.messageProbability || 1.0)) : 0,
        actualMessagesCount: contacts.filter(c => c.message).length
      }
    };
  }

  /**
   * Get generation options and capabilities
   * @private
   */
  static _getGenerationOptions() {
    const availableEvents = [
      'CES 2024', 'CES 2025', 'AWS re:Invent 2024', 'SXSW 2024', 'SXSW 2025',
      'RSA Conference 2024', 'RSA Conference 2025', 'Cisco Live 2024', 'Cisco Live 2025',
      'Dell Technologies World 2024', 'Dell Technologies World 2025', 'VMware Explore 2024',
      'Microsoft Ignite 2024', 'Adobe Summit 2024', 'Google I/O 2024', 'Dreamforce 2024',
      'Oracle CloudWorld 2024'
    ];

    const sampleCompanies = [
      'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Netflix', 'Tesla',
      'Adobe', 'Salesforce', 'Oracle', 'SAP', 'IBM', 'Intel', 'NVIDIA',
      'OpenAI', 'Anthropic', 'Snowflake', 'Databricks', 'MongoDB'
    ];

    return {
      defaultCount: 50,
      maxCount: 200,
      defaultEventPercentage: 0.4,
      defaultLocationPercentage: 0.7,
      availableEvents: availableEvents.length,
      availableCompanies: sampleCompanies.length,
      testDataFeatures: {
        autoMarkAsTestData: true,
        trackGenerationSource: true,
        enableCleanup: true,
        supportsBulkDelete: true,
        supportsMessageGeneration: true,
        supportsNoteGeneration: true,
        allowsCustomMessageProbability: true
      },
      examples: {
        testAutoGrouping: {
          description: "Generate contacts optimized for testing auto-grouping",
          params: {
            count: 75,
            eventPercentage: 0.6,
            locationPercentage: 0.8,
            includeMessages: true,
            includeNotes: true
          }
        },
        eventFocused: {
          description: "Generate mostly event-based contacts with messages",
          params: {
            count: 50,
            eventPercentage: 0.8,
            locationPercentage: 0.9,
            includeMessages: true,
            messageProbability: 1.0,
            forceExchangeForm: true
          }
        },
        locationSpread: {
          description: "Generate contacts spread across tech hubs",
          params: {
            count: 60,
            eventPercentage: 0.2,
            locationPercentage: 0.9,
            includeMessages: false,
            includeNotes: true
          }
        },
        cleanupTest: {
          description: "Small batch for testing cleanup functionality",
          params: {
            count: 10,
            eventPercentage: 0.5,
            locationPercentage: 0.5,
            includeMessages: true,
            includeNotes: false
          }
        }
      },
      availableEvents: availableEvents,
      sampleCompanies: sampleCompanies
    };
  }
}

export default ContactGenerationService;
