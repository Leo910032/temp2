// app/api/admin/security/logs/route.js
/**
 * API Route for fetching top-level security logs
 *
 * Follows the admin service architecture pattern:
 * - Thin HTTP layer
 * - Token verification
 * - Admin authorization
 * - Delegates to server service
 *
 * References:
 * - app/api/admin/users/route.js
 * - app/api/admin/analytics/route.js
 * - ADMIN_ANALYTICS_API_USAGE_GUIDE.md
 */

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { AdminService } from '@/lib/services/serviceAdmin/server/adminService';
import { AdminServiceSecurity } from '@/lib/services/serviceAdmin/server/adminServiceSecurity';

/**
 * Verify admin token and check authorization
 * @param {string} token - JWT token
 * @returns {Promise<Object>} - { isValid, email, isAdmin, uid, error }
 */
async function verifyAdminToken(token) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = decodedToken.email;
    const isAdmin = AdminService.isServerAdmin(email);

    return {
      isValid: true,
      email: email,
      isAdmin: isAdmin,
      uid: decodedToken.uid
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return {
      isValid: false,
      isAdmin: false,
      error: error.code
    };
  }
}

/**
 * GET /api/admin/security/logs
 *
 * Fetch top-level security logs (platform-wide, no organization context)
 *
 * Query Parameters:
 * - severity: Filter by severity (CRITICAL, HIGH, MEDIUM, LOW)
 * - limit: Number of logs to return (default 50, max 200)
 * - action: Filter by action type
 *
 * Response:
 * {
 *   logs: Array<SecurityLog>,
 *   count: number,
 *   filters: Object,
 *   timestamp: string,
 *   adminUser: string,
 *   processingTimeMs: number
 * }
 */
export async function GET(request) {
  const startTime = Date.now();

  try {
    console.log('🔒 [SecurityLogsAPI] === GET REQUEST START ===');

    // 1. Extract and verify JWT token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('🚨 [SecurityLogsAPI] Missing or invalid authorization header');
      return NextResponse.json(
        { error: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    console.log('🔑 [SecurityLogsAPI] Token extracted, verifying...');

    // 2. Verify token and check admin status
    const { isValid, email, isAdmin, error } = await verifyAdminToken(token);

    if (!isValid) {
      console.warn('🚨 [SecurityLogsAPI] Invalid token:', error);
      return NextResponse.json(
        { error: 'Invalid authentication token', code: error },
        { status: 401 }
      );
    }

    if (!isAdmin) {
      console.warn(`🚨 [SecurityLogsAPI] Unauthorized access attempt by: ${email}`);
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    console.log(`✅ [SecurityLogsAPI] Authorized admin access by: ${email}`);

    // 3. Extract query parameters
    const { searchParams } = new URL(request.url);
    const filters = {
      severity: searchParams.get('severity') || null,
      limit: parseInt(searchParams.get('limit') || '50'),
      action: searchParams.get('action') || null
    };

    // Validate and cap limit
    filters.limit = Math.min(Math.max(filters.limit, 1), 200);

    console.log('🔍 [SecurityLogsAPI] Filters:', filters);

    // 4. Fetch security logs from server service
    console.log('📊 [SecurityLogsAPI] Fetching security logs from service...');
    const securityData = await AdminServiceSecurity.getTopLevelSecurityLogs(filters);

    // 5. Build response
    const processingTime = Date.now() - startTime;
    const result = {
      logs: securityData.logs,
      count: securityData.count,
      filters: filters,
      timestamp: new Date().toISOString(),
      adminUser: email,
      processingTimeMs: processingTime
    };

    console.log(`✅ [SecurityLogsAPI] Request completed successfully in ${processingTime}ms`);
    console.log(`   -> Returned ${result.count} logs`);

    return NextResponse.json(result);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ [SecurityLogsAPI] Error:', {
      message: error.message,
      stack: error.stack,
      processingTimeMs: processingTime
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch security logs',
        message: error.message,
        processingTimeMs: processingTime
      },
      { status: 500 }
    );
  }
}
