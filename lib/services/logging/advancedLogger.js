// lib/utils/advancedLogger.js - Centralized logging system
export class AdvancedLogger {
  static logLevel = process.env.NODE_ENV === 'development' ? 'DEBUG' : 'INFO';
  
  static log(level, service, operation, data, additionalContext = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service,
      operation,
      data: this.sanitizeData(data),
      context: additionalContext,
      requestId: additionalContext.requestId || this.generateRequestId()
    };

    // Color-coded console output
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
      RESET: '\x1b[0m'
    };

    const emoji = {
      DEBUG: '🔍',
      INFO: '📝',
      WARN: '⚠️',
      ERROR: '❌'
    };

    console.log(
      `${colors[level]}${emoji[level]} [${service}:${operation}] ${timestamp}${colors.RESET}`,
      logEntry
    );

    // In production, you could send to external logging service
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalLogger(logEntry);
    }

    return logEntry.requestId;
  }

  static sanitizeData(data) {
    if (!data) return data;
    
    // Remove sensitive information
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove API keys, tokens, etc.
    if (sanitized.apiKey) sanitized.apiKey = '[REDACTED]';
    if (sanitized.token) sanitized.token = '[REDACTED]';
    if (sanitized.authorization) sanitized.authorization = '[REDACTED]';
    
    return sanitized;
  }

  static generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static sendToExternalLogger(logEntry) {
    // Implementation for external logging service (DataDog, LogRocket, etc.)
    // console.log('Would send to external logger:', logEntry);
  }

  // Convenience methods
  static debug(service, operation, data, context) {
    return this.log('DEBUG', service, operation, data, context);
  }

  static info(service, operation, data, context) {
    return this.log('INFO', service, operation, data, context);
  }

  static warn(service, operation, data, context) {
    return this.log('WARN', service, operation, data, context);
  }

  static error(service, operation, data, context) {
    return this.log('ERROR', service, operation, data, context);
  }
}

// Enhanced Pinecone logging wrapper
export class PineconeLogger {
  static async logQuery(operation, input, output, metadata = {}) {
    const requestId = AdvancedLogger.generateRequestId();
    
    // Log input
    AdvancedLogger.debug('Pinecone', `${operation}_INPUT`, {
      vectorDimensions: input.vector?.length,
      topK: input.topK,
      filter: input.filter,
      namespace: input.namespace,
      includeMetadata: input.includeMetadata,
      includeValues: input.includeValues
    }, { requestId, ...metadata });

    // Log output
    AdvancedLogger.debug('Pinecone', `${operation}_OUTPUT`, {
      matchesCount: output.matches?.length,
      matches: output.matches?.map(match => ({
        id: match.id,
        score: match.score,
        metadataKeys: Object.keys(match.metadata || {}),
        hasValues: !!match.values
      })),
      usage: output.usage
    }, { requestId, ...metadata });

    return requestId;
  }

  static async logUpsert(vectors, namespace, metadata = {}) {
    const requestId = AdvancedLogger.generateRequestId();
    
    AdvancedLogger.info('Pinecone', 'UPSERT_INPUT', {
      vectorCount: vectors.length,
      namespace,
      sampleVector: vectors[0] ? {
        id: vectors[0].id,
        dimension: vectors[0].values?.length,
        metadataKeys: Object.keys(vectors[0].metadata || {})
      } : null
    }, { requestId, ...metadata });

    return requestId;
  }
}

// Enhanced Gemini logging wrapper
export class GeminiLogger {
  static async logRequest(model, prompt, response, metadata = {}) {
    const requestId = AdvancedLogger.generateRequestId();
    
    // Log input
    AdvancedLogger.debug('Gemini', 'REQUEST_INPUT', {
      model,
      promptLength: prompt.length,
      promptPreview: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
      promptWordCount: prompt.split(' ').length
    }, { requestId, ...metadata });

    // Log output
    const responseText = response.response?.text() || '';
    AdvancedLogger.debug('Gemini', 'REQUEST_OUTPUT', {
      responseLength: responseText.length,
      responsePreview: responseText.substring(0, 2000000) + (responseText.length > 200000 ? '...' : ''),
      responseWordCount: responseText.split(' ').length,
      usage: response.response?.usageMetadata ? {
        promptTokenCount: response.response.usageMetadata.promptTokenCount,
        candidatesTokenCount: response.response.usageMetadata.candidatesTokenCount,
        totalTokenCount: response.response.usageMetadata.totalTokenCount
      } : null,
      finishReason: response.response?.candidates?.[0]?.finishReason
    }, { requestId, ...metadata });

    return requestId;
  }

  static async logEmbedding(text, embedding, metadata = {}) {
    const requestId = AdvancedLogger.generateRequestId();
    
    AdvancedLogger.debug('Gemini', 'EMBEDDING_INPUT', {
      textLength: text.length,
      textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      textWordCount: text.split(' ').length
    }, { requestId, ...metadata });

    AdvancedLogger.debug('Gemini', 'EMBEDDING_OUTPUT', {
      embeddingDimension: embedding.length,
      embeddingPreview: embedding.slice(0, 5),
      embeddingMagnitude: Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    }, { requestId, ...metadata });

    return requestId;
  }
}

// Flow tracking for multi-step operations
export class FlowLogger {
  constructor(flowName, userId = null) {
    this.flowName = flowName;
    this.userId = userId;
    this.flowId = AdvancedLogger.generateRequestId();
    this.steps = [];
    this.startTime = Date.now();
    
    AdvancedLogger.info('Flow', 'FLOW_START', {
      flowName,
      userId,
      flowId: this.flowId
    });
  }

  logStep(stepName, data, metadata = {}) {
    const stepData = {
      stepName,
      stepNumber: this.steps.length + 1,
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      data,
      ...metadata
    };
    
    this.steps.push(stepData);
    
    AdvancedLogger.info('Flow', 'FLOW_STEP', stepData, {
      flowId: this.flowId,
      flowName: this.flowName,
      userId: this.userId
    });
    
    return stepData;
  }

  logError(stepName, error, metadata = {}) {
    const errorData = {
      stepName,
      stepNumber: this.steps.length + 1,
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      ...metadata
    };
    
    this.steps.push(errorData);
    
    AdvancedLogger.error('Flow', 'FLOW_ERROR', errorData, {
      flowId: this.flowId,
      flowName: this.flowName,
      userId: this.userId
    });
    
    return errorData;
  }

  complete(finalData = {}) {
    const completionData = {
      totalSteps: this.steps.length,
      totalDuration: Date.now() - this.startTime,
      success: !this.steps.some(step => step.error),
      finalData,
      summary: this.steps.map(step => ({
        step: step.stepName,
        duration: step.duration,
        hasError: !!step.error
      }))
    };
    
    AdvancedLogger.info('Flow', 'FLOW_COMPLETE', completionData, {
      flowId: this.flowId,
      flowName: this.flowName,
      userId: this.userId
    });
    
    return completionData;
  }
}