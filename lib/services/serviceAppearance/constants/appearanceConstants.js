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
  CUSTOM_MEDIA_EMBED: 'custom_media_embed' // 🆕 Media Embed feature (Pro & Premium only)
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
      // ❌ No carousel or media for base users
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
      APPEARANCE_FEATURES.CUSTOM_MEDIA_EMBED, // 🆕 Pro gets media embed

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
      APPEARANCE_FEATURES.CUSTOM_MEDIA_EMBED, // 🆕 Premium gets media embed

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
      APPEARANCE_FEATURES.CUSTOM_MEDIA_EMBED, // 🆕 Business gets media embed

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
      APPEARANCE_FEATURES.CUSTOM_MEDIA_EMBED, // 🆕 Enterprise gets media embed

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
  mediaType: 'image',
  mediaUrl: '',
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

// ===== MEDIA CONSTANTS =====

/**
 * Media item limits per subscription tier
 */
export const MEDIA_LIMITS = {
  [SUBSCRIPTION_LEVELS.BASE]: { maxItems: 0 }, // No media for base
  [SUBSCRIPTION_LEVELS.PRO]: { maxItems: 3 },
  [SUBSCRIPTION_LEVELS.PREMIUM]: { maxItems: 5 },
  [SUBSCRIPTION_LEVELS.BUSINESS]: { maxItems: 5 },
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: { maxItems: 10 }
};

/**
 * Supported media types
 */
export const MEDIA_TYPES = {
  VIDEO: 'video',
  IMAGE: 'image'
};

/**
 * Supported video platforms (for video media type)
 */
export const VIDEO_PLATFORMS = {
  YOUTUBE: 'youtube',
  VIMEO: 'vimeo'
};

/**
 * Default media item template
 */
export const DEFAULT_MEDIA_ITEM = {
  id: '',
  mediaType: MEDIA_TYPES.VIDEO,
  title: '',
  url: '',
  platform: VIDEO_PLATFORMS.YOUTUBE,
  description: '',
  order: 0
};

/**
 * Helper to get max media items for a subscription level
 */
export function getMaxMediaItems(subscriptionLevel) {
  const level = subscriptionLevel?.toLowerCase() || 'base';
  return MEDIA_LIMITS[level]?.maxItems || 0;
}
