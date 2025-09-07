// lib/utils/usageLogger.js - ENHANCED WITH ADVANCED LOGGING
import { adminDb } from '../../firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { AdvancedLogger, FlowLogger } from './advancedLogger.js';

/**
 * Enhanced usage logger with detailed tracking and flow logging
 */
export class UsageLogger {
  /**
   * Saves detailed usage logs for AI services with comprehensive tracking
   */
  static async logAiUsage(feature, logData) {
    const flowLogger = new FlowLogger(`log_${feature}_usage`, logData.userId);
    
    try {
      flowLogger.logStep('validation_start', {
        feature,
        hasUserId: !!logData.userId,
        dataKeys: Object.keys(logData)
      });

      // Validate required fields
      if (!logData.userId) {
        throw new Error('userId is required for usage logging');
      }

      if (!logData.status) {
        logData.status = 'unknown';
      }

      // Prepare enhanced usage log with detailed metadata
      const enhancedLogData = {
        feature,
        timestamp: FieldValue.serverTimestamp(),
        requestId: this.generateRequestId(),
        sessionId: logData.sessionId || this.generateSessionId(),
        
        // Core data
        ...logData,
        
        // Enhanced metadata
        metadata: {
          ...logData.metadata,
          loggerVersion: '2.0.0',
          environment: process.env.NODE_ENV || 'unknown',
          serverTimestamp: new Date().toISOString(),
          
          // Request tracking
          requestMetadata: {
            userAgent: logData.userAgent,
            ipAddress: logData.ipAddress ? this.hashIpAddress(logData.ipAddress) : null,
            requestDuration: logData.requestDuration,
            endpoint: logData.endpoint
          },
          
          // Performance metrics
          performance: {
            apiLatency: logData.apiLatency,
            dbLatency: logData.dbLatency,
            totalLatency: logData.totalLatency,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
          }
        }
      };

      flowLogger.logStep('log_data_prepared', {
        enhancedLogSize: JSON.stringify(enhancedLogData).length,
        hasMetadata: !!enhancedLogData.metadata,
        requestId: enhancedLogData.requestId
      });

      AdvancedLogger.info('UsageLogger', 'saving_log', {
        feature,
        userId: logData.userId,
        status: logData.status,
        cost: logData.cost,
        requestId: enhancedLogData.requestId
      });

      // Save to database with retry logic
      await this.saveWithRetry(enhancedLogData, 3);

      flowLogger.complete({
        success: true,
        feature,
        requestId: enhancedLogData.requestId
      });

      AdvancedLogger.info('UsageLogger', 'log_saved_successfully', {
        feature,
        userId: logData.userId,
        requestId: enhancedLogData.requestId
      });

      return enhancedLogData.requestId;

    } catch (error) {
      flowLogger.logError('usage_logging_failed', error);
      
      // CRITICAL: Log error but don't throw - usage logging should never break the main flow
      AdvancedLogger.error('UsageLogger', 'log_save_failed', {
        feature,
        userId: logData.userId,
        error: error.message,
        logData: this.sanitizeLogData(logData)
      });

      console.error(`🔥 CRITICAL: Failed to save ${feature} usage log:`, error);
      console.error('📋 Log Data that failed to save:', this.sanitizeLogData(logData));
      
      // Return null to indicate failure without breaking the flow
      return null;
    }
  }

  /**
   * Save with retry logic for better reliability
   */
  static async saveWithRetry(logData, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const docRef = await adminDb.collection('UsageLogs').add(logData);
        
        AdvancedLogger.debug('UsageLogger', 'save_successful', {
          attempt,
          docId: docRef.id,
          feature: logData.feature
        });
        
        return docRef;
      } catch (error) {
        lastError = error;
        
        AdvancedLogger.warn('UsageLogger', 'save_attempt_failed', {
          attempt,
          maxRetries,
          error: error.message,
          feature: logData.feature
        });

        if (attempt < maxRetries) {
          // Exponential backoff: wait 2^attempt seconds
          const delayMs = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Specific logger for Gemini Enhancement usage
   */
  static async logGeminiEnhancementUsage(logData) {
    const enhancedData = {
      ...logData,
      feature: "geminiGroupingEnhancer",
      
      // Add Gemini-specific metadata
      geminiMetadata: {
        modelUsed: logData.model || 'unknown',
        promptTokens: logData.promptTokens,
        completionTokens: logData.completionTokens,
        totalTokens: logData.totalTokens,
        finishReason: logData.finishReason,
        
        // Performance metrics
        requestLatency: logData.requestLatency,
        processingTime: logData.processingTime,
        
        // Content metrics
        contactsProcessed: logData.contactsProcessed,
        groupsGenerated: logData.details?.groupsGenerated || 0,
        analysisQuality: logData.details?.analysisQuality
      }
    };

    return await this.logAiUsage('geminiGroupingEnhancer', enhancedData);
  }

  /**
   * Specific logger for Business Card Scanner usage
   */
  static async logBusinessCardUsage(logData) {
    const enhancedData = {
      ...logData,
      feature: "businessCardScanner",
      
      // Add scanner-specific metadata
      scannerMetadata: {
        imageSize: logData.imageSize,
        imageFormat: logData.imageFormat,
        processingTime: logData.processingTime,
        confidenceScore: logData.confidenceScore,
        fieldsExtracted: logData.fieldsExtracted || [],
        
        // OCR metrics
        ocrAccuracy: logData.ocrAccuracy,
        textRegionsDetected: logData.textRegionsDetected,
        
        // Processing details
        preprocessingTime: logData.preprocessingTime,
        ocrTime: logData.ocrTime,
        postprocessingTime: logData.postprocessingTime
      }
    };

    return await this.logAiUsage('businessCardScanner', enhancedData);
  }

  /**
   * Specific logger for Semantic Search usage
   */
  static async logSemanticSearchUsage(logData) {
    const enhancedData = {
      ...logData,
      feature: "semanticSearch",
      
      // Add search-specific metadata
      searchMetadata: {
        queryLength: logData.queryLength,
        queryComplexity: this.calculateQueryComplexity(logData.query || ''),
        resultsCount: logData.resultsCount,
        searchLatency: logData.searchLatency,
        
        // Vector search metrics
        embeddingDimensions: logData.embeddingDimensions,
        vectorSimilarityThreshold: logData.vectorSimilarityThreshold,
        averageScore: logData.averageScore,
        topScore: logData.topScore,
        
        // Enhancement metrics
        enhancementUsed: logData.enhancementUsed,
        enhancementLatency: logData.enhancementLatency,
        insightsGenerated: logData.insightsGenerated,
        
        // Cost breakdown
        costBreakdown: logData.costBreakdown || {}
      }
    };

    return await this.logAiUsage('semanticSearch', enhancedData);
  }

  /**
   * Aggregate usage statistics for analytics
   */
  static async getUsageAnalytics(userId, feature = null, timeframe = '30d') {
    const flowLogger = new FlowLogger('usage_analytics', userId);
    
    try {
      flowLogger.logStep('analytics_query_start', {
        userId,
        feature,
        timeframe
      });

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeframe) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }

      // Build query
      let query = adminDb.collection('UsageLogs')
        .where('userId', '==', userId)
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate);

      if (feature) {
        query = query.where('feature', '==', feature);
      }

      const snapshot = await query.get();
      
      flowLogger.logStep('analytics_data_retrieved', {
        documentsCount: snapshot.size,
        timeRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() }
      });

