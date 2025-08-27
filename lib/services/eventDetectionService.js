// lib/services/eventDetectionService.js - Core event detection logic

export class EventDetectionService {
    constructor() {
        this.cache = new Map();
        this.locationCache = new Map();
        this.eventCache = new Map();
        this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
        this.EVENT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for events
        
        // Optimized distance thresholds for different event types
        this.DISTANCE_THRESHOLDS = {
            // Major conferences/conventions (large venues)
            'convention_center': 2000,     // 2km - can span multiple blocks
            'expo_center': 2000,
            'conference_center': 2000,
            
            // Entertainment venues
            'stadium': 1500,               // 1.5km - large stadiums
            'arena': 1500,
            'concert_hall': 800,           // 800m - mid-size venues
            'opera_house': 800,
            'performing_arts_theater': 500, // 500m - smaller theaters
            
            // Educational/Corporate
            'university': 3000,            // 3km - campus can be huge
            'business_center': 1000,       // 1km - business districts
            'corporate_campus': 2000,      // 2km - large corporate areas
            
            // Cultural venues
            'museum': 600,                 // 600m - focused area
            'art_gallery': 400,            // 400m - smaller venues
            'cultural_center': 1000,       // 1km - community areas
            
            // Hotels (often host events)
            'lodging': 500,                // 500m - hotel events
            'resort': 2000,                // 2km - large resorts
            
            // Default fallback
            'default': 1000                // 1km default
        };
        
        // City-specific adjustments for major event destinations
        this.CITY_ADJUSTMENTS = {
            'las vegas': 1.5,              // Vegas spreads events across strip
            'orlando': 1.3,                // Theme parks and convention areas
            'austin': 1.2,                 // SXSW spreads across downtown
            'san francisco': 0.8,          // Dense urban areas
            'new york': 0.7,               // Very dense, precise locations
            'paris': 0.8,                  // Dense European city
            'barcelona': 0.8,              // Compact European conference areas
            'singapore': 0.9,              // Compact but efficient layout
        };
    }

    // Get cache key for location-based searches
    getCacheKey(latitude, longitude, radius, eventTypes) {
        const roundedLat = Math.round(latitude * 1000) / 1000; // 3 decimal precision
        const roundedLng = Math.round(longitude * 1000) / 1000;
        const sortedTypes = [...eventTypes].sort().join(',');
        return `${roundedLat},${roundedLng}-${radius}-${sortedTypes}`;
    }

    // Check if cache entry is still valid
    isCacheValid(cacheEntry, maxAge = this.CACHE_DURATION) {
        return cacheEntry && (Date.now() - cacheEntry.timestamp) < maxAge;
    }

    // Get optimal search radius based on event type and location
    getOptimalRadius(eventTypes, cityName = null) {
        let maxRadius = 0;
        
        // Find the largest appropriate radius for the event types
        eventTypes.forEach(type => {
            const threshold = this.DISTANCE_THRESHOLDS[type] || this.DISTANCE_THRESHOLDS.default;
            maxRadius = Math.max(maxRadius, threshold);
        });
        
        // Apply city-specific adjustments
        if (cityName) {
            const cityKey = cityName.toLowerCase();
            const adjustment = this.CITY_ADJUSTMENTS[cityKey] || 1.0;
            maxRadius = Math.round(maxRadius * adjustment);
        }
        
        // Ensure reasonable bounds
        return Math.min(Math.max(maxRadius, 500), 5000); // Between 500m and 5km
    }

