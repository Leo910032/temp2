

// lib/services/serviceContact/client/services/ContactGroupService.js
// Contact group service following enterprise pattern
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient'; // Also ensure this is imported if needed by the class

export class ContactGroupService extends BaseContactService {
  constructor() {
    super('ContactGroupService');
  }

  // ==================== GROUP MANAGEMENT OPERATIONS ====================

  /**
   * Get all contact groups
   */
  async getContactGroups() {
    return this.cachedRequest(
      'groups',
      () => ContactApiClient.get('/api/contacts/groups'),
      'groups'
    );
  }

  /**
   * Get group by ID
   */
  async getContactGroup(groupId) {
    this.validateParams({ groupId }, ['groupId']);

    return this.cachedRequest(
      'group',
      () => ContactApiClient.get(`/api/contacts/groups/${groupId}`),
      'groups',
      { groupId }
    );
  }

  /**
   * Create new contact group
   */
  async createContactGroup(groupData) {
    const validation = this.validateGroupData(groupData);
    if (!validation.isValid) {
      throw new Error(`Invalid group data: ${validation.errors.join(', ')}`);
    }

    const result = await ContactApiClient.post('/api/contacts/groups', {
      action: 'create',
      group: groupData
    });

    // Invalidate groups cache
    this.invalidateCache(['group']);

    return result;
  }

  /**
   * Update contact group
   */
  async updateContactGroup(groupId, groupData) {
    this.validateParams({ groupId }, ['groupId']);
    
    const validation = this.validateGroupData(groupData);
    if (!validation.isValid) {
      throw new Error(`Invalid group data: ${validation.errors.join(', ')}`);
    }

    const result = await ContactApiClient.put(`/api/contacts/groups/${groupId}`, {
      action: 'update',
      group: groupData
    });

    // Invalidate caches
    this.invalidateCache(['group', `group_${groupId}`]);

    return result;
  }

  /**
   * Delete contact group
   */
  async deleteContactGroup(groupId) {
    this.validateParams({ groupId }, ['groupId']);

    const result = await ContactApiClient.delete(`/api/contacts/groups/${groupId}`);

    // Invalidate caches
    this.invalidateCache(['group', `group_${groupId}`]);

    return result;
  }

  /**
   * Add contacts to group
   */
  async addContactsToGroup(groupId, contactIds) {
    this.validateParams({ groupId, contactIds }, ['groupId', 'contactIds']);

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error('Contact IDs must be a non-empty array');
    }

    const result = await ContactApiClient.post(`/api/contacts/groups/${groupId}/contacts`, {
      action: 'add',
      contactIds
    });

    // Invalidate group caches
    this.invalidateCache(['group', `group_${groupId}`]);

    return result;
  }

  /**
   * Remove contacts from group
   */
  async removeContactsFromGroup(groupId, contactIds) {
    this.validateParams({ groupId, contactIds }, ['groupId', 'contactIds']);

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error('Contact IDs must be a non-empty array');
    }

    const result = await ContactApiClient.delete(`/api/contacts/groups/${groupId}/contacts`, {
      body: { action: 'remove', contactIds }
    });

    // Invalidate group caches
    this.invalidateCache(['group', `group_${groupId}`]);

    return result;
  }

  // ==================== AUTO-GENERATION OPERATIONS ====================

  /**
   * Generate automatic groups based on contact data
   */
  async generateAutoGroups(options = {}) {
    const result = await ContactApiClient.post('/api/contacts/groups/auto-generate', {
      options: {
        groupByCompany: options.groupByCompany !== false,
        groupByLocation: options.groupByLocation !== false,
        groupByEvents: options.groupByEvents !== false,
        minGroupSize: options.minGroupSize || 2,
        maxGroups: options.maxGroups || 50,
        ...options
      }
    });

    // Invalidate groups cache after generation
    this.invalidateCache(['group']);

    return result;
  }

  /**
   * Get group analytics and insights
   */
  async getGroupAnalytics() {
    return this.cachedRequest(
      'analytics',
      () => ContactApiClient.get('/api/contacts/groups/analytics'),
      'analytics'
    );
  }

  // ==================== HELPER METHODS ====================

  /**
   * Validate group data
   */
  validateGroupData(groupData) {
    const errors = [];

    if (!groupData.name || groupData.name.trim().length === 0) {
      errors.push('Group name is required');
    }

    if (groupData.name && groupData.name.length > 100) {
      errors.push('Group name must be less than 100 characters');
    }

    if (groupData.description && groupData.description.length > 500) {
      errors.push('Group description must be less than 500 characters');
    }

    if (!groupData.contactIds || !Array.isArray(groupData.contactIds)) {
      errors.push('Contact IDs must be provided as an array');
    }

    if (groupData.contactIds && groupData.contactIds.length === 0) {
      errors.push('Group must contain at least one contact');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sort groups by various criteria
   */
  sortGroups(groups, sortBy = 'name', direction = 'asc') {
    const sortedGroups = [...groups].sort((a, b) => {
      let valueA, valueB;

      switch (sortBy) {
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'size':
          valueA = a.contactIds.length;
          valueB = b.contactIds.length;
          break;
        case 'created':
          valueA = new Date(a.createdAt);
          valueB = new Date(b.createdAt);
          break;
        case 'type':
          valueA = a.type;
          valueB = b.type;
          break;
        default:
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
      }

      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sortedGroups;
  }

  /**
   * Filter groups by criteria
   */
  filterGroups(groups, filters = {}) {
    let filteredGroups = [...groups];

    if (filters.type) {
      filteredGroups = filteredGroups.filter(group => group.type === filters.type);
    }

    if (filters.minSize !== undefined) {
      filteredGroups = filteredGroups.filter(group => group.contactIds.length >= filters.minSize);
    }

    if (filters.maxSize !== undefined) {
      filteredGroups = filteredGroups.filter(group => group.contactIds.length <= filters.maxSize);
    }

    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filteredGroups = filteredGroups.filter(group => 
        group.name.toLowerCase().includes(searchTerm) ||
        (group.description && group.description.toLowerCase().includes(searchTerm))
      );
    }

    return filteredGroups;
  }
}
