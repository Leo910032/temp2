// app/api/user/contacts/groups/auto-generate/route.js - COST-OPTIMIZED VERSION


import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { createOptimizedPlacesApiClient } from '@/lib/services/placesApiClient';
import { serverCacheService } from '@/lib/services/serverCacheService';
import { FieldValue } from 'firebase-admin/firestore'; // NEW: Import FieldValue for server timestamps

// Import subscription utilities
// Import subscription utilities
// Import subscription utilities
import { 
  isPublicEmailDomain, 
  extractEmailDomain, 
  getCompanyIdentifierFromDomain,
  analyzeEmailDomain 
} from '@/lib/config/publicEmailDomains';
import { 
  getGroupGenerationOptions, 
  canCreateBasicGroups, 
  canCreateAdvancedGroups,
  canUseEventDetection,
  getContactUpgradeMessage,
  CONTACT_FEATURES 
} from '@/lib/services/contactSubscriptionService';

const costTracker = {
    sessionCost: 0,
    requestCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    
    addCost(amount) { this.sessionCost += amount; this.requestCount++; },
    addCacheHit() { this.cacheHits++; },
    addCacheMiss() { this.cacheMisses++; },
    
    getStats() {
        return {
            sessionCost: this.sessionCost.toFixed(4),
            requestCount: this.requestCount,
            cacheHitRate: this.cacheHits + this.cacheMisses > 0 ? Math.round(this.cacheHits / (this.cacheHits + this.cacheMisses) * 100) : 0,
        };
    },
    
    reset() { this.sessionCost = 0; this.requestCount = 0; this.cacheHits = 0; this.cacheMisses = 0; }
};


// Enhanced logging with subscription awareness
const logWithSubscription = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const emoji = level === 'INFO' ? '📊' : level === 'SUCCESS' ? '✅' : level === 'WARNING' ? '⚠️' : '❌';
  const costStats = costTracker.getStats();
  
  console.log(`${emoji} [SUBSCRIPTION-AWARE-GROUPS] ${timestamp} - ${message}`, {
    ...data,
    currentSessionCost: `$${costStats.sessionCost}`,
    requestCount: costStats.requestCount,
    cacheHitRate: `${costStats.cacheHitRate}%`
  });
};

async function getUserSubscriptionLevel(userId) {
  try {
    const userDocRef = adminDb.collection('AccountData').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      logWithSubscription('WARNING', 'User document not found, defaulting to base subscription', { userId });
      return 'base';
    }
    
    return userDoc.data().accountType || 'base';
  } catch (error) {
    logWithSubscription('ERROR', 'Error fetching user subscription', { userId, error: error.message });
    return 'base';
  }
}
// NEW: Function to save the usage log to the 'UsageLogs' collection in Firestore
async function saveUsageLogToDatabase(logData) {
    try {
        // Use the .add() method to create a new document with an auto-generated ID
        await adminDb.collection('UsageLogs').add(logData);
        logWithSubscription('SUCCESS', 'Usage log successfully saved to database.', { userId: logData.userId });
    } catch (error) {
        // Log an error if saving fails, but don't let it crash the main API response
        console.error("🔥 CRITICAL: Failed to save usage log to database:", error);
    }
}

