// lib/services/serviceEnterprise/client/services/EnhancedCacheService.js
// Phase 3: Centralized cache management service

"use client"
import { BaseService } from '../abstractions/BaseService';
import { globalCache } from '../core/cacheManager';

export class EnhancedCacheService extends BaseService {
  constructor() {
    super('CacheService');
  }

  // ==================== CACHE STATISTICS ====================

  getCacheStats() {
    const stats = globalCache.getStats();
    
    // Add operational statistics
    const operationStats = globalCache.operationStats || {};
    const enhancedStats = {
      ...stats,
      operationStats,
      healthScore: this.calculateHealthScore(stats),
      recommendations: this.getCacheRecommendations(stats),
      lastUpdated: new Date().toISOString()
    };

    return enhancedStats;
  }

  calculateHealthScore(stats) {
    // Calculate a health score based on cache performance
    const hitRate = parseFloat(stats.hitRate) || 0;
    const pendingRequestsRatio = (stats.pendingRequests / Math.max(stats.cacheSize, 1)) * 100;
    
    let score = 100;
    
    // Deduct points for low hit rate
    if (hitRate < 50) {
      score -= (50 - hitRate);
    }
    
    // Deduct points for high pending requests
    if (pendingRequestsRatio > 10) {
      score -= (pendingRequestsRatio - 10);
    }
    
    return Math.max(0, Math.round(score));
  }

