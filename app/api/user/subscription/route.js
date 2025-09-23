//app/api/user/subscription/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { 
    ORGANIZATION_ROLES, 
    TEAM_ROLES, 
    PERMISSIONS, 
    DEFAULT_PERMISSIONS_BY_ROLE 
}from '@/lib/services/constants';

/**
 * Helper function to determine feature access based on account type.
 * Updated to include enterprise tier and use centralized constants.
 */
function getFeatureAccess(accountType) {
    const baseFeatures = {
        analytics: false,
        customDomains: false,
        advancedThemes: false,
        prioritySupport: false,
        whiteLabel: false,
        // Enterprise-specific features
        teamManagement: false,
        multiTeamSupport: false,
        advancedPermissions: false,
        auditLogs: false,
        ssoIntegration: false
    };

    switch (accountType) {
        case 'enterprise':
            // Enterprise gets all features
            return {
                ...baseFeatures,
                analytics: true,
                customDomains: true,
                advancedThemes: true,
                prioritySupport: true,
                whiteLabel: true,
                teamManagement: true,
                multiTeamSupport: true,
                advancedPermissions: true,
                auditLogs: true,
                ssoIntegration: true
            };
        case 'business':
            return { 
                ...baseFeatures, 
                analytics: true, 
                customDomains: true, 
                advancedThemes: true, 
                prioritySupport: true, 
                whiteLabel: true,
                teamManagement: true,
                multiTeamSupport: false
            };
        case 'premium':
            return { 
                ...baseFeatures, 
                analytics: true, 
                customDomains: true, 
                advancedThemes: true,
                teamManagement: true
            };
        case 'pro':
            return { 
                ...baseFeatures, 
                analytics: true,
                teamManagement: false
            };
        case 'base':
        default:
            return baseFeatures;
    }
}

/**
 * Helper function to get user's enterprise permissions based on their role
 */
function getEnterprisePermissions(accountType, userRole = null) {
    if (accountType !== 'enterprise' && accountType !== 'business') {
        return {};
    }

    // If no specific role is provided, assume they have basic enterprise access
    if (!userRole) {
        return DEFAULT_PERMISSIONS_BY_ROLE[TEAM_ROLES.EMPLOYEE];
    }

    // Return permissions based on their role
    return DEFAULT_PERMISSIONS_BY_ROLE[userRole] || DEFAULT_PERMISSIONS_BY_ROLE[TEAM_ROLES.EMPLOYEE];
}

/**
 * GET /api/user/subscription
 * Get user's subscription information
 */
export async function GET(request) {
    // 🪵 Log 1: Request received
    const requestId = `sub-${Math.random().toString(36).substring(2, 9)}`;
    const startTime = Date.now();
    console.log(`[${requestId}] 🚀 GET /api/user/subscription - Request received.`);

    try {
        // --- Authentication ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            // 🪵 Log 2.1: Authentication failed (Missing Token)
            console.warn(`[${requestId}] 🛡️ Authentication failed: No Bearer token provided.`);
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const { uid } = decodedToken;
        // 🪵 Log 2.2: Authentication successful
        console.log(`[${requestId}] 🛡️ Authentication successful for UID: ${uid}`);

        // --- Fetch User Account Data ---
        // 🪵 Log 3.1: Starting Firestore read
        console.log(`[${requestId}] Firestore: Fetching document from AccountData collection for UID: ${uid}`);
        const userDocRef = adminDb.collection('AccountData').doc(uid);
        const userDoc = await userDocRef.get();
        
        if (!userDoc.exists) {
            // 🪵 Log 3.2: User document not found
            console.warn(`[${requestId}]  Firestore: Document not found in AccountData for UID: ${uid}`);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        // 🪵 Log 3.3: User document found
        const userData = userDoc.data();
        const accountType = userData.accountType || 'base';
        const userRole = userData.role || null; // Get user's role if available
        console.log(`[${requestId}]  Firestore: Found user data. Account type: "${accountType}", Role: "${userRole || 'none'}"`);
        

        // --- Fetch Detailed Subscription Data (Optional) ---
        let subscriptionDetails = null;
        try {
            // 🪵 Log 4.1: Starting second Firestore read (optional)
            console.log(`[${requestId}] Firestore: Attempting to fetch detailed subscription from Subscriptions collection.`);
            const subscriptionDocRef = adminDb.collection('Subscriptions').doc(uid);
            const subscriptionDoc = await subscriptionDocRef.get();

            if (subscriptionDoc.exists) {
                subscriptionDetails = subscriptionDoc.data();
                // 🪵 Log 4.2: Detailed subscription found
                console.log(`[${requestId}] Firestore: Found detailed subscription data.`);
            } else {
                 // 🪵 Log 4.3: No detailed subscription found
                console.log(`[${requestId}] Firestore: No detailed subscription document found for UID: ${uid}. This is a normal scenario.`);
            }
        } catch (subError) {
            // 🪵 Log 4.4: Error fetching detailed subscription
            console.warn(`[${requestId}] Firestore: Error fetching from Subscriptions collection, proceeding without it. Error: ${subError.message}`);
        }

        // --- Process Feature Access ---
        // 🪵 Log 5: Processing features
        const features = getFeatureAccess(accountType);
        const enterprisePermissions = getEnterprisePermissions(accountType, userRole);
        console.log(`[${requestId}] ⚙️ Processed feature access for account type "${accountType}". Analytics access: ${features.analytics}, Team management: ${features.teamManagement}`);

        // --- Success Response ---
        const processingTime = Date.now() - startTime;
        // 🪵 Log 6: Sending successful response
        console.log(`[${requestId}] ✅ Success! Sending response. Total processing time: ${processingTime}ms`);

        return NextResponse.json({
            accountType,
            features,
            hasAnalyticsAccess: features.analytics,
            hasTeamManagement: features.teamManagement,
            enterprisePermissions,
            subscription: subscriptionDetails,
            user: {
                uid,
                email: userData.email,
                username: userData.username,
                role: userRole
            }
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        // 🪵 Log 7: Unhandled error
        console.error(`[${requestId}] 💥 Unhandled API Error in /api/user/subscription:`, {
            errorMessage: error.message,
            errorCode: error.code,
            processingTime: `${processingTime}ms`,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined // Show stack trace in dev
        });
        
        // Return a specific error for expired tokens
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
            return NextResponse.json({ error: 'Token is invalid or expired. Please sign in again.' }, { status: 401 });
        }

        // Return a generic internal server error for all other cases
        return NextResponse.json({ 
            error: 'Internal server error',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }, { status: 500 });
    }
}