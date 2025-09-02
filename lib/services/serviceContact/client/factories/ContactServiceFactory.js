// lib/services/serviceContact/client/factories/ContactServiceFactory.js
"use client"
import { ContactService } from '../services/ContactService';
import { ContactGroupService } from '../services/ContactGroupService';
import { ContactSubscriptionService } from '../services/ContactSubscriptionService';
import { ExchangeService } from '../services/ExchangeService';

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

  static getContactSubscriptionService() {
    if (!this.services.has('subscription')) {
      this.services.set('subscription', new ContactSubscriptionService());
    }
    return this.services.get('subscription');
  }

  // Clear all services (useful for testing or resetting state)
  static clearServices() {
    this.services.clear();
  }

  // Get all service instances (useful for debugging)
  static getAllServices() {
    return Array.from(this.services.keys());
  }
   static getExchangeService() {
    if (!this.services.has('exchange')) {
      this.services.set('exchange', new ExchangeService());
    }
    return this.services.get('exchange');
  }
}


// Export the factory class itself for static method access
export { ContactServiceFactory };

// Export a singleton instance for convenience (but the static methods are preferred)
export const contactServiceFactory = ContactServiceFactory;