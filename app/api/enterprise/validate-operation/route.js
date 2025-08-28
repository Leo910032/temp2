// app/api/enterprise/validate-operation/route.js
// 🎯 PHASE 1: New API endpoint for server-side operation validation

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { SubscriptionManager } from '@/lib/services/serviceEnterprise/server/core/subscriptionManager';

/**
 * POST /api/enterprise/validate-operation
 * Server-side validation of enterprise operations
 * Replaces client-side validateEnterpriseOperation() function
 */
export async function POST(request) {
  try {
    console.log('🔍 POST /api/enterprise/validate-operation');

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        allowed: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse request body
    const body = await request.json();
    const { operation, context = {} } = body;

    // Validate required fields
    if (!operation) {
      return NextResponse.json({
        allowed: false,
        error: 'Operation is required',
        code: 'MISSING_OPERATION'
      }, { status: 400 });
    }

    // Add request metadata to context
    const enhancedContext = {
      ...context,
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown'
    };

    console.log('🔍 Validating operation:', { userId, operation, context: enhancedContext });

    // Server-side validation using SubscriptionManager
    const validation = await SubscriptionManager.validateEnterpriseOperation(
      userId, 
      operation, 
      enhancedContext
    );

    console.log('✅ Validation result:', validation);

    // Return validation result
    return NextResponse.json({
      operation,
      userId,
      timestamp: new Date().toISOString(),
      ...validation
    });

  } catch (error) {
    console.error('❌ Error validating enterprise operation:', error);
    
    // Handle specific error types
    if (error.code?.startsWith('auth/')) {
      return NextResponse.json({
        allowed: false,
        error: 'Authentication failed',
        code: 'AUTH_FAILED'
      }, { status: 401 });
    }

    return NextResponse.json({
      allowed: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

/**
 * GET /api/enterprise/validate-operation
 * Health check endpoint
 */
export async function GET(request) {
  return NextResponse.json({
    status: 'healthy',
    endpoint: '/api/enterprise/validate-operation',
    method: 'POST',
    description: 'Validates enterprise operations server-side',
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper function to get client IP address
 */
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}