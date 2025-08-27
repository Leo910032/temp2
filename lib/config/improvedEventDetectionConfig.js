// lib/config/improvedEventDetectionConfig.js - Fixed clustering with tighter thresholds

export const IMPROVED_EVENT_DETECTION_CONFIG = {
    // REDUCED distance thresholds to prevent false positives
    DISTANCE_THRESHOLDS: {
        // Corporate campuses - MUCH tighter clustering
        'corporate_campus': {
            base: 300,      // 300m - single building complex
            description: 'Corporate buildings and immediate vicinity',
            examples: ['Google buildings', 'Apple Park sections', 'Microsoft campus buildings']
        },
        'office_building': {
            base: 200,      // 200m - single office building
            description: 'Individual office buildings',
            examples: ['Single office towers', 'Business centers']
        },
        
        // Convention centers - more reasonable distances
        'convention_center': {
            base: 800,      // Reduced from 2000m to 800m
            description: 'Convention center complex',
            examples: ['Single convention center venue']
        },
        'expo_center': {
            base: 1000,     // Reduced from 2500m
            description: 'Expo center with multiple halls',
            examples: ['Orange County Convention Center halls']
        },
        
        // Entertainment venues - tighter clustering
        'stadium': {
            base: 500,      // Reduced from 2000m
            description: 'Stadium and immediate parking/facilities',
            examples: ['Single stadium complex']
        },
        'arena': {
            base: 400,      // Reduced from 1500m
            description: 'Arena and immediate vicinity',
            examples: ['Madison Square Garden area']
        },
        
        // Educational venues
        'university': {
            base: 600,      // Reduced from 3000m to prevent campus-wide clustering
            description: 'University building or quad area',
            examples: ['Specific university buildings or adjacent quads']
        },
        
        // Cultural venues
        'museum': {
            base: 300,      // Reduced from 600m
            description: 'Museum building and immediate area',
            examples: ['Single museum building']
        },
        'art_gallery': {
            base: 200,      // Reduced from 400m
            description: 'Gallery building',
            examples: ['Individual art galleries']
        },
        
        // Hotels and hospitality
        'lodging': {
            base: 300,      // Reduced from 500m
            description: 'Hotel building and immediate facilities',
            examples: ['Single hotel property']
        },
        
        // Default fallback - much smaller
        'default': {
            base: 250,      // Reduced from 1000m
            description: 'Default radius for precise venue targeting',
            examples: ['Individual buildings or small complexes']
        }
    },

    // Enhanced city-specific adjustments with MUCH tighter controls
    CITY_ADJUSTMENTS: {
        // Tech hubs need tighter clustering due to multiple company campuses
        'mountain view': {
            multiplier: 0.4,    // Very tight for Google campus area
            description: 'Tight clustering for Google campus and surrounding tech companies',
            corporateMode: true,
            specialZones: {
                'googleplex': { 
                    multiplier: 0.3, 
                    description: 'Individual Google buildings',
                    maxRadius: 200 // Hard cap at 200m
                },
                'downtown': { 
                    multiplier: 0.5, 
                    description: 'Downtown Mountain View businesses' 
                }
            }
        },
        'palo alto': {
            multiplier: 0.4,    // Tight for Stanford and tech offices
            description: 'Tight clustering for Stanford campus and tech offices',
            corporateMode: true
        },
        'cupertino': {
            multiplier: 0.3,    // Very tight for Apple campus
            description: 'Very tight clustering for Apple Park area',
            corporateMode: true,
            specialZones: {
                'apple_park': { 
                    multiplier: 0.2, 
                    description: 'Apple Park individual buildings',
                    maxRadius: 150
                }
            }
        },
        'redmond': {
            multiplier: 0.4,    // Tight for Microsoft campus
            description: 'Tight clustering for Microsoft campus',
            corporateMode: true
        },
        
        // Keep existing for other cities but with tighter controls
        'san francisco': {
            multiplier: 0.6,    // Slightly tighter than before
            description: 'Dense urban area with precise venue locations',
            corporateMode: false
        },
        'new york': {
            multiplier: 0.5,    // Tighter for NYC
            description: 'Very dense urban area with precise venue locations',
            corporateMode: false
        },
        
        // Convention cities can be slightly looser but still controlled
        'las vegas': {
            multiplier: 1.2,    // Reduced from 1.8
            description: 'Convention areas with controlled clustering',
            corporateMode: false,
            specialZones: {
                'strip': { multiplier: 1.0, description: 'Individual resort properties' },
                'convention': { multiplier: 0.8, description: 'Convention center area' }
            }
        }
    },

    // Enhanced clustering parameters with strict controls
    CLUSTERING_CONFIG: {
        // Much tighter distance thresholds
        CLUSTER_DISTANCE_THRESHOLDS: {
            'tight': 100,      // 100m - same building/complex
            'moderate': 250,   // 250m - walking distance (reduced from 1000m)
            'loose': 500,      // 500m - same neighborhood (reduced from 2000m)
            'city_wide': 1000  // 1km - only for large events (reduced from 5000m)
        },
        
        // Stricter requirements for cluster formation
        MIN_CONTACTS_PER_CLUSTER: 2,
        MIN_EVENTS_PER_CLUSTER: 1,
        MIN_CLUSTER_CONFIDENCE: 0.6,    // Increased from 0.4
        
        // Enhanced similarity requirements
        MIN_EVENT_SIMILARITY: 0.7,      // Increased from 0.6
        MIN_NAME_SIMILARITY: 0.5,       // Increased from 0.4
        MIN_TYPE_OVERLAP: 0.4,          // Increased from 0.3
        
        // Corporate campus specific settings
        CORPORATE_CAMPUS_MODE: {
            enabled: true,
            maxDistanceMeters: 300,      // Hard limit for corporate campuses
            requireSimilarBuildings: true,
            requireSimilarCompanies: true,
            minSimilarityScore: 0.8
        },
        
        // Advanced clustering validation
        VALIDATION_RULES: {
            // Prevent grouping across major streets/highways
            respectGeoBarriers: true,
            
            // Ensure groups make logical sense
            validateCompanyContext: true,
            
            // Check venue types are compatible
            validateVenueCompatibility: true,
            
            // Maximum distance between any two points in a cluster
            maxIntraClusterDistance: 500  // 500m max
        }
    },

    // Enhanced venue compatibility matrix
    VENUE_COMPATIBILITY_MATRIX: {
        'corporate_campus': {
            compatible: ['office_building', 'business_center', 'corporate_campus'],
            incompatible: ['stadium', 'museum', 'restaurant', 'tourist_attraction'],
            description: 'Corporate venues should only cluster with other business venues'
        },
        'convention_center': {
            compatible: ['expo_center', 'conference_center', 'event_venue'],
            incompatible: ['corporate_campus', 'university', 'residential'],
            description: 'Convention venues cluster with other event venues'
        },
        'university': {
            compatible: ['university', 'school', 'educational'],
            incompatible: ['corporate_campus', 'industrial'],
            description: 'Educational venues cluster together'
        }
    },

    // Smart company detection patterns
    COMPANY_PATTERNS: {
        'google': {
            keywords: ['google', 'googleplex', 'alphabet'],
            expectedVenues: ['corporate_campus', 'office_building'],
            tightClustering: true,
            maxRadius: 200,
            campusLocations: [
                { lat: 37.4220, lng: -122.0841, name: 'Googleplex Main', radius: 150 },
                { lat: 37.4043, lng: -122.0748, name: 'Google Charleston', radius: 100 }
            ]
        },
        'apple': {
            keywords: ['apple', 'cupertino', 'apple park'],
            expectedVenues: ['corporate_campus'],
            tightClustering: true,
            maxRadius: 150,
            campusLocations: [
                { lat: 37.3348, lng: -122.0090, name: 'Apple Park', radius: 200 },
                { lat: 37.3230, lng: -122.0322, name: 'Apple Infinite Loop', radius: 100 }
            ]
        },
        'microsoft': {
            keywords: ['microsoft', 'redmond'],
            expectedVenues: ['corporate_campus', 'office_building'],
            tightClustering: true,
            maxRadius: 250
        }
    }
};

