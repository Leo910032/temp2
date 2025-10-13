export const dynamic = 'force-dynamic';

// app/api/admin/user/[userId]/route.js - User detail API
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { AdminService } from '@/lib/services/serviceAdmin/server/adminService';

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
 * GET /api/admin/user/[userId]
 * Fetch detailed information for a specific user
 */
export async function GET(request, { params }) {
    const startTime = Date.now();

    try {
        // Extract userId from params
        const userId = params.userId;

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        // --- 1. Extract Authorization Token ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn('🚨 Admin API access attempted without valid authorization header');
            return NextResponse.json(
                { error: 'Unauthorized: No valid token provided' },
                { status: 401 }
            );
        }

        const token = authHeader.split('Bearer ')[1];

        // --- 2. Verify Token and Check Admin Status ---
        const { isValid, email, isAdmin, error } = await verifyAdminToken(token);

        if (!isValid) {
            console.warn(`🚨 Admin API access attempted with invalid token: ${error}`);
            return NextResponse.json(
                { error: `Unauthorized: ${error}` },
                { status: 401 }
            );
        }

        if (!isAdmin) {
            console.warn(`🚨 UNAUTHORIZED ADMIN ACCESS ATTEMPT by user: ${email}`);
            return NextResponse.json(
                { error: 'Forbidden: You do not have admin privileges' },
                { status: 403 }
            );
        }

        console.log(`✅ Authorized admin access by: ${email} for user: ${userId}`);

        // --- 3. Delegate to Service Layer ---
        console.log(`📊 Delegating to AdminService.getUserDetail(${userId})...`);
        const userDetail = await AdminService.getUserDetail(userId);

        // --- 4. Add HTTP-specific metadata ---
        const processingTime = Date.now() - startTime;

        console.log(`✅ Admin user detail API completed successfully for ${email} (${processingTime}ms)`);

        return NextResponse.json({
            ...userDetail,
            processingTimeMs: processingTime,
            adminUser: email,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('💥 Admin user detail API error:', {
            error: error.message,
            code: error.code,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            processingTime
        });

        // Handle specific errors
        if (error.message === 'User not found') {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json(
                { error: 'Unauthorized: Token expired, please log in again' },
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
