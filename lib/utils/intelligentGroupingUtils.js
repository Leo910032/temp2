// lib/utils/intelligentGroupingUtils.js - Advanced contact grouping algorithms

import { EVENT_DETECTION_CONFIG } from '@/lib/config/eventDetectionConfig';

export class IntelligentGroupingUtils {
    constructor() {
        this.groupingConfig = EVENT_DETECTION_CONFIG.CLUSTERING_CONFIG;
    }

    // Main function to generate intelligent group suggestions
    generateIntelligentSuggestions(contacts, events, existingGroups = []) {
        console.log('🧠 Starting intelligent group analysis...');
        
        const suggestions = [];
        const analysisResults = {
            contactAnalysis: this.analyzeContactPatterns(contacts),
            eventAnalysis: this.analyzeEventPatterns(events),
            spatialAnalysis: this.analyzeSpatialPatterns(contacts, events),
            temporalAnalysis: this.analyzeTemporalPatterns(contacts)
        };

        // 1. Event-based grouping (highest priority)
        const eventGroups = this.generateEventBasedGroups(contacts, events, analysisResults);
        suggestions.push(...eventGroups);

        // 2. Company/Organization grouping
        const companyGroups = this.generateCompanyBasedGroups(contacts, analysisResults);
        suggestions.push(...companyGroups);

        // 3. Geographic proximity grouping
        const locationGroups = this.generateLocationBasedGroups(contacts, analysisResults);
        suggestions.push(...locationGroups);

        // 4. Temporal clustering (same day/time period)
        const temporalGroups = this.generateTemporalGroups(contacts, analysisResults);
        suggestions.push(...temporalGroups);

        // 5. Context-based intelligent grouping
        const contextGroups = this.generateContextBasedGroups(contacts, events, analysisResults);
        suggestions.push(...contextGroups);

        // Filter out existing groups and low-quality suggestions
        const filteredSuggestions = this.filterAndRankSuggestions(suggestions, existingGroups);

        console.log(`💡 Generated ${filteredSuggestions.length} intelligent group suggestions`);
        return filteredSuggestions;
    }

    // Analyze contact patterns for grouping insights
    analyzeContactPatterns(contacts) {
        const patterns = {
            companies: {},
            domains: {},
            industries: {},
            jobTitles: {},
            totalContacts: contacts.length
        };

        contacts.forEach(contact => {
            // Company analysis
            if (contact.company) {
                const company = contact.company.trim();
                if (!patterns.companies[company]) {
                    patterns.companies[company] = [];
                }
                patterns.companies[company].push(contact);
            }

            // Email domain analysis
            if (contact.email) {
                const domain = contact.email.split('@')[1]?.toLowerCase();
                if (domain) {
                    if (!patterns.domains[domain]) {
                        patterns.domains[domain] = [];
                    }
                    patterns.domains[domain].push(contact);
                }
            }

            // Job title analysis (simplified)
            if (contact.jobTitle || contact.title) {
                const title = (contact.jobTitle || contact.title).toLowerCase();
                const industry = this.inferIndustryFromTitle(title);
                if (industry) {
                    if (!patterns.industries[industry]) {
                        patterns.industries[industry] = [];
                    }
                    patterns.industries[industry].push(contact);
                }
            }
        });

        return patterns;
    }

    // Analyze event patterns for intelligent grouping
    analyzeEventPatterns(events) {
        const patterns = {
            eventTypes: {},
            venues: {},
            locations: {},
            confidence: {},
            totalEvents: events.length
        };

        events.forEach(event => {
            // Event type analysis
            event.types?.forEach(type => {
                if (!patterns.eventTypes[type]) {
                    patterns.eventTypes[type] = [];
                }
                patterns.eventTypes[type].push(event);
            });

            // Venue analysis
            if (event.name) {
                const venueKey = this.normalizeVenueName(event.name);
                if (!patterns.venues[venueKey]) {
                    patterns.venues[venueKey] = [];
                }
                patterns.venues[venueKey].push(event);
            }

            // Location clustering
            const locationKey = `${Math.round(event.location.lat * 100)},${Math.round(event.location.lng * 100)}`;
            if (!patterns.locations[locationKey]) {
                patterns.locations[locationKey] = [];
            }
            patterns.locations[locationKey].push(event);

            // Confidence analysis
            const conf = event.confidence || 'medium';
            if (!patterns.confidence[conf]) {
                patterns.confidence[conf] = [];
            }
            patterns.confidence[conf].push(event);
        });

        return patterns;
    }

