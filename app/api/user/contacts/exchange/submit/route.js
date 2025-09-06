// app/api/contacts/exchange/submit/route.js
import { NextResponse } from 'next/server';
import { ExchangeService } from '@/lib/services/serviceContact/server/exchangeService';

export async function POST(request) {
  try {
    console.log('🔄 API: Processing exchange contact submission');

    // CSRF Protection
    const origin = request.headers.get('origin');
    const allowedOrigins = [process.env.NEXT_PUBLIC_BASE_URL, 'http://localhost:3000'];
    if (!allowedOrigins.includes(origin)) {
      console.warn(`🚨 CSRF Warning: Request from invalid origin: ${origin}`);
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    // Rate Limiting (by IP for public endpoint)
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || 'unknown';
    
    try {
      await ExchangeService.checkExchangeRateLimit(ip, 5, 60); // 5 submissions per hour per IP
    } catch (rateLimitError) {
      console.warn(`🚨 Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json({ 
        error: rateLimitError.message,
        code: 'RATE_LIMIT_EXCEEDED'
      }, { status: 429 });
    }

    // Parse request body
    const body = await request.json();
    const { userId, username, contact, metadata } = body;

    if (!contact) {
      return NextResponse.json({ 
        error: 'Contact data is required',
        code: 'MISSING_CONTACT_DATA'
      }, { status: 400 });
    }

    if (!userId && !username) {
      return NextResponse.json({ 
        error: 'Target profile identifier required',
        code: 'MISSING_TARGET_PROFILE'
      }, { status: 400 });
    }

    // Prepare submission data
    const submissionData = {
      userId,
      username,
      contact,
      metadata: {
        ...metadata,
        ip,
        submissionTime: new Date().toISOString()
      }
    };

    // Submit exchange contact
    const result = await ExchangeService.submitExchangeContact(submissionData);

    console.log('✅ Exchange contact submitted successfully:', {
      contactId: result.contactId,
      targetUserId: result.targetProfile.userId,
      hasLocation: !!(contact.location)
    });

    return NextResponse.json({
      success: true,
      message: 'Contact submitted successfully',
      contactId: result.contactId,
      submittedAt: result.submittedAt,
      targetProfile: result.targetProfile
    });

  } catch (error) {
    console.error('❌ API Error in exchange submission:', error);
    
    // Handle specific error types
    if (error.message.includes('not found') || error.message.includes('Profile not found')) {
      return NextResponse.json({ 
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }
    
    if (error.message.includes('validation') || error.message.includes('Invalid') || error.message.includes('required')) {
      return NextResponse.json({ 
        error: error.message,
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    if (error.message.includes('not enabled') || error.message.includes('Exchange not enabled')) {
      return NextResponse.json({ 
        error: 'Exchange not enabled for this profile',
        code: 'EXCHANGE_DISABLED'
      }, { status: 403 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to submit contact. Please try again.',
      code: 'SUBMISSION_FAILED'
    }, { status: 500 });
  }
}



