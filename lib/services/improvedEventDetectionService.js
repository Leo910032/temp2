// lib/services/improvedEventDetectionService.js - Fixed clustering to prevent false positives

import { IMPROVED_EVENT_DETECTION_CONFIG, getOptimalRadiusWithValidation, validateClusterCoherence, shouldClusterTogether, detectCompanyFromLocation } from '@/lib/config/improvedEventDetectionConfig';

export class ImprovedEventDetectionService {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
        
        console.log('🔧 ImprovedEventDetectionService initialized with tighter clustering thresholds');
    }

    // Enhanced clustering with strict distance validation
    clusterEventsByProximity(events, contacts, timeWindow = 7) {
        console.log('🎯 Starting IMPROVED event clustering with strict validation', {
            events: events.length,
            contacts: contacts.length,
            maxTimeWindow: timeWindow
        });

        const clusters = [];
        const used = new Set();
        
        events.forEach(event => {
            if (used.has(event.id)) return;
            
            // Detect company context for this event
            const companyContext = this.detectEventCompanyContext(event, contacts);
            
            // Determine appropriate clustering radius based on context
            const clusterRadius = this.getContextualClusterRadius(event, companyContext);
            
            console.log(`🔍 Processing event: ${event.name}`, {
                eventId: event.id,
                companyContext: companyContext?.company || 'none',
                clusterRadius: clusterRadius,
                contactsNearby: event.contactsNearby?.length || 0
            });
            
            const cluster = {
                id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                primaryEvent: event,
                events: [event],
                contacts: [...(event.contactsNearby || [])],
                centerPoint: {
                    lat: event.location.lat,
                    lng: event.location.lng
                },
                radius: clusterRadius,
                confidence: event.confidence || 'medium',
                companyContext: companyContext,
                validationResults: {
                    coherent: true,
                    maxInternalDistance: 0,
                    averageDistance: 0
                }
            };
            
            used.add(event.id);
            
            // Find nearby events with STRICT validation
            events.forEach(otherEvent => {
                if (used.has(otherEvent.id) || otherEvent.id === event.id) return;
                
                const distance = this.calculateDistance(
                    event.location.lat, event.location.lng,
                    otherEvent.location.lat, otherEvent.location.lng
                );
                
                console.log(`📏 Distance check: ${event.name} ↔ ${otherEvent.name}`, {
                    distance: Math.round(distance),
                    maxAllowed: clusterRadius,
                    willCluster: distance <= clusterRadius
                });
                
                // Apply STRICT distance validation
                if (distance <= clusterRadius) {
                    // Additional similarity and context checks
                    const similarity = this.calculateEventSimilarity(event, otherEvent);
                    const contextMatch = this.validateEventContext(event, otherEvent, companyContext);
                    
                    console.log(`🧪 Similarity analysis: ${event.name} ↔ ${otherEvent.name}`, {
                        similarity: Math.round(similarity * 100) / 100,
                        contextMatch: contextMatch,
                        minSimilarity: IMPROVED_EVENT_DETECTION_CONFIG.CLUSTERING_CONFIG.MIN_EVENT_SIMILARITY
                    });
                    
                    if (similarity > IMPROVED_EVENT_DETECTION_CONFIG.CLUSTERING_CONFIG.MIN_EVENT_SIMILARITY && contextMatch) {
                        cluster.events.push(otherEvent);
                        cluster.contacts.push(...(otherEvent.contactsNearby || []));
                        used.add(otherEvent.id);
                        
                        console.log(`✅ Events clustered: ${event.name} + ${otherEvent.name}`, {
                            distance: Math.round(distance),
                            similarity: Math.round(similarity * 100) / 100,
                            newClusterSize: cluster.events.length
                        });
                    } else {
                        console.log(`❌ Events NOT clustered: ${event.name} + ${otherEvent.name}`, {
                            distance: Math.round(distance),
                            similarity: Math.round(similarity * 100) / 100,
                            contextMatch: contextMatch,
                            reason: similarity <= IMPROVED_EVENT_DETECTION_CONFIG.CLUSTERING_CONFIG.MIN_EVENT_SIMILARITY ? 'low_similarity' : 'context_mismatch'
                        });
                    }
                }
            });
            
            // Remove duplicate contacts
            cluster.contacts = cluster.contacts.filter((contact, index, array) => 
                array.findIndex(c => c.id === contact.id) === index
            );
            
            // Recalculate cluster center with all events
            if (cluster.events.length > 1) {
                cluster.centerPoint = this.calculateClusterCenter(cluster.events);
            }
            
            // CRITICAL: Validate cluster coherence
            const coherenceValidation = this.validateClusterCoherence(cluster);
            cluster.validationResults = coherenceValidation;
            
            if (!coherenceValidation.coherent) {
                console.warn(`🚨 Cluster failed coherence validation: ${cluster.primaryEvent.name}`, coherenceValidation);
                
                // Split the cluster or reject it
                const validSubClusters = this.splitIncoherentCluster(cluster);
                clusters.push(...validSubClusters);
            } else {
                // Update confidence based on validation
                cluster.confidence = this.calculateClusterConfidence(cluster.events, coherenceValidation);
                
                // Only create cluster if it meets minimum requirements AND is coherent
                if (cluster.contacts.length >= 2 || cluster.confidence === 'high') {
                    clusters.push(cluster);
                    
                    console.log(`✅ Valid cluster created: ${cluster.primaryEvent.name}`, {
                        events: cluster.events.length,
                        contacts: cluster.contacts.length,
                        radius: cluster.radius,
                        confidence: cluster.confidence,
                        maxInternalDistance: Math.round(coherenceValidation.maxInternalDistance),
                        coherent: coherenceValidation.coherent
                    });
                } else {
                    console.log(`❌ Cluster rejected: insufficient contacts or low confidence`, {
                        events: cluster.events.length,
                        contacts: cluster.contacts.length,
                        confidence: cluster.confidence
                    });
                }
            }
        });
        
        console.log(`🎯 IMPROVED clustering completed: ${clusters.length} valid clusters created`);
        return clusters;
    }

    // Detect company context for better clustering decisions
    detectEventCompanyContext(event, contacts) {
        // Check if event is at a known company location
        const locationContext = detectCompanyFromLocation(event.location.lat, event.location.lng);
        if (locationContext) {
            return locationContext;
        }
        
        // Check contacts' companies
        const companies = event.contactsNearby?.map(c => c.company).filter(Boolean) || [];
        if (companies.length > 0) {
            const companyCount = {};
            companies.forEach(company => {
                companyCount[company] = (companyCount[company] || 0) + 1;
            });
            
            // Find most common company
            const dominantCompany = Object.entries(companyCount)
                .sort((a, b) => b[1] - a[1])[0];
            
            if (dominantCompany && dominantCompany[1] >= 2) {
                return {
                    company: dominantCompany[0].toLowerCase(),
                    confidence: dominantCompany[1] >= companies.length * 0.7 ? 'high' : 'medium',
                    source: 'contact_analysis'
                };
            }
        }
        
        return null;
    }

    // Get contextual cluster radius based on event and company context
    getContextualClusterRadius(event, companyContext) {
        // Corporate events should have very tight clustering
        if (companyContext) {
            const pattern = IMPROVED_EVENT_DETECTION_CONFIG.COMPANY_PATTERNS[companyContext.company];
            if (pattern && pattern.tightClustering) {
                console.log(`🏢 Using tight corporate clustering for ${companyContext.company}: ${pattern.maxRadius}m`);
                return pattern.maxRadius || 200;
            }
            
            // Default corporate clustering
            return IMPROVED_EVENT_DETECTION_CONFIG.CLUSTERING_CONFIG.CORPORATE_CAMPUS_MODE.maxDistanceMeters;
        }
        
        // Use event type and location to determine radius
        const eventTypes = event.types || ['default'];
        const cityName = this.getCityFromAddress(event.vicinity);
        
        return getOptimalRadiusWithValidation(eventTypes, cityName, companyContext?.company);
    }

    // Enhanced event context validation
    validateEventContext(event1, event2, companyContext) {
        // Company context validation
        if (companyContext) {
            // Both events should be related to the same company
            const event1Companies = event1.contactsNearby?.map(c => c.company).filter(Boolean) || [];
            const event2Companies = event2.contactsNearby?.map(c => c.company).filter(Boolean) || [];
            
            const hasCommonCompany = event1Companies.some(company1 => 
                event2Companies.some(company2 => 
                    company1.toLowerCase() === company2.toLowerCase()
                )
            );
            
            if (!hasCommonCompany) {
                console.log(`❌ No common company found between events`, {
                    event1Companies: event1Companies,
                    event2Companies: event2Companies
                });
                return false;
            }
        }
        
        // Venue type compatibility
        const venue1Types = event1.types || [];
        const venue2Types = event2.types || [];
        
        // Check compatibility matrix
        for (const type1 of venue1Types) {
            const compatibilityRule = IMPROVED_EVENT_DETECTION_CONFIG.VENUE_COMPATIBILITY_MATRIX[type1];
            if (compatibilityRule) {
                const hasIncompatibleType = venue2Types.some(type2 => 
                    compatibilityRule.incompatible?.includes(type2)
                );
                
                if (hasIncompatibleType) {
                    console.log(`❌ Incompatible venue types: ${type1} vs ${venue2Types.join(', ')}`);
                    return false;
                }
            }
        }
        
        return true;
    }

    // Validate cluster coherence with detailed metrics
    validateClusterCoherence(cluster) {
        if (cluster.events.length < 2) {
            return {
                coherent: true,
                maxInternalDistance: 0,
                averageDistance: 0,
                reason: 'single_event'
            };
        }
        
        let maxDistance = 0;
        let totalDistance = 0;
        let distanceCount = 0;
        const maxAllowedDistance = IMPROVED_EVENT_DETECTION_CONFIG.CLUSTERING_CONFIG.maxIntraClusterDistance;
        
        // Check all pairwise distances between events
        for (let i = 0; i < cluster.events.length; i++) {
            for (let j = i + 1; j < cluster.events.length; j++) {
                const event1 = cluster.events[i];
                const event2 = cluster.events[j];
                
                const distance = this.calculateDistance(
                    event1.location.lat, event1.location.lng,
                    event2.location.lat, event2.location.lng
                );
                
                maxDistance = Math.max(maxDistance, distance);
                totalDistance += distance;
                distanceCount++;
            }
        }
        
        const averageDistance = distanceCount > 0 ? totalDistance / distanceCount : 0;
        const coherent = maxDistance <= maxAllowedDistance;
        
        return {
            coherent: coherent,
            maxInternalDistance: maxDistance,
            averageDistance: averageDistance,
            maxAllowedDistance: maxAllowedDistance,
            reason: coherent ? 'valid' : 'distances_too_large'
        };
    }

    // Split incoherent clusters into smaller, valid ones
    splitIncoherentCluster(cluster) {
        console.log(`🔄 Splitting incoherent cluster: ${cluster.primaryEvent.name}`);
        
        const validClusters = [];
        const events = cluster.events;
        const used = new Set();
        
        events.forEach(event => {
            if (used.has(event.id)) return;
            
            const subCluster = {
                ...cluster,
                id: `split_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                primaryEvent: event,
                events: [event],
                contacts: [...(event.contactsNearby || [])]
            };
            
            used.add(event.id);
            
            // Find nearby events within tight constraints
            events.forEach(otherEvent => {
                if (used.has(otherEvent.id)) return;
                
                const distance = this.calculateDistance(
                    event.location.lat, event.location.lng,
                    otherEvent.location.lat, otherEvent.location.lng
                );
                
                // Use very tight clustering for splits
                const maxSplitDistance = Math.min(cluster.radius * 0.5, 200);
                
                if (distance <= maxSplitDistance) {
                    subCluster.events.push(otherEvent);
                    subCluster.contacts.push(...(otherEvent.contactsNearby || []));
                    used.add(otherEvent.id);
                }
            });
            
            // Remove duplicate contacts
            subCluster.contacts = subCluster.contacts.filter((contact, index, array) => 
                array.findIndex(c => c.id === contact.id) === index
            );
            
            // Only keep if it has enough contacts
            if (subCluster.contacts.length >= 2) {
                validClusters.push(subCluster);
                console.log(`✅ Created valid sub-cluster from split`, {
                    events: subCluster.events.length,
                    contacts: subCluster.contacts.length,
                    primaryEvent: event.name
                });
            }
        });
        
        return validClusters;
    }

    // Enhanced similarity calculation with stricter thresholds
    calculateEventSimilarity(event1, event2) {
        let similarity = 0;
        
        // Type similarity (50% weight - increased importance)
        const commonTypes = event1.types.filter(type => event2.types.includes(type));
        const typesSimilarity = commonTypes.length / Math.max(event1.types.length, event2.types.length);
        similarity += typesSimilarity * 0.5;
        
        // Name similarity (30% weight)
        const nameSimilarity = this.calculateStringSimilarity(event1.name, event2.name);
        similarity += nameSimilarity * 0.3;
        
        // Business status similarity (10% weight)
        if (event1.businessStatus === event2.businessStatus) {
            similarity += 0.1;
        }
        
        // Rating similarity (10% weight)
        if (event1.rating && event2.rating) {
            const ratingDiff = Math.abs(event1.rating - event2.rating) / 5;
            const ratingSimilarity = 1 - ratingDiff;
            similarity += ratingSimilarity * 0.1;
        }
        
        return similarity;
    }

    // Calculate string similarity using Levenshtein distance
    calculateStringSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    // Levenshtein distance implementation
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Calculate the geometric center of a cluster of events
    calculateClusterCenter(events) {
        const avgLat = events.reduce((sum, event) => sum + event.location.lat, 0) / events.length;
        const avgLng = events.reduce((sum, event) => sum + event.location.lng, 0) / events.length;
        return { lat: avgLat, lng: avgLng };
    }

    // Enhanced cluster confidence calculation
    calculateClusterConfidence(events, validationResults) {
        let totalScore = 0;
        let highConfidenceCount = 0;
        
        events.forEach(event => {
            if (event.confidence === 'high') highConfidenceCount++;
            
            let eventScore = 0;
            if (event.rating) eventScore += event.rating / 5 * 0.4;
            if (event.userRatingCount) eventScore += Math.min(event.userRatingCount / 100, 1) * 0.3;
            if (event.businessStatus === 'OPERATIONAL') eventScore += 0.3;
            
            totalScore += eventScore;
        });
        
        const avgScore = totalScore / events.length;
        const highConfidenceRatio = highConfidenceCount / events.length;
        
        // Factor in coherence validation
        let coherenceBonus = 0;
        if (validationResults.coherent) {
            // Bonus for tight clustering
            if (validationResults.maxInternalDistance < 200) coherenceBonus = 0.2;
            else if (validationResults.maxInternalDistance < 400) coherenceBonus = 0.1;
        }
        
        const finalScore = avgScore + coherenceBonus;
        
        if (finalScore > 0.8 && highConfidenceRatio > 0.6) return 'high';
        if (finalScore > 0.6 && highConfidenceRatio > 0.4) return 'medium';
        return 'low';
    }

    // Extract city name from address
    getCityFromAddress(address) {
        if (!address) return null;
        
        const parts = address.split(',');
        if (parts.length >= 2) {
            return parts[parts.length - 2].trim();
        }
        return null;
    }

    // Enhanced distance calculation
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distance in meters
    }

    // Enhanced group suggestions with strict validation
    generateEventGroupSuggestions(clusters, existingGroups = []) {
        console.log('🎯 Generating IMPROVED group suggestions with strict validation');
        
        const suggestions = [];
        
        clusters.forEach(cluster => {
            if (cluster.contacts.length < 2) {
                console.log(`❌ Skipping cluster - insufficient contacts: ${cluster.contacts.length}`);
                return;
            }
            
            // Validate cluster coherence one more time
            if (!cluster.validationResults.coherent) {
                console.log(`❌ Skipping incoherent cluster: max distance ${Math.round(cluster.validationResults.maxInternalDistance)}m`);
                return;
            }
            
            // Check if group already exists
            const existingGroup = existingGroups.find(group => 
                group.type === 'event' && 
                this.arraysEqual(
                    group.contactIds.sort(), 
                    cluster.contacts.map(c => c.id).sort()
                )
            );
            
            if (existingGroup) {
                console.log(`❌ Skipping duplicate group: ${existingGroup.name}`);
                return;
            }
            
            // Enhanced group naming with company context
            const eventName = this.inferEventName(cluster);
            const eventDate = this.inferEventTimeframe(cluster);
            
            const suggestion = {
                id: cluster.id,
                type: 'event',
                subType: this.categorizeEventType(cluster),
                name: eventName,
                description: `${cluster.contacts.length} contacts from ${eventName}${eventDate ? ` (${eventDate})` : ''}`,
                contactIds: cluster.contacts.map(c => c.id),
                contacts: cluster.contacts,
                confidence: cluster.confidence,
                reason: `Contacts found near ${cluster.primaryEvent.name}`,
                eventData: {
                    primaryVenue: cluster.primaryEvent.name,
                    location: cluster.centerPoint,
                    venues: cluster.events.map(e => e.name),
                    estimatedAttendees: cluster.contacts.length,
                    radius: cluster.radius,
                    types: [...new Set(cluster.events.flatMap(e => e.types))],
                    companyContext: cluster.companyContext,
                    validationResults: cluster.validationResults
                },
                autoGenerated: true,
                priority: this.calculateGroupPriority(cluster),
                qualityMetrics: {
                    coherent: cluster.validationResults.coherent,
                    maxInternalDistance: Math.round(cluster.validationResults.maxInternalDistance),
                    averageDistance: Math.round(cluster.validationResults.averageDistance),
                    clusterTightness: this.calculateClusterTightness(cluster)
                }
            };
            
            suggestions.push(suggestion);
            
            console.log(`✅ Created IMPROVED group suggestion: ${eventName}`, {
                contacts: cluster.contacts.length,
                events: cluster.events.length,
                confidence: cluster.confidence,
                maxDistance: Math.round(cluster.validationResults.maxInternalDistance),
                companyContext: cluster.companyContext?.company || 'none'
            });
        });
        
        // Sort by priority and quality
        const sortedSuggestions = suggestions.sort((a, b) => {
            // Prioritize coherent, tight clusters
            if (a.qualityMetrics.coherent && !b.qualityMetrics.coherent) return -1;
            if (!a.qualityMetrics.coherent && b.qualityMetrics.coherent) return 1;
            
            // Then by tightness (smaller distances = better)
            const tightnessDiff = a.qualityMetrics.clusterTightness - b.qualityMetrics.clusterTightness;
            if (Math.abs(tightnessDiff) > 0.1) return tightnessDiff; // Tighter clusters first
            
            // Finally by priority
            return b.priority - a.priority;
        });
        
        console.log(`🎯 IMPROVED group suggestions generated: ${sortedSuggestions.length} total`);
        return sortedSuggestions;
    }

    // Calculate cluster tightness (lower is better)
    calculateClusterTightness(cluster) {
        if (cluster.events.length < 2) return 0;
        
        const maxDistance = cluster.validationResults.maxInternalDistance;
        const averageDistance = cluster.validationResults.averageDistance;
        
        // Normalize tightness score (0 = very tight, 1 = very loose)
        const maxAllowed = IMPROVED_EVENT_DETECTION_CONFIG.CLUSTERING_CONFIG.maxIntraClusterDistance;
        const tightness = (maxDistance + averageDistance) / (2 * maxAllowed);
        
        return Math.min(tightness, 1.0);
    }

    // Enhanced event name inference with company context
    inferEventName(cluster) {
        const primaryEvent = cluster.primaryEvent;
        const cityName = this.getCityFromAddress(primaryEvent.vicinity);
        
        // Use company context if available
        if (cluster.companyContext) {
            const companyName = cluster.companyContext.company.charAt(0).toUpperCase() + 
                              cluster.companyContext.company.slice(1);
            
            if (cluster.companyContext.campus) {
                return `${companyName} - ${cluster.companyContext.campus}`;
            }
            return `${companyName} Event`;
        }
        
        // Look for conference/convention patterns
        const conventionKeywords = ['convention', 'conference', 'expo', 'summit', 'congress'];
        const hasConventionKeyword = conventionKeywords.some(keyword => 
            primaryEvent.name.toLowerCase().includes(keyword)
        );
        
        if (hasConventionKeyword) {
            return primaryEvent.name;
        }
        
        // Check for well-known event locations
        const knownVenues = {
            'las vegas convention center': 'CES',
            'mandalay bay': 'NAB Show / Tech Events',
            'moscone center': 'Tech Conferences',
            'jacob javits center': 'NYC Conferences',
            'orange county convention center': 'Orlando Events'
        };
        
        const venueKey = primaryEvent.name.toLowerCase();
        const knownEvent = Object.keys(knownVenues).find(key => 
            venueKey.includes(key.toLowerCase())
        );
        
        if (knownEvent) {
            return knownVenues[knownEvent] + (cityName ? ` in ${cityName}` : '');
        }
        
        // Default naming
        if (cityName) {
            return `${cityName} Event`;
        }
        
        return `${primaryEvent.name} Event`;
    }

    // Infer event timeframe
    inferEventTimeframe(cluster) {
        const now = new Date();
        const month = now.toLocaleString('default', { month: 'short' });
        const day = now.getDate();
        const year = now.getFullYear();
        
        return `${month} ${day}, ${year}`;
    }

    // Categorize event type for better organization
    categorizeEventType(cluster) {
        const types = cluster.events.flatMap(e => e.types);
        
        // Corporate events
        if (cluster.companyContext) {
            return 'business';
        }
        
        if (types.some(t => ['convention_center', 'expo_center'].includes(t))) {
            return 'conference';
        }
        if (types.some(t => ['stadium', 'arena'].includes(t))) {
            return 'sports';
        }
        if (types.some(t => ['concert_hall', 'performing_arts_theater'].includes(t))) {
            return 'entertainment';
        }
        if (types.some(t => ['university', 'school'].includes(t))) {
            return 'education';
        }
        if (types.some(t => ['museum', 'art_gallery'].includes(t))) {
            return 'cultural';
        }
        
        return 'business';
    }

    // Enhanced priority calculation with tightness factor
    calculateGroupPriority(cluster) {
        let priority = 0;
        
        // More contacts = higher priority
        priority += Math.min(cluster.contacts.length * 10, 50);
        
        // Confidence boost
        if (cluster.confidence === 'high') priority += 30;
        else if (cluster.confidence === 'medium') priority += 15;
        
        // Company context boost
        if (cluster.companyContext) {
            priority += cluster.companyContext.confidence === 'high' ? 20 : 10;
        }
        
        // Coherence boost (tight clusters get priority)
        if (cluster.validationResults.coherent) {
            priority += 20;
            
            // Extra boost for very tight clusters
            if (cluster.validationResults.maxInternalDistance < 200) {
                priority += 15;
            } else if (cluster.validationResults.maxInternalDistance < 400) {
                priority += 10;
            }
        }
        
        // Event quality boost
        cluster.events.forEach(event => {
            if (event.rating && event.rating > 4.0) priority += 10;
            if (event.userRatingCount && event.userRatingCount > 100) priority += 5;
        });
        
        // Recent activity boost
        const recentContacts = cluster.contacts.filter(contact => {
            const contactDate = new Date(contact.submittedAt || contact.createdAt);
            const daysDiff = (Date.now() - contactDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff <= 3;
        });
        
        priority += recentContacts.length * 5;
        
        return priority;
    }

    // Utility function to compare arrays
    arraysEqual(a, b) {
        return a.length === b.length && a.every((val, index) => val === b[index]);
    }

    // Get cache key for location-based searches
    getCacheKey(latitude, longitude, radius, eventTypes) {
        const roundedLat = Math.round(latitude * 1000) / 1000;
        const roundedLng = Math.round(longitude * 1000) / 1000;
        const sortedTypes = [...eventTypes].sort().join(',');
        return `${roundedLat},${roundedLng}-${radius}-${sortedTypes}`;
    }

    // Check if cache entry is still valid
    isCacheValid(cacheEntry, maxAge = this.CACHE_DURATION) {
        return cacheEntry && (Date.now() - cacheEntry.timestamp) < maxAge;
    }

    // Get cached events
    getCachedEvents(cacheKey) {
        const cached = this.cache.get(cacheKey);
        return this.isCacheValid(cached) ? cached.data : null;
    }

    // Cache events
    setCachedEvents(cacheKey, events) {
        this.cache.set(cacheKey, {
            data: events,
            timestamp: Date.now()
        });
    }

    // Get optimal radius using improved config
    getOptimalRadius(eventTypes, cityName = null, companyContext = null) {
        return getOptimalRadiusWithValidation(eventTypes, cityName, companyContext);
    }
}

// Export improved singleton instance
export const improvedEventDetectionService = new ImprovedEventDetectionService();