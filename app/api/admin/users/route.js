export const dynamic = 'force-dynamic';

// app/api/admin/users/route.js - REFACTORED TO USE SERVICE ARCHITECTURE
// This file is now a thin HTTP layer that delegates to the admin service
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { AdminService } from '@/lib/services/serviceAdmin/server/adminService';

/**
 * Verify Firebase Auth token and check admin status
 * @param {string} token - Firebase ID token
 * @returns {Promise<{isValid: boolean, email?: string, isAdmin: boolean, error?: string}>}
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
 * ✅ REFACTORED: GET /api/admin/users
 * Thin API layer - delegates to AdminService
 */
export async function GET(request) {
    const startTime = Date.now();

    try {
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

        // Get admin role and permissions
        const adminRole = AdminService.getAdminRole(email);
        const adminPermissions = AdminService.getAdminPermissions(email);

        console.log(`✅ Authorized admin access by: ${email} (Role: ${adminRole})`);

        // --- 3. Delegate to Service Layer ---
        console.log('📊 Delegating to AdminService.getAllUsers()...');
        const result = await AdminService.getAllUsers();

        // --- 4. Add HTTP-specific metadata ---
        const processingTime = Date.now() - startTime;
        result.adminUser = email;
        result.adminRole = adminRole;
        result.adminPermissions = adminPermissions;
        result.processingTimeMs = processingTime;

        console.log(`✅ Admin users API completed successfully for ${email} (${processingTime}ms, ${result.users.length} users)`);

        return NextResponse.json(result);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('💥 Admin users API error:', {
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

/**
 * ✅ REFACTORED: POST /api/admin/users
 * Handle admin actions on users (future: update, suspend, etc.)
 * Currently returns placeholder - will be implemented step by step
 */
export async function POST(request) {
    try {
        // --- 1. Authentication ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const { isValid, email, isAdmin } = await verifyAdminToken(token);

        if (!isValid || !isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // --- 2. Parse request body ---
        const body = await request.json();
        const { action, userId, data } = body;

        console.log(`[Admin API] POST action: ${action} for user: ${userId} by admin: ${email}`);

        // --- 3. Delegate to service based on action ---
        // ⚠️ COMMENTED OUT - To be implemented step by step
        // switch (action) {
        //     case 'updateUser':
        //         const updatedUser = await AdminService.updateUser(userId, data);
        //         return NextResponse.json({
        //             success: true,
        //             user: updatedUser,
        //             action,
        //             adminUser: email,
        //             timestamp: new Date().toISOString()
        //         });
        //
        //     case 'suspendUser':
        //         const suspendResult = await AdminService.suspendUser(userId, data.reason);
        //         return NextResponse.json({
        //             success: true,
        //             result: suspendResult,
        //             action,
        //             adminUser: email,
        //             timestamp: new Date().toISOString()
        //         });
        //
        //     case 'deleteUser':
        //         const deleteResult = await AdminService.deleteUser(userId);
        //         return NextResponse.json({
        //             success: true,
        //             result: deleteResult,
        //             action,
        //             adminUser: email,
        //             timestamp: new Date().toISOString()
        //         });
        //
        //     default:
        //         return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        // }

        // Placeholder response until we implement the actions
        return NextResponse.json({
            message: 'Admin action endpoint - to be implemented',
            action,
            userId,
            adminUser: email,
            timestamp: new Date().toISOString(),
            note: 'This endpoint will be enabled step by step'
        });

    } catch (error) {
        console.error('Admin POST API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
