// lib/services/constants.js
/**
 * THIS FILE HAS BEEN REFACTORED 
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
export * from './serviceAppearance/constants/appearanceConstants';
export * from './serviceAnalytics/constants/analyticsConstants';

// ✅ NEW: Export user service constants (analytics tracking)
export * from './serviceUser/constants/analyticsConstants';

// ✅ FIXED: Export organization constants (was commented out)
export * from './serviceEnterprise/constants/organizationConstants';

// ✅ FIXED: Export enterprise constants if they exist (was commented out)
export * from './serviceEnterprise/constants/enterpriseConstants';

// 3. (Optional) For clarity, you can also export them as named objects.
import * as CoreConstants from './core/constants';
import * as ContactConstants from './serviceContact/client/constants/contactConstants';
import * as AppearanceConstants from './serviceAppearance/constants/appearanceConstants';
import * as AnalyticsConstants from './serviceAnalytics/constants/analyticsConstants';
import * as UserAnalyticsConstants from './serviceUser/constants/analyticsConstants';
import * as OrganizationConstants from './serviceEnterprise/constants/organizationConstants';
import * as EnterpriseConstants from './serviceEnterprise/constants/enterpriseConstants';

// ✅ FIXED: Export all named constants consistently
export {
    CoreConstants,
    ContactConstants,
    AppearanceConstants,
    AnalyticsConstants,
    UserAnalyticsConstants,
    OrganizationConstants,
    EnterpriseConstants
};