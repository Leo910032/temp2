// lib/services/serviceContact/client/services/SearchFeedbackService.js
"use client";

import { ContactApiClient } from '@/lib/services/core/ApiClient';

/**
 * SearchFeedbackService
 *
 * Client-side service for submitting user feedback on semantic search results.
 * Follows the established pattern: Client Service → API → Server Service
 *
 * Architecture:
 * - Uses ContactApiClient for API communication
 * - Implements localStorage caching to prevent duplicate submissions
 * - No direct database access (follows clean architecture)
 */
export class SearchFeedbackService {
    // localStorage key prefix for feedback cache
    static FEEDBACK_CACHE_PREFIX = 'search_feedback_';

    /**
     * Submit feedback for a semantic search session
     *
     * @param {string} sessionId - The search session ID
     * @param {boolean} isPositive - true = good search, false = not good search
     * @returns {Promise<{success: boolean, message: string, alreadySubmitted?: boolean}>}
     */
    static async submitFeedback(sessionId, isPositive) {
        console.log('[SearchFeedbackService] Submitting feedback:', { sessionId, isPositive });

        try {
            // Validate input
            if (!sessionId || typeof sessionId !== 'string') {
                throw new Error('Invalid session ID');
            }

            if (typeof isPositive !== 'boolean') {
                throw new Error('Invalid feedback value - must be boolean');
            }

            // Check cache first to prevent duplicate submissions
            const cachedFeedback = this.getFeedbackFromCache(sessionId);
            if (cachedFeedback) {
                console.log('[SearchFeedbackService] Feedback already submitted (from cache)');
                return {
                    success: true,
                    alreadySubmitted: true,
                    message: 'Feedback already submitted for this search'
                };
            }

            // Call API endpoint
            const response = await ContactApiClient.post('/api/user/feedback/search-feedback', {
                sessionId,
                isPositive
            });

            // Cache the feedback to prevent duplicate submissions
            this.saveFeedbackToCache(sessionId, isPositive);

            console.log('[SearchFeedbackService] Feedback submitted successfully');
            return {
                success: true,
                message: 'Feedback submitted successfully'
            };

        } catch (error) {
            console.error('[SearchFeedbackService] Error submitting feedback:', error);

            // Handle specific error cases
            if (error.message?.includes('already submitted')) {
                this.saveFeedbackToCache(sessionId, isPositive);
                return {
                    success: true,
                    alreadySubmitted: true,
                    message: 'Feedback already submitted for this search'
                };
            }

            return {
                success: false,
                message: error.message || 'Failed to submit feedback'
            };
        }
    }

    /**
     * Get cached feedback for a session from localStorage
     *
     * @param {string} sessionId - The search session ID
     * @returns {Object|null} Cached feedback or null if not found
     */
    static getFeedbackFromCache(sessionId) {
        try {
            const cacheKey = this.FEEDBACK_CACHE_PREFIX + sessionId;
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
                return JSON.parse(cached);
            }

            return null;
        } catch (error) {
            console.warn('[SearchFeedbackService] Error reading from cache:', error);
            return null;
        }
    }

    /**
     * Save feedback to localStorage cache
     *
     * @param {string} sessionId - The search session ID
     * @param {boolean} isPositive - The feedback value
     */
    static saveFeedbackToCache(sessionId, isPositive) {
        try {
            const cacheKey = this.FEEDBACK_CACHE_PREFIX + sessionId;
            const feedbackData = {
                isPositive,
                submittedAt: new Date().toISOString(),
                sessionId
            };

            localStorage.setItem(cacheKey, JSON.stringify(feedbackData));
            console.log('[SearchFeedbackService] Feedback cached locally');
        } catch (error) {
            console.warn('[SearchFeedbackService] Error saving to cache:', error);
            // Non-critical error, don't throw
        }
    }

    /**
     * Clear all cached feedback (for testing/cleanup)
     */
    static clearFeedbackCache() {
        try {
            const keys = Object.keys(localStorage);
            const feedbackKeys = keys.filter(key => key.startsWith(this.FEEDBACK_CACHE_PREFIX));

            feedbackKeys.forEach(key => localStorage.removeItem(key));
            console.log('[SearchFeedbackService] Cache cleared:', feedbackKeys.length, 'items removed');
        } catch (error) {
            console.warn('[SearchFeedbackService] Error clearing cache:', error);
        }
    }
}
