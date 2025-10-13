export const dynamic = 'force-dynamic';

// app/api/admin/analytics/user/[userId]/route.js
// Thin HTTP layer for fetching individual user analytics
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { AdminService } from '@/lib/services/serviceAdmin/server/adminService';
import { AnalyticsService } from '@/lib/services/serviceAdmin/server/analyticsService';

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
 * GET /api/admin/analytics/user/[userId]
 * Fetch analytics for a specific user
 */
export async function GET(request, { params }) {
    const startTime = Date.now();
    const userId = params.userId;

    try {
        // --- 1. Validate userId ---
        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        // --- 2. Extract Authorization Token ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn('🚨 Admin user analytics API access attempted without valid authorization header');
            return NextResponse.json(
                { error: 'Unauthorized: No valid token provided' },
                { status: 401 }
            );
        }

        const token = authHeader.split('Bearer ')[1];

        // --- 3. Verify Token and Check Admin Status ---
        const { isValid, email, isAdmin, error } = await verifyAdminToken(token);

        if (!isValid) {
            console.warn(`🚨 Admin user analytics API access attempted with invalid token: ${error}`);
            return NextResponse.json(
                { error: `Unauthorized: ${error}` },
                { status: 401 }
            );
        }

        if (!isAdmin) {
            console.warn(`🚨 UNAUTHORIZED ADMIN USER ANALYTICS ACCESS ATTEMPT by user: ${email}`);
            return NextResponse.json(
                { error: 'Forbidden: You do not have admin privileges' },
                { status: 403 }
            );
        }

        console.log(`✅ Authorized admin user analytics access by: ${email} for userId: ${userId}`);

        // --- 4. Delegate to Service Layer ---
        console.log(`📊 Delegating to AnalyticsService.getUserAnalytics(${userId})...`);
        const result = await AnalyticsService.getUserAnalytics(userId);

        // --- 5. Add HTTP-specific metadata ---
        const processingTime = Date.now() - startTime;
        result.adminUser = email;
        result.processingTimeMs = processingTime;

        console.log(`✅ Admin user analytics API completed successfully for ${email} (${processingTime}ms)`);

        return NextResponse.json(result);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('💥 Admin user analytics API error:', {
            userId,
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
