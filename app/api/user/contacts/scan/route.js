import { NextResponse } from 'next/server';
// ✅ CHANGED: Using adminAuth directly from your firebaseAdmin setup
import { adminAuth } from '@/lib/firebaseAdmin'; 
import { BusinessCardService } from '@/lib/services/serviceContact/server/businessCardService';

/**
 * POST /api/user/contacts/scan - Scan business card
 */
export async function POST(request) {
  try {
    console.log('📇 POST /api/user/contacts/scan - Processing business card scan');

    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    // ✅ CHANGED: Using the standard adminAuth.verifyIdToken method
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse request body
    const body = await request.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }

    // Validate image data
    if (typeof imageBase64 !== 'string' || imageBase64.length < 100) {
      return NextResponse.json({ error: 'Invalid image data format' }, { status: 400 });
    }

    // Process business card scan using the new service
    const result = await BusinessCardService.processBusinessCardScan(userId, imageBase64);

    console.log('✅ Business card processed successfully');
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error in POST /api/user/contacts/scan:', error);

    // Check if the error is a Firebase Auth error
    if (error.code && error.code.startsWith('auth/')) {
        return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    let status = 500;
    let errorMessage = error.message || 'Failed to process business card';

    if (error.message?.includes('Invalid') || error.message?.includes('format')) {
      status = 400;
    } else if (error.message?.includes('subscription') || error.message?.includes('limit')) {
      status = 402;
    } else if (error.message?.includes('rate limit')) {
      status = 429;
    } else if (error.message?.includes('not found')) {
      status = 404;
    }

    return NextResponse.json({ error: errorMessage, success: false }, { status });
  }
}

/**
 * GET /api/user/contacts/scan/stats - Get business card scanning statistics
 */
export async function GET(request) {
  try {
    console.log('📊 GET /api/user/contacts/scan/stats - Getting scanning statistics');

    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    // ✅ CHANGED: Using the standard adminAuth.verifyIdToken method
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get scanning statistics
    const stats = await BusinessCardService.getScanningStats(userId);

    console.log('✅ Scanning statistics retrieved successfully');
    return NextResponse.json(stats);

  } catch (error) {
    console.error('❌ Error getting scanning statistics:', error);

    // Check if the error is a Firebase Auth error
    if (error.code && error.code.startsWith('auth/')) {
        return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    let status = 500;
    let errorMessage = error.message || 'Failed to get scanning statistics';

    if (error.message?.includes('subscription') || error.message?.includes('limit')) {
      status = 402;
    } else if (error.message?.includes('not found')) {
      status = 404;
    }

    return NextResponse.json({ error: errorMessage, success: false }, { status });
  }
}