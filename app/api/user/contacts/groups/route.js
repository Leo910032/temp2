// app/api/user/contacts/groups/route.js

import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { GroupCRUDService } from '@/lib/services/serviceContact/server/GroupCRUDService';
import { CONTACT_FEATURES } from '@/lib/services/constants';

/**
 * Handles GET requests to fetch all groups for the authenticated user.
 */
export async function GET(request) {
  console.log('🔍 GET /api/user/contacts/groups - Request received');

  try {
    // 1. Authenticate and build the session object
    console.log('🔐 Creating API session...');
    const session = await createApiSession(request);
    console.log('✅ Session created for user:', session.userId);
    console.log('📋 User permissions:', session.permissions);

    // 2. Perform a high-level permission check
    console.log('🔍 Checking BASIC_GROUPS permission:', CONTACT_FEATURES.BASIC_GROUPS);
    console.log('👤 Has permission:', session.permissions[CONTACT_FEATURES.BASIC_GROUPS]);

    if (!session.permissions[CONTACT_FEATURES.BASIC_GROUPS]) {
      console.log('❌ Permission denied for user:', session.userId);
      return NextResponse.json({ error: 'Subscription does not include groups access' }, { status: 403 });
    }

    // 3. Fetch groups from service
    console.log('📥 Fetching groups for user:', session.userId);
    const groups = await GroupCRUDService.getAllGroups({ session });
    console.log('✅ Groups fetched. Count:', groups?.length || 0);

    if (groups && groups.length > 0) {
      console.log('📊 First group sample:', {
        id: groups[0].id,
        name: groups[0].name,
        type: groups[0].type,
        contactCount: groups[0].contactIds?.length || 0
      });
    } else {
      console.log('⚠️ No groups found for user:', session.userId);
    }

    // 4. Return response
    const response = {
      success: true,
      groups: groups || []
    };

    console.log('📤 Sending response with groups count:', response.groups.length);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ API Error in GET /api/user/contacts/groups:', error);
    console.error('❌ Error stack:', error.stack);

    if (error.message.includes('Authorization') || error.message.includes('token') || error.message.includes('User account not found')) {
      console.log('🚫 Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Failed to get groups',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Handles POST requests to create a new group
 */
export async function POST(request) {
  console.log('🔍 POST /api/user/contacts/groups - Request received');

  try {
    const session = await createApiSession(request);
    console.log('✅ Session created for user:', session.userId);

    if (!session.permissions[CONTACT_FEATURES.BASIC_GROUPS]) {
      console.log('❌ Permission denied for user:', session.userId);
      return NextResponse.json({ error: 'Subscription does not include groups access' }, { status: 403 });
    }

    const body = await request.json();
    console.log('📥 Request body received:', Object.keys(body));

    // Handle both { group: {...} } and direct group data
    const groupData = body.group || body;

    if (!groupData || !groupData.name) {
      console.log('❌ Invalid group data:', groupData);
      return NextResponse.json({ error: 'Missing required group data (name)' }, { status: 400 });
    }

    if (!groupData.contactIds || !Array.isArray(groupData.contactIds) || groupData.contactIds.length === 0) {
      console.log('❌ Invalid contact IDs:', groupData.contactIds);
      return NextResponse.json({ error: 'At least one contact is required' }, { status: 400 });
    }

    console.log('📝 Creating group:', groupData.name);
    const newGroup = await GroupCRUDService.createGroup({
      groupData,
      session
    });

    console.log('✅ Group created:', newGroup.id);

    return NextResponse.json({
      success: true,
      group: newGroup
    }, { status: 201 });

  } catch (error) {
    console.error('❌ API Error in POST /api/user/contacts/groups:', error);
    console.error('❌ Error stack:', error.stack);

    if (error.message.includes('Invalid group data')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Failed to create group',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Handles DELETE requests to delete a group or all groups
 */
export async function DELETE(request) {
  console.log('🔍 DELETE /api/user/contacts/groups - Request received');

  try {
    const session = await createApiSession(request);
    console.log('✅ Session created for user:', session.userId);

    if (!session.permissions[CONTACT_FEATURES.BASIC_GROUPS]) {
      console.log('❌ Permission denied for user:', session.userId);
      return NextResponse.json({ error: 'Subscription does not include groups access' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    // If no groupId provided, delete all groups
    if (!groupId) {
      console.log('🗑️ Deleting all groups for user:', session.userId);
      const result = await GroupCRUDService.deleteAllGroups({ session });

      console.log(`✅ Deleted ${result.count} groups`);

      return NextResponse.json({
        success: true,
        message: 'All groups deleted successfully',
        deletedCount: result.count
      });
    }

    // Delete single group
    console.log('🗑️ Deleting group:', groupId);
    await GroupCRUDService.deleteGroup({
      groupId,
      session
    });

    console.log('✅ Group deleted:', groupId);

    return NextResponse.json({
      success: true,
      message: 'Group deleted successfully'
    });

  } catch (error) {
    console.error('❌ API Error in DELETE /api/user/contacts/groups:', error);
    console.error('❌ Error stack:', error.stack);

    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Failed to delete group',
      details: error.message
    }, { status: 500 });
  }
}
