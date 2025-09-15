// lib/services/serviceAnalytics/constants/analyticsConstants.js

import { SUBSCRIPTION_LEVELS } from '../../core/constants';

/**
 * Defines all possible analytics-related features.
 */
export const ANALYTICS_FEATURES = {
  BASIC_ANALYTICS: 'basic_analytics',          // Basic access to the analytics page
  ADVANCED_TRAFFIC_SOURCES: 'advanced_traffic_sources', // e.g., for Premium+
  TEAM_ANALYTICS: 'team_analytics'              // Enterprise feature
};

/**
 * Maps subscription levels to the analytics features they unlock.
 */
export const ANALYTICS_LIMITS = {
  [SUBSCRIPTION_LEVELS.BASE]: {
    features: [
      ANALYTICS_FEATURES.BASIC_ANALYTICS,
    ]
  },
  [SUBSCRIPTION_LEVELS.PRO]: {
    features: [
      ANALYTICS_FEATURES.BASIC_ANALYTICS,
    ]
  },
  [SUBSCRIPTION_LEVELS.PREMIUM]: {
    features: [
      ANALYTICS_FEATURES.BASIC_ANALYTICS,
      ANALYTICS_FEATURES.ADVANCED_TRAFFIC_SOURCES,
    ]
  },
  [SUBSCRIPTION_LEVELS.BUSINESS]: {
    features: [
      ANALYTICS_FEATURES.BASIC_ANALYTICS,
      ANALYTICS_FEATURES.ADVANCED_TRAFFIC_SOURCES,
      ANALYTICS_FEATURES.TEAM_ANALYTICS,
    ]
  },
  [SUBSCRIPTION_LEVELS.ENTERPRISE]: {
    features: [
      ANALYTICS_FEATURES.BASIC_ANALYTICS,
      ANALYTICS_FEATURES.ADVANCED_TRAFFIC_SOURCES,
      ANALYTICS_FEATURES.TEAM_ANALYTICS,
    ]
  }
};