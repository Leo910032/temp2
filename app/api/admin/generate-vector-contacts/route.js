// app/api/admin/generate-vector-contacts/route.js - Vector-Enabled Contact Generation API
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { generateRandomContacts } from '../../../../scripts/generateRandomContacts.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize services
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Constants
const INDEX_NAME = 'networking-app-contacts';
const EMBEDDING_MODEL = 'text-embedding-004';
const VECTOR_DIMENSIONS = 768; // Gemini text-embedding-004 dimensions

// Cost tracking
const COSTS = {
  EMBEDDING_PER_MILLION_TOKENS: 0.15, // $0.15 per 1M tokens
  PINECONE_UPSERT_PER_REQUEST: 0.0000675, // ~$0.0675 per 1K operations
};

export async function POST(request) {
    try {
        console.log('🎲 POST /api/admin/generate-vector-contacts - Generating vector-enabled contacts');

        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const adminUserId = decodedToken.uid;

        // Parse request body with vector-specific options
        const body = await request.json();
        const {
            count = 30,
            eventPercentage = 0.6,
            locationPercentage = 0.8,
            forceEventLocation = false,
            forceRandomLocation = false,
            targetUserId = null,
            // Vector-specific options
            enableVectorStorage = true,
            forceVectorCreation = false,
            vectorOptimizationLevel = 'premium',
            // Enhanced note options for better vectors
            includeNotes = true,
            noteScenario = 'vectorOptimized',
            noteComplexity = 'premium',
            noteProbability = 0.95,
            // Message options
            includeMessages = true,
            messageProbability = 0.8,
            forceExchangeForm = true
        } = body;

        const finalUserId = targetUserId || adminUserId;

        console.log('🎲 Vector generation parameters:', {
            userId: finalUserId,
            count,
            enableVectorStorage,
            vectorOptimizationLevel,
            noteScenario,
            noteComplexity
        });

        // 1. Check user's subscription level for vector eligibility
        const userDoc = await adminDb.collection('AccountData').doc(finalUserId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
        }

        const userData = userDoc.data();
        const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';
        const hasVectorSupport = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);

        console.log('📊 User subscription check:', {
            userId: finalUserId,
            subscriptionLevel,
            hasVectorSupport,
            vectorStorageRequested: enableVectorStorage
        });

        // Determine if we should create vectors
        const shouldCreateVectors = enableVectorStorage && (hasVectorSupport || forceVectorCreation);

        if (enableVectorStorage && !hasVectorSupport && !forceVectorCreation) {
            console.warn('⚠️ Vector storage requested but user lacks subscription tier');
        }

        // 2. Generate random contacts with enhanced options
        const rawContacts = generateRandomContacts(count, {
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
        });

        // 3. Mark all generated contacts as test data with vector metadata
        const contacts = rawContacts.map(contact => ({
            ...contact,
            testData: true,
            source: contact.source || 'admin_vector_test',
            generatedBy: 'admin_vector_panel',
            generatedAt: new Date().toISOString(),
            generatedByAdmin: adminUserId,
            generatedForUser: finalUserId,
            vectorMetadata: {
                vectorEligible: shouldCreateVectors,
                vectorOptimizationLevel,
                noteScenario,
                subscriptionTierAtCreation: subscriptionLevel,
                vectorCreated: false, // Will be updated after vector creation
                vectorId: null
            }
        }));

        console.log(`✅ Generated ${contacts.length} contacts with vector metadata`);

        // 4. Create vectors for eligible contacts (if enabled)
        let vectorResults = {
            vectorsCreated: 0,
            vectorsSkipped: 0,
            vectorErrors: 0,
            totalCost: 0,
            processingTime: 0
        };

        if (shouldCreateVectors) {
            console.log('🔮 Starting vector creation process...');
            vectorResults = await createContactVectors(contacts, finalUserId, subscriptionLevel);
            console.log('🔮 Vector creation completed:', vectorResults);
        } else {
            console.log('⏭️ Skipping vector creation (not enabled or user ineligible)');
            vectorResults.vectorsSkipped = contacts.length;
        }

        // 5. Save contacts to Firestore
        const contactsRef = adminDb.collection('Contacts').doc(finalUserId);
        const contactsDoc = await contactsRef.get();
        
        let existingContacts = [];
        if (contactsDoc.exists) {
            existingContacts = contactsDoc.data().contacts || [];
        }

        const allContacts = [...contacts, ...existingContacts];

        // 6. Calculate enhanced statistics
        const statistics = calculateEnhancedStatistics(allContacts, contacts, vectorResults);

        // 7. Save to Firebase with vector metadata
        await contactsRef.set({
            contacts: allContacts,
            lastUpdated: new Date().toISOString(),
            totalContacts: allContacts.length,
            statistics: statistics,
            vectorMetadata: {
                lastVectorGeneration: shouldCreateVectors ? new Date().toISOString() : null,
                totalVectors: vectorResults.vectorsCreated,
                vectorOptimizationLevel: shouldCreateVectors ? vectorOptimizationLevel : null,
                subscriptionTierForVectors: subscriptionLevel
            }
        }, { merge: true });

        // 8. Prepare response with vector insights
        const insights = calculateVectorInsights(contacts, vectorResults, subscriptionLevel);

        console.log('✅ Vector-enabled contacts generated successfully:', {
            userId: finalUserId,
            generated: contacts.length,
            vectorsCreated: vectorResults.vectorsCreated,
            totalCost: vectorResults.totalCost
        });

        return NextResponse.json({
            success: true,
            message: `Successfully generated ${contacts.length} vector-enabled test contacts`,
            data: {
                generated: contacts.length,
                totalContacts: allContacts.length,
                vectorResults: vectorResults,
                insights: insights,
                statistics: statistics,
                sampleContacts: contacts.slice(0, 3).map(contact => ({
                    name: contact.name,
                    company: contact.company,
                    source: contact.source,
                    hasLocation: !!contact.location,
                    hasMessage: !!contact.message,
                    hasNotes: !!contact.notes,
                    vectorCreated: contact.vectorMetadata?.vectorCreated || false,
                    eventInfo: contact.eventInfo?.eventName || null,
                    testData: contact.testData
                }))
            }
        });

    } catch (error) {
        console.error('❌ Error generating vector-enabled contacts:', error);
        return NextResponse.json({ 
            error: 'Failed to generate vector-enabled contacts',
            details: error.message 
        }, { status: 500 });
    }
}

