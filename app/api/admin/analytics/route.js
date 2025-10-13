export const dynamic = 'force-dynamic';

// app/api/admin/analytics/route.js - REFACTORED TO USE SERVICE ARCHITECTURE
// Thin HTTP layer that delegates to the analytics service
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
 * ✅ REFACTORED: GET /api/admin/analytics
 * Fetch platform-wide analytics data
 */
export async function GET(request) {
    const startTime = Date.now();

    try {
        // --- 1. Extract Authorization Token ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn('🚨 Admin analytics API access attempted without valid authorization header');
            return NextResponse.json(
                { error: 'Unauthorized: No valid token provided' },
                { status: 401 }
            );
        }

        const token = authHeader.split('Bearer ')[1];

        // --- 2. Verify Token and Check Admin Status ---
        const { isValid, email, isAdmin, error } = await verifyAdminToken(token);

        if (!isValid) {
            console.warn(`🚨 Admin analytics API access attempted with invalid token: ${error}`);
            return NextResponse.json(
                { error: `Unauthorized: ${error}` },
                { status: 401 }
            );
        }

        if (!isAdmin) {
            console.warn(`🚨 UNAUTHORIZED ADMIN ANALYTICS ACCESS ATTEMPT by user: ${email}`);
            return NextResponse.json(
                { error: 'Forbidden: You do not have admin privileges' },
                { status: 403 }
            );
        }

        // Get admin role and permissions
        const adminRole = AdminService.getAdminRole(email);
        const adminPermissions = AdminService.getAdminPermissions(email);

        console.log(`✅ Authorized admin analytics access by: ${email} (Role: ${adminRole})`);

        // --- 3. Delegate to Service Layer ---
        console.log('📊 Delegating to AnalyticsService.getPlatformAnalytics()...');
        const result = await AnalyticsService.getPlatformAnalytics();

        // --- 4. Add HTTP-specific metadata ---
        const processingTime = Date.now() - startTime;
        result.adminUser = email;
        result.adminRole = adminRole;
        result.adminPermissions = adminPermissions;
        result.processingTimeMs = processingTime;

        console.log(`✅ Admin analytics API completed successfully for ${email} (${processingTime}ms)`);

        return NextResponse.json(result);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('💥 Admin analytics API error:', {
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
