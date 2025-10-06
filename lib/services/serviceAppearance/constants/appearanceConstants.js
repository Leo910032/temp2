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
  REMOVE_BRANDING: 'remove_branding',
  CUSTOM_CAROUSEL: 'custom_carousel', // 🆕 Carousel feature (Pro & Premium only)
  CUSTOM_VIDEO_EMBED: 'custom_video_embed' // 🆕 Video Embed feature (Pro & Premium only)
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
      // ❌ No carousel for base users
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
      APPEARANCE_FEATURES.CUSTOM_CAROUSEL, // 🆕 Pro gets carousel
      APPEARANCE_FEATURES.CUSTOM_VIDEO_EMBED, // 🆕 Pro gets video embed

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
      APPEARANCE_FEATURES.CUSTOM_CAROUSEL, // 🆕 Premium gets carousel
      APPEARANCE_FEATURES.CUSTOM_VIDEO_EMBED, // 🆕 Premium gets video embed

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
      APPEARANCE_FEATURES.CUSTOM_CAROUSEL, // 🆕 Business gets carousel
      APPEARANCE_FEATURES.CUSTOM_VIDEO_EMBED, // 🆕 Business gets video embed

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
      APPEARANCE_FEATURES.CUSTOM_CAROUSEL, // 🆕 Enterprise gets carousel
      APPEARANCE_FEATURES.CUSTOM_VIDEO_EMBED, // 🆕 Enterprise gets video embed

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

// ===== CAROUSEL CONSTANTS =====

/**
 * Carousel item limits per subscription tier
 */
export const CAROUSEL_LIMITS = {
  [SUBSCRIPTION_LEVELS.BASE]: { maxItems: 0 }, // No carousel for base
  [SUBSCRIPTION_LEVELS.PRO]: { maxItems: 3 },
  [SUBSCRIPTION_LEVELS.PREMIUM]: { maxItems: 5 },
  [SUBSCRIPTION_LEVELS.BUSINESS]: { maxItems: 5 },
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: { maxItems: 10 }
};

/**
 * Available carousel styles
 */
export const CAROUSEL_STYLES = {
  MODERN: 'modern',
  MINIMAL: 'minimal',
  BOLD: 'bold',
  SHOWCASE: 'showcase',
  SPOTLIGHT: 'spotlight'
};

/**
 * Default carousel item template
 */
export const DEFAULT_CAROUSEL_ITEM = {
  id: '',
  image: '',
  title: '',
  description: '',
  category: '',
  link: '',
  author: '',
  readTime: '',
  videoUrl: '', // Optional - if provided, shows play icon
  order: 0
};

/**
 * Helper to get max carousel items for a subscription level
 */
export function getMaxCarouselItems(subscriptionLevel) {
  const level = subscriptionLevel?.toLowerCase() || 'base';
  return CAROUSEL_LIMITS[level]?.maxItems || 0;
}

// ===== VIDEO EMBED CONSTANTS =====

/**
 * Video embed item limits per subscription tier
 */
export const VIDEO_EMBED_LIMITS = {
  [SUBSCRIPTION_LEVELS.BASE]: { maxItems: 0 }, // No video embed for base
  [SUBSCRIPTION_LEVELS.PRO]: { maxItems: 3 },
  [SUBSCRIPTION_LEVELS.PREMIUM]: { maxItems: 5 },
  [SUBSCRIPTION_LEVELS.BUSINESS]: { maxItems: 5 },
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: { maxItems: 10 }
};

/**
 * Supported video platforms
 */
export const VIDEO_PLATFORMS = {
  YOUTUBE: 'youtube',
  VIMEO: 'vimeo'
};

/**
 * Default video embed item template
 */
export const DEFAULT_VIDEO_EMBED_ITEM = {
  id: '',
  title: '',
  url: '',
  platform: VIDEO_PLATFORMS.YOUTUBE,
  description: '',
  order: 0
};

/**
 * Helper to get max video embed items for a subscription level
 */
export function getMaxVideoEmbedItems(subscriptionLevel) {
  const level = subscriptionLevel?.toLowerCase() || 'base';
  return VIDEO_EMBED_LIMITS[level]?.maxItems || 0;
}
