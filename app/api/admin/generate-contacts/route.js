// app/api/admin/generate-contacts/route.js - Generate Random Contacts API (UPDATED)
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// ✅ Import our contact generator
import { generateRandomContacts } from '../../../../scripts/generateRandomContacts.js';

// ✅ POST - Generate and insert random contacts (UPDATED with test data marking)
export async function POST(request) {
    try {
        console.log('🎲 POST /api/admin/generate-contacts - Generating random contacts');

        // Authenticate admin user (you can modify this for your needs)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Parse request body
        const body = await request.json();
        const {
            count = 50,
            eventPercentage = 0.4,
            locationPercentage = 0.7,
            forceEventLocation = false,
            forceRandomLocation = false,
            targetUserId = null // Allow generating for specific user
        } = body;

        // Use targetUserId if provided (for admin), otherwise use authenticated user
        const finalUserId = targetUserId || userId;

        console.log('🎲 Generation parameters:', {
            userId: finalUserId,
            count,
            eventPercentage,
            locationPercentage,
            forceEventLocation,
            forceRandomLocation
        });

        // Generate random contacts
        const rawContacts = generateRandomContacts(count, {
            eventPercentage,
            locationPercentage,
            forceEventLocation,
            forceRandomLocation
        });

        // ✅ NEW: Mark all generated contacts as test data
        const contacts = rawContacts.map(contact => ({
            ...contact,
            testData: true, // Mark as test data for easy identification
            source: contact.source || 'admin_test', // Ensure source is marked
            generatedBy: 'admin_panel', // Track generation source
            generatedAt: new Date().toISOString(), // Track when generated
            generatedByAdmin: userId, // Track which admin generated it
            generatedForUser: finalUserId // Track which user it was generated for
        }));

        // Get existing contacts
        const contactsRef = adminDb.collection('Contacts').doc(finalUserId);
        const contactsDoc = await contactsRef.get();
        
        let existingContacts = [];
        if (contactsDoc.exists) {
            existingContacts = contactsDoc.data().contacts || [];
        }

        // Add new contacts to the beginning of the array
        const allContacts = [...contacts, ...existingContacts];

        // Calculate statistics
        const statistics = {
            totalSubmissions: allContacts.length,
            newContacts: allContacts.filter(c => c.status === 'new').length,
            viewedContacts: allContacts.filter(c => c.status === 'viewed').length,
            archivedContacts: allContacts.filter(c => c.status === 'archived').length,
            contactsWithLocation: allContacts.filter(c => c.location && c.location.latitude).length,
            lastSubmissionDate: new Date().toISOString(),
            sources: {
                exchange_form: allContacts.filter(c => c.source === 'exchange_form').length,
                business_card_scan: allContacts.filter(c => c.source === 'business_card_scan').length,
                manual: allContacts.filter(c => c.source === 'manual' || (!c.source && !c.testData)).length,
                import: allContacts.filter(c => c.source === 'import' || c.source === 'import_csv').length,
                admin_test: allContacts.filter(c => c.source === 'admin_test' || c.testData === true).length
            },
            // ✅ NEW: Test data statistics
            testDataStats: {
                totalTestContacts: allContacts.filter(c => c.testData === true).length,
                testContactsWithLocation: allContacts.filter(c => c.testData === true && c.location && c.location.latitude).length,
                testContactsFromEvents: allContacts.filter(c => c.testData === true && c.eventInfo).length,
                lastTestGeneration: new Date().toISOString(),
                generatedByAdmins: [...new Set(allContacts.filter(c => c.generatedByAdmin).map(c => c.generatedByAdmin))].length
            }
        };

        // Save to Firebase
        await contactsRef.set({
            contacts: allContacts,
            lastUpdated: new Date().toISOString(),
            totalContacts: allContacts.length,
            statistics: statistics
        }, { merge: true });

        // Calculate insights for response
        const insights = {
            eventsRepresented: [...new Set(contacts.filter(c => c.eventInfo).map(c => c.eventInfo.eventName))],
            companiesRepresented: [...new Set(contacts.map(c => c.company))],
            contactsFromEvents: contacts.filter(c => c.eventInfo).length,
            contactsWithLocation: contacts.filter(c => c.location).length,
            sourceDistribution: {
                business_card_scan: contacts.filter(c => c.source === 'business_card_scan').length,
                exchange_form: contacts.filter(c => c.source === 'exchange_form').length,
                manual: contacts.filter(c => c.source === 'manual').length,
                admin_test: contacts.filter(c => c.source === 'admin_test').length
            },
            // ✅ NEW: Test data specific insights
            testDataInsights: {
                allMarkedAsTestData: contacts.every(c => c.testData === true),
                generationTimestamp: new Date().toISOString(),
                generatedByAdmin: userId,
                targetUser: finalUserId
            }
        };

        console.log('✅ Random contacts generated successfully:', {
            userId: finalUserId,
            generated: contacts.length,
            total: allContacts.length,
            withEvents: insights.contactsFromEvents,
            withLocation: insights.contactsWithLocation,
            testDataMarked: contacts.filter(c => c.testData === true).length
        });

        return NextResponse.json({
            success: true,
            message: `Successfully generated ${contacts.length} random test contacts`,
            data: {
                generated: contacts.length,
                totalContacts: allContacts.length,
                insights: insights,
                statistics: statistics,
                sampleContacts: contacts.slice(0, 3).map(contact => ({
                    name: contact.name,
                    company: contact.company,
                    source: contact.source,
                    hasLocation: !!contact.location,
                    eventInfo: contact.eventInfo?.eventName || null,
                    testData: contact.testData,
                    generatedBy: contact.generatedBy
                }))
            }
        });

    } catch (error) {
        console.error('❌ Error generating random contacts:', error);
        return NextResponse.json({ 
            error: 'Failed to generate random contacts',
            details: error.message 
        }, { status: 500 });
    }
}

