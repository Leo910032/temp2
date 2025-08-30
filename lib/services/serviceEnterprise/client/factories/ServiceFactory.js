// lib/services/serviceEnterprise/client/factories/ServiceFactory.js
// Phase 3: Complete factory with all enhanced services

"use client"
import { EnhancedSubscriptionService } from '../services/EnhancedSubscriptionService';
import { EnhancedTeamService } from '../services/EnhancedTeamService';
import { EnhancedInvitationService } from '../services/EnhancedInvitationService';
import { EnhancedAuditService } from '../services/EnhancedAuditService';
import { EnhancedAnalyticsService } from '../services/EnhancedAnalyticsService';
import { EnhancedCacheService } from '../services/EnhancedCacheService';

export class ServiceFactory {
  static services = new Map();

  // ==================== SERVICE GETTERS ====================

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

  static getAnalyticsService() {
    if (!this.services.has('analytics')) {
      this.services.set('analytics', new EnhancedAnalyticsService());
    }
    return this.services.get('analytics');
  }

  static getAuditService() {
    if (!this.services.has('audit')) {
      this.services.set('audit', new EnhancedAuditService());
    }
    return this.services.get('audit');
  }

  static getCacheService() {
    if (!this.services.has('cache')) {
      this.services.set('cache', new EnhancedCacheService());
    }
    return this.services.get('cache');
  }

  // ==================== BATCH SERVICE ACCESS ====================

  static getAllServices() {
    return {
      subscription: this.getSubscriptionService(),
      team: this.getTeamService(),
      invitation: this.getInvitationService(),
      analytics: this.getAnalyticsService(),
      audit: this.getAuditService(),
      cache: this.getCacheService()
    };
  }

  static getServiceNames() {
    return ['subscription', 'team', 'invitation', 'analytics', 'audit', 'cache'];
  }

  static getActiveServices() {
    return Array.from(this.services.keys());
  }

  // ==================== SERVICE HEALTH & DIAGNOSTICS ====================

  static async checkServiceHealth() {
    const services = this.getServiceNames();
    const results = {};

    for (const serviceName of services) {
      try {
        const service = this.services.get(serviceName);
        
        if (service) {
          // Basic connectivity test using the service's cachedRequest method
          await service.cachedRequest('health', () => 
            Promise.resolve({ 
              status: 'healthy', 
              timestamp: new Date().toISOString(),
              service: serviceName
            })
          );
          
          results[serviceName] = { 
            healthy: true, 
            error: null,
            lastChecked: new Date().toISOString()
          };
        } else {
          results[serviceName] = { 
            healthy: true, 
            error: 'Not instantiated',
            lastChecked: new Date().toISOString()
          };
        }
      } catch (error) {
        results[serviceName] = { 
          healthy: false, 
          error: error.message,
          lastChecked: new Date().toISOString()
        };
      }
    }

    return results;
  }

  static async runDiagnostics() {
    console.log('🔍 Running service diagnostics...');
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      serviceHealth: await this.checkServiceHealth(),
      cacheStats: this.getCacheService().getCacheStats(),
      activeServices: this.getActiveServices(),
      totalServices: this.getServiceNames().length,
      memoryUsage: this.estimateMemoryUsage()
    };

    // Analyze results
    const healthyServices = Object.values(diagnostics.serviceHealth).filter(s => s.healthy).length;
    const unhealthyServices = diagnostics.totalServices - healthyServices;
    
    diagnostics.summary = {
      overallHealth: unhealthyServices === 0 ? 'healthy' : unhealthyServices < 3 ? 'degraded' : 'critical',
      healthyServices,
      unhealthyServices,
      cacheHealth: diagnostics.cacheStats.healthScore,
      recommendations: this.generateRecommendations(diagnostics)
    };