// SUBSCRIPTION-AWARE group generation
const createSubscriptionAwareGroups = async (contacts, subscriptionLevel, requestedOptions) => {
  const startTime = Date.now();
  costTracker.reset();
  
  // Get subscription-specific options
  const subscriptionOptions = getGroupGenerationOptions(subscriptionLevel);
  
  // Merge with requested options but respect subscription limits
  const options = {
    ...subscriptionOptions,
    minGroupSize: requestedOptions.minGroupSize || 2,
    // Only allow requested features if subscription permits
    groupByCompany: subscriptionOptions.groupByCompany && (requestedOptions.groupByCompany !== false),
    groupByTime: subscriptionOptions.groupByTime && (requestedOptions.groupByTime !== false),
    groupByLocation: subscriptionOptions.groupByLocation && (requestedOptions.groupByLocation !== false),
    groupByEvents: subscriptionOptions.groupByEvents && (requestedOptions.groupByEvents !== false)
  };
  
  logWithSubscription('INFO', 'Starting SUBSCRIPTION-AWARE auto-group generation', {
    subscriptionLevel,
    totalContacts: contacts.length,
    allowedFeatures: {
      basicGroups: canCreateBasicGroups(subscriptionLevel),
      advancedGroups: canCreateAdvancedGroups(subscriptionLevel),
      eventDetection: canUseEventDetection(subscriptionLevel)
    },
    effectiveOptions: options
  });

  const stats = {
    totalContactsProcessed: contacts.length,
    companyGroups: { created: 0, totalContacts: 0, details: [] },
    locationGroups: { created: 0, totalContacts: 0, details: [] },
    eventGroups: { created: 0, totalContacts: 0, details: [], apiCalls: 0 },
    timeBasedGroups: { created: 0, totalContacts: 0, details: [] },
    subscriptionLimitations: {
      subscriptionLevel,
      basicGroupsAllowed: canCreateBasicGroups(subscriptionLevel),
      advancedGroupsAllowed: canCreateAdvancedGroups(subscriptionLevel),
      eventDetectionAllowed: canUseEventDetection(subscriptionLevel),
      featuresSkipped: []
    },
    costOptimizations: {
      cacheHitsUsed: 0,
      apiCallsSaved: 0,
      totalEstimatedCost: 0,
      budgetRemaining: true
    }
  };

  // 1. Company grouping (PRO+) - Always FREE
  if (options.groupByCompany && canCreateBasicGroups(subscriptionLevel)) {
    logWithSubscription('INFO', 'Processing company groups (PRO+ feature, FREE)');
    await generateAdvancedCompanyGroups(contacts, options, stats);
  } else if (requestedOptions.groupByCompany && !canCreateBasicGroups(subscriptionLevel)) {
    stats.subscriptionLimitations.featuresSkipped.push('company_grouping');
    logWithSubscription('WARNING', 'Company grouping skipped - requires PRO subscription', {
      userLevel: subscriptionLevel,
      requiredLevel: 'pro'
    });
  }

  // 2. Time-based grouping (PRO+) - Always FREE
  if (options.groupByTime && canCreateBasicGroups(subscriptionLevel)) {
    logWithSubscription('INFO', 'Processing time-based groups (PRO+ feature, FREE)');
    await generateTimeBasedGroups(contacts, options, stats);
  } else if (requestedOptions.groupByTime && !canCreateBasicGroups(subscriptionLevel)) {
    stats.subscriptionLimitations.featuresSkipped.push('time_grouping');
    logWithSubscription('WARNING', 'Time grouping skipped - requires PRO subscription', {
      userLevel: subscriptionLevel,
      requiredLevel: 'pro'
    });
  }

  // 3. Location grouping (PREMIUM+) - May use API
  if (options.groupByLocation && canCreateAdvancedGroups(subscriptionLevel) && 
      costTracker.requestCount < options.maxApiCalls) {
    logWithSubscription('INFO', 'Processing location groups (PREMIUM+ feature)');
    await generateLocationGroupsOptimized(contacts, options, stats);
  } else if (requestedOptions.groupByLocation && !canCreateAdvancedGroups(subscriptionLevel)) {
    stats.subscriptionLimitations.featuresSkipped.push('location_grouping');
    logWithSubscription('WARNING', 'Location grouping skipped - requires PREMIUM subscription', {
      userLevel: subscriptionLevel,
      requiredLevel: 'premium'
    });
  }

  // 4. Event detection (PREMIUM+) - Limited API usage
  if (options.groupByEvents && canUseEventDetection(subscriptionLevel) && 
      costTracker.requestCount < options.maxApiCalls) {
    logWithSubscription('INFO', 'Processing event groups (PREMIUM+ feature)');
    
    const remainingBudget = options.maxApiCalls - costTracker.requestCount;
    if (remainingBudget > 0) {
      await generateEventGroupsOptimized(contacts, options, stats, remainingBudget);
    }
  } else if (requestedOptions.groupByEvents && !canUseEventDetection(subscriptionLevel)) {
    stats.subscriptionLimitations.featuresSkipped.push('event_detection');
    logWithSubscription('WARNING', 'Event detection skipped - requires PREMIUM subscription', {
      userLevel: subscriptionLevel,
      requiredLevel: 'premium'
    });
  }

  // Update final statistics
  stats.costOptimizations = {
    ...stats.costOptimizations,
    ...costTracker.getStats(),
    totalEstimatedCost: costTracker.sessionCost
  };

  const processingTime = Date.now() - startTime;
  
  logWithSubscription('SUCCESS', 'SUBSCRIPTION-AWARE generation completed', {
    summary: {
      subscriptionLevel,
      groupsCreated: stats.companyGroups.created + stats.locationGroups.created + 
                    stats.eventGroups.created + stats.timeBasedGroups.created,
      featuresSkipped: stats.subscriptionLimitations.featuresSkipped,
      apiCallsUsed: costTracker.requestCount,
      totalCost: `$${costTracker.sessionCost.toFixed(4)}`,
      processingTimeMs: processingTime
    }
  });

  return collectAndMergeGroups(stats);
};
// COST-OPTIMIZED group generation with strict limits
const createCostOptimizedGroups = async (contacts, options) => {
    const startTime = Date.now();
    costTracker.reset(); // Start fresh for this session
    
    logWithSubscription('INFO', 'Starting COST-OPTIMIZED auto-group generation', {
        totalContacts: contacts.length,
        costControlsActive: true,
        budgetLimits: {
            maxApiCalls: options.maxApiCalls || 15,
            maxFieldLevel: options.fieldLevel || 'minimal',
            maxBatchSize: 3
        }
    });

    const stats = {
        totalContactsProcessed: contacts.length,
        companyGroups: { created: 0, totalContacts: 0, details: [] },
        locationGroups: { created: 0, totalContacts: 0, details: [] },
        eventGroups: { created: 0, totalContacts: 0, details: [], apiCalls: 0 },
        timeBasedGroups: { created: 0, totalContacts: 0, details: [] },
        costOptimizations: {
            cacheHitsUsed: 0,
            apiCallsSaved: 0,
            totalEstimatedCost: 0,
            budgetRemaining: true
        }
    };

    // 1. ALWAYS start with FREE company grouping (no API calls)
    if (options.groupByCompany) {
        logWithSubscription('INFO', 'Processing company groups (FREE - no API calls)');
        await generateAdvancedCompanyGroups(contacts, options, stats);
    }

    // 2. FREE time-based grouping (no API calls)
    if (options.groupByTime) {
        logWithSubscription('INFO', 'Processing time-based groups (FREE - no API calls)');
        await generateTimeBasedGroups(contacts, options, stats);
    }

    // 3. COST-CONTROLLED location grouping (may use API)
    if (options.groupByLocation && costTracker.requestCount < (options.maxApiCalls || 15)) {
        logWithSubscription('INFO', 'Processing location groups with cost controls');
        await generateLocationGroupsOptimized(contacts, options, stats);
    }

    // 4. COST-CONTROLLED event detection (limited API usage)
    if (options.groupByEvents && costTracker.requestCount < (options.maxApiCalls || 15)) {
        logWithSubscription('INFO', 'Processing event groups with strict cost limits');
        
        const remainingBudget = (options.maxApiCalls || 15) - costTracker.requestCount;
        if (remainingBudget > 0) {
            await generateEventGroupsOptimized(contacts, options, stats, remainingBudget);
        } else {
            logWithSubscription('WARNING', 'Skipping event detection - budget exhausted');
        }
    }

    // Update final cost statistics
    stats.costOptimizations = {
        ...stats.costOptimizations,
        ...costTracker.getStats(),
        totalEstimatedCost: costTracker.sessionCost
    };

    const processingTime = Date.now() - startTime;
    
    logWithSubscription('SUCCESS', 'COST-OPTIMIZED generation completed', {
        summary: {
            groupsCreated: stats.companyGroups.created + stats.locationGroups.created + 
                          stats.eventGroups.created + stats.timeBasedGroups.created,
            apiCallsUsed: costTracker.requestCount,
            totalCost: `$${costTracker.sessionCost.toFixed(4)}`,
            cacheEfficiency: `${costTracker.getStats().cacheHitRate}%`,
            processingTimeMs: processingTime
        }
    });

    return collectAndMergeGroups(stats);
};

