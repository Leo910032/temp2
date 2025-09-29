/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

// File: app/api/user/contacts/[contactId]/route.js

import { NextResponse } from 'next/server';
import { ContactService } from '@/lib/services/serviceContact/server/ContactCRUDService';
import { adminAuth } from '@/lib/firebaseAdmin';

// --- Your existing PUT function is here ---
export async function PUT(request, { params }) {
  // ... no changes needed here
  try {
    const { contactId } = params;
    console.log(`📝 API: Updating contact with ID: ${contactId}`);

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

    const body = await request.json();
    const updates = body.contact; 

    if (!updates) {
      return NextResponse.json({ error: 'Invalid update payload. Expected a "contact" object.' }, { status: 400 });
    }

    const result = await ContactService.updateContact(userId, contactId, updates);

    console.log(`✅ API: Contact ${contactId} updated successfully`);
    
    return NextResponse.json({
      success: true,
      contact: result.contact,
    });

  } catch (error) {
    console.error('❌ API Error updating contact:', error);
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }
    return NextResponse.json(
      { 
        error: 'Failed to update contact', 
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// ✅ ADD THIS DELETE HANDLER TO THE SAME FILE
export async function DELETE(request, { params }) {
  try {
    const { contactId } = params;
    console.log(`🗑️ API: Deleting contact with ID: ${contactId}`);

    // --- Authentication (same as PUT) ---
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

    // Call the service to delete the contact
    await ContactService.deleteContact(userId, contactId);

    console.log(`✅ API: Contact ${contactId} deleted successfully`);

    // Return a success response
    return NextResponse.json({
      success: true,
      message: `Contact ${contactId} deleted successfully.`
    });

  } catch (error) {
    console.error('❌ API Error deleting contact:', error);

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json(
      { 
        error: 'Failed to delete contact', 
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}