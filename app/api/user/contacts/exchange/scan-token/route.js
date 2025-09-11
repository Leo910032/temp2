// app/api/user/contacts/exchange/scan-token/route.js
// Secure token generation for public business card scanning

import { NextResponse } from 'next/server';
import { ExchangeService } from '@/lib/services/serviceContact/server/exchangeService';
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request) {
  const requestId = `token_req_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  
  try {
    console.log(`🔐 [${requestId}] Secure scan token request received`);

    // CSRF Protection
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_BASE_URL,
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    if (process.env.NODE_ENV === 'production' && !allowedOrigins.includes(origin)) {
      return NextResponse.json({ 
        error: 'Invalid origin',
        code: 'INVALID_ORIGIN'
      }, { status: 403 });
    }

    // Rate limiting for token requests
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || 'unknown';
    
    await checkTokenRequestRateLimit(ip);

    // Parse request body
    const body = await request.json();
    const { username, userId, clientInfo } = body;

    if (!username && !userId) {
      return NextResponse.json({
        error: 'Username or userId required',
        code: 'MISSING_IDENTIFIER'
      }, { status: 400 });
    }

    // Verify the target profile exists and has scanning enabled
    let targetUser;
    if (userId) {
      targetUser = await ExchangeService.findUserById(userId);
    } else {
      targetUser = await ExchangeService.findUserByUsername(username);
    }

    if (!targetUser) {
      return NextResponse.json({
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }

    if (!targetUser.exchangeEnabled) {
      return NextResponse.json({
        error: 'Exchange not enabled for this profile',
        code: 'EXCHANGE_DISABLED'
      }, { status: 403 });
    }

    // Check if profile owner has sufficient AI budget for scanning
    const { CostTrackingService } = await import('@/lib/services/serviceContact/server/costTrackingService');
    const costCheck = await CostTrackingService.canAffordOperation(
      targetUser.userId,
      0.005, // Estimated scan cost
      1
    );

    if (!costCheck.canAfford) {
      return NextResponse.json({
        error: 'Profile owner has insufficient AI budget for scanning',
        code: 'INSUFFICIENT_BUDGET'
      }, { status: 402 });
    }

    // Generate secure token
    const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expirationTime = Date.now() + (30 * 60 * 1000); // 30 minutes

    const tokenPayload = {
      tokenId,
      purpose: 'public_scan',
      profileOwnerId: targetUser.userId,
      profileOwnerName: targetUser.displayName,
      profileOwnerUsername: targetUser.username,
      expires: expirationTime,
      issuedAt: Date.now(),
      issuer: 'exchange_service',
      clientInfo: {
        ip,
        userAgent: clientInfo?.userAgent || 'unknown',
        timezone: clientInfo?.timezone || 'unknown'
      }
    };

    const scanToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'your-secret-key');

    // Store token metadata in database for validation and tracking
    await adminDb.collection('ScanTokens').doc(tokenId).set({
      profileOwnerId: targetUser.userId,
      profileOwnerUsername: targetUser.username,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(expirationTime).toISOString(),
      used: false,
      issuedFor: username || userId,
      requestIp: ip,
      clientInfo
    });

    console.log(`✅ [${requestId}] Scan token generated for profile: ${targetUser.username}`);

    return NextResponse.json({
      success: true,
      scanToken,
      expiresAt: new Date(expirationTime).toISOString(),
      profileInfo: {
        username: targetUser.username,
        displayName: targetUser.displayName,
        hasAIBudget: costCheck.canAfford
      },
      capabilities: {
        enhancedScanning: true,
        dynamicFields: true,
        personalizedMessages: true,
        multiSideSupport: true
      }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Token generation failed:`, error);
    
    let statusCode = 500;
    let errorCode = 'TOKEN_GENERATION_FAILED';
    
    if (error.message?.includes('rate limit')) {
      statusCode = 429;
      errorCode = 'RATE_LIMIT_EXCEEDED';
    } else if (error.message?.includes('not found')) {
      statusCode = 404;
      errorCode = 'PROFILE_NOT_FOUND';
    }

    return NextResponse.json({
      error: error.message || 'Failed to generate scan token',
      code: errorCode,
      requestId
    }, { status: statusCode });
  }
}

// Helper function for rate limiting token requests
async function checkTokenRequestRateLimit(ip, maxRequests = 20, windowMinutes = 60) {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const cacheKey = `token_rate_limit_${ip}`;

  const rateLimitDoc = await adminDb.collection('RateLimits').doc(cacheKey).get();
  
  let requests = [];
  if (rateLimitDoc.exists) {
    requests = rateLimitDoc.data().requests || [];
  }

  // Remove old requests
  requests = requests.filter(timestamp => now - timestamp < windowMs);

  if (requests.length >= maxRequests) {
    throw new Error(`Token request rate limit exceeded. Max ${maxRequests} requests per ${windowMinutes} minutes.`);
  }

  // Record this request
  requests.push(now);
  await adminDb.collection('RateLimits').doc(cacheKey).set({
    requests,
    lastUpdated: new Date().toISOString(),
    type: 'token_request'
  });
}