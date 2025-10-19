// lib/services/serviceContact/server/GroupCRUDService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * A dedicated server-side service for all core Create, Read, Update, Delete (CRUD)
 * operations on contact groups.
 *
 * NEW: Groups are now stored in a dedicated Firestore collection:
 * groups/{userId}/groups/{groupId}
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
            const groupsSnapshot = await adminDb
                .collection('groups')
                .doc(session.userId)
                .collection('groups')
                .orderBy('lastModified', 'desc')
                .get();

            console.log('📄 Groups found:', groupsSnapshot.size);

            if (groupsSnapshot.empty) {
                console.log('⚠️ No groups found for user:', session.userId);
                return [];
            }

            const groups = groupsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

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
        const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newGroup = {
            id: groupId,
            name: groupData.name.trim(),
            type: groupData.type || 'custom',
            description: groupData.description || '',
            contactIds: groupData.contactIds,
            memberCount: groupData.contactIds.length,
            createdBy: session.userId,
            createdAt: FieldValue.serverTimestamp(),
            lastModified: FieldValue.serverTimestamp(),
            metadata: groupData.metadata || {},
            tags: groupData.tags || [],
            color: groupData.color || null,
            icon: groupData.icon || null,
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

        // Save to dedicated groups collection
        const groupRef = adminDb
            .collection('groups')
            .doc(session.userId)
            .collection('groups')
            .doc(groupId);

        await groupRef.set(newGroup);

        console.log('✅ Group created successfully:', groupId);

        // Return group with ISO timestamps for consistency
        return {
            ...newGroup,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
    }

    /**
     * Updates an existing group.
     * @param {{ groupId: string, updates: object, session: object }} { groupId, updates, session }
     * @returns {Promise<object>} The updated group data.
     */
    static async updateGroup({ groupId, updates, session }) {
        console.log('🔍 GroupCRUDService.updateGroup - Group:', groupId);

        const groupRef = adminDb
            .collection('groups')
            .doc(session.userId)
            .collection('groups')
            .doc(groupId);

        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            throw new Error(`Group with ID ${groupId} not found.`);
        }

        const updateData = {
            ...updates,
            lastModified: FieldValue.serverTimestamp()
        };

        // Update memberCount if contactIds changed
        if (updates.contactIds) {
            updateData.memberCount = updates.contactIds.length;
        }

        await groupRef.update(updateData);

        console.log('✅ Group updated successfully:', groupId);

        // Fetch and return the updated group
        const updatedDoc = await groupRef.get();
        return {
            id: updatedDoc.id,
            ...updatedDoc.data()
        };
    }

    /**
     * Deletes a group.
     * @param {{ groupId: string, session: object }} { groupId, session }
     * @returns {Promise<{success: boolean}>}
     */
    static async deleteGroup({ groupId, session }) {
        console.log('🔍 GroupCRUDService.deleteGroup - Group:', groupId);

        const groupRef = adminDb
            .collection('groups')
            .doc(session.userId)
            .collection('groups')
            .doc(groupId);

        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            console.log('⚠️ Group does not exist, already deleted');
            return { success: true };
        }

        await groupRef.delete();

        console.log('✅ Group deleted successfully:', groupId);
        return { success: true };
    }

    /**
     * Deletes all groups for a user.
     * @param {{ session: object }} { session }
     * @returns {Promise<{success: boolean, count: number}>}
     */
    static async deleteAllGroups({ session }) {
        console.log('🔍 GroupCRUDService.deleteAllGroups - User:', session.userId);

        const groupsSnapshot = await adminDb
            .collection('groups')
            .doc(session.userId)
            .collection('groups')
            .get();

        if (groupsSnapshot.empty) {
            console.log('⚠️ No groups to delete');
            return { success: true, count: 0 };
        }

        const batch = adminDb.batch();
        groupsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        console.log(`✅ Deleted ${groupsSnapshot.size} groups`);
        return { success: true, count: groupsSnapshot.size };
    }

    /**
     * Saves multiple groups in a batch operation.
     * @param {{ groups: Array, session: object }} { groups, session }
     * @returns {Promise<{success: boolean, count: number}>}
     */
    static async saveGroups({ groups, session }) {
        console.log(`💾 GroupCRUDService.saveGroups - Saving ${groups.length} groups...`);

        if (!groups || groups.length === 0) {
            console.log('⚠️ No groups to save');
            return { success: true, count: 0 };
        }

        const batch = adminDb.batch();
        const groupsCollectionRef = adminDb
            .collection('groups')
            .doc(session.userId)
            .collection('groups');

        for (const group of groups) {
            const groupRef = groupsCollectionRef.doc(group.id);
            const groupData = {
                id: group.id,
                name: group.name,
                description: group.description || '',
                type: group.type,
                contactIds: group.contactIds || [],
                memberCount: (group.contactIds || []).length,
                createdBy: session.userId,
                createdAt: group.createdAt || FieldValue.serverTimestamp(),
                lastModified: FieldValue.serverTimestamp(),
                metadata: group.metadata || {},
                tags: group.tags || [],
                color: group.color || null,
                icon: group.icon || null
            };

            // Add optional fields if present
            if (group.useTimeFrame) {
                groupData.useTimeFrame = true;
                groupData.startDate = group.startDate;
                groupData.endDate = group.endDate;
            }

            if (group.eventLocation) {
                groupData.eventLocation = group.eventLocation;
            }

            batch.set(groupRef, groupData);
        }

        await batch.commit();

        console.log(`✅ Saved ${groups.length} groups`);
        return { success: true, count: groups.length };
    }

    /**
     * Fetches a single group by ID.
     * @param {{ groupId: string, session: object }} { groupId, session }
     * @returns {Promise<object|null>} The group or null if not found.
     */
    static async getGroupById({ groupId, session }) {
        console.log('🔍 GroupCRUDService.getGroupById - Group:', groupId);

        const groupDoc = await adminDb
            .collection('groups')
            .doc(session.userId)
            .collection('groups')
            .doc(groupId)
            .get();

        if (!groupDoc.exists) {
            console.log(`⚠️ Group not found: ${groupId}`);
            return null;
        }

        return {
            id: groupDoc.id,
            ...groupDoc.data()
        };
    }
}
