// app/api/admin/cleanup-test-data/route.js - Cleanup Test Data API
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// ✅ POST - Clean up test data for a specific user
export async function POST(request) {
    try {
        console.log('🗑️ POST /api/admin/cleanup-test-data - Cleaning up test data');

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
            cleanupType = 'contacts' // Default to contacts cleanup
        } = body;

        if (!userId) {
            return NextResponse.json({ 
                error: 'User ID is required' 
            }, { status: 400 });
        }

        console.log('🗑️ Cleanup parameters:', {
            targetUserId: userId,
            cleanupType,
            adminUser: adminUserId
        });

        let deletedCount = 0;
        let cleanupDetails = {};

        if (cleanupType === 'contacts' || cleanupType === 'all') {
            // Clean up test contacts
            const contactsRef = adminDb.collection('Contacts').doc(userId);
            const contactsDoc = await contactsRef.get();
            
            if (contactsDoc.exists) {
                const data = contactsDoc.data();
                const contacts = data.contacts || [];
                
                // Separate test data from real data
                const realContacts = contacts.filter(contact => {
                    // Remove contacts marked as test data
                    const isTestData = contact.testData === true ||
                                     contact.source === 'admin_test' ||
                                     contact.generatedBy === 'admin_panel' ||
                                     contact.generatedByAdmin;
                    
                    return !isTestData;
                });

                const testContacts = contacts.filter(contact => {
                    const isTestData = contact.testData === true ||
                                     contact.source === 'admin_test' ||
                                     contact.generatedBy === 'admin_panel' ||
                                     contact.generatedByAdmin;
                    
                    return isTestData;
                });

                deletedCount = testContacts.length;

                if (deletedCount > 0) {
                    // Calculate updated statistics
                    const updatedStatistics = {
                        totalSubmissions: realContacts.length,
                        newContacts: realContacts.filter(c => c.status === 'new').length,
                        viewedContacts: realContacts.filter(c => c.status === 'viewed').length,
                        archivedContacts: realContacts.filter(c => c.status === 'archived').length,
                        contactsWithLocation: realContacts.filter(c => c.location && c.location.latitude).length,
                        lastSubmissionDate: realContacts.length > 0 ? 
                            Math.max(...realContacts.map(c => new Date(c.submittedAt || 0).getTime())) : null,
                        sources: {
                            exchange_form: realContacts.filter(c => c.source === 'exchange_form').length,
                            business_card_scan: realContacts.filter(c => c.source === 'business_card_scan').length,
                            manual: realContacts.filter(c => c.source === 'manual' || (!c.source && !c.testData)).length,
                            import: realContacts.filter(c => c.source === 'import' || c.source === 'import_csv').length,
                            admin_test: 0 // Should be 0 after cleanup
                        },
                        testDataStats: {
                            totalTestContacts: 0, // Should be 0 after cleanup
                            testContactsWithLocation: 0,
                            testContactsFromEvents: 0,
                            lastTestGeneration: null,
                            generatedByAdmins: [],
                            lastCleanup: new Date().toISOString(),
                            cleanedByAdmin: adminUserId
                        },
                        lastCleanup: {
                            timestamp: new Date().toISOString(),
                            cleanedByAdmin: adminUserId,
                            deletedCount: deletedCount,
                            cleanupType: 'test_contacts'
                        }
                    };

                    if (updatedStatistics.lastSubmissionDate) {
                        updatedStatistics.lastSubmissionDate = new Date(updatedStatistics.lastSubmissionDate).toISOString();
                    }

                    // Update Firebase with cleaned data
                    await contactsRef.set({
                        contacts: realContacts,
                        lastUpdated: new Date().toISOString(),
                        totalContacts: realContacts.length,
                        statistics: updatedStatistics
                    }, { merge: true });

                    cleanupDetails.contacts = {
                        deletedTestContacts: deletedCount,
                        remainingContacts: realContacts.length,
                        deletedBreakdown: {
                            bySource: {
                                admin_test: testContacts.filter(c => c.source === 'admin_test').length,
                                admin_panel: testContacts.filter(c => c.generatedBy === 'admin_panel').length,
                                marked_test_data: testContacts.filter(c => c.testData === true).length
                            },
                            withLocation: testContacts.filter(c => c.location && c.location.latitude).length,
                            fromEvents: testContacts.filter(c => c.eventInfo).length
                        }
                    };

                    console.log('✅ Test contacts cleanup completed:', {
                        userId,
                        deletedCount,
                        remainingContacts: realContacts.length
                    });
                } else {
                    console.log('ℹ️ No test contacts found for cleanup:', { userId });
                }
            } else {
                console.log('ℹ️ No contacts document found for user:', { userId });
            }
        }

        // Future: Add cleanup for other data types (groups, analytics, etc.)
        if (cleanupType === 'groups' || cleanupType === 'all') {
            // TODO: Implement test group cleanup
            cleanupDetails.groups = {
                message: 'Group cleanup not yet implemented'
            };
        }

        if (cleanupType === 'analytics' || cleanupType === 'all') {
            // TODO: Implement test analytics cleanup
            cleanupDetails.analytics = {
                message: 'Analytics cleanup not yet implemented'
            };
        }

        console.log('✅ Test data cleanup completed successfully:', {
            userId,
            cleanupType,
            totalDeletedCount: deletedCount,
            adminUser: adminUserId
        });

        return NextResponse.json({
            success: true,
            message: `Successfully cleaned up test data for user`,
            data: {
                userId,
                cleanupType,
                deletedCount,
                cleanupDetails,
                cleanupTimestamp: new Date().toISOString(),
                cleanedByAdmin: adminUserId
            }
        });

    } catch (error) {
        console.error('❌ Error cleaning up test data:', error);
        return NextResponse.json({ 
            error: 'Failed to cleanup test data',
            details: error.message 
        }, { status: 500 });
    }
}

