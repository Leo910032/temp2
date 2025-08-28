// app/api/enterprise/subscription/status/route.js
// 🎯 PHASE 1: Updated to use server-side SubscriptionManager

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
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

    console.log('📊 Getting subscription status for user:', userId);

    // ✅ NEW: Use server-side SubscriptionManager instead of client logic
    const [subscriptionStatus, featureAccess, operationPermissions] = await Promise.all([
      SubscriptionManager.getSubscriptionStatus(userId),
      SubscriptionManager.getFeatureAccess(userId),
      SubscriptionManager.getOperationPermissions(userId)
    ]);

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
      // ✅ Server-validated subscription info
      accountType: subscriptionStatus.subscriptionLevel,
      hasEnterpriseAccess: subscriptionStatus.hasEnterpriseAccess,
      
      // ✅ Server-validated features
      features: featureAccess.features,
      featureMap: featureAccess.featureMap,
      enterpriseFeatures: featureAccess.features.filter(f => 
        Object.values(SubscriptionManager.ENTERPRISE_FEATURES).includes(f)
      ),
      
      // ✅ Server-validated limits
      limits: subscriptionStatus.limits,
      
      // ✅ User context
      user: {
        id: userId,
        email: decodedToken.email,
        role: operationPermissions.userRole,
        organizationId: subscriptionStatus.enterprise?.organizationId || null,
        teams: subscriptionStatus.enterprise?.teams || {},
        isAdmin: subscriptionStatus.enterprise?.isSystemAdmin || false
      },
      
      // ✅ Organization info
      organization: organization,
      
      // ✅ Operation permissions
      operations: operationPermissions.permissions,
      
      // ✅ Upgrade information (server-calculated)
      upgradeMessage: subscriptionStatus.canUpgrade ? {
        title: 'Unlock Enterprise Features',
        message: 'Upgrade to Enterprise plan to access team management, contact sharing, and more.',
        action: 'Upgrade Now',
        requiredPlan: 'enterprise',
        currentPlan: subscriptionStatus.subscriptionLevel
      } : null,
      
      canUpgrade: subscriptionStatus.canUpgrade,
      nextTier: subscriptionStatus.nextTier,
      
      // ✅ Constants for client use
      constants: {
        subscriptionLevels: SubscriptionManager.SUBSCRIPTION_LEVELS,
        enterpriseFeatures: SubscriptionManager.ENTERPRISE_FEATURES
      },
      
      // Metadata
      timestamp: new Date().toISOString(),
      source: 'server-validated'
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