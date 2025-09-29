// lib/services/client/passwordResetService.js
"use client";

export class PasswordResetService {
    /**
     * Validates an email for password reset by calling the server-side API.
     * @param {string} email
     * @returns {Promise<{exists: boolean, metadata?: object}>}
     */
    static async validateEmailForReset(email) {
        try {
            const response = await fetch('/api/validate-reset-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return {
                exists: data.exists,
                metadata: {
                    processingTime: data.processingTime,
                    requestId: data.requestId
                }
            };
        } catch (error) {
            console.error('PasswordResetService: Email validation failed:', error);
            throw error;
        }
    }

    /**
     * Initiates a password reset request
     * @param {string} email
     * @returns {Promise<{success: boolean, message: string, resetId: string}>}
     */
    static async initiatePasswordReset(email) {
        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return {
                success: data.success,
                message: data.message,
                resetId: data.resetId,
                resetLink: data.resetLink, // Remove in production
                metadata: {
                    processingTime: data.processingTime,
                    requestId: data.requestId
                }
            };
        } catch (error) {
            console.error('PasswordResetService: Password reset initiation failed:', error);
            throw error;
        }
    }

    /**
     * Validates a password reset token
     * @param {string} token - The reset token
     * @param {string} email - The email address
     * @returns {Promise<{valid: boolean, resetData?: object}>}
     */
    static async validateResetToken(token, email) {
        try {
            const response = await fetch('/api/auth/validate-reset-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token, email }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return {
                valid: data.valid,
                resetData: data.resetData,
                reason: data.reason
            };
        } catch (error) {
            console.error('PasswordResetService: Reset token validation failed:', error);
            throw error;
        }
    }

    /**
     * Completes the password reset process
     * @param {string} token - The reset token
     * @param {string} email - The email address
     * @param {string} newPassword - The new password
     * @returns {Promise<{success: boolean, message: string}>}
     */
    static async completePasswordReset(token, email, newPassword) {
        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token, email, newPassword }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return {
                success: data.success,
                message: data.message
            };
        } catch (error) {
            console.error('PasswordResetService: Password reset completion failed:', error);
            throw error;
        }
    }

    /**
     * Formats common password reset errors into user-friendly messages
     * @param {Error} error
     * @returns {string}
     */
    static formatError(error) {
        const message = error.message.toLowerCase();

        if (message.includes('no account found')) {
            return 'No account found with this email address';
        } else if (message.includes('invalid email')) {
            return 'Please enter a valid email address';
        } else if (message.includes('too many requests') || message.includes('rate limit')) {
            return 'Too many attempts. Please wait a moment before trying again';
        } else if (message.includes('blocked')) {
            return 'Request temporarily blocked. Please try again later';
        } else if (message.includes('network')) {
            return 'Network error. Please check your connection and try again';
        } else if (message.includes('invalid or expired reset token')) {
            return 'This reset link has expired or is invalid. Please request a new one';
        } else if (message.includes('passwords do not match')) {
            return 'Passwords do not match';
        } else if (message.includes('token already used')) {
            return 'This reset link has already been used. Please request a new one';
        } else {
            return 'An error occurred. Please try again';
        }
    }
}