// lib/services/server/passwordResetService.js

import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { validateEmail as isValidEmail } from '@/lib/utilities';
import { EmailService } from './emailService';

// Rate limiting map for password reset requests
const rateLimitMap = new Map();
setInterval(() => {
    const now = Date.now();
    rateLimitMap.forEach((data, key) => {
        if (now - data.lastReset > 5 * 60 * 1000) {
            rateLimitMap.delete(key);
        }
    });
}, 5 * 60 * 1000);

function checkRateLimit(key, maxRequests, windowMs) {
    const rateLimitData = rateLimitMap.get(key) || { count: 0, lastReset: Date.now() };
    if (Date.now() - rateLimitData.lastReset > windowMs) {
        rateLimitData.count = 0;
        rateLimitData.lastReset = Date.now();
    }
    if (rateLimitData.count >= maxRequests) {
        return false; // Rate limit exceeded
    }
    rateLimitData.count++;
    rateLimitMap.set(key, rateLimitData);
    return true;
}

export class PasswordResetService {
    /**
     * Validates if an email exists in the system for password reset
     * @param {object} options
     * @param {string} options.email - The email to check
     * @param {string} options.ip - The IP address for rate limiting
     * @returns {Promise<{exists: boolean, metadata?: object}>}
     */
    static async validateEmailForReset({ email, ip }) {
        const rateLimitKey = `validate-reset-email:${ip}`;
        const maxRequests = 10; // Lower limit for reset requests
        const windowMs = 60000; // 1 minute window
        
        if (!checkRateLimit(rateLimitKey, maxRequests, windowMs)) {
            throw new Error('Too many requests');
        }

        if (!email || typeof email !== 'string') {
            throw new Error('Email is required');
        }
        
        const cleanEmail = email.trim().toLowerCase();
        
        if (!isValidEmail(cleanEmail)) {
            throw new Error('Invalid email format');
        }

        const dbStartTime = Date.now();
        
        try {
            // Check Firebase Auth first
            const userRecord = await adminAuth.getUserByEmail(cleanEmail);
            
            // Also check if user has a Firestore document
            let userDoc = await adminDb.collection('users').doc(userRecord.uid).get();
            
            if (!userDoc.exists) {
                // Fallback to AccountData collection for backwards compatibility
                userDoc = await adminDb.collection('AccountData').doc(userRecord.uid).get();
            }
            
            const dbQueryTime = Date.now() - dbStartTime;
            
            return {
                exists: true,
                metadata: {
                    dbQueryTime,
                    cleanEmail,
                    hasFirestoreDoc: userDoc.exists,
                    rateLimit: { maxRequests, windowMs }
                }
            };
        } catch (error) {
            const dbQueryTime = Date.now() - dbStartTime;
            
            if (error.code === 'auth/user-not-found') {
                return {
                    exists: false,
                    metadata: {
                        dbQueryTime,
                        cleanEmail,
                        rateLimit: { maxRequests, windowMs }
                    }
                };
            }
            throw error;
        }
    }

