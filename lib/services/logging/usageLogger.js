import { adminDb } from '../../firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Provides a standardized console log for AI services.
 * @param {'INFO' | 'SUCCESS' | 'ERROR'} level - The log level.
 * @param {string} feature - The feature area (e.g., 'GeminiEnhancer').
 * @param {string} message - The log message.
 * @param {object} data - Additional data to log.
 */
const logAiMessage = (level, feature, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const emoji = level === 'SUCCESS' ? '✅' : level === 'ERROR' ? '❌' : '🤖';
  console.log(`${emoji} [${feature}] ${timestamp} - ${message}`, data);
};

/**
 * Saves a usage log for the Gemini Grouping Enhancer feature to the database.
 * This function is designed to not throw errors that would interrupt the main flow.
 * 
 * @param {object} logData - The data to be logged.
 * @param {string} logData.userId - The ID of the user performing the action.
 * @param {string} logData.status - The final status (e.g., 'success', 'partial_success', 'no_op').
 * @param {number} logData.cost - The total estimated cost of the operation.
 * @param {string} logData.model - The AI model used.
 * @param {string} logData.subscriptionLevel - The user's subscription level.
 * @param {number} logData.contactsProcessed - The number of contacts sent for processing.
 * @param {object} logData.details - An object containing detailed results.
 */
export async function logGeminiEnhancementUsage(logData) {
  try {
    const usageLog = {
      feature: "geminiGroupingEnhancer",
      timestamp: FieldValue.serverTimestamp(),
      ...logData
    };
    
    await adminDb.collection('UsageLogs').add(usageLog);
    
    logAiMessage('SUCCESS', 'UsageLogger', 'Gemini enhancement usage log saved to database.', { 
      userId: logData.userId,
      cost: logData.cost
    });

  } catch (error) {
    // CRITICAL: We log the error but do not re-throw it.
    // The user's request should not fail just because logging failed.
    console.error("🔥 CRITICAL: Failed to save Gemini usage log to database:", error);
    console.error("📋 Log Data that failed to save:", logData);
  }
}

/**
 * Saves a usage log for the Business Card Scanner feature to the database.
 * @param {object} logData - The data to be logged.
 */
export async function logBusinessCardUsage(logData) {
  try {
    const usageLog = {
      feature: "businessCardScanner",
      timestamp: FieldValue.serverTimestamp(),
      ...logData
    };
    
    await adminDb.collection('UsageLogs').add(usageLog);
    
    logAiMessage('SUCCESS', 'UsageLogger', 'Business card scan usage log saved to database.', { 
      userId: logData.userId,
      cost: logData.cost
    });

  } catch (error) {
    console.error("🔥 CRITICAL: Failed to save Business Card usage log to database:", error);
    console.error("📋 Log Data that failed to save:", logData);
  }
}