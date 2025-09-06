
// app/api/contacts/exchange/verify/route.js
import { NextResponse } from 'next/server';
import { ExchangeService } from '@/lib/services/serviceContact/server/exchangeService';

export async function GET(request) {
  try {
    console.log('🔍 API: Verifying profile for exchange');

    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const userId = searchParams.get('userId');

    if (!username && !userId) {
      return NextResponse.json({
        error: 'Username or userId parameter required',
        code: 'MISSING_IDENTIFIER'
      }, { status: 400 });
    }

    // Verify profile
    const verification = await ExchangeService.verifyProfile(
      username || userId,
      username ? 'username' : 'userId'
    );

    if (!verification.exists) {
      return NextResponse.json({
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }

    if (!verification.available) {
      return NextResponse.json({
        error: verification.error,
        code: 'PROFILE_UNAVAILABLE'
      }, { status: 403 });
    }

    console.log('✅ Profile verified for exchange:', verification.profile.username);

    return NextResponse.json({
      success: true,
      profile: verification.profile,
      available: true
    });

  } catch (error) {
    console.error('❌ API Error in profile verification:', error);
    
    return NextResponse.json({ 
      error: 'Failed to verify profile',
      code: 'VERIFICATION_FAILED'
    }, { status: 500 });
  }
}