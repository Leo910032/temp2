/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// lib/services/server/subscriptionService.js
import { adminDb } from '@/lib/firebaseAdmin';

// Import from the unified barrel file
import { 
  SUBSCRIPTION_LEVELS, 
  CONTACT_LIMITS, 
  DEFAULT_PERMISSIONS_BY_ROLE, 
  TEAM_ROLES,
  PERMISSIONS,
  hasContactFeature,
  getContactLimits
} from '../constants';

/**
 * The single source of truth for fetching and interpreting a user's subscription on the server.
 * This replaces all the fragmented subscription services.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<object>} A comprehensive object detailing the user's subscription and capabilities.
 */
export async function getUserSubscriptionDetails(userId) {
  if (!userId) {
    throw new Error('User ID is required to get subscription details.');
  }

  try {
    const userDocSnap = await adminDb.collection('AccountData').doc(userId).get();
    
    if (!userDocSnap.exists) {
      // Return a default "base" subscription object for non-existent users
      return createDefaultSubscriptionResponse(userId, null);
    }

    const userData = userDocSnap.data();
    const subscriptionLevel = userData.accountType?.toLowerCase() || SUBSCRIPTION_LEVELS.BASE;
    
    // Get team roles if available
    const teamRoles = await getUserTeamRoles(userId);
    const organizationRole = userData.organizationRole || null;
    const highestTeamRole = getHighestTeamRole(teamRoles);

    // Build comprehensive subscription response
    return {
      userId,
      subscriptionLevel,
      
      // Contact-related capabilities
      contactFeatures: getContactCapabilities(subscriptionLevel),
      
      // Enterprise-related capabilities  
      enterpriseCapabilities: getEnterpriseCapabilities(subscriptionLevel, teamRoles, organizationRole),
      
      // Team context
      teamRoles: teamRoles,
      organizationRole: organizationRole,
      highestTeamRole: highestTeamRole,
      
      // Unified permissions object for easy client consumption
      permissions: buildUnifiedPermissions(subscriptionLevel, teamRoles, organizationRole),
      
      // Subscription metadata
      limits: getUnifiedLimits(subscriptionLevel),
      canUpgrade: !isMaxTier(subscriptionLevel),
      nextTier: getNextTier(subscriptionLevel),
      
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
 */
function getEnterpriseCapabilities(subscriptionLevel, teamRoles, organizationRole) {
  const hasEnterpriseAccess = [SUBSCRIPTION_LEVELS.BUSINESS, SUBSCRIPTION_LEVELS.ENTERPRISE]
    .includes(subscriptionLevel);
  
  if (!hasEnterpriseAccess) {
    return {
      hasAccess: false,
      permissions: {},
      teamLimits: { maxTeams: 0, maxMembers: 0 },
      canCreateTeams: false,
      canManageOrganization: false
    };
  }

  const highestRole = getHighestTeamRole(teamRoles);
  const rolePermissions = DEFAULT_PERMISSIONS_BY_ROLE[highestRole] || {};
  const isOwner = organizationRole === 'owner';

  return {
    hasAccess: true,
    permissions: rolePermissions,
    teamLimits: getTeamLimits(subscriptionLevel),
    canCreateTeams: rolePermissions[PERMISSIONS.CAN_CREATE_TEAMS] || isOwner,
    canManageOrganization: isOwner,
    highestRole: highestRole,
    isOrganizationOwner: isOwner
  };
}

/**
 * Build unified permissions object that combines contact and enterprise permissions
 */
function buildUnifiedPermissions(subscriptionLevel, teamRoles, organizationRole) {
  const permissions = {};
  
  // Contact permissions based on features
  const contactConfig = CONTACT_LIMITS[subscriptionLevel] || CONTACT_LIMITS[SUBSCRIPTION_LEVELS.BASE];
  contactConfig.features.forEach(feature => {
    permissions[feature] = true;
  });
  
  // Enterprise permissions based on team roles
  const highestRole = getHighestTeamRole(teamRoles);
  if (highestRole) {
    const rolePermissions = DEFAULT_PERMISSIONS_BY_ROLE[highestRole] || {};
    Object.assign(permissions, rolePermissions);
  }
  
  // Organization-level permissions
  if (organizationRole === 'owner') {
    permissions.isOrganizationOwner = true;
    permissions[PERMISSIONS.CAN_CREATE_TEAMS] = true;
    permissions[PERMISSIONS.CAN_DELETE_TEAMS] = true;
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
 * Get user's team roles from the database
 */
async function getUserTeamRoles(userId) {
  try {
    // This is a simplified version - adjust based on your actual team storage structure
    const teamsSnapshot = await adminDb
      .collection('Teams')
      .where('members.' + userId, '!=', null)
      .get();
    
    const teamRoles = [];
    teamsSnapshot.forEach(doc => {
      const teamData = doc.data();
      const userRole = teamData.members?.[userId]?.role;
      if (userRole) {
        teamRoles.push({
          teamId: doc.id,
          role: userRole,
          teamName: teamData.name
        });
      }
    });
    
    return teamRoles;
  } catch (error) {
    console.error('Error fetching user team roles:', error);
    return [];
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
    enterpriseCapabilities: getEnterpriseCapabilities(SUBSCRIPTION_LEVELS.BASE, [], null),
    teamRoles: [],
    organizationRole: null,
    highestTeamRole: TEAM_ROLES.EMPLOYEE,
    permissions: buildUnifiedPermissions(SUBSCRIPTION_LEVELS.BASE, [], null),
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
 */
export async function validateUserOperation(userId, operation, context = {}) {
  const subscriptionDetails = await getUserSubscriptionDetails(userId);
  
  // Check if user has the required permission
  const hasPermission = subscriptionDetails.permissions[operation] || false;
  
  // Additional context-based validation can be added here
  const contextValidation = validateOperationContext(operation, context, subscriptionDetails);
  
  return {
    allowed: hasPermission && contextValidation.allowed,
    reason: hasPermission ? contextValidation.reason : `Missing permission: ${operation}`,
    subscriptionLevel: subscriptionDetails.subscriptionLevel,
    requiredUpgrade: !hasPermission ? getRequiredUpgradeForOperation(operation) : null
  };
}

/**
 * Validate operation context (limits, quotas, etc.)
 */
function validateOperationContext(operation, context, subscriptionDetails) {
  // Add context-specific validation logic here
  // For example, check if user has reached limits for certain operations
  
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
    // Add more mappings as needed
  };
  
  return operationRequirements[operation] || SUBSCRIPTION_LEVELS.ENTERPRISE;
}
