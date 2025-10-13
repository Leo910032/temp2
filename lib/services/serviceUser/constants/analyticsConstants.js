// lib/services/serviceUser/constants/analyticsConstants.js
/**
 * Analytics Constants
 * Centralized configuration for analytics tracking
 */

// Event types
export const ANALYTICS_EVENT_TYPES = {
  VIEW: 'view',
  CLICK: 'click',
  TIME_ON_PROFILE: 'time_on_profile',
  SHARE: 'share',
  CONTACT_EXCHANGE: 'contact_exchange'
};

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  // Views: Stricter limits to prevent bot abuse
  VIEW: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3, // Max 3 views per minute per fingerprint
    burstAllowance: 1 // Allow 1 burst request
  },

  // Clicks: More lenient for conventions/events
  CLICK: {
    windowMs: 10 * 1000, // 10 seconds
    maxRequests: 10, // Max 10 clicks per 10 seconds
    burstAllowance: 3 // Allow burst of 3 quick clicks
  },

  // Time tracking: Very lenient
  TIME_ON_PROFILE: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    burstAllowance: 10
  }
};

// Session configuration
export const SESSION_CONFIG = {
  sessionDuration: 30 * 60 * 1000, // 30 minutes
  cookieName: 'analytics_session',
  fingerprintSalt: 'analytics_fp_v1'
};

// Traffic source types
export const TRAFFIC_SOURCES = {
  DIRECT: 'direct',
  REFERRAL: 'referral',
  SOCIAL: 'social',
  SEARCH: 'search',
  EMAIL: 'email',
  AD: 'ad',
  QR: 'qr',
  UNKNOWN: 'unknown'
};

// UTM parameters
export const UTM_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content'
];

// Analytics features flags (renamed to avoid conflict with serviceAnalytics)
export const USER_ANALYTICS_FEATURES = {
  TRACK_VIEWS: 'track_views',
  TRACK_CLICKS: 'track_clicks',
  TRACK_TIME: 'track_time_on_profile',
  TRACK_REFERRERS: 'track_referrers',
  TRACK_GEOGRAPHY: 'track_geography',
  ADVANCED_METRICS: 'advanced_metrics'
};

// Retention calculation intervals
export const RETENTION_INTERVALS = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly'
};

// Time tracking intervals (in milliseconds)
export const TIME_TRACKING = {
  HEARTBEAT_INTERVAL: 15000, // Send heartbeat every 15 seconds
  MIN_SESSION_TIME: 3000, // Minimum 3 seconds to count as a session
  MAX_IDLE_TIME: 30000, // 30 seconds of inactivity = session end
  DEBOUNCE_TIME: 1000 // Debounce time for visibility changes
};

// Error messages
export const ANALYTICS_ERRORS = {
  NOT_AUTHENTICATED: 'User not authenticated',
  INVALID_EVENT_TYPE: 'Invalid event type',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  MISSING_REQUIRED_DATA: 'Missing required tracking data',
  PREVIEW_MODE: 'Analytics disabled in preview mode'
};

// Success messages
export const ANALYTICS_SUCCESS = {
  VIEW_TRACKED: 'View tracked successfully',
  CLICK_TRACKED: 'Click tracked successfully',
  TIME_TRACKED: 'Time on profile tracked successfully'
};