    // Analyze spatial patterns (geographic clustering)
    analyzeSpatialPatterns(contacts, events) {
        const patterns = {
            contactClusters: [],
            eventClusters: [],
            proximityMap: new Map()
        };

        // Cluster contacts by location
        const contactsWithLocation = contacts.filter(c => c.location?.latitude && c.location?.longitude);
        patterns.contactClusters = this.clusterByProximity(contactsWithLocation, 'contact');

        // Cluster events by location
        patterns.eventClusters = this.clusterByProximity(events, 'event');

        // Create proximity map between contacts and events
        contactsWithLocation.forEach(contact => {
            const nearbyEvents = events.filter(event => {
                const distance = this.calculateDistance(
                    contact.location.latitude,
                    contact.location.longitude,
                    event.location.lat,
                    event.location.lng
                );
                return distance <= 2000; // Within 2km
            });

            if (nearbyEvents.length > 0) {
                patterns.proximityMap.set(contact.id, nearbyEvents);
            }
        });

        return patterns;
    }

    // Analyze temporal patterns (time-based clustering)
    analyzeTemporalPatterns(contacts) {
        const patterns = {
            dailyClusters: {},
            hourlyClusters: {},
            weeklyClusters: {},
            timeWindows: []
        };

        contacts.forEach(contact => {
            const date = new Date(contact.submittedAt || contact.createdAt);
            
            // Daily clustering
            const dayKey = date.toDateString();
            if (!patterns.dailyClusters[dayKey]) {
                patterns.dailyClusters[dayKey] = [];
            }
            patterns.dailyClusters[dayKey].push(contact);

            // Hourly clustering (for same-day events)
            const hourKey = `${dayKey}_${date.getHours()}`;
            if (!patterns.hourlyClusters[hourKey]) {
                patterns.hourlyClusters[hourKey] = [];
            }
            patterns.hourlyClusters[hourKey].push(contact);

            // Weekly clustering
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const weekKey = weekStart.toDateString();
            if (!patterns.weeklyClusters[weekKey]) {
                patterns.weeklyClusters[weekKey] = [];
            }
            patterns.weeklyClusters[weekKey].push(contact);
        });

        return patterns;
    }

    // Generate event-based group suggestions (CES 2026, conferences, etc.)
    generateEventBasedGroups(contacts, events, analysisResults) {
        const suggestions = [];

        // Group by specific events/venues
        Object.entries(analysisResults.eventAnalysis.venues).forEach(([venueKey, venueEvents]) => {
            if (venueEvents.length < 1) return;

            const relatedContacts = new Set();
            venueEvents.forEach(event => {
                event.contactsNearby?.forEach(contact => {
                    relatedContacts.add(contact);
                });
            });

            if (relatedContacts.size >= 2) {
                const primaryEvent = venueEvents[0];
                const eventName = this.inferEventName(venueKey, primaryEvent);
                
                suggestions.push({
                    id: `event_${venueKey}_${Date.now()}`,
                    type: 'event',
                    subType: this.categorizeEventType(venueEvents),
                    name: eventName,
                    description: `${relatedContacts.size} contacts from ${eventName}`,
                    contactIds: Array.from(relatedContacts).map(c => c.id),
                    contacts: Array.from(relatedContacts),
                    confidence: this.calculateGroupConfidence(relatedContacts, venueEvents),
                    priority: this.calculateEventGroupPriority(relatedContacts, venueEvents),
                    reason: `Contacts detected at ${primaryEvent.name}`,
                    eventData: {
                        primaryVenue: primaryEvent.name,
                        venues: venueEvents.map(e => e.name),
                        location: primaryEvent.location,
                        eventTypes: [...new Set(venueEvents.flatMap(e => e.types))],
                        detectionMethod: 'intelligent_venue_clustering'
                    },
                    metadata: {
                        createdBy: 'intelligent_grouping',
                        timestamp: Date.now(),
                        analysisMethod: 'event_based_clustering'
                    }
                });
            }
        });

        return suggestions;
    }