/**
 * Advanced company grouping that uses both company names and email domains
 * while excluding public email providers
 */
async function generateAdvancedCompanyGroups(contacts, options, stats) {
    console.log('🔍 DEBUG: Advanced company grouping started', {
        totalContacts: contacts.length,
        minGroupSize: options.minGroupSize || 2,
        contactsWithCompany: contacts.filter(c => c.company).length,
        contactsWithEmail: contacts.filter(c => c.email).length
    });

    // Step 1: Create company groups from explicit company names
    const companyGroups = new Map();
    
    // Step 2: Create email domain groups (excluding public domains)
    const emailDomainGroups = new Map();
    
    // Step 3: Track contacts for merging logic
    const contactCompanyMapping = new Map(); // contactId -> company identifier
    
    // Process each contact
    contacts.forEach(contact => {
        console.log('🔍 DEBUG: Processing contact for advanced grouping', {
            name: contact.name,
            company: contact.company,
            email: contact.email
        });
        
        let companyIdentifiers = new Set();
        
        // Method 1: Explicit company name
        if (contact.company && contact.company.trim()) {
            const normalizedCompany = contact.company.trim().toLowerCase();
            companyIdentifiers.add(`company:${normalizedCompany}`);
            
            if (!companyGroups.has(normalizedCompany)) {
                companyGroups.set(normalizedCompany, {
                    identifier: `company:${normalizedCompany}`,
                    originalName: contact.company.trim(),
                    source: 'company_name',
                    contacts: [],
                    confidence: 0.9
                });
            }
            companyGroups.get(normalizedCompany).contacts.push(contact);
            
            console.log('🔍 DEBUG: Added to company group', {
                contact: contact.name,
                company: normalizedCompany,
                source: 'company_name'
            });
        }
        
        // Method 2: Email domain analysis
        if (contact.email) {
            const domain = extractEmailDomain(contact.email);
            if (domain) {
                const domainAnalysis = analyzeEmailDomain(domain);
                
                console.log('🔍 DEBUG: Email domain analysis', {
                    contact: contact.name,
                    email: contact.email,
                    domain: domain,
                    isCompanyDomain: domainAnalysis.isCompanyDomain,
                    confidence: domainAnalysis.confidence,
                    reason: domainAnalysis.reason
                });
                
                // Only use email domains that are likely company domains
                if (domainAnalysis.isCompanyDomain && domainAnalysis.confidence > 0.6) {
                    const companyId = getCompanyIdentifierFromDomain(domain);
                    const domainIdentifier = `domain:${companyId}`;
                    companyIdentifiers.add(domainIdentifier);
                    
                    if (!emailDomainGroups.has(companyId)) {
                        emailDomainGroups.set(companyId, {
                            identifier: domainIdentifier,
                            originalName: companyId,
                            domain: domain,
                            source: 'email_domain',
                            contacts: [],
                            confidence: domainAnalysis.confidence
                        });
                    }
                    emailDomainGroups.get(companyId).contacts.push(contact);
                    
                    console.log('🔍 DEBUG: Added to email domain group', {
                        contact: contact.name,
                        domain: domain,
                        companyId: companyId,
                        confidence: domainAnalysis.confidence
                    });
                }
            }
        }
        
        // Store all company identifiers for this contact
        contactCompanyMapping.set(contact.id, companyIdentifiers);
    });

    console.log('🔍 DEBUG: Initial grouping results', {
        companyGroups: companyGroups.size,
        emailDomainGroups: emailDomainGroups.size,
        companyGroupDetails: Array.from(companyGroups.values()).map(g => ({
            name: g.originalName,
            source: g.source,
            contacts: g.contacts.length,
            contactNames: g.contacts.map(c => c.name)
        })),
        emailDomainGroupDetails: Array.from(emailDomainGroups.values()).map(g => ({
            domain: g.domain,
            companyId: g.originalName,
            contacts: g.contacts.length,
            contactNames: g.contacts.map(c => c.name),
            confidence: g.confidence
        }))
    });

    // Step 4: Merge related groups (company name + email domain from same company)
    const mergedGroups = new Map();
    const processedGroups = new Set();
    
    // First, add all company name groups
    companyGroups.forEach((groupData, companyKey) => {
        if (groupData.contacts.length >= (options.minGroupSize || 2)) {
            const mergedKey = `merged_${companyKey}`;
            mergedGroups.set(mergedKey, {
                ...groupData,
                mergedSources: ['company_name'],
                allContacts: [...groupData.contacts]
            });
            processedGroups.add(groupData.identifier);
        }
    });
    
    // Then, add email domain groups or merge with existing company groups
    emailDomainGroups.forEach((groupData, domainKey) => {
        if (groupData.contacts.length >= (options.minGroupSize || 2)) {
            // Check if any of these contacts already belong to a company group
            let merged = false;
            
            for (const [mergedKey, mergedGroup] of mergedGroups.entries()) {
                // Check for contact overlap
                const contactOverlap = groupData.contacts.filter(contact => 
                    mergedGroup.allContacts.some(existingContact => existingContact.id === contact.id)
                );
                
                if (contactOverlap.length > 0) {
                    // Merge into existing group
                    const newContacts = groupData.contacts.filter(contact => 
                        !mergedGroup.allContacts.some(existingContact => existingContact.id === contact.id)
                    );
                    
                    mergedGroup.allContacts.push(...newContacts);
                    mergedGroup.mergedSources.push('email_domain');
                    mergedGroup.originalName = `${mergedGroup.originalName} (${groupData.domain})`;
                    merged = true;
                    
                    console.log('🔍 DEBUG: Merged email domain into company group', {
                        existingGroup: mergedKey,
                        emailDomain: groupData.domain,
                        addedContacts: newContacts.length,
                        totalContacts: mergedGroup.allContacts.length
                    });
                    break;
                }
            }
            
            // If not merged, create new group
            if (!merged) {
                const mergedKey = `merged_domain_${domainKey}`;
                mergedGroups.set(mergedKey, {
                    ...groupData,
                    mergedSources: ['email_domain'],
                    allContacts: [...groupData.contacts]
                });
                
                console.log('🔍 DEBUG: Created new email domain group', {
                    domain: groupData.domain,
                    contacts: groupData.contacts.length
                });
            }
        }
    });

    // Step 5: Create final groups
    console.log('🔍 DEBUG: Creating final merged groups', {
        mergedGroups: mergedGroups.size,
        groupDetails: Array.from(mergedGroups.values()).map(g => ({
            name: g.originalName,
            sources: g.mergedSources,
            contacts: g.allContacts.length,
            contactNames: g.allContacts.map(c => c.name)
        }))
    });

    mergedGroups.forEach((groupData, groupKey) => {
        if (groupData.allContacts.length >= (options.minGroupSize || 2)) {
            // Remove duplicates
            const uniqueContacts = Array.from(
                new Map(groupData.allContacts.map(c => [c.id, c])).values()
            );
            
            const groupDetail = {
                groupName: `${groupData.originalName} Team`,
                contactCount: uniqueContacts.length,
                contactIds: uniqueContacts.map(c => c.id),
                confidence: groupData.confidence > 0.8 ? 'high' : 'medium',
                reason: `${uniqueContacts.length} contacts from same company (${groupData.mergedSources.join(' + ')})`,
                companyName: groupData.originalName,
                sources: groupData.mergedSources,
                emailDomain: groupData.domain || null,
                cost: 0 // Free!
            };
            
            stats.companyGroups.created++;
            stats.companyGroups.totalContacts += uniqueContacts.length;
            stats.companyGroups.details.push(groupDetail);
            
            console.log('✅ DEBUG: Created advanced company group', {
                groupName: groupDetail.groupName,
                contactCount: uniqueContacts.length,
                contacts: uniqueContacts.map(c => c.name),
                sources: groupData.mergedSources,
                confidence: groupDetail.confidence
            });
            
            logWithSubscription('SUCCESS', `Created advanced company group: ${groupDetail.groupName}`, {
                contactCount: uniqueContacts.length,
                sources: groupData.mergedSources.join(' + '),
                cost: '$0.00'
            });
        }
    });

    console.log('🔍 DEBUG: Advanced company grouping completed', {
        groupsCreated: stats.companyGroups.created,
        totalContactsGrouped: stats.companyGroups.totalContacts,
        groupingSources: {
            companyNameGroups: Array.from(companyGroups.values()).filter(g => g.contacts.length >= 2).length,
            emailDomainGroups: Array.from(emailDomainGroups.values()).filter(g => g.contacts.length >= 2).length,
            mergedGroups: mergedGroups.size
        }
    });
}