/**
 * Create vectors for contacts using Gemini embeddings and store in Pinecone
 */
async function createContactVectors(contacts, userId, subscriptionLevel) {
    const startTime = Date.now();
    let vectorsCreated = 0;
    let vectorsSkipped = 0;
    let vectorErrors = 0;
    let totalCost = 0;

    console.log(`🔮 Creating vectors for ${contacts.length} contacts...`);

    try {
        // Initialize Pinecone index
        const namespace = `user_${userId}`;
        const index = pinecone.index(INDEX_NAME).namespace(namespace);
        const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

        // Process contacts in batches to avoid rate limits
        const batchSize = 10;
        const batches = [];
        for (let i = 0; i < contacts.length; i += batchSize) {
            batches.push(contacts.slice(i, i + batchSize));
        }

        for (const [batchIndex, batch] of batches.entries()) {
            console.log(`🔮 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} contacts)`);

            const vectorsToUpsert = [];

            for (const contact of batch) {
                try {
                    // Skip contacts without rich content for vectorization
                    if (!contact.notes || contact.notes.length === 0) {
                        console.log(`⏭️ Skipping contact ${contact.id} - no notes for vectorization`);
                        vectorsSkipped++;
                        continue;
                    }

                    // Create rich text content for embedding
                    const vectorContent = createVectorContent(contact, subscriptionLevel);
                    
                    if (vectorContent.length < 10) { // Skip very short content
                        console.log(`⏭️ Skipping contact ${contact.id} - content too short`);
                        vectorsSkipped++;
                        continue;
                    }

                    // Generate embedding
                    console.log(`🧠 Generating embedding for contact ${contact.id}`);
                    const embeddingResult = await embeddingModel.embedContent(vectorContent);
                    const embedding = embeddingResult.embedding.values;

                    // Calculate cost
                    const estimatedTokens = Math.ceil(vectorContent.length / 4);
                    const embeddingCost = (estimatedTokens / 1000000) * COSTS.EMBEDDING_PER_MILLION_TOKENS;
                    totalCost += embeddingCost;

                    // Prepare vector for Pinecone
                    const vector = {
                        id: contact.id,
                        values: embedding,
                        metadata: {
                            userId: userId,
                            name: contact.name || '',
                            company: contact.company || '',
                            email: contact.email || '',
                            source: contact.source || '',
                            createdAt: contact.generatedAt,
                            subscriptionTier: subscriptionLevel,
                            hasLocation: !!contact.location,
                            hasEvent: !!contact.eventInfo,
                            noteScenario: contact.vectorMetadata?.noteScenario || '',
                            contentLength: vectorContent.length,
                            isTestData: true
                        }
                    };

                    vectorsToUpsert.push(vector);

                    // Update contact with vector metadata
                    contact.vectorMetadata.vectorCreated = true;
                    contact.vectorMetadata.vectorId = contact.id;
                    contact.vectorMetadata.vectorDimensions = embedding.length;
                    contact.vectorMetadata.vectorContent = vectorContent.substring(0, 100) + '...';
                    contact.vectorMetadata.createdAt = new Date().toISOString();

                    vectorsCreated++;

                } catch (contactError) {
                    console.error(`❌ Error creating vector for contact ${contact.id}:`, contactError);
                    vectorErrors++;
                    
                    // Update contact with error metadata
                    contact.vectorMetadata.vectorCreated = false;
                    contact.vectorMetadata.vectorError = contactError.message;
                }
            }

            // Upsert batch to Pinecone
            if (vectorsToUpsert.length > 0) {
                try {
                    console.log(`📤 Upserting ${vectorsToUpsert.length} vectors to Pinecone...`);
                    await index.upsert(vectorsToUpsert);
                    
                    // Add Pinecone operation cost
                    totalCost += vectorsToUpsert.length * COSTS.PINECONE_UPSERT_PER_REQUEST;
                    
                    console.log(`✅ Successfully upserted ${vectorsToUpsert.length} vectors`);
                } catch (upsertError) {
                    console.error('❌ Error upserting vectors to Pinecone:', upsertError);
                    vectorErrors += vectorsToUpsert.length;
                    
                    // Mark all contacts in this batch as failed
                    for (const contact of batch) {
                        if (contact.vectorMetadata?.vectorCreated) {
                            contact.vectorMetadata.vectorCreated = false;
                            contact.vectorMetadata.vectorError = 'Pinecone upsert failed';
                        }
                    }
                }
            }

            // Small delay between batches to respect rate limits
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

    } catch (error) {
        console.error('❌ Error in vector creation process:', error);
        throw error;
    }

    const processingTime = Date.now() - startTime;

    return {
        vectorsCreated,
        vectorsSkipped,
        vectorErrors,
        totalCost,
        processingTime,
        namespace: `user_${userId}`,
        indexName: INDEX_NAME,
        model: EMBEDDING_MODEL,
        dimensions: VECTOR_DIMENSIONS
    };
}

/**
 * Create rich content for vectorization based on subscription level
 */
function createVectorContent(contact, subscriptionLevel) {
    let content = [];

    // Basic information (all tiers)
    if (contact.name) content.push(`Name: ${contact.name}`);
    if (contact.company) content.push(`Company: ${contact.company}`);
    if (contact.email) content.push(`Email: ${contact.email}`);

    // Enhanced content based on subscription tier
    if (subscriptionLevel === 'premium' || subscriptionLevel === 'business' || subscriptionLevel === 'enterprise') {
        if (contact.phone) content.push(`Phone: ${contact.phone}`);
        if (contact.notes) content.push(`Notes: ${contact.notes}`);
        if (contact.message) content.push(`Message: ${contact.message}`);
    }

    if (subscriptionLevel === 'business' || subscriptionLevel === 'enterprise') {
        if (contact.eventInfo) {
            content.push(`Event: ${contact.eventInfo.eventName}`);
            if (contact.eventInfo.description) content.push(`Event Description: ${contact.eventInfo.description}`);
        }
        if (contact.location) {
            content.push(`Location: ${contact.location.city || 'Unknown City'}`);
        }
    }

    if (subscriptionLevel === 'enterprise') {
        if (contact.source) content.push(`Source: ${contact.source}`);
        if (contact.submittedAt) content.push(`Date: ${new Date(contact.submittedAt).toLocaleDateString()}`);
        // Add any additional metadata for enterprise users
        if (contact.tags) content.push(`Tags: ${contact.tags.join(', ')}`);
    }

    return content.join(' | ');
}

/**
 * Calculate enhanced statistics including vector metrics
 */
function calculateEnhancedStatistics(allContacts, newContacts, vectorResults) {
    const baseStats = {
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
            admin_test: allContacts.filter(c => c.source === 'admin_test' || c.testData === true).length,
            admin_vector_test: allContacts.filter(c => c.source === 'admin_vector_test').length
        }
    };

    // Enhanced vector statistics
    const vectorStats = {
        totalVectorEnabledContacts: allContacts.filter(c => c.vectorMetadata?.vectorEligible).length,
        totalVectorsStored: allContacts.filter(c => c.vectorMetadata?.vectorCreated).length,
        vectorCreationSuccess: vectorResults.vectorsCreated,
        vectorCreationErrors: vectorResults.vectorErrors,
        vectorCreationCost: vectorResults.totalCost,
        vectorProcessingTime: vectorResults.processingTime,
        lastVectorGeneration: new Date().toISOString(),
        vectorsByTier: {
            premium: allContacts.filter(c => c.vectorMetadata?.subscriptionTierAtCreation === 'premium').length,
            business: allContacts.filter(c => c.vectorMetadata?.subscriptionTierAtCreation === 'business').length,
            enterprise: allContacts.filter(c => c.vectorMetadata?.subscriptionTierAtCreation === 'enterprise').length
        }
    };

    return {
        ...baseStats,
        vectorStats,
        testDataStats: {
            totalTestContacts: allContacts.filter(c => c.testData === true).length,
            testContactsWithVectors: allContacts.filter(c => c.testData === true && c.vectorMetadata?.vectorCreated).length,
            testContactsWithLocation: allContacts.filter(c => c.testData === true && c.location && c.location.latitude).length,
            testContactsFromEvents: allContacts.filter(c => c.testData === true && c.eventInfo).length,
            testContactsWithMessages: allContacts.filter(c => c.testData === true && c.message && c.message.length > 0).length,
            testContactsWithNotes: allContacts.filter(c => c.testData === true && c.notes && c.notes.length > 0).length,
            lastTestGeneration: new Date().toISOString(),
            lastVectorTestGeneration: vectorResults.vectorsCreated > 0 ? new Date().toISOString() : null
        }
    };
}

