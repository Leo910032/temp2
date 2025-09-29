// lib/services/client/disposableEmailService.js
"use client";

export class DisposableEmailService {
    /**
     * Checks if an email address uses a disposable email domain
     * @param {string} email - Email address to check
     * @param {object} options - Configuration options
     * @param {boolean} options.strict - Use strict mode (default: false)
     * @returns {Promise<{isDisposable: boolean, domain: string, confidence: string}>}
     */
    static async isDisposableEmail(email, options = {}) {
        const { strict = false } = options;
        
        try {
            const response = await fetch('/api/validate-disposable-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, strict }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return {
                isDisposable: data.isDisposable,
                domain: data.domain,
                confidence: data.confidence,
                cacheStats: data.cacheStats,
                metadata: {
                    processingTime: data.processingTime,
                    requestId: data.requestId
                }
            };
        } catch (error) {
            console.error('DisposableEmailService: Validation failed:', error);
            throw error;
        }
    }

    /**
     * Gets service statistics
     * @returns {Promise<object>} - Service statistics
     */
    static async getServiceStats() {
        try {
            const response = await fetch('/api/validate-disposable-email', {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('DisposableEmailService: Failed to get stats:', error);
            throw error;
        }
    }

    /**
     * Formats error messages into user-friendly text
     * @param {Error} error - Error object
     * @returns {string} - User-friendly error message
     */
    static formatError(error) {
        const message = error.message.toLowerCase();

        if (message.includes('invalid email format')) {
            return 'Please enter a valid email address';
        } else if (message.includes('disposable') && message.includes('not allowed')) {
            return 'Temporary or disposable email addresses are not allowed';
        } else if (message.includes('network') || message.includes('fetch')) {
            return 'Network error. Please check your connection and try again';
        } else if (message.includes('service temporarily unavailable')) {
            return 'Email validation service is temporarily unavailable';
        } else {
            return 'Unable to validate email address. Please try again';
        }
    }
}
