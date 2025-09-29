/**
 * THIS FILE HAS BEEN REFACTORED TO USE THE NEW DATA MODEL
 */
// lib/services/server/subscriptionService.js
import { adminDb } from '@/lib/firebaseAdmin';

// Import the new services
//import { TeamService } from './teamService';
import { OrganizationService } from './organizationService';

// Import from the unified barrel file
import { 
  SUBSCRIPTION_LEVELS, 
  CONTACT_LIMITS, 
  DEFAULT_PERMISSIONS_BY_ROLE, 
  TEAM_ROLES,
  PERMISSIONS,
  hasContactFeature,
  getContactLimits,
  APPEARANCE_LIMITS,
  ANALYTICS_LIMITS
} from '../constants';

/**
 * The single source of truth for fetching and interpreting a user's subscription on the server.
 * This replaces all the fragmented subscription services.
 * UPDATED: Now uses the new data model (/users collection, TeamService, OrganizationService)
 * @param {string} userId - The ID of the user.
 * @returns {Promise<object>} A comprehensive object detailing the user's subscription and capabilities.
 */
export async function getUserSubscriptionDetails(userId) {
  if (!userId) {
    throw new Error('User ID is required to get subscription details.');
  }

  try {
    // ✅ UPDATED: Fetch from /users collection instead of /AccountData
    const userDocSnap = await adminDb.collection('users').doc(userId).get();
    
    if (!userDocSnap.exists) {
      // Return a default "base" subscription object for non-existent users
      return createDefaultSubscriptionResponse(userId, null);
    }

    const userData = userDocSnap.data();
    
    // ✅ UPDATED: Get subscription level from accountType or from organization
    const subscriptionLevel = userData.accountType?.toLowerCase() || 
                             userData.subscriptionLevel?.toLowerCase() || 
                             SUBSCRIPTION_LEVELS.BASE;
    
    // ✅ UPDATED: Extract enterprise data from new structure
    const enterpriseData = userData.enterprise || {};
    const organizationId = enterpriseData.organizationId;
    const organizationRole = enterpriseData.organizationRole;
    const userTeamMap = enterpriseData.teams || {};

    // ✅ NEW: Fetch organization data using OrganizationService
    let organizationData = null;
    if (organizationId) {
      organizationData = await OrganizationService.getOrganizationById({ organizationId });
    }

    // ✅ NEW: Fetch team data using TeamService
    const teamData = await TeamService.getTeamsForUser({ userId });
    
    // ✅ UPDATED: Build team roles from new data structure
    const teamRoles = teamData.map(team => ({
      teamId: team.id,
      teamName: team.name,
      role: userTeamMap[team.id] || TEAM_ROLES.EMPLOYEE,
      organizationId: team.organizationId
    }));

    const highestTeamRole = getHighestTeamRole(teamRoles);

    // ✅ UPDATED: Use organization subscription level if available
    const effectiveSubscriptionLevel = organizationData?.subscriptionLevel?.toLowerCase() || subscriptionLevel;

    // Build comprehensive subscription response
    return {
      userId,
      subscriptionLevel: effectiveSubscriptionLevel,
      
      // Contact-related capabilities
      contactFeatures: getContactCapabilities(effectiveSubscriptionLevel),
      
      // Enterprise-related capabilities  
      enterpriseCapabilities: getEnterpriseCapabilities(
        effectiveSubscriptionLevel, 
        teamRoles, 
        organizationRole, 
        organizationData
      ),
      
      // ✅ NEW: Organization context
      organizationId: organizationId,
      organizationData: organizationData,
      organizationRole: organizationRole,
      
      // Team context
      teamRoles: teamRoles,
      teamData: teamData,
      highestTeamRole: highestTeamRole,
      
      // Unified permissions object for easy client consumption
      permissions: buildUnifiedPermissions(
        effectiveSubscriptionLevel, 
        teamRoles, 
        organizationRole, 
        organizationData
      ),
      
      // Subscription metadata
      limits: getUnifiedLimits(effectiveSubscriptionLevel),
      canUpgrade: !isMaxTier(effectiveSubscriptionLevel),
      nextTier: getNextTier(effectiveSubscriptionLevel),
      
      // Raw data for backward compatibility
      rawUserData: userData,
      isFound: true
    };
  } catch (error) {
    console.error('Error fetching user subscription details:', error);
    return createDefaultSubscriptionResponse(userId, null, error);
  }
}

