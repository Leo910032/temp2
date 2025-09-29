// lib/services/constants.js
/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
/**
 * @file This is the central barrel file for all application constants.
 * Other parts of the application (client pages, server-side services)
 * should ONLY import constants from this file.
 * This pattern decouples components from the internal file structure of the services.
 */

// 1. Export everything from the core (shared) constants.
export * from './core/constants';

// 2. Export everything from the domain-specific constant files.
export * from './serviceContact/client/constants/contactConstants';
export * from './serviceEnterprise/constants/enterpriseConstants';
export * from './serviceAppearance/constants/appearanceConstants';
export * from './serviceAnalytics/constants/analyticsConstants';

// ✅ ADD THE MISSING ORGANIZATION CONSTANTS
export * from './serviceEnterprise/constants/organizationConstants';

// 3. (Optional) For clarity, you can also export them as named objects.
import * as CoreConstants from './core/constants';
import * as ContactConstants from './serviceContact/client/constants/contactConstants';
import * as EnterpriseConstants from './serviceEnterprise/constants/enterpriseConstants';
import * as AppearanceConstants from './serviceAppearance/constants/appearanceConstants';
import * as AnalyticsConstants from './serviceAnalytics/constants/analyticsConstants';
import * as OrganizationConstants from './serviceEnterprise/constants/organizationConstants';

// ✅ FIXED: Export all named constants consistently
export { 
    CoreConstants, 
    ContactConstants, 
    EnterpriseConstants, 
    AppearanceConstants, 
    AnalyticsConstants, 
    OrganizationConstants 
};