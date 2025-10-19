// app/api/user/contacts/groups/[groupId]/route.js

import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { GroupCRUDService } from '@/lib/services/serviceContact/server/GroupCRUDService';
import { CONTACT_FEATURES } from '@/lib/services/constants';

/**
 * Handles GET requests to fetch a single group by ID
 */
export async function GET(request, { params }) {
  console.log('🔍 GET /api/user/contacts/groups/[groupId] - Request received');

  try {
    const session = await createApiSession(request);
    console.log('✅ Session created for user:', session.userId);

    if (!session.permissions[CONTACT_FEATURES.BASIC_GROUPS]) {
      console.log('❌ Permission denied for user:', session.userId);
      return NextResponse.json({ error: 'Subscription does not include groups access' }, { status: 403 });
    }

    const { groupId } = params;
    console.log('📥 Fetching group:', groupId);

    const group = await GroupCRUDService.getGroupById({
      groupId,
      session
    });

    if (!group) {
      console.log('⚠️ Group not found:', groupId);
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    console.log('✅ Group fetched:', group.name);

    return NextResponse.json({
      success: true,
      group
    });

  } catch (error) {
    console.error('❌ API Error in GET /api/user/contacts/groups/[groupId]:', error);
    console.error('❌ Error stack:', error.stack);

    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Failed to get group',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Handles PATCH requests to update a group
 */
export async function PATCH(request, { params }) {
  console.log('🔍 PATCH /api/user/contacts/groups/[groupId] - Request received');

  try {
    const session = await createApiSession(request);
    console.log('✅ Session created for user:', session.userId);

    if (!session.permissions[CONTACT_FEATURES.BASIC_GROUPS]) {
      console.log('❌ Permission denied for user:', session.userId);
      return NextResponse.json({ error: 'Subscription does not include groups access' }, { status: 403 });
    }

    const { groupId } = params;
    const updates = await request.json();

    console.log('📝 Updating group:', groupId);
    console.log('📥 Updates:', Object.keys(updates));

    const updatedGroup = await GroupCRUDService.updateGroup({
      groupId,
      updates,
      session
    });

    console.log('✅ Group updated:', updatedGroup.name);

    return NextResponse.json({
      success: true,
      group: updatedGroup
    });

  } catch (error) {
    console.error('❌ API Error in PATCH /api/user/contacts/groups/[groupId]:', error);
    console.error('❌ Error stack:', error.stack);

    if (error.message.includes('not found')) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Failed to update group',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Handles DELETE requests to delete a single group
 */
export async function DELETE(request, { params }) {
  console.log('🔍 DELETE /api/user/contacts/groups/[groupId] - Request received');

  try {
    const session = await createApiSession(request);
    console.log('✅ Session created for user:', session.userId);

    if (!session.permissions[CONTACT_FEATURES.BASIC_GROUPS]) {
      console.log('❌ Permission denied for user:', session.userId);
      return NextResponse.json({ error: 'Subscription does not include groups access' }, { status: 403 });
    }

    const { groupId } = params;

    console.log('🗑️ Deleting group:', groupId);
    await GroupCRUDService.deleteGroup({
      groupId,
      session
    });

    console.log('✅ Group deleted:', groupId);

    return NextResponse.json({
      success: true,
      message: 'Group deleted successfully',
      groupId
    });

  } catch (error) {
    console.error('❌ API Error in DELETE /api/user/contacts/groups/[groupId]:', error);
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
