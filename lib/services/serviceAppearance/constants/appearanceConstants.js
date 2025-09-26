/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// lib/services/serviceAppearance/constants/appearanceConstants.js

import { SUBSCRIPTION_LEVELS } from '../../core/constants';

/**
 * Defines all possible appearance-related features.
 */
export const APPEARANCE_FEATURES = {
  CAN_UPDATE_APPEARANCE: 'can_update_appearance', // ✅ Add this master permission
  BASIC_THEMES: 'basic_themes',
  CUSTOM_BUTTONS: 'custom_buttons',
  CUSTOM_FONTS: 'custom_fonts',
  CAN_UPLOAD_FILES: 'can_upload_files', // ✅ Add this new permission
  CUSTOM_BACKGROUND: 'custom_background',
  REMOVE_BRANDING: 'remove_branding'
};

/**
 * Maps subscription levels to the appearance features they unlock.
 */
export const APPEARANCE_LIMITS = {
  [SUBSCRIPTION_LEVELS.BASE]: {
    features: [
      APPEARANCE_FEATURES.CAN_UPDATE_APPEARANCE, // ✅ Base users CAN access the page    
      APPEARANCE_FEATURES.BASIC_THEMES,
      APPEARANCE_FEATURES.CUSTOM_BUTTONS,
      APPEARANCE_FEATURES.CUSTOM_FONTS,
      APPEARANCE_FEATURES.CUSTOM_BACKGROUND,
      APPEARANCE_FEATURES.REMOVE_BRANDING,
      APPEARANCE_FEATURES.CAN_UPLOAD_FILES, // ✅ Add to BASE

    ]
  },
  [SUBSCRIPTION_LEVELS.PRO]: {
     features: [
      APPEARANCE_FEATURES.CAN_UPDATE_APPEARANCE, // ✅ Base users CAN access the page    
      APPEARANCE_FEATURES.BASIC_THEMES,
      APPEARANCE_FEATURES.CUSTOM_BUTTONS,
      APPEARANCE_FEATURES.CUSTOM_FONTS,
      APPEARANCE_FEATURES.CUSTOM_BACKGROUND,
      APPEARANCE_FEATURES.REMOVE_BRANDING,
      APPEARANCE_FEATURES.CAN_UPLOAD_FILES, // ✅ Add to BASE

    ]
  },
  [SUBSCRIPTION_LEVELS.PREMIUM]: {
      features: [
      APPEARANCE_FEATURES.CAN_UPDATE_APPEARANCE, // ✅ Base users CAN access the page    
      APPEARANCE_FEATURES.BASIC_THEMES,
      APPEARANCE_FEATURES.CUSTOM_BUTTONS,
      APPEARANCE_FEATURES.CUSTOM_FONTS,
      APPEARANCE_FEATURES.CUSTOM_BACKGROUND,
      APPEARANCE_FEATURES.REMOVE_BRANDING,
      APPEARANCE_FEATURES.CAN_UPLOAD_FILES, // ✅ Add to BASE

    ]
  },
  [SUBSCRIPTION_LEVELS.BUSINESS]: {
     features: [
      APPEARANCE_FEATURES.CAN_UPDATE_APPEARANCE, // ✅ Base users CAN access the page    
      APPEARANCE_FEATURES.BASIC_THEMES,
      APPEARANCE_FEATURES.CUSTOM_BUTTONS,
      APPEARANCE_FEATURES.CUSTOM_FONTS,
      APPEARANCE_FEATURES.CUSTOM_BACKGROUND,
      APPEARANCE_FEATURES.REMOVE_BRANDING,
      APPEARANCE_FEATURES.CAN_UPLOAD_FILES, // ✅ Add to BASE

    ]
  },
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: {
    features: [
      APPEARANCE_FEATURES.CAN_UPDATE_APPEARANCE, // ✅ Base users CAN access the page    
      APPEARANCE_FEATURES.BASIC_THEMES,
      APPEARANCE_FEATURES.CUSTOM_BUTTONS,
      APPEARANCE_FEATURES.CUSTOM_FONTS,
      APPEARANCE_FEATURES.CUSTOM_BACKGROUND,
      APPEARANCE_FEATURES.REMOVE_BRANDING,
      APPEARANCE_FEATURES.CAN_UPLOAD_FILES, // ✅ Add to BASE

    ]
  }
};

/**
 * Helper function to check if a subscription level has a specific appearance feature.
 * @param {string} subscriptionLevel - The user's subscription level.
 * @param {string} feature - The feature to check.
 * @returns {boolean}
 */
export function hasAppearanceFeature(subscriptionLevel, feature) {
  const level = subscriptionLevel?.toLowerCase() || 'base';
  const config = APPEARANCE_LIMITS[level];
  return config?.features?.includes(feature) || false;
}