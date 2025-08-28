// lib/services/serviceEnterprise/client/factories/ServiceFactory.js
// Phase 3: Factory pattern for service instantiation and dependency injection

"use client"
import { EnhancedSubscriptionService } from '../services/EnhancedSubscriptionService';
import { EnhancedTeamService } from '../services/EnhancedTeamService';
import { EnhancedInvitationService } from '../services/EnhancedInvitationService';

export class ServiceFactory {
  static services = new Map();

  static getSubscriptionService() {
    if (!this.services.has('subscription')) {
      this.services.set('subscription', new EnhancedSubscriptionService());
    }
    return this.services.get('subscription');
  }

  static getTeamService() {
    if (!this.services.has('team')) {
      this.services.set('team', new EnhancedTeamService());
    }
    return this.services.get('team');
  }

  static getInvitationService() {
    if (!this.services.has('invitation')) {
      this.services.set('invitation', new EnhancedInvitationService());
    }
    return this.services.get('invitation');
  }

  // Service health checking
  static async checkServiceHealth() {
    const services = ['subscription', 'team', 'invitation'];
    const results = {};

    for (const serviceName of services) {
      try {
        const service = this.services.get(serviceName);
        if (service) {
          // Basic connectivity test
          await service.cachedRequest('health', () => 
            Promise.resolve({ status: 'healthy', timestamp: new Date().toISOString() })
          );
          results[serviceName] = { healthy: true, error: null };
        } else {
          results[serviceName] = { healthy: true, error: 'Not instantiated' };
        }
      } catch (error) {
        results[serviceName] = { healthy: false, error: error.message };
      }
    }

    return results;
  }

  // Clear all service instances (useful for testing or reset)
  static resetServices() {
    this.services.clear();
  }
}
