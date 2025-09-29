// lib/services/serviceEnterprise/constants/organizationConstants.js

/**
 * Defines the default settings that are applied to a new organization
 * when it is first created.
 */
export const DEFAULT_ORGANIZATION_SETTINGS = {
    allowCrossTeamSharing: false,
    requireManagerApprovalForSharing: true, // Default to more secure option
    branding: {
        logoUrl: null,
        primaryColor: '#000000',
        secondaryColor: '#ffffff',
        companyName: null
    },
    banners: [], // Banners are empty by default
    templates: {
        links: [],
        appearance: {
            enforceTheme: null,
            allowedThemes: []
        }
    }
};

/**
 * Defines the limits for different subscription tiers regarding organizations.
 */
export const ENTERPRISE_LIMITS = {
    business: {
        maxTeams: 10,
        maxMembers: 50,
    },
    enterprise: {
        maxTeams: -1, // Unlimited
        maxMembers: -1, // Unlimited
    }
};

/**
 * Organization verification status options
 */
export const ORGANIZATION_VERIFICATION_STATUS = {
    PENDING: 'pending',
    VERIFIED: 'verified',
    REJECTED: 'rejected'
};

/**
 * Organization subscription levels
 */
export const ORGANIZATION_SUBSCRIPTION_LEVELS = {
    BUSINESS: 'business',
    ENTERPRISE: 'enterprise'
};