// FREE time-based grouping (no API costs)
async function generateTimeBasedGroups(contacts, options, stats) {
    const dateGroups = {};
    
    contacts.forEach(contact => {
        const date = new Date(contact.submittedAt || contact.createdAt);
        const dateKey = date.toDateString();
        
        if (!dateGroups[dateKey]) {
            dateGroups[dateKey] = [];
        }
        dateGroups[dateKey].push({
            ...contact,
            timestamp: date.getTime()
        });
    });

    Object.entries(dateGroups).forEach(([dateKey, dayContacts]) => {
        if (dayContacts.length >= (options.minGroupSize || 2)) {
            dayContacts.sort((a, b) => a.timestamp - b.timestamp);
            
            // Find contacts within 3-hour windows
            const timeClusters = findTimeClustersFree(dayContacts, options.minGroupSize || 2);
            
            timeClusters.forEach((cluster, index) => {
                const groupDetail = {
                    groupName: `${new Date(cluster[0].timestamp).toLocaleDateString()} Event`,
                    contactCount: cluster.length,
                    contactIds: cluster.map(c => c.id),
                    confidence: cluster.length >= 5 ? 'high' : 'medium',
                    reason: `${cluster.length} contacts added within same time window`,
                    cost: 0 // Free!
                };
                
                stats.timeBasedGroups.created++;
                stats.timeBasedGroups.totalContacts += cluster.length;
                stats.timeBasedGroups.details.push(groupDetail);
                
                logWithSubscription('SUCCESS', `Created FREE time-based group: ${groupDetail.groupName}`, {
                    contactCount: cluster.length,
                    cost: '$0.00'
                });
            });
        }
    });
}

