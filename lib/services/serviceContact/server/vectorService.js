// lib/services/serviceContact/server/services/VectorService.js - COMPLETE WITH ADVANCED LOGGING
// Vector service using Gemini AI for embeddings and Pinecone for vector storage

import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { adminDb } from '@/lib/firebaseAdmin';
import { AdvancedLogger, PineconeLogger, GeminiLogger, FlowLogger } from '../../../services/logging/advancedLogger.js';

// Initialize services
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const INDEX_NAME = 'networking-app-contacts';

export class VectorService {
  
 /**
 * Optimized index management with connection reuse
 */
static async getIndex() {
  const indexStartTime = Date.now();
  
  try {
    // Cache the index instance to avoid repeated initialization
    if (this._indexInstance) {
      
      return this._indexInstance;
    }


    
    // Check if index exists
    const listStartTime = Date.now();
    const indexList = await pinecone.listIndexes();
    
   ;
    
    const indexExists = indexList.indexes?.some(index => index.name === INDEX_NAME);
    
    if (!indexExists) {
    
      
      const createStartTime = Date.now();
      
      await pinecone.createIndex({
        name: INDEX_NAME,
        dimension: 768, // Gemini text-embedding-004 dimension
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      
      
      
      // Don't wait for the index to be ready - let it initialize in background
    }
    
    this._indexInstance = pinecone.index(INDEX_NAME);
    
 
    
    return this._indexInstance;
  } catch (error) {
  
    throw error;
  }
}

  /**
 * Generate embedding using Gemini text-embedding-004 with detailed timing
 */
static async getEmbedding(text) {
  const embeddingStartTime = Date.now();
  
  try {
    const cleanText = text.replace(/\n/g, ' ').trim();
    
  
    
    // Get the embedding model
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    // Generate embedding
    const result = await model.embedContent(cleanText);
    const embedding = result.embedding.values;

    const embeddingTime = Date.now() - embeddingStartTime;
    
    // Log the embedding generation
    await GeminiLogger.logEmbedding(cleanText, embedding, {
      duration: embeddingTime,
      model: 'text-embedding-004'
    });

   
    
    return embedding;
    
  } catch (error) {
 
    throw error;
  }
}

/**
 * Optimized contact document building with tier logging
 */
static buildContactDocument(contact, subscriptionLevel) {
  const buildStartTime = Date.now();
  

  
  let document = `Name: ${contact.name || 'Unknown'}\n`;
  document += `Email: ${contact.email || 'No email'}\n`;
  document += `Company: ${contact.company || 'No company'}\n`;
  
  if (contact.jobTitle) {
    document += `Job Title: ${contact.jobTitle}\n`;
  }
  
  // Premium tier: Basic fields only
  if (subscriptionLevel === 'premium') {
    const finalDoc = document.trim();
  
    return finalDoc;
  }
  
  // Business+ tier: Include notes and detailed information
  const isBusinessOrHigher = ['business', 'enterprise'].includes(subscriptionLevel);
  if (isBusinessOrHigher) {
  
    
    if (contact.notes) {
      document += `Notes: ${contact.notes}\n`;
    }
    
    if (contact.message) {
      document += `Message: ${contact.message}\n`;
    }
    
    if (contact.details && Array.isArray(contact.details)) {
      contact.details.forEach(detail => {
        document += `${detail.label}: ${detail.value}\n`;
      });
    }
    
    if (contact.location?.address) {
      document += `Location: ${contact.location.address}\n`;
    }
  }
  
  const finalDocument = document.trim();
  

  
  return finalDocument;
}

 /**
 * OPTIMIZED: Upsert with detailed performance logging using Gemini embeddings
 */
static async upsertContactVector(contact, ownerSubscriptionLevel) {
  const flowLogger = new FlowLogger('upsert_contact_vector', contact.userId);
  const totalStartTime = Date.now();
  
  try {
    if (!contact?.id || !ownerSubscriptionLevel) {
      flowLogger.logError('invalid_input', new Error('Invalid contact or subscription level'));
      return;
    }

    flowLogger.logStep('upsert_start', {
      contactId: contact.id,
      contactName: contact.name,
      ownerSubscriptionLevel
    });

    // Quick eligibility check
    const eligibleTiers = ['premium', 'business', 'enterprise'];
    if (!eligibleTiers.includes(ownerSubscriptionLevel)) {
      flowLogger.logStep('tier_ineligible', {
        tier: ownerSubscriptionLevel,
        eligibleTiers
      });
      return;
    }

    // Step 1: Build document (fast)
    flowLogger.logStep('document_build_start', { message: 'Building document for embedding' });
    const documentText = this.buildContactDocument(contact, ownerSubscriptionLevel);
    
    flowLogger.logStep('document_build_complete', {
      documentLength: documentText.length,
      documentPreview: documentText.substring(0, 200) + (documentText.length > 200 ? '...' : '')
    });

    // Step 2: Generate embedding (Gemini API call)
    flowLogger.logStep('embedding_generation_start', { message: 'Generating Gemini embedding' });
    const embedding = await this.getEmbedding(documentText);
    
    flowLogger.logStep('embedding_generation_complete', {
      embeddingDimension: embedding.length,
      embeddingPreview: embedding.slice(0, 5)
    });
    
    // Step 3: Get Pinecone index (may create if needed)
    flowLogger.logStep('index_connection_start', { message: 'Getting Pinecone index' });
    const index = await this.getIndex();
    
    flowLogger.logStep('index_connection_complete', { message: 'Pinecone index ready' });

    // Step 4: Upsert to Pinecone - FIXED: Use namespace correctly
    flowLogger.logStep('pinecone_upsert_start', { message: 'Upserting to Pinecone' });
    
    const namespace = `user_${contact.userId || contact.createdBy}`;
    const namespacedIndex = index.namespace(namespace);
    
    const upsertPayload = {
      id: contact.id,
      values: embedding,
      metadata: {
        userId: contact.userId || contact.createdBy,
        name: contact.name,
        email: contact.email,
        company: contact.company,
        subscriptionTier: ownerSubscriptionLevel,
        lastUpdated: new Date().toISOString(),
        source: contact.source || 'unknown',
        embeddingModel: 'text-embedding-004'
      }
    };

    // Log the upsert operation
    const pineconeRequestId = await PineconeLogger.logUpsert([upsertPayload], namespace, {
      contactId: contact.id,
      subscriptionTier: ownerSubscriptionLevel
    });
    
    flowLogger.logStep('pinecone_payload_prepared', {
      vectorId: upsertPayload.id,
      namespace,
      metadataKeys: Object.keys(upsertPayload.metadata),
      pineconeRequestId
    });
    
    try {
      await namespacedIndex.upsert([upsertPayload]);
      
      flowLogger.logStep('pinecone_upsert_complete', {
        contactId: contact.id,
        embeddingDimension: embedding.length,
        namespace,
        pineconeRequestId
      });
      
      flowLogger.complete({
        success: true,
        contactId: contact.id,
        namespace,
        embeddingDimension: embedding.length,
        totalDuration: Date.now() - totalStartTime
      });

      
    } catch (upsertError) {
      // Handle index not ready error gracefully
      if (upsertError.message?.includes('not ready') || upsertError.message?.includes('initializing')) {
        flowLogger.logStep('index_initializing', {
          message: 'Index still initializing, vector will be queued'
        });
        
        flowLogger.complete({
          success: true,
          note: 'vector_queued_for_index_ready'
        });
        return;
      }
      throw upsertError;
    }
      
  } catch (error) {
    flowLogger.logError('upsert_failed', error);
    
  
    
    // For new index creation, don't treat as error
    if (error.message?.includes('not ready') || error.message?.includes('initializing')) {
    
      return;
    }
    
    // Don't throw - vector operations should not break contact creation
    console.error(`Vector operation failed, but contact creation will continue`);
  }
}

  /**
   * Perform semantic search using Gemini embeddings - FIXED namespace handling
   */
  static async search(query, userId, subscriptionLevel) {
    const flowLogger = new FlowLogger('semantic_search', userId);
    
    try {
      flowLogger.logStep('search_start', {
        userId,
        subscriptionLevel,
        queryLength: query.length,
        queryPreview: query.substring(0, 100) + (query.length > 100 ? '...' : '')
      });

      // Validate subscription access
      const eligibleTiers = ['premium', 'business', 'enterprise'];
      if (!eligibleTiers.includes(subscriptionLevel)) {
        const error = new Error('Semantic search requires Premium subscription or higher');
        flowLogger.logError('insufficient_subscription', error);
        throw error;
      }

      // Generate query embedding using Gemini
      flowLogger.logStep('embedding_generation', { message: 'Generating query embedding' });
      const queryEmbedding = await this.getEmbedding(query);
      
      if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
        const error = new Error('Failed to generate query embedding');
        flowLogger.logError('embedding_failed', error);
        throw error;
      }

      flowLogger.logStep('embedding_complete', {
        embeddingDimension: queryEmbedding.length,
        embeddingPreview: queryEmbedding.slice(0, 5)
      });

      // Get Pinecone index
      flowLogger.logStep('index_connection', { message: 'Connecting to Pinecone index' });
      const index = await this.getIndex();

      // Determine result count based on subscription tier
      const resultCount = subscriptionLevel === 'premium' ? 5 : 10;

      // FIXED: Use namespace correctly
      const namespace = `user_${userId}`;
      const namespacedIndex = index.namespace(namespace);

      flowLogger.logStep('search_parameters', {
        namespace,
        resultCount,
        subscriptionLevel
      });

      // Search for similar vectors - FIXED: Remove namespace from query
      const searchQuery = {
        vector: queryEmbedding,
        topK: resultCount,
        includeMetadata: true
      };

      // Log the search query
      const pineconeRequestId = await PineconeLogger.logQuery('SEARCH', searchQuery, { pending: true }, {
        userId,
        namespace,
        subscriptionLevel
      });

      flowLogger.logStep('pinecone_search_start', {
        queryParameters: searchQuery,
        pineconeRequestId
      });

      const searchResults = await namespacedIndex.query(searchQuery);

      // Log the search results
      await PineconeLogger.logQuery('SEARCH', searchQuery, searchResults, {
        userId,
        namespace,
        subscriptionLevel,
        requestId: pineconeRequestId
      });

      flowLogger.logStep('pinecone_search_complete', {
        matchesFound: searchResults.matches?.length || 0,
        pineconeRequestId,
        averageScore: searchResults.matches?.length > 0 
          ? searchResults.matches.reduce((sum, match) => sum + match.score, 0) / searchResults.matches.length 
          : 0
      });

      if (!searchResults.matches || searchResults.matches.length === 0) {
        flowLogger.complete({
          success: true,
          resultsCount: 0,
          message: 'No matches found'
        });
        return [];
      }

      // Get the actual contact data from Firestore
      flowLogger.logStep('contact_fetch_start', {
        contactIds: searchResults.matches.map(match => match.id)
      });
      
      const contactIds = searchResults.matches.map(match => match.id);
      const contacts = await this.getContactsByIds(userId, contactIds);

      flowLogger.logStep('contact_fetch_complete', {
        contactsRetrieved: contacts.length,
        totalMatches: searchResults.matches.length
      });

      // Combine vector results with contact data, maintaining order by relevance
      const orderedResults = [];
      searchResults.matches.forEach(match => {
        const contact = contacts.find(c => c.id === match.id);
        if (contact) {
          orderedResults.push({
            ...contact,
            _vectorScore: match.score,
            _vectorMetadata: match.metadata,
            _searchTier: subscriptionLevel,
            _embeddingModel: 'text-embedding-004',
            searchMetadata: {
              score: match.score,
              namespace,
              tier: subscriptionLevel,
              embeddingModel: 'text-embedding-004'
            }
          });
        }
      });

      flowLogger.complete({
        success: true,
        resultsCount: orderedResults.length,
        namespace,
        subscriptionLevel
      });


      return orderedResults;

    } catch (error) {
      flowLogger.logError('search_failed', error);
      
   
      
      throw error;
    }
  }

  /**
   * Get contacts by IDs from Firestore
   */
  static async getContactsByIds(userId, contactIds) {
    const flowLogger = new FlowLogger('get_contacts_by_ids', userId);
    
    try {
      flowLogger.logStep('firestore_query_start', {
        userId,
        contactIdsCount: contactIds.length,
        contactIds: contactIds.slice(0, 5) // Log first 5 IDs for debugging
      });

      const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();
      
      if (!contactsDoc.exists) {
        flowLogger.logStep('no_contacts_doc', { message: 'User contacts document not found' });
        return [];
      }

      const allContacts = contactsDoc.data().contacts || [];
      const matchedContacts = allContacts.filter(contact => contactIds.includes(contact.id));

      flowLogger.complete({
        success: true,
        totalContacts: allContacts.length,
        matchedContacts: matchedContacts.length,
        contactIdsRequested: contactIds.length
      });

     
      
      return matchedContacts;
      
    } catch (error) {
      flowLogger.logError('contacts_fetch_failed', error);
   
      
      return [];
    }
  }

  /**
   * Delete contact vector - FIXED namespace handling
   */
  static async deleteContactVector(contactId, userId) {
    const flowLogger = new FlowLogger('delete_contact_vector', userId);
    
    try {
      flowLogger.logStep('delete_start', {
        contactId,
        userId
      });

      const index = await this.getIndex();
      const namespace = `user_${userId}`;
      const namespacedIndex = index.namespace(namespace);
      
      await namespacedIndex.deleteOne(contactId);
      
      flowLogger.complete({
        success: true,
        contactId,
        namespace
      });

     
      
    } catch (error) {
      flowLogger.logError('delete_failed', error);
      
    
      
      // Don't throw - vector operations should not break contact deletion
    }
  }

  /**
   * Batch update vectors for subscription changes - UPDATED WITH LOGGING
   */
  static async rebuildUserVectors(userId, newSubscriptionLevel) {
    const flowLogger = new FlowLogger('rebuild_user_vectors', userId);
    const startTime = Date.now();
    
    try {
      flowLogger.logStep('rebuild_start', {
        userId,
        newSubscriptionLevel,
        embeddingModel: 'text-embedding-004'
      });

      // Get all user's contacts
      const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();
      
      if (!contactsDoc.exists) {
        flowLogger.logStep('no_contacts_found', { message: 'No contacts document found' });
        return { rebuilt: 0, total: 0 };
      }

      const contacts = contactsDoc.data().contacts || [];
      
      flowLogger.logStep('contacts_loaded', {
        totalContacts: contacts.length
      });

      let rebuilt = 0;
      let errors = 0;
      const batchSize = 5; // Smaller batches for Gemini API

      // Process in batches to avoid overwhelming the APIs
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(contacts.length / batchSize);
        
        flowLogger.logStep('batch_start', {
          batchNumber,
          totalBatches,
          batchSize: batch.length,
          contactIds: batch.map(c => c.id)
        });
        
        await Promise.all(
          batch.map(async (contact) => {
            try {
              await this.upsertContactVector(contact, newSubscriptionLevel);
              rebuilt++;
            } catch (error) {
              errors++;
             
            }
          })
        );
        
        flowLogger.logStep('batch_complete', {
          batchNumber,
          rebuiltInBatch: batch.length - (errors - (rebuilt - batch.length + errors)),
          errorsInBatch: errors - (rebuilt - batch.length)
        });
        
        // Delay between batches to respect API limits
        if (i + batchSize < contacts.length) {
          await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay for Gemini
        }
      }

      const totalDuration = Date.now() - startTime;
      
      flowLogger.complete({
        success: true,
        totalContacts: contacts.length,
        rebuilt,
        errors,
        totalDuration,
        embeddingModel: 'text-embedding-004'
      });

     
      
      return { rebuilt, total: contacts.length, errors };
      
    } catch (error) {
      flowLogger.logError('rebuild_failed', error);
      
    
      
      throw error;
    }
  }

