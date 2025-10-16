export const dynamic = 'force-dynamic';

// app/api/admin/vector-contacts/route.js - Thin HTTP Layer
// Admin API for vector-optimized contact generation and management
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
 * POST /api/admin/vector-contacts - Generate vector-optimized test contacts
 *
 * Security:
 * - Requires valid JWT token
 * - Requires full admin access (view-only admins blocked)
 * - Validates all parameters
 */
export async function POST(request) {
  const startTime = Date.now();

  try {
    console.log('🎲 POST /api/admin/vector-contacts - Generating vector-optimized contacts');

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
      console.warn(`🚨 VIEW-ONLY ADMIN BLOCKED: ${email} tried to generate vector contacts`);
      return NextResponse.json(
        {
          error: 'Forbidden: View-only admins cannot perform this action',
          message: 'Vector contact generation requires full admin privileges'
        },
        { status: 403 }
      );
    }

    console.log(`✅ Authorized admin access by: ${email} (Role: ${adminRole})`);

    // 4. Parse and validate request body
    const body = await request.json();
    const {
      count = 30,
      eventPercentage = 0.7,
      locationPercentage = 0.9,
      forceEventLocation = false,
      forceRandomLocation = false,
      targetUserId = null,
      enableVectorStorage = true,
      forceVectorCreation = true,
      vectorOptimizationLevel = 'premium',
      includeNotes = true,
      noteScenario = 'vectorOptimized',
      noteComplexity = 'premium',
      noteProbability = 0.95,
      includeMessages = true,
      messageProbability = 0.9,
      forceExchangeForm = true
    } = body;

    const finalUserId = targetUserId || uid;

    console.log('🎲 Vector generation parameters:', {
      userId: finalUserId,
      count,
      enableVectorStorage,
      vectorOptimizationLevel,
      noteScenario
    });

    // 5. Delegate to service layer
    const result = await AdminServiceVector.generateVectorOptimizedContacts(
      finalUserId,
      {
        count,
        eventPercentage,
        locationPercentage,
        forceEventLocation,
        forceRandomLocation,
        enableVectorStorage,
        forceVectorCreation,
        vectorOptimizationLevel,
        includeNotes,
        noteScenario,
        noteComplexity,
        noteProbability,
        includeMessages,
        messageProbability,
        forceExchangeForm
      },
      uid // admin ID
    );

    // 6. Calculate processing time
    const processingTime = Date.now() - startTime;

    console.log('✅ Vector-optimized contacts generated successfully:', {
      userId: finalUserId,
      generated: result.generated,
      vectorsCreated: result.vectorsCreated,
      processingTimeMs: processingTime
    });

    // 7. Return response
    return NextResponse.json({
      success: true,
      message: `Successfully generated ${result.generated} vector-optimized contacts (${result.vectorsCreated} vectors created)`,
      data: result,
      adminUser: email,
      adminRole: adminRole,
      processingTimeMs: processingTime
    });

  } catch (error) {
    console.error('❌ Error generating vector-optimized contacts:', error);
    return NextResponse.json({
      error: 'Failed to generate vector-optimized contacts',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/vector-contacts - Cleanup vector test data
 *
 * Security:
 * - Requires valid JWT token
 * - Requires full admin access (view-only admins blocked)
 */
export async function DELETE(request) {
  const startTime = Date.now();

  try {
    console.log('🧹 DELETE /api/admin/vector-contacts - Cleaning up vector test data');

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

    // 3. Check if user can perform actions (block view-only admins)
    const canPerformActions = AdminService.canPerformActions(email);
    if (!canPerformActions) {
      console.warn(`🚨 VIEW-ONLY ADMIN BLOCKED: ${email} tried to cleanup vector test data`);
      return NextResponse.json(
        {
          error: 'Forbidden: View-only admins cannot perform this action',
          message: 'Vector test data cleanup requires full admin privileges'
        },
        { status: 403 }
      );
    }

    console.log(`✅ Authorized admin cleanup by: ${email} (Role: ${adminRole})`);

    // 4. Get userId from query params
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    console.log('🧹 Cleanup parameters:', { userId });

    // 5. Delegate to service layer
    const result = await AdminServiceVector.cleanupVectorTestData(userId);

    // 6. Calculate processing time
    const processingTime = Date.now() - startTime;

    console.log('✅ Vector test data cleaned up successfully:', {
      userId,
      deletedContacts: result.deletedContacts,
      deletedVectors: result.deletedVectors,
      processingTimeMs: processingTime
    });

    // 7. Return response
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.deletedContacts} test contacts and ${result.deletedVectors} vectors`,
      data: result,
      adminUser: email,
      adminRole: adminRole,
      processingTimeMs: processingTime
    });

  } catch (error) {
    console.error('❌ Error cleaning up vector test data:', error);
    return NextResponse.json({
      error: 'Failed to cleanup vector test data',
      details: error.message
    }, { status: 500 });
  }
}
