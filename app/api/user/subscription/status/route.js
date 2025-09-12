// app/api/user/subscription/status/route.js
import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';

export async function GET(request) {
  try {
    // The unified session object contains everything we need
    const session = await createApiSession(request);

    // Return the comprehensive subscription status to the client
    return NextResponse.json({
      subscriptionLevel: session.subscriptionLevel,
      permissions: session.permissions,
      limits: session.limits,
      
      // Contact-specific data
      contactCapabilities: {
        hasBasicAccess: session.contactCapabilities.hasBasicAccess,
        hasAdvancedFeatures: session.contactCapabilities.hasAdvancedFeatures,
        hasUnlimitedAccess: session.contactCapabilities.hasUnlimitedAccess,
        features: session.contactCapabilities.features,
        limits: session.contactCapabilities.limits
      },
      
      // Enterprise-specific data
      enterpriseCapabilities: {
        hasAccess: session.enterpriseCapabilities.hasAccess,
        canCreateTeams: session.enterpriseCapabilities.canCreateTeams,
        canManageOrganization: session.enterpriseCapabilities.canManageOrganization,
        teamLimits: session.enterpriseCapabilities.teamLimits,
        isOrganizationOwner: session.enterpriseCapabilities.isOrganizationOwner
      },
      
      // User context
      userContext: {
        teamRoles: session.teamRoles,
        organizationRole: session.organizationRole,
        highestTeamRole: session.highestTeamRole,
        isOrganizationOwner: session.isOrganizationOwner
      },
      
      // Subscription metadata
      canUpgrade: session.canUpgrade,
      nextTier: session.nextTier,
      
      // Legacy compatibility
      accountType: session.subscriptionLevel,
      hasEnterpriseAccess: session.enterpriseCapabilities.hasAccess
    });

  } catch (error) {
    console.error("Error in GET /api/user/subscription/status:", error.message);
    const status = error.message.includes('Authorization') ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
