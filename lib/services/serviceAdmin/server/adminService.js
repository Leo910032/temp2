// lib/services/serviceAdmin/server/adminService.js
// Server-side service for admin operations
// Follows the same pattern as businessCardService.js

import { adminDb } from '@/lib/firebaseAdmin';
import {
  ADMIN_SANITIZATION_RULES,
  ADMIN_ACTIVITIES,
  ADMIN_ROLES,
  getPermissionsForRole
} from '../constants/adminConstants';

/**
 * Admin Service - Server-side operations for admin functionality
 *
 * Architecture:
 * - Handles all database operations
 * - Processes and sanitizes data
 * - Implements business logic
 * - No direct HTTP handling (that's in API routes)
 */
export class AdminService {

  /**
   * Server-side admin authorization check
   * @param {string} email - User's email address
   * @returns {boolean} - Whether the user is an admin (any role)
   */
  static isServerAdmin(email) {
    if (!email) return false;

    const normalizedEmail = email.toLowerCase().trim();

    // Check full admin list
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    const isFullAdmin = adminEmails
      .map(e => e.toLowerCase().trim())
      .includes(normalizedEmail);

    if (isFullAdmin) return true;

    // Check view-only admin list
    const viewOnlyEmails = process.env.ADMIN_EMAILS_VIEW_ONLY?.split(',') || [];
    const isViewOnly = viewOnlyEmails
      .map(e => e.toLowerCase().trim())
      .includes(normalizedEmail);

    return isViewOnly;
  }

  /**
   * Get admin role for a user
   * @param {string} email - User's email address
   * @returns {string|null} - Admin role or null if not admin
   */
  static getAdminRole(email) {
    if (!email) return null;

    const normalizedEmail = email.toLowerCase().trim();

    // Check full admin list first
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    const isFullAdmin = adminEmails
      .map(e => e.toLowerCase().trim())
      .includes(normalizedEmail);

    if (isFullAdmin) return ADMIN_ROLES.FULL_ADMIN;

    // Check view-only admin list
    const viewOnlyEmails = process.env.ADMIN_EMAILS_VIEW_ONLY?.split(',') || [];
    const isViewOnly = viewOnlyEmails
      .map(e => e.toLowerCase().trim())
      .includes(normalizedEmail);

    if (isViewOnly) return ADMIN_ROLES.VIEW_ONLY;

    return null;
  }

  /**
   * Get admin permissions for a user
   * @param {string} email - User's email address
   * @returns {Object} - Permissions object
   */
  static getAdminPermissions(email) {
    const role = this.getAdminRole(email);
    if (!role) return {};
    return getPermissionsForRole(role);
  }

  /**
   * Check if user can perform actions (not view-only)
   * @param {string} email - User's email address
   * @returns {boolean} - Whether the user can perform actions
   */
  static canPerformActions(email) {
    const role = this.getAdminRole(email);
    return role === ADMIN_ROLES.FULL_ADMIN;
  }

