// app/api/enterprise/subscription/status/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

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

    // Get user document
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const accountType = userData.accountType || 'free';
    const enterprise = userData.enterprise || {};

    // Build response data
    const responseData = {
      accountType,
      hasEnterpriseAccess: ['business', 'premium', 'enterprise'].includes(accountType.toLowerCase()),
      
      user: {
        id: userId,
        email: userData.email,
        displayName: userData.displayName,
        role: enterprise.organizationRole || 'employee',
        organizationId: enterprise.organizationId || null,
        teams: enterprise.teams || {},
        isAdmin: userData.isAdmin || false
      },
      
      organization: null,
      teams: enterprise.teams || {},
      upgradeMessage: null
    };

    // If user is part of an organization, get organization details
    if (enterprise.organizationId) {
      try {
        const orgDoc = await adminDb.collection('Organizations').doc(enterprise.organizationId).get();
        if (orgDoc.exists) {
          const orgData = orgDoc.data();
          
          responseData.organization = {
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

    // Add upgrade message for non-enterprise users
    if (!responseData.hasEnterpriseAccess) {
      responseData.upgradeMessage = {
        title: 'Unlock Enterprise Features',
        message: 'Upgrade to Business plan to access team management, contact sharing, and more.',
        action: 'Upgrade Now',
        requiredPlan: 'business'
      };
    }

    console.log('✅ Subscription status retrieved:', {
      userId,
      accountType,
      hasAccess: responseData.hasEnterpriseAccess
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Error getting subscription status:', error);
    
    // Return safe defaults on error
    return NextResponse.json({
      accountType: 'free',
      hasEnterpriseAccess: false,
      user: null,
      organization: null,
      teams: {},
      upgradeMessage: {
        title: 'Service Temporarily Unavailable',
        message: 'Unable to verify subscription status. Please try again.',
        action: 'Retry',
        requiredPlan: 'business'
      }
    }, { status: 500 });
  }
}