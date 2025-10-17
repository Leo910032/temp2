// lib/services/serviceContact/server/vectorStorageService.js
// Server-side service for storing and managing vectors in Pinecone
// ✅ FIXED: document → documentText typo

import { adminDb } from '@/lib/firebaseAdmin';
import { IndexManagementService } from './indexManagementService';
import { EmbeddingService } from './embeddingService';
import { DocumentBuilderService } from './documentBuilderService';
import { SEMANTIC_SEARCH_CONFIG } from '@/lib/services/serviceContact/client/constants/contactConstants';

/**
 * VectorStorageService
 *
 * Architecture:
 * - Server-side only (Pinecone operations require API key)
 * - Coordinates document building, embedding generation, and Pinecone storage
 * - Handles batch operations with rate limiting
 * - Graceful error handling (doesn't break contact operations)
 */
export class VectorStorageService {
  /**
   * Upsert contact vector to Pinecone
   * Orchestrates the full pipeline: document → embedding → storage
   *
   * @param {object} contact - Contact object
   * @param {string} ownerSubscriptionLevel - Owner's subscription level
   * @returns {Promise<void>}
   */
  static async upsertContactVector(contact, ownerSubscriptionLevel) {
    const totalStartTime = Date.now();

    try {
      // Validate input
      if (!contact?.id || !ownerSubscriptionLevel) {
        console.error(`❌ [VectorStorage] Invalid input:`, {
          hasContact: !!contact,
          hasId: !!contact?.id,
          hasSubscriptionLevel: !!ownerSubscriptionLevel
        });
        return;
      }

      console.log(`📤 [VectorStorage] Upserting vector for contact: ${contact.name} (${ownerSubscriptionLevel})`);

      // Check eligibility
      const eligibleTiers = ['premium', 'business', 'enterprise'];
      if (!eligibleTiers.includes(ownerSubscriptionLevel)) {
        console.log(`⏭️ [VectorStorage] Tier not eligible for vector storage: ${ownerSubscriptionLevel}`);
        return;
      }

      // Step 1: Build document
      console.log(`   - Step 1: Building document...`);
      const documentText = DocumentBuilderService.buildContactDocument(contact, ownerSubscriptionLevel);

      // ✅ FIXED: Changed document → documentText
      console.log('📝 FULL DOCUMENT TO EMBED:');
      console.log('═══════════════════════════════════════');
      console.log(documentText);
      console.log('═══════════════════════════════════════');

      // Step 2: Generate embedding
      console.log(`   - Step 2: Generating embedding...`);
      const embedding = await EmbeddingService.generateEmbedding(documentText);

      // Step 3: Get Pinecone index
      console.log(`   - Step 3: Getting Pinecone index...`);
      const index = await IndexManagementService.getOrCreateIndex();

      // Step 4: Prepare and upsert to Pinecone
      console.log(`   - Step 4: Upserting to Pinecone...`);

      // Extract userId with fallback chain and validation
      const userId = contact.userId || contact.createdBy || contact.generatedForUser;

      if (!userId) {
        console.error(`❌ [VectorStorage] No userId found for contact:`, {
          contactId: contact.id,
          contactName: contact.name,
          hasUserId: !!contact.userId,
          hasCreatedBy: !!contact.createdBy,
          hasGeneratedForUser: !!contact.generatedForUser,
          availableFields: Object.keys(contact)
        });
        throw new Error(`Contact ${contact.id} must have userId, createdBy, or generatedForUser field`);
      }

      const namespace = `user_${userId}`;
      console.log(`   📍 Using namespace: ${namespace}`);

      const namespacedIndex = index.namespace(namespace);

      // Helper: Truncate text fields to Pinecone's metadata limits
      const truncateField = (value, maxLength = 500) => {
        if (!value) return value;
        const str = String(value);
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
      };

      // Helper: Extract job title from details array or direct field
      const extractJobTitle = () => {
        if (contact.jobTitle) return contact.jobTitle;
        if (contact.details && Array.isArray(contact.details)) {
          const jobTitleDetail = contact.details.find(d =>
            d.label?.toLowerCase().includes('job') ||
            d.label?.toLowerCase().includes('title') ||
            d.label?.toLowerCase().includes('position')
          );
          return jobTitleDetail?.value || null;
        }
        return null;
      };

      // Helper: Extract important custom fields from details array
      const extractCustomFields = () => {
        const customFields = {};
        if (contact.details && Array.isArray(contact.details)) {
          contact.details.forEach(detail => {
            if (detail.label && detail.value) {
              // Extract specific useful fields
              const label = detail.label.toLowerCase();
              if (label.includes('linkedin')) {
                customFields.linkedin = truncateField(detail.value, 200);
              } else if (label.includes('website')) {
                customFields.website = truncateField(detail.value, 200);
              } else if (label.includes('department')) {
                customFields.department = truncateField(detail.value, 100);
              } else if (label.includes('industry')) {
                customFields.industry = truncateField(detail.value, 100);
              } else if (label.includes('specialty') || label.includes('specialization')) {
                customFields.specialty = truncateField(detail.value, 200);
              }
            }
          });
        }
        return customFields;
      };

      // Flatten dynamic fields to include them in metadata
      const dynamicMetadata = {};
      if (contact.dynamicFields && Array.isArray(contact.dynamicFields)) {
        contact.dynamicFields.forEach(field => {
          if (field.label && field.value) {
            // Create a clean key, e.g., "Company Tagline" -> "companyTagline"
            const key = field.label.replace(/\s+/g, '')
              .replace(/^(.)/, char => char.toLowerCase());
            dynamicMetadata[key] = truncateField(field.value);
          }
        });
      }

      // Extract all metadata
      const jobTitle = extractJobTitle();
      const customFields = extractCustomFields();

      // Build comprehensive metadata object
      const metadata = {
        // Core identification
        userId: userId, // Use the validated userId from above
        name: contact.name,
        email: contact.email,
        phone: contact.phone || null,
        company: contact.company || null,

        // Professional info
        jobTitle: jobTitle || null,

        // Status
        status: contact.status || 'new',

        // Rich content (truncated)
        notes: truncateField(contact.notes),
        message: truncateField(contact.message),
        noteLength: contact.notes ? contact.notes.length : 0,

        // Generated by marker (useful for admin tracking)
        generatedBy: contact.generatedBy || null,

        // Custom fields from details array
        ...customFields,

        // Dynamic fields
        ...dynamicMetadata
      };

      // Remove null/undefined values to keep metadata clean
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === null || metadata[key] === undefined) {
          delete metadata[key];
        }
      });

      console.log(`   📦 Preparing metadata for Pinecone:`, {
        hasJobTitle: !!metadata.jobTitle,
        hasPhone: !!metadata.phone,
        hasNotes: !!metadata.notes,
        hasMessage: !!metadata.message,
        hasLocation: metadata.hasLocation,
        customFieldsCount: Object.keys(customFields).length,
        totalMetadataFields: Object.keys(metadata).length
      });

      const upsertPayload = {
        id: contact.id,
        values: embedding,
        metadata
      };

      try {
        await namespacedIndex.upsert([upsertPayload]);

        const totalDuration = Date.now() - totalStartTime;

        // Count metadata fields for logging
        const metadataFieldCount = Object.keys(metadata).length;
        const metadataFields = Object.keys(metadata).join(', ');

        console.log(`✅ [VectorStorage] Upsert complete (${totalDuration}ms):`, {
          contactId: contact.id,
          namespace,
          embeddingDimension: embedding.length,
          metadataFields: metadataFieldCount
        });

        console.log(`   📋 Stored metadata fields (${metadataFieldCount}): ${metadataFields}`);

      } catch (upsertError) {
        // Handle index not ready error gracefully
        if (upsertError.message?.includes('not ready') || upsertError.message?.includes('initializing')) {
          console.log(`⏳ [VectorStorage] Index still initializing, vector will be queued`);
          return;
        }
        throw upsertError;
      }

    } catch (error) {
      console.error(`❌ [VectorStorage] Upsert failed:`, {
        message: error.message,
        contactId: contact?.id
      });

      // For new index creation, don't treat as error
      if (error.message?.includes('not ready') || error.message?.includes('initializing')) {
        console.log(`⏳ [VectorStorage] Index initializing, operation will complete later`);
        return;
      }

      // Don't throw - vector operations should not break contact creation
      console.warn(`⚠️ [VectorStorage] Vector operation failed, but contact operation will continue`);
    }
  }

  /**
   * Delete contact vector from Pinecone
   *
   * @param {string} contactId - Contact ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  static async deleteContactVector(contactId, userId) {
    try {
      console.log(`🗑️ [VectorStorage] Deleting vector: ${contactId} (user: ${userId})`);

      const index = await IndexManagementService.getOrCreateIndex();
      const namespace = `user_${userId}`;
      const namespacedIndex = index.namespace(namespace);

      await namespacedIndex.deleteOne(contactId);

      console.log(`✅ [VectorStorage] Vector deleted successfully:`, {
        contactId,
        namespace
      });

    } catch (error) {
      console.error(`❌ [VectorStorage] Delete failed:`, {
        message: error.message,
        contactId
      });

      // Don't throw - vector operations should not break contact deletion
      console.warn(`⚠️ [VectorStorage] Vector deletion failed, but contact deletion will continue`);
    }
  }

  /**
   * Batch upsert contact vectors
   * Processes multiple contacts with rate limiting
   *
   * @param {Array<object>} contacts - Array of contacts
   * @param {string} subscriptionLevel - Subscription level
   * @param {object} options - Options for batch processing
   * @returns {Promise<object>} Results summary
   */
  static async batchUpsertVectors(contacts, subscriptionLevel, options = {}) {
    const {
      batchSize = SEMANTIC_SEARCH_CONFIG.BATCH_SIZE,
      delayMs = SEMANTIC_SEARCH_CONFIG.BATCH_DELAY_MS,
      onProgress = null
    } = options;

    console.log(`📦 [VectorStorage] Batch upserting ${contacts.length} contacts...`);

    let succeeded = 0;
    let failed = 0;
    const errors = [];

    // Process in batches
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(contacts.length / batchSize);

      console.log(`📦 [VectorStorage] Processing batch ${batchNumber}/${totalBatches} (${batch.length} contacts)`);

      await Promise.all(
        batch.map(async (contact) => {
          try {
            await this.upsertContactVector(contact, subscriptionLevel);
            succeeded++;
          } catch (error) {
            failed++;
            errors.push({
              contactId: contact.id,
              error: error.message
            });
          }
        })
      );

      // Call progress callback
      if (onProgress) {
        onProgress({
          processed: i + batch.length,
          total: contacts.length,
          succeeded,
          failed,
          batchNumber,
          totalBatches
        });
      }

      // Delay between batches (except for last batch)
      if (i + batchSize < contacts.length) {
        console.log(`⏳ [VectorStorage] Waiting ${delayMs}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`✅ [VectorStorage] Batch complete:`, {
      total: contacts.length,
      succeeded,
      failed
    });

    return {
      total: contacts.length,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Rebuild all vectors for a user
   * Useful when subscription changes or to refresh embeddings
   *
   * @param {string} userId - User ID
   * @param {string} newSubscriptionLevel - New subscription level
   * @returns {Promise<object>} Results summary
   */
  static async rebuildUserVectors(userId, newSubscriptionLevel) {
    const startTime = Date.now();

    console.log(`🔄 [VectorStorage] Rebuilding vectors for user: ${userId} (${newSubscriptionLevel})`);

    try {
      // Get all user's contacts from Firestore
      const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();

      if (!contactsDoc.exists) {
        console.log(`⏭️ [VectorStorage] No contacts found for user: ${userId}`);
        return { rebuilt: 0, total: 0 };
      }

      const contacts = contactsDoc.data().contacts || [];
      console.log(`📊 [VectorStorage] Found ${contacts.length} contacts to rebuild`);

      // Batch upsert all contacts
      const result = await this.batchUpsertVectors(contacts, newSubscriptionLevel, {
        onProgress: (progress) => {
          console.log(`📊 [VectorStorage] Progress: ${progress.processed}/${progress.total} (${progress.succeeded} succeeded, ${progress.failed} failed)`);
        }
      });

      const totalDuration = Date.now() - startTime;
      console.log(`✅ [VectorStorage] Rebuild complete in ${totalDuration}ms:`, result);

      return {
        rebuilt: result.succeeded,
        total: result.total,
        failed: result.failed,
        duration: totalDuration
      };

    } catch (error) {
      console.error(`❌ [VectorStorage] Rebuild failed:`, {
        message: error.message,
        userId
      });
      throw error;
    }
  }
}