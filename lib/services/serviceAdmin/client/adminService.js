// lib/services/serviceAdmin/client/adminService.js
// Client-side service for admin operations
// Follows the same pattern as RulesGroupService.js

"use client"
import { ContactApiClient } from '@/lib/services/core/ApiClient';
import { ADMIN_FEATURES, ADMIN_ACTIVITIES } from '../constants/adminConstants';

/**
 * Admin Service - Client-side operations for admin dashboard
 *
 * Architecture:
 * - Handles all API communication for admin operations
 * - Uses ContactApiClient for authenticated requests
 * - Provides clean interface for UI components
 * - Includes error handling and logging
 */
export class AdminService {

  /**
   * Fetch all users with analytics data
   * @returns {Promise<Object>} Users list with stats
   */
  static async fetchUsers() {
    console.log("📋 [AdminService] Fetching users list...");

    try {
      const result = await ContactApiClient.get(
        '/api/admin/users',
        { timeout: 30000 } // 30 second timeout
      );

      console.log("✅ [AdminService] Users fetched successfully:", {
        total: result.total,
        stats: result.stats
      });

      return result;
    } catch (error) {
      console.error("❌ [AdminService] Failed to fetch users:", error);
      throw error;
    }
  }

  /**
   * Fetch detailed information for a specific user
   * @param {string} userId - User ID to fetch
   * @returns {Promise<Object>} Detailed user data
   */
  static async fetchUserDetail(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`📋 [AdminService] Fetching user detail for: ${userId}`);

    try {
      const result = await ContactApiClient.get(
        `/api/admin/user/${userId}`,
        { timeout: 30000 }
      );

      console.log("✅ [AdminService] User detail fetched successfully:", {
        userId,
        username: result.username
      });

      return result;
    } catch (error) {
      console.error("❌ [AdminService] Failed to fetch user detail:", error);
      throw error;
    }
  }

  // ============================================================================
  // ANALYTICS METHODS MOVED TO adminServiceAnalytics.js
  // ============================================================================
  // Analytics functionality has been separated into its own service file
  // See: lib/services/serviceAdmin/client/adminServiceAnalytics.js

  // ============================================================================
  // FUTURE METHODS (COMMENTED OUT - To be implemented step by step)
  // ============================================================================

  /**
   * Update user permissions or subscription
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user data
   */
  // static async updateUser(userId, updates) {
  //   console.log(`🔄 [AdminService] Updating user ${userId}:`, updates);
  //
  //   try {
  //     const result = await ContactApiClient.post(
  //       '/api/admin/users',
  //       {
  //         action: 'updateUser',
  //         userId,
  //         data: updates
  //       },
  //       { timeout: 30000 }
  //     );
  //
  //     console.log("✅ [AdminService] User updated successfully");
  //     return result;
  //   } catch (error) {
  //     console.error("❌ [AdminService] Failed to update user:", error);
  //     throw error;
  //   }
  // }

  /**
   * Suspend a user account
   * @param {string} userId - User ID to suspend
   * @param {string} reason - Reason for suspension
   * @returns {Promise<Object>} Result
   */
  // static async suspendUser(userId, reason) {
  //   console.log(`⚠️ [AdminService] Suspending user ${userId}:`, reason);
  //
  //   try {
  //     const result = await ContactApiClient.post(
  //       '/api/admin/users',
  //       {
  //         action: 'suspendUser',
  //         userId,
  //         data: { reason }
  //       },
  //       { timeout: 30000 }
  //     );
  //
  //     console.log("✅ [AdminService] User suspended successfully");
  //     return result;
  //   } catch (error) {
  //     console.error("❌ [AdminService] Failed to suspend user:", error);
  //     throw error;
  //   }
  // }

  /**
   * Delete a user account
   * @param {string} userId - User ID to delete
   * @returns {Promise<Object>} Result
   */
  // static async deleteUser(userId) {
  //   console.log(`🗑️ [AdminService] Deleting user ${userId}`);
  //
  //   try {
  //     const result = await ContactApiClient.delete(
  //       `/api/admin/user/${userId}`,
  //       { timeout: 30000 }
  //     );
  //
  //     console.log("✅ [AdminService] User deleted successfully");
  //     return result;
  //   } catch (error) {
  //     console.error("❌ [AdminService] Failed to delete user:", error);
  //     throw error;
  //   }
  // }

  /**
   * Export user data
   * @param {Object} filters - Export filters
   * @returns {Promise<Blob>} Export file
   */
  // static async exportUsers(filters = {}) {
  //   console.log("📥 [AdminService] Exporting users with filters:", filters);
  //
  //   try {
  //     const result = await ContactApiClient.post(
  //       '/api/admin/export',
  //       { filters },
  //       {
  //         timeout: 60000,
  //         responseType: 'blob'
  //       }
  //     );
  //
  //     console.log("✅ [AdminService] Users exported successfully");
  //     return result;
  //   } catch (error) {
  //     console.error("❌ [AdminService] Failed to export users:", error);
  //     throw error;
  //   }
  // }

  /**
   * Fetch system logs
   * @param {Object} filters - Log filters
   * @returns {Promise<Object>} System logs
   */
  // static async fetchSystemLogs(filters = {}) {
  //   console.log("📜 [AdminService] Fetching system logs with filters:", filters);
  //
  //   try {
  //     const result = await ContactApiClient.post(
  //       '/api/admin/logs',
  //       { filters },
  //       { timeout: 30000 }
  //     );
  //
  //     console.log("✅ [AdminService] System logs fetched successfully");
  //     return result;
  //   } catch (error) {
  //     console.error("❌ [AdminService] Failed to fetch system logs:", error);
  //     throw error;
  //   }
  // }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if current user has admin access (client-side hint only)
   * Note: Real authorization happens server-side
   */
  static async checkAdminAccess() {
    try {
      // Try to fetch users - if it succeeds, user is admin
      await this.fetchUsers();
      return true;
    } catch (error) {
      if (error.status === 403 || error.status === 401) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get admin feature availability
   * @returns {Object} Available features
   */
  static getAvailableFeatures() {
    return {
      viewUsers: ADMIN_FEATURES.VIEW_USERS,
      viewAnalytics: ADMIN_FEATURES.VIEW_ANALYTICS,
      viewUserDetails: ADMIN_FEATURES.VIEW_USER_DETAILS

      // Future features (commented)
      // editUser: ADMIN_FEATURES.EDIT_USER,
      // suspendUser: ADMIN_FEATURES.SUSPEND_USER,
      // deleteUser: ADMIN_FEATURES.DELETE_USER
    };
  }

  /**
   * Format user data for display
   * @param {Object} user - Raw user data
   * @returns {Object} Formatted user data
   */
  static formatUserData(user) {
    if (!user) return null;

    return {
      ...user,
      createdAtFormatted: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A',
      lastLoginFormatted: user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never',
      totalEngagement: (user.analytics?.totalViews || 0) + (user.analytics?.totalClicks || 0),
      isActive: user.analytics?.todayViews > 0 || user.analytics?.todayClicks > 0
    };
  }

  // Analytics formatting methods moved to AdminServiceAnalytics
}
