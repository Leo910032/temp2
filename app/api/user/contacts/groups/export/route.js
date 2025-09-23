/**
 * THIS FILE HAS BEEN REFRACTORED 
 */

//////////////////////////////////////////////////////////////////////////////////////////////////
// app/api/user/contacts/groups/export/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { ContactGroupService } from '@/lib/services/serviceContact/server/contactService';

/**
 * GET /api/user/contacts/groups/export - Export contact groups to a file
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const result = await ContactGroupService.exportGroups(userId, format);

    return new NextResponse(result.data, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Group-Count': result.groupCount.toString()
      }
    });

  } catch (error) {
    console.error('❌ Error in GET /api/user/contacts/groups/export:', error);
    let status = 500;
    if (error.message.includes('No groups')) status = 404;
    return NextResponse.json({ error: error.message || 'Failed to export groups' }, { status });
  }
}