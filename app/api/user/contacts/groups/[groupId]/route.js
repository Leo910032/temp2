// app/api/user/contacts/groups/[groupId]/route.js
import { NextResponse } from 'next/server';
import { ContactGroupService } from '@/lib/services/serviceContact/server/contactService';
import { adminAuth } from '@/lib/firebaseAdmin';

// GET - Get specific contact group details
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

    // Get group details from service
    const result = await ContactGroupService.getContactGroup(userId, groupId);

    console.log('✅ Group details fetched:', {
      userId,
      groupId,
      groupName: result.group.name,
      contactCount: result.group.contacts?.length || 0
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Error fetching group details:', error);
    
    if (error.message?.includes('not found')) {
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to fetch group details',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

// PATCH - Update specific group properties
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

    // Update contact group using service
    const result = await ContactGroupService.updateContactGroup(userId, groupId, updates);

    console.log('✅ Contact group updated:', {
      userId,
      groupId,
      groupName: result.group.name,
      updatedFields: Object.keys(updates)
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Error updating contact group:', error);
    
    if (error.message?.includes('not found')) {
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }
    
    if (error.message?.includes('Invalid')) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 400 });
    }
    
    if (error.message?.includes('already exists')) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 409 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to update contact group',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

// DELETE - Delete specific contact group
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

    // Delete contact group using service
    const result = await ContactGroupService.deleteContactGroup(userId, groupId);

    console.log('✅ Contact group deleted:', {
      userId,
      groupId,
      groupName: result.deletedGroup.name
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Error deleting contact group:', error);
    
    if (error.message?.includes('not found')) {
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to delete contact group',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}