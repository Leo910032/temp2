//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 

// app/api/contacts/stats/route.js
import { NextResponse } from 'next/server';
import { ContactService } from '@/lib/services/serviceContact/server/ContactCRUDService';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function GET(request) {
  try {
    console.log('📊 API: Getting contact statistics');

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ API: No valid authorization header');
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Extract and verify the token
    const idToken = authHeader.replace('Bearer ', '');
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (authError) {
      console.error('❌ API: Token verification failed:', authError);
      return NextResponse.json(
        { error: 'Invalid authentication token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    console.log('👤 API: User ID:', userId);

    // Get contact statistics from service
    const result = await ContactService.getContactStats(userId);

    console.log('✅ API: Contact statistics retrieved successfully');
    
    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ API Error getting contact statistics:', error);

    // Handle specific error types
    if (error.message?.includes('User not found')) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication failed', code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }

    // Generic server error
    return NextResponse.json(
      { 
        error: 'Failed to get contact statistics', 
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}