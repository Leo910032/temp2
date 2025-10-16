// lib/services/serviceAdmin/server/adminServiceVector.js
// Server-side service for admin vector contact testing operations
// Follows the admin service architecture pattern

import { adminDb } from '@/lib/firebaseAdmin';
import { ContactGenerationService } from './contactGenerationService';
import { VectorStorageService } from '@/lib/services/serviceContact/server/vectorStorageService';
import { SemanticSearchService } from '@/lib/services/serviceContact/server/semanticSearchService';
import { IndexManagementService } from '@/lib/services/serviceContact/server/indexManagementService';
import { SEMANTIC_SEARCH_CONFIG } from '@/lib/services/serviceContact/client/constants/contactConstants';

/**
 * AdminServiceVector
 *
 * Server-side service for managing vector-optimized contact generation and testing.
 * Coordinates between contact generation and vector storage operations.
 *
 * Architecture:
 * - Server-side only (uses Firebase Admin SDK and Pinecone)
 * - Reuses existing services for vector operations
 * - Handles business logic for admin vector testing
 * - Provides vector storage statistics and management
 *
 * Reused Services:
 * - ContactGenerationService - Base contact generation
 * - VectorStorageService - Vector upsert/delete operations
 * - SemanticSearchService - Vector search capabilities
 * - IndexManagementService - Pinecone index management
 *
 * Pattern: Follows lib/services/serviceAdmin/server/analyticsService.js
 */
