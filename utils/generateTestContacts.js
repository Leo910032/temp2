// utils/generateTestContacts.js - Client-side utility for generating test contacts
import { auth } from '@/important/firebase';

/**
 * Generate random test contacts using the API
 */
export async function generateTestContacts(options = {}) {
    try {
        const {
            count = 50,
            eventPercentage = 0.4,
            locationPercentage = 0.7,
            forceEventLocation = false,
            forceRandomLocation = false,
            targetUserId = null
        } = options;

        console.log('🎲 Generating test contacts...', options);

        // Get auth token
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        const token = await user.getIdToken();

        // Call the API
        const response = await fetch('/api/admin/generate-contacts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                count,
                eventPercentage,
                locationPercentage,
                forceEventLocation,
                forceRandomLocation,
                targetUserId
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ Test contacts generated:', result);
        
        return result;

    } catch (error) {
        console.error('❌ Error generating test contacts:', error);
        throw error;
    }
}

/**
 * Get information about contact generation options
 */
export async function getGenerationInfo(userId = null) {
    try {
        const params = userId ? `?userId=${userId}` : '';
        const response = await fetch(`/api/admin/generate-contacts${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();

    } catch (error) {
        console.error('❌ Error getting generation info:', error);
        throw error;
    }
}

/**
 * Predefined contact generation scenarios for testing different features
 */
export const GENERATION_SCENARIOS = {
    // Perfect for testing automatic grouping features
    autoGroupingTest: {
        name: 'Auto-Grouping Test',
        description: 'Optimized for testing automatic group generation by company, location, and events',
        params: {
            count: 75,
            eventPercentage: 0.6, // 60% from events for good event-based grouping
            locationPercentage: 0.8 // 80% have location for location-based grouping
        }
    },

    // Event-heavy scenario
    eventNetworking: {
        name: 'Event Networking',
        description: 'Simulates heavy event networking with most contacts from conferences',
        params: {
            count: 60,
            eventPercentage: 0.8, // 80% from events
            locationPercentage: 0.9 // 90% have location
        }
    },

    // Geographic spread scenario
    techHubSpread: {
        name: 'Tech Hub Spread',
        description: 'Contacts spread across different tech hubs for location testing',
        params: {
            count: 50,
            eventPercentage: 0.2, // Only 20% from events
            locationPercentage: 0.9 // 90% have location but spread out
        }
    },

    // Mixed realistic scenario
    realisticMix: {
        name: 'Realistic Mix',
        description: 'Balanced mix that simulates real-world contact collection',
        params: {
            count: 100,
            eventPercentage: 0.4, // 40% from events
            locationPercentage: 0.7 // 70% have location
        }
    },

    // All from events (for specific testing)
    allEvents: {
        name: 'All Events',
        description: 'All contacts from events (perfect for event grouping tests)',
        params: {
            count: 40,
            forceEventLocation: true, // Force all to be from events
            locationPercentage: 1.0 // All have location
        }
    },

    // All random locations
    allRandom: {
        name: 'All Random',
        description: 'All contacts from random locations (no events)',
        params: {
            count: 30,
            forceRandomLocation: true, // Force all to be random locations
            eventPercentage: 0 // No events
        }
    }
};

/**
 * Quick function to run a predefined scenario
 */
export async function runGenerationScenario(scenarioName, customOptions = {}) {
    const scenario = GENERATION_SCENARIOS[scenarioName];
    if (!scenario) {
        throw new Error(`Unknown scenario: ${scenarioName}. Available: ${Object.keys(GENERATION_SCENARIOS).join(', ')}`);
    }

    console.log(`🎯 Running scenario: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);

    const options = {
        ...scenario.params,
        ...customOptions
    };

    return await generateTestContacts(options);
}

/**
 * Helper to generate contacts for specific use cases
 */
export const QUICK_GENERATORS = {
    // Generate a small set for quick testing
    quickTest: () => generateTestContacts({ count: 20, eventPercentage: 0.5 }),
    
    // Generate contacts perfect for demonstrating the map
    mapDemo: () => generateTestContacts({ count: 30, eventPercentage: 0.6, locationPercentage: 0.9 }),
    
    // Generate contacts for business card scanning demo
    businessCardDemo: () => generateTestContacts({ 
        count: 15, 
        eventPercentage: 0.8,
        // Most will be business_card_scan source due to event percentage
    }),
    
    // Generate contacts for exchange form demo
    exchangeDemo: () => generateTestContacts({ 
        count: 25, 
        eventPercentage: 0.3, // Lower event percentage = more exchange_form
        locationPercentage: 0.8
    }),
    
    // Generate a comprehensive dataset
    fullDemo: () => generateTestContacts({ count: 150, eventPercentage: 0.5, locationPercentage: 0.75 })
};

/**
 * Helper function to clear all contacts (be careful!)
 */
export async function clearAllContacts() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();
    
    // You'd need to create an API endpoint for this, or do it manually
    console.warn('⚠️ Clear all contacts functionality needs to be implemented in API');
    throw new Error('Clear contacts API not implemented yet - do this manually in Firebase Console');
}

/**
 * Browser console helpers
 * You can run these directly in the browser console after importing this file
 */
if (typeof window !== 'undefined') {
    // Make functions available globally for console testing
    window.testContactGeneration = {
        generate: generateTestContacts,
        scenarios: GENERATION_SCENARIOS,
        runScenario: runGenerationScenario,
        quick: QUICK_GENERATORS,
        getInfo: getGenerationInfo
    };

    console.log(`
🎲 Contact Generation Utilities Loaded!

Available in window.testContactGeneration:

Quick Functions:
• testContactGeneration.quick.quickTest() - Generate 20 contacts for quick testing
• testContactGeneration.quick.mapDemo() - Generate 30 contacts perfect for map demo
• testContactGeneration.quick.fullDemo() - Generate 150 contacts for full demo

Scenarios:
• testContactGeneration.runScenario('autoGroupingTest') - Perfect for testing auto-grouping
• testContactGeneration.runScenario('eventNetworking') - Mostly event contacts
• testContactGeneration.runScenario('techHubSpread') - Spread across tech hubs

Custom Generation:
• testContactGeneration.generate({ count: 50, eventPercentage: 0.6 })

Available scenarios: ${Object.keys(GENERATION_SCENARIOS).join(', ')}
    `);
}

export default {
    generateTestContacts,
    getGenerationInfo,
    runGenerationScenario,
    GENERATION_SCENARIOS,
    QUICK_GENERATORS
};