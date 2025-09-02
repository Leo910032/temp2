// app/api/contacts/export/route.js
// Contact export API route following enterprise pattern

import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebaseAdmin';
import { ContactService } from '@/lib/services/serviceContact/server/contactService';

/**
 * GET /api/contacts/export - Export contacts to file
 */
export async function GET(request) {
  try {
    console.log('📤 GET /api/contacts/export - Exporting contacts');

    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const filters = {
      status: searchParams.get('status') || 'all',
      search: searchParams.get('search') || '',
      source: searchParams.get('source') || null
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

    if (error.message?.includes('No contacts')) {
      status = 404;
    } else if (error.message?.includes('Unsupported')) {
      status = 400;
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        success: false 
      }, 
      { status }
    );
  }
}