/**
 * Get contact-related capabilities based on subscription level
 */
function getContactCapabilities(subscriptionLevel) {
  const contactConfig = CONTACT_LIMITS[subscriptionLevel] || CONTACT_LIMITS[SUBSCRIPTION_LEVELS.BASE];
  
  return {
    features: contactConfig.features || [],
    limits: {
      maxContacts: contactConfig.maxContacts,
      maxGroups: contactConfig.maxGroups,
      maxShares: contactConfig.maxShares,
      canExport: contactConfig.canExport,
      aiCostBudget: contactConfig.aiCostBudget,
      maxAiRunsPerMonth: contactConfig.maxAiRunsPerMonth,
      deepAnalysisEnabled: contactConfig.deepAnalysisEnabled
    },
    hasBasicAccess: hasContactFeature(subscriptionLevel, 'basic_contacts'),
    hasAdvancedFeatures: subscriptionLevel === SUBSCRIPTION_LEVELS.BUSINESS || 
                          subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE,
    hasUnlimitedAccess: subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE
  };
}

/**
 * Get enterprise-related capabilities based on subscription and roles
 * ✅ UPDATED: Now includes organization data context
 */
function getEnterpriseCapabilities(subscriptionLevel, teamRoles, organizationRole, organizationData) {
  const hasEnterpriseAccess = [SUBSCRIPTION_LEVELS.BUSINESS, SUBSCRIPTION_LEVELS.ENTERPRISE]
    .includes(subscriptionLevel);
  
  if (!hasEnterpriseAccess) {
    return {
      hasAccess: false,
      permissions: {},
      teamLimits: { maxTeams: 0, maxMembers: 0 },
      canCreateTeams: false,
      canManageOrganization: false,
      organizationFeatures: {}
    };
  }

  const highestRole = getHighestTeamRole(teamRoles);
  const rolePermissions = DEFAULT_PERMISSIONS_BY_ROLE[highestRole] || {};
  const isOwner = organizationRole === 'owner';

  // ✅ NEW: Extract organization features from organization data
  const organizationFeatures = extractOrganizationFeatures(organizationData);

  return {
    hasAccess: true,
    permissions: rolePermissions,
    teamLimits: getTeamLimits(subscriptionLevel),
    canCreateTeams: rolePermissions[PERMISSIONS.CAN_CREATE_TEAMS] || isOwner,
    canManageOrganization: isOwner,
    highestRole: highestRole,
    isOrganizationOwner: isOwner,
    organizationFeatures: organizationFeatures,
    // ✅ NEW: Organization-level permissions
    organizationPermissions: getOrganizationPermissions(organizationRole, highestRole)
  };
}

/**
 * ✅ NEW: Extract organization features from organization data
 */
function extractOrganizationFeatures(organizationData) {
  if (!organizationData) {
    return {
      banners: [],
      linkTemplates: [],
      appearanceTemplates: [],
      branding: null,
      crossTeamSharing: false
    };
  }

  const settings = organizationData.settings || {};
  const templates = organizationData.templates || {};

  return {
    banners: Object.values(organizationData.banners || {}),
    linkTemplates: Object.values(templates.linkTemplates || {}),
    appearanceTemplates: Object.values(templates.appearanceTemplates || {}),
    branding: settings.branding || null,
    crossTeamSharing: settings.allowCrossTeamSharing || false,
    requireManagerApproval: settings.requireManagerApprovalForSharing || false
  };
}

/**
 * ✅ NEW: Get organization-level permissions based on role
 */