    // Generate company/organization-based groups
    generateCompanyBasedGroups(contacts, analysisResults) {
        const suggestions = [];

        Object.entries(analysisResults.contactAnalysis.companies).forEach(([company, companyContacts]) => {
            if (companyContacts.length >= 2) {
                // Check if this is a significant company (multiple employees)
                const confidence = companyContacts.length >= 5 ? 'high' : 
                                 companyContacts.length >= 3 ? 'medium' : 'low';

                suggestions.push({
                    id: `company_${company.replace(/\s+/g, '_')}_${Date.now()}`,
                    type: 'company',
                    subType: 'organization',
                    name: `${company} Team`,
                    description: `${companyContacts.length} contacts from ${company}`,
                    contactIds: companyContacts.map(c => c.id),
                    contacts: companyContacts,
                    confidence: confidence,
                    priority: this.calculateCompanyGroupPriority(companyContacts),
                    reason: `Multiple contacts from the same organization`,
                    eventData: null,
                    metadata: {
                        company: company,
                        createdBy: 'intelligent_grouping',
                        timestamp: Date.now(),
                        analysisMethod: 'company_based_clustering'
                    }
                });
            }
        });

        // Also check email domains for additional company grouping
        Object.entries(analysisResults.contactAnalysis.domains).forEach(([domain, domainContacts]) => {
            if (domainContacts.length >= 3 && !domain.includes('gmail') && !domain.includes('yahoo')) {
                const companyName = this.inferCompanyFromDomain(domain);
                
                suggestions.push({
                    id: `domain_${domain.replace(/\./g, '_')}_${Date.now()}`,
                    type: 'company',
                    subType: 'email_domain',
                    name: `${companyName} Contacts`,
                    description: `${domainContacts.length} contacts from ${domain}`,
                    contactIds: domainContacts.map(c => c.id),
                    contacts: domainContacts,
                    confidence: 'medium',
                    priority: this.calculateDomainGroupPriority(domainContacts, domain),
                    reason: `Contacts sharing the same email domain`,
                    eventData: null,
                    metadata: {
                        domain: domain,
                        inferredCompany: companyName,
                        createdBy: 'intelligent_grouping',
                        timestamp: Date.now(),
                        analysisMethod: 'domain_based_clustering'
                    }
                });
            }
        });

        return suggestions;
    }

    // Generate location-based group suggestions
    generateLocationBasedGroups(contacts, analysisResults) {
        const suggestions = [];

        analysisResults.spatialAnalysis.contactClusters.forEach((cluster, index) => {
            if (cluster.length >= 2) {
                const centerPoint = this.calculateClusterCenter(cluster);
                const locationName = this.inferLocationName(centerPoint, cluster);

                suggestions.push({
                    id: `location_${index}_${Date.now()}`,
                    type: 'location',
                    subType: 'geographic_proximity',
                    name: `${locationName} Area`,
                    description: `${cluster.length} contacts in the same area`,
                    contactIds: cluster.map(c => c.id),
                    contacts: cluster,
                    confidence: 'medium',
                    priority: this.calculateLocationGroupPriority(cluster),
                    reason: `Contacts located in the same geographic area`,
                    eventData: {
                        centerPoint: centerPoint,
                        radius: this.calculateClusterRadius(cluster),
                        detectionMethod: 'geographic_clustering'
                    },
                    metadata: {
                        clusterSize: cluster.length,
                        createdBy: 'intelligent_grouping',
                        timestamp: Date.now(),
                        analysisMethod: 'location_based_clustering'
                    }
                });
            }
        });

        return suggestions;
    }