  getCacheRecommendations(stats) {
    const recommendations = [];
    const hitRate = parseFloat(stats.hitRate) || 0;
    
    if (hitRate < 30) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Low cache hit rate detected. Consider preloading frequently accessed data.',
        action: 'preload_data'
      });
    }
    
    if (stats.cacheSize > 1000) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'Large cache size detected. Consider cleaning up old entries.',
        action: 'cleanup_old_entries'
      });
    }
    
    if (stats.pendingRequests > 10) {
      recommendations.push({
        type: 'concurrency',
        priority: 'medium',
        message: 'High number of pending requests. Consider request batching.',
        action: 'implement_batching'
      });
    }

    return recommendations;
  }

  // ==================== CACHE MANAGEMENT ====================

  clearAllCaches() {
    try {
      globalCache.clear();
      console.log('🧹 All caches cleared successfully');
      
      return {
        success: true,
        message: 'All caches cleared',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error clearing caches:', error);
      return {
        success: false,
        message: 'Failed to clear caches',
        error: error.message
      };
    }
  }

  clearAnalyticsCaches() {
    try {
      const patterns = [
        'impersonated_analytics',
        'can_impersonate',
        'audit_log',
        'user_analytics',
        'team_analytics'
      ];
      
      patterns.forEach(pattern => {
        globalCache.invalidate(pattern);
      });
      
      console.log('🧹 Analytics caches cleared');
      
      return {
        success: true,
        message: 'Analytics caches cleared',
        patternsCleared: patterns,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error clearing invitation caches:', error);
      return {
        success: false,
        message: 'Failed to clear invitation caches',
        error: error.message
      };
    }
  }

  // ==================== CACHE OPTIMIZATION ====================

  async optimizeCache() {
    try {
      console.log('🔧 Starting cache optimization...');
      
      const stats = this.getCacheStats();
      const optimizations = [];
      
      // Remove expired entries
      const beforeSize = stats.cacheSize;
      globalCache.cleanup?.(); // If cleanup method exists
      const afterSize = globalCache.getStats().size;
      
      if (beforeSize > afterSize) {
        optimizations.push({
          type: 'cleanup',
          message: `Removed ${beforeSize - afterSize} expired entries`,
          impact: 'memory_freed'
        });
      }
      
      // Analyze access patterns
      const recommendations = this.getCacheRecommendations(stats);
      optimizations.push(...recommendations);
      
      console.log('✅ Cache optimization completed');
      
      return {
        success: true,
        optimizations,
        beforeStats: stats,
        afterStats: globalCache.getStats(),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error optimizing cache:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ==================== PRELOADING STRATEGIES ====================

  async preloadEnterpriseData() {
    try {
      console.log('⚡ Starting enterprise data preload...');
      
      // Import services dynamically to avoid circular dependencies
      const { ServiceFactory } = await import('../factories/ServiceFactory');
      
      const preloadTasks = [];
      const results = {
        successful: [],
        failed: []
      };
      
      // Preload subscription data
      preloadTasks.push(
        this.preloadWithErrorHandling(
          'subscription',
          () => ServiceFactory.getSubscriptionService().getEnterpriseDataBatch()
        )
      );
      
      // Preload user teams
      preloadTasks.push(
        this.preloadWithErrorHandling(
          'teams',
          () => ServiceFactory.getTeamService().getUserTeams()
        )
      );
      
      // Execute preload tasks
      const taskResults = await Promise.allSettled(preloadTasks);
      
      taskResults.forEach((result, index) => {
        const taskNames = ['subscription', 'teams'];
        const taskName = taskNames[index];
        
        if (result.status === 'fulfilled' && result.value.success) {
          results.successful.push(taskName);
        } else {
          results.failed.push({
            task: taskName,
            error: result.reason?.message || result.value?.error || 'Unknown error'
          });
        }
      });
      
      console.log('⚡ Enterprise data preload completed:', {
        successful: results.successful.length,
        failed: results.failed.length
      });
      
      return {
        success: results.successful.length > 0,
        results,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error preloading enterprise data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async preloadTeamData(teamId) {
    try {
      console.log(`⚡ Preloading team data for: ${teamId}`);
      
      const { ServiceFactory } = await import('../factories/ServiceFactory');
      const teamService = ServiceFactory.getTeamService();
      
      // Preload team batch data
      const result = await this.preloadWithErrorHandling(
        `team_${teamId}`,
        () => teamService.getTeamDataBatch(teamId)
      );
      
      return {
        success: result.success,
        teamId,
        data: result.data,
        error: result.error,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error preloading team data for ${teamId}:`, error);
      return {
        success: false,
        teamId,
        error: error.message
      };
    }
  }

  async preloadWithErrorHandling(taskName, preloadFn) {
    try {
      const data = await preloadFn();
      console.log(`✅ Preloaded: ${taskName}`);
      return {
        success: true,
        task: taskName,
        data
      };
    } catch (error) {
      console.warn(`⚠️ Preload failed for ${taskName}:`, error.message);
      return {
        success: false,
        task: taskName,
        error: error.message
      };
    }
  }

  // ==================== CACHE MONITORING ====================

  startCacheMonitoring(intervalMs = 60000) {
    if (this.monitoringInterval) {
      this.stopCacheMonitoring();
    }
    
    this.monitoringInterval = setInterval(() => {
      const stats = this.getCacheStats();
      
      // Log cache metrics
      console.log('📊 Cache Metrics:', {
        hitRate: stats.hitRate,
        size: stats.cacheSize,
        pending: stats.pendingRequests,
        health: stats.healthScore
      });
      
      // Auto-cleanup if needed
      if (stats.healthScore < 50) {
        console.log('🔧 Auto-optimizing cache due to low health score');
        this.optimizeCache().catch(console.error);
      }
      
    }, intervalMs);
    
    console.log(`📊 Cache monitoring started (interval: ${intervalMs}ms)`);
    
    return {
      success: true,
      intervalMs,
      message: 'Cache monitoring started'
    };
  }

  stopCacheMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('⏹️ Cache monitoring stopped');
      
      return {
        success: true,
        message: 'Cache monitoring stopped'
      };
    }
    
    return {
      success: false,
      message: 'Cache monitoring was not running'
    };
  }

  // ==================== CACHE ANALYSIS ====================

  analyzeCacheUsage() {
    const stats = this.getCacheStats();
    
    const analysis = {
      overview: {
        totalEntries: stats.size,
        hitRate: stats.hitRate,
        pendingRequests: stats.pendingRequests,
        healthScore: stats.healthScore
      },
      performance: {
        rating: this.getPerformanceRating(stats),
        bottlenecks: this.identifyBottlenecks(stats),
        improvements: this.suggestImprovements(stats)
      },
      usage: {
        mostActiveOperations: this.getMostActiveOperations(stats),
        cacheDistribution: this.getCacheDistribution(),
        memoryUsage: this.estimateMemoryUsage(stats)
      },
      timestamp: new Date().toISOString()
    };
    
    return analysis;
  }

  getPerformanceRating(stats) {
    const hitRate = parseFloat(stats.hitRate) || 0;
    
    if (hitRate >= 80) return 'excellent';
    if (hitRate >= 60) return 'good';
    if (hitRate >= 40) return 'fair';
    if (hitRate >= 20) return 'poor';
    return 'critical';
  }

  identifyBottlenecks(stats) {
    const bottlenecks = [];
    
    if (stats.pendingRequests > 10) {
      bottlenecks.push({
        type: 'high_concurrency',
        description: 'High number of pending requests causing delays'
      });
    }
    
    if (parseFloat(stats.hitRate) < 30) {
      bottlenecks.push({
        type: 'low_hit_rate',
        description: 'Low cache hit rate indicating poor cache utilization'
      });
    }
    
    return bottlenecks;
  }

  suggestImprovements(stats) {
    const improvements = [];
    
    if (parseFloat(stats.hitRate) < 50) {
      improvements.push({
        priority: 'high',
        suggestion: 'Implement data preloading for frequently accessed resources',
        implementation: 'Use preloadEnterpriseData() method on app startup'
      });
    }
    
    if (stats.cacheSize > 1000) {
      improvements.push({
        priority: 'medium',
        suggestion: 'Implement cache size limits and LRU eviction',
        implementation: 'Configure TTL values and implement cleanup strategies'
      });
    }
    
    return improvements;
  }

  getMostActiveOperations(stats) {
    const operations = stats.operationStats || {};
    
    return Object.entries(operations)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10)
      .map(([operation, data]) => ({
        operation,
        count: data.count,
        avgDuration: data.avgDuration,
        successRate: Math.round((data.successCount / data.count) * 100)
      }));
  }

  getCacheDistribution() {
    // This would analyze cache keys by service/type
    // For now, return a placeholder structure
    return {
      subscription: 25,
      team: 40,
      invitation: 20,
      analytics: 10,
      other: 5
    };
  }

  estimateMemoryUsage(stats) {
    // Rough estimation - in a real implementation you'd measure actual memory
    const avgEntrySize = 2048; // bytes
    const estimatedBytes = stats.size * avgEntrySize;
    
    return {
      entries: stats.size,
      estimatedBytes,
      estimatedKB: Math.round(estimatedBytes / 1024),
      estimatedMB: Math.round(estimatedBytes / (1024 * 1024) * 100) / 100
    };
  }

  // ==================== UTILITY METHODS ====================

  getCacheEntry(key) {
    return globalCache.get(key);
  }

  setCacheEntry(key, value, category = 'default') {
    return globalCache.set(key, value, category);
  }

  deleteCacheEntry(key) {
    globalCache.cache?.delete?.(key);
    globalCache.expirationTimes?.delete?.(key);
    
    return {
      success: true,
      message: `Cache entry ${key} deleted`
    };
  }

  searchCacheKeys(pattern) {
    const keys = [];
    
    if (globalCache.cache && globalCache.cache.keys) {
      for (const key of globalCache.cache.keys()) {
        if (key.includes(pattern)) {
          keys.push(key);
        }
      }
    }
    
    return keys;
  }

  exportCacheData() {
    const stats = this.getCacheStats();
    const analysis = this.analyzeCacheUsage();
    
    return {
      exportedAt: new Date().toISOString(),
      stats,
      analysis,
      version: '1.0.0'
    };
  }

  // ==================== CLEANUP ====================


  clearTeamCaches(teamId = null) {
    try {
      const patterns = teamId ? [
        `team_${teamId}`,
        `team_members_${teamId}`,
        `team_invitations_${teamId}`,
        `team_permissions_${teamId}`,
        `team_batch_${teamId}`
      ] : [
        'team_',
        'user_teams'
      ];
      
      patterns.forEach(pattern => {
        globalCache.invalidate(pattern);
      });
      
      console.log(`🧹 Team caches cleared${teamId ? ` for team ${teamId}` : ' (all teams)'}`);
      
      return {
        success: true,
        message: `Team caches cleared${teamId ? ` for team ${teamId}` : ' (all teams)'}`,
        patternsCleared: patterns,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error clearing team caches:', error);
      return {
        success: false,
        message: 'Failed to clear team caches',
        error: error.message
      };
    }
  }

  clearUserCaches(userId = null) {
    try {
      const patterns = userId ? [
        `user_context_${userId}`,
        `subscription_status_${userId}`,
        `enterprise_batch_${userId}`,
        `user_teams_${userId}`
      ] : [
        'user_context',
        'subscription_status',
        'enterprise_batch',
        'user_teams'
      ];
      
      patterns.forEach(pattern => {
        globalCache.invalidate(pattern);
      });
      
      console.log(`🧹 User caches cleared${userId ? ` for user ${userId}` : ' (all users)'}`);
      
      return {
        success: true,
        message: `User caches cleared${userId ? ` for user ${userId}` : ' (all users)'}`,
        patternsCleared: patterns,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error clearing user caches:', error);
      return {
        success: false,
        message: 'Failed to clear user caches',
        error: error.message
      };
    }
  }

 clearInvitationCaches(teamId = null) {
    try {
      // This logic is correct:
      // If a teamId is provided, only clear that team's invites.
      // Otherwise, clear ALL team invites AND the current user's personal pending invites.
      const patterns = teamId ? [
        `team_invitations_${teamId}`
      ] : [
        'team_invitations_',
        'user_pending_invites'
      ];
      
      patterns.forEach(pattern => {
        globalCache.invalidate(pattern);
      });
      
      const message = `Invitation caches cleared${teamId ? ` for team ${teamId}` : ' (all invitations)'}`;
      console.log(`🧹 ${message}`);
      
      // ✅ THIS IS THE MISSING PART
      return {
        success: true,
        message,
        patternsCleared: patterns,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error clearing invitation caches:', error);
      return {
        success: false,
        message: 'Failed to clear invitation caches',
        error: error.message
      };
    }
  }
    // ==================== CLEANUP ====================

  /**
   * ✅ FIXED: This method should be the last one inside the class.
   * It stops any running intervals to prevent memory leaks.
   */
  destroy() {
    this.stopCacheMonitoring();
    console.log('🧹 EnhancedCacheService instance destroyed');
  }
}
  