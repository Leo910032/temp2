// app/api/user/contacts/exchange/submit/route.js
import { NextResponse } from 'next/server';
import { ExchangeService } from '@/lib/services/serviceContact/server/exchangeService';

/**
 * PUBLIC endpoint for contact exchange form submissions
 * No authentication required - this is for public profile visitors
 */
export async function POST(request) {
  const requestStartTime = Date.now();

  try {
    console.log('🔄 API: Processing exchange contact submission');

    // CSRF Protection
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXT_PUBLIC_BASE_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://localhost:3000',
      'https://localhost:3001'
    ];

    if (process.env.NODE_ENV === 'development') {
      const isDevelopmentOrigin = origin?.includes('localhost') || origin?.includes('127.0.0.1');
      if (!isDevelopmentOrigin && !allowedOrigins.includes(origin)) {
        console.warn(`🚨 CSRF Warning: Request from invalid origin: ${origin}`);
        return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
      }
    } else if (!allowedOrigins.includes(origin)) {
      console.warn(`🚨 CSRF Warning: Request from invalid origin: ${origin}`);
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    // Rate limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || 'unknown';

    try {
      await ExchangeService.checkExchangeRateLimit(ip, 60, 60);
    } catch (rateLimitError) {
      console.warn(`🚨 Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json({
        error: rateLimitError.message,
        code: 'RATE_LIMIT_EXCEEDED'
      }, { status: 429 });
    }

    // Parse request body
    const body = await request.json();

    // Enhance metadata with request info
    const submissionData = {
      ...body,
      metadata: {
        ...body.metadata,
        ip,
        userAgent: body.metadata?.userAgent || request.headers.get('user-agent') || '',
        referrer: body.metadata?.referrer || request.headers.get('referer') || '',
        language: body.metadata?.language || request.headers.get('accept-language')?.split(',')[0] || 'unknown',
      }
    };

    // Submit through exchange service
    const result = await ExchangeService.submitExchangeContact(submissionData);

    const totalTime = Date.now() - requestStartTime;
    console.log(`✅ Exchange contact submitted successfully in ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      message: 'Contact submitted successfully!',
      contactId: result.contactId,
      submittedAt: result.submittedAt,
      targetProfile: result.targetProfile,
      features: {
        dynamicFields: body.contact?.dynamicFields?.length || 0,
        hasLocation: !!(body.contact?.location),
        hasScannedData: !!(body.metadata?.scannedCard)
      },
      timing: `${totalTime}ms`
    });

  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`❌ API Error in exchange submission after ${totalTime}ms:`, error);

    // Handle specific error types
    if (error.message.includes('not found') || error.message.includes('Profile not found')) {
      return NextResponse.json({
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND',
        timing: `${totalTime}ms`
      }, { status: 404 });
    }

    if (error.message.includes('not enabled') || error.message.includes('Exchange not enabled')) {
      return NextResponse.json({
        error: 'Exchange not enabled for this profile',
        code: 'EXCHANGE_DISABLED',
        timing: `${totalTime}ms`
      }, { status: 403 });
    }

    if (error.message.includes('required') || error.message.includes('Validation')) {
      return NextResponse.json({
        error: error.message,
        code: 'VALIDATION_ERROR',
        timing: `${totalTime}ms`
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to submit contact. Please try again.',
      code: 'SUBMISSION_FAILED',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timing: `${totalTime}ms`
    }, { status: 500 });
  }
}
