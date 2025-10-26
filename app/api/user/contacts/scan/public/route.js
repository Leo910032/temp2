// app/api/user/contacts/scan/public/route.js

import { NextRequest, NextResponse } from 'next/server';
import { PublicScanService } from '@/lib/services/serviceContact/server/publicScanService';

/**
 * PUBLIC business card scanner endpoint for exchange forms
 * Uses secure tokens to prevent abuse and tracks costs to profile owner
 */
export async function POST(request) {
  const requestId = `pub_scan_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  try {
    console.log(`📇 [${requestId}] Enhanced public business card scan request received`);

    // 1. CSRF Protection
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXT_PUBLIC_BASE_URL,
      'http://localhost:3000',
      'http://localhost:3001'
    ];

    if (process.env.NODE_ENV === 'production' && !allowedOrigins.includes(origin)) {
      return new Response(JSON.stringify({ error: 'Invalid origin' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Rate Limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || 'unknown';
    await PublicScanService.checkPublicScanRateLimit(ip);

    // 3. Parse request body
    const body = await request.json();
    const { images, scanToken, language = 'en' } = body;

    console.log(`[${requestId}] Language received: '${language}'`);
    console.log(`[${requestId}] Processing images for side(s): ${Object.keys(images || {}).join(', ')}`);

    // 4. Validate request
    if (!images || (!images.front && !images.back)) {
      return new Response(JSON.stringify({
        error: 'At least one image (front or back) is required in the images object.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!scanToken) {
      return new Response(JSON.stringify({
        error: 'Image data and scan token required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Process scan through service
    const result = await PublicScanService.processScan({
      images,
      scanToken,
      language,
      requestId
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Enhanced public scan error:`, error);

    let statusCode = 500;
    let errorCode = 'SCAN_FAILED';

    if (error.message?.includes('rate limit')) {
      statusCode = 429;
      errorCode = 'RATE_LIMIT_EXCEEDED';
    } else if (error.message?.includes('budget') || error.code === 'BUDGET_EXCEEDED') {
      statusCode = 402;
      errorCode = 'BUDGET_EXCEEDED';
    } else if (error.message?.includes('Invalid') || error.message?.includes('expired')) {
      statusCode = 401;
      errorCode = 'INVALID_TOKEN';
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to process business card',
      code: errorCode,
      requestId
    }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
