// app/api/enterprise/features/route.js
// 🎯 PHASE 1: New API endpoint for server-side feature access control

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { SubscriptionManager } from '@/lib/services/serviceEnterprise/server/core/subscriptionManager';

/**
 * GET /api/enterprise/features
 * Get user's feature access and subscription details
 * Server-side replacement for client-side feature checking
 */
export async function GET(request) {
  try {
    console.log('🔍 GET /api/enterprise/features');

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log('🔍 Getting features for user:', userId);

    // Get feature access using server-side logic
    const featureAccess = await SubscriptionManager.getFeatureAccess(userId);
    const operationPermissions = await SubscriptionManager.getOperationPermissions(userId);

    console.log('✅ Features retrieved:', {
      userId,
      subscriptionLevel: featureAccess.subscriptionLevel,
      hasEnterpriseAccess: featureAccess.hasEnterpriseAccess,
      featureCount: featureAccess.features.length
    });

    return NextResponse.json({
      success: true,
      userId,
      timestamp: new Date().toISOString(),
      
      // Feature access
      subscriptionLevel: featureAccess.subscriptionLevel,
      hasEnterpriseAccess: featureAccess.hasEnterpriseAccess,
      features: featureAccess.features,
      featureMap: featureAccess.featureMap,
      
      // Limits
      limits: featureAccess.limits,
      
      // Operation permissions
      operations: operationPermissions.permissions,
      
      // Upgrade information
      canUpgrade: !featureAccess.hasEnterpriseAccess,
      nextTier: SubscriptionManager.getNextSubscriptionTier(featureAccess.subscriptionLevel),
      
      // Constants for client use
      constants: {
        subscriptionLevels: SubscriptionManager.SUBSCRIPTION_LEVELS,
        enterpriseFeatures: SubscriptionManager.ENTERPRISE_FEATURES
      }
    });

  } catch (error) {
    console.error('❌ Error getting enterprise features:', error);
    
    // Handle specific error types
    if (error.code?.startsWith('auth/')) {
      return NextResponse.json({
        error: 'Authentication failed'
      }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Failed to get enterprise features',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/enterprise/features/check
 * Check if user has specific features
 */
export async function POST(request) {
  try {
    console.log('🔍 POST /api/enterprise/features/check');

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse request body
    const body = await request.json();
    const { features: featuresToCheck } = body;

    if (!Array.isArray(featuresToCheck)) {
      return NextResponse.json({
        error: 'Features must be an array'
      }, { status: 400 });
    }

    // Get user's feature access
    const featureAccess = await SubscriptionManager.getFeatureAccess(userId);
    
    // Check each requested feature
    const featureChecks = {};
    for (const feature of featuresToCheck) {
      featureChecks[feature] = featureAccess.features.includes(feature);
    }

    return NextResponse.json({
      success: true,
      userId,
      subscriptionLevel: featureAccess.subscriptionLevel,
      hasEnterpriseAccess: featureAccess.hasEnterpriseAccess,
      featureChecks,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error checking features:', error);
    return NextResponse.json({
      error: 'Failed to check features',
      details: error.message
    }, { status: 500 });
  }
}