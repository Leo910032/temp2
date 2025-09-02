// lib/services/serviceContact/client/services/ContactSubscriptionService.js
"use client"
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';
import { CONTACT_FEATURES, SUBSCRIPTION_LEVELS } from '../../constants/contactConstants';

export class ContactSubscriptionService extends BaseContactService {
  constructor() {
    super('ContactSubscriptionService');
  }

  /**
   * Get the user's subscription status related to contacts.
   */
  async getSubscriptionStatus() {
    return this.cachedRequest(
      'status',
      () => ContactApiClient.get('/api/contacts/subscription/status'),
      'subscription' // Use the subscription cache category
    );
  }

  /**
   * Check if the user's plan has a specific feature.
   * @param {string} currentLevel The user's subscription level (e.g., 'pro', 'enterprise').
   * @param {string} feature The feature to check from CONTACT_FEATURES.
   * @returns {boolean}
   */
  hasContactFeature(currentLevel, feature) {
    const level = currentLevel?.toLowerCase() || 'base';
    const planFeatures = {
      [SUBSCRIPTION_LEVELS.BASE]: [CONTACT_FEATURES.BASIC_CONTACTS],
      [SUBSCRIPTION_LEVELS.PRO]: [
        CONTACT_FEATURES.BASIC_CONTACTS,
        CONTACT_FEATURES.BUSINESS_CARD_SCANNER,
        CONTACT_FEATURES.BASIC_GROUPS,
        CONTACT_FEATURES.MAP_VISUALIZATION,
      ],
      [SUBSCRIPTION_LEVELS.ENTERPRISE]: Object.values(CONTACT_FEATURES),
    };
    return planFeatures[level]?.includes(feature) || false;
  }
  
  /**
   * Get a user-friendly message for why a feature is unavailable.
   * @param {string} feature The feature the user tried to access.
   * @returns {string}
   */
  getUpgradeMessage(feature) {
    const messages = {
      [CONTACT_FEATURES.BUSINESS_CARD_SCANNER]: 'Business card scanning requires a Pro or Enterprise plan.',
      [CONTACT_FEATURES.ADVANCED_GROUPS]: 'Automatic group generation requires a Pro or Enterprise plan.',
      [CONTACT_FEATURES.TEAM_SHARING]: 'Sharing contacts with your team requires an Enterprise plan.',
    };
    return messages[feature] || 'This feature requires a subscription upgrade.';
  }
}