/**
 * Calculate vector-specific insights
 */
function calculateVectorInsights(contacts, vectorResults, subscriptionLevel) {
    return {
        eventsRepresented: [...new Set(contacts.filter(c => c.eventInfo).map(c => c.eventInfo.eventName))],
        companiesRepresented: [...new Set(contacts.map(c => c.company))],
        contactsFromEvents: contacts.filter(c => c.eventInfo).length,
        contactsWithLocation: contacts.filter(c => c.location).length,
        contactsWithMessages: contacts.filter(c => c.message && c.message.length > 0).length,
        contactsWithNotes: contacts.filter(c => c.notes && c.notes.length > 0).length,
        vectorInsights: {
            vectorsRequested: contacts.length,
            vectorsCreated: vectorResults.vectorsCreated,
            vectorsSkipped: vectorResults.vectorsSkipped,
            vectorErrors: vectorResults.vectorErrors,
            vectorSuccessRate: contacts.length > 0 ? (vectorResults.vectorsCreated / contacts.length) * 100 : 0,
            totalVectorCost: vectorResults.totalCost,
            averageCostPerVector: vectorResults.vectorsCreated > 0 ? vectorResults.totalCost / vectorResults.vectorsCreated : 0,
            processingTimeMs: vectorResults.processingTime,
            subscriptionTierUsed: subscriptionLevel,
            pineconeIndex: vectorResults.indexName,
            embeddingModel: vectorResults.model,
            vectorDimensions: vectorResults.dimensions
        },
        sourceDistribution: {
            business_card_scan: contacts.filter(c => c.source === 'business_card_scan').length,
            exchange_form: contacts.filter(c => c.source === 'exchange_form').length,
            manual: contacts.filter(c => c.source === 'manual').length,
            admin_vector_test: contacts.filter(c => c.source === 'admin_vector_test').length
        },
        testDataInsights: {
            allMarkedAsTestData: contacts.every(c => c.testData === true),
            allMarkedAsVectorTest: contacts.every(c => c.vectorMetadata?.vectorEligible),
            generationTimestamp: new Date().toISOString(),
            vectorOptimizationLevel: contacts[0]?.vectorMetadata?.vectorOptimizationLevel || 'unknown'
        }
    };
}

