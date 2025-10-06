// app/api/user/contacts/verify-profile/route.js
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request) {
  try {
    const { identifier, type } = await request.json();

    console.log('🔍 API: Verifying profile:', { identifier, type });

    if (!identifier || !type) {
      return NextResponse.json(
        { error: 'Identifier and type are required' },
        { status: 400 }
      );
    }

    let userDoc;

    if (type === 'userId') {
      // Look up by user ID
      userDoc = await adminDb.collection('users').doc(identifier).get();

      if (!userDoc.exists) {
        return NextResponse.json({
          exists: false,
          available: false,
          error: 'Profile not found'
        });
      }
    } else if (type === 'username') {
      // Look up by username
      const querySnapshot = await adminDb
        .collection('users')
        .where('username', '==', identifier.trim().toLowerCase())
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        return NextResponse.json({
          exists: false,
          available: false,
          error: 'Profile not found'
        });
      }

      userDoc = querySnapshot.docs[0];
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be "userId" or "username"' },
        { status: 400 }
      );
    }

    const userData = userDoc.data();
    const settings = userData.settings || {};

    // Check if user is active
    if (userData.accountStatus === 'suspended' || userData.accountStatus === 'deleted') {
      return NextResponse.json({
        exists: true,
        available: false,
        error: 'Profile is not active'
      });
    }

    // Check if exchange is enabled (default to true)
    const contactExchangeEnabled = settings.contactExchangeEnabled !== false;

    if (!contactExchangeEnabled) {
      return NextResponse.json({
        exists: true,
        available: false,
        error: 'Exchange not enabled for this profile'
      });
    }

    // Check if profile has required info
    const profile = userData.profile || {};
    const hasContactInfo = profile.displayName || userData.email;

    if (!hasContactInfo) {
      return NextResponse.json({
        exists: true,
        available: false,
        error: 'Profile does not have sufficient contact information'
      });
    }

    console.log('✅ API: Profile verified successfully');

    return NextResponse.json({
      exists: true,
      available: true,
      profile: {
        userId: userDoc.id,
        username: userData.username,
        displayName: profile.displayName || userData.displayName,
        avatarUrl: profile.avatarUrl
      }
    });

  } catch (error) {
    console.error('❌ API: Error verifying profile:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