    /**
     * Initiates a password reset process
     * @param {object} options
     * @param {string} options.email - The email to send reset link to
     * @param {string} options.ip - The IP address for rate limiting and logging
     * @param {string} options.userAgent - User agent for logging
     * @returns {Promise<{success: boolean, resetId: string}>}
     */
    static async initiatePasswordReset({ email, ip, userAgent }) {
        const rateLimitKey = `password-reset:${ip}`;
        const maxRequests = 3; // Max 3 reset attempts per hour per IP
        const windowMs = 60 * 60 * 1000; // 1 hour window
        
        if (!checkRateLimit(rateLimitKey, maxRequests, windowMs)) {
            throw new Error('Too many password reset attempts. Please try again later.');
        }

        // Validate email exists
        const emailValidation = await this.validateEmailForReset({ email, ip });
        if (!emailValidation.exists) {
            throw new Error('No account found with this email address');
        }

        const cleanEmail = emailValidation.metadata.cleanEmail;
        
        try {
            // Get user record from Firebase Auth
            const userRecord = await adminAuth.getUserByEmail(cleanEmail);
            
            // Create our own secure reset token instead of using Firebase's problematic generatePasswordResetLink
            const resetToken = this._generateSecureResetToken();
            const baseUrl = process.env.NODE_ENV === 'development' 
                ? 'http://localhost:3000' 
                : process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.com';
            const resetLink = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;
            
            // Create reset request record for tracking
            const resetId = `reset_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const resetRecord = {
                resetId,
                resetToken, // Store our custom token
                email: cleanEmail,
                userId: userRecord.uid,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
                ipAddress: ip,
                userAgent,
                used: false
            };
            
            // Store reset request (optional - for tracking/analytics)
            await adminDb.collection('passwordResets').doc(resetId).set(resetRecord);
            
            // Get user's display name for personalized email
            let userName = cleanEmail.split('@')[0]; // fallback to email prefix
            
            // Try to get the actual user name from Firestore
            try {
                let userDoc = await adminDb.collection('users').doc(userRecord.uid).get();
                if (!userDoc.exists) {
                    userDoc = await adminDb.collection('AccountData').doc(userRecord.uid).get();
                }
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    userName = userData.displayName || userData.username || userName;
                }
            } catch (error) {
                console.warn('Could not fetch user name for password reset email:', error.message);
            }
            
            // Send password reset email using our EmailService
            await EmailService.sendPasswordResetEmail(cleanEmail, userName, resetLink);
            
            console.log(`Password reset initiated for ${cleanEmail} with reset ID: ${resetId}`);
            
            return {
                success: true,
                resetId,
                message: 'Password reset link sent to your email'
            };
            
        } catch (error) {
            console.error('PasswordResetService: Error initiating password reset:', error);
            
            // Handle specific Firebase errors
            if (error.code === 'auth/unauthorized-continue-uri') {
                throw new Error('Password reset configuration error. Please contact support.');
            }
            
            throw new Error('Failed to send password reset email');
        }
    }

    /**
     * Validates a password reset token/link
     * @param {string} resetId - The reset ID to validate
     * @returns {Promise<{valid: boolean, resetData?: object}>}
     */
    static async validateResetToken(resetId) {
        if (!resetId) {
            throw new Error('Reset ID is required');
        }

        try {
            const resetDoc = await adminDb.collection('passwordResets').doc(resetId).get();
            
            if (!resetDoc.exists) {
                return { valid: false, reason: 'Invalid reset token' };
            }
            
            const resetData = resetDoc.data();
            const now = new Date();
            
            if (resetData.used) {
                return { valid: false, reason: 'Reset token already used' };
            }
            
            if (now > resetData.expiresAt.toDate()) {
                return { valid: false, reason: 'Reset token expired' };
            }
            
            return {
                valid: true,
                resetData: {
                    email: resetData.email,
                    userId: resetData.userId,
                    createdAt: resetData.createdAt.toDate()
                }
            };
            
        } catch (error) {
            console.error('PasswordResetService: Error validating reset token:', error);
            throw new Error('Failed to validate reset token');
        }
    }

    /**
     * Mark a reset token as used
     * @param {string} resetId - The reset ID to mark as used
     * @returns {Promise<void>}
     */
    static async markResetTokenUsed(resetId) {
        if (!resetId) {
            throw new Error('Reset ID is required');
        }

        try {
            await adminDb.collection('passwordResets').doc(resetId).update({
                used: true,
                usedAt: new Date()
            });
        } catch (error) {
            console.error('PasswordResetService: Error marking reset token as used:', error);
            // Don't throw - this is not critical
        }
    }

    /**
     * Clean up expired password reset tokens
     * @param {number} daysToKeep - Days to keep old tokens (default: 7)
     * @returns {Promise<number>} - Number of tokens cleaned up
     */
    static async cleanupExpiredTokens(daysToKeep = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            console.log(`Cleaning up password reset tokens older than ${daysToKeep} days...`);
            
            const expiredTokensQuery = adminDb.collection('passwordResets')
                .where('createdAt', '<', cutoffDate)
                .limit(100);
            
            const snapshot = await expiredTokensQuery.get();
            
            if (snapshot.empty) {
                console.log('No expired password reset tokens to clean up');
                return 0;
            }
            
            const batch = adminDb.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            
            console.log(`Cleaned up ${snapshot.docs.length} expired password reset tokens`);
            return snapshot.docs.length;
            
        } catch (error) {
            console.error('Error cleaning up expired password reset tokens:', error);
            return 0;
        }
    }

    /**
     * Generates a cryptographically secure reset token
     * @private
     */
    static _generateSecureResetToken() {
        const crypto = require('crypto');
        // Generate a 32-byte random token and encode it as base64url
        return crypto.randomBytes(32).toString('base64url');
    }

    /**
     * Validates a custom reset token (for our custom reset system)
     * @param {string} token - The reset token
     * @param {string} email - The email address
     * @returns {Promise<{valid: boolean, resetData?: object}>}
     */
    static async validateCustomResetToken(token, email) {
        if (!token || !email) {
            return { valid: false, reason: 'Missing token or email' };
        }

        try {
            const cleanEmail = email.trim().toLowerCase();
            
            // Find reset record by token and email
            const resetQuery = adminDb.collection('passwordResets')
                .where('resetToken', '==', token)
                .where('email', '==', cleanEmail)
                .limit(1);
            
            const snapshot = await resetQuery.get();
            
            if (snapshot.empty) {
                return { valid: false, reason: 'Invalid reset token' };
            }
            
            const resetDoc = snapshot.docs[0];
            const resetData = resetDoc.data();
            const now = new Date();
            
            if (resetData.used) {
                return { valid: false, reason: 'Reset token already used' };
            }
            
            if (now > resetData.expiresAt.toDate()) {
                return { valid: false, reason: 'Reset token expired' };
            }
            
            return {
                valid: true,
                resetData: {
                    resetId: resetData.resetId,
                    email: resetData.email,
                    userId: resetData.userId,
                    createdAt: resetData.createdAt.toDate()
                }
            };
            
        } catch (error) {
            console.error('PasswordResetService: Error validating custom reset token:', error);
            return { valid: false, reason: 'Token validation failed' };
        }
    }

    /**
     * Completes a password reset using our custom token system
     * @param {string} token - The reset token
     * @param {string} email - The email address
     * @param {string} newPassword - The new password
     * @returns {Promise<{success: boolean}>}
     */
    static async completePasswordReset(token, email, newPassword) {
        try {
            // Validate the token first
            const tokenValidation = await this.validateCustomResetToken(token, email);
            
            if (!tokenValidation.valid) {
                throw new Error(tokenValidation.reason || 'Invalid reset token');
            }
            
            const { resetId, userId } = tokenValidation.resetData;
            
            // Update the user's password using Firebase Admin SDK
            await adminAuth.updateUser(userId, {
                password: newPassword
            });
            
            // Mark the reset token as used
            await this.markResetTokenUsed(resetId);
            
            console.log(`Password successfully reset for user: ${userId}`);
            
            return {
                success: true,
                message: 'Password has been successfully reset'
            };
            
        } catch (error) {
            console.error('PasswordResetService: Error completing password reset:', error);
            throw new Error(`Failed to reset password: ${error.message}`);
        }
    }
}