export const dynamic = 'force-dynamic';

// app/api/admin/sessions/route.js
// Thin HTTP layer for session usage operations
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { AdminService } from '@/lib/services/serviceAdmin/server/adminService';
import { AdminServiceSessions } from '@/lib/services/serviceAdmin/server/adminServiceSessions';

/**
 * Verify Firebase Auth token and check admin status
 */
async function verifyAdminToken(token) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      isValid: true,
      email: decodedToken.email,
      isAdmin: AdminService.isServerAdmin(decodedToken.email),
      uid: decodedToken.uid
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return {
      isValid: false,
      isAdmin: false,
      error: error.code || 'Invalid token'
    };
  }
}

/**
 * GET /api/admin/sessions
 * Fetch session usage data for a specific user
 *
 * Query Parameters:
 * - userId (required): User ID to fetch sessions for
 * - status (optional): Filter by status ('all', 'completed', 'in-progress', 'abandoned')
 * - limit (optional): Number of sessions to return (25, 50, 100)
 */
export async function GET(request) {
  const startTime = Date.now();

  try {
    // --- 1. Extract Authorization Token ---
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('🚨 Admin sessions API access attempted without valid authorization header');
      return NextResponse.json(
        { error: 'Unauthorized: No valid token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // --- 2. Verify Token and Check Admin Status ---
    const { isValid, email, isAdmin, error } = await verifyAdminToken(token);

    if (!isValid) {
      console.warn(`🚨 Admin sessions API access attempted with invalid token: ${error}`);
      return NextResponse.json(
        { error: `Unauthorized: ${error}` },
        { status: 401 }
      );
    }

    // BOTH full and view-only admins can access (read-only data)
    if (!isAdmin) {
      console.warn(`🚨 UNAUTHORIZED ADMIN SESSIONS ACCESS ATTEMPT by user: ${email}`);
      return NextResponse.json(
        { error: 'Forbidden: You do not have admin privileges' },
        { status: 403 }
      );
    }

    // Get admin role (for logging)
    const adminRole = AdminService.getAdminRole(email);
    console.log(`✅ Authorized admin sessions access by: ${email} (Role: ${adminRole})`);

    // --- 3. Parse Query Parameters ---
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit')) || 50;

    // Validate required parameters
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    // Validate status parameter
    const validStatuses = ['all', 'completed', 'in-progress', 'abandoned'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate limit parameter
    const validLimits = [25, 50, 100];
    if (!validLimits.includes(limit)) {
      return NextResponse.json(
        { error: `Invalid limit. Must be one of: ${validLimits.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`[SessionsAPI] Fetching sessions for user ${userId} with filters:`, { status, limit });

    // --- 4. Delegate to Service Layer ---
    const [sessions, stats] = await Promise.all([
      AdminServiceSessions.getUserSessions(userId, { status, limit }),
      AdminServiceSessions.getSessionStats(userId)
    ]);

    // --- 5. Return Response ---
    const processingTime = Date.now() - startTime;

    const response = {
      sessions,
      count: sessions.length,
      stats,
      filters: { userId, status, limit },
      adminUser: email,
      adminRole,
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime
    };

    console.log(`✅ Admin sessions API completed successfully for ${email} (${processingTime}ms, ${sessions.length} sessions)`);

    return NextResponse.json(response);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('💥 Admin sessions API error:', {
      error: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      processingTime
    });

    // Different error responses based on error type
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json(
        { error: 'Unauthorized: Token expired, please log in again' },
        { status: 401 }
      );
    }

    if (error.code === 'auth/argument-error') {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token format' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
          details: error.message
        })
      },
      { status: 500 }
    );
  }
}