// COST-CONTROLLED location grouping
async function generateLocationGroupsOptimized(contacts, options, stats) {
    const contactsWithLocation = contacts.filter(c => 
        c.location?.latitude && c.location?.longitude &&
        !isNaN(c.location.latitude) && !isNaN(c.location.longitude)
    );

    if (contactsWithLocation.length < (options.minGroupSize || 2)) {
        logWithSubscription('INFO', 'Insufficient contacts with location for grouping');
        return;
    }

    // Use FREE clustering algorithm first
    const clusters = clusterContactsByProximity(contactsWithLocation, 0.005); // ~500m
    
    clusters.forEach((cluster, index) => {
        if (cluster.length >= (options.minGroupSize || 2)) {
            const centerLat = cluster.reduce((sum, c) => sum + c.location.latitude, 0) / cluster.length;
            const centerLng = cluster.reduce((sum, c) => sum + c.location.longitude, 0) / cluster.length;
            
            const groupDetail = {
                groupName: `Location Cluster ${index + 1}`,
                contactCount: cluster.length,
                contactIds: cluster.map(c => c.id),
                confidence: 'medium',
                reason: `${cluster.length} contacts in same geographic area`,
                locationData: {
                    center: { lat: centerLat, lng: centerLng },
                    radius: calculateClusterRadius(cluster)
                },
                cost: 0 // Free clustering!
            };
            
            stats.locationGroups.created++;
            stats.locationGroups.totalContacts += cluster.length;
            stats.locationGroups.details.push(groupDetail);
            
            logWithSubscription('SUCCESS', `Created FREE location group: ${groupDetail.groupName}`, {
                contactCount: cluster.length,
                cost: '$0.00'
            });
        }
    });
}

// COST-CONTROLLED event detection with strict limits
async function generateEventGroupsOptimized(contacts, options, stats, remainingBudget) {
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
        logWithSubscription('WARNING', 'No Google Maps API key - skipping event detection');
        return;
    }

    const contactsWithLocation = contacts.filter(c => 
        c.location?.latitude && c.location?.longitude &&
        !isNaN(c.location.latitude) && !isNaN(c.location.longitude)
    );

    if (contactsWithLocation.length === 0) {
        logWithSubscription('INFO', 'No contacts with location for event detection');
        return;
    }

    logWithSubscription('INFO', `Starting BUDGET-LIMITED event detection`, {
        contactsWithLocation: contactsWithLocation.length,
        remainingBudget: remainingBudget,
        maxCostBudget: `$${(remainingBudget * 0.006).toFixed(4)}`
    });

    const placesClient = createOptimizedPlacesApiClient(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
    
    // COST OPTIMIZATION: Aggressive location deduplication
    const locations = deduplicateLocationsAggressively(contactsWithLocation);
    
    // COST LIMIT: Only process top locations within budget
    const budgetedLocations = locations.slice(0, Math.min(remainingBudget, 5));
    
    logWithSubscription('INFO', `Processing ${budgetedLocations.length} priority locations (budget limited)`, {
        originalLocations: locations.length,
        budgetedLocations: budgetedLocations.length,
        estimatedMaxCost: `$${(budgetedLocations.length * 0.006).toFixed(4)}`
    });

    const events = [];
    
    for (const locationData of budgetedLocations) {
        if (costTracker.requestCount >= remainingBudget) {
            logWithSubscription('WARNING', 'Budget exhausted, stopping event detection');
            break;
        }

        try {
            // Check cache first (FREE)
            const cacheKey = `${locationData.latitude.toFixed(3)},${locationData.longitude.toFixed(3)}`;
            const cachedEvents = await serverCacheService.getLocationEvents(
                locationData.latitude,
                locationData.longitude,
                1000,
                ['convention_center', 'university', 'stadium']
            );

            if (cachedEvents) {
                costTracker.addCacheHit();
                events.push(...cachedEvents.map(event => ({
                    ...event,
                    contactsNearby: locationData.contacts,
                    contactIds: locationData.contactIds,
                    source: 'cache_hit',
                    cost: 0
                })));
                
                logWithSubscription('SUCCESS', `Cache HIT for location ${cacheKey} - $0.00 cost`, {
                    cachedEvents: cachedEvents.length
                });
                continue;
            }

            // Cache miss - make API call with cost tracking
            costTracker.addCacheMiss();
            
            logWithSubscription('INFO', `Cache MISS for ${cacheKey} - making API call`, {
                estimatedCost: '$0.006'
            });

            // COST-OPTIMIZED API call with minimal fields
            const nearbyData = await placesClient.searchNearby(
                { latitude: locationData.latitude, longitude: locationData.longitude },
                {
                    radius: 1000, // Smaller radius to reduce results
                    includedTypes: ['convention_center', 'university', 'stadium', 'event_venue'],
                    maxResults: 8, // Reduced from 20
                    fieldLevel: 'minimal' // Minimal fields to reduce cost
                }
            );

            const requestCost = 0.032; // Correct cost for one "Nearby Search Pro" request
            costTracker.addCost(requestCost);
            stats.eventGroups.apiCalls++;

            if (nearbyData.places && nearbyData.places.length > 0) {
                const locationEvents = [];
                
                nearbyData.places.forEach(place => {
                    // Simple scoring (no additional API calls)
                    const eventScore = calculateSimpleEventScore(place);
                    
                    if (eventScore > 0.3) {
                        const event = {
                            id: place.id,
                            name: place.displayName?.text || place.name,
                            location: {
                                lat: place.location.latitude,
                                lng: place.location.longitude
                            },
                            types: place.types || [],
                            contactsNearby: locationData.contacts,
                            contactIds: locationData.contactIds,
                            eventScore: eventScore,
                            confidence: eventScore > 0.7 ? 'high' : 'medium',
                            source: 'cost_optimized_api',
                            cost: requestCost
                        };
                        
                        locationEvents.push(event);
                        events.push(event);
                    }
                });

                // Cache the results for future use
                await serverCacheService.setLocationEvents(
                    locationData.latitude,
                    locationData.longitude,
                    1000,
                    ['convention_center', 'university', 'stadium', 'event_venue'],
                    locationEvents
                );

                logWithSubscription('SUCCESS', `API call successful: ${locationEvents.length} events found`, {
                    location: cacheKey,
                    cost: `${requestCost.toFixed(4)}`,
                    runningTotal: `${costTracker.sessionCost.toFixed(4)}`
                });
            } else {
                logWithSubscription('INFO', `API call returned no results`, {
                    location: cacheKey,
                    cost: `${requestCost.toFixed(4)}`
                });
            }

            // Rate limiting between API calls
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            logWithSubscription('ERROR', `Error processing location for events`, {
                location: `${locationData.latitude}, ${locationData.longitude}`,
                error: error.message
            });
            
            // Stop on quota errors to prevent further costs
            if (error.message.includes('quota')) {
                logWithSubscription('WARNING', 'API quota exceeded - stopping event detection');
                break;
            }
        }
    }

    // Create event groups from detected events
    if (events.length > 0) {
        const eventGroups = createSimpleEventGroups(events, options.minGroupSize || 2);
        
        eventGroups.forEach(group => {
            const groupDetail = {
                groupName: group.name,
                contactCount: group.contacts.length,
                contactIds: group.contactIds,
                confidence: group.confidence,
                reason: `Event detected: ${group.primaryVenue}`,
                eventData: group.eventData,
                totalCost: group.totalCost
            };
            
            stats.eventGroups.created++;
            stats.eventGroups.totalContacts += group.contacts.length;
            stats.eventGroups.details.push(groupDetail);
            
            logWithSubscription('SUCCESS', `Created cost-optimized event group: ${group.name}`, {
                contactCount: group.contacts.length,
                groupCost: `${group.totalCost.toFixed(4)}`
            });
        });
    }

    logWithSubscription('SUCCESS', 'Cost-optimized event detection completed', {
        eventsFound: events.length,
        groupsCreated: stats.eventGroups.created,
        totalApiCalls: stats.eventGroups.apiCalls,
        totalCost: `${costTracker.sessionCost.toFixed(4)}`,
        cacheHitRate: `${costTracker.getStats().cacheHitRate}%`
    });
}

