// lib/middleware/subscriptionMiddleware.js
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { 
  canAccessContacts,
  canCreateBasicGroups,
  canCreateAdvancedGroups,
  canUseEventDetection,
  canShareWithTeam,
  getContactUpgradeMessage,
  CONTACT_FEATURES
} from '@/lib/services/contactSubscriptionService';

/**
 * Middleware to check subscription access for contact-related API endpoints
 */
export async function checkContactSubscription(request, requiredFeature) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Unauthorized',
        status: 401
      };
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get user's subscription level
    const userDocRef = adminDb.collection('AccountData').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      return {
        success: false,
        error: 'User not found',
        status: 404
      };
    }

    const userData = userDoc.data();
    const subscriptionLevel = userData.accountType || 'base';

    // Check basic contact access first
    if (!canAccessContacts(subscriptionLevel)) {
      return {
        success: false,
        error: 'Contact features require Pro subscription or higher',
        subscriptionRequired: true,
        currentPlan: subscriptionLevel,
        requiredPlan: 'pro',
        upgradeMessage: getContactUpgradeMessage(CONTACT_FEATURES.BASIC_CONTACTS),
        status: 403
      };
    }

    // Check specific feature access
    let hasAccess = true;
    let requiredPlan = 'pro';

    switch (requiredFeature) {
      case CONTACT_FEATURES.BASIC_CONTACTS:
        hasAccess = canAccessContacts(subscriptionLevel);
        requiredPlan = 'pro';
        break;
      case CONTACT_FEATURES.BASIC_GROUPS:
        hasAccess = canCreateBasicGroups(subscriptionLevel);
        requiredPlan = 'pro';
        break;
      case CONTACT_FEATURES.ADVANCED_GROUPS:
        hasAccess = canCreateAdvancedGroups(subscriptionLevel);
        requiredPlan = 'premium';
        break;
      case CONTACT_FEATURES.EVENT_DETECTION:
        hasAccess = canUseEventDetection(subscriptionLevel);
        requiredPlan = 'premium';
        break;
      case CONTACT_FEATURES.TEAM_SHARING:
        hasAccess = canShareWithTeam(subscriptionLevel);
        requiredPlan = 'premium';
        break;
      default:
        hasAccess = canAccessContacts(subscriptionLevel);
    }

    if (!hasAccess) {
      return {
        success: false,
        error: `This feature requires ${requiredPlan} subscription or higher`,
        subscriptionRequired: true,
        currentPlan: subscriptionLevel,
        requiredPlan: requiredPlan,
        upgradeMessage: getContactUpgradeMessage(requiredFeature),
        status: 403
      };
    }

    return {
      success: true,
      userId,
      subscriptionLevel,
      userData
    };

  } catch (error) {
    console.error('Subscription middleware error:', error);
    return {
      success: false,
      error: 'Failed to verify subscription',
      status: 500
    };
  }
}

/**
 * Wrapper function to apply subscription middleware to API routes
 */
export function withSubscription(handler, requiredFeature = CONTACT_FEATURES.BASIC_CONTACTS) {
  return async function(request) {
    const subscriptionCheck = await checkContactSubscription(request, requiredFeature);
    
    if (!subscriptionCheck.success) {
      return new Response(JSON.stringify({
        error: subscriptionCheck.error,
        subscriptionRequired: subscriptionCheck.subscriptionRequired || false,
        currentPlan: subscriptionCheck.currentPlan,
        requiredPlan: subscriptionCheck.requiredPlan,
        upgradeMessage: subscriptionCheck.upgradeMessage
      }), {
        status: subscriptionCheck.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add subscription info to request for handler to use
    request.subscriptionInfo = {
      userId: subscriptionCheck.userId,
      subscriptionLevel: subscriptionCheck.subscriptionLevel,
      userData: subscriptionCheck.userData
    };

    return handler(request);
  };
}