    // Generate temporal group suggestions (same day/event timeframe)
    generateTemporalGroups(contacts, analysisResults) {
        const suggestions = [];

        // Daily clustering - contacts met on the same day
        Object.entries(analysisResults.temporalAnalysis.dailyClusters).forEach(([dayKey, dayContacts]) => {
            if (dayContacts.length >= 3) { // Higher threshold for temporal groups
                const date = new Date(dayKey);
                const formattedDate = date.toLocaleDateString();

                suggestions.push({
                    id: `temporal_${dayKey.replace(/\s+/g, '_')}_${Date.now()}`,
                    type: 'temporal',
                    subType: 'same_day',
                    name: `${formattedDate} Contacts`,
                    description: `${dayContacts.length} contacts met on ${formattedDate}`,
                    contactIds: dayContacts.map(c => c.id),
                    contacts: dayContacts,
                    confidence: dayContacts.length >= 5 ? 'high' : 'medium',
                    priority: this.calculateTemporalGroupPriority(dayContacts, 'daily'),
                    reason: `Contacts met on the same day`,
                    eventData: {
                        date: dayKey,
                        timeWindow: 'daily',
                        detectionMethod: 'temporal_clustering'
                    },
                    metadata: {
                        date: dayKey,
                        contactCount: dayContacts.length,
                        createdBy: 'intelligent_grouping',
                        timestamp: Date.now(),
                        analysisMethod: 'temporal_clustering'
                    }
                });
            }
        });

        // Hourly clustering for very recent contacts (same event)
        Object.entries(analysisResults.temporalAnalysis.hourlyClusters).forEach(([hourKey, hourContacts]) => {
            if (hourContacts.length >= 2) {
                const [dayKey, hour] = hourKey.split('_');
                const date = new Date(dayKey);
                const timeString = `${hour}:00`;

                suggestions.push({
                    id: `hourly_${hourKey.replace(/\s+/g, '_')}_${Date.now()}`,
                    type: 'temporal',
                    subType: 'same_hour',
                    name: `${date.toLocaleDateString()} ${timeString} Event`,
                    description: `${hourContacts.length} contacts met around ${timeString}`,
                    contactIds: hourContacts.map(c => c.id),
                    contacts: hourContacts,
                    confidence: 'high', // High confidence for same-hour contacts
                    priority: this.calculateTemporalGroupPriority(hourContacts, 'hourly'),
                    reason: `Contacts met within the same hour`,
                    eventData: {
                        date: dayKey,
                        hour: parseInt(hour),
                        timeWindow: 'hourly',
                        detectionMethod: 'precise_temporal_clustering'
                    },
                    metadata: {
                        hourKey: hourKey,
                        contactCount: hourContacts.length,
                        createdBy: 'intelligent_grouping',
                        timestamp: Date.now(),
                        analysisMethod: 'hourly_temporal_clustering'
                    }
                });
            }
        });

        return suggestions;
    }

