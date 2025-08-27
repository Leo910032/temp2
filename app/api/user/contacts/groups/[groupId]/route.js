// app/api/user/contacts/groups/[groupId]/route.js - Individual Group Management
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// ✅ DELETE - Delete specific contact group
export async function DELETE(request, { params }) {
    try {
        console.log('🗑️ DELETE /api/user/contacts/groups/[groupId] - Deleting contact group');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const { groupId } = params;

        if (!groupId) {
            return NextResponse.json({ 
                error: 'Group ID is required' 
            }, { status: 400 });
        }

        // Get existing groups
        const groupsRef = adminDb.collection('ContactGroups').doc(userId);
        const groupsDoc = await groupsRef.get();

        if (!groupsDoc.exists) {
            return NextResponse.json({ 
                error: 'No groups found for user' 
            }, { status: 404 });
        }

        const existingGroups = groupsDoc.data().groups || [];
        const groupToDelete = existingGroups.find(g => g.id === groupId);

        if (!groupToDelete) {
            return NextResponse.json({ 
                error: 'Group not found' 
            }, { status: 404 });
        }

        // Remove group from array
        const updatedGroups = existingGroups.filter(g => g.id !== groupId);

        // Save to database
        await groupsRef.set({
            groups: updatedGroups,
            lastUpdated: new Date().toISOString(),
            totalGroups: updatedGroups.length
        }, { merge: true });

        console.log('✅ Contact group deleted:', {
            userId,
            groupId,
            groupName: groupToDelete.name
        });

        return NextResponse.json({
            success: true,
            deletedGroup: groupToDelete,
            message: 'Group deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting contact group:', error);
        return NextResponse.json({ 
            error: 'Failed to delete contact group' 
        }, { status: 500 });
    }
}

// ✅ GET - Get specific contact group details
export async function GET(request, { params }) {
    try {
        console.log('📋 GET /api/user/contacts/groups/[groupId] - Getting group details');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const { groupId } = params;

        if (!groupId) {
            return NextResponse.json({ 
                error: 'Group ID is required' 
            }, { status: 400 });
        }

        // Get existing groups
        const groupsRef = adminDb.collection('ContactGroups').doc(userId);
        const groupsDoc = await groupsRef.get();

        if (!groupsDoc.exists) {
            return NextResponse.json({ 
                error: 'No groups found for user' 
            }, { status: 404 });
        }

        const existingGroups = groupsDoc.data().groups || [];
        const group = existingGroups.find(g => g.id === groupId);

        if (!group) {
            return NextResponse.json({ 
                error: 'Group not found' 
            }, { status: 404 });
        }

        // Get contact details for this group
        const contactsRef = adminDb.collection('Contacts').doc(userId);
        const contactsDoc = await contactsRef.get();
        
        let groupContacts = [];
        if (contactsDoc.exists) {
            const allContacts = contactsDoc.data().contacts || [];
            groupContacts = allContacts.filter(contact => 
                group.contactIds.includes(contact.id)
            );
        }

        console.log('✅ Group details fetched:', {
            userId,
            groupId,
            groupName: group.name,
            contactCount: groupContacts.length
        });

        return NextResponse.json({
            success: true,
            group: {
                ...group,
                contacts: groupContacts
            }
        });

    } catch (error) {
        console.error('❌ Error fetching group details:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch group details' 
        }, { status: 500 });
    }
}

// ✅ PATCH - Update specific group properties
export async function PATCH(request, { params }) {
    try {
        console.log('✏️ PATCH /api/user/contacts/groups/[groupId] - Updating group');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const { groupId } = params;
        const updates = await request.json();

        if (!groupId) {
            return NextResponse.json({ 
                error: 'Group ID is required' 
            }, { status: 400 });
        }

        // Get existing groups
        const groupsRef = adminDb.collection('ContactGroups').doc(userId);
        const groupsDoc = await groupsRef.get();

        if (!groupsDoc.exists) {
            return NextResponse.json({ 
                error: 'No groups found for user' 
            }, { status: 404 });
        }

        const existingGroups = groupsDoc.data().groups || [];
        const groupIndex = existingGroups.findIndex(g => g.id === groupId);

        if (groupIndex === -1) {
            return NextResponse.json({ 
                error: 'Group not found' 
            }, { status: 404 });
        }

        // Validate updates
        const allowedUpdates = ['name', 'description', 'type', 'contactIds'];
        const filteredUpdates = {};
        
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                filteredUpdates[key] = updates[key];
            }
        });

        // Validate name if being updated
        if (filteredUpdates.name) {
            if (typeof filteredUpdates.name !== 'string' || filteredUpdates.name.trim().length === 0) {
                return NextResponse.json({ 
                    error: 'Group name must be a non-empty string' 
                }, { status: 400 });
            }

            // Check for duplicate names
            const duplicateName = existingGroups.some((group, index) => 
                index !== groupIndex && 
                group.name.toLowerCase() === filteredUpdates.name.trim().toLowerCase()
            );

            if (duplicateName) {
                return NextResponse.json({ 
                    error: 'A group with this name already exists' 
                }, { status: 409 });
            }

            filteredUpdates.name = filteredUpdates.name.trim();
        }

        // Validate contactIds if being updated
        if (filteredUpdates.contactIds) {
            if (!Array.isArray(filteredUpdates.contactIds)) {
                return NextResponse.json({ 
                    error: 'contactIds must be an array' 
                }, { status: 400 });
            }

            if (filteredUpdates.contactIds.length === 0) {
                return NextResponse.json({ 
                    error: 'Group must contain at least one contact' 
                }, { status: 400 });
            }

            // Remove duplicates
            filteredUpdates.contactIds = [...new Set(filteredUpdates.contactIds)];
        }

        // Update group
        const updatedGroup = {
            ...existingGroups[groupIndex],
            ...filteredUpdates,
            lastModified: new Date().toISOString()
        };

        // Replace in array
        const updatedGroups = [...existingGroups];
        updatedGroups[groupIndex] = updatedGroup;

        // Save to database
        await groupsRef.set({
            groups: updatedGroups,
            lastUpdated: new Date().toISOString(),
            totalGroups: updatedGroups.length
        }, { merge: true });

        console.log('✅ Contact group updated:', {
            userId,
            groupId,
            groupName: updatedGroup.name,
            updatedFields: Object.keys(filteredUpdates)
        });

        return NextResponse.json({
            success: true,
            group: updatedGroup,
            message: 'Group updated successfully'
        });

    } catch (error) {
        console.error('❌ Error updating contact group:', error);
        return NextResponse.json({ 
            error: 'Failed to update contact group' 
        }, { status: 500 });
    }
}