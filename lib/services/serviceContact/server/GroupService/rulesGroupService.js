// lib/services/serviceContact/server/costTracking/rulesGroupService.js
// Complete rules-based contact grouping with all missing functionality restored

import { adminDb } from '@/lib/firebaseAdmin';
import { ContactCRUDService } from '../ContactCRUDService';
import {
  isPublicEmailDomain,
  extractEmailDomain,
  getCompanyIdentifierFromDomain,
  analyzeEmailDomain
} from '../../config/publicEmailDomains.js';

// Constants for grouping algorithms
const LOCATION_CLUSTER_THRESHOLD_KM = 0.005; // ~500m radius for location clustering
const LOCATION_MAX_RADIUS_CONFIDENCE_THRESHOLD_M = 500; // Max radius for high confidence
const TIME_CLUSTER_WINDOW_HOURS = 3; // Time window for grouping contacts by time
const EVENT_DETECTION_THRESHOLD_HOURS = 4; // Threshold for event-based grouping
const EMAIL_DOMAIN_CONFIDENCE_THRESHOLD = 0.6; // Minimum confidence for email domain grouping
const EVENT_HIGH_CONFIDENCE_MIN_CONTACTS = 5; // Minimum contacts for high confidence event
const EVENT_HIGH_CONFIDENCE_MAX_DURATION_HOURS = 8; // Maximum duration for high confidence

