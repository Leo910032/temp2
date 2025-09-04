//UPDATED
// lib/services/serviceContact/client/services/ContactGroupService.js
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';

export class ContactGroupService extends BaseContactService {
  constructor() {
    super('ContactGroupService');
  }

  /**
   * Get all contact groups for the user
   */
  async getContactGroups() {
    return this.cachedRequest(
      'groups',
      () => ContactApiClient.get('/api/user/contacts/groups'),
      'groups'
    );
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
   * Create a new contact group
   */
  async createContactGroup(groupData) {
    const validation = this.validateGroupData(groupData);
    if (!validation.isValid) {
      throw new Error(`Invalid group data: ${validation.errors.join(', ')}`);
    }

    const result = await ContactApiClient.post('/api/user/contacts/groups', {
      action: 'create',
      group: groupData
    });

    // Invalidate groups cache
    this.invalidateCache(['group']);

    return result;
  }

  /**
   * Update an existing contact group
   */
  async updateContactGroup(groupId, updates) {
    this.validateParams({ groupId }, ['groupId']);

    const result = await ContactApiClient.patch(`/api/user/contacts/groups/${groupId}`, updates);

    // Invalidate specific group and list caches
    this.invalidateCache(['group', `group_${groupId}`]);

    return result;
  }

  /**
   * Delete a contact group
   */
  async deleteContactGroup(groupId) {
    this.validateParams({ groupId }, ['groupId']);

    const result = await ContactApiClient.delete(`/api/user/contacts/groups/${groupId}`);

    // Invalidate caches
    this.invalidateCache(['group', `group_${groupId}`]);

    return result;
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