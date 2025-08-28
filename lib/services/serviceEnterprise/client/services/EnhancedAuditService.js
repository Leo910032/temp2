"use client"
import { BaseService } from '../abstractions/BaseService';
import { EnterpriseApiClient } from '../core/apiClient';

export class EnhancedAuditService extends BaseService {
  constructor() {
    super('AuditService');
  }

  /**
   * Get paginated audit logs for a team.
   * @param {string} teamId The ID of the team.
   * @param {object} options Filter, sort, and pagination options.
   * @returns {Promise<object>} The audit logs data.
   */
  async getLogs(teamId, options = {}) {
    this.validateParams({ teamId }, ['teamId']);
    
    const queryParams = new URLSearchParams({
      filter: options.filter || 'all',
      sortBy: options.sortBy || 'newest',
      page: (options.page || 1).toString(),
      limit: (options.limit || 20).toString()
    });

    const endpoint = `/api/enterprise/teams/${teamId}/audit-logs?${queryParams}`;
    
    // We don't cache audit logs to ensure they are always fresh.
    return EnterpriseApiClient.get(endpoint);
  }

  /**
   * Export audit logs for a team as a file blob.
   * @param {string} teamId The ID of the team.
   * @returns {Promise<Blob>} The file blob to be downloaded.
   */
  async exportLogs(teamId) {
    this.validateParams({ teamId }, ['teamId']);
    const endpoint = `/api/enterprise/teams/${teamId}/audit-logs/export`;
    
    // We will update the ApiClient to handle non-JSON responses like this.
    return EnterpriseApiClient.get(endpoint, { responseType: 'blob' });
  }
}