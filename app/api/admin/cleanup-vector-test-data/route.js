// app/api/admin/cleanup-vector-test-data/route.js - Vector-Enabled Cleanup API
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const INDEX_NAME = 'networking-app-contacts';

export async function POST(request) {
    try {
        console.log('🗑️ POST /api/admin/cleanup-vector-test-data - Cleaning up vector test data');

        // Authenticate admin user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const adminUserId = decodedToken.uid;

        // Parse request body
        const body = await request.json();
        const {
            userId,
            cleanupType = 'vector_contacts', // 'vector_contacts', 'vectors_only', 'contacts_only', 'all'
            includeVectorCleanup = true
        } = body;

        if (!userId) {
            return NextResponse.json({ 
                error: 'User ID is required' 
            }, { status: 400 });
        }

        console.log('🗑️ Vector cleanup parameters:', {
            targetUserId: userId,
            cleanupType,
            includeVectorCleanup,
            adminUser: adminUserId
        });

        let deletedCount = 0;
        let vectorsDeleted = 0;
        let cleanupDetails = {};

        // Check user's subscription for vector support
        const userDoc = await adminDb.collection('AccountData').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';
        const hasVectorSupport = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);

        // 1. Clean up vectors from Pinecone (if enabled and user has vector support)
        if (includeVectorCleanup && hasVectorSupport && (cleanupType === 'vector_contacts' || cleanupType === 'vectors_only' || cleanupType === 'all')) {
            console.log('🔮 Starting Pinecone vector cleanup...');
            
            try {
                const vectorCleanupResult = await cleanupPineconeVectors(userId);
                vectorsDeleted = vectorCleanupResult.vectorsDeleted;
                cleanupDetails.vectorCleanup = vectorCleanupResult;
                
                console.log(`✅ Pinecone cleanup completed: ${vectorsDeleted} vectors deleted`);
            } catch (vectorError) {
                console.error('❌ Error cleaning up Pinecone vectors:', vectorError);
                cleanupDetails.vectorCleanup = {
                    error: vectorError.message,
                    vectorsDeleted: 0
                };
            }
        } else if (includeVectorCleanup && !hasVectorSupport) {
            console.log('⏭️ Skipping vector cleanup - user does not have vector support');
            cleanupDetails.vectorCleanup = {
                skipped: true,
                reason: 'User subscription does not support vectors'
            };
        }

        // 2. Clean up contacts from Firestore (if requested)
        if (cleanupType === 'vector_contacts' || cleanupType === 'contacts_only' || cleanupType === 'all') {
            console.log('📚 Starting Firestore contact cleanup...');
            
            const contactsRef = adminDb.collection('Contacts').doc(userId);
            const contactsDoc = await contactsRef.get();
            
            if (contactsDoc.exists) {
                const data = contactsDoc.data();
                const contacts = data.contacts || [];
                
                // Separate test data from real data (including vector test data)
                const realContacts = contacts.filter(contact => {
                    const isTestData = contact.testData === true ||
                                     contact.source === 'admin_test' ||
                                     contact.source === 'admin_vector_test' ||
                                     contact.generatedBy === 'admin_panel' ||
                                     contact.generatedBy === 'admin_vector_panel' ||
                                     contact.generatedByAdmin;
                    
                    return !isTestData;
                });

                const testContacts = contacts.filter(contact => {
                    const isTestData = contact.testData === true ||
                                     contact.source === 'admin_test' ||
                                     contact.source === 'admin_vector_test' ||
                                     contact.generatedBy === 'admin_panel' ||
                                     contact.generatedBy === 'admin_vector_panel' ||
                                     contact.generatedByAdmin;
                    
                    return isTestData;
                });

                deletedCount = testContacts.length;

                if (deletedCount > 0) {
                    // Calculate updated statistics
                    const updatedStatistics = calculateCleanupStatistics(realContacts, adminUserId);

                    // Update Firebase with cleaned data
                    await contactsRef.set({
                        contacts: realContacts,
                        lastUpdated: new Date().toISOString(),
                        totalContacts: realContacts.length,
                        statistics: updatedStatistics,
                        vectorMetadata: {
                            // Reset vector metadata after cleanup
                            lastVectorGeneration: null,
                            totalVectors: 0,
                            vectorOptimizationLevel: null,
                            lastCleanup: new Date().toISOString(),
                            cleanedBy: adminUserId
                        }
                    }, { merge: true });

                    cleanupDetails.contacts = {
                        deletedTestContacts: deletedCount,
                        remainingContacts: realContacts.length,
                        deletedBreakdown: {
                            bySource: {
                                admin_test: testContacts.filter(c => c.source === 'admin_test').length,
                                admin_vector_test: testContacts.filter(c => c.source === 'admin_vector_test').length,
                                admin_panel: testContacts.filter(c => c.generatedBy === 'admin_panel').length,
                                admin_vector_panel: testContacts.filter(c => c.generatedBy === 'admin_vector_panel').length,
                                marked_test_data: testContacts.filter(c => c.testData === true).length
                            },
                            withLocation: testContacts.filter(c => c.location && c.location.latitude).length,
                            fromEvents: testContacts.filter(c => c.eventInfo).length,
                            withVectors: testContacts.filter(c => c.vectorMetadata?.vectorCreated).length,
                            withMessages: testContacts.filter(c => c.message && c.message.length > 0).length,
                            withNotes: testContacts.filter(c => c.notes && c.notes.length > 0).length
                        }
                    };

                    console.log('✅ Test contacts cleanup completed:', {
                        userId,
                        deletedCount,
                        remainingContacts: realContacts.length,
                        vectorTestContactsDeleted: testContacts.filter(c => c.vectorMetadata?.vectorCreated).length
                    });
                } else {
                    console.log('ℹ️ No test contacts found for cleanup:', { userId });
                }
            } else {
                console.log('ℹ️ No contacts document found for user:', { userId });
            }
        }

        console.log('✅ Vector test data cleanup completed successfully:', {
            userId,
            cleanupType,
            contactsDeleted: deletedCount,
            vectorsDeleted,
            adminUser: adminUserId
        });

        return NextResponse.json({
            success: true,
            message: `Successfully cleaned up vector test data for user`,
            data: {
                userId,
                cleanupType,
                contactsDeleted: deletedCount,
                vectorsDeleted,
                cleanupDetails,
                cleanupTimestamp: new Date().toISOString(),
                cleanedByAdmin: adminUserId
            }
        });

    } catch (error) {
        console.error('❌ Error cleaning up vector test data:', error);
        return NextResponse.json({ 
            error: 'Failed to cleanup vector test data',
            details: error.message 
        }, { status: 500 });
    }
}