function getOrganizationPermissions(organizationRole, highestTeamRole) {
  const permissions = {};
  
  // Organization owners get all organization permissions
  if (organizationRole === 'owner') {
    permissions[PERMISSIONS.CAN_MANAGE_BANNERS] = true;
    permissions[PERMISSIONS.CAN_MANAGE_LINK_TEMPLATES] = true;
    permissions[PERMISSIONS.CAN_MANAGE_APPEARANCE_TEMPLATES] = true;
    permissions[PERMISSIONS.CAN_MANAGE_ORGANIZATION_BRANDING] = true;
    permissions[PERMISSIONS.CAN_ENABLE_CROSS_TEAM_SHARING] = true;
    permissions[PERMISSIONS.CAN_APPROVE_CROSS_TEAM_SHARING] = true;
    return permissions;
  }

  // Managers get some organization permissions
  if (highestTeamRole === TEAM_ROLES.MANAGER) {
    permissions[PERMISSIONS.CAN_MANAGE_BANNERS] = true;
    permissions[PERMISSIONS.CAN_MANAGE_LINK_TEMPLATES] = true;
    permissions[PERMISSIONS.CAN_MANAGE_APPEARANCE_TEMPLATES] = true;
    permissions[PERMISSIONS.CAN_APPROVE_CROSS_TEAM_SHARING] = true;
  }

  // Team leads get limited permissions
  if (highestTeamRole === TEAM_ROLES.TEAM_LEAD) {
    permissions[PERMISSIONS.CAN_APPROVE_CROSS_TEAM_SHARING] = true;
  }

  return permissions;
}

/**
 * Build unified permissions object that combines contact, enterprise, and organization permissions
 * ✅ UPDATED: Now includes organization permissions
 */
function buildUnifiedPermissions(subscriptionLevel, teamRoles, organizationRole, organizationData) {
  const permissions = {};
  
  // Contact permissions based on features
  const contactConfig = CONTACT_LIMITS[subscriptionLevel] || CONTACT_LIMITS[SUBSCRIPTION_LEVELS.BASE];
  contactConfig.features.forEach(feature => {
    permissions[feature] = true;
  });

  // Appearance permissions
  const appearanceConfig = APPEARANCE_LIMITS[subscriptionLevel] || APPEARANCE_LIMITS[SUBSCRIPTION_LEVELS.BASE];
  appearanceConfig.features.forEach(feature => {
    permissions[feature] = true;
  });
  
  // Analytics permissions
  const analyticsConfig = ANALYTICS_LIMITS[subscriptionLevel] || ANALYTICS_LIMITS[SUBSCRIPTION_LEVELS.BASE];
  analyticsConfig.features.forEach(feature => { 
    permissions[feature] = true; 
  });
  
  // Enterprise permissions based on team roles
  const highestRole = getHighestTeamRole(teamRoles);
  if (highestRole) {
    const rolePermissions = DEFAULT_PERMISSIONS_BY_ROLE[highestRole] || {};
    Object.assign(permissions, rolePermissions);
  }
  
  // ✅ NEW: Organization-level permissions
  const orgPermissions = getOrganizationPermissions(organizationRole, highestRole);
  Object.assign(permissions, orgPermissions);
  
  // Organization owner special permissions
  if (organizationRole === 'owner') {
    permissions.isOrganizationOwner = true;
    permissions[PERMISSIONS.CAN_CREATE_TEAMS] = true;
    permissions[PERMISSIONS.CAN_DELETE_TEAMS] = true;
  }

  // ✅ NEW: Apply organization template restrictions
  if (organizationData?.templates?.appearance?.enforceTheme) {
    permissions.enforcedTheme = organizationData.templates.appearance.enforceTheme;
  }
  
  if (organizationData?.templates?.appearance?.allowedThemes) {
    permissions.allowedThemes = organizationData.templates.appearance.allowedThemes;
  }
  
  return permissions;
}

/**
 * Get unified limits across all services
 */
function getUnifiedLimits(subscriptionLevel) {
  const contactLimits = getContactLimits(subscriptionLevel);
  const teamLimits = getTeamLimits(subscriptionLevel);
  
  return {
    // Contact limits
    maxContacts: contactLimits.maxContacts,
    maxGroups: contactLimits.maxGroups,
    maxShares: contactLimits.maxShares,
    
    // Enterprise limits
    maxTeams: teamLimits.maxTeams,
    maxMembers: teamLimits.maxMembers,
    
    // AI limits
    aiCostBudget: contactLimits.aiCostBudget,
    maxAiRunsPerMonth: contactLimits.maxAiRunsPerMonth,
    deepAnalysisEnabled: contactLimits.deepAnalysisEnabled
  };
}