// Enhanced helper functions with strict validation

export function getOptimalRadiusWithValidation(eventTypes, cityName = null, companyContext = null, currentTime = new Date()) {
    let maxRadius = 0;
    
    // Determine base radius from event types
    eventTypes.forEach(type => {
        const config = IMPROVED_EVENT_DETECTION_CONFIG.DISTANCE_THRESHOLDS[type] || 
                      IMPROVED_EVENT_DETECTION_CONFIG.DISTANCE_THRESHOLDS.default;
        maxRadius = Math.max(maxRadius, config.base);
    });
    
    // Apply city-specific adjustments with stricter controls
    if (cityName) {
        const cityKey = cityName.toLowerCase().replace(/\s+/g, '_');
        const cityConfig = IMPROVED_EVENT_DETECTION_CONFIG.CITY_ADJUSTMENTS[cityKey];
        if (cityConfig) {
            maxRadius = Math.round(maxRadius * cityConfig.multiplier);
            
            // Apply hard caps for corporate cities
            if (cityConfig.corporateMode && maxRadius > 400) {
                maxRadius = 400; // Hard cap for corporate areas
            }
        }
    }
    
    // Apply company-specific constraints
    if (companyContext) {
        const companyKey = companyContext.toLowerCase();
        const companyPattern = Object.entries(IMPROVED_EVENT_DETECTION_CONFIG.COMPANY_PATTERNS)
            .find(([key, pattern]) => pattern.keywords.some(keyword => companyKey.includes(keyword)));
        
        if (companyPattern) {
            const [, pattern] = companyPattern;
            if (pattern.tightClustering) {
                maxRadius = Math.min(maxRadius, pattern.maxRadius || 200);
            }
        }
    }
    
    // Ensure reasonable bounds with tighter constraints
    return Math.min(Math.max(maxRadius, 100), 600); // Between 100m and 600m (was 8000m!)
}

