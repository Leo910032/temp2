// app/api/user/contacts/groups/route.js - Enhanced Contact Groups Management API with Time Frame Support
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// ✅ GET - Fetch all contact groups for user
export async function GET(request) {
    try {
        console.log('📊 GET /api/user/contacts/groups - Fetching contact groups');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Get user's contact groups
        const groupsRef = adminDb.collection('ContactGroups').doc(userId);
        const groupsDoc = await groupsRef.get();

        if (!groupsDoc.exists) {
            return NextResponse.json({
                success: true,
                groups: [],
                totalGroups: 0
            });
        }

        const groupsData = groupsDoc.data();
        const groups = groupsData.groups || [];

        console.log('✅ Contact groups fetched:', {
            userId,
            groupCount: groups.length
        });

        return NextResponse.json({
            success: true,
            groups: groups,
            totalGroups: groups.length,
            lastUpdated: groupsData.lastUpdated
        });

    } catch (error) {
        console.error('❌ Error fetching contact groups:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch contact groups' 
        }, { status: 500 });
    }
}

// ✅ POST - Create new contact group (enhanced with time frame support)
export async function POST(request) {
    try {
        console.log('📝 POST /api/user/contacts/groups - Creating contact group');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const body = await request.json();
        const { action, group } = body;

        if (action !== 'create') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Validate group data
        if (!group || !group.name || !group.contactIds || !Array.isArray(group.contactIds)) {
            return NextResponse.json({ 
                error: 'Invalid group data. Name and contactIds are required.' 
            }, { status: 400 });
        }

        if (group.contactIds.length === 0) {
            return NextResponse.json({ 
                error: 'Group must contain at least one contact' 
            }, { status: 400 });
        }

        // Validate time frame data if provided
        if (group.timeFrame) {
            const { startDate, endDate } = group.timeFrame;
            if (!startDate || !endDate) {
                return NextResponse.json({
                    error: 'Time frame must include both start and end dates'
                }, { status: 400 });
            }
            
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return NextResponse.json({
                    error: 'Invalid date format in time frame'
                }, { status: 400 });
            }
            
            if (start >= end) {
                return NextResponse.json({
                    error: 'Start date must be before end date'
                }, { status: 400 });
            }
        }

        // Create new group object
        const newGroup = {
            id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: group.name.trim(),
            type: group.type || 'custom',
            description: group.description?.trim() || '',
            contactIds: [...new Set(group.contactIds)], // Remove duplicates
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            eventData: group.eventData || null
        };

        // Add time frame data if provided
        if (group.timeFrame) {
            newGroup.timeFrame = {
                startDate: group.timeFrame.startDate,
                endDate: group.timeFrame.endDate,
                preset: group.timeFrame.preset || 'custom',
                timezone: group.timeFrame.timezone || 'UTC'
            };
            
            // Add time frame info to description if not already included
            if (!newGroup.description.includes('from') && !newGroup.description.includes('to')) {
                const startStr = new Date(group.timeFrame.startDate).toLocaleDateString();
                const endStr = new Date(group.timeFrame.endDate).toLocaleDateString();
                newGroup.description += ` (Time-based group from ${startStr} to ${endStr})`;
            }
        }

        // Get existing groups
        const groupsRef = adminDb.collection('ContactGroups').doc(userId);
        const groupsDoc = await groupsRef.get();

        let existingGroups = [];
        if (groupsDoc.exists) {
            existingGroups = groupsDoc.data().groups || [];
        }

        // Check for duplicate group names
        if (existingGroups.some(g => g.name.toLowerCase() === newGroup.name.toLowerCase())) {
            return NextResponse.json({ 
                error: 'A group with this name already exists' 
            }, { status: 409 });
        }

        // Add new group
        const updatedGroups = [...existingGroups, newGroup];

        // Save to database
        await groupsRef.set({
            groups: updatedGroups,
            lastUpdated: new Date().toISOString(),
            totalGroups: updatedGroups.length,
            // Track time-based groups separately for analytics
            timeBasedGroups: updatedGroups.filter(g => g.timeFrame).length
        }, { merge: true });

        console.log('✅ Contact group created:', {
            userId,
            groupId: newGroup.id,
            groupName: newGroup.name,
            contactCount: newGroup.contactIds.length,
            hasTimeFrame: !!newGroup.timeFrame,
            timeFramePreset: newGroup.timeFrame?.preset
        });

        return NextResponse.json({
            success: true,
            groupId: newGroup.id,
            group: newGroup,
            message: 'Group created successfully'
        });

    } catch (error) {
        console.error('❌ Error creating contact group:', error);
        return NextResponse.json({ 
            error: 'Failed to create contact group' 
        }, { status: 500 });
    }
}

// ✅ PUT - Update existing contact group (enhanced with time frame support)
export async function PUT(request) {
    try {
        console.log('✏️ PUT /api/user/contacts/groups - Updating contact group');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const body = await request.json();
        const { action, group } = body;

        if (action !== 'update') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        if (!group || !group.id) {
            return NextResponse.json({ 
                error: 'Group ID is required for update' 
            }, { status: 400 });
        }

        // Validate time frame data if provided
        if (group.timeFrame) {
            const { startDate, endDate } = group.timeFrame;
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                
                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    return NextResponse.json({
                        error: 'Invalid date format in time frame'
                    }, { status: 400 });
                }
                
                if (start >= end) {
                    return NextResponse.json({
                        error: 'Start date must be before end date'
                    }, { status: 400 });
                }
            }
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
        const groupIndex = existingGroups.findIndex(g => g.id === group.id);

        if (groupIndex === -1) {
            return NextResponse.json({ 
                error: 'Group not found' 
            }, { status: 404 });
        }

        // Update group
        const updatedGroup = {
            ...existingGroups[groupIndex],
            ...group,
            lastModified: new Date().toISOString()
        };

        // Handle time frame updates
        if (group.timeFrame !== undefined) {
            if (group.timeFrame === null) {
                // Remove time frame
                delete updatedGroup.timeFrame;
            } else {
                // Update time frame
                updatedGroup.timeFrame = {
                    ...existingGroups[groupIndex].timeFrame,
                    ...group.timeFrame
                };
            }
        }

        // Replace in array
        const updatedGroups = [...existingGroups];
        updatedGroups[groupIndex] = updatedGroup;

        // Save to database
        await groupsRef.set({
            groups: updatedGroups,
            lastUpdated: new Date().toISOString(),
            totalGroups: updatedGroups.length,
            timeBasedGroups: updatedGroups.filter(g => g.timeFrame).length
        }, { merge: true });

        console.log('✅ Contact group updated:', {
            userId,
            groupId: group.id,
            groupName: updatedGroup.name,
            hasTimeFrame: !!updatedGroup.timeFrame
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

// ✅ DELETE - Delete contact group
export async function DELETE(request) {
    try {
        console.log('🗑️ DELETE /api/user/contacts/groups - Deleting contact group');

        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const { searchParams } = new URL(request.url);
        const groupId = searchParams.get('groupId');

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
            totalGroups: updatedGroups.length,
            timeBasedGroups: updatedGroups.filter(g => g.timeFrame).length
        }, { merge: true });

        console.log('✅ Contact group deleted:', {
            userId,
            groupId,
            groupName: groupToDelete.name
        });

        return NextResponse.json({
            success: true,
            message: 'Group deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting contact group:', error);
        return NextResponse.json({ 
            error: 'Failed to delete contact group' 
        }, { status: 500 });
    }
}