/**
 * Get team-related limits based on subscription
 */
function getTeamLimits(subscriptionLevel) {
  switch (subscriptionLevel) {
    case SUBSCRIPTION_LEVELS.ENTERPRISE:
      return { maxTeams: -1, maxMembers: -1 }; // Unlimited
    case SUBSCRIPTION_LEVELS.BUSINESS:
      return { maxTeams: 10, maxMembers: 100 };
    default:
      return { maxTeams: 0, maxMembers: 0 };
  }
}

/**
 * Get the highest team role from user's team roles
 */
function getHighestTeamRole(teamRoles) {
  if (!teamRoles || teamRoles.length === 0) return TEAM_ROLES.EMPLOYEE;
  
  const roleHierarchy = {
    [TEAM_ROLES.EMPLOYEE]: 1,
    [TEAM_ROLES.TEAM_LEAD]: 2,
    [TEAM_ROLES.MANAGER]: 3,
    [TEAM_ROLES.OWNER]: 4
  };
  
  return teamRoles.reduce((highest, teamRole) => {
    const currentLevel = roleHierarchy[teamRole.role] || 0;
    const highestLevel = roleHierarchy[highest] || 0;
    
    return currentLevel > highestLevel ? teamRole.role : highest;
  }, TEAM_ROLES.EMPLOYEE);
}

/**
 * Check if subscription is at maximum tier
 */
function isMaxTier(subscriptionLevel) {
  return subscriptionLevel === SUBSCRIPTION_LEVELS.ENTERPRISE;
}

/**
 * Get next subscription tier
 */
function getNextTier(subscriptionLevel) {
  const tiers = [
    SUBSCRIPTION_LEVELS.BASE,
    SUBSCRIPTION_LEVELS.PRO,
    SUBSCRIPTION_LEVELS.PREMIUM,
    SUBSCRIPTION_LEVELS.BUSINESS,
    SUBSCRIPTION_LEVELS.ENTERPRISE
  ];
  
  const currentIndex = tiers.indexOf(subscriptionLevel);
  return currentIndex >= 0 && currentIndex < tiers.length - 1 
    ? tiers[currentIndex + 1] 
    : null;
}

/**
 * Create default subscription response for error cases
 */
function createDefaultSubscriptionResponse(userId, userData, error = null) {
  return {
    userId,
    subscriptionLevel: SUBSCRIPTION_LEVELS.BASE,
    contactFeatures: getContactCapabilities(SUBSCRIPTION_LEVELS.BASE),
    enterpriseCapabilities: getEnterpriseCapabilities(SUBSCRIPTION_LEVELS.BASE, [], null, null),
    organizationId: null,
    organizationData: null,
    organizationRole: null,
    teamRoles: [],
    teamData: [],
    highestTeamRole: TEAM_ROLES.EMPLOYEE,
    permissions: buildUnifiedPermissions(SUBSCRIPTION_LEVELS.BASE, [], null, null),
    limits: getUnifiedLimits(SUBSCRIPTION_LEVELS.BASE),
    canUpgrade: true,
    nextTier: SUBSCRIPTION_LEVELS.PRO,
    rawUserData: userData,
    isFound: !!userData,
    error: error?.message || null
  };
}

/**
 * Validate if user can perform a specific operation
 * ✅ ENHANCED: Now includes organization context validation
 */
export async function validateUserOperation(userId, operation, context = {}) {
  const subscriptionDetails = await getUserSubscriptionDetails(userId);
  
  // Check if user has the required permission
  const hasPermission = subscriptionDetails.permissions[operation] || false;
  
  // ✅ NEW: Additional context-based validation including organization rules
  const contextValidation = validateOperationContext(operation, context, subscriptionDetails);
  
  return {
    allowed: hasPermission && contextValidation.allowed,
    reason: hasPermission ? contextValidation.reason : `Missing permission: ${operation}`,
    subscriptionLevel: subscriptionDetails.subscriptionLevel,
    organizationId: subscriptionDetails.organizationId,
    requiredUpgrade: !hasPermission ? getRequiredUpgradeForOperation(operation) : null
  };
}

