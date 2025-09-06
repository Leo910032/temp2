//UPDATED
// lib/services/serviceContact/client/services/ContactGroupService.js
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';

export class ContactGroupService extends BaseContactService {
   constructor() {
    super('ContactGroupService');
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }


  /**
   * Get all contact groups for the user
   */

  /**
   * ENHANCED: Clear all caches
   */
  clearCache() {
    console.log('🗑️ [Client Service] Clearing all contact group caches');
    this.cache.clear();
    this.invalidateCache(['groups', 'group', 'contacts', 'stats']);
  }

  /**
   * ENHANCED: Force refresh groups data
   */
  async forceRefreshGroups(reason = 'manual') {
    console.log(`🔄 [Client Service] Force refreshing groups - reason: ${reason}`);
    return this.getContactGroups({ 
      force: true, 
      clearCache: true, 
      reason: `force_refresh_${reason}` 
    });
  }
getCacheInfo() {
    return {
      cacheSize: this.cache.size,
      cacheKeys: Array.from(this.cache.keys()),
      lastFetch: this.cache.has('contact_groups') ? 
        new Date(this.cache.get('contact_groups').timestamp).toISOString() : 
        'never'
    };
  }
  /**
   * ENHANCED: Get contact groups with cache invalidation support
   */
  async getContactGroups(options = {}) {
    const { force = false, clearCache = false, reason = 'unknown' } = options;
    
    console.log(`📁 [Client Service] Getting contact groups:`, { force, clearCache, reason });

    // Clear cache if requested
    if (clearCache || force) {
      console.log('🗑️ [Client Service] Clearing groups cache');
      this.cache.clear();
      this.invalidateCache(['groups', 'group']);
    }

    const cacheKey = 'contact_groups';
    
    // Check cache unless force refresh
    if (!force && !clearCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      const isExpired = Date.now() - cached.timestamp > this.cacheTimeout;
      
      if (!isExpired) {
        console.log('📁 [Client Service] Returning cached groups');
        return cached.data;
      }
    }

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (force) params.append('force', 'true');
      if (clearCache) params.append('clearCache', 'true');
      params.append('reason', reason);

      const queryString = params.toString();
      const url = `/api/user/contacts/groups${queryString ? `?${queryString}` : ''}`;

      console.log(`📁 [Client Service] Fetching from API: ${url}`);

      const result = await ContactApiClient.get(url, {
        headers: {
          'Cache-Control': force || clearCache ? 'no-cache' : 'max-age=30'
        }
      });

      // Validate response
      if (!result || !Array.isArray(result.groups)) {
        console.warn('⚠️ [Client Service] Invalid groups response:', result);
        return { groups: [], total: 0 };
      }

      console.log(`✅ [Client Service] Fetched ${result.groups.length} groups from API`);

      // Cache the result (unless it was a forced fetch for debugging)
      if (!force || reason !== 'debug') {
        this.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      return result;

    } catch (error) {
      console.error('❌ [Client Service] Failed to get contact groups:', error);
      
      // Try to return cached data if available during error
      if (this.cache.has(cacheKey)) {
        console.log('📁 [Client Service] Returning stale cache due to error');
        return this.cache.get(cacheKey).data;
      }
      
      throw this.handleError(error, 'getContactGroups');
    }
  }
    async exportContactGroups(format = 'json') {
        const params = new URLSearchParams();
        params.append('format', format);

        const url = `/api/user/contacts/groups/export?${params.toString()}`;

        const blob = await ContactApiClient.get(url, {
            responseType: 'blob'
        });
        
        const filename = `contact-groups_${new Date().toISOString().split('T')[0]}.${format}`;

        return { data: blob, filename };
    }
  /**
   * Get a specific contact group by ID
   */
  async getContactGroup(groupId) {
    this.validateParams({ groupId }, ['groupId']);

    return this.cachedRequest(
      'group',
      () => ContactApiClient.get(`/api/user/contacts/groups/${groupId}`),
      'groups',
      { groupId }
    );
  }

  /**
   * ENHANCED: Create contact group with cache invalidation
   */
  async createContactGroup(groupData) {
    console.log('📝 [Client Service] Creating contact group:', groupData.name);

    try {
      const result = await ContactApiClient.post('/api/user/contacts/groups', {
        action: 'create',
        group: groupData
      });

      // CRITICAL: Invalidate cache after successful creation
      this.cache.clear();
      this.invalidateCache(['groups', 'group', 'contacts']);

      console.log('✅ [Client Service] Contact group created successfully');
      return result;

    } catch (error) {
      console.error('❌ [Client Service] Failed to create contact group:', error);
      throw this.handleError(error, 'createContactGroup');
    }
  }

/**
   * ENHANCED: Update contact group with cache invalidation
   */
  async updateContactGroup(groupId, updateData) {
    console.log('📝 [Client Service] Updating contact group:', groupId);

    try {
      const result = await ContactApiClient.patch(`/api/user/contacts/groups/${groupId}`, updateData);

      // Invalidate cache after successful update
      this.cache.clear();
      this.invalidateCache(['groups', 'group', 'contacts']);

      console.log('✅ [Client Service] Contact group updated successfully');
      return result;

    } catch (error) {
      console.error('❌ [Client Service] Failed to update contact group:', error);
      throw this.handleError(error, 'updateContactGroup');
    }
  }


 /**
   * ENHANCED: Delete contact group with cache invalidation
   */
  async deleteContactGroup(groupId) {
    console.log('🗑️ [Client Service] Deleting contact group:', groupId);

    try {
      const result = await ContactApiClient.delete(`/api/user/contacts/groups/${groupId}`);

      // Invalidate cache after successful deletion
      this.cache.clear();
      this.invalidateCache(['groups', 'group', 'contacts']);

      console.log('✅ [Client Service] Contact group deleted successfully');
      return result;

    } catch (error) {
      console.error('❌ [Client Service] Failed to delete contact group:', error);
      throw this.handleError(error, 'deleteContactGroup');
    }
  }