// Helper functions for cost optimization

function deduplicateLocationsAggressively(contacts) {
    const locationMap = new Map();
    
    contacts.forEach(contact => {
        // More aggressive rounding for better deduplication
        const roundedLat = Math.round(contact.location.latitude * 500) / 500; // ~220m precision
        const roundedLng = Math.round(contact.location.longitude * 500) / 500;
        const locationKey = `${roundedLat},${roundedLng}`;
        
        if (!locationMap.has(locationKey)) {
            locationMap.set(locationKey, {
                latitude: roundedLat,
                longitude: roundedLng,
                contacts: [],
                contactIds: []
            });
        }
        
        const locationData = locationMap.get(locationKey);
        locationData.contacts.push(contact);
        locationData.contactIds.push(contact.id);
    });
    
    // Sort by contact count (prioritize locations with more contacts)
    return Array.from(locationMap.values())
        .sort((a, b) => b.contacts.length - a.contacts.length);
}

function calculateSimpleEventScore(place) {
    let score = 0;
    
    // Type-based scoring
    const eventTypes = ['convention_center', 'event_venue', 'concert_hall', 'university', 'stadium'];
    if (place.types && place.types.some(type => eventTypes.includes(type))) {
        score += 0.6;
    }
    
    // Name-based scoring
    const name = (place.displayName?.text || '').toLowerCase();
    const eventKeywords = ['convention', 'conference', 'center', 'hall', 'arena'];
    if (eventKeywords.some(keyword => name.includes(keyword))) {
        score += 0.4;
    }
    
    return Math.min(score, 1.0);
}

function createSimpleEventGroups(events, minGroupSize) {
    const groups = [];
    const processed = new Set();
    
    events.forEach(event => {
        if (processed.has(event.id)) return;
        
        // Find nearby events (simple distance-based grouping)
        const nearbyEvents = events.filter(other => {
            if (processed.has(other.id) || other.id === event.id) return false;
            
            const distance = calculateHaversineDistance(
                event.location.lat, event.location.lng,
                other.location.lat, other.location.lng
            );
            
            return distance <= 0.5; // 500m radius
        });
        
        const groupEvents = [event, ...nearbyEvents];
        const allContacts = groupEvents.flatMap(e => e.contactsNearby || []);
        const allContactIds = [...new Set(groupEvents.flatMap(e => e.contactIds || []))];
        
        if (allContactIds.length >= minGroupSize) {
            const totalCost = groupEvents.reduce((sum, e) => sum + (e.cost || 0), 0);
            
            groups.push({
                name: `${event.name} Event`,
                contacts: allContacts,
                contactIds: allContactIds,
                confidence: groupEvents.length > 1 ? 'high' : 'medium',
                primaryVenue: event.name,
                eventData: {
                    primaryVenue: event.name,
                    venueCount: groupEvents.length,
                    events: groupEvents
                },
                totalCost: totalCost
            });
            
            // Mark all events in this group as processed
            groupEvents.forEach(e => processed.add(e.id));
        }
    });
    
    return groups;
}

