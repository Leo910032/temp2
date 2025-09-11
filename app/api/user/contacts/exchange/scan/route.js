// app/api/user/contacts/exchange/scan/route.js
// Integrated business card scanning API following the proper service architecture

import { NextResponse } from 'next/server';
import { ExchangeService } from '@/lib/services/serviceContact/server/exchangeService';
import { BusinessCardService } from '@/lib/services/serviceContact/server/businessCardService';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request) {
  const requestId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  
  try {
    console.log(`📇 [${requestId}] Integrated business card scan request received`);

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

    // Rate limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || 'unknown';
    await checkScanRateLimit(ip);

    // Parse request body
    const body = await request.json();
    const { images, scanToken, language = 'en', metadata } = body;

    if (!images || (!images.front && !images.back)) {
      return NextResponse.json({
        error: 'At least one image (front or back) is required',
        code: 'MISSING_IMAGE_DATA'
      }, { status: 400 });
    }

    if (!scanToken) {
      return NextResponse.json({
        error: 'Secure scan token required',
        code: 'MISSING_SCAN_TOKEN'
      }, { status: 400 });
    }

    // Verify and decode the scan token
    const tokenData = await verifySecureScanToken(scanToken);
    if (!tokenData) {
      return NextResponse.json({
        error: 'Invalid or expired scan token',
        code: 'INVALID_SCAN_TOKEN'
      }, { status: 401 });
    }

    const { profileOwnerId, profileOwnerName } = tokenData;

    // Check if profile owner can afford the scanning operation
    const costCheck = await CostTrackingService.canAffordOperation(
      profileOwnerId,
      0.003 * Object.keys(images).length, // Cost based on number of images
      1
    );

    if (!costCheck.canAfford) {
      return NextResponse.json({
        error: 'Profile owner has insufficient AI budget',
        code: 'BUDGET_EXCEEDED'
      }, { status: 402 });
    }

    // Process the business card scan using the proper service
    const scanStartTime = Date.now();
    const scanResult = await BusinessCardService.processEnhancedScan(
      profileOwnerId,
      images,
      {
        language,
        requestId,
        isPublicScan: true,
        metadata: {
          ...metadata,
          tokenData,
          clientIp: ip
        }
      }
    );

    const scanDuration = Date.now() - scanStartTime;

    // Generate personalized message if scan was successful
    let personalizedMessage = null;
    if (scanResult.success && scanResult.parsedFields.length > 0) {
      const clientName = extractNameFromFields(scanResult.parsedFields);
      if (clientName) {
        personalizedMessage = await generatePersonalizedMessage(
          clientName,
          profileOwnerName,
          language
        );
      }
    }

    // Calculate and record the actual cost
    const actualCost = calculateScanCost(scanResult, scanDuration);
    await CostTrackingService.recordSeparatedUsage(
      profileOwnerId,
      actualCost,
      'gemini-1.5-flash',
      'exchange_card_scan',
      {
        requestId,
        scanDuration,
        fieldsDetected: scanResult.parsedFields?.length || 0,
        dynamicFields: scanResult.dynamicFields?.length || 0,
        hasQRCode: scanResult.metadata?.hasQRCode || false,
        clientName: extractNameFromFields(scanResult.parsedFields) || 'unknown',
        sidesScanned: Object.keys(images),
        scanMode: Object.keys(images).length > 1 ? 'multi_side' : 'single_side'
      },
      'api_call'
    );

    // Mark the token as used
    await markTokenAsUsed(scanToken);

    console.log(`✅ [${requestId}] Integrated scan completed in ${scanDuration}ms`);

    return NextResponse.json({
      success: true,
      parsedFields: scanResult.parsedFields || [],
      dynamicFields: scanResult.dynamicFields || [],
      personalizedMessage,
      metadata: {
        ...scanResult.metadata,
        scanDuration: `${scanDuration}ms`,
        integrationVersion: '2.0.0',
        requestId
      }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Integrated scan error:`, error);
    
    let statusCode = 500;
    let errorCode = 'SCAN_FAILED';
    
    if (error.message?.includes('rate limit')) {
      statusCode = 429;
      errorCode = 'RATE_LIMIT_EXCEEDED';
    } else if (error.message?.includes('budget')) {
      statusCode = 402;
      errorCode = 'BUDGET_EXCEEDED';
    } else if (error.message?.includes('token')) {
      statusCode = 401;
      errorCode = 'INVALID_TOKEN';
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to process business card',
      code: errorCode,
      requestId
    }, { status: statusCode });
  }
}

// Helper functions

async function checkScanRateLimit(ip, maxScans = 50, windowMinutes = 60) {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const cacheKey = `scan_rate_limit_${ip}`;

  const rateLimitDoc = await adminDb.collection('RateLimits').doc(cacheKey).get();
  
  let scans = [];
  if (rateLimitDoc.exists) {
    scans = rateLimitDoc.data().scans || [];
  }

  scans = scans.filter(timestamp => now - timestamp < windowMs);

  if (scans.length >= maxScans) {
    throw new Error(`Scan rate limit exceeded. Max ${maxScans} scans per ${windowMinutes} minutes.`);
  }

  scans.push(now);
  await adminDb.collection('RateLimits').doc(cacheKey).set({
    scans,
    lastUpdated: new Date().toISOString(),
    type: 'integrated_scan'
  });
}

async function verifySecureScanToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.purpose !== 'public_scan') {
      return null;
    }

    if (Date.now() > decoded.expires) {
      return null;
    }

    // Check if token has been used
    const tokenDoc = await adminDb.collection('ScanTokens').doc(decoded.tokenId).get();
    if (tokenDoc.exists && tokenDoc.data().used) {
      return null;
    }

    return {
      profileOwnerId: decoded.profileOwnerId,
      profileOwnerName: decoded.profileOwnerName,
      profileOwnerUsername: decoded.profileOwnerUsername,
      tokenId: decoded.tokenId
    };

  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

async function markTokenAsUsed(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded?.tokenId) {
      await adminDb.collection('ScanTokens').doc(decoded.tokenId).set({
        used: true,
        usedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (error) {
    console.error('Failed to mark token as used:', error);
  }
}

function extractNameFromFields(parsedFields) {
  const nameField = parsedFields.find(field => 
    field.label.toLowerCase().includes('name') && field.value.trim()
  );
  return nameField?.value.trim() || null;
}

async function generatePersonalizedMessage(clientName, profileOwnerName, language = 'en') {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    
    if (!process.env.GEMINI_API_KEY) {
      return {
        greeting: `Great connecting, ${clientName}!`,
        ctaText: "Get your own at tapit.fr.",
        url: "https://tapit.fr",
        signature: `- ${profileOwnerName}`
      };
    }

    const languageMap = {
      en: 'English', es: 'Spanish', fr: 'French', de: 'German',
      it: 'Italian', pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese'
    };

    const languageName = languageMap[language.toLowerCase()] || 'English';
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      systemInstruction: `Generate a short, professional greeting in ${languageName} from "${profileOwnerName}" to "${clientName}" after a business card exchange. Keep it under 20 words and friendly.`
    });

    const prompt = `Write a brief greeting in ${languageName} from ${profileOwnerName} to ${clientName} after scanning their business card.`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const messageText = response.text().trim().replace(/^["']|["']$/g, '');

    const ctaTextMap = {
      fr: "Créez la vôtre sur tapit.fr.",
      es: "Consigue la tuya en tapit.fr.",
      de: "Holen Sie sich Ihre eigene auf tapit.fr.",
      en: "Get your own at tapit.fr."
    };

    return {
      greeting: messageText,
      ctaText: ctaTextMap[language.toLowerCase()] || ctaTextMap.en,
      url: "https://tapit.fr",
      signature: `- ${profileOwnerName}`
    };

  } catch (error) {
    console.error('Failed to generate personalized message:', error);
    return {
      greeting: `Thanks for connecting, ${clientName}!`,
      ctaText: "Get your own digital card at tapit.fr.",
      url: "https://tapit.fr",
      signature: `- ${profileOwnerName}`
    };
  }
}

function calculateScanCost(scanResult, duration) {
  let baseCost = 0.002;

  if (scanResult.metadata?.hasQRCode) baseCost *= 1.2;
  if (scanResult.parsedFields?.length > 5) baseCost *= 1.1;
  if (duration > 10000) baseCost *= 1.3;
  else if (duration > 5000) baseCost *= 1.1;

  return Math.max(baseCost, 0.0001);
}