// ✅ GET - Get generation options and statistics (UPDATED with test data info)
export async function GET(request) {
    try {
        console.log('📊 GET /api/admin/generate-contacts - Getting generation info');

        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');

        let currentStats = null;
        let testDataInfo = null;
        
        if (userId) {
            // Get current contact statistics
            const contactsRef = adminDb.collection('Contacts').doc(userId);
            const contactsDoc = await contactsRef.get();
            
            if (contactsDoc.exists) {
                const data = contactsDoc.data();
                const contacts = data.contacts || [];
                
                // Regular stats
                currentStats = {
                    totalContacts: contacts.length,
                    withLocation: contacts.filter(c => c.location && c.location.latitude).length,
                    fromEvents: contacts.filter(c => c.eventInfo).length,
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

                // ✅ NEW: Test data specific info
                const testContacts = contacts.filter(c => c.testData === true);
                testDataInfo = {
                    totalTestContacts: testContacts.length,
                    testContactsWithLocation: testContacts.filter(c => c.location && c.location.latitude).length,
                    testContactsFromEvents: testContacts.filter(c => c.eventInfo).length,
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

        // Return available events and generation options
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

        return NextResponse.json({
            success: true,
            currentStats: currentStats,
            testDataInfo: testDataInfo, // ✅ NEW: Include test data information
            generationOptions: {
                defaultCount: 50,
                maxCount: 200,
                defaultEventPercentage: 0.4,
                defaultLocationPercentage: 0.7,
                availableEvents: availableEvents.length,
                availableCompanies: sampleCompanies.length,
                // ✅ NEW: Test data options
                testDataFeatures: {
                    autoMarkAsTestData: true,
                    trackGenerationSource: true,
                    enableCleanup: true,
                    supportsBulkDelete: true
                }
            },
            examples: {
                testAutoGrouping: {
                    description: "Generate contacts optimized for testing auto-grouping",
                    params: {
                        count: 75,
                        eventPercentage: 0.6,
                        locationPercentage: 0.8
                    }
                },
                eventFocused: {
                    description: "Generate mostly event-based contacts",
                    params: {
                        count: 50,
                        eventPercentage: 0.8,
                        locationPercentage: 0.9
                    }
                },
                locationSpread: {
                    description: "Generate contacts spread across tech hubs",
                    params: {
                        count: 60,
                        eventPercentage: 0.2,
                        locationPercentage: 0.9
                    }
                },
                // ✅ NEW: Test data specific examples
                cleanupTest: {
                    description: "Small batch for testing cleanup functionality",
                    params: {
                        count: 10,
                        eventPercentage: 0.5,
                        locationPercentage: 0.5
                    }
                }
            },
            availableEvents: availableEvents,
            sampleCompanies: sampleCompanies
        });

    } catch (error) {
        console.error('❌ Error getting generation info:', error);
        return NextResponse.json({ 
            error: 'Failed to get generation info',
            details: error.message 
        }, { status: 500 });
    }
}