// app/api/contacts/route.js
// Main contacts API route following enterprise pattern

import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebaseAdmin'; // Assuming this is your admin auth helper
import { ContactService } from '@/lib/services/serviceContact/server/contactService';

/**
 * GET /api/contacts - Get user's contacts with filtering
 */
export async function GET(request) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const filters = {
      status: searchParams.get('status') || 'all',
      search: searchParams.get('search') || '',
      limit: parseInt(searchParams.get('limit')) || 100,
      offset: parseInt(searchParams.get('offset')) || 0
    };

    // 3. Call the service to get contacts
    const result = await ContactService.getUserContacts(userId, filters);

    // 4. Return the result
    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Error in GET /api/contacts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get contacts', success: false }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/contacts - Create a new contact or perform bulk operations.
 */
export async function POST(request) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    // 2. Parse request body
    const body = await request.json();
    const { action } = body;

    let result;

    // 3. ✅ Use a switch statement to handle different actions
    switch (action) {
      case 'create':
        // Handle creating a single contact
        if (!body.contact) {
          return NextResponse.json({ error: 'Contact data is required for "create" action' }, { status: 400 });
        }
        result = await ContactService.createContact(userId, body.contact);
        break;

      case 'bulkUpdate':
        // Handle updating multiple contacts at once
        if (!body.contactIds || !body.updates) {
          return NextResponse.json({ error: 'Contact IDs and updates are required for "bulkUpdate" action' }, { status: 400 });
        }
        result = await ContactService.bulkUpdateContacts(userId, body.contactIds, body.updates);
        break;
        
      case 'import':
        // Handle importing multiple contacts from a file/data
        if (!body.contacts || !Array.isArray(body.contacts)) {
            return NextResponse.json({ error: 'An array of contacts is required for "import" action' }, { status: 400 });
        }
        result = await ContactService.importContacts(userId, body.contacts, body.source || 'import');
        break;

      default:
        // If the action is missing or invalid, return an error
        return NextResponse.json({ error: 'Invalid or missing action specified. Must be "create", "bulkUpdate", or "import".' }, { status: 400 });
    }

    // 4. Return the result from the service call
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error in POST /api/contacts:', error);
    
    // 5. Handle specific error types for better client-side feedback
    let status = 500;
    let errorMessage = error.message || 'Failed to process contact operation';

    if (error.message?.includes('limit') || error.message?.includes('subscription')) {
      status = 402; // Payment Required
    } else if (error.message?.includes('Invalid') || error.message?.includes('required')) {
      status = 400; // Bad Request
    }

    return NextResponse.json(
      { error: errorMessage, success: false }, 
      { status }
    );
  }
}