  // The NEW, correct getIndexStats function
// lib/services/serviceContact/server/vectorService.js

// ... all other functions in the class are fine ...

  // ✅ THIS IS THE CORRECTED FUNCTION
  static async getIndexStats() {
    const flowLogger = new FlowLogger('get_index_stats', 'system');
    const startTime = Date.now();
    
    try {
      flowLogger.logStep('stats_request_start', { indexName: INDEX_NAME });
      
      const index = await this.getIndex();
      // Directly get the stats object from Pinecone
      const stats = await index.describeIndexStats();
      
      flowLogger.complete({
        success: true,
        stats: stats, // Log the full stats object for debugging
        duration: Date.now() - startTime
      });

      
      
      // ✅ THE FIX: Return the entire, original 'stats' object from Pinecone.
      // Do not create a new 'result' object.
      return stats;
      
    } catch (error) {
      flowLogger.logError('stats_request_failed', error);
      
    
      return null;
    }
  }

// ... rest of the file ...
  /**
   * Clean up orphaned vectors - UPDATED WITH LOGGING
   */
  static async cleanupOrphanedVectors(userId) {
    const flowLogger = new FlowLogger('cleanup_orphaned_vectors', userId);
    const startTime = Date.now();
    
    try {
      flowLogger.logStep('cleanup_start', { userId });
      
      // Get all contact IDs from Firestore
      const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();
      const validContactIds = new Set();
      
      if (contactsDoc.exists) {
        const contacts = contactsDoc.data().contacts || [];
        contacts.forEach(contact => validContactIds.add(contact.id));
      }

      flowLogger.logStep('valid_contacts_loaded', {
        validContactCount: validContactIds.size
      });

      // Query vectors for this user
      const index = await this.getIndex();
      const namespace = `user_${userId}`;
      const namespacedIndex = index.namespace(namespace);
      
      // Create a dummy vector for querying (Gemini text-embedding-004 is 768-dimensional)
      const dummyVector = new Array(768).fill(0);
      
      const queryResult = await namespacedIndex.query({
        vector: dummyVector,
        topK: 1000, // Get many results
        includeMetadata: true
      });

      flowLogger.logStep('vectors_queried', {
        vectorsFound: queryResult.matches?.length || 0,
        namespace
      });

      // Find orphaned vectors
      const orphanedIds = [];
      queryResult.matches?.forEach(match => {
        if (!validContactIds.has(match.id)) {
          orphanedIds.push(match.id);
        }
      });

      flowLogger.logStep('orphaned_vectors_identified', {
        orphanedCount: orphanedIds.length,
        orphanedIds: orphanedIds.slice(0, 10) // Log first 10 for debugging
      });

      // Delete orphaned vectors in batches
      if (orphanedIds.length > 0) {
        const batchSize = 100;
        let deleted = 0;
        
        for (let i = 0; i < orphanedIds.length; i += batchSize) {
          const batch = orphanedIds.slice(i, i + batchSize);
          try {
            await namespacedIndex.deleteMany(batch);
            deleted += batch.length;
            
            flowLogger.logStep('batch_deleted', {
              batchNumber: Math.floor(i / batchSize) + 1,
              deletedInBatch: batch.length,
              totalDeleted: deleted
            });
            
          } catch (error) {
           
          }
        }
        
        flowLogger.complete({
          success: true,
          cleaned: deleted,
          found: orphanedIds.length,
          duration: Date.now() - startTime
        });

       
        
        return { cleaned: deleted, found: orphanedIds.length };
      } else {
        flowLogger.complete({
          success: true,
          cleaned: 0,
          found: 0,
          message: 'No orphaned vectors found'
        });
        
     
        
        return { cleaned: 0, found: 0 };
      }

    } catch (error) {
      flowLogger.logError('cleanup_failed', error);
   
      
      return { cleaned: 0, found: 0, error: error.message };
    }
  }