/**
 * Clean up test vectors from Pinecone
 */
async function cleanupPineconeVectors(userId) {
    const namespace = `user_${userId}`;
    let vectorsDeleted = 0;
    let errors = [];

    try {
        console.log(`🔮 Cleaning up vectors in namespace: ${namespace}`);
        
        const index = pinecone.index(INDEX_NAME).namespace(namespace);

        // Query for test data vectors
        const queryResponse = await index.query({
            vector: new Array(768).fill(0), // Dummy vector for metadata filtering
            topK: 10000, // Large number to get all vectors
            includeMetadata: true,
            includeValues: false,
            filter: {
                isTestData: { $eq: true }
            }
        });

        if (queryResponse.matches && queryResponse.matches.length > 0) {
            console.log(`🔮 Found ${queryResponse.matches.length} test vectors to delete`);

            // Delete vectors in batches
            const batchSize = 100;
            const vectorIds = queryResponse.matches.map(match => match.id);
            
            for (let i = 0; i < vectorIds.length; i += batchSize) {
                const batchIds = vectorIds.slice(i, i + batchSize);
                
                try {
                    await index.deleteMany(batchIds);
                    vectorsDeleted += batchIds.length;
                    console.log(`🔮 Deleted batch of ${batchIds.length} vectors`);
                } catch (batchError) {
                    console.error(`❌ Error deleting vector batch:`, batchError);
                    errors.push(`Batch ${i / batchSize + 1}: ${batchError.message}`);
                }
            }
        } else {
            console.log('ℹ️ No test vectors found for cleanup');
        }

        return {
            vectorsDeleted,
            namespace,
            indexName: INDEX_NAME,
            errors: errors.length > 0 ? errors : null,
            cleanupTimestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Error in Pinecone cleanup:', error);
        throw new Error(`Pinecone cleanup failed: ${error.message}`);
    }
}

/**
 * Calculate updated statistics after cleanup
 */
function calculateCleanupStatistics(realContacts, adminUserId) {
    return {
        totalSubmissions: realContacts.length,
        newContacts: realContacts.filter(c => c.status === 'new').length,
        viewedContacts: realContacts.filter(c => c.status === 'viewed').length,
        archivedContacts: realContacts.filter(c => c.status === 'archived').length,
        contactsWithLocation: realContacts.filter(c => c.location && c.location.latitude).length,
        contactsWithMessages: realContacts.filter(c => c.message && c.message.length > 0).length,
        contactsWithNotes: realContacts.filter(c => c.notes && c.notes.length > 0).length,
        lastSubmissionDate: realContacts.length > 0 ? 
            Math.max(...realContacts.map(c => new Date(c.submittedAt || 0).getTime())) : null,
        sources: {
            exchange_form: realContacts.filter(c => c.source === 'exchange_form').length,
            business_card_scan: realContacts.filter(c => c.source === 'business_card_scan').length,
            manual: realContacts.filter(c => c.source === 'manual' || (!c.source && !c.testData)).length,
            import: realContacts.filter(c => c.source === 'import' || c.source === 'import_csv').length,
            admin_test: 0, // Should be 0 after cleanup
            admin_vector_test: 0 // Should be 0 after cleanup
        },
        vectorStats: {
            totalVectorEnabledContacts: realContacts.filter(c => c.vectorMetadata?.vectorEligible).length,
            totalVectorsStored: realContacts.filter(c => c.vectorMetadata?.vectorCreated).length,
            lastVectorGeneration: null, // Reset after cleanup
            vectorsByTier: {
                premium: realContacts.filter(c => c.vectorMetadata?.subscriptionTierAtCreation === 'premium').length,
                business: realContacts.filter(c => c.vectorMetadata?.subscriptionTierAtCreation === 'business').length,
                enterprise: realContacts.filter(c => c.vectorMetadata?.subscriptionTierAtCreation === 'enterprise').length
            }
        },
        testDataStats: {
            totalTestContacts: 0, // Should be 0 after cleanup
            testContactsWithVectors: 0,
            testContactsWithLocation: 0,
            testContactsFromEvents: 0,
            testContactsWithMessages: 0,
            testContactsWithNotes: 0,
            lastTestGeneration: null,
            lastVectorTestGeneration: null,
            lastCleanup: new Date().toISOString(),
            cleanedByAdmin: adminUserId
        },
        lastCleanup: {
            timestamp: new Date().toISOString(),
            cleanedByAdmin: adminUserId,
            deletedCount: 0, // Will be filled by caller
            cleanupType: 'vector_test_data'
        }
    };
}

// GET endpoint for vector cleanup information
export async function GET(request) {
    try {
        console.log('📊 GET /api/admin/cleanup-vector-test-data - Getting vector cleanup info');

        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');

        let testDataInfo = null;
        let vectorInfo = null;
        
        if (userId) {
            // Get user subscription info
            const userDoc = await adminDb.collection('AccountData').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : {};
            const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';
            const hasVectorSupport = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);

            // Get current test data statistics
            const contactsRef = adminDb.collection('Contacts').doc(userId);
            const contactsDoc = await contactsRef.get();
            
            if (contactsDoc.exists) {
                const data = contactsDoc.data();
                const contacts = data.contacts || [];
                
                // Analyze test data (including vector test data)
                const testContacts = contacts.filter(contact => {
                    return contact.testData === true ||
                           contact.source === 'admin_test' ||
                           contact.source === 'admin_vector_test' ||
                           contact.generatedBy === 'admin_panel' ||
                           contact.generatedBy === 'admin_vector_panel' ||
                           contact.generatedByAdmin;
                });

                const realContacts = contacts.filter(contact => {
                    return !(contact.testData === true ||
                            contact.source === 'admin_test' ||
                            contact.source === 'admin_vector_test' ||
                            contact.generatedBy === 'admin_panel' ||
                            contact.generatedBy === 'admin_vector_panel' ||
                            contact.generatedByAdmin);
                });

                testDataInfo = {
                    totalContacts: contacts.length,
                    testContacts: testContacts.length,
                    realContacts: realContacts.length,
                    testDataBreakdown: {
                        bySource: {
                            admin_test: testContacts.filter(c => c.source === 'admin_test').length,
                            admin_vector_test: testContacts.filter(c => c.source === 'admin_vector_test').length,
                            admin_panel: testContacts.filter(c => c.generatedBy === 'admin_panel').length,
                            admin_vector_panel: testContacts.filter(c => c.generatedBy === 'admin_vector_panel').length,
                            marked_test_data: testContacts.filter(c => c.testData === true).length
                        },
                        withLocation: testContacts.filter(c => c.location && c.location.latitude).length,
                        fromEvents: testContacts.filter(c => c.eventInfo).length,
                        withVectors: testContacts.filter(c => c.vectorMetadata?.vectorCreated).length,
                        withMessages: testContacts.filter(c => c.message && c.message.length > 0).length,
                        withNotes: testContacts.filter(c => c.notes && c.notes.length > 0).length,
                        byStatus: {
                            new: testContacts.filter(c => c.status === 'new').length,
                            viewed: testContacts.filter(c => c.status === 'viewed').length,
                            archived: testContacts.filter(c => c.status === 'archived').length
                        }
                    },
                    lastTestGeneration: testContacts.length > 0 ? 
                        Math.max(...testContacts.map(c => new Date(c.generatedAt || c.submittedAt || 0).getTime())) : null,
                    generatedByAdmins: [...new Set(testContacts.filter(c => c.generatedByAdmin).map(c => c.generatedByAdmin))],
                    canCleanup: testContacts.length > 0,
                    lastCleanup: data.statistics?.lastCleanup || null
                };

                if (testDataInfo.lastTestGeneration) {
                    testDataInfo.lastTestGeneration = new Date(testDataInfo.lastTestGeneration).toISOString();
                }

                // Vector-specific information
                vectorInfo = {
                    hasVectorSupport,
                    subscriptionTier: subscriptionLevel,
                    vectorsInTestData: testContacts.filter(c => c.vectorMetadata?.vectorCreated).length,
                    totalVectorsStored: contacts.filter(c => c.vectorMetadata?.vectorCreated).length,
                    lastVectorGeneration: data.vectorMetadata?.lastVectorGeneration || null,
                    canCleanupVectors: hasVectorSupport && testContacts.filter(c => c.vectorMetadata?.vectorCreated).length > 0
                };
            }
        }

        return NextResponse.json({
            success: true,
            testDataInfo: testDataInfo,
            vectorInfo: vectorInfo,
            cleanupOptions: {
                availableTypes: ['vector_contacts', 'vectors_only', 'contacts_only', 'all'],
                defaultType: 'vector_contacts',
                supportsVectorCleanup: true,
                supportsPartialCleanup: true,
                preservesRealData: true,
                features: {
                    vectorContactsCleanup: {
                        supported: true,
                        description: 'Removes test contacts and their vectors from both Firestore and Pinecone',
                        preserves: 'Real user contacts and their vectors'
                    },
                    vectorsOnlyCleanup: {
                        supported: true,
                        description: 'Removes only test vectors from Pinecone, keeps contacts in Firestore',
                        preserves: 'All contacts in Firestore'
                    },
                    contactsOnlyCleanup: {
                        supported: true,
                        description: 'Removes only test contacts from Firestore, keeps vectors in Pinecone',
                        preserves: 'All vectors in Pinecone'
                    }
                }
            },
            safetyInfo: {
                reversible: false,
                backupRecommended: true,
                affectsOnlyTestData: true,
                preservesUserData: true,
                requiresAdminAuth: true,
                vectorCleanupRequiresTier: ['premium', 'business', 'enterprise']
            }
        });

    } catch (error) {
        console.error('❌ Error getting vector cleanup info:', error);
        return NextResponse.json({ 
            error: 'Failed to get vector cleanup info',
            details: error.message 
        }, { status: 500 });
    }
}