// GET endpoint for vector-specific information
export async function GET(request) {
    try {
        console.log('📊 GET /api/admin/generate-vector-contacts - Getting vector generation info');

        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');

        let currentStats = null;
        let vectorInfo = null;
        
        if (userId) {
            // Get user subscription info
            const userDoc = await adminDb.collection('AccountData').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : {};
            const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';
            const hasVectorSupport = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);

            // Get contact stats
            const contactsRef = adminDb.collection('Contacts').doc(userId);
            const contactsDoc = await contactsRef.get();
            
            if (contactsDoc.exists) {
                const data = contactsDoc.data();
                const contacts = data.contacts || [];
                
                currentStats = {
                    totalContacts: contacts.length,
                    withLocation: contacts.filter(c => c.location && c.location.latitude).length,
                    fromEvents: contacts.filter(c => c.eventInfo).length,
                    withMessages: contacts.filter(c => c.message && c.message.length > 0).length,
                    withNotes: contacts.filter(c => c.notes && c.notes.length > 0).length,
                    withVectors: contacts.filter(c => c.vectorMetadata?.vectorCreated).length,
                    vectorEligible: contacts.filter(c => c.vectorMetadata?.vectorEligible).length
                };

                vectorInfo = {
                    hasVectorSupport,
                    subscriptionTier: subscriptionLevel,
                    vectorsStored: currentStats.withVectors,
                    lastVectorUpdate: data.vectorMetadata?.lastVectorGeneration || null,
                    totalContacts: currentStats.totalContacts,
                    vectorPercentage: currentStats.totalContacts > 0 ? 
                        (currentStats.withVectors / currentStats.totalContacts) * 100 : 0,
                    pineconeIndexStatus: hasVectorSupport ? 'ready' : 'not_supported',
                    vectorDimensions: VECTOR_DIMENSIONS,
                    indexName: INDEX_NAME
                };
            }
        }

        return NextResponse.json({
            success: true,
            currentStats,
            vectorInfo,
            vectorGenerationOptions: {
                defaultCount: 30,
                maxCount: 100,
                supportedTiers: ['premium', 'business', 'enterprise'],
                embeddingModel: EMBEDDING_MODEL,
                vectorDimensions: VECTOR_DIMENSIONS,
                indexName: INDEX_NAME,
                costEstimates: {
                    embeddingPer1M: COSTS.EMBEDDING_PER_MILLION_TOKENS,
                    pineconeUpsertPer1K: COSTS.PINECONE_UPSERT_PER_REQUEST * 1000
                }
            },
            scenarios: {
                vectorOptimized: {
                    description: "Premium contacts with rich notes for semantic search",
                    recommendedTier: "premium+"
                },
                businessIntelligence: {
                    description: "Business-focused contacts for relationship mapping",
                    recommendedTier: "business+"
                },
                semanticSearchStress: {
                    description: "High-volume test for search performance",
                    recommendedTier: "enterprise"
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting vector generation info:', error);
        return NextResponse.json({ 
            error: 'Failed to get vector generation info',
            details: error.message 
        }, { status: 500 });
    }
}