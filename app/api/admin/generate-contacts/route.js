export const dynamic = 'force-dynamic';

// app/api/admin/generate-contacts/route.js - Thin HTTP Layer
// Refactored to follow admin service architecture pattern
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { AdminService } from '@/lib/services/serviceAdmin/server/adminService';
import { ContactGenerationService } from '@/lib/services/serviceAdmin/server/contactGenerationService';

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
 * POST /api/admin/generate-contacts - Generate test contacts
 *
 * Security:
 * - Requires valid JWT token
 * - Requires full admin access (view-only admins blocked)
 * - Validates all parameters
 */
export async function POST(request) {
    const startTime = Date.now();

    try {
        console.log('🎲 POST /api/admin/generate-contacts - Generating random contacts');

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
        const { isValid, email, uid, isAdmin, adminRole } = await verifyAdminToken(token);

        if (!isValid || !isAdmin) {
            console.warn(`❌ Unauthorized access attempt by: ${email || 'unknown'}`);
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        // 3. Check if user can perform actions (block view-only admins)
        const canPerformActions = AdminService.canPerformActions(email);
        if (!canPerformActions) {
            console.warn(`🚨 VIEW-ONLY ADMIN BLOCKED: ${email} tried to generate contacts`);
            return NextResponse.json(
                {
                    error: 'Forbidden: View-only admins cannot perform this action',
                    message: 'Contact generation requires full admin privileges'
                },
                { status: 403 }
            );
        }

        console.log(`✅ Authorized admin access by: ${email} (Role: ${adminRole})`);

        // 4. Parse and validate request body
        const body = await request.json();
        const {
            count = 50,
            eventPercentage = 0.4,
            locationPercentage = 0.7,
            forceEventLocation = false,
            forceRandomLocation = false,
            targetUserId = null,
            includeMessages = false,
            messageProbability = 1.0,
            forceExchangeForm = false,
            includeNotes = true,
            noteScenario = 'mixed',
            noteComplexity = 'medium',
            noteProbability = 0.7
        } = body;

        const finalUserId = targetUserId || uid;

        console.log('🎲 Generation parameters:', {
            userId: finalUserId,
            count,
            eventPercentage,
            locationPercentage,
            forceEventLocation,
            forceRandomLocation,
            includeMessages,
            messageProbability,
            forceExchangeForm,
            includeNotes,
            noteProbability
        });

        // 5. Delegate to service layer
        const result = await ContactGenerationService.generateTestContacts(
            finalUserId,
            {
                count,
                eventPercentage,
                locationPercentage,
                forceEventLocation,
                forceRandomLocation,
                includeMessages,
                messageProbability,
                forceExchangeForm,
                includeNotes,
                noteScenario,
                noteComplexity,
                noteProbability
            },
            uid // generatedByAdminId
        );

        // 6. Calculate processing time
        const processingTime = Date.now() - startTime;

        console.log('✅ Random contacts generated successfully:', {
            userId: finalUserId,
            generated: result.generated,
            total: result.totalContacts,
            processingTimeMs: processingTime
        });

        // 7. Return response
        return NextResponse.json({
            success: true,
            message: `Successfully generated ${result.generated} random test contacts`,
            data: result,
            adminUser: email,
            adminRole: adminRole,
            processingTimeMs: processingTime
        });

    } catch (error) {
        console.error('❌ Error generating random contacts:', error);
        return NextResponse.json({
            error: 'Failed to generate random contacts',
            details: error.message
        }, { status: 500 });
    }
}

/**
 * GET /api/admin/generate-contacts - Get generation info
 *
 * Security:
 * - Requires valid JWT token
 * - Allows both full and view-only admins
 */
export async function GET(request) {
    const startTime = Date.now();

    try {
        console.log('📊 GET /api/admin/generate-contacts - Getting generation info');

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

        console.log(`✅ Authorized admin info access by: ${email} (Role: ${adminRole})`);

        // 3. Get userId from query params
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');

        // 4. Delegate to service layer
        const result = await ContactGenerationService.getGenerationInfo(userId);

        // 5. Calculate processing time
        const processingTime = Date.now() - startTime;

        console.log('✅ Generation info retrieved successfully:', {
            userId,
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
        console.error('❌ Error getting generation info:', error);
        return NextResponse.json({
            error: 'Failed to get generation info',
            details: error.message
        }, { status: 500 });
    }
}
