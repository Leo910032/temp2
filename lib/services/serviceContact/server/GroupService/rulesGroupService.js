// lib/services/serviceContact/server/GroupService/rulesGroupService.js
// Rewritten rules-based contact grouping with fixed logic and proper deduplication

import { adminDb } from '@/lib/firebaseAdmin';
import { ContactCRUDService } from '../ContactCRUDService';
import { GroupCRUDService } from '../GroupCRUDService';
import { PlacesService } from './placesService';
import {
  isPublicEmailDomain,
  extractEmailDomain,
  getCompanyIdentifierFromDomain,
  analyzeEmailDomain
} from '../../config/publicEmailDomains.js';

// Constants for grouping algorithms
const LOCATION_CLUSTER_THRESHOLD_KM = 0.1; // ~1km radius for location clustering (UPDATED from 0.5)
const LOCATION_MAX_RADIUS_CONFIDENCE_THRESHOLD_M = 500; // Max radius for high confidence
const TIME_CLUSTER_WINDOW_HOURS = 3; // Time window for grouping contacts by time
const EVENT_DETECTION_THRESHOLD_HOURS = 4; // Threshold for event-based grouping (time gap)
const EVENT_PROXIMITY_THRESHOLD_KM = 1.0; // Events must be within 1km of each other (NEW)
const EMAIL_DOMAIN_CONFIDENCE_THRESHOLD = 0.7; // Minimum confidence for email domain grouping
const EVENT_HIGH_CONFIDENCE_MIN_CONTACTS = 5; // Minimum contacts for high confidence event
const EVENT_HIGH_CONFIDENCE_MAX_DURATION_HOURS = 8; // Maximum duration for high confidence

// Constants for venue enrichment
const VENUE_ENRICHMENT_MIN_CONTACTS = 5; // Minimum contacts required for venue enrichment
const VENUE_SEARCH_RADIUS_M = 1000; // 1km search radius for nearby venues
const VENUE_KEYWORDS = {
  TIER_1: [
    'conference center',
    'convention center',
    'exhibition hall',
    'arena',
    'stadium',
    'university',
    'tech park'
  ],
  TIER_2: [
    'hotel',
    'coworking space',
    'business center',
    'auditorium'
  ],
  TIER_3_OPTIONAL: [
    'restaurant',
    'bar',
    'cafe'
  ]
};

// Enable debug logging
const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG_GROUPS === 'true';

export class RulesGroupService {
  /**
   * Helper method to create empty result response
   * @private
   */
  static _createEmptyResult(contactCount, message, processingTimeMs) {
    return {
      success: true,
      groups: [],
      message,
      stats: {
        totalGroups: 0,
        contactsProcessed: contactCount,
        processingTimeMs,
        type: 'rules_based'
      }
    };
  }

  /**
   * Generate groups using only rule-based logic (no AI)
   * Fast, synchronous, no cost tracking needed
   *
   * @param {string} userId - The user ID
   * @param {object} options - Grouping options
   * @param {object} session - The session object from createApiSession (includes permissions)
   */
  static async generateRulesBasedGroups(userId, options = {}, session = null) {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 [RulesGroupService] Starting rules-based group generation`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Options:`, JSON.stringify(options, null, 2));
    console.log(`${'='.repeat(80)}\n`);

