
/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
//////////////////////////////////////////////////////////////////////////////////////////////////
// app/api/user/contacts/export/route.js
// Contact export API route following enterprise pattern

import { NextResponse } from 'next/server';
// ✅ FIX: Import adminAuth, not a separate function
import { adminAuth } from '@/lib/firebaseAdmin';
import { ContactService } from '@/lib/services/serviceContact/server';

/**
 * GET /api/user/contacts/export - Export contacts to file
 */
export async function GET(request) {
  try {
    console.log('📤 GET /api/user/contacts/export - Exporting contacts');

    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    // ✅ FIX: Use the correct method from adminAuth
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    
    // Get all contact IDs if they were passed in the query
    const contactIds = searchParams.getAll('contactIds');

    const filters = {
      status: searchParams.get('status') || 'all',
      search: searchParams.get('search') || '',
      // If specific IDs are requested, use them. Otherwise, the service will fetch all.
      contactIds: contactIds.length > 0 ? contactIds : null 
    };

    // Export contacts
    const result = await ContactService.exportContacts(userId, format, filters);

    console.log('✅ Contacts exported successfully');

    // Return file data as response
    return new NextResponse(result.data, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Contact-Count': result.contactCount.toString()
      }
    });

  } catch (error) {
    console.error('❌ Error in GET /api/contacts/export:', error);
    
    let status = 500;
    let errorMessage = error.message || 'Failed to export contacts';

    if (error.message.includes('No contacts')) {
      status = 404;
    } else if (error.message.includes('Unsupported')) {
      status = 400;
    }

    return NextResponse.json({ error: errorMessage, success: false }, { status });
  }
}