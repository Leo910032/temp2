// lib/services/serviceContact/server/autoGroupService.js
// Server-side service dedicated to automatically generating contact groups.

import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { ContactService } from './contactService';
import { ContactSecurityService } from './contactSecurityService';
import { CONTACT_FEATURES, CONTACT_ACTIVITIES } from '../client/services/constants/contactConstants';
import { 
  isPublicEmailDomain, 
  extractEmailDomain, 
  getCompanyIdentifierFromDomain,
} from '@/lib/config/publicEmailDomains';

import { GeminiGroupingEnhancer } from './geminiGroupingEnhancer';
export class AutoGroupService {
 static async generateAutoGroups(userId, options = {}) {
    const startTime = Date.now();
    console.log(`📊 [AutoGroupService] Starting auto-group generation for user: ${userId}`);

    try {
      // Step 1: Validate feature access (this should pass for your test user)
      await ContactService.validateFeatureAccess(userId, CONTACT_FEATURES.ADVANCED_GROUPS);

      // Step 2: Fetch all of the user's contacts
      const contactsResult = await ContactService.getUserContacts(userId, { limit: 1000 });
      const contacts = contactsResult.contacts;
      console.log(`🔍 [AutoGroupService] Fetched ${contacts.length} total contacts.`);

      if (contacts.length === 0) {
        console.log("🟡 [AutoGroupService] No contacts found. Aborting generation.");
        return { groups: [], message: 'No contacts found to group' };
      }

      // Step 3: Initialize groups array
      const autoGroups = [];
      console.log(`📋 [AutoGroupService] Original options from UI (being ignored for test):`, options);

      // ========================================================================
      // TEMPORARY TEST CODE: Force AI conditions to be true
      // ========================================================================
      console.log('🧪 FORCING AI TEST RUN. UI options and real subscription are being ignored.');
      const hasAiOptions = true; // Force-enables the AI logic block
      const subscriptionLevel = 'enterprise'; // Force-enables all AI features within the enhancer
      // ========================================================================


      // Step 4: AI-Enhanced Grouping Section
      // This 'if' block will now always execute due to the hardcoded values above.
      if (hasAiOptions && subscriptionLevel) {
        console.log(`🤖 [AutoGroupService] Handing off to Gemini Enhancer for AI grouping...`);
        try {
          const enhancementResult = await GeminiGroupingEnhancer.enhanceGrouping(
            contacts, 
            subscriptionLevel, 
            userId 
          );

          if (enhancementResult.enhancedGroups.length > 0) {
            autoGroups.push(...enhancementResult.enhancedGroups);
            console.log(`✅ [AutoGroupService] Received ${enhancementResult.enhancedGroups.length} AI-enhanced groups from Gemini.`);
          } else {
            console.log('🟡 [AutoGroupService] Gemini ran successfully but did not generate any groups for this contact set.');
          }

        } catch (error) {
            console.error('❌ [AutoGroupService] Gemini Enhancer encountered an error:', error);
        }
      }

      // ========================================================================
      // Temporarily disable the old rule-based logic for a clean AI-only test
      console.log('🧪 Skipping rule-based grouping to isolate AI test results.');
      // if (options.groupByCompany) { ... }
      // if (options.groupByTime) { ... }
      // ========================================================================

      // Step 5: Process, limit, and save the results
      const uniqueGroups = Array.from(new Map(autoGroups.map(group => [group.name, group])).values());
      const limitedGroups = uniqueGroups.slice(0, options.maxGroups || 10);
      console.log(`✂️ [AutoGroupService] Total potential groups: ${uniqueGroups.length}, limited to: ${limitedGroups.length}`);

      if (limitedGroups.length > 0) {
        console.log(`💾 [AutoGroupService] Saving ${limitedGroups.length} new groups to Firestore...`);
        await this.saveGeneratedGroups(userId, limitedGroups);
      } else {
        console.log(`🟡 [AutoGroupService] No new groups met the criteria to be saved.`);
      }

      await ContactSecurityService.logContactActivity({
        userId,
        action: CONTACT_ACTIVITIES.GROUP_CREATED,
        details: {
          type: 'auto_generation_ai_test', // Note the type change for logging
          groupsGenerated: limitedGroups.length,
          options
        }
      });

      const duration = Date.now() - startTime;
      console.log(`✅ [AutoGroupService] Generation completed in ${duration}ms. Created ${limitedGroups.length} groups.`);
      
      return { groups: limitedGroups, success: true };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [AutoGroupService] Error after ${duration}ms:`, error);
      throw error;
    }
  }
/**
 * Enhanced company grouping with fuzzy matching and normalization
 */
static generateAdvancedCompanyGroups(contacts, minGroupSize) {
  console.log(`🏢 [Advanced Company Grouping] Starting analysis of ${contacts.length} contacts.`);

  const companyGroups = new Map();
  const emailDomainGroups = new Map();
  
  // Process each contact for company name and email domain analysis
  contacts.forEach(contact => {
    // Method 1: Explicit company name
    if (contact.company && contact.company.trim()) {
      const normalizedCompany = this.normalizeCompanyName(contact.company.trim());
      
      if (!companyGroups.has(normalizedCompany)) {
        companyGroups.set(normalizedCompany, {
          originalName: contact.company.trim(),
          source: 'company_name',
          contacts: [],
          confidence: 0.9
        });
      }
      companyGroups.get(normalizedCompany).contacts.push(contact);
    }
    
    // Method 2: Email domain analysis
    if (contact.email) {
      const domain = extractEmailDomain(contact.email);
      if (domain && !isPublicEmailDomain(domain)) {
        const companyId = getCompanyIdentifierFromDomain(domain);
        
        if (!emailDomainGroups.has(companyId)) {
          emailDomainGroups.set(companyId, {
            originalName: companyId,
            domain: domain,
            source: 'email_domain',
            contacts: [],
            confidence: 0.8
          });
        }
        emailDomainGroups.get(companyId).contacts.push(contact);
      }
    }
  });

  // Merge and create final groups
  const finalGroups = [];
  
  // Company name groups
  companyGroups.forEach((groupData, companyKey) => {
    if (groupData.contacts.length >= minGroupSize) {
      finalGroups.push(this.createGroup({
        type: 'rule_company',
        name: `${groupData.originalName} Team`,
        contacts: groupData.contacts,
        metadata: {
          source: 'company_name',
          confidence: groupData.confidence,
          aiGenerated: false
        }
      }));
    }
  });
  
  // Email domain groups (avoid duplicates)
  emailDomainGroups.forEach((groupData, domainKey) => {
    if (groupData.contacts.length >= minGroupSize) {
      const hasOverlap = finalGroups.some(existingGroup => {
        const overlap = groupData.contacts.filter(contact => 
          existingGroup.contactIds.includes(contact.id)
        );
        return overlap.length > 0;
      });
      
      if (!hasOverlap) {
        finalGroups.push(this.createGroup({
          type: 'rule_company_email',
          name: `${groupData.originalName} Team`,
          contacts: groupData.contacts,
          metadata: {
            source: 'email_domain',
            domain: groupData.domain,
            confidence: groupData.confidence,
            aiGenerated: false
          }
        }));
      }
    }
  });

  console.log(`🏢 Advanced company grouping completed: ${finalGroups.length} groups`);
  return finalGroups;
}

/**
 * Create a standardized group object
 */
static createGroup({ type, name, contacts, metadata }) {
  return {
    id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type,
    contactIds: contacts.map(c => c.id),
    description: `${metadata.aiGenerated ? 'AI-generated' : 'Rule-based'} group: ${name}`,
    metadata,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };
}
/**
 * Normalize company names for better matching
 */
static normalizeCompanyName(companyName) {
  return companyName
    .toLowerCase()
    .replace(/\b(inc|corp|llc|ltd|co|company|corporation|incorporated)\b\.?/gi, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Time-based grouping with smart clustering
 */
static generateTimeBasedGroups(contacts, minGroupSize) {
  console.log(`📅 [Time-Based Grouping] Processing ${contacts.length} contacts.`);
  
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

  const finalGroups = [];

  Object.entries(dateGroups).forEach(([dateKey, dayContacts]) => {
    if (dayContacts.length >= minGroupSize) {
      dayContacts.sort((a, b) => a.timestamp - b.timestamp);
      const timeClusters = this.findTimeClusters(dayContacts, minGroupSize);
      
      timeClusters.forEach(cluster => {
        const eventDate = new Date(cluster[0].timestamp);
        const formattedDate = eventDate.toLocaleDateString();
        
        finalGroups.push(this.createGroup({
          type: 'rule_time',
          name: `${formattedDate} Event`,
          contacts: cluster,
          metadata: {
            eventDate: formattedDate,
            timeSpan: (cluster[cluster.length - 1].timestamp - cluster[0].timestamp) / (1000 * 60 * 60),
            confidence: cluster.length >= 5 ? 0.9 : 0.7,
            aiGenerated: false
          }
        }));
      });
    }
  });

  console.log(`📅 Time-based grouping completed: ${finalGroups.length} groups`);
  return finalGroups;
}

/**
 * Find time clusters within a day
 */
static findTimeClusters(dayContacts, minGroupSize) {
  const clusters = [];
  const MAX_TIME_GAP = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  
  let currentCluster = [dayContacts[0]];
  
  for (let i = 1; i < dayContacts.length; i++) {
    const timeDiff = dayContacts[i].timestamp - dayContacts[i-1].timestamp;
    
    if (timeDiff <= MAX_TIME_GAP) {
      currentCluster.push(dayContacts[i]);
    } else {
      if (currentCluster.length >= minGroupSize) {
        clusters.push([...currentCluster]);
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
   * Saves the newly generated groups, replacing any previous auto-groups.
   */
  static async saveGeneratedGroups(userId, newAutoGroups) {
      const groupsDocRef = adminDb.collection('ContactGroups').doc(userId);
      const groupsDoc = await groupsDocRef.get();
      
      let existingGroups = [];
      if (groupsDoc.exists) {
          existingGroups = groupsDoc.data().groups || [];
      }

      // Filter out any old auto-generated groups
      const manualGroups = existingGroups.filter(g => 
        !g.type?.startsWith('auto_')
      );
      
      const allGroups = [...manualGroups, ...newAutoGroups];

      await groupsDocRef.set({
        groups: allGroups,
        lastUpdated: FieldValue.serverTimestamp(),
        totalGroups: allGroups.length
      }, { merge: true });
  }

  // --- HELPER METHODS FOR GROUPING LOGIC ---

  /**
   * Groups contacts by their company name.
   */

 // lib/services/serviceContact/server/autoGroupService.js
// FIXED METHOD - The issue was in the filtering logic

// lib/services/serviceContact/server/autoGroupService.js
// ENHANCED METHOD - Combines company names AND email domains like the old system

/**
 * Groups contacts by their company name and email domains (enhanced version)
 */
static groupContactsByCompany(contacts, minGroupSize) {
  console.log(`   L 🏢 [Company Grouping] Starting analysis of ${contacts.length} contacts.`);
  
  // Step 1: Group by explicit company names
  const companyMap = {};
  contacts.forEach(contact => {
    const company = contact.company?.trim();
    if (company) {
      if (!companyMap[company]) companyMap[company] = [];
      companyMap[company].push(contact.id);
      console.log(`    L ➡️ Added '${contact.name}' to potential company group '${company}'.`);
    }
  });

  // Step 2: Group by email domains (for business emails)
  const emailDomainMap = {};
  contacts.forEach(contact => {
    const email = contact.email?.trim().toLowerCase();
    if (email) {
      const domain = email.split('@')[1];
      // Only use business domains (exclude common personal email providers)
      const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'protonmail.com', 'aol.com'];
      
      if (domain && !personalDomains.includes(domain)) {
        if (!emailDomainMap[domain]) emailDomainMap[domain] = [];
        emailDomainMap[domain].push(contact.id);
        console.log(`    L ➡️ Added '${contact.name}' to potential email domain group '${domain}'.`);
      }
    }
  });

  const allGroups = [];

  // Step 3: Create company name groups
  Object.entries(companyMap)
    .filter(([company, contactIds]) => contactIds.length >= minGroupSize)
    .forEach(([company, contactIds]) => {
      console.log(`    L ✅ Creating company group '${company}' with ${contactIds.length} contacts.`);
      allGroups.push({
        id: `auto_company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${company} Team`,
        description: `Auto-generated group for ${company} contacts`,
        type: 'auto_company',
        contactIds,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      });
    });

  // Step 4: Create email domain groups (but avoid duplicates)
  const usedContactIds = new Set(allGroups.flatMap(group => group.contactIds));
  
  Object.entries(emailDomainMap)
    .filter(([domain, contactIds]) => contactIds.length >= minGroupSize)
    .forEach(([domain, contactIds]) => {
      // Only include contacts not already in a company group
      const availableContactIds = contactIds.filter(id => !usedContactIds.has(id));
      
      if (availableContactIds.length >= minGroupSize) {
        console.log(`    L ✅ Creating email domain group '${domain}' with ${availableContactIds.length} contacts.`);
        allGroups.push({
          id: `auto_company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${domain} Team`,
          description: `Auto-generated group for ${domain} contacts`,
          type: 'auto_company',
          contactIds: availableContactIds,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        });
      }
    });

  console.log(`  L 🏢 [Company Grouping] Finished. Created ${allGroups.length} valid groups.`);
  return allGroups;
}
/**
 * Helper methods for extracting data from contacts
 */
static extractLocationFromContact(contact) {
  if (contact.location) return contact.location;
  
  const locationFields = contact.details?.filter(d => 
    d.label.toLowerCase().includes('location') || 
    d.label.toLowerCase().includes('address') ||
    d.label.toLowerCase().includes('city') ||
    d.label.toLowerCase().includes('state')
  );
  
  return locationFields?.[0]?.value || null;
}

static extractEventFromContact(contact) {
  if (contact.event) return contact.event;
  
  const eventFields = contact.details?.filter(d => 
    d.label.toLowerCase().includes('event') || 
    d.label.toLowerCase().includes('conference') ||
    d.label.toLowerCase().includes('meeting') ||
    d.label.toLowerCase().includes('source')
  );
  
  return eventFields?.[0]?.value || null;
}

static normalizeLocation(location) {
  // Ensure location is a string before calling string methods
  if (typeof location !== 'string') {
    return ''; // Return an empty string for non-string inputs
  }
  return location.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}


 /**
 * Location-based grouping
 */
static groupContactsByLocation(contacts, minGroupSize) {
  console.log(`📍 [Location Grouping] Processing ${contacts.length} contacts.`);
  
  const locationGroups = {};
  
  contacts.forEach(contact => {
    const location = this.extractLocationFromContact(contact);
    if (location) {
      const locationKey = this.normalizeLocation(location);
      if (!locationGroups[locationKey]) {
        locationGroups[locationKey] = [];
      }
      locationGroups[locationKey].push(contact);
    }
  });

  const finalGroups = [];
  Object.entries(locationGroups).forEach(([location, locationContacts]) => {
    if (locationContacts.length >= minGroupSize) {
      finalGroups.push(this.createGroup({
        type: 'rule_location',
        name: `${location} Contacts`,
        contacts: locationContacts,
        metadata: {
          location: location,
          confidence: locationContacts.length >= 5 ? 0.9 : 0.7,
          aiGenerated: false
        }
      }));
    }
  });

  console.log(`📍 Location-based grouping completed: ${finalGroups.length} groups`);
  return finalGroups;
}

  /**

  /**
 * Event-based grouping
 */
static groupContactsByEvents(contacts, minGroupSize) {
  console.log(`📅 [Event Grouping] Processing ${contacts.length} contacts.`);
  
  const eventGroups = {};
  
  contacts.forEach(contact => {
    const eventInfo = this.extractEventFromContact(contact);
    if (eventInfo) {
      const eventKey = eventInfo.toLowerCase().trim();
      if (!eventGroups[eventKey]) {
        eventGroups[eventKey] = [];
      }
      eventGroups[eventKey].push(contact);
    }
  });

  const finalGroups = [];
  Object.entries(eventGroups).forEach(([event, eventContacts]) => {
    if (eventContacts.length >= minGroupSize) {
      finalGroups.push(this.createGroup({
        type: 'rule_event',
        name: `${event} Attendees`,
        contacts: eventContacts,
        metadata: {
          event: event,
          confidence: eventContacts.length >= 5 ? 0.9 : 0.7,
          aiGenerated: false
        }
      }));
    }
  });

  console.log(`📅 Event-based grouping completed: ${finalGroups.length} groups`);
  return finalGroups;
}
  /**
   * RECREATION OF OLD SYSTEM: Time-based grouping
   * This creates groups like "6/24/2025 Event" from your old logs
   */
  static generateTimeBasedGroups(contacts, minGroupSize) {
    console.log(`   L ⏰ [Time-Based Grouping] Starting analysis of ${contacts.length} contacts.`);
    
    const dateGroups = {};
    
    contacts.forEach(contact => {
      if (contact.submittedAt) {
        const date = new Date(contact.submittedAt || contact.createdAt);
        const dateKey = date.toDateString(); // This gives us the format like "Mon Jun 24 2025"
        
        if (!dateGroups[dateKey]) {
          dateGroups[dateKey] = [];
        }
        dateGroups[dateKey].push({
          ...contact,
          timestamp: date.getTime()
        });
        
        console.log(`    L ➡️ Adding '${contact.name}' to potential date group '${dateKey}'.`);
      } else {
        console.log(`    L ⏭️ Skipping '${contact.name}' - no submission date.`);
      }
    });

    const finalGroups = [];

    Object.entries(dateGroups).forEach(([dateKey, dayContacts]) => {
      if (dayContacts.length >= minGroupSize) {
        dayContacts.sort((a, b) => a.timestamp - b.timestamp);
        
        // Find contacts within 3-hour windows (like old system)
        const timeClusters = this.findTimeClustersFree(dayContacts, minGroupSize);
        
        timeClusters.forEach((cluster, index) => {
          // Format date like old system: "6/24/2025 Event"
          const eventDate = new Date(cluster[0].timestamp);
          const formattedDate = `${eventDate.getMonth() + 1}/${eventDate.getDate()}/${eventDate.getFullYear()}`;
          
          const timeGroup = {
            id: `auto_time_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${formattedDate} Event`,
            type: 'auto_time',
            contactIds: cluster.map(c => c.id),
            description: `Auto-generated group for ${cluster.length} contacts added on ${formattedDate}`,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            metadata: {
              eventDate: formattedDate,
              timeSpan: (cluster[cluster.length - 1].timestamp - cluster[0].timestamp) / (1000 * 60 * 60),
              confidence: cluster.length >= 5 ? 'high' : 'medium',
              autoGenerated: true
            }
          };
          
          finalGroups.push(timeGroup);
          
          console.log(`✅ [Time-Based Grouping] Created group: ${timeGroup.name}`, {
            contactCount: cluster.length,
            timeSpan: `${timeGroup.metadata.timeSpan.toFixed(1)} hours`
          });
        });
      } else {
        console.log(`    L 🗑️ Discarding date group '${dateKey}' (size ${dayContacts.length} < ${minGroupSize}).`);
      }
    });

    console.log(`  L ⏰ [Time-Based Grouping] Finished. Created ${finalGroups.length} valid groups.`);
    return finalGroups;
  }
/**
   * Helper: Find time clusters within 3-hour windows (OLD SYSTEM LOGIC)
   */
  static findTimeClustersFree(dayContacts, minGroupSize) {
    const clusters = [];
    let currentCluster = [dayContacts[0]];
    
    for (let i = 1; i < dayContacts.length; i++) {
      const timeDiff = (dayContacts[i].timestamp - dayContacts[i-1].timestamp) / (1000 * 60 * 60);
      
      if (timeDiff <= 3) { // 3 hour window like old system
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
 * Save generated groups to Firestore
 */
static async saveGeneratedGroups(userId, groups) {
  const batch = adminDb.batch();
  
  groups.forEach(group => {
    const groupRef = adminDb
      .collection('AccountData')
      .doc(userId)
      .collection('ContactGroups')
      .doc();
    
    batch.set(groupRef, {
      ...group,
      id: groupRef.id,
      createdAt: FieldValue.serverTimestamp(),
      lastModified: FieldValue.serverTimestamp()
    });
  });
  
  await batch.commit();
  console.log(`💾 Saved ${groups.length} groups to Firestore`);
}



}