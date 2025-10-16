export const dynamic = 'force-dynamic';

// app/api/admin/vector-info/route.js - Thin HTTP Layer
// Admin API for retrieving vector storage information
// Follows the admin service architecture pattern

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { AdminService } from '@/lib/services/serviceAdmin/server/adminService';
import { AdminServiceVector } from '@/lib/services/serviceAdmin/server/adminServiceVector';

/**
 * Verify admin token and check permissions
 * @param {string} token - JWT token
 * @returns {Promise<Object>} Verification result
 */
async function verifyAdminToken(token) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      isValid: true,
      email: decodedToken.email,
      uid: decodedToken.uid,
      isAdmin: AdminService.isServerAdmin(decodedToken.email),
      adminRole: AdminService.getAdminRole(decodedToken.email)
    };
  } catch (error) {
    return {
      isValid: false,
      isAdmin: false,
      error: error.code
    };
  }
}

/**
 * GET /api/admin/vector-info - Get vector storage information for a user
 *
 * Security:
 * - Requires valid JWT token
 * - Allows both full and view-only admins (read-only operation)
 *
 * Query Parameters:
 * - userId: User ID to get vector info for (required)
 */
export async function GET(request) {
  const startTime = Date.now();

  try {
    console.log('📊 GET /api/admin/vector-info - Getting vector storage info');

    // 1. Verify Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('❌ Missing or invalid Authorization header');
      return NextResponse.json(
        { error: 'Unauthorized - Missing or invalid token' },
        { status: 401 }
      );
    }

    // 2. Verify JWT token
    const token = authHeader.split('Bearer ')[1];
    const { isValid, email, isAdmin, adminRole } = await verifyAdminToken(token);

    if (!isValid || !isAdmin) {
      console.warn(`❌ Unauthorized access attempt by: ${email || 'unknown'}`);
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    console.log(`✅ Authorized admin vector info access by: ${email} (Role: ${adminRole})`);

    // 3. Get userId from query params
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    console.log('📊 Getting vector info for user:', userId);

    // 4. Delegate to service layer
    const result = await AdminServiceVector.getVectorInfo(userId);

    // 5. Calculate processing time
    const processingTime = Date.now() - startTime;

    console.log('✅ Vector info retrieved successfully:', {
      userId,
      vectorsStored: result.vectorsStored,
      hasVectorSupport: result.hasVectorSupport,
      processingTimeMs: processingTime
    });

    // 6. Return response
    return NextResponse.json({
      ...result,
      adminUser: email,
      adminRole: adminRole,
      processingTimeMs: processingTime
    });

  } catch (error) {
    console.error('❌ Error getting vector info:', error);
    return NextResponse.json({
      error: 'Failed to get vector info',
      details: error.message
    }, { status: 500 });
  }
}