    try {
      // Get all contacts using the CRUD service
      const contacts = await ContactCRUDService.getAllContacts({
        session: session || { userId }
      });

      console.log(`📊 Retrieved ${contacts.length} contacts for processing\n`);

      // Early return if insufficient contacts
      if (contacts.length < 2) {
        const message = contacts.length === 0
          ? 'No contacts found to group'
          : 'Need at least 2 contacts for grouping';
        console.log(`⚠️  ${message}\n`);
        return this._createEmptyResult(contacts.length, message, Date.now() - startTime);
      }

      const ruleGroups = [];
      const minGroupSize = options.minGroupSize || 2;
      const maxGroups = options.maxGroups || 15;

      console.log(`⚙️  Configuration:`);
      console.log(`   Min Group Size: ${minGroupSize}`);
      console.log(`   Max Groups: ${maxGroups}\n`);

      // Track which contacts have been assigned to groups (to prevent duplication)
      const assignedContacts = new Set();

      // Rules-based grouping methods (all free, no API calls)
      // IMPORTANT: Order matters - process from most specific to least specific

      if (options.groupByCompany !== false) {
        console.log(`🏢 [Company Grouping] Processing...`);
        const companyGroups = this.groupContactsByCompany(contacts, minGroupSize, assignedContacts);
        console.log(`   ✅ Created ${companyGroups.length} company groups\n`);
        ruleGroups.push(...companyGroups);
      }

      if (options.groupByTime !== false) {
        console.log(`⏰ [Time Grouping] Processing...`);
        const timeGroups = this.groupContactsByTime(contacts, minGroupSize, assignedContacts);
        console.log(`   ✅ Created ${timeGroups.length} time-based groups\n`);
        ruleGroups.push(...timeGroups);
      }

      if (options.groupByLocation !== false) {
        console.log(`📍 [Location Grouping] Processing...`);
        const locationGroups = this.groupContactsByLocation(contacts, minGroupSize, assignedContacts);
        console.log(`   ✅ Created ${locationGroups.length} location groups\n`);
        ruleGroups.push(...locationGroups);
      }

      if (options.groupByEvents !== false) {
        console.log(`📅 [Event Grouping] Processing...`);
        const eventGroups = this.groupContactsByEvents(contacts, minGroupSize, assignedContacts);
        console.log(`   ✅ Created ${eventGroups.length} event groups\n`);
        ruleGroups.push(...eventGroups);
      }

      console.log(`📦 Total groups before enrichment: ${ruleGroups.length}\n`);

      // Enrich eligible groups with venue information (NEW)
      if (options.enrichWithVenues !== false) {
        console.log(`🏢 [Venue Enrichment] Searching for venues...`);
        const enrichmentResult = await this.enrichGroupsWithVenues(userId, ruleGroups, contacts);
        console.log(`   ✅ Enriched ${enrichmentResult.enrichedCount} groups with venue data`);
        if (enrichmentResult.skipped > 0) {
          console.log(`   ⏭️  Skipped ${enrichmentResult.skipped} groups (not eligible or no venue found)`);
        }
        console.log();
      }

      console.log(`📦 Total groups before deduplication and selection: ${ruleGroups.length}\n`);

      // Remove duplicates based on contact overlap
      console.log(`🔍 [Deduplication] Removing duplicate/overlapping groups...`);
      const uniqueGroups = this.deduplicateGroups(ruleGroups);
      console.log(`   ✅ ${uniqueGroups.length} unique groups after deduplication\n`);

      // Select best groups if we exceed maxGroups
      let selectedGroups = uniqueGroups;
      if (uniqueGroups.length > maxGroups) {
        console.log(`✂️  [Selection] Selecting top ${maxGroups} groups from ${uniqueGroups.length}...`);
        selectedGroups = this.selectBestGroups(uniqueGroups, maxGroups);
        console.log(`   Selection criteria: size (40%), confidence (30%), type priority (30%)`);
        console.log(`   ✅ Selected ${selectedGroups.length} groups\n`);
      }

      // Save groups if any were created
      if (selectedGroups.length > 0) {
        console.log(`💾 [Saving] Saving ${selectedGroups.length} groups to database...`);
        const saveResult = await this.saveGeneratedGroups(userId, selectedGroups);
        console.log(`   ✅ Saved ${saveResult.savedCount} groups`);
        if (saveResult.duplicatesSkipped > 0) {
          console.log(`   ⚠️  Skipped ${saveResult.duplicatesSkipped} duplicate groups`);
        }
        console.log();
      }

      const duration = Date.now() - startTime;

      console.log(`${'='.repeat(80)}`);
      console.log(`✅ [RulesGroupService] Generation completed successfully`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Groups created: ${selectedGroups.length}`);
      console.log(`   Contacts processed: ${contacts.length}`);
      console.log(`   Contacts assigned to groups: ${assignedContacts.size} (${Math.round(assignedContacts.size/contacts.length*100)}%)`);
      console.log(`${'='.repeat(80)}\n`);

      return {
        success: true,
        groups: selectedGroups,
        stats: {
          totalGroups: selectedGroups.length,
          contactsProcessed: contacts.length,
          contactsGrouped: assignedContacts.size,
          coveragePercentage: Math.round((assignedContacts.size / contacts.length) * 100),
          processingTimeMs: duration,
          type: 'rules_based',
          companyGroups: selectedGroups.filter(g => g.type.includes('company')).length,
          timeGroups: selectedGroups.filter(g => g.type.includes('time')).length,
          locationGroups: selectedGroups.filter(g => g.type.includes('location')).length,
          eventGroups: selectedGroups.filter(g => g.type.includes('event')).length
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n${'='.repeat(80)}`);
      console.error(`❌ [RulesGroupService] Error after ${duration}ms:`);
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      console.error(`${'='.repeat(80)}\n`);
      throw error;
    }
  }

  /**
   * FIXED: Company-based grouping that prevents contact duplication
   *
   * Key fixes:
   * 1. Contacts can only belong to ONE company group
   * 2. Prioritizes explicit company name over email domain
   * 3. Properly calculates confidence based on data source quality
   * 4. No more generic domain pollution (e.g., company.com groups)
   */
  static groupContactsByCompany(contacts, minGroupSize, assignedContacts) {
    const startTime = Date.now();
    console.log(`   📊 Analyzing ${contacts.length} contacts for company patterns...`);

    // Step 1: Identify company for each contact (prioritize explicit company name)
    const contactCompanyMap = new Map(); // contactId -> { company, source, confidence, domain }

    contacts.forEach(contact => {
      // Skip already assigned contacts
      if (assignedContacts.has(contact.id)) {
        if (DEBUG) console.log(`   ⏭️  Skipping ${contact.name} - already assigned to a group`);
        return;
      }

      let companyInfo = null;

      // Priority 1: Explicit company name (HIGH CONFIDENCE)
      if (contact.company && contact.company.trim()) {
        const companyName = contact.company.trim();
        companyInfo = {
          identifier: companyName.toLowerCase(),
          displayName: companyName,
          source: 'company_name',
          confidence: 0.95, // Very high confidence - user provided it
          domain: null
        };

        if (DEBUG) {
          console.log(`   ✅ ${contact.name}: Company="${companyName}" (source: explicit name, confidence: 95%)`);
        }
      }

      // Priority 2: Business email domain (MEDIUM CONFIDENCE)
      if (!companyInfo && contact.email) {
        const domain = extractEmailDomain(contact.email);
        if (domain) {
          const analysis = analyzeEmailDomain(domain);

          // Only use if it's a company domain with sufficient confidence
          if (analysis.isCompanyDomain && analysis.confidence >= EMAIL_DOMAIN_CONFIDENCE_THRESHOLD) {
            const companyId = getCompanyIdentifierFromDomain(domain);
            companyInfo = {
              identifier: companyId.toLowerCase(),
              displayName: companyId,
              source: 'email_domain',
              confidence: analysis.confidence,
              domain: domain
            };

            if (DEBUG) {
              console.log(`   ✅ ${contact.name}: Company="${companyId}" (source: email domain ${domain}, confidence: ${Math.round(analysis.confidence*100)}%)`);
            }
          } else if (DEBUG) {
            console.log(`   ⏭️  ${contact.name}: Skipping generic/public domain ${domain}`);
          }
        }
      }

      if (companyInfo) {
        contactCompanyMap.set(contact.id, {
          contact: contact,
          ...companyInfo
        });
      } else if (DEBUG) {
        console.log(`   ⏭️  ${contact.name}: No valid company identifier found`);
      }
    });

    console.log(`   📊 Found company info for ${contactCompanyMap.size} contacts\n`);

    // Step 2: Group contacts by company identifier
    const companyGroups = new Map();

    contactCompanyMap.forEach((info, contactId) => {
      if (!companyGroups.has(info.identifier)) {
        companyGroups.set(info.identifier, {
          identifier: info.identifier,
          displayName: info.displayName,
          contacts: [],
          sources: new Set(),
          domains: new Set(),
          totalConfidence: 0
        });
      }

      const group = companyGroups.get(info.identifier);
      group.contacts.push(info.contact);
      group.sources.add(info.source);
      group.totalConfidence += info.confidence;
      if (info.domain) {
        group.domains.add(info.domain);
      }
    });

    console.log(`   📦 Created ${companyGroups.size} potential company groups\n`);

    // Step 3: Create final groups with proper confidence scoring
    const finalGroups = [];

    companyGroups.forEach((groupData, identifier) => {
      if (groupData.contacts.length < minGroupSize) {
        console.log(`   ⏭️  Skipping "${groupData.displayName}" - only ${groupData.contacts.length} contact(s) (min: ${minGroupSize})`);
        return;
      }

      // Calculate average confidence and determine final confidence level
      const avgConfidence = groupData.totalConfidence / groupData.contacts.length;
      const hasExplicitNames = groupData.sources.has('company_name');

      // Determine confidence level
      let confidenceLevel = 'low';
      if (hasExplicitNames && avgConfidence >= 0.85) {
        confidenceLevel = 'high';
      } else if (avgConfidence >= 0.70) {
        confidenceLevel = 'medium';
      }

      // Create group name
      let groupName = `${groupData.displayName} Team`;
      if (groupData.domains.size > 0) {
        const domainList = Array.from(groupData.domains).join(', ');
        groupName = `${groupData.displayName} (${domainList})`;
      }

      const group = {
        id: `rules_company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: groupName,
        type: 'rules_company',
        contactIds: groupData.contacts.map(c => c.id),
        description: `Company group for ${groupData.contacts.length} contacts from ${groupData.displayName}`,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        metadata: {
          rulesGenerated: true,
          companyName: groupData.displayName,
          sources: Array.from(groupData.sources),
          domains: Array.from(groupData.domains),
          confidence: confidenceLevel,
          confidenceScore: Math.round(avgConfidence * 100) / 100,
          hasExplicitCompanyNames: hasExplicitNames
        }
      };

      // Mark these contacts as assigned
      groupData.contacts.forEach(c => assignedContacts.add(c.id));

      finalGroups.push(group);

      console.log(`   ✅ Created "${group.name}"`);
      console.log(`      Contacts: ${group.contactIds.length}`);
      console.log(`      Sources: ${Array.from(groupData.sources).join(', ')}`);
      console.log(`      Confidence: ${confidenceLevel} (${Math.round(avgConfidence*100)}%)`);
      if (DEBUG) {
        console.log(`      Members: ${groupData.contacts.map(c => c.name).join(', ')}`);
      }
      console.log();
    });

    const duration = Date.now() - startTime;
    console.log(`   ⏱️  Company grouping completed in ${duration}ms`);
    console.log(`   📦 Final count: ${finalGroups.length} groups with ${assignedContacts.size} total contacts assigned\n`);

    return finalGroups;
  }

  /**
   * Time-based grouping - groups contacts by submission time
   * Only groups unassigned contacts to prevent duplication
   */
  static groupContactsByTime(contacts, minGroupSize, assignedContacts) {
    const startTime = Date.now();
    console.log(`   📊 Analyzing submission times for ${contacts.length} contacts...`);

    // Filter to only unassigned contacts with timestamps
    const unassignedContacts = contacts.filter(c =>
      !assignedContacts.has(c.id) && (c.submittedAt || c.createdAt)
    );

    if (unassignedContacts.length < minGroupSize) {
      console.log(`   ⏭️  Insufficient unassigned contacts with timestamps (${unassignedContacts.length})\n`);
      return [];
    }

    const dateGroups = {};

    unassignedContacts.forEach(contact => {
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

    console.log(`   📊 Found contacts across ${Object.keys(dateGroups).length} different days\n`);

    const finalGroups = [];

    Object.entries(dateGroups).forEach(([dateKey, dayContacts]) => {
      if (dayContacts.length < minGroupSize) {
        if (DEBUG) console.log(`   ⏭️  Skipping ${dateKey} - only ${dayContacts.length} contact(s)`);
        return;
      }

      // Sort by timestamp
      dayContacts.sort((a, b) => a.timestamp - b.timestamp);

      // Find contacts within time windows
      const timeClusters = this.findTimeClusters(dayContacts, minGroupSize);

      timeClusters.forEach((cluster, index) => {
        const eventDate = new Date(cluster[0].timestamp);
        const lastDate = new Date(cluster[cluster.length - 1].timestamp);
        const duration = (lastDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60);

        const formattedDate = `${eventDate.getMonth() + 1}/${eventDate.getDate()}/${eventDate.getFullYear()}`;

        // Calculate confidence based on cluster tightness and size
        let confidenceLevel = 'medium';
        if (cluster.length >= EVENT_HIGH_CONFIDENCE_MIN_CONTACTS && duration <= EVENT_HIGH_CONFIDENCE_MAX_DURATION_HOURS) {
          confidenceLevel = 'high';
        } else if (duration > 12 || cluster.length < 3) {
          confidenceLevel = 'low';
        }

        const timeGroup = {
          id: `rules_time_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${formattedDate} Event${timeClusters.length > 1 ? ` (${index + 1})` : ''}`,
          type: 'rules_time',
          contactIds: cluster.map(c => c.id),
          description: `Time-based group for ${cluster.length} contacts added on ${formattedDate}`,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          metadata: {
            rulesGenerated: true,
            eventDate: formattedDate,
            timeSpan: Math.round(duration * 10) / 10,
            confidence: confidenceLevel
          }
        };

        // Mark contacts as assigned
        cluster.forEach(c => assignedContacts.add(c.id));

        finalGroups.push(timeGroup);

        console.log(`   ✅ Created "${timeGroup.name}"`);
        console.log(`      Contacts: ${cluster.length}`);
        console.log(`      Duration: ${Math.round(duration * 10) / 10} hours`);
        console.log(`      Confidence: ${confidenceLevel}`);
        if (DEBUG) {
          console.log(`      Members: ${cluster.map(c => c.name).join(', ')}`);
        }
        console.log();
      });
    });

    const duration = Date.now() - startTime;
    console.log(`   ⏱️  Time grouping completed in ${duration}ms`);
    console.log(`   📦 Final count: ${finalGroups.length} groups\n`);

    return finalGroups;
  }

  /**
   * Location-based grouping using coordinate clustering
   * Only groups unassigned contacts
   */
  static groupContactsByLocation(contacts, minGroupSize, assignedContacts) {
    const startTime = Date.now();
    console.log(`   📊 Analyzing locations for ${contacts.length} contacts...`);

    const unassignedWithLocation = contacts.filter(c =>
      !assignedContacts.has(c.id) &&
      c.location?.latitude &&
      c.location?.longitude &&
      !isNaN(c.location.latitude) &&
      !isNaN(c.location.longitude)
    );

    if (unassignedWithLocation.length < minGroupSize) {
      console.log(`   ⏭️  Insufficient unassigned contacts with location data (${unassignedWithLocation.length})\n`);
      return [];
    }

    console.log(`   📊 Found ${unassignedWithLocation.length} unassigned contacts with valid locations\n`);

    // Use clustering algorithm
    const clusters = this.clusterContactsByProximity(unassignedWithLocation, LOCATION_CLUSTER_THRESHOLD_KM);

    const finalGroups = clusters
      .filter(cluster => cluster.length >= minGroupSize)
      .map((cluster, index) => {
        const centerLat = cluster.reduce((sum, c) => sum + c.location.latitude, 0) / cluster.length;
        const centerLng = cluster.reduce((sum, c) => sum + c.location.longitude, 0) / cluster.length;
        const radius = this.calculateClusterRadius(cluster);

        // Determine confidence based on cluster tightness
        let confidenceLevel = 'medium';
        if (radius <= LOCATION_MAX_RADIUS_CONFIDENCE_THRESHOLD_M && cluster.length >= 3) {
          confidenceLevel = 'high';
        } else if (radius > 1000) {
          confidenceLevel = 'low';
        }

        const group = {
          id: `rules_location_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `Location Cluster ${index + 1}`,
          description: `Location-based group for ${cluster.length} contacts within ~${Math.round(radius)}m`,
          type: 'rules_location',
          contactIds: cluster.map(c => c.id),
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          metadata: {
            rulesGenerated: true,
            locationData: {
              center: { lat: centerLat, lng: centerLng },
              radius: Math.round(radius)
            },
            confidence: confidenceLevel
          }
        };

        // Mark contacts as assigned
        cluster.forEach(c => assignedContacts.add(c.id));

        console.log(`   ✅ Created "${group.name}"`);
        console.log(`      Contacts: ${cluster.length}`);
        console.log(`      Radius: ~${Math.round(radius)}m`);
        console.log(`      Confidence: ${confidenceLevel}`);
        if (DEBUG) {
          console.log(`      Members: ${cluster.map(c => c.name).join(', ')}`);
        }
        console.log();

        return group;
      });

    const duration = Date.now() - startTime;
    console.log(`   ⏱️  Location grouping completed in ${duration}ms`);
    console.log(`   📦 Final count: ${finalGroups.length} groups\n`);

    return finalGroups;
  }

  /**
   * Event-based grouping using rapid submission detection + GPS proximity
   * ENHANCED: Now requires both time proximity AND location proximity
   * Only groups unassigned contacts with valid GPS data
   */
  static groupContactsByEvents(contacts, minGroupSize, assignedContacts) {
    const startTime = Date.now();
    console.log(`   📊 Analyzing submission patterns for ${contacts.length} contacts...`);

    // Filter for unassigned contacts with BOTH time AND location data
    const unassignedWithTimeAndLocation = contacts.filter(c =>
      !assignedContacts.has(c.id) &&
      (c.submittedAt || c.createdAt) &&
      c.location?.latitude &&
      c.location?.longitude &&
      !isNaN(c.location.latitude) &&
      !isNaN(c.location.longitude)
    );

    if (unassignedWithTimeAndLocation.length < minGroupSize) {
      console.log(`   ⏭️  Insufficient unassigned contacts with timestamps AND GPS data (${unassignedWithTimeAndLocation.length})\n`);
      return [];
    }

    console.log(`   📊 Found ${unassignedWithTimeAndLocation.length} contacts with both time and GPS data`);

    const eventGroups = [];
    const processedContacts = new Set();

    // Sort contacts by timestamp
    const sortedContacts = unassignedWithTimeAndLocation
      .map(c => ({
        ...c,
        timestamp: new Date(c.submittedAt || c.createdAt).getTime()
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    console.log(`   📊 Analyzing ${sortedContacts.length} contacts for event patterns (time + GPS)...\n`);

    let currentEventGroup = [];
    let skippedDueToDistance = 0;

    for (let i = 0; i < sortedContacts.length; i++) {
      const contact = sortedContacts[i];

      if (processedContacts.has(contact.id)) continue;

      // Start a new potential event group
      currentEventGroup = [contact];
      processedContacts.add(contact.id);

      // Look for contacts added soon after AND nearby
      for (let j = i + 1; j < sortedContacts.length; j++) {
        const nextContact = sortedContacts[j];

        if (processedContacts.has(nextContact.id)) continue;

        // Check 1: Time proximity
        const timeDiff = (nextContact.timestamp - contact.timestamp) / (1000 * 60 * 60); // hours

        if (timeDiff > EVENT_DETECTION_THRESHOLD_HOURS) {
          break; // Contacts are sorted by time, so no point checking further
        }

        // Check 2: GPS proximity (NEW REQUIREMENT)
        // Calculate distance from the FIRST contact in the event group
        const distance = this.calculateHaversineDistance(
          currentEventGroup[0].location.latitude,
          currentEventGroup[0].location.longitude,
          nextContact.location.latitude,
          nextContact.location.longitude
        );

        // Only add if within proximity threshold
        if (distance <= EVENT_PROXIMITY_THRESHOLD_KM) {
          currentEventGroup.push(nextContact);
          processedContacts.add(nextContact.id);

          if (DEBUG) {
            console.log(`   ✅ Added "${nextContact.name}" - Time: ${timeDiff.toFixed(2)}h, Distance: ${(distance * 1000).toFixed(0)}m`);
          }
        } else {
          skippedDueToDistance++;
          if (DEBUG) {
            console.log(`   ⏭️  Skipped "${nextContact.name}" - Too far (${(distance * 1000).toFixed(0)}m > ${EVENT_PROXIMITY_THRESHOLD_KM * 1000}m)`);
          }
        }
      }

      // If we found enough contacts for an event group, create it
      if (currentEventGroup.length >= minGroupSize) {
        const firstContact = currentEventGroup[0];
        const lastContact = currentEventGroup[currentEventGroup.length - 1];
        const eventDate = new Date(firstContact.timestamp);
        const duration = (lastContact.timestamp - firstContact.timestamp) / (1000 * 60 * 60);

        // Calculate geographic center and radius of the event
        const centerLat = currentEventGroup.reduce((sum, c) => sum + c.location.latitude, 0) / currentEventGroup.length;
        const centerLng = currentEventGroup.reduce((sum, c) => sum + c.location.longitude, 0) / currentEventGroup.length;
        const maxRadius = Math.max(...currentEventGroup.map(c =>
          this.calculateHaversineDistance(centerLat, centerLng, c.location.latitude, c.location.longitude)
        )) * 1000; // Convert to meters

        // Determine event type based on patterns
        let eventType = 'event';
        let eventName = 'Event';

        if (duration <= 2) {
          eventType = 'rapid_networking';
          eventName = 'Networking Event';
        } else if (currentEventGroup.length >= 10) {
          eventType = 'conference';
          eventName = 'Conference';
        } else if (duration >= 6) {
          eventType = 'multi_day_event';
          eventName = 'Multi-day Event';
        }

        // Calculate confidence (now considers both time AND location tightness)
        let confidenceLevel = 'medium';
        if (currentEventGroup.length >= EVENT_HIGH_CONFIDENCE_MIN_CONTACTS &&
            duration <= EVENT_HIGH_CONFIDENCE_MAX_DURATION_HOURS &&
            maxRadius <= 500) { // High confidence if within 500m
          confidenceLevel = 'high';
        } else if (duration > 12 || currentEventGroup.length < 3 || maxRadius > 1000) {
          confidenceLevel = 'low';
        }

        const eventGroup = {
          id: `rules_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${eventName} - ${eventDate.toLocaleDateString()}`,
          description: `Event-based group for ${currentEventGroup.length} contacts (time + GPS verified)`,
          type: 'rules_event',
          contactIds: currentEventGroup.map(c => c.id),
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          metadata: {
            rulesGenerated: true,
            eventDate: eventDate.toISOString(),
            eventType: eventType,
            duration: Math.round(duration * 10) / 10,
            contactCount: currentEventGroup.length,
            confidence: confidenceLevel,
            // NEW: Location metadata for events
            locationData: {
              center: { lat: centerLat, lng: centerLng },
              radius: Math.round(maxRadius)
            },
            requiresGPS: true // Flag indicating this group required GPS verification
          }
        };

        // Mark contacts as assigned
        currentEventGroup.forEach(c => assignedContacts.add(c.id));

        eventGroups.push(eventGroup);

        console.log(`   ✅ Created "${eventGroup.name}"`);
        console.log(`      Type: ${eventType}`);
        console.log(`      Contacts: ${currentEventGroup.length}`);
        console.log(`      Duration: ${Math.round(duration * 10) / 10} hours`);
        console.log(`      GPS Radius: ~${Math.round(maxRadius)}m`);
        console.log(`      Confidence: ${confidenceLevel}`);
        if (DEBUG) {
          console.log(`      Members: ${currentEventGroup.map(c => c.name).join(', ')}`);
        }
        console.log();
      } else {
        // Remove contacts from processed set since they weren't used
        currentEventGroup.forEach(c => processedContacts.delete(c.id));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`   ⏱️  Event grouping completed in ${duration}ms`);
    console.log(`   📦 Final count: ${eventGroups.length} groups`);
    if (skippedDueToDistance > 0) {
      console.log(`   ℹ️  Skipped ${skippedDueToDistance} contacts due to GPS distance > ${EVENT_PROXIMITY_THRESHOLD_KM}km`);
    }
    console.log();

    return eventGroups;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Find time clusters within specified window
   */
  static findTimeClusters(dayContacts, minGroupSize) {
    const clusters = [];
    let currentCluster = [dayContacts[0]];

    for (let i = 1; i < dayContacts.length; i++) {
      const timeDiff = (dayContacts[i].timestamp - dayContacts[i-1].timestamp) / (1000 * 60 * 60);

      if (timeDiff <= TIME_CLUSTER_WINDOW_HOURS) {
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

  /**
   * Cluster contacts by geographic proximity
   */
  static clusterContactsByProximity(contacts, threshold) {
    const clusters = [];
    const used = new Set();

    contacts.forEach(contact => {
      if (used.has(contact.id)) return;

      const cluster = [contact];
      used.add(contact.id);

      contacts.forEach(otherContact => {
        if (used.has(otherContact.id)) return;

        const distance = this.calculateHaversineDistance(
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

  /**
   * Calculate distance between two geographic points using Haversine formula
   */
  static calculateHaversineDistance(lat1, lon1, lat2, lon2) {
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

  /**
   * Calculate radius of a geographic cluster
   */
  static calculateClusterRadius(cluster) {
    if (cluster.length < 2) return 0;

    const centerLat = cluster.reduce((sum, c) => sum + c.location.latitude, 0) / cluster.length;
    const centerLng = cluster.reduce((sum, c) => sum + c.location.longitude, 0) / cluster.length;

    let maxDistance = 0;
    cluster.forEach(contact => {
      const distance = this.calculateHaversineDistance(
        centerLat, centerLng,
        contact.location.latitude, contact.location.longitude
      ) * 1000; // Convert to meters
      maxDistance = Math.max(maxDistance, distance);
    });

    return maxDistance;
  }

  /**
   * FIXED: Remove duplicate groups based on contact overlap
   * Now properly handles partial overlaps
   */
  static deduplicateGroups(groups) {
    const uniqueGroups = [];
    const seenContactSets = [];

    // Sort by confidence and size (keep better quality groups)
    const sortedGroups = [...groups].sort((a, b) => {
      const confScore = (g) => {
        const confMap = { 'high': 3, 'medium': 2, 'low': 1 };
        return confMap[g.metadata?.confidence || 'medium'];
      };

      const scoreA = confScore(a) * 100 + a.contactIds.length;
      const scoreB = confScore(b) * 100 + b.contactIds.length;
      return scoreB - scoreA;
    });

    sortedGroups.forEach(group => {
      const contactSet = new Set(group.contactIds);

      // Check for significant overlap with existing groups
      const hasSignificantOverlap = seenContactSets.some(existingSet => {
        const intersection = new Set([...contactSet].filter(id => existingSet.has(id)));
        const overlapPercentage = intersection.size / Math.min(contactSet.size, existingSet.size);
        return overlapPercentage > 0.7; // 70% overlap threshold
      });

      if (!hasSignificantOverlap) {
        uniqueGroups.push(group);
        seenContactSets.push(contactSet);

        if (DEBUG) {
          console.log(`   ✅ Kept group "${group.name}" (${group.contactIds.length} contacts, ${group.metadata?.confidence || 'medium'} confidence)`);
        }
      } else if (DEBUG) {
        console.log(`   🗑️  Removed duplicate "${group.name}" (significant overlap with existing group)`);
      }
    });

    return uniqueGroups;
  }

  /**
   * FIXED: Select best groups when exceeding maxGroups limit
   * Now uses transparent scoring criteria
   */
  static selectBestGroups(groups, maxGroups) {
    // Score each group based on multiple factors
    const scoredGroups = groups.map(group => {
      const confMap = { 'high': 1.0, 'medium': 0.7, 'low': 0.4 };
      const typeMap = {
        'rules_company': 1.0,  // Highest priority
        'rules_event': 0.9,
        'rules_time': 0.8,
        'rules_location': 0.7
      };

      const confidenceScore = confMap[group.metadata?.confidence || 'medium'];
      const sizeScore = Math.min(group.contactIds.length / 10, 1.0); // Normalize to 0-1, cap at 10
      const typeScore = typeMap[group.type] || 0.5;

      // Weighted scoring: size (40%), confidence (30%), type (30%)
      const totalScore = (sizeScore * 0.4) + (confidenceScore * 0.3) + (typeScore * 0.3);

      return {
        group,
        score: totalScore,
        breakdown: {
          size: Math.round(sizeScore * 100),
          confidence: Math.round(confidenceScore * 100),
          type: Math.round(typeScore * 100)
        }
      };
    });

    // Sort by score and take top maxGroups
    scoredGroups.sort((a, b) => b.score - a.score);
    const selected = scoredGroups.slice(0, maxGroups);

    if (DEBUG) {
      console.log(`\n   📊 Group Selection Scores:`);
      selected.forEach(({ group, score, breakdown }, index) => {
        console.log(`   ${index + 1}. "${group.name}" - Score: ${Math.round(score * 100)}/100`);
        console.log(`      Size: ${breakdown.size}/100, Confidence: ${breakdown.confidence}/100, Type: ${breakdown.type}/100`);
      });
      console.log();
    }

    return selected.map(s => s.group);
  }

  /**
   * UPDATED: Save generated groups to dedicated Firestore collection
   * Now uses GroupCRUDService and checks for duplicates BEFORE saving
   */
  static async saveGeneratedGroups(userId, groups) {
    if (!userId || !groups || !Array.isArray(groups)) {
      throw new Error('Invalid parameters for saving groups');
    }

    if (groups.length === 0) {
      console.log('   ℹ️  No groups to save');
      return { success: true, savedCount: 0 };
    }

    try {
      // Get existing groups from new collection structure
      const existingGroups = await GroupCRUDService.getAllGroups({
        session: { userId }
      });

      // Check for duplicates BEFORE saving
      const existingNames = new Set(existingGroups.map(g => g.name.toLowerCase()));
      const existingIds = new Set(existingGroups.map(g => g.id));

      const uniqueGroups = groups.filter(group => {
        if (existingIds.has(group.id)) {
          console.log(`   ⚠️  Skipping duplicate group ID: ${group.id}`);
          return false;
        }

        if (existingNames.has(group.name.toLowerCase())) {
          console.log(`   ⚠️  Skipping duplicate group name: ${group.name}`);
          return false;
        }

        return true;
      });

      if (uniqueGroups.length === 0) {
        console.log('   ⚠️  All groups were duplicates, nothing to save');
        return {
          success: true,
          savedCount: 0,
          duplicatesSkipped: groups.length,
          totalGroups: existingGroups.length
        };
      }

      // Validate and prepare new groups
      const validatedGroups = uniqueGroups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description || '',
        type: group.type || 'rules_generated',
        contactIds: Array.isArray(group.contactIds) ? group.contactIds : [],
        createdAt: group.createdAt || new Date().toISOString(),
        lastModified: group.lastModified || new Date().toISOString(),
        metadata: {
          ...group.metadata,
          rulesGenerated: true,
          savedAt: new Date().toISOString()
        }
      }));

      // Save using GroupCRUDService (uses batch operations for efficiency)
      const saveResult = await GroupCRUDService.saveGroups({
        groups: validatedGroups,
        session: { userId }
      });

      return {
        success: true,
        savedCount: saveResult.count,
        duplicatesSkipped: groups.length - uniqueGroups.length,
        totalGroups: existingGroups.length + saveResult.count
      };

    } catch (error) {
      console.error(`   ❌ Failed to save groups for user ${userId}:`, error);
      throw new Error(`Failed to save generated groups: ${error.message}`);
    }
  }

  /**
   * Enrich eligible groups with venue information using Google Maps Nearby Search.
   * This method modifies groups in-place if a venue is found.
   *
   * @param {string} userId - User ID for cost tracking
   * @param {Array} groups - Array of group objects to potentially enrich
   * @param {Array} contacts - Array of all contacts (to get GPS data)
   * @returns {Promise<Object>} Enrichment statistics
   */
  static async enrichGroupsWithVenues(userId, groups, contacts) {
    let enrichedCount = 0;
    let skipped = 0;

    console.log(`   🔍 Analyzing ${groups.length} groups for venue enrichment eligibility...`);

    // Filter for eligible groups (location/event with 5+ contacts)
    const eligibleGroups = groups.filter(group => {
      const isLocationOrEvent = group.type === 'rules_location' || group.type === 'rules_event';
      const hasEnoughContacts = group.contactIds && group.contactIds.length >= VENUE_ENRICHMENT_MIN_CONTACTS;
      const notAlreadyEnriched = !group.metadata?.enriched;

      if (DEBUG && isLocationOrEvent && !hasEnoughContacts) {
        console.log(`   ⏭️  Skipping ${group.name} - only ${group.contactIds?.length || 0} contacts (need ${VENUE_ENRICHMENT_MIN_CONTACTS})`);
      }

      return isLocationOrEvent && hasEnoughContacts && notAlreadyEnriched;
    });

    console.log(`   ✅ Found ${eligibleGroups.length} eligible groups for venue enrichment\n`);

    if (eligibleGroups.length === 0) {
      return { enrichedCount: 0, skipped: groups.length };
    }

    // Create contact ID lookup for quick access
    const contactMap = new Map(contacts.map(c => [c.id, c]));

    // Process each eligible group
    for (const group of eligibleGroups) {
      try {
        // Get contacts for this group
        const groupContacts = group.contactIds
          .map(id => contactMap.get(id))
          .filter(c => c); // Remove any undefined contacts

        // Calculate centroid from GPS coordinates
        const centroid = this._calculateCentroid(groupContacts);

        if (!centroid) {
          console.log(`   ⏭️  Skipping ${group.name} - no valid GPS coordinates`);
          skipped++;
          continue;
        }

        // Calculate average timestamp for logging
        const avgTimestamp = this._calculateAverageTimestamp(groupContacts);

        console.log(`   🔍 Searching venues for: ${group.name}`);
        console.log(`      Centroid: ${centroid.lat.toFixed(6)}, ${centroid.lng.toFixed(6)}`);
        console.log(`      Contacts: ${groupContacts.length}`);

        // Build keyword list (Tier 1 + Tier 2, optionally Tier 3)
        const keywords = [
          ...VENUE_KEYWORDS.TIER_1,
          ...VENUE_KEYWORDS.TIER_2
          // Tier 3 is optional - currently excluded for better precision
        ];

        // Search for nearby venues using PlacesService
        const searchResult = await PlacesService.searchNearbyVenues(userId, {
          latitude: centroid.lat,
          longitude: centroid.lng,
          radius: VENUE_SEARCH_RADIUS_M,
          keywords,
          sessionId: null // No session tracking for batch enrichment
        });

        // If venue found, enrich the group
        if (searchResult.success && searchResult.venue) {
          const venue = searchResult.venue;

          // Extract venue name (remove common suffixes)
          const venueName = this._cleanVenueName(venue.name);

          // Create new group name
          const newName = group.type === 'rules_event'
            ? `${venueName} Event`
            : `${venueName} Location`;

          // Update group in-place
          group.name = newName;
          group.metadata = {
            ...group.metadata,
            venue: {
              name: venue.name,
              address: venue.address,
              placeId: venue.placeId,
              location: venue.location,
              types: venue.types,
              distance: venue.distance,
              matchedKeyword: venue.matchedKeyword
            },
            enriched: true,
            enrichedAt: new Date().toISOString(),
            centroid,
            averageTimestamp: avgTimestamp
          };

          console.log(`      ✅ Enriched as: "${newName}" (venue: ${venue.name}, ${(venue.distance * 1000).toFixed(0)}m away)`);
          enrichedCount++;
        } else {
          console.log(`      ⏭️  No venue found`);
          skipped++;
        }

      } catch (error) {
        console.error(`      ❌ Error enriching group ${group.name}:`, error.message);
        skipped++;
        // Continue processing other groups
      }
    }

    return {
      enrichedCount,
      skipped,
      total: eligibleGroups.length
    };
  }

  /**
   * Calculate geographic centroid from contacts with GPS data.
   * @private
   */
  static _calculateCentroid(contacts) {
    const validContacts = contacts.filter(c =>
      c.location?.latitude &&
      c.location?.longitude &&
      !isNaN(c.location.latitude) &&
      !isNaN(c.location.longitude)
    );

    if (validContacts.length === 0) {
      return null;
    }

    const sum = validContacts.reduce((acc, contact) => {
      acc.lat += contact.location.latitude;
      acc.lng += contact.location.longitude;
      return acc;
    }, { lat: 0, lng: 0 });

    return {
      lat: sum.lat / validContacts.length,
      lng: sum.lng / validContacts.length
    };
  }

  /**
   * Calculate average timestamp from contacts.
   * @private
   */
  static _calculateAverageTimestamp(contacts) {
    const validTimestamps = contacts
      .map(c => {
        const timestamp = c.submittedAt || c.createdAt;
        return timestamp ? new Date(timestamp).getTime() : null;
      })
      .filter(t => t !== null);

    if (validTimestamps.length === 0) {
      return null;
    }

    const avgTime = validTimestamps.reduce((sum, t) => sum + t, 0) / validTimestamps.length;
    return new Date(avgTime).toISOString();
  }

  /**
   * Clean venue name by removing suffixes and formatting.
   * @private
   */
  static _cleanVenueName(venueName) {
    return venueName
      .replace(/\s*-\s*.*$/, '') // Remove everything after dash
      .trim();
  }
}