    console.log('✅ Service diagnostics completed:', diagnostics.summary);
    return diagnostics;
  }

  static generateRecommendations(diagnostics) {
    const recommendations = [];
    
    // Service health recommendations
    const unhealthyServices = Object.entries(diagnostics.serviceHealth)
      .filter(([, health]) => !health.healthy);
    
    if (unhealthyServices.length > 0) {
      recommendations.push({
        type: 'service_health',
        priority: 'high',
        message: `${unhealthyServices.length} service(s) are unhealthy`,
        services: unhealthyServices.map(([name]) => name),
        action: 'investigate_service_errors'
      });
    }
    
    // Cache recommendations
    if (diagnostics.cacheStats.healthScore < 70) {
      recommendations.push({
        type: 'cache_performance',
        priority: 'medium',
        message: 'Cache performance is below optimal',
        action: 'optimize_cache'
      });
    }
    
    // Memory recommendations
    if (diagnostics.memoryUsage.estimatedMB > 50) {
      recommendations.push({
        type: 'memory_usage',
        priority: 'low',
        message: 'High estimated memory usage',
        action: 'cleanup_unused_services'
      });
    }

    return recommendations;
  }

  static estimateMemoryUsage() {
    const serviceCount = this.services.size;
    const avgServiceSize = 1024; // bytes estimate
    const cacheStats = this.services.has('cache') ? 
      this.getCacheService().getCacheStats() : 
      { size: 0 };
    
    const estimatedBytes = (serviceCount * avgServiceSize) + (cacheStats.size * 2048);
    
    return {
      activeServices: serviceCount,
      cacheEntries: cacheStats.size,
      estimatedBytes,
      estimatedKB: Math.round(estimatedBytes / 1024),
      estimatedMB: Math.round(estimatedBytes / (1024 * 1024) * 100) / 100
    };
  }

  // ==================== SERVICE LIFECYCLE MANAGEMENT ====================

  static async initializeServices() {
    console.log('🚀 Initializing enterprise services...');
    
    const initResults = {};
    const services = this.getAllServices(); // This instantiates all services
    
    // Run initial preload for critical services
    try {
      const cacheService = this.getCacheService();
      await cacheService.preloadEnterpriseData();
      initResults.preload = { success: true };
    } catch (error) {
      console.warn('⚠️ Preload failed:', error.message);
      initResults.preload = { success: false, error: error.message };
    }
    
    // Start cache monitoring
    try {
      const cacheService = this.getCacheService();
      cacheService.startCacheMonitoring(60000); // 1 minute intervals
      initResults.monitoring = { success: true };
    } catch (error) {
      console.warn('⚠️ Cache monitoring failed to start:', error.message);
      initResults.monitoring = { success: false, error: error.message };
    }

    console.log('✅ Enterprise services initialized:', {
      servicesCreated: Object.keys(services).length,
      results: initResults
    });

    return {
      success: true,
      services: Object.keys(services),
      results: initResults,
      timestamp: new Date().toISOString()
    };
  }

  static destroyServices() {
    console.log('🧹 Destroying enterprise services...');
    
    let destroyedCount = 0;
    
    // Stop cache monitoring if running
    if (this.services.has('cache')) {
      const cacheService = this.services.get('cache');
      cacheService.stopCacheMonitoring();
      cacheService.destroy?.();
    }
    
    // Clear all services
    for (const [serviceName, service] of this.services.entries()) {
      try {
        // Call destroy method if it exists
        if (typeof service.destroy === 'function') {
          service.destroy();
        }
        destroyedCount++;
      } catch (error) {
        console.warn(`⚠️ Error destroying ${serviceName}:`, error.message);
      }
    }
    
    this.services.clear();
    
    console.log(`✅ Destroyed ${destroyedCount} services`);
    
    return {
      success: true,
      destroyedCount,
      timestamp: new Date().toISOString()
    };
  }

  // Clear all service instances (useful for testing or reset)
  static resetServices() {
    this.destroyServices();
    console.log('🔄 Services reset - they will be recreated on next access');
    
    return {
      success: true,
      message: 'Services reset successfully',
      timestamp: new Date().toISOString()
    };
  }

  // ==================== DEVELOPMENT & DEBUGGING ====================

  static getServiceInfo(serviceName = null) {
    if (serviceName) {
      const service = this.services.get(serviceName);
      if (!service) {
        return { error: `Service '${serviceName}' not found or not instantiated` };
      }
      
      return {
        name: serviceName,
        instance: service.constructor.name,
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(service))
          .filter(name => name !== 'constructor' && typeof service[name] === 'function'),
        instantiated: true
      };
    }
    
    // Return info for all services
    const allInfo = {};
    const serviceNames = this.getServiceNames();
    
    serviceNames.forEach(name => {
      const isInstantiated = this.services.has(name);
      allInfo[name] = {
        name,
        instantiated: isInstantiated,
        instance: isInstantiated ? this.services.get(name).constructor.name : null
      };
    });
    
    return allInfo;
  }

  static async warmUpServices() {
    console.log('🔥 Warming up services...');
    
    const services = this.getAllServices();
    const warmupTasks = [];
    
    // Subscription service warmup
    warmupTasks.push(
      services.subscription.getEnterpriseDataBatch().catch(e => ({ error: e.message }))
    );
    
    // Team service warmup
    warmupTasks.push(
      services.team.getUserTeams().catch(e => ({ error: e.message }))
    );
    
    // Cache service warmup
    warmupTasks.push(
      services.cache.preloadEnterpriseData().catch(e => ({ error: e.message }))
    );
    
    const results = await Promise.allSettled(warmupTasks);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`🔥 Service warmup completed: ${successful}/${warmupTasks.length} successful`);
    
    return {
      success: successful > 0,
      total: warmupTasks.length,
      successful,
      failed: warmupTasks.length - successful,
      timestamp: new Date().toISOString()
    };
  }

  // ==================== UTILITY METHODS ====================

  static isServiceActive(serviceName) {
    return this.services.has(serviceName);
  }

  static getServiceInstance(serviceName) {
    return this.services.get(serviceName) || null;
  }

  static createServiceProxy(serviceName) {
    // Create a proxy that automatically instantiates the service on first access
    return new Proxy({}, {
      get: (target, prop) => {
        const service = this.services.get(serviceName) || this[`get${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)}Service`]();
        return service[prop];
      }
    });
  }
}