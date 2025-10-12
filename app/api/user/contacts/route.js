// app/api/user/contacts/route.js

import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { ContactCRUDService } from '@/lib/services/serviceContact/server/ContactCRUDService.js'; // ❌ WRONG PATH
import { GroupCRUDService } from '@/lib/services/serviceContact/server/GroupCRUDService';
import { CONTACT_FEATURES } from '@/lib/services/constants';

/**
 * Handles GET requests to fetch all contacts for the authenticated user.
 */
export async function GET(request) {
  console.log('🔍 GET /api/user/contacts - Request received');
  
  try {
    // 1. Authenticate and build the session object
    console.log('🔐 Creating API session...');
    const session = await createApiSession(request);
    console.log('✅ Session created for user:', session.userId);
    console.log('📋 User permissions:', session.permissions);

    // 2. Perform a high-level permission check
    console.log('🔍 Checking BASIC_CONTACTS permission:', CONTACT_FEATURES.BASIC_CONTACTS);
    console.log('👤 Has permission:', session.permissions[CONTACT_FEATURES.BASIC_CONTACTS]);
    
    if (!session.permissions[CONTACT_FEATURES.BASIC_CONTACTS]) {
      console.log('❌ Permission denied for user:', session.userId);
      return NextResponse.json({ error: 'Subscription does not include contacts access' }, { status: 403 });
    }

    // 3. Fetch contacts from service
    console.log('📥 Fetching contacts for user:', session.userId);
    const contacts = await ContactCRUDService.getAllContacts({ session });
    console.log('✅ Contacts fetched. Count:', contacts?.length || 0);

    if (contacts && contacts.length > 0) {
      console.log('📊 First contact sample:', {
        id: contacts[0].id,
        name: contacts[0].name,
        email: contacts[0].email,
        status: contacts[0].status
      });
    } else {
      console.log('⚠️ No contacts found for user:', session.userId);
    }

    // 3b. Fetch groups from service (if user has permission)
    let groups = [];
    if (session.permissions[CONTACT_FEATURES.BASIC_GROUPS]) {
      console.log('📥 Fetching groups for user:', session.userId);
      groups = await GroupCRUDService.getAllGroups({ session });
      console.log('✅ Groups fetched. Count:', groups?.length || 0);
    }

    // 4. Return response
    const response = {
      success: true,
      contacts: contacts || [],
      stats: {
        total: contacts?.length || 0,
        new: contacts?.filter(c => c.status === 'new').length || 0,
        viewed: contacts?.filter(c => c.status === 'viewed').length || 0,
        withLocation: contacts?.filter(c => c.location?.latitude).length || 0
      },
      groups: groups || [],
      pagination: {
        hasMore: false,
        lastDoc: null
      }
    };

    console.log('📤 Sending response with stats:', response.stats);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ API Error in GET /api/user/contacts:', error);
    console.error('❌ Error stack:', error.stack);
    
    if (error.message.includes('Authorization') || error.message.includes('token') || error.message.includes('User account not found')) {
      console.log('🚫 Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to get contacts',
      details: error.message // Add error details in development
    }, { status: 500 });
  }
}

/**
 * Handles POST requests to create a new contact
 */
export async function POST(request) {
  console.log('🔍 POST /api/user/contacts - Request received');
  
  try {
    const session = await createApiSession(request);
    console.log('✅ Session created for user:', session.userId);
    
    if (!session.permissions[CONTACT_FEATURES.BASIC_CONTACTS]) {
      console.log('❌ Permission denied for user:', session.userId);
      return NextResponse.json({ error: 'Subscription does not include contacts access' }, { status: 403 });
    }

    const body = await request.json();
    console.log('📥 Request body received:', Object.keys(body));
    
    // Handle both { contact: {...} } and direct contact data
    const contactData = body.contact || body;
    
    if (!contactData || !contactData.name) {
      console.log('❌ Invalid contact data:', contactData);
      return NextResponse.json({ error: 'Missing required contact data (name)' }, { status: 400 });
    }
    
    console.log('📝 Creating contact:', contactData.name);
    const newContact = await ContactCRUDService.createContact({
      contactData,
      session
    });
    
    console.log('✅ Contact created:', newContact.id);

    return NextResponse.json({
      success: true,
      contact: newContact
    }, { status: 201 });

  } catch (error) {
    console.error('❌ API Error in POST /api/user/contacts:', error);
    console.error('❌ Error stack:', error.stack);

    if (error.message.includes('Invalid contact data')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ 
      error: 'Failed to create contact',
      details: error.message 
    }, { status: 500 });
  }
}