// Enable debug logging only in development
const DEBUG = process.env.NODE_ENV === 'development';

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
    console.log(`📋 [RulesGroupService] Starting rules-based group generation for user: ${userId}`);
    console.log(`📋 [RulesGroupService] Options:`, options);

    try {
      // Note: Feature access validation is now handled by createApiSession in the API route
      // No need to validate here - if we got this far, the user has permission

      // Get all contacts using the CRUD service
      const contacts = await ContactCRUDService.getAllContacts({
        session: session || { userId }
      });

      // Early return if insufficient contacts
      if (contacts.length < 2) {
        const message = contacts.length === 0
          ? 'No contacts found to group'
          : 'Need at least 2 contacts for grouping';
        return this._createEmptyResult(contacts.length, message, Date.now() - startTime);
      }

      const ruleGroups = [];
      const minGroupSize = options.minGroupSize || 2;
      const maxGroups = options.maxGroups || 15;

      // Rules-based grouping methods (all free, no API calls)
      if (options.groupByCompany !== false) {
        console.log(`🏢 [RulesGroupService] Processing company groups...`);
        ruleGroups.push(...this.groupContactsByCompany(contacts, minGroupSize));
      }

      if (options.groupByTime !== false) {
        console.log(`⏰ [RulesGroupService] Processing time-based groups...`);
        ruleGroups.push(...this.groupContactsByTime(contacts, minGroupSize));
      }

      if (options.groupByLocation !== false) {
        console.log(`📍 [RulesGroupService] Processing location groups...`);
        ruleGroups.push(...this.groupContactsByLocation(contacts, minGroupSize));
      }

      if (options.groupByEvents !== false) {
        console.log(`📅 [RulesGroupService] Processing event groups...`);
        ruleGroups.push(...this.groupContactsByEvents(contacts, minGroupSize));
      }

      // Remove duplicates and apply limits
      const uniqueGroups = this.deduplicateGroups(ruleGroups);
      const limitedGroups = uniqueGroups.slice(0, maxGroups);

      // Save groups if any were created
      if (limitedGroups.length > 0) {
        console.log(`💾 [RulesGroupService] Saving ${limitedGroups.length} groups...`);
        await this.saveGeneratedGroups(userId, limitedGroups);
      }

      // Note: Activity logging can be added here if needed
      // For now, we're keeping it simple as per the clean architecture pattern

      const duration = Date.now() - startTime;
      console.log(`✅ [RulesGroupService] Rules-based generation completed in ${duration}ms. Created ${limitedGroups.length} groups.`);

      return {
        success: true,
        groups: limitedGroups,
        stats: {
          totalGroups: limitedGroups.length,
          contactsProcessed: contacts.length,
          processingTimeMs: duration,
          type: 'rules_based',
          companyGroups: limitedGroups.filter(g => g.type.includes('company')).length,
          timeGroups: limitedGroups.filter(g => g.type.includes('time')).length,
          locationGroups: limitedGroups.filter(g => g.type.includes('location')).length,
          eventGroups: limitedGroups.filter(g => g.type.includes('event')).length
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [RulesGroupService] Error after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Advanced company-based grouping using both company names and email domains
   * Restored from old implementation with improvements
   */
  static groupContactsByCompany(contacts, minGroupSize) {
    console.log(`  📋 [Company Grouping] Starting analysis of ${contacts.length} contacts.`);

    // Step 1: Create company groups from explicit company names
    const companyGroups = new Map();

    // Step 2: Create email domain groups (excluding public domains)
    const emailDomainGroups = new Map();

    // Process each contact
    contacts.forEach(contact => {
      // Method 1: Explicit company name
      if (contact.company && contact.company.trim()) {
        const normalizedCompany = contact.company.trim().toLowerCase();

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

        if (DEBUG) {
          console.log('🔍 DEBUG: Added to company group', {
            contact: contact.name,
            company: normalizedCompany,
            source: 'company_name'
          });
        }
      }

      // Method 2: Email domain analysis
      if (contact.email) {
        const domain = extractEmailDomain(contact.email);
        if (domain) {
          const domainAnalysis = analyzeEmailDomain(domain);

          if (DEBUG) {
            console.log('🔍 DEBUG: Email domain analysis', {
              contact: contact.name,
              domain: domain,
              isCompanyDomain: domainAnalysis.isCompanyDomain,
              confidence: domainAnalysis.confidence
            });
          }

          // Only use email domains that are likely company domains
          if (domainAnalysis.isCompanyDomain && domainAnalysis.confidence > EMAIL_DOMAIN_CONFIDENCE_THRESHOLD) {
            const companyId = getCompanyIdentifierFromDomain(domain);
            const domainIdentifier = `domain:${companyId}`;

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

            if (DEBUG) {
              console.log('🔍 DEBUG: Added to email domain group', {
                contact: contact.name,
                domain: domain,
                companyId: companyId,
                confidence: domainAnalysis.confidence
              });
            }
          }
        }
      }
    });

    // Step 4: Merge related groups (company name + email domain from same company)
    const mergedGroups = new Map();
    const processedGroups = new Set();

    // First, add all company name groups
    companyGroups.forEach((groupData, companyKey) => {
      if (groupData.contacts.length >= minGroupSize) {
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
      if (groupData.contacts.length >= minGroupSize) {
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

            if (DEBUG) {
              console.log('🔍 DEBUG: Merged email domain into company group', {
                existingGroup: mergedKey,
                emailDomain: groupData.domain,
                addedContacts: newContacts.length,
                totalContacts: mergedGroup.allContacts.length
              });
            }
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

          if (DEBUG) {
            console.log('🔍 DEBUG: Created new email domain group', {
              domain: groupData.domain,
              contacts: groupData.contacts.length
            });
          }
        }
      }
    });

    // Step 5: Create final groups
    const finalGroups = [];
    mergedGroups.forEach((groupData, groupKey) => {
      if (groupData.allContacts.length >= minGroupSize) {
        // Remove duplicates
        const uniqueContacts = Array.from(
          new Map(groupData.allContacts.map(c => [c.id, c])).values()
        );

        const group = {
          id: `rules_company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${groupData.originalName} Team`,
          type: 'rules_company',
          contactIds: uniqueContacts.map(c => c.id),
          description: `Rules-based group for ${uniqueContacts.length} contacts from same company (${groupData.mergedSources.join(' + ')})`,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          metadata: {
            rulesGenerated: true,
            sources: groupData.mergedSources,
            emailDomain: groupData.domain || null,
            companyName: groupData.originalName,
            confidence: groupData.confidence > 0.8 ? 'high' : 'medium'
          }
        };

        finalGroups.push(group);

        if (DEBUG) {
          console.log('✅ DEBUG: Created advanced company group', {
            groupName: group.name,
            contactCount: uniqueContacts.length,
            contacts: uniqueContacts.map(c => c.name),
            sources: groupData.mergedSources,
            confidence: group.metadata.confidence
          });
        }
      }
    });

    console.log(`  📋 [Company Grouping] Finished. Created ${finalGroups.length} valid groups.`);
    return finalGroups;
  }

  /**
   * Time-based grouping - groups contacts by submission time
   * Enhanced version from old implementation
   */
  static groupContactsByTime(contacts, minGroupSize) {
    console.log(`  📋 [Time Grouping] Starting analysis of ${contacts.length} contacts.`);

    const dateGroups = {};

    contacts.forEach(contact => {
      if (contact.submittedAt || contact.createdAt) {
        const date = new Date(contact.submittedAt || contact.createdAt);
        const dateKey = date.toDateString();

        if (!dateGroups[dateKey]) {
          dateGroups[dateKey] = [];
        }
        dateGroups[dateKey].push({
          ...contact,
          timestamp: date.getTime()
        });

        console.log(`    📋 ➡️ Adding '${contact.name}' to potential date group '${dateKey}'.`);
      } else {
        console.log(`    📋 ⭐ Skipping '${contact.name}' - no submission date.`);
      }
    });

    const finalGroups = [];

    Object.entries(dateGroups).forEach(([dateKey, dayContacts]) => {
      if (dayContacts.length >= minGroupSize) {
        dayContacts.sort((a, b) => a.timestamp - b.timestamp);

        // Find contacts within 3-hour windows
        const timeClusters = this.findTimeClusters(dayContacts, minGroupSize);

        timeClusters.forEach((cluster, index) => {
          const eventDate = new Date(cluster[0].timestamp);
          const formattedDate = `${eventDate.getMonth() + 1}/${eventDate.getDate()}/${eventDate.getFullYear()}`;

          const timeGroup = {
            id: `rules_time_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${formattedDate} Event`,
            type: 'rules_time',
            contactIds: cluster.map(c => c.id),
            description: `Rules-based group for ${cluster.length} contacts added on ${formattedDate}`,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            metadata: {
              rulesGenerated: true,
              eventDate: formattedDate,
              timeSpan: (cluster[cluster.length - 1].timestamp - cluster[0].timestamp) / (1000 * 60 * 60),
              confidence: cluster.length >= EVENT_HIGH_CONFIDENCE_MIN_CONTACTS ? 'high' : 'medium'
            }
          };

          finalGroups.push(timeGroup);

          console.log(`    📋 ✅ Created time group: ${timeGroup.name} with ${cluster.length} contacts`);
        });
      } else {
        console.log(`    📋 🗑️ Discarding date group '${dateKey}' (size ${dayContacts.length} < ${minGroupSize}).`);
      }
    });

    console.log(`  📋 [Time Grouping] Finished. Created ${finalGroups.length} valid groups.`);
    return finalGroups;
  }

  /**
   * Location-based grouping using coordinate clustering
   * Enhanced from old implementation
   */
  static groupContactsByLocation(contacts, minGroupSize) {
    console.log(`  📋 [Location Grouping] Starting analysis of ${contacts.length} contacts.`);

    const contactsWithLocation = contacts.filter(c =>
      c.location?.latitude && c.location?.longitude &&
      !isNaN(c.location.latitude) && !isNaN(c.location.longitude)
    );

    if (contactsWithLocation.length < minGroupSize) {
      console.log(`  📋 [Location Grouping] Insufficient contacts with location data.`);
      return [];
    }

    // Use clustering algorithm
    const clusters = this.clusterContactsByProximity(contactsWithLocation, LOCATION_CLUSTER_THRESHOLD_KM);

    const finalGroups = clusters
      .filter(cluster => cluster.length >= minGroupSize)
      .map((cluster, index) => {
        const centerLat = cluster.reduce((sum, c) => sum + c.location.latitude, 0) / cluster.length;
        const centerLng = cluster.reduce((sum, c) => sum + c.location.longitude, 0) / cluster.length;
        const radius = this.calculateClusterRadius(cluster);

        const group = {
          id: `rules_location_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `Location Group ${index + 1}`,
          description: `Rules-based group for ${cluster.length} contacts in same geographic area`,
          type: 'rules_location',
          contactIds: cluster.map(c => c.id),
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          metadata: {
            rulesGenerated: true,
            locationData: {
              center: { lat: centerLat, lng: centerLng },
              radius: radius
            },
            confidence: radius <= LOCATION_MAX_RADIUS_CONFIDENCE_THRESHOLD_M ? 'high' : 'medium'
          }
        };

        console.log(`    📋 ✅ Created location group: ${group.name} with ${cluster.length} contacts`);
        return group;
      });

    console.log(`  📋 [Location Grouping] Finished. Created ${finalGroups.length} valid groups.`);
    return finalGroups;
  }

  /**
   * Event-based grouping using rapid submission detection
   * Enhanced from old implementation
   */
  static groupContactsByEvents(contacts, minGroupSize) {
    console.log(`  📋 [Event Grouping] Starting analysis of ${contacts.length} contacts.`);

    const eventGroups = [];
    const processedContacts = new Set();

    // Group contacts that were added in rapid succession
    const sortedContacts = contacts
      .filter(c => c.submittedAt || c.createdAt)
      .map(c => ({
        ...c,
        timestamp: new Date(c.submittedAt || c.createdAt).getTime()
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    let currentEventGroup = [];

    for (let i = 0; i < sortedContacts.length; i++) {
      const contact = sortedContacts[i];

      if (processedContacts.has(contact.id)) continue;

      // Start a new potential event group
      currentEventGroup = [contact];
      processedContacts.add(contact.id);

      // Look for contacts added soon after this one
      for (let j = i + 1; j < sortedContacts.length; j++) {
        const nextContact = sortedContacts[j];

        if (processedContacts.has(nextContact.id)) continue;

        const timeDiff = (nextContact.timestamp - contact.timestamp) / (1000 * 60 * 60); // hours

        if (timeDiff <= EVENT_DETECTION_THRESHOLD_HOURS) {
          currentEventGroup.push(nextContact);
          processedContacts.add(nextContact.id);
          console.log(`    📋 ➡️ Adding '${nextContact.name}' to event group (${timeDiff.toFixed(1)}h after first contact).`);
        } else {
          break; // Contacts are sorted, so no point checking further
        }
      }

      // If we found enough contacts for an event group, create it
      if (currentEventGroup.length >= minGroupSize) {
        const firstContact = currentEventGroup[0];
        const lastContact = currentEventGroup[currentEventGroup.length - 1];
        const eventDate = new Date(firstContact.timestamp);
        const duration = (lastContact.timestamp - firstContact.timestamp) / (1000 * 60 * 60);

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

        const eventGroup = {
          id: `rules_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${eventName} - ${eventDate.toLocaleDateString()}`,
          description: `Rules-based group for ${currentEventGroup.length} contacts from ${eventName.toLowerCase()}`,
          type: 'rules_event',
          contactIds: currentEventGroup.map(c => c.id),
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          metadata: {
            rulesGenerated: true,
            eventDate: eventDate.toISOString(),
            eventType: eventType,
            duration: duration,
            contactCount: currentEventGroup.length,
            confidence: currentEventGroup.length >= EVENT_HIGH_CONFIDENCE_MIN_CONTACTS && duration <= EVENT_HIGH_CONFIDENCE_MAX_DURATION_HOURS ? 'high' : 'medium'
          }
        };

        eventGroups.push(eventGroup);
        console.log(`    📋 📦 Created event group '${eventGroup.name}' with ${currentEventGroup.length} contacts over ${duration.toFixed(1)} hours.`);
      } else {
        console.log(`    📋 🗑️ Discarding potential event group (size ${currentEventGroup.length} < ${minGroupSize}).`);
        // Remove contacts from processed set since they weren't used
        currentEventGroup.forEach(c => processedContacts.delete(c.id));
      }
    }

    console.log(`  📋 [Event Grouping] Finished. Created ${eventGroups.length} valid event groups.`);
    return eventGroups;
  }

  // HELPER METHODS (restored from old implementation)

  /**
   * Helper: Find time clusters within 3-hour windows
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
   * Remove duplicate groups based on contact overlap
   */
  static deduplicateGroups(groups) {
    const uniqueGroups = [];
    const seenContactSets = [];

    groups.forEach(group => {
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

  /**
   * Save generated groups to Firestore
   * Enhanced error handling and validation
   */
  static async saveGeneratedGroups(userId, groups) {
    if (!userId || !groups || !Array.isArray(groups)) {
      throw new Error('Invalid parameters for saving groups');
    }

    if (groups.length === 0) {
      console.log('No groups to save');
      return { success: true, savedCount: 0 };
    }

    console.log(`💾 [RulesGroupService] Saving ${groups.length} generated groups for user ${userId}`);

    try {
      // Get user's existing groups document
      const userContactsRef = adminDb.collection('Contacts').doc(userId);

      // Use a transaction to ensure data consistency
      const result = await adminDb.runTransaction(async (transaction) => {
        const userContactsDoc = await transaction.get(userContactsRef);

        let existingGroups = [];
        if (userContactsDoc.exists) {
          const data = userContactsDoc.data();
          existingGroups = data.groups || [];
        }

        // Validate and prepare new groups
        const validatedGroups = groups.map(group => {
          // Ensure required fields
          if (!group.id || !group.name || !group.contactIds) {
            throw new Error(`Invalid group data: missing required fields in group ${group.name || 'unnamed'}`);
          }

          // Ensure proper structure
          return {
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
          };
        });

        // Check for duplicate group names and IDs
        const existingNames = new Set(existingGroups.map(g => g.name.toLowerCase()));
        const existingIds = new Set(existingGroups.map(g => g.id));

        const uniqueGroups = validatedGroups.filter(group => {
          if (existingIds.has(group.id)) {
            console.warn(`Skipping duplicate group ID: ${group.id}`);
            return false;
          }

          if (existingNames.has(group.name.toLowerCase())) {
            console.warn(`Skipping duplicate group name: ${group.name}`);
            return false;
          }

          return true;
        });

        if (uniqueGroups.length === 0) {
          console.log('All groups were duplicates, nothing to save');
          return { success: true, savedCount: 0, duplicatesSkipped: validatedGroups.length };
        }

        // Combine existing and new groups
        const allGroups = [...existingGroups, ...uniqueGroups];

        // Update the document
        if (userContactsDoc.exists) {
          transaction.update(userContactsRef, {
            groups: allGroups,
            lastModified: new Date().toISOString()
          });
        } else {
          transaction.set(userContactsRef, {
            userId: userId,
            groups: allGroups,
            contacts: [], // Initialize empty contacts array
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
          });
        }

        console.log(`✅ [RulesGroupService] Successfully saved ${uniqueGroups.length} groups for user ${userId}`);

        return {
          success: true,
          savedCount: uniqueGroups.length,
          duplicatesSkipped: validatedGroups.length - uniqueGroups.length,
          totalGroups: allGroups.length
        };
      });

      return result;

    } catch (error) {
      console.error(`❌ [RulesGroupService] Failed to save groups for user ${userId}:`, error);
      throw new Error(`Failed to save generated groups: ${error.message}`);
    }
  }
}
