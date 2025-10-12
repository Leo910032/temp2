// lib/services/serviceContact/server/GroupCRUDService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * A dedicated server-side service for all core Create, Read, Update, Delete (CRUD)
 * operations on contact groups.
 */
export class GroupCRUDService {

    /**
     * Fetches all groups for a given user.
     * @param {{ session: object }} { session } The authenticated user session.
     * @returns {Promise<Array>} The user's groups.
     */
    static async getAllGroups({ session }) {
        console.log('🔍 GroupCRUDService.getAllGroups - User:', session.userId);

        try {
            const contactsDoc = await adminDb.collection('Contacts').doc(session.userId).get();

            console.log('📄 Document exists:', contactsDoc.exists);

            if (!contactsDoc.exists) {
                console.log('⚠️ No contacts document found for user:', session.userId);
                return [];
            }

            const data = contactsDoc.data();
            const groups = data?.groups || [];

            console.log('✅ Found groups:', groups.length);
            if (groups.length > 0) {
                console.log('📊 Sample group:', {
                    id: groups[0].id,
                    name: groups[0].name,
                    type: groups[0].type
                });
            }

            return groups;
        } catch (error) {
            console.error('❌ Error in getAllGroups:', error);
            throw error;
        }
    }

    /**
     * Creates a new group for a user.
     * @param {{ groupData: object, session: object }} { groupData, session }
     * @returns {Promise<object>} The newly created group.
     */
    static async createGroup({ groupData, session }) {
        console.log('🔍 GroupCRUDService.createGroup - User:', session.userId);
        console.log('📥 Group data:', groupData);

        // Validate required fields
        if (!groupData.name || !groupData.name.trim()) {
            throw new Error('Invalid group data: name is required');
        }

        if (!groupData.contactIds || !Array.isArray(groupData.contactIds) || groupData.contactIds.length === 0) {
            throw new Error('Invalid group data: at least one contact is required');
        }

        // Create the new group object
        const newGroup = {
            id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: groupData.name.trim(),
            type: groupData.type || 'custom',
            description: groupData.description || '',
            contactIds: groupData.contactIds,
            createdBy: session.userId,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
        };

        // Add optional fields if present
        if (groupData.useTimeFrame) {
            newGroup.useTimeFrame = true;
            newGroup.startDate = groupData.startDate;
            newGroup.endDate = groupData.endDate;
        }

        if (groupData.eventLocation) {
            newGroup.eventLocation = groupData.eventLocation;
        }

        const contactsRef = adminDb.collection('Contacts').doc(session.userId);

        // Check if document exists
        const doc = await contactsRef.get();

        if (doc.exists) {
            // Document exists, use arrayUnion to add the group
            await contactsRef.update({
                groups: FieldValue.arrayUnion(newGroup),
                lastModified: new Date().toISOString()
            });
            console.log('✅ Group added to existing document');
        } else {
            // Document doesn't exist, create it with the first group
            await contactsRef.set({
                groups: [newGroup],
                contacts: [], // Initialize empty contacts array
                userId: session.userId,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString()
            });
            console.log('✅ New document created with group');
        }

        console.log('✅ Group created successfully:', newGroup.id);
        return newGroup;
    }

    /**
     * Updates an existing group.
     * @param {{ groupId: string, updates: object, session: object }} { groupId, updates, session }
     * @returns {Promise<object>} The updated group data.
     */
    static async updateGroup({ groupId, updates, session }) {
        console.log('🔍 GroupCRUDService.updateGroup - Group:', groupId);

        const contactsRef = adminDb.collection('Contacts').doc(session.userId);
        const contactsDoc = await contactsRef.get();

        if (!contactsDoc.exists) {
            throw new Error("User contacts document not found.");
        }

        const allGroups = contactsDoc.data().groups || [];
        let groupToUpdate = null;

        const updatedGroups = allGroups.map(group => {
            if (group.id === groupId) {
                groupToUpdate = {
                    ...group,
                    ...updates,
                    lastModified: new Date().toISOString()
                };
                return groupToUpdate;
            }
            return group;
        });

        if (!groupToUpdate) {
            throw new Error(`Group with ID ${groupId} not found.`);
        }

        await contactsRef.update({
            groups: updatedGroups,
            lastModified: new Date().toISOString()
        });

        console.log('✅ Group updated successfully:', groupId);
        return groupToUpdate;
    }

    /**
     * Deletes a group.
     * @param {{ groupId: string, session: object }} { groupId, session }
     * @returns {Promise<{success: boolean}>}
     */
    static async deleteGroup({ groupId, session }) {
        console.log('🔍 GroupCRUDService.deleteGroup - Group:', groupId);

        const contactsRef = adminDb.collection('Contacts').doc(session.userId);
        const contactsDoc = await contactsRef.get();

        if (!contactsDoc.exists) {
            console.log('⚠️ Document does not exist, group already gone');
            return { success: true };
        }

        const allGroups = contactsDoc.data().groups || [];
        const updatedGroups = allGroups.filter(group => group.id !== groupId);

        if (allGroups.length === updatedGroups.length) {
            console.warn(`Attempted to delete non-existent group ${groupId} for user ${session.userId}`);
            return { success: true };
        }

        await contactsRef.update({
            groups: updatedGroups,
            lastModified: new Date().toISOString()
        });

        console.log('✅ Group deleted successfully:', groupId);
        return { success: true };
    }
}
