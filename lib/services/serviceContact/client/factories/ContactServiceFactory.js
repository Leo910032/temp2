// lib/services/serviceContact/client/factories/ContactServiceFactory.js
"use client"
import { ContactService } from '../services/ContactService';
import { ContactGroupService } from '../services/ContactGroupService';
import { ContactSubscriptionService } from '../services/ContactSubscriptionService';

// We'll add more services here as you create them (e.g., Subscription, UI)

class ContactServiceFactory {
  static services = new Map();

  static getContactService() {
    if (!this.services.has('contact')) {
      this.services.set('contact', new ContactService());
    }
    return this.services.get('contact');
  }

  static getContactGroupService() {
    if (!this.services.has('group')) {
      this.services.set('group', new ContactGroupService());
    }
    return this.services.get('group');
  }
  
  // Add other service getters here in the future


  // ✅ 2. Add the missing getter method for the subscription service
  static getContactSubscriptionService() {
    if (!this.services.has('subscription')) {
      this.services.set('subscription', new ContactSubscriptionService());
    }
    return this.services.get('subscription');
  }
}

// Export a singleton instance of the factory
export const contactServiceFactory = new ContactServiceFactory();