    // Generate context-based intelligent groups (advanced analysis)
    generateContextBasedGroups(contacts, events, analysisResults) {
        const suggestions = [];

        // Industry-based grouping
        Object.entries(analysisResults.contactAnalysis.industries).forEach(([industry, industryContacts]) => {
            if (industryContacts.length >= 3) {
                suggestions.push({
                    id: `industry_${industry.replace(/\s+/g, '_')}_${Date.now()}`,
                    type: 'industry',
                    subType: 'professional_category',
                    name: `${industry} Professionals`,
                    description: `${industryContacts.length} contacts from ${industry}`,
                    contactIds: industryContacts.map(c => c.id),
                    contacts: industryContacts,
                    confidence: 'medium',
                    priority: this.calculateIndustryGroupPriority(industryContacts, industry),
                    reason: `Contacts from the same industry`,
                    eventData: null,
                    metadata: {
                        industry: industry,
                        createdBy: 'intelligent_grouping',
                        timestamp: Date.now(),
                        analysisMethod: 'industry_based_clustering'
                    }
                });
            }
        });

        // Cross-reference events and contacts for smart suggestions
        analysisResults.spatialAnalysis.proximityMap.forEach((nearbyEvents, contactId) => {
            const contact = contacts.find(c => c.id === contactId);
            if (!contact) return;

            // Find other contacts near the same events
            const relatedContacts = new Set([contact]);
            
            nearbyEvents.forEach(event => {
                event.contactsNearby?.forEach(nearbyContact => {
                    if (nearbyContact.id !== contactId) {
                        relatedContacts.add(nearbyContact);
                    }
                });
            });

            if (relatedContacts.size >= 2) {
                const primaryEvent = nearbyEvents[0];
                const eventName = this.inferEventName(primaryEvent.name, primaryEvent);

                suggestions.push({
                    id: `context_${contactId}_${Date.now()}`,
                    type: 'context',
                    subType: 'event_proximity',
                    name: `${eventName} Network`,
                    description: `${relatedContacts.size} contacts connected through ${eventName}`,
                    contactIds: Array.from(relatedContacts).map(c => c.id),
                    contacts: Array.from(relatedContacts),
                    confidence: 'high',
                    priority: this.calculateContextGroupPriority(relatedContacts, nearbyEvents),
                    reason: `Contacts connected through proximity to ${eventName}`,
                    eventData: {
                        primaryEvent: primaryEvent,
                        relatedEvents: nearbyEvents,
                        detectionMethod: 'context_proximity_analysis'
                    },
                    metadata: {
                        originContactId: contactId,
                        eventCount: nearbyEvents.length,
                        createdBy: 'intelligent_grouping',
                        timestamp: Date.now(),
                        analysisMethod: 'context_based_proximity'
                    }
                });
            }
        });

        return suggestions;
    }

    // Filter and rank suggestions by quality and relevance
    filterAndRankSuggestions(suggestions, existingGroups) {
        // Remove duplicates and existing groups
        const filteredSuggestions = suggestions.filter(suggestion => {
            // Check if group already exists
            const exists = existingGroups.some(existing => 
                this.arraysEqual(
                    existing.contactIds.sort(),
                    suggestion.contactIds.sort()
                )
            );
            
            if (exists) return false;

            // Filter by minimum requirements
            if (suggestion.contacts.length < this.groupingConfig.MIN_CONTACTS_PER_CLUSTER) return false;
            if (suggestion.confidence === 'low' && suggestion.contacts.length < 3) return false;

            return true;
        });

        // Rank by priority and confidence
        filteredSuggestions.sort((a, b) => {
            // Primary sort by priority
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            
            // Secondary sort by contact count
            if (a.contacts.length !== b.contacts.length) {
                return b.contacts.length - a.contacts.length;
            }
            
            // Tertiary sort by confidence
            const confidenceOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
        });

        // Limit to max suggestions
        return filteredSuggestions.slice(0, this.groupingConfig.MAX_AUTO_SUGGESTIONS);
    }

    // Helper methods for calculations and analysis

    clusterByProximity(items, type = 'contact') {
        const clusters = [];
        const used = new Set();

        items.forEach(item => {
            if (used.has(item.id)) return;

            const cluster = [item];
            used.add(item.id);

            const itemLat = type === 'contact' ? item.location.latitude : item.location.lat;
            const itemLng = type === 'contact' ? item.location.longitude : item.location.lng;

            items.forEach(otherItem => {
                if (used.has(otherItem.id)) return;

                const otherLat = type === 'contact' ? otherItem.location.latitude : otherItem.location.lat;
                const otherLng = type === 'contact' ? otherItem.location.longitude : otherItem.location.lng;

                const distance = this.calculateDistance(itemLat, itemLng, otherLat, otherLng);

                if (distance <= this.groupingConfig.CLUSTER_DISTANCE_THRESHOLDS.moderate) {
                    cluster.push(otherItem);
                    used.add(otherItem.id);
                }
            });

            if (cluster.length >= 2) {
                clusters.push(cluster);
            }
        });

        return clusters;
    }