export class AdminServiceVector {
  /**
   * Get vector storage information for a user
   *
   * @param {string} userId - User ID to get vector info for
   * @returns {Promise<Object>} Vector storage information
   */
  static async getVectorInfo(userId) {
    const startTime = Date.now();

    try {
      console.log(`📊 [AdminServiceVector] Getting vector info for user: ${userId}`);

      // Get user subscription tier
      const userDoc = await adminDb.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        throw new Error(`User not found: ${userId}`);
      }

      const userData = userDoc.data();
      const subscriptionTier = userData.accountType || 'base';

      // Check if tier supports vectors
      const eligibleTiers = ['premium', 'business', 'enterprise'];
      const hasVectorSupport = eligibleTiers.includes(subscriptionTier);

      // Get total contacts count
      const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();
      const totalContacts = contactsDoc.exists ? (contactsDoc.data().contacts || []).length : 0;

      let vectorInfo = {
        hasVectorSupport,
        subscriptionTier,
        totalContacts,
        vectorsStored: 0,
        vectorPercentage: 0,
        pineconeIndexStatus: 'not_available',
        vectorDimensions: SEMANTIC_SEARCH_CONFIG.EMBEDDING_DIMENSION, // ✅ UPDATED: Now 1024 for multilingual-e5-large
        embeddingModel: SEMANTIC_SEARCH_CONFIG.EMBEDDING_MODEL, // ✅ NEW: Track which model is used
        lastVectorUpdate: null,
        contactsWithRichData: 0,
        indexName: null,
        namespace: null
      };

      // If tier doesn't support vectors, return early
      if (!hasVectorSupport) {
        console.log(`⏭️ [AdminServiceVector] Tier ${subscriptionTier} doesn't support vectors`);
        return vectorInfo;
      }

      // Get Pinecone vector statistics
      try {
        const index = await IndexManagementService.getOrCreateIndex();
        const namespace = `user_${userId}`;

        // Get namespace stats
        const stats = await index.describeIndexStats();
        const namespaceStats = stats.namespaces?.[namespace];

        if (namespaceStats) {
          vectorInfo.vectorsStored = namespaceStats.recordCount || 0;
          vectorInfo.vectorPercentage = totalContacts > 0
            ? (namespaceStats.recordCount / totalContacts) * 100
            : 0;
        }

        vectorInfo.pineconeIndexStatus = 'ready';
        vectorInfo.indexName = SEMANTIC_SEARCH_CONFIG.INDEX_NAME; // ✅ UPDATED: Use constant
        vectorInfo.namespace = namespace;

        console.log(`✅ [AdminServiceVector] Vector stats retrieved from Pinecone:`, {
          namespace,
          vectorsStored: vectorInfo.vectorsStored,
          dimensions: vectorInfo.vectorDimensions,
          model: vectorInfo.embeddingModel
        });

      } catch (error) {
        console.error(`❌ [AdminServiceVector] Failed to get Pinecone stats:`, error);
        vectorInfo.pineconeIndexStatus = 'error';
      }

      // Get contacts with rich data (notes, messages)
      if (contactsDoc.exists) {
        const allContacts = contactsDoc.data().contacts || [];
        const contactsWithNotes = allContacts.filter(c => c.notes && c.notes.trim().length > 0);
        vectorInfo.contactsWithRichData = contactsWithNotes.length;

        // Get last vector update timestamp
        const adminTestContacts = allContacts
          .filter(c => c.source === 'admin_test')
          .sort((a, b) => {
            const dateA = new Date(a.submittedAt || a.createdAt || 0);
            const dateB = new Date(b.submittedAt || b.createdAt || 0);
            return dateB - dateA;
          });

        if (adminTestContacts.length > 0) {
          vectorInfo.lastVectorUpdate = adminTestContacts[0].submittedAt || adminTestContacts[0].createdAt;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [AdminServiceVector] Vector info retrieved successfully (${duration}ms):`, {
        userId,
        vectorsStored: vectorInfo.vectorsStored,
        hasVectorSupport: vectorInfo.hasVectorSupport,
        dimensions: vectorInfo.vectorDimensions,
        model: vectorInfo.embeddingModel
      });

      return vectorInfo;

    } catch (error) {
      console.error(`❌ [AdminServiceVector] Failed to get vector info:`, error);
      throw error;
    }
  }

  /**
   * Generate vector-optimized test contacts
   *
   * @param {string} userId - Target user ID
   * @param {Object} options - Generation options
   * @param {string} adminId - Admin user ID performing the action
   * @returns {Promise<Object>} Generation result
   */
  static async generateVectorOptimizedContacts(userId, options, adminId) {
    const startTime = Date.now();

    try {
      console.log(`🎲 [AdminServiceVector] Generating vector-optimized contacts for user: ${userId}`);
      console.log(`📋 [AdminServiceVector] Options:`, options);
      console.log(`📊 [AdminServiceVector] Using embedding model: ${SEMANTIC_SEARCH_CONFIG.EMBEDDING_MODEL} (${SEMANTIC_SEARCH_CONFIG.EMBEDDING_DIMENSION}D)`);

      const {
        count = 30,
        eventPercentage = 0.7,
        locationPercentage = 0.9,
        forceEventLocation = false,
        forceRandomLocation = false,
        enableVectorStorage = true,
        forceVectorCreation = true,
        vectorOptimizationLevel = 'premium',
        includeNotes = true,
        noteScenario = 'vectorOptimized',
        noteComplexity = 'premium',
        noteProbability = 0.95,
        includeMessages = true,
        messageProbability = 0.9,
        forceExchangeForm = true
      } = options;

      // Get user subscription tier
      const userDoc = await adminDb.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        throw new Error(`User not found: ${userId}`);
      }

      const userData = userDoc.data();
      const subscriptionTier = userData.accountType || 'base';

      // Check if tier supports vectors
      const hasVectorSupport = this._hasVectorSupport(subscriptionTier);

      if (enableVectorStorage && !hasVectorSupport && !forceVectorCreation) {
        console.warn(`⚠️ [AdminServiceVector] User tier ${subscriptionTier} doesn't support vectors`);
      }

      // Step 1: Generate contacts using ContactGenerationService
      console.log(`   Step 1: Generating ${count} contacts...`);
      const generationResult = await ContactGenerationService.generateTestContacts(
        userId,
        {
          count,
          eventPercentage,
          locationPercentage,
          forceEventLocation,
          forceRandomLocation,
          includeMessages,
          messageProbability,
          forceExchangeForm,
          includeNotes,
          noteScenario,
          noteComplexity,
          noteProbability
        },
        adminId
      );

      console.log(`✅ [AdminServiceVector] Generated ${generationResult.generated} contacts`);

      // Step 2: Create vectors for generated contacts (if enabled and supported)
      let vectorsCreated = 0;

      if (enableVectorStorage && (hasVectorSupport || forceVectorCreation)) {
        console.log(`   Step 2: Creating vectors for generated contacts using ${SEMANTIC_SEARCH_CONFIG.EMBEDDING_MODEL}...`);

        // Get the generated contacts from the Contacts collection
        const contactsDoc = await adminDb
          .collection('Contacts')
          .doc(userId)
          .get();

        if (!contactsDoc.exists) {
          console.log(`⚠️ [AdminServiceVector] No contacts document found for user: ${userId}`);
          return {
            generated: generationResult.generated,
            totalContacts: generationResult.totalContacts,
            vectorsCreated: 0,
            vectorStorageEnabled: enableVectorStorage,
            hasVectorSupport,
            subscriptionTier,
            embeddingModel: SEMANTIC_SEARCH_CONFIG.EMBEDDING_MODEL,
            vectorDimensions: SEMANTIC_SEARCH_CONFIG.EMBEDDING_DIMENSION,
            processingTimeMs: Date.now() - startTime
          };
        }

        const allContacts = contactsDoc.data().contacts || [];
        console.log(`📊 [AdminServiceVector] Total contacts in document: ${allContacts.length}`);

        // Filter for only the most recently generated admin_test contacts
        // Sort by submittedAt descending and take the first 'count' items
        const contacts = allContacts
          .filter(contact => contact.source === 'admin_test')
          .sort((a, b) => {
            const dateA = new Date(a.submittedAt || a.createdAt || 0);
            const dateB = new Date(b.submittedAt || b.createdAt || 0);
            return dateB - dateA;
          })
          .slice(0, count);

        console.log(`📊 [AdminServiceVector] Found ${contacts.length} admin_test contacts to vectorize`);

        if (contacts.length === 0) {
          console.log(`⚠️ [AdminServiceVector] No admin_test contacts found to vectorize`);
        }

        // Create vectors for each contact with rate limiting
        const batchSize = 5; // Process 5 at a time
        let processedCount = 0;

        for (let i = 0; i < contacts.length; i += batchSize) {
          const batch = contacts.slice(i, i + batchSize);
          const batchNumber = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(contacts.length / batchSize);

          console.log(`📦 [AdminServiceVector] Processing batch ${batchNumber}/${totalBatches} (${batch.length} contacts)`);

          const vectorPromises = batch.map(async (contact) => {
            try {
              // When forceVectorCreation is true, pass 'premium' tier to bypass tier check
              const effectiveTier = forceVectorCreation ? 'premium' : subscriptionTier;

              console.log(`📤 [AdminServiceVector] Creating ${SEMANTIC_SEARCH_CONFIG.EMBEDDING_DIMENSION}D vector for ${contact.name} using ${SEMANTIC_SEARCH_CONFIG.EMBEDDING_MODEL}`);

              await VectorStorageService.upsertContactVector(
                contact,
                effectiveTier
              );
              return true;
            } catch (error) {
              console.error(`❌ [AdminServiceVector] Failed to create vector for contact ${contact.id}:`, error);
              return false;
            }
          });

          const batchResults = await Promise.all(vectorPromises);
          const batchSuccessCount = batchResults.filter(result => result).length;
          vectorsCreated += batchSuccessCount;
          processedCount += batch.length;

          console.log(`✅ [AdminServiceVector] Batch ${batchNumber}/${totalBatches}: ${batchSuccessCount}/${batch.length} vectors created`);

          // Add delay between batches (except for last batch)
          if (i + batchSize < contacts.length) {
            console.log(`⏳ [AdminServiceVector] Waiting 1500ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }

        console.log(`✅ [AdminServiceVector] Created ${vectorsCreated}/${contacts.length} vectors`);
      } else {
        console.log(`⏭️ [AdminServiceVector] Vector storage skipped (not enabled or not supported)`);
      }

      const duration = Date.now() - startTime;

      const result = {
        generated: generationResult.generated,
        totalContacts: generationResult.totalContacts,
        vectorsCreated,
        vectorStorageEnabled: enableVectorStorage,
        hasVectorSupport,
        subscriptionTier,
        embeddingModel: SEMANTIC_SEARCH_CONFIG.EMBEDDING_MODEL, // ✅ NEW: Include model info
        vectorDimensions: SEMANTIC_SEARCH_CONFIG.EMBEDDING_DIMENSION, // ✅ NEW: Include dimensions
        processingTimeMs: duration
      };

      console.log(`✅ [AdminServiceVector] Vector-optimized generation complete:`, result);

      return result;

    } catch (error) {
      console.error(`❌ [AdminServiceVector] Failed to generate vector-optimized contacts:`, error);
      throw error;
    }
  }

  /**
   * Cleanup vector test data for a user
   * Removes test contacts and their associated vectors
   *
   * @param {string} userId - User ID to cleanup test data for
   * @returns {Promise<Object>} Cleanup result
   */
  static async cleanupVectorTestData(userId) {
    const startTime = Date.now();

    try {
      console.log(`🧹 [AdminServiceVector] Cleaning up vector test data for user: ${userId}`);

      // Get user subscription tier
      const userDoc = await adminDb.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        throw new Error(`User not found: ${userId}`);
      }

      const userData = userDoc.data();
      const subscriptionTier = userData.accountType || 'base';

      // Step 1: Get all test contacts from the Contacts document
      const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();

      if (!contactsDoc.exists) {
        console.log(`⚠️ [AdminServiceVector] No contacts document found for user: ${userId}`);
        return {
          deletedContacts: 0,
          deletedVectors: 0,
          processingTimeMs: Date.now() - startTime
        };
      }

      const allContacts = contactsDoc.data().contacts || [];
      const testContacts = allContacts.filter(contact => contact.source === 'admin_test');

      console.log(`📊 [AdminServiceVector] Found ${testContacts.length} test contacts to delete`);

      let deletedContacts = 0;
      let deletedVectors = 0;

      // Step 2: Delete vectors from Pinecone
      if (testContacts.length > 0) {
        console.log(`   Step 1: Deleting vectors from Pinecone...`);

        try {
          const index = await IndexManagementService.getOrCreateIndex();
          const namespace = `user_${userId}`;
          const namespacedIndex = index.namespace(namespace);

          // Delete vectors in batch
          const vectorIds = testContacts.map(contact => contact.id);

          if (vectorIds.length > 0) {
            await namespacedIndex.deleteMany(vectorIds);
            deletedVectors = vectorIds.length;
            console.log(`✅ [AdminServiceVector] Deleted ${deletedVectors} vectors from Pinecone`);
          }
        } catch (error) {
          console.error(`❌ [AdminServiceVector] Failed to delete vectors from Pinecone:`, error);
          // Continue with contact deletion even if vector deletion fails
        }
      }

      // Step 3: Delete contacts from the Contacts document
      console.log(`   Step 2: Deleting contacts from Contacts document...`);

      // Filter out test contacts and update the document
      const remainingContacts = allContacts.filter(contact => contact.source !== 'admin_test');

      await adminDb.collection('Contacts').doc(userId).update({
        contacts: remainingContacts,
        lastModified: new Date().toISOString()
      });

      deletedContacts = testContacts.length;

      console.log(`✅ [AdminServiceVector] Deleted ${deletedContacts} contacts from Contacts document`);

      const duration = Date.now() - startTime;

      const result = {
        deletedContacts,
        deletedVectors,
        processingTimeMs: duration
      };

      console.log(`✅ [AdminServiceVector] Cleanup complete:`, result);

      return result;

    } catch (error) {
      console.error(`❌ [AdminServiceVector] Failed to cleanup vector test data:`, error);
      throw error;
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Check if subscription tier supports vector features
   *
   * @param {string} tier - Subscription tier
   * @returns {boolean} Whether tier supports vectors
   * @private
   */
  static _hasVectorSupport(tier) {
    const eligibleTiers = ['premium', 'business', 'enterprise'];
    return eligibleTiers.includes(tier?.toLowerCase());
  }

  /**
   * Get recommended vector optimization level for tier
   *
   * @param {string} tier - Subscription tier
   * @returns {string} Recommended optimization level
   * @private
   */
  static _getOptimizationLevel(tier) {
    const tierMap = {
      'enterprise': 'enterprise',
      'business': 'business',
      'premium': 'premium',
      'base': 'auto'
    };

    return tierMap[tier?.toLowerCase()] || 'auto';
  }
}