export function validateClusterCoherence(contacts, maxDistance = 500) {
    if (contacts.length < 2) return true;
    
    // Check all pairwise distances
    for (let i = 0; i < contacts.length; i++) {
        for (let j = i + 1; j < contacts.length; j++) {
            const contact1 = contacts[i];
            const contact2 = contacts[j];
            
            if (!contact1.location || !contact2.location) continue;
            
            const distance = calculateDistance(
                contact1.location.latitude, contact1.location.longitude,
                contact2.location.latitude, contact2.location.longitude
            );
            
            if (distance > maxDistance) {
                console.warn(`Cluster validation failed: contacts ${contact1.id} and ${contact2.id} are ${Math.round(distance)}m apart (max: ${maxDistance}m)`);
                return false;
            }
        }
    }
    
    return true;
}

export function shouldClusterTogether(contact1, contact2, context = {}) {
    // Basic distance check
    const distance = calculateDistance(
        contact1.location.latitude, contact1.location.longitude,
        contact2.location.latitude, contact2.location.longitude
    );
    
    // Get appropriate threshold based on context
    let maxDistance = IMPROVED_EVENT_DETECTION_CONFIG.CLUSTERING_CONFIG.CLUSTER_DISTANCE_THRESHOLDS.moderate;
    
    // Corporate context requires much tighter clustering
    if (context.companyContext || 
        (contact1.company && contact2.company && contact1.company === contact2.company)) {
        maxDistance = IMPROVED_EVENT_DETECTION_CONFIG.CLUSTERING_CONFIG.CORPORATE_CAMPUS_MODE.maxDistanceMeters;
    }
    
    // Event context
    if (context.eventContext) {
        maxDistance = IMPROVED_EVENT_DETECTION_CONFIG.CLUSTERING_CONFIG.CLUSTER_DISTANCE_THRESHOLDS.loose;
    }
    
    if (distance > maxDistance) {
        return false;
    }
    
    // Additional validation for corporate contacts
    if (contact1.company && contact2.company && contact1.company === contact2.company) {
        // Same company contacts should be very close
        return distance <= IMPROVED_EVENT_DETECTION_CONFIG.CLUSTERING_CONFIG.CORPORATE_CAMPUS_MODE.maxDistanceMeters;
    }
    
    return true;
}

export function detectCompanyFromLocation(latitude, longitude) {
    // Check against known company campus locations
    for (const [companyName, pattern] of Object.entries(IMPROVED_EVENT_DETECTION_CONFIG.COMPANY_PATTERNS)) {
        if (pattern.campusLocations) {
            for (const campus of pattern.campusLocations) {
                const distance = calculateDistance(latitude, longitude, campus.lat, campus.lng);
                if (distance <= campus.radius) {
                    return {
                        company: companyName,
                        campus: campus.name,
                        distance: distance,
                        confidence: distance <= campus.radius * 0.5 ? 'high' : 'medium'
                    };
                }
            }
        }
    }
    
    return null;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
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