    calculateClusterCenter(cluster) {
        const avgLat = cluster.reduce((sum, item) => {
            const lat = item.location?.latitude || item.location?.lat || 0;
            return sum + lat;
        }, 0) / cluster.length;

        const avgLng = cluster.reduce((sum, item) => {
            const lng = item.location?.longitude || item.location?.lng || 0;
            return sum + lng;
        }, 0) / cluster.length;

        return { lat: avgLat, lng: avgLng };
    }

    calculateClusterRadius(cluster) {
        const center = this.calculateClusterCenter(cluster);
        let maxDistance = 0;

        cluster.forEach(item => {
            const lat = item.location?.latitude || item.location?.lat || 0;
            const lng = item.location?.longitude || item.location?.lng || 0;
            const distance = this.calculateDistance(center.lat, center.lng, lat, lng);
            maxDistance = Math.max(maxDistance, distance);
        });

        return maxDistance;
    }

    // Priority calculation methods
    calculateEventGroupPriority(contacts, events) {
        let priority = 0;
        
        // Base priority from contact count
        priority += contacts.length * 15;
        
        // Event quality bonus
        events.forEach(event => {
            if (event.confidence === 'high') priority += 20;
            else if (event.confidence === 'medium') priority += 10;
            
            if (event.rating && event.rating > 4.0) priority += 15;
            if (event.userRatingCount && event.userRatingCount > 100) priority += 10;
        });
        
        // Venue type bonus
        const hasHighPriorityVenue = events.some(event => 
            event.types?.some(type => 
                ['convention_center', 'conference_center', 'university'].includes(type)
            )
        );
        if (hasHighPriorityVenue) priority += 25;
        
        return priority;
    }

