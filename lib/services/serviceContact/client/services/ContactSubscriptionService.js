// lib/services/serviceContact/client/services/ContactSubscriptionService.js
"use client"
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';
import { CONTACT_FEATURES, SUBSCRIPTION_LEVELS, CONTACT_LIMITS } from '../constants/contactConstants';

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
      () => ContactApiClient.get('/api/user/contacts/subscription/status'), 
      'subscription'
    );
  }

  /**
   * Check if the user's plan has a specific feature.
   * Use the same logic as your server-side hasContactFeature function
   */
  hasContactFeature(currentLevel, feature) {
    const level = currentLevel?.toLowerCase() || 'base';
    const config = CONTACT_LIMITS[level];
    
    if (!config) {
      return false;
    }
    
    const hasAccess = config.features?.includes(feature) || false;
    
    return hasAccess;
  }
  
  /**
   * Get a user-friendly message for why a feature is unavailable.
   */
  getUpgradeMessage(feature) {
    const messages = {
      [CONTACT_FEATURES.BUSINESS_CARD_SCANNER]: 'Business card scanning requires a Pro or higher plan.',
      [CONTACT_FEATURES.ADVANCED_GROUPS]: 'Advanced group features require a Premium or higher plan.',
      [CONTACT_FEATURES.TEAM_SHARING]: 'Team sharing requires a Premium or higher plan.',
      [CONTACT_FEATURES.BULK_OPERATIONS]: 'Bulk operations require a Business or higher plan.',
      [CONTACT_FEATURES.API_ACCESS]: 'API access requires an Enterprise plan.',
    };
    return messages[feature] || 'This feature requires a subscription upgrade.';
  }
}