  /**
   * Fetch all users with analytics data
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Users list with stats
   */
  static async getAllUsers(params = {}) {
    const startTime = Date.now();
    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║  ADMIN SERVICE - GET ALL USERS                                 ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

    try {
      // Fetch users and analytics in parallel
      console.log('[AdminService] 📊 Fetching users and analytics data...');

      const [usersSnapshot, analyticsSnapshot] = await Promise.all([
        adminDb.collection('users').get(),
        adminDb.collection('Analytics').get()
      ]);

      console.log(`[AdminService] 🔍 DEBUG: usersSnapshot.empty=${usersSnapshot.empty}, usersSnapshot.size=${usersSnapshot.size}`);
      console.log(`[AdminService] 🔍 DEBUG: analyticsSnapshot.size=${analyticsSnapshot.size}`);

      if (usersSnapshot.empty) {
        console.log('[AdminService] ⚠️ WARNING: AccountData collection is empty!');
        return {
          users: [],
          stats: this._getEmptyStats(),
          total: 0,
          message: 'No users found',
          timestamp: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime
        };
      }

      // Create analytics lookup map
      const analyticsMap = new Map();
      analyticsSnapshot.docs.forEach(doc => {
        analyticsMap.set(doc.id, doc.data());
      });

      console.log(`[AdminService] 📊 Found ${usersSnapshot.size} users and ${analyticsSnapshot.size} analytics documents`);

      // Process and sanitize user data
      const users = [];
      const errors = [];

      console.log(`[AdminService] 🔍 DEBUG: Starting to process ${usersSnapshot.size} user documents...`);

      usersSnapshot.forEach(doc => {
        try {
          const userData = doc.data();
          console.log(`[AdminService] 🔍 DEBUG: Processing user doc.id=${doc.id}, has username=${!!userData?.username}`);
          const analyticsData = analyticsMap.get(doc.id);
          const sanitizedUser = this._sanitizeUserData(userData, doc.id, analyticsData);
          users.push(sanitizedUser);
          console.log(`[AdminService] 🔍 DEBUG: Successfully processed user ${doc.id}`);
        } catch (error) {
          console.error(`[AdminService] ❌ Error processing user document ${doc.id}:`, error);
          errors.push(`Failed to process user ${doc.id}`);
        }
      });

      console.log(`[AdminService] 🔍 DEBUG: Finished processing. users.length=${users.length}, errors.length=${errors.length}`);

      // Sort users (most engaged first, then by creation date)
      users.sort((a, b) => {
        const engagementDiff = b.analytics.totalEngagement - a.analytics.totalEngagement;
        if (engagementDiff !== 0) return engagementDiff;

        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      // Calculate statistics
      const stats = this._calculateStats(users);
      const processingTime = Date.now() - startTime;

      console.log(`[AdminService] ✅ Processing complete - ${users.length} users (${processingTime}ms)`);

      const result = {
        users,
        stats,
        total: users.length,
        timestamp: new Date().toISOString(),
        processingTimeMs: processingTime
      };

      if (errors.length > 0) {
        result.warnings = errors;
      }

      return result;

    } catch (error) {
      console.error('[AdminService] ❌ Error fetching users:', error);
      throw error;
    }
  }

  /**
   * Fetch detailed information for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Detailed user data
   */
  static async getUserDetail(userId) {
    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║  ADMIN SERVICE - GET USER DETAIL                               ║`);
    console.log(`║  User ID: ${userId.slice(-20).padEnd(48)} ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

    try {
      // Fetch user data, analytics, and contacts in parallel
      console.log('[AdminService] 📊 Fetching user detail data...');

      const [userDoc, analyticsDoc, contactsSnapshot] = await Promise.all([
        adminDb.collection('users').doc(userId).get(),
        adminDb.collection('Analytics').doc(userId).get(),
        adminDb.collection('Contacts').where('userId', '==', userId).get()
      ]);

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const analyticsData = analyticsDoc.exists ? analyticsDoc.data() : null;

      // Process contacts
      const contacts = [];
      contactsSnapshot.forEach(doc => {
        contacts.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log(`[AdminService] 📊 Found ${contacts.length} contacts for user ${userId}`);

      // Sanitize and format user data
      const sanitizedUser = this._sanitizeUserDetailData(userData, userId, analyticsData, contacts);

      console.log(`[AdminService] ✅ User detail fetched successfully`);

      return sanitizedUser;

    } catch (error) {
      console.error('[AdminService] ❌ Error fetching user detail:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Sanitize user data for admin view (list)
   * @private
   */
  static _sanitizeUserData(userData, docId, analyticsData = null) {
    const analytics = this._processAnalyticsData(analyticsData);

    return {
      id: docId,
      username: userData.username || 'N/A',
      displayName: userData.profile?.displayName || userData.displayName || 'N/A',
      email: userData.email || 'N/A',
      selectedTheme: userData.appearance?.selectedTheme || userData.selectedTheme || 'N/A',
      linksCount: userData.links?.length || 0,
      socialsCount: userData.socials?.length || 0,
      createdAt: userData.createdAt?.toDate?.()?.toISOString?.() || null,
      profilePhoto: userData.profile?.avatarUrl || userData.profilePhoto || null,
      sensitiveStatus: userData.profile?.sensitiveStatus || userData.sensitiveStatus || false,
      supportBannerStatus: userData.supportBannerStatus || false,
      lastLogin: userData.lastLoginAt?.toDate?.()?.toISOString?.() || userData.lastLogin?.toDate?.()?.toISOString?.() || null,
      emailVerified: userData.emailVerified || false,
      accountType: userData.accountType || 'base',
      analytics: {
        totalViews: analytics.totalViews,
        totalClicks: analytics.totalClicks,
        todayViews: analytics.todayViews,
        todayClicks: analytics.todayClicks,
        topTrafficSource: analytics.topTrafficSource,
        linkCount: analytics.linkCount,
        trafficSourceCount: analytics.trafficSourceCount,
        hasAnalytics: analytics.hasAnalytics,
        totalEngagement: analytics.totalViews + analytics.totalClicks
      }
    };
  }

  /**
   * Sanitize user data for admin view (detail)
   * @private
   */
  static _sanitizeUserDetailData(userData, docId, analyticsData = null, contacts = []) {
    const analytics = this._processAnalyticsData(analyticsData);

    return {
      id: docId,
      username: userData.username || 'N/A',
      displayName: userData.profile?.displayName || userData.displayName || 'N/A',
      email: userData.email || 'N/A',
      selectedTheme: userData.appearance?.selectedTheme || userData.selectedTheme || 'N/A',
      links: userData.links || [],
      socials: userData.socials || [],
      createdAt: userData.createdAt?.toDate?.()?.toISOString?.() || null,
      profilePhoto: userData.profile?.avatarUrl || userData.profilePhoto || null,
      sensitiveStatus: userData.profile?.sensitiveStatus || userData.sensitiveStatus || false,
      supportBannerStatus: userData.supportBannerStatus || false,
      lastLogin: userData.lastLoginAt?.toDate?.()?.toISOString?.() || userData.lastLogin?.toDate?.()?.toISOString?.() || null,
      emailVerified: userData.emailVerified || false,
      accountType: userData.accountType || 'base',
      contacts: contacts,
      contactsCount: contacts.length,
      analytics: {
        totalViews: analytics.totalViews,
        totalClicks: analytics.totalClicks,
        todayViews: analytics.todayViews,
        todayClicks: analytics.todayClicks,
        topTrafficSource: analytics.topTrafficSource,
        linkCount: analytics.linkCount,
        trafficSourceCount: analytics.trafficSourceCount,
        hasAnalytics: analytics.hasAnalytics,
        totalEngagement: analytics.totalViews + analytics.totalClicks
      }
    };
  }

  /**
   * Process analytics data from Firestore
   * @private
   */
  static _processAnalyticsData(analyticsData) {
    if (!analyticsData) {
      return {
        totalViews: 0,
        totalClicks: 0,
        todayViews: 0,
        todayClicks: 0,
        topTrafficSource: null,
        linkCount: 0,
        hasAnalytics: false
      };
    }

    const today = new Date().toISOString().split('T')[0];

    // Extract daily data
    const dailyViews = {};
    const dailyClicks = {};
    const linkClicks = {};
    const trafficSources = {};

    // Process all fields in the analytics document
    Object.keys(analyticsData).forEach(key => {
      if (key.startsWith('dailyViews.')) {
        const date = key.replace('dailyViews.', '');
        dailyViews[date] = analyticsData[key];
      } else if (key.startsWith('dailyClicks.')) {
        const date = key.replace('dailyClicks.', '');
        dailyClicks[date] = analyticsData[key];
      } else if (key.startsWith('linkClicks.')) {
        const parts = key.split('.');
        if (parts.length >= 3) {
          const linkId = parts[1];
          linkClicks[linkId] = true;
        }
      } else if (key.startsWith('trafficSources.')) {
        const parts = key.split('.');
        if (parts.length >= 3) {
          const source = parts[1];
          const property = parts[2];

          if (!trafficSources[source]) {
            trafficSources[source] = {};
          }
          trafficSources[source][property] = analyticsData[key];
        }
      }
    });

    // Find top traffic source
    let topTrafficSource = null;
    let maxEngagement = 0;

    Object.entries(trafficSources).forEach(([source, data]) => {
      const engagement = (data.views || 0) + (data.clicks || 0);
      if (engagement > maxEngagement) {
        maxEngagement = engagement;
        topTrafficSource = {
          name: source,
          views: data.views || 0,
          clicks: data.clicks || 0,
          medium: data.medium || 'unknown'
        };
      }
    });

    return {
      totalViews: analyticsData.totalViews || 0,
      totalClicks: analyticsData.totalClicks || 0,
      todayViews: dailyViews[today] || 0,
      todayClicks: dailyClicks[today] || 0,
      topTrafficSource,
      linkCount: Object.keys(linkClicks).length,
      trafficSourceCount: Object.keys(trafficSources).length,
      hasAnalytics: true
    };
  }

  /**
   * Calculate statistics for all users
   * @private
   */
  static _calculateStats(users) {
    return {
      total: users.length,
      withLinks: users.filter(u => u.linksCount > 0).length,
      withSocials: users.filter(u => u.socialsCount > 0).length,
      sensitiveContent: users.filter(u => u.sensitiveStatus).length,
      supportBanners: users.filter(u => u.supportBannerStatus).length,
      emailVerified: users.filter(u => u.emailVerified).length,
      withAnalytics: users.filter(u => u.analytics.hasAnalytics).length,
      totalViews: users.reduce((sum, u) => sum + u.analytics.totalViews, 0),
      totalClicks: users.reduce((sum, u) => sum + u.analytics.totalClicks, 0),
      activeToday: users.filter(u => u.analytics.todayViews > 0 || u.analytics.todayClicks > 0).length,
      accountTypes: {
        base: users.filter(u => u.accountType === 'base').length,
        pro: users.filter(u => u.accountType === 'pro').length,
        premium: users.filter(u => u.accountType === 'premium').length,
        business: users.filter(u => u.accountType === 'business').length
      }
    };
  }

  /**
   * Get empty stats object
   * @private
   */
  static _getEmptyStats() {
    return {
      total: 0,
      withLinks: 0,
      withSocials: 0,
      sensitiveContent: 0,
      supportBanners: 0,
      emailVerified: 0,
      withAnalytics: 0,
      totalViews: 0,
      totalClicks: 0,
      activeToday: 0,
      accountTypes: {
        base: 0,
        pro: 0,
        premium: 0,
        business: 0
      }
    };
  }

  // ============================================================================
  // FUTURE METHODS (COMMENTED OUT - To be implemented step by step)
  // ============================================================================

  /**
   * Update user data
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user data
   */
  // static async updateUser(userId, updates) {
  //   console.log(`[AdminService] 🔄 Updating user ${userId}:`, updates);
  //
  //   try {
  //     await adminDb.collection('AccountData').doc(userId).update(updates);
  //
  //     // Fetch updated user data
  //     const updatedUser = await this.getUserDetail(userId);
  //
  //     console.log(`[AdminService] ✅ User ${userId} updated successfully`);
  //     return updatedUser;
  //   } catch (error) {
  //     console.error('[AdminService] ❌ Error updating user:', error);
  //     throw error;
  //   }
  // }

  /**
   * Suspend user account
   * @param {string} userId - User ID
   * @param {string} reason - Suspension reason
   * @returns {Promise<Object>} Result
   */
  // static async suspendUser(userId, reason) {
  //   console.log(`[AdminService] ⚠️ Suspending user ${userId}:`, reason);
  //
  //   try {
  //     await adminDb.collection('AccountData').doc(userId).update({
  //       suspended: true,
  //       suspendedAt: FieldValue.serverTimestamp(),
  //       suspensionReason: reason
  //     });
  //
  //     console.log(`[AdminService] ✅ User ${userId} suspended successfully`);
  //     return { success: true, userId, reason };
  //   } catch (error) {
  //     console.error('[AdminService] ❌ Error suspending user:', error);
  //     throw error;
  //   }
  // }

  /**
   * Delete user account
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result
   */
  // static async deleteUser(userId) {
  //   console.log(`[AdminService] 🗑️ Deleting user ${userId}`);
  //
  //   try {
  //     // Delete user data
  //     await adminDb.collection('AccountData').doc(userId).delete();
  //
  //     // Delete user's contacts
  //     const contactsSnapshot = await adminDb.collection('Contacts')
  //       .where('userId', '==', userId)
  //       .get();
  //
  //     const batch = adminDb.batch();
  //     contactsSnapshot.forEach(doc => {
  //       batch.delete(doc.ref);
  //     });
  //     await batch.commit();
  //
  //     console.log(`[AdminService] ✅ User ${userId} deleted successfully`);
  //     return { success: true, userId };
  //   } catch (error) {
  //     console.error('[AdminService] ❌ Error deleting user:', error);
  //     throw error;
  //   }
  // }
}