// ✅ GET - Get cleanup options and statistics
export async function GET(request) {
    try {
        console.log('📊 GET /api/admin/cleanup-test-data - Getting cleanup info');

        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');

        let testDataInfo = null;
        
        if (userId) {
            // Get current test data statistics
            const contactsRef = adminDb.collection('Contacts').doc(userId);
            const contactsDoc = await contactsRef.get();
            
            if (contactsDoc.exists) {
                const data = contactsDoc.data();
                const contacts = data.contacts || [];
                
                // Analyze test data
                const testContacts = contacts.filter(contact => {
                    return contact.testData === true ||
                           contact.source === 'admin_test' ||
                           contact.generatedBy === 'admin_panel' ||
                           contact.generatedByAdmin;
                });

                const realContacts = contacts.filter(contact => {
                    return !(contact.testData === true ||
                            contact.source === 'admin_test' ||
                            contact.generatedBy === 'admin_panel' ||
                            contact.generatedByAdmin);
                });

                testDataInfo = {
                    totalContacts: contacts.length,
                    testContacts: testContacts.length,
                    realContacts: realContacts.length,
                    testDataBreakdown: {
                        bySource: {
                            admin_test: testContacts.filter(c => c.source === 'admin_test').length,
                            admin_panel: testContacts.filter(c => c.generatedBy === 'admin_panel').length,
                            marked_test_data: testContacts.filter(c => c.testData === true).length
                        },
                        withLocation: testContacts.filter(c => c.location && c.location.latitude).length,
                        fromEvents: testContacts.filter(c => c.eventInfo).length,
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
            }
        }

        return NextResponse.json({
            success: true,
            testDataInfo: testDataInfo,
            cleanupOptions: {
                availableTypes: ['contacts', 'groups', 'analytics', 'all'],
                defaultType: 'contacts',
                supportsPartialCleanup: true,
                preservesRealData: true,
                features: {
                    contactsCleanup: {
                        supported: true,
                        description: 'Removes all contacts marked as test data',
                        preserves: 'Real user contacts and their data'
                    },
                    groupsCleanup: {
                        supported: false, // TODO: Implement
                        description: 'Removes test groups (coming soon)',
                        preserves: 'User-created groups'
                    },
                    analyticsCleanup: {
                        supported: false, // TODO: Implement
                        description: 'Removes test analytics data (coming soon)',
                        preserves: 'Real analytics data'
                    }
                }
            },
            safetyInfo: {
                reversible: false,
                backupRecommended: true,
                affectsOnlyTestData: true,
                preservesUserData: true,
                requiresAdminAuth: true
            }
        });

    } catch (error) {
        console.error('❌ Error getting cleanup info:', error);
        return NextResponse.json({ 
            error: 'Failed to get cleanup info',
            details: error.message 
        }, { status: 500 });
    }
}