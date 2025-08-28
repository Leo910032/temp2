// app/api/enterprise/subscription/status/route.js
// 🎯 PHASE 1: Updated to use server-side SubscriptionManager

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'; // Ensure adminDb is imported if used here
import { SubscriptionManager } from '@/lib/services/serviceEnterprise/server/core/subscriptionManager';

export async function GET(request) {
  try {
    console.log('📊 GET /api/enterprise/subscription/status');

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

 
    console.log('📊 Getting comprehensive status for user:', userId);

    // ✅ SINGLE, EFFICIENT CALL to the new high-level method.
    const { 
        subscriptionStatus, 
        featureAccess, 
        operationPermissions 
    } = await SubscriptionManager.getComprehensiveStatus(userId);


    // Get organization context if user is part of one
    let organization = null;
    if (subscriptionStatus.enterprise?.organizationId) {
      try {
        const orgDoc = await adminDb.collection('Organizations')
          .doc(subscriptionStatus.enterprise.organizationId)
          .get();
        
        if (orgDoc.exists) {
          const orgData = orgDoc.data();
          organization = {
            id: orgDoc.id,
            name: orgData.name,
            domain: orgData.domain,
            subscriptionLevel: orgData.subscriptionLevel,
            teamsCount: Object.keys(orgData.teams || {}).length,
            settings: orgData.settings || {}
          };
        }
      } catch (orgError) {
        console.warn('Could not fetch organization details:', orgError.message);
      }
    }

    // Build comprehensive response
   const responseData = {
      accountType: subscriptionStatus.subscriptionLevel,
      hasEnterpriseAccess: subscriptionStatus.hasEnterpriseAccess,
      features: featureAccess.features,
      featureMap: featureAccess.featureMap,
      enterpriseFeatures: featureAccess.features.filter(f => Object.values(SubscriptionManager.ENTERPRISE_FEATURES).includes(f)),
      limits: subscriptionStatus.limits,
      user: {
        id: userId,
        email: decodedToken.email,
        role: operationPermissions.userRole,
        organizationId: subscriptionStatus.enterprise?.organizationId || null,
        teams: subscriptionStatus.enterprise?.teams || {},
        isAdmin: subscriptionStatus.enterprise?.isSystemAdmin || false
      },
      organization: organization,
      operations: operationPermissions.permissions,
      upgradeMessage: subscriptionStatus.canUpgrade ? { /* ... */ } : null,
      canUpgrade: subscriptionStatus.canUpgrade,
      nextTier: subscriptionStatus.nextTier,
      constants: {
        subscriptionLevels: SubscriptionManager.SUBSCRIPTION_LEVELS,
        enterpriseFeatures: SubscriptionManager.ENTERPRISE_FEATURES
      },
      timestamp: new Date().toISOString(),
      source: 'server-validated-optimized'
    };


    console.log('✅ Subscription status retrieved:', {
      userId,
      subscriptionLevel: responseData.accountType,
      hasAccess: responseData.hasEnterpriseAccess,
      featureCount: responseData.features.length
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Error getting subscription status:', error);
    
    // Return safe defaults on error with server validation
    return NextResponse.json({
      accountType: 'free',
      hasEnterpriseAccess: false,
      features: [],
      featureMap: {},
      enterpriseFeatures: [],
      limits: {
        maxTeams: 0,
        maxMembers: 0,
        maxContacts: 100
      },
      user: null,
      organization: null,
      operations: {},
      upgradeMessage: {
        title: 'Service Temporarily Unavailable',
        message: 'Unable to verify subscription status. Please try again.',
        action: 'Retry',
        requiredPlan: 'enterprise'
      },
      canUpgrade: true,
      nextTier: 'enterprise',
      constants: {
        subscriptionLevels: SubscriptionManager.SUBSCRIPTION_LEVELS,
        enterpriseFeatures: SubscriptionManager.ENTERPRISE_FEATURES
      },
      timestamp: new Date().toISOString(),
      source: 'error-fallback',
      error: error.message
    }, { status: 500 });
  }
}