    // Intelligent clustering based on temporal and spatial proximity
    clusterEventsByProximity(events, contacts, timeWindow = 7) { // 7 days
        const clusters = [];
        const used = new Set();
        
        events.forEach(event => {
            if (used.has(event.id)) return;
            
            const cluster = {
                id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                primaryEvent: event,
                events: [event],
                contacts: [...(event.contactsNearby || [])],
                centerPoint: {
                    lat: event.location.lat,
                    lng: event.location.lng
                },
                radius: this.getOptimalRadius([...event.types], this.getCityFromAddress(event.vicinity)),
                confidence: event.confidence || 'medium',
                timeRange: {
                    start: new Date(),
                    end: new Date(Date.now() + timeWindow * 24 * 60 * 60 * 1000)
                }
            };
            
            used.add(event.id);
            
            // Find nearby events that could be part of the same conference/gathering
            events.forEach(otherEvent => {
                if (used.has(otherEvent.id) || otherEvent.id === event.id) return;
                
                const distance = this.calculateDistance(
                    event.location.lat, event.location.lng,
                    otherEvent.location.lat, otherEvent.location.lng
                );
                
                // Check if events are close enough to be related
                if (distance <= cluster.radius) {
                    // Additional checks for event similarity
                    const similarity = this.calculateEventSimilarity(event, otherEvent);
                    
                    if (similarity > 0.6) { // 60% similarity threshold
                        cluster.events.push(otherEvent);
                        cluster.contacts.push(...(otherEvent.contactsNearby || []));
                        used.add(otherEvent.id);
                        
                        // Update cluster center to be more representative
                        cluster.centerPoint = this.calculateClusterCenter(cluster.events);
                        cluster.confidence = this.calculateClusterConfidence(cluster.events);
                    }
                }
            });
            
            // Remove duplicate contacts
            cluster.contacts = cluster.contacts.filter((contact, index, array) => 
                array.findIndex(c => c.id === contact.id) === index
            );
            
            // Only create cluster if it has multiple contacts or high confidence
            if (cluster.contacts.length >= 2 || cluster.confidence === 'high') {
                clusters.push(cluster);
            }
        });
        
        return clusters;
    }