      // Process analytics
      const analytics = {
        totalRequests: snapshot.size,
        totalCost: 0,
        averageCost: 0,
        successRate: 0,
        features: {},
        dailyBreakdown: {},
        
        // Performance metrics
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0
      };

      const latencies = [];
      let successCount = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Cost aggregation
        analytics.totalCost += data.cost || 0;
        
        // Success rate calculation
        if (data.status === 'success') {
          successCount++;
        }
        
        // Feature breakdown
        if (!analytics.features[data.feature]) {
          analytics.features[data.feature] = {
            count: 0,
            totalCost: 0,
            successCount: 0
          };
        }
        analytics.features[data.feature].count++;
        analytics.features[data.feature].totalCost += data.cost || 0;
        if (data.status === 'success') {
          analytics.features[data.feature].successCount++;
        }
        
        // Latency tracking
        if (data.metadata?.performance?.totalLatency) {
          latencies.push(data.metadata.performance.totalLatency);
        }
        
        // Daily breakdown
        const day = data.timestamp.toDate().toISOString().split('T')[0];
        if (!analytics.dailyBreakdown[day]) {
          analytics.dailyBreakdown[day] = { count: 0, cost: 0 };
        }
        analytics.dailyBreakdown[day].count++;
        analytics.dailyBreakdown[day].cost += data.cost || 0;
      });

      // Calculate derived metrics
      analytics.averageCost = analytics.totalRequests > 0 ? analytics.totalCost / analytics.totalRequests : 0;
      analytics.successRate = analytics.totalRequests > 0 ? (successCount / analytics.totalRequests) * 100 : 0;
      
      // Latency percentiles
      if (latencies.length > 0) {
        latencies.sort((a, b) => a - b);
        analytics.averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        analytics.p95Latency = latencies[Math.floor(latencies.length * 0.95)];
        analytics.p99Latency = latencies[Math.floor(latencies.length * 0.99)];
      }

      flowLogger.complete({
        success: true,
        analyticsGenerated: true,
        totalRequests: analytics.totalRequests
      });

      AdvancedLogger.info('UsageLogger', 'analytics_generated', {
        userId,
        feature,
        timeframe,
        totalRequests: analytics.totalRequests,
        totalCost: analytics.totalCost
      });

      return analytics;

    } catch (error) {
      flowLogger.logError('analytics_failed', error);
      
      AdvancedLogger.error('UsageLogger', 'analytics_failed', {
        userId,
        feature,
        timeframe,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Utility methods
   */
  static generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  static hashIpAddress(ip) {
    // Simple hash for privacy - in production use a proper crypto hash
    return `hash_${ip.split('.').map(part => parseInt(part).toString(16)).join('')}`;
  }

  static calculateQueryComplexity(query) {
    const wordCount = query.split(' ').length;
    const hasSpecialTerms = /\b(and|or|not|\+|\-|\".*\")\b/i.test(query);
    const hasWildcards = /\*|\?/.test(query);
    
    let complexity = 'simple';
    if (wordCount > 10 || hasSpecialTerms || hasWildcards) {
      complexity = 'complex';
    } else if (wordCount > 5) {
      complexity = 'medium';
    }
    
    return complexity;
  }

  static sanitizeLogData(data) {
    const sanitized = { ...data };
    
    // Remove sensitive information
    if (sanitized.apiKey) sanitized.apiKey = '[REDACTED]';
    if (sanitized.token) sanitized.token = '[REDACTED]';
    if (sanitized.authorization) sanitized.authorization = '[REDACTED]';
    if (sanitized.ipAddress) sanitized.ipAddress = this.hashIpAddress(sanitized.ipAddress);
    
    return sanitized;
  }
}

// Export legacy functions for backward compatibility
export async function logGeminiEnhancementUsage(logData) {
  return UsageLogger.logGeminiEnhancementUsage(logData);
}

export async function logBusinessCardUsage(logData) {
  return UsageLogger.logBusinessCardUsage(logData);
}