    calculateCompanyGroupPriority(contacts) {
        let priority = contacts.length * 10; // Base priority
        
        // Bonus for larger companies
        if (contacts.length >= 5) priority += 20;
        if (contacts.length >= 10) priority += 30;
        
        // Bonus for recent contacts
        const recentContacts = contacts.filter(contact => {
            const contactDate = new Date(contact.submittedAt || contact.createdAt);
            const daysDiff = (Date.now() - contactDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff <= 7; // Within a week
        });
        priority += recentContacts.length * 5;
        
        return priority;
    }

    calculateLocationGroupPriority(contacts) {
        let priority = contacts.length * 8; // Slightly lower than company groups
        
        // Recent activity bonus
        const recentContacts = contacts.filter(contact => {
            const contactDate = new Date(contact.submittedAt || contact.createdAt);
            const daysDiff = (Date.now() - contactDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff <= 3; // Within 3 days
        });
        priority += recentContacts.length * 8;
        
        return priority;
    }

    calculateTemporalGroupPriority(contacts, timeWindow) {
        let priority = contacts.length * (timeWindow === 'hourly' ? 20 : 12);
        
        // Bonus for very recent temporal groups
        const firstContact = contacts[0];
        const contactDate = new Date(firstContact.submittedAt || firstContact.createdAt);
        const daysDiff = (Date.now() - contactDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= 1) priority += 25; // Same day
        else if (daysDiff <= 3) priority += 15; // Within 3 days
        
        return priority;
    }

    calculateIndustryGroupPriority(contacts, industry) {
        let priority = contacts.length * 6; // Lower priority than other types
        
        // Bonus for high-value industries
        const highValueIndustries = ['technology', 'finance', 'healthcare', 'consulting'];
        if (highValueIndustries.includes(industry.toLowerCase())) {
            priority += 15;
        }
        
        return priority;
    }

    calculateContextGroupPriority(contacts, events) {
        let priority = contacts.length * 12;
        
        // High bonus for context-based groups (they're usually very relevant)
        priority += 30;
        
        // Event quality bonus
        const avgEventScore = events.reduce((sum, event) => sum + (event.eventScore || 0.5), 0) / events.length;
        priority += avgEventScore * 20;
        
        return priority;
    }

    calculateDomainGroupPriority(contacts, domain) {
        let priority = contacts.length * 8;
        
        // Bonus for corporate domains (not free email providers)
        const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
        if (!freeProviders.includes(domain.toLowerCase())) {
            priority += 20;
        }
        
        return priority;
    }

    // Confidence calculation
    calculateGroupConfidence(contacts, events = []) {
        let confidenceScore = 0;
        
        // Contact count factor
        if (contacts.length >= 5) confidenceScore += 0.3;
        else if (contacts.length >= 3) confidenceScore += 0.2;
        else confidenceScore += 0.1;
        
        // Event quality factor
        if (events.length > 0) {
            const highConfidenceEvents = events.filter(e => e.confidence === 'high').length;
            const eventConfidenceRatio = highConfidenceEvents / events.length;
            confidenceScore += eventConfidenceRatio * 0.4;
        }
        
        // Temporal factor (recent contacts are higher confidence)
        const recentContacts = contacts.filter(contact => {
            const contactDate = new Date(contact.submittedAt || contact.createdAt);
            const daysDiff = (Date.now() - contactDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff <= 3;
        });
        const recentRatio = recentContacts.length / contacts.length;
        confidenceScore += recentRatio * 0.3;
        
        if (confidenceScore >= 0.7) return 'high';
        if (confidenceScore >= 0.4) return 'medium';
        return 'low';
    }

    // Utility methods
    inferIndustryFromTitle(title) {
        const industryKeywords = {
            'technology': ['engineer', 'developer', 'tech', 'software', 'data', 'ai', 'ml'],
            'finance': ['finance', 'bank', 'investment', 'trading', 'financial'],
            'healthcare': ['doctor', 'nurse', 'medical', 'health', 'physician'],
            'consulting': ['consultant', 'advisor', 'consulting', 'strategy'],
            'marketing': ['marketing', 'brand', 'advertising', 'digital'],
            'sales': ['sales', 'business development', 'account'],
            'education': ['teacher', 'professor', 'education', 'academic'],
            'legal': ['lawyer', 'attorney', 'legal', 'counsel']
        };

        for (const [industry, keywords] of Object.entries(industryKeywords)) {
            if (keywords.some(keyword => title.includes(keyword))) {
                return industry;
            }
        }
        
        return null;
    }

    inferCompanyFromDomain(domain) {
        // Simple company name inference from domain
        const parts = domain.split('.');
        if (parts.length >= 2) {
            const companyPart = parts[0];
            // Capitalize first letter
            return companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
        }
        return domain;
    }

    normalizeVenueName(venueName) {
        return venueName.toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }

    inferEventName(venueKey, primaryEvent) {
        // Try to infer a meaningful event name
        const venueName = primaryEvent.name;
        
        // Look for known event patterns
        const eventKeywords = ['ces', 'nab', 'sxsw', 'comic con', 'dreamforce'];
        const lowerVenue = venueName.toLowerCase();
        
        for (const keyword of eventKeywords) {
            if (lowerVenue.includes(keyword)) {
                return keyword.toUpperCase();
            }
        }
        
        // Check for convention center patterns
        if (lowerVenue.includes('convention')) {
            return `${venueName} Event`;
        }
        
        // Default to venue name
        return venueName;
    }

    categorizeEventType(events) {
        const types = events.flatMap(e => e.types || []);
        
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

    inferLocationName(centerPoint, cluster) {
        // Simple location naming - could be enhanced with reverse geocoding
        if (cluster.length === 1) {
            return 'Location';
        }
        
        // Check if any contacts have address info
        const hasAddresses = cluster.some(contact => contact.address || contact.location?.address);
        if (hasAddresses) {
            return 'Same Area';
        }
        
        return `Cluster Area`;
    }

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

    arraysEqual(a, b) {
        return a.length === b.length && a.every((val, index) => val === b[index]);
    }
}

// Export singleton instance
export const intelligentGroupingUtils = new IntelligentGroupingUtils();