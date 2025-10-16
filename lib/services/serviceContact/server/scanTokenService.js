// lib/services/serviceContact/server/scanTokenService.js
import jwt from 'jsonwebtoken';
import { adminDb } from '@/lib/firebaseAdmin';
import { CostTrackingService } from './costTrackingService';

export class ScanTokenService {

  /**
   * Generate a secure scan token for public business card scanning
   * This token allows one-time use of the scanning API and tracks costs to the profile owner
   */
  static async generatePublicScanToken(profileOwnerId, profileOwnerName) {
    try {
      console.log(`🔐 Generating scan token for profile owner: ${profileOwnerId}`);

      // 1. Check if profile owner can afford a scan
      const costCheck = await CostTrackingService.canAffordOperation(
        profileOwnerId,
        0.002, // Estimated cost for business card scan
        1
      );

      if (!costCheck.canAfford) {
        console.log(`❌ Profile owner ${profileOwnerId} cannot afford scan: ${costCheck.reason}`);
        return {
          success: false,
          error: 'BUDGET_EXCEEDED',
          reason: costCheck.reason,
          remainingBudget: costCheck.remainingBudget
        };
      }

      // 2. Generate unique token ID for nonce tracking
      const tokenId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 3. Create JWT payload
      const payload = {
        tokenId,
        profileOwnerId,
        profileOwnerName,
        purpose: 'public_scan',
        issued: Date.now(),
        expires: Date.now() + (10 * 60 * 1000), // 10 minutes expiry
        version: '1.0'
      };

      // 4. Sign the JWT
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
        expiresIn: '10m'
      });

      // 5. Store token metadata for nonce checking
      await adminDb.collection('ScanTokens').doc(tokenId).set({
        profileOwnerId,
        profileOwnerName,
        purpose: 'public_scan',
        issued: new Date().toISOString(),
        expires: new Date(payload.expires).toISOString(),
        used: false,
        createdAt: new Date().toISOString()
      });

      console.log(`✅ Scan token generated successfully: ${tokenId}`);

      return {
        success: true,
        token,
        tokenId,
        expiresAt: new Date(payload.expires).toISOString(),
        canAfford: true
      };

    } catch (error) {
      console.error('❌ Error generating scan token:', error);
      return {
        success: false,
        error: 'TOKEN_GENERATION_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Verify and validate a public scan token
   */
  static async verifyPublicScanToken(token) {
    try {
      console.log('🔍 Verifying scan token...');

      // 1. Verify JWT signature and expiry
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

      // 2. Check token purpose
      if (decoded.purpose !== 'public_scan') {
        console.log('❌ Invalid token purpose:', decoded.purpose);
        return null;
      }

      // 3. Check if token has expired (double check)
      if (Date.now() > decoded.expires) {
        console.log('❌ Token has expired');
        return null;
      }

      // 4. Check nonce - ensure token hasn't been used
      const tokenDoc = await adminDb.collection('ScanTokens').doc(decoded.tokenId).get();

      if (!tokenDoc.exists) {
        console.log('❌ Token not found in database');
        return null;
      }

      const tokenData = tokenDoc.data();
      if (tokenData.used) {
        console.log('❌ Token has already been used');
        return null;
      }

      console.log('✅ Token verified successfully');

      return {
        profileOwnerId: decoded.profileOwnerId,
        profileOwnerName: decoded.profileOwnerName,
        tokenId: decoded.tokenId,
        issued: decoded.issued,
        expires: decoded.expires
      };

    } catch (error) {
      console.error('❌ Token verification failed:', error);
      return null;
    }
  }

  /**
   * Mark a token as used to prevent replay attacks
   */
  static async markTokenAsUsed(tokenId) {
    try {
      await adminDb.collection('ScanTokens').doc(tokenId).update({
        used: true,
        usedAt: new Date().toISOString()
      });
      console.log(`✅ Token marked as used: ${tokenId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to mark token as used:', error);
      return false;
    }
  }

  /**
   * Clean up expired tokens (call this periodically)
   */
  static async cleanupExpiredTokens() {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const expiredTokensQuery = adminDb
        .collection('ScanTokens')
        .where('expires', '<', oneDayAgo.toISOString())
        .limit(100); // Process in batches

      const expiredTokensSnapshot = await expiredTokensQuery.get();

      if (expiredTokensSnapshot.empty) {
        return 0;
      }

      const batch = adminDb.batch();
      expiredTokensSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.log(`🧹 Cleaned up ${expiredTokensSnapshot.size} expired scan tokens`);
      return expiredTokensSnapshot.size;

    } catch (error) {
      console.error('❌ Error cleaning up expired tokens:', error);
      return 0;
    }
  }

  /**
   * Get token usage statistics for a profile owner
   */
  static async getTokenUsageStats(profileOwnerId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const tokensQuery = await adminDb
        .collection('ScanTokens')
        .where('profileOwnerId', '==', profileOwnerId)
        .where('issued', '>=', startDate.toISOString())
        .get();

      const tokens = tokensQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const stats = {
        totalGenerated: tokens.length,
        totalUsed: tokens.filter(t => t.used).length,
        totalUnused: tokens.filter(t => !t.used).length,
        usageRate: tokens.length > 0 ? (tokens.filter(t => t.used).length / tokens.length) * 100 : 0,
        recentTokens: tokens
          .sort((a, b) => new Date(b.issued) - new Date(a.issued))
          .slice(0, 10)
      };

      return stats;

    } catch (error) {
      console.error('❌ Error getting token usage stats:', error);
      return {
        totalGenerated: 0,
        totalUsed: 0,
        totalUnused: 0,
        usageRate: 0,
        recentTokens: []
      };
    }
  }

  /**
   * Check if profile owner has scanning enabled and budget available
   */
  static async checkScanAvailability(profileOwnerId) {
    try {
      // 1. Check if user exists and has scanning enabled
      const userDoc = await adminDb.collection('users').doc(profileOwnerId).get();

      if (!userDoc.exists) {
        return {
          available: false,
          reason: 'PROFILE_NOT_FOUND'
        };
      }

      const userData = userDoc.data();

      // Check if business card scanning is enabled (default to true for Pro+ users)
      const scanningEnabled = userData.businessCardScanningEnabled !== false;
      const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';
      const isEligibleTier = ['pro', 'premium', 'business', 'enterprise'].includes(subscriptionLevel);

      if (!scanningEnabled || !isEligibleTier) {
        return {
          available: false,
          reason: 'FEATURE_NOT_AVAILABLE',
          subscriptionLevel
        };
      }

      // 2. Check budget availability
      const costCheck = await CostTrackingService.canAffordOperation(
        profileOwnerId,
        0.002, // Estimated scan cost
        1
      );

      if (!costCheck.canAfford) {
        return {
          available: false,
          reason: costCheck.reason,
          remainingBudget: costCheck.remainingBudget
        };
      }

      return {
        available: true,
        subscriptionLevel,
        remainingBudget: costCheck.remainingBudget
      };

    } catch (error) {
      console.error('❌ Error checking scan availability:', error);
      return {
        available: false,
        reason: 'CHECK_FAILED',
        error: error.message
      };
    }
  }
}