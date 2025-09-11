import { NextResponse } from 'next/server';
import { ExchangeService } from '@/lib/services/serviceContact/server/exchangeService';

export async function POST(request) {
  const requestStartTime = Date.now();
  
  try {
    console.log('🔄 API: Processing enhanced exchange contact submission');

    // CSRF Protection
    const origin = request.headers.get('origin');
    const allowedOrigins = [
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
    const rateLimitStart = Date.now();
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || 'unknown';
    
    try {
      await ExchangeService.checkExchangeRateLimit(ip, 60, 60);
      console.log(`✅ Rate limit check passed (${Date.now() - rateLimitStart}ms)`);
    } catch (rateLimitError) {
      console.warn(`🚨 Rate limit exceeded for IP: ${ip} (${Date.now() - rateLimitStart}ms)`);
      return NextResponse.json({ 
        error: rateLimitError.message,
        code: 'RATE_LIMIT_EXCEEDED'
      }, { status: 429 });
    }

    // Parse request body
    const parseStart = Date.now();
    const body = await request.json();
    const { userId, username, contact, metadata } = body;
    console.log(`📋 Request parsed (${Date.now() - parseStart}ms)`);

    // Enhanced validation
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

    // Prepare enhanced submission data
    const submissionData = {
      userId,
      username,
      contact: {
        ...contact,
        // Ensure dynamic fields are properly included
        dynamicFields: contact.dynamicFields || []
      },
      metadata: {
        ...metadata,
        ip,
        submissionTime: new Date().toISOString(),
        enhancedExchange: true,
        hasScannedData: !!(metadata?.scannedCard || contact.dynamicFields?.length > 0)
      }
    };

    // Submit through enhanced exchange service
    const submissionStart = Date.now();
    console.log('🚀 Starting enhanced exchange submission...');
    
    const result = await ExchangeService.submitExchangeContact(submissionData);
    
    const submissionTime = Date.now() - submissionStart;
    const totalTime = Date.now() - requestStartTime;
    
    console.log(`✅ Enhanced exchange contact submitted successfully in ${submissionTime}ms (total: ${totalTime}ms)`);
    console.log({
      contactId: result.contactId,
      targetUserId: result.targetProfile.userId,
      hasLocation: !!(contact.location),
      hasDynamicFields: !!(contact.dynamicFields?.length > 0),
      dynamicFieldCount: contact.dynamicFields?.length || 0,
      timing: {
        rateLimitCheck: `${Date.now() - rateLimitStart}ms`,
        parsing: `${Date.now() - parseStart}ms`,
        submission: `${submissionTime}ms`,
        total: `${totalTime}ms`
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Contact submitted successfully with enhanced features!',
      contactId: result.contactId,
      submittedAt: result.submittedAt,
      targetProfile: result.targetProfile,
      processing: {
        database: 'completed',
        vectorSearch: 'background',
        enhancedFeatures: 'enabled',
        timing: `${totalTime}ms`
      },
      features: {
        dynamicFields: contact.dynamicFields?.length || 0,
        hasLocation: !!(contact.location),
        hasScannedData: !!(metadata?.scannedCard)
      }
    });

  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`❌ API Error in enhanced exchange submission after ${totalTime}ms:`, error);
    
    // Enhanced error handling
    if (error.message.includes('not found') || error.message.includes('Profile not found')) {
      return NextResponse.json({ 
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND',
        timing: `${totalTime}ms`
      }, { status: 404 });
    }
    
    if (error.message.includes('validation') || error.message.includes('Invalid') || error.message.includes('required')) {
      return NextResponse.json({ 
        error: error.message,
        code: 'VALIDATION_ERROR',
        timing: `${totalTime}ms`
      }, { status: 400 });
    }

    if (error.message.includes('not enabled') || error.message.includes('Exchange not enabled')) {
      return NextResponse.json({ 
        error: 'Exchange not enabled for this profile',
        code: 'EXCHANGE_DISABLED',
        timing: `${totalTime}ms`
      }, { status: 403 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to submit contact. Please try again.',
      code: 'SUBMISSION_FAILED',
      timing: `${totalTime}ms`
    }, { status: 500 });
  }
}