    // Calculate similarity between two events
    calculateEventSimilarity(event1, event2) {
        let similarity = 0;
        
        // Type similarity (40% weight)
        const commonTypes = event1.types.filter(type => event2.types.includes(type));
        const typesSimilarity = commonTypes.length / Math.max(event1.types.length, event2.types.length);
        similarity += typesSimilarity * 0.4;
        
        // Name similarity (30% weight)
        const nameSimilarity = this.calculateStringSimilarity(event1.name, event2.name);
        similarity += nameSimilarity * 0.3;
        
        // Rating similarity (20% weight)
        if (event1.rating && event2.rating) {
            const ratingDiff = Math.abs(event1.rating - event2.rating) / 5;
            const ratingSimilarity = 1 - ratingDiff;
            similarity += ratingSimilarity * 0.2;
        }
        
        // Business status similarity (10% weight)
        if (event1.businessStatus === event2.businessStatus) {
            similarity += 0.1;
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

    // Calculate cluster confidence based on event quality
    calculateClusterConfidence(events) {
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
        
        if (avgScore > 0.7 && highConfidenceRatio > 0.5) return 'high';
        if (avgScore > 0.5 && highConfidenceRatio > 0.3) return 'medium';
        return 'low';
    }

    // Extract city name from address for location-specific optimizations
    getCityFromAddress(address) {
        if (!address) return null;
        
        // Simple city extraction - could be enhanced with proper geocoding
        const parts = address.split(',');
        if (parts.length >= 2) {
            return parts[parts.length - 2].trim();
        }
        return null;
    }

    // Enhanced distance calculation with Earth's curvature
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

    // Generate intelligent group suggestions for specific events/conferences
    generateEventGroupSuggestions(clusters, existingGroups = []) {
        const suggestions = [];
        
        clusters.forEach(cluster => {
            if (cluster.contacts.length < 2) return;
            
            // Check if group already exists
            const existingGroup = existingGroups.find(group => 
                group.type === 'event' && 
                this.arraysEqual(
                    group.contactIds.sort(), 
                    cluster.contacts.map(c => c.id).sort()
                )
            );
            
            if (existingGroup) return;
            
            // Determine event name and type
            const primaryEvent = cluster.primaryEvent;
            const eventName = this.inferEventName(cluster);
            const eventDate = this.inferEventTimeframe(cluster);
            
            suggestions.push({
                id: cluster.id,
                type: 'event',
                subType: this.categorizeEventType(cluster),
                name: eventName,
                description: `${cluster.contacts.length} contacts from ${eventName}${eventDate ? ` (${eventDate})` : ''}`,
                contactIds: cluster.contacts.map(c => c.id),
                contacts: cluster.contacts,
                confidence: cluster.confidence,
                reason: `Contacts found near ${primaryEvent.name}`,
                eventData: {
                    primaryVenue: primaryEvent.name,
                    location: cluster.centerPoint,
                    venues: cluster.events.map(e => e.name),
                    estimatedAttendees: cluster.contacts.length,
                    radius: cluster.radius,
                    types: [...new Set(cluster.events.flatMap(e => e.types))]
                },
                autoGenerated: true,
                priority: this.calculateGroupPriority(cluster)
            });
        });
        
        return suggestions.sort((a, b) => b.priority - a.priority);
    }

    // Infer meaningful event name from cluster
    inferEventName(cluster) {
        const primaryEvent = cluster.primaryEvent;
        const cityName = this.getCityFromAddress(primaryEvent.vicinity);
        
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
            'mandalay bay': 'NAB Show / Other Tech Events',
            'moscone center': 'Various Tech Conferences',
            'jacob javits center': 'New York Conferences',
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
        
        // For now, assume current date - could be enhanced with calendar integration
        return `${month} ${day}, ${year}`;
    }

    // Categorize event type for better organization
    categorizeEventType(cluster) {
        const types = cluster.events.flatMap(e => e.types);
        
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

    // Calculate priority for group suggestions
    calculateGroupPriority(cluster) {
        let priority = 0;
        
        // More contacts = higher priority
        priority += Math.min(cluster.contacts.length * 10, 50);
        
        // Confidence boost
        if (cluster.confidence === 'high') priority += 30;
        else if (cluster.confidence === 'medium') priority += 15;
        
        // Event quality boost
        cluster.events.forEach(event => {
            if (event.rating && event.rating > 4.0) priority += 10;
            if (event.userRatingCount && event.userRatingCount > 100) priority += 5;
        });
        
        // Recent activity boost (contacts added recently)
        const recentContacts = cluster.contacts.filter(contact => {
            const contactDate = new Date(contact.submittedAt || contact.createdAt);
            const daysDiff = (Date.now() - contactDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff <= 3; // Within 3 days
        });
        
        priority += recentContacts.length * 5;
        
        return priority;
    }

    // Utility function to compare arrays
    arraysEqual(a, b) {
        return a.length === b.length && a.every((val, index) => val === b[index]);
    }

    // Cache management
    clearExpiredCache() {
        const now = Date.now();
        
        // Clear location cache
        for (const [key, value] of this.locationCache.entries()) {
            if (now - value.timestamp > this.CACHE_DURATION) {
                this.locationCache.delete(key);
            }
        }
        
        // Clear event cache
        for (const [key, value] of this.eventCache.entries()) {
            if (now - value.timestamp > this.EVENT_CACHE_DURATION) {
                this.eventCache.delete(key);
            }
        }
    }

    // Get cached events for a location
    getCachedEvents(cacheKey) {
        this.clearExpiredCache();
        const cached = this.eventCache.get(cacheKey);
        return this.isCacheValid(cached, this.EVENT_CACHE_DURATION) ? cached.data : null;
    }

    // Cache events for a location
    setCachedEvents(cacheKey, events) {
        this.eventCache.set(cacheKey, {
            data: events,
            timestamp: Date.now()
        });
    }
}

// Export singleton instance
export const eventDetectionService = new EventDetectionService();