  /**
   * Test vector operations - UPDATED WITH LOGGING
   */
  static async testVectorOperations(userId) {
    const flowLogger = new FlowLogger('test_vector_operations', userId);
    const startTime = Date.now();
    
    try {
      flowLogger.logStep('test_start', {
        userId,
        embeddingModel: 'text-embedding-004'
      });

      // Test embedding generation
      flowLogger.logStep('test_embedding_start', { message: 'Testing Gemini embedding generation' });
      const testEmbedding = await this.getEmbedding("test contact search");
      
      flowLogger.logStep('test_embedding_complete', {
        embeddingDimension: testEmbedding.length,
        embeddingPreview: testEmbedding.slice(0, 5)
      });
      
      // Test search with a simple query
      flowLogger.logStep('test_search_start', { message: 'Testing semantic search' });
      const searchResults = await this.search("test", userId, "premium");
      
      flowLogger.logStep('test_search_complete', {
        resultsCount: searchResults.length
      });
      
      // Get index stats
      flowLogger.logStep('test_stats_start', { message: 'Testing index stats' });
      const stats = await this.getIndexStats();
      
      flowLogger.logStep('test_stats_complete', {
        statsRetrieved: !!stats,
        vectorCount: stats?.vectorCount || 0
      });
      
      const result = {
        success: true,
        embeddingDimensions: testEmbedding.length,
        searchResults: searchResults.length,
        indexStats: stats,
        embeddingModel: 'text-embedding-004',
        duration: Date.now() - startTime
      };
      
      flowLogger.complete({
        success: true,
        testResults: result
      });

      
      
      return result;
      
    } catch (error) {
      flowLogger.logError('test_operations_failed', error);
      
     
      
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Migrate vectors from OpenAI to Gemini embeddings - UPDATED WITH LOGGING
   */
  static async migrateToGeminiEmbeddings(userId) {
    const flowLogger = new FlowLogger('migrate_to_gemini', userId);
    const startTime = Date.now();
    
    try {
      flowLogger.logStep('migration_start', {
        userId,
        targetModel: 'text-embedding-004'
      });
      
      const userDoc = await adminDb.collection('AccountData').doc(userId).get();
      if (!userDoc.exists) {
        const error = new Error('User not found');
        flowLogger.logError('user_not_found', error);
        throw error;
      }
      
      const subscriptionLevel = userDoc.data().accountType?.toLowerCase() || 'base';
      
      flowLogger.logStep('user_data_loaded', {
        subscriptionLevel,
        accountType: userDoc.data().accountType
      });
      
      // Rebuild all vectors with Gemini embeddings
      const result = await this.rebuildUserVectors(userId, subscriptionLevel);
      
      flowLogger.complete({
        success: true,
        migrationResult: result,
        duration: Date.now() - startTime
      });

     
      
      return result;
      
    } catch (error) {
      flowLogger.logError('migration_failed', error);
    
      
      throw error;
    }
  }

  /**
   * Batch migrate all users from OpenAI to Gemini - UPDATED WITH LOGGING
   */
  static async batchMigrateToGemini(batchSize = 10) {
    const flowLogger = new FlowLogger('batch_migrate_to_gemini', 'system');
    const startTime = Date.now();
    
    try {
      flowLogger.logStep('batch_migration_start', {
        batchSize,
        targetModel: 'text-embedding-004'
      });
      
      // Get all users with contacts
      const contactsSnapshot = await adminDb.collection('Contacts').get();
      const userIds = [];
      
      contactsSnapshot.forEach(doc => {
        if (doc.data().contacts && doc.data().contacts.length > 0) {
          userIds.push(doc.id);
        }
      });
      
      flowLogger.logStep('users_identified', {
        totalUsers: userIds.length,
        userIds: userIds.slice(0, 10) // Log first 10 for debugging
      });
      
      let migrated = 0;
      let errors = 0;
      
      // Process in batches
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(userIds.length / batchSize);
        
        flowLogger.logStep('batch_start', {
          batchNumber,
          totalBatches,
          userIds: batch
        });
        
        await Promise.all(
          batch.map(async (userId) => {
            try {
              await this.migrateToGeminiEmbeddings(userId);
              migrated++;
              
           
              
            } catch (error) {
              errors++;
              
             
            }
          })
        );
        
        flowLogger.logStep('batch_complete', {
          batchNumber,
          migratedInBatch: batch.length - (errors - (migrated - batch.length + errors)),
          errorsInBatch: errors - (migrated - batch.length)
        });
        
        // Delay between batches
        if (i + batchSize < userIds.length) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      const result = {
        totalUsers: userIds.length,
        migrated,
        errors,
        success: errors === 0,
        duration: Date.now() - startTime
      };
      
      flowLogger.complete({
        success: true,
        migrationResults: result
      });

    
      
      return result;
      
    } catch (error) {
      flowLogger.logError('batch_migration_failed', error);
      
     
      
      throw error;
    }
  }
  
  static _indexInstance = null;
}