function findTimeClustersFree(dayContacts, minGroupSize) {
    const clusters = [];
    let currentCluster = [dayContacts[0]];
    
    for (let i = 1; i < dayContacts.length; i++) {
        const timeDiff = (dayContacts[i].timestamp - dayContacts[i-1].timestamp) / (1000 * 60 * 60);
        
        if (timeDiff <= 3) { // 3 hour window
            currentCluster.push(dayContacts[i]);
        } else {
            if (currentCluster.length >= minGroupSize) {
                clusters.push(currentCluster);
            }
            currentCluster = [dayContacts[i]];
        }
    }
    
    if (currentCluster.length >= minGroupSize) {
        clusters.push(currentCluster);
    }
    
    return clusters;
}

function clusterContactsByProximity(contacts, threshold) {
    const clusters = [];
    const used = new Set();

    contacts.forEach(contact => {
        if (used.has(contact.id)) return;

        const cluster = [contact];
        used.add(contact.id);

        contacts.forEach(otherContact => {
            if (used.has(otherContact.id)) return;

            const distance = calculateHaversineDistance(
                contact.location.latitude,
                contact.location.longitude,
                otherContact.location.latitude,
                otherContact.location.longitude
            );

            if (distance <= threshold) {
                cluster.push(otherContact);
                used.add(otherContact.id);
            }
        });

        if (cluster.length >= 2) {
            clusters.push(cluster);
        }
    });

    return clusters;
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateClusterRadius(cluster) {
    if (cluster.length < 2) return 0;
    
    const centerLat = cluster.reduce((sum, c) => sum + c.location.latitude, 0) / cluster.length;
    const centerLng = cluster.reduce((sum, c) => sum + c.location.longitude, 0) / cluster.length;
    
    let maxDistance = 0;
    cluster.forEach(contact => {
        const distance = calculateHaversineDistance(
            centerLat, centerLng,
            contact.location.latitude, contact.location.longitude
        ) * 1000; // Convert to meters
        maxDistance = Math.max(maxDistance, distance);
    });
    
    return maxDistance;
}

function collectAndMergeGroups(stats) {
    const allGroups = [];
    
    // Add all group types to final collection
    stats.companyGroups.details.forEach(detail => {
        allGroups.push({
            name: detail.groupName,
            type: 'company',
            contactIds: detail.contactIds,
            confidence: detail.confidence,
            reason: detail.reason,
            companyName: detail.companyName,
            autoGenerated: true,
            costOptimized: true,
            generationCost: detail.cost || 0,
            eventData: null
        });
    });

    stats.eventGroups.details.forEach(detail => {
        allGroups.push({
            name: detail.groupName,
            type: 'event',
            contactIds: detail.contactIds,
            confidence: detail.confidence,
            reason: detail.reason,
            eventData: detail.eventData,
            autoGenerated: true,
            costOptimized: true,
            generationCost: detail.totalCost || 0
        });
    });

    stats.locationGroups.details.forEach(detail => {
        allGroups.push({
            name: detail.groupName,
            type: 'location',
            contactIds: detail.contactIds,
            confidence: detail.confidence,
            reason: detail.reason,
            locationData: detail.locationData,
            autoGenerated: true,
            costOptimized: true,
            generationCost: detail.cost || 0,
            eventData: null
        });
    });

    stats.timeBasedGroups.details.forEach(detail => {
        allGroups.push({
            name: detail.groupName,
            type: 'temporal',
            contactIds: detail.contactIds,
            confidence: detail.confidence,
            reason: detail.reason,
            autoGenerated: true,
            costOptimized: true,
            generationCost: detail.cost || 0,
            eventData: null
        });
    });

    // Simple deduplication (avoid complex merging to save costs)
    const uniqueGroups = [];
    const seenContactSets = [];
    
    allGroups.forEach(group => {
        const contactSet = new Set(group.contactIds);
        const hasSignificantOverlap = seenContactSets.some(existingSet => {
            const intersection = new Set([...contactSet].filter(id => existingSet.has(id)));
            return intersection.size / Math.min(contactSet.size, existingSet.size) > 0.8;
        });
        
        if (!hasSignificantOverlap) {
            uniqueGroups.push(group);
            seenContactSets.push(contactSet);
        }
    });

    return uniqueGroups;
}

// Main POST handler - now with database logging
export async function POST(request) {
  const startTime = Date.now();
  let userId = null; 
  let subscriptionLevel = 'base'; // Default value

  try {
    logWithSubscription('INFO', 'SUBSCRIPTION-AWARE auto-group generation started');

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    userId = decodedToken.uid;

    subscriptionLevel = await getUserSubscriptionLevel(userId);
    
    if (!canCreateBasicGroups(subscriptionLevel)) {
      return NextResponse.json({
        success: false,
        error: 'Contact features require a Pro subscription or higher',
        subscriptionRequired: true,
        currentPlan: subscriptionLevel,
        requiredPlan: 'pro',
        upgradeMessage: getContactUpgradeMessage(CONTACT_FEATURES.BASIC_GROUPS),
      }, { status: 403 });
    }

    const body = await request.json();
    const requestedOptions = body.options || {};
    
    const contactsRef = adminDb.collection('Contacts').doc(userId);
    const contactsDoc = await contactsRef.get();
    if (!contactsDoc.exists) {
      return NextResponse.json({ success: true, groupsCreated: 0, message: 'No contacts to group.' });
    }
    
    const allContacts = contactsDoc.data().contacts || [];
    const newGroups = await createSubscriptionAwareGroups(allContacts, subscriptionLevel, requestedOptions);
    
    let uniqueNewGroups = [];
    if (newGroups.length > 0) {
        const groupsRef = adminDb.collection('ContactGroups').doc(userId);
        const groupsDoc = await groupsRef.get();
        const existingGroups = groupsDoc.exists ? groupsDoc.data().groups || [] : [];
        const existingGroupNames = new Set(existingGroups.map(g => g.name.toLowerCase()));
        
        uniqueNewGroups = newGroups
            .filter(g => !existingGroupNames.has(g.name.toLowerCase()))
            .map(group => ({
                ...group,
                id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                description: group.reason || `Auto-generated group with ${group.contactIds.length} contacts`,
                generatedAt: new Date().toISOString(),
                subscriptionLevel: subscriptionLevel,
            }));

        if (uniqueNewGroups.length > 0) {
            const updatedGroups = [...existingGroups, ...uniqueNewGroups];
            await groupsRef.set({
                groups: updatedGroups,
                lastUpdated: FieldValue.serverTimestamp(),
                totalGroups: updatedGroups.length,
            }, { merge: true });
        }
    }
    
    const processingTimeMs = Date.now() - startTime;
    const finalCostStats = costTracker.getStats();

    // NEW: Log successful run to the database
    const successLogData = {
        userId: userId,
        feature: "autoGroupGeneration",
        status: "success",
        timestamp: FieldValue.serverTimestamp(),
        cost: parseFloat(finalCostStats.sessionCost),
        apiCalls: finalCostStats.requestCount,
        processingTimeMs: processingTimeMs,
        avgTimePerCallMs: finalCostStats.requestCount > 0 ? (processingTimeMs / finalCostStats.requestCount) : processingTimeMs,
        cacheHitRate: finalCostStats.cacheHitRate,
        subscriptionAtTimeOfRun: subscriptionLevel,
        details: {
            groupsCreated: uniqueNewGroups.length,
            contactsProcessed: allContacts.length
        }
    };
    await saveUsageLogToDatabase(successLogData);

    return NextResponse.json({
      success: true,
      groupsCreated: uniqueNewGroups.length,
      newGroups: uniqueNewGroups,
    });

  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const finalCostStats = costTracker.getStats();

    logWithSubscription('ERROR', 'Error in auto-group generation', {
      error: error.message,
      costIncurred: `$${finalCostStats.sessionCost}`,
    });

    // NEW: Log failed run to the database
    if (userId) { // Only log if we were able to identify the user
        const errorLogData = {
            userId: userId,
            feature: "autoGroupGeneration",
            status: "error",
            timestamp: FieldValue.serverTimestamp(),
            cost: parseFloat(finalCostStats.sessionCost),
            apiCalls: finalCostStats.requestCount,
            processingTimeMs: processingTimeMs,
            subscriptionAtTimeOfRun: subscriptionLevel,
            errorDetails: {
                message: error.message,
                stack: error.stack, // Optional: for detailed debugging
            }
        };
        await saveUsageLogToDatabase(errorLogData);
    }
    
    return NextResponse.json({ 
      error: 'Failed to auto-generate groups',
      details: error.message
    }, { status: 500 });
  }
}



// GET endpoint for subscription-aware documentation
export async function GET(request) {
  return NextResponse.json({
    message: 'Subscription-Aware Auto-Group Generation API',
    version: '1.0_subscription_aware',
    subscriptionTiers: {
      base: {
        contactAccess: false,
        features: [],
        groupingMethods: [],
        apiCallsAllowed: 0,
        costBudget: '$0.00'
      },
      pro: {
        contactAccess: true,
        features: ['basic_contacts', 'basic_groups', 'business_card_scanner', 'map_visualization'],
        groupingMethods: ['company', 'time'],
        apiCallsAllowed: 0,
        costBudget: '$0.00',
        description: 'Free grouping methods only'
      },
      premium: {
        contactAccess: true,
        features: ['basic_contacts', 'basic_groups', 'advanced_groups', 'event_detection', 'team_sharing'],
        groupingMethods: ['company', 'time', 'location', 'events'],
        apiCallsAllowed: 15,
        costBudget: '$0.15',
        description: 'All grouping methods with cost controls'
      },
      business: {
        contactAccess: true,
        features: ['all_contact_features'],
        groupingMethods: ['company', 'time', 'location', 'events'],
        apiCallsAllowed: 20,
        costBudget: '$0.20',
        description: 'All features with higher limits'
      }
    },
    featureMatrix: {
      company_grouping: 'pro+',
      time_based_grouping: 'pro+',
      location_grouping: 'premium+',
      event_detection: 'premium+',
      team_sharing: 'premium+',
      business_card_scanner: 'pro+',
      map_visualization: 'pro+'
    },
    upgradeMessages: {
      base_to_pro: 'Upgrade to Pro to access contact management and basic grouping features.',
      pro_to_premium: 'Upgrade to Premium to unlock location-based grouping and event detection.',
      premium_to_business: 'Upgrade to Business for higher API limits and priority support.'
    }
  });
}