/**
 * Validate operation context (limits, quotas, organization rules, etc.)
 * ✅ ENHANCED: Now includes organization-level validation
 */
function validateOperationContext(operation, context, subscriptionDetails) {
  // ✅ NEW: Organization-level validations
  if (context.organizationId && subscriptionDetails.organizationId !== context.organizationId) {
    return { 
      allowed: false, 
      reason: 'User does not belong to the specified organization' 
    };
  }

  // ✅ NEW: Cross-team sharing validation
  if (operation === PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM) {
    const orgFeatures = subscriptionDetails.enterpriseCapabilities.organizationFeatures;
    if (!orgFeatures.crossTeamSharing) {
      return { 
        allowed: false, 
        reason: 'Cross-team sharing is disabled for this organization' 
      };
    }

    if (orgFeatures.requireManagerApproval && context.skipApproval) {
      const canApprove = subscriptionDetails.permissions[PERMISSIONS.CAN_APPROVE_CROSS_TEAM_SHARING];
      if (!canApprove) {
        return { 
          allowed: false, 
          reason: 'Manager approval required for cross-team sharing' 
        };
      }
    }
  }

  // ✅ NEW: Team lead assignment validation
  if (operation === PERMISSIONS.CAN_ASSIGN_EMPLOYEES_TO_TEAM_LEAD) {
    if (subscriptionDetails.highestTeamRole !== TEAM_ROLES.TEAM_LEAD && 
        subscriptionDetails.organizationRole !== 'owner') {
      return { 
        allowed: false, 
        reason: 'Only team leads and organization owners can assign employees' 
      };
    }
  }

  // Add more context-specific validation logic here
  return { allowed: true, reason: null };
}

/**
 * Get required subscription upgrade for an operation
 */
function getRequiredUpgradeForOperation(operation) {
  // Map operations to required subscription levels
  const operationRequirements = {
    [PERMISSIONS.CAN_CREATE_TEAMS]: SUBSCRIPTION_LEVELS.BUSINESS,
    [PERMISSIONS.CAN_DELETE_TEAMS]: SUBSCRIPTION_LEVELS.BUSINESS,
    [PERMISSIONS.CAN_MANAGE_BANNERS]: SUBSCRIPTION_LEVELS.BUSINESS,
    [PERMISSIONS.CAN_MANAGE_LINK_TEMPLATES]: SUBSCRIPTION_LEVELS.BUSINESS,
    [PERMISSIONS.CAN_MANAGE_APPEARANCE_TEMPLATES]: SUBSCRIPTION_LEVELS.BUSINESS,
    [PERMISSIONS.CAN_MANAGE_ORGANIZATION_BRANDING]: SUBSCRIPTION_LEVELS.ENTERPRISE,
    // Add more mappings as needed
  };
  
  return operationRequirements[operation] || SUBSCRIPTION_LEVELS.ENTERPRISE;
}

/**
 * ✅ NEW: Get user session object for API calls
 * This creates a session object that can be passed to the new services
 */
export async function getUserSession(userId, includeIpAddress = false, includeUserAgent = false, req = null) {
  const subscriptionDetails = await getUserSubscriptionDetails(userId);
  
  const session = {
    userId,
    organizationId: subscriptionDetails.organizationId,
    organizationRole: subscriptionDetails.organizationRole,
    highestTeamRole: subscriptionDetails.highestTeamRole,
    subscriptionLevel: subscriptionDetails.subscriptionLevel,
    permissions: subscriptionDetails.permissions
  };

  // Add IP and User Agent if requested (for audit logging)
  if (includeIpAddress && req) {
    session.ipAddress = req.ip || 
                       req.headers.get?.('x-forwarded-for')?.split(',')[0]?.trim() || 
                       req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                       'unknown';
  }

  if (includeUserAgent && req) {
    session.userAgent = req.headers.get?.('user-agent') || 
                       req.headers['user-agent'] || 
                       'unknown';
  }

  return session;
}