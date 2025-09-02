// File: app/api/user/contacts/[contactId]/status/route.js

import { NextResponse } from 'next/server';
import { ContactService } from '@/lib/services/serviceContact/server/contactService';
import { adminAuth } from '@/lib/firebaseAdmin';

// This function will handle PATCH requests to /api/user/contacts/{contactId}/status
export async function PATCH(request, { params }) {
  try {
    const { contactId } = params;
    console.log(`🔄 API: Updating status for contact ID: ${contactId}`);

    // --- Authentication ---
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const idToken = authHeader.replace('Bearer ', '');
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }
    const userId = decodedToken.uid;
    // --- End Authentication ---

    // Get the new status from the request body
    const body = await request.json();
    const { status: newStatus } = body;

    if (!newStatus) {
      return NextResponse.json({ error: 'New status is required in the request body' }, { status: 400 });
    }

    // Use the existing service method to update the status
    const result = await ContactService.updateContactStatus(userId, contactId, newStatus);

    console.log(`✅ API: Status for contact ${contactId} updated successfully`);
    
    return NextResponse.json({
      success: true,
      contact: result.contact,
    });

  } catch (error) {
    console.error('❌ API Error updating contact status:', error);

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }
    
    if (error.message?.includes('Invalid contact status')) {
      return NextResponse.json({ error: 'Invalid status provided' }, { status: 400 });
    }

    return NextResponse.json(
      { 
        error: 'Failed to update contact status', 
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}