  /**
   * Generate automatic contact groups
   */
  async generateAutoGroups(options = {}) {
    const result = await ContactApiClient.post('/api/user/contacts/groups/auto-generate', {
      options
    });

    // Invalidate all group caches
    this.invalidateCache(['group']);

    return result;
  }

  /**
   * Add contacts to a group
   */
  async addContactsToGroup(groupId, contactIds) {
    this.validateParams({ groupId, contactIds }, ['groupId', 'contactIds']);

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error('Contact IDs must be a non-empty array');
    }

    // Get current group
    const groupResult = await this.getContactGroup(groupId);
    const currentContactIds = groupResult.group.contactIds || [];
    
    // Merge contact IDs (remove duplicates)
    const updatedContactIds = [...new Set([...currentContactIds, ...contactIds])];

    // Update the group
    return this.updateContactGroup(groupId, { contactIds: updatedContactIds });
  }

  /**
   * Remove contacts from a group
   */
  async removeContactsFromGroup(groupId, contactIds) {
    this.validateParams({ groupId, contactIds }, ['groupId', 'contactIds']);

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error('Contact IDs must be a non-empty array');
    }

    // Get current group
    const groupResult = await this.getContactGroup(groupId);
    const currentContactIds = groupResult.group.contactIds || [];
    
    // Remove contact IDs
    const updatedContactIds = currentContactIds.filter(id => !contactIds.includes(id));

    // Update the group
    return this.updateContactGroup(groupId, { contactIds: updatedContactIds });
  }

  /**
   * Search groups
   */
  async searchGroups(searchQuery, filters = {}) {
    return this.cachedRequest(
      'search',
      () => ContactApiClient.post('/api/user/contacts/groups/search', {
        query: searchQuery,
        filters
      }),
      'groups',
      { searchQuery, ...filters }
    );
  }

  /**
   * Get group analytics
   */
  async getGroupAnalytics() {
    return this.cachedRequest(
      'analytics',
      () => ContactApiClient.get('/api/user/contacts/groups/analytics'),
      'analytics'
    );
  }

  // ==================== HELPER METHODS ====================

  /**
   * Validate group data
   */
  validateGroupData(groupData) {
    const errors = [];

    if (!groupData.name || typeof groupData.name !== 'string' || groupData.name.trim().length === 0) {
      errors.push('Group name is required and must be a non-empty string');
    }

    if (groupData.name && groupData.name.length > 100) {
      errors.push('Group name must be less than 100 characters');
    }

    if (!groupData.contactIds || !Array.isArray(groupData.contactIds)) {
      errors.push('Contact IDs must be provided as an array');
    }

    if (groupData.contactIds && groupData.contactIds.length === 0) {
      errors.push('Group must contain at least one contact');
    }

    if (groupData.description && typeof groupData.description !== 'string') {
      errors.push('Description must be a string');
    }

    if (groupData.description && groupData.description.length > 500) {
      errors.push('Description must be less than 500 characters');
    }

   // FIXED LINE
if (groupData.type && !['custom', 'company', 'event', 'auto_company', 'auto_location', 'auto_event', 'auto_time', 'ai_generated', 'rule_company', 'rule_company_email', 'rule_time', 'rule_location', 'rule_event'].includes(groupData.type)) {
  errors.push('Invalid group type');
}

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Format group for display
   */
  formatGroupForDisplay(group) {
    return {
      ...group,
      displayName: group.name || 'Unnamed Group',
      contactCount: group.contactIds ? group.contactIds.length : 0,
      isAutoGenerated: ['auto_company', 'auto_location', 'auto_event', 'auto_time'].includes(group.type),
      typeIcon: this.getGroupTypeIcon(group.type),
      typeLabel: this.getGroupTypeLabel(group.type)
    };
  }

  /**
   * Get icon for group type
   */
  getGroupTypeIcon(type) {
    const icons = {
      custom: '👥',
      company: '🏢',
      auto_company: '🏢',
      auto_location: '📍',
      auto_event: '📅',
      auto_time: '⏰',
      event: '📅'
    };
    return icons[type] || '👥';
  }

  /**
   * Get label for group type
   */
  getGroupTypeLabel(type) {
    const labels = {
      custom: 'Custom Group',
      company: 'Company',
      auto_company: 'Auto Company',
      auto_location: 'Location-based',
      auto_event: 'Event-based',
      auto_time: 'Time-based',
      event: 'Event'
    };
    return labels[type] || 'Custom Group';
  }

  /**
   * Get group statistics
   */
  getGroupStatistics(groups) {
    const stats = {
      total: groups.length,
      byType: {},
      totalContacts: 0,
      averageGroupSize: 0,
      largestGroup: null,
      smallestGroup: null
    };

    if (groups.length === 0) return stats;

    let maxSize = 0;
    let minSize = Infinity;

    groups.forEach(group => {
      const type = group.type || 'custom';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      const contactCount = group.contactIds ? group.contactIds.length : 0;
      stats.totalContacts += contactCount;

      if (contactCount > maxSize) {
        maxSize = contactCount;
        stats.largestGroup = { name: group.name, size: contactCount };
      }

      if (contactCount < minSize) {
        minSize = contactCount;
        stats.smallestGroup = { name: group.name, size: contactCount };
      }
    });

    stats.averageGroupSize = Math.round(stats.totalContacts / groups.length);

    return stats;
  }
}