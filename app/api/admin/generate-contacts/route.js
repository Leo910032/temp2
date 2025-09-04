// app/api/admin/generate-contacts/route.js - FIXED VERSION
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { generateRandomContacts } from '../../../../scripts/generateRandomContacts.js';

export async function POST(request) {
    try {
        console.log('🎲 POST /api/admin/generate-contacts - Generating random contacts');

        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Parse request body - FIXED: Include all the new options
        const body = await request.json();
        const {
            count = 50,
            eventPercentage = 0.4,
            locationPercentage = 0.7,
            forceEventLocation = false,
            forceRandomLocation = false,
            targetUserId = null,
            // FIXED: Extract message options from request body
            includeMessages = false,
            messageProbability = 1.0,
            forceExchangeForm = false,
            // FIXED: Extract note options too
            includeNotes = true,
            noteScenario = 'mixed',
            noteComplexity = 'medium',
            noteProbability = 0.7
        } = body;

        const finalUserId = targetUserId || userId;

        console.log('🎲 Generation parameters:', {
            userId: finalUserId,
            count,
            eventPercentage,
            locationPercentage,
            forceEventLocation,
            forceRandomLocation,
            // FIXED: Log message options
            includeMessages,
            messageProbability,
            forceExchangeForm,
            includeNotes,
            noteProbability
        });

        // FIXED: Pass all options to generateRandomContacts
        const rawContacts = generateRandomContacts(count, {
            eventPercentage,
            locationPercentage,
            forceEventLocation,
            forceRandomLocation,
            // FIXED: Pass through message options
            includeMessages,
            messageProbability,
            forceExchangeForm,
            // FIXED: Pass through note options
            includeNotes,
            noteScenario,
            noteComplexity,
            noteProbability
        });

        // Mark all generated contacts as test data
        const contacts = rawContacts.map(contact => ({
            ...contact,
            testData: true,
            source: contact.source || 'admin_test',
            generatedBy: 'admin_panel',
            generatedAt: new Date().toISOString(),
            generatedByAdmin: userId,
            generatedForUser: finalUserId
        }));

        // Get existing contacts
        const contactsRef = adminDb.collection('Contacts').doc(finalUserId);
        const contactsDoc = await contactsRef.get();
        
        let existingContacts = [];
        if (contactsDoc.exists) {
            existingContacts = contactsDoc.data().contacts || [];
        }

        const allContacts = [...contacts, ...existingContacts];

        // Calculate statistics - FIXED: Include message stats
        const statistics = {
            totalSubmissions: allContacts.length,
            newContacts: allContacts.filter(c => c.status === 'new').length,
            viewedContacts: allContacts.filter(c => c.status === 'viewed').length,
            archivedContacts: allContacts.filter(c => c.status === 'archived').length,
            contactsWithLocation: allContacts.filter(c => c.location && c.location.latitude).length,
            // FIXED: Add message statistics
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
                // FIXED: Add test data message stats
                testContactsWithMessages: allContacts.filter(c => c.testData === true && c.message && c.message.length > 0).length,
                testContactsWithNotes: allContacts.filter(c => c.testData === true && c.notes && c.notes.length > 0).length,
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

        // Calculate insights for response - FIXED: Include message insights
        const insights = {
            eventsRepresented: [...new Set(contacts.filter(c => c.eventInfo).map(c => c.eventInfo.eventName))],
            companiesRepresented: [...new Set(contacts.map(c => c.company))],
            contactsFromEvents: contacts.filter(c => c.eventInfo).length,
            contactsWithLocation: contacts.filter(c => c.location).length,
            // FIXED: Add message insights
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
                generatedByAdmin: userId,
                targetUser: finalUserId,
                // FIXED: Add message generation insights
                messageGenerationEnabled: includeMessages,
                expectedMessagesCount: includeMessages ? Math.round(count * messageProbability) : 0,
                actualMessagesCount: contacts.filter(c => c.message).length
            }
        };

        console.log('✅ Random contacts generated successfully:', {
            userId: finalUserId,
            generated: contacts.length,
            total: allContacts.length,
            withEvents: insights.contactsFromEvents,
            withLocation: insights.contactsWithLocation,
            // FIXED: Log message generation results
            withMessages: insights.contactsWithMessages,
            withNotes: insights.contactsWithNotes,
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
                    // FIXED: Include message info in sample
                    hasMessage: !!contact.message,
                    hasNotes: !!contact.notes,
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

// GET endpoint remains the same but add message stats
export async function GET(request) {
    try {
        console.log('📊 GET /api/admin/generate-contacts - Getting generation info');

        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');

        let currentStats = null;
        let testDataInfo = null;
        
        if (userId) {
            const contactsRef = adminDb.collection('Contacts').doc(userId);
            const contactsDoc = await contactsRef.get();
            
            if (contactsDoc.exists) {
                const data = contactsDoc.data();
                const contacts = data.contacts || [];
                
                // Regular stats - FIXED: Include message stats
                currentStats = {
                    totalContacts: contacts.length,
                    withLocation: contacts.filter(c => c.location && c.location.latitude).length,
                    fromEvents: contacts.filter(c => c.eventInfo).length,
                    // FIXED: Add message and notes stats
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

                // Test data specific info - FIXED: Include message stats
                const testContacts = contacts.filter(c => c.testData === true);
                testDataInfo = {
                    totalTestContacts: testContacts.length,
                    testContactsWithLocation: testContacts.filter(c => c.location && c.location.latitude).length,
                    testContactsFromEvents: testContacts.filter(c => c.eventInfo).length,
                    // FIXED: Add message and notes stats for test data
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
            testDataInfo: testDataInfo,
            generationOptions: {
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
                    // FIXED: Add message generation features
                    supportsMessageGeneration: true,
                    supportsNoteGeneration: true,
                    allowsCustomMessageProbability: true
                }
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
        });

    } catch (error) {
        console.error('❌ Error getting generation info:', error);
        return NextResponse.json({ 
            error: 'Failed to get generation info',
            details: error.message 
        }, { status: 500 });
    }
}