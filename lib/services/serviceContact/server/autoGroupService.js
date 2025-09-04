// lib/services/serviceContact/server/autoGroupService.js
// Server-side service dedicated to automatically generating contact groups.

import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { ContactService } from './contactService'; // We need this to get contacts
import { ContactSecurityService } from './contactSecurityService';
import { CONTACT_FEATURES, CONTACT_ACTIVITIES } from '../client/services/constants/contactConstants';

export class AutoGroupService {

  /**
   * The main method to generate automatic contact groups for a user.
   */
  static async generateAutoGroups(userId, options = {}) {
       const startTime = Date.now();
    console.log(`📊 [AutoGroupService] Starting auto-group generation for user: ${userId}`);

    try {
      console.log('�� AutoGroupService: Generating automatic groups for user:', userId);
      console.log(`🔍 [AutoGroupService] Feature access validated.`);

      // 1. Check if the user's subscription allows this feature
      await ContactService.validateFeatureAccess(userId, CONTACT_FEATURES.ADVANCED_GROUPS);

      // 2. Fetch all of the user's contacts
      const contactsResult = await ContactService.getUserContacts(userId, { limit: 1000 });
      const contacts = contactsResult.contacts;
      console.log(`🔍 [AutoGroupService] Fetched ${contacts.length} total contacts.`);

      if (contacts.length === 0) {
                console.log("🟡 [AutoGroupService] No contacts found. Aborting generation.");

        return { groups: [], message: 'No contacts found to group' };
      }

      // 3. Initialize and run the grouping logic
      const autoGroups = [];
      const {
        groupByCompany = true,
        groupByLocation = false,
        groupByEvents = false,
        minGroupSize = 2,
        maxGroups = 10
      } = options;
  console.log(`📋 [AutoGroupService] Effective options:`, { groupByCompany, groupByLocation, groupByEvents, minGroupSize, maxGroups });

      if (groupByCompany) {
                console.log(`🏢 [AutoGroupService] Processing company groups...`);

        autoGroups.push(...this.groupContactsByCompany(contacts, minGroupSize));
      }
      if (groupByLocation) {
                console.log(`📍 [AutoGroupService] Processing location groups...`);

        autoGroups.push(...this.groupContactsByLocation(contacts, minGroupSize));
      }
      if (groupByEvents) {
                console.log(`📅 [AutoGroupService] Processing event/time-based groups...`);

        autoGroups.push(...this.groupContactsByEvents(contacts, minGroupSize));
      }

      const limitedGroups = autoGroups.slice(0, maxGroups);
console.log(`✂️ [AutoGroupService] Total potential groups: ${autoGroups.length}, limited to: ${limitedGroups.length}`);
      // 4. Save the new groups to Firestore
      if (limitedGroups.length > 0) {
                  console.log(`💾 [AutoGroupService] Saving ${limitedGroups.length} new groups to Firestore...`);

          await this.saveGeneratedGroups(userId, limitedGroups);
      } else {
          console.log(`🟡 [AutoGroupService] No new groups met the criteria to be saved.`);
      }

      // 5. Log the activity
      await ContactSecurityService.logContactActivity({
        userId,
        action: CONTACT_ACTIVITIES.GROUP_CREATED, // Can create a new activity type if needed
        details: {
          type: 'auto_generation',
          groupsGenerated: limitedGroups.length,
          options
        }
      });

  const duration = Date.now() - startTime;
      console.log(`✅ [AutoGroupService] Generation completed in ${duration}ms. Created ${limitedGroups.length} groups.`);      return { groups: limitedGroups, success: true };

    } catch (error) {
const duration = Date.now() - startTime;
      console.error(`❌ [AutoGroupService] Error after ${duration}ms:`, error);
            throw error;
    }
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

  static groupContactsByCompany(contacts, minGroupSize) {
    console.log(`   L 🏢 [Company Grouping] Starting analysis of ${contacts.length} contacts.`);
    const companyMap = {};
    contacts.forEach(contact => {
      const company = contact.company?.trim();
      if (company) {
        if (!companyMap[company]) companyMap[company] = [];
        companyMap[company].push(contact.id);
        console.log(`    L ➡️ Added '${contact.name}' to potential company group '${company}'.`);
      }
    });

    return Object.entries(companyMap)
      .filter(([, ids]) => ids.length >= minGroupSize)
      .map(([company, contactIds]) => ({
        id: `auto_company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${company} Team`,
        description: `Auto-generated group for ${company} contacts`,
        type: 'auto_company',
        contactIds,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      }));
  }

    /**
   * Groups contacts by their approximate geographical location.
   */
  static groupContactsByLocation(contacts, minGroupSize) {
    console.log(`  L 📍 [Location Grouping] Starting analysis of ${contacts.length} contacts. Minimum group size: ${minGroupSize}.`);
    const locationMap = {};

    contacts.forEach(contact => {
      if (contact.location?.latitude && contact.location?.longitude) {
        // Rounding to 1 decimal place (~11km) creates broader clusters.
        // Use more decimal places (e.g., * 100 / 100) for tighter clusters.
        const lat = Math.round(contact.location.latitude * 10) / 10;
        const lng = Math.round(contact.location.longitude * 10) / 10;
        const key = `${lat},${lng}`;
        
        if (!locationMap[key]) {
          locationMap[key] = [];
        }
        locationMap[key].push(contact.id);
        
        console.log(`    L ➡️ Clustering '${contact.name}' with location [${contact.location.latitude.toFixed(4)}, ${contact.location.longitude.toFixed(4)}] into key '${key}'.`);
      } else {
        console.log(`    L ⏭️ Skipping '${contact.name}' - no location data.`);
      }
    });

    const finalGroups = Object.entries(locationMap)
      .filter(([key, contactIds]) => {
        const meetsCriteria = contactIds.length >= minGroupSize;
        if (meetsCriteria) {
            console.log(`    L ✅ Keeping location cluster '${key}' (size ${contactIds.length} >= ${minGroupSize}).`);
        } else {
            console.log(`    L 🗑️ Discarding location cluster '${key}' (size ${contactIds.length} < ${minGroupSize}).`);
        }
        return meetsCriteria;
      })
      .map(([location, contactIds], i) => {
        const groupName = `Location Group ${i + 1} (near ${location})`;
        console.log(`    L 📦 Creating final group '${groupName}' with ${contactIds.length} contacts.`);
        return {
          id: `auto_location_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: groupName,
          description: `Auto-generated group for contacts clustered near coordinates ${location}`,
          type: 'auto_location',
          contactIds,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        };
      });

    console.log(`  L 📍 [Location Grouping] Finished. Created ${finalGroups.length} valid groups.`);
    return finalGroups;
  }
  /**
   * Groups contacts by the day they were added.
   */
  static groupContactsByEvents(contacts, minGroupSize) {
    console.log(`  L 📅 [Event/Time Grouping] Starting analysis of ${contacts.length} contacts. Minimum group size: ${minGroupSize}.`);
    const eventMap = {};
    
    contacts.forEach(contact => {
      if (contact.submittedAt) {
          const date = new Date(contact.submittedAt).toISOString().split('T')[0];
          if (!eventMap[date]) {
            eventMap[date] = [];
          }
          eventMap[date].push(contact.id);
          console.log(`    L ➡️ Adding '${contact.name}' to potential date group '${date}'.`);
      } else {
          console.log(`    L ⏭️ Skipping '${contact.name}' - no submission date.`);
      }
    });

    const finalGroups = Object.entries(eventMap)
      .filter(([date, contactIds]) => {
        const meetsCriteria = contactIds.length >= minGroupSize;
        if (meetsCriteria) {
            console.log(`    L ✅ Keeping date group '${date}' (size ${contactIds.length} >= ${minGroupSize}).`);
        } else {
            console.log(`    L 🗑️ Discarding date group '${date}' (size ${contactIds.length} < ${minGroupSize}).`);
        }
        return meetsCriteria;
      })
      .map(([date, contactIds]) => {
        const groupName = `Event on ${date}`;
        console.log(`    L 📦 Creating final group '${groupName}' with ${contactIds.length} contacts.`);
        return {
          id: `auto_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: groupName,
          description: `Auto-generated group for contacts added on ${date}`,
          type: 'auto_event',
          contactIds,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        };
      });
      
    console.log(`  L 📅 [Event/Time Grouping] Finished. Created ${finalGroups.length} valid groups.`);
    return finalGroups;
  }
}
