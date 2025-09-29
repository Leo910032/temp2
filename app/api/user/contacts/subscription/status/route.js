// app/api/user/contacts/subscription/status/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { ContactService } from '@/lib/services/serviceContact/server/ContactCRUDService';

export async function GET(request) {
  try {
    console.log('🔍 API: Getting contact subscription status');

    // Authentication using Firebase Auth (matching your pattern)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ API: No valid authorization header found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log('👤 API: User ID:', userId);

    // Get subscription status from ContactService
    const subscriptionStatus = await ContactService.getSubscriptionStatus(userId);

    console.log('✅ API: Contact subscription status retrieved successfully');
    
    return NextResponse.json({
      success: true,
      ...subscriptionStatus,
      timestamp: new Date().toISOString(),
      source: 'contacts-server'
    });

  } catch (error) {
    console.error('❌ API Error getting contact subscription status:', error);

    // Handle specific error types
    if (error.message?.includes('User not found')) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (error.message?.includes('Authentication') || error.code === 'auth/id-token-expired') {
      return NextResponse.json(
        { error: 'Authentication failed', code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }

    // Return safe defaults on error (matching your enterprise pattern)
    return NextResponse.json({
      subscriptionLevel: 'base',
      canAccessContacts: false,
      features: [],
      limits: { maxContacts: 0, maxGroups: 0, maxShares: 0, canExport: false },
      user: null,
      error: error.message,
      timestamp: new Date().toISOString(),
      source: 'error-fallback'
    }, { status: 500 });
  }
}