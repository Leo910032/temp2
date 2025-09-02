// app/api/contacts/stats/route.js
// Contact statistics API route following enterprise pattern

import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebaseAdmin';
import { ContactService } from '@/lib/services/serviceContact/server/contactService';

/**
 * GET /api/contacts/stats - Get contact statistics
 */
export async function GET(request) {
  try {
    console.log('📊 GET /api/contacts/stats - Getting contact statistics');

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

    // Get contact statistics
    const result = await ContactService.getContactStats(userId);

    console.log('✅ Contact statistics retrieved successfully');
    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Error in GET /api/contacts/stats:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to get contact statistics',
        success: false 
      }, 
      { status: 500 }
    );
  }
}
