// lib/services/serviceEnterprise/client/teamAuditService.js

import { auth } from '@/important/firebase';

/**
 * ✅ Log team activity for audit trail
 * This function sends audit events to the backend
 */
export async function logTeamActivity(action, details) {
  try {
    console.log('📝 Logging team activity:', { action, details });

    const user = auth.currentUser;
    if (!user) {
      console.warn('⚠️ No authenticated user, skipping audit log');
      return;
    }

    const token = await user.getIdToken();
    
    // Prepare audit log data
    const auditData = {
      action,
      details: {
        ...details,
        userAgent: navigator.userAgent,
        ipAddress: null, // Will be set by server
        timestamp: new Date().toISOString()
      }
    };

    // Send to backend audit API
    const response = await fetch('/api/enterprise/audit/log', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(auditData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to log audit event');
    }

    console.log('✅ Audit event logged successfully');
    
  } catch (error) {
    console.error('❌ Failed to log audit event:', error);
    // Don't throw - audit logging shouldn't break the main flow
  }
}

/**
 * ✅ Get team audit logs (for the audit modal)
 */
export async function getTeamAuditLogs(teamId, options = {}) {
  try {
    console.log('📋 Fetching team audit logs:', teamId);

    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();
    
    const queryParams = new URLSearchParams({
      teamId,
      filter: options.filter || 'all',
      sortBy: options.sortBy || 'newest',
      page: (options.page || 1).toString(),
      limit: (options.limit || 20).toString()
    });

    const response = await fetch(`/api/enterprise/teams/${teamId}/audit-logs?${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch audit logs');
    }

    const data = await response.json();
    console.log('✅ Audit logs fetched successfully');
    
    return data;
    
  } catch (error) {
    console.error('❌ Failed to fetch audit logs:', error);
    throw error;
  }
}

/**
 * ✅ Export audit logs (for organization owners)
 */
export async function exportTeamAuditLogs(teamId) {
  try {
    console.log('📤 Exporting team audit logs:', teamId);

    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();

    const response = await fetch(`/api/enterprise/teams/${teamId}/audit-logs/export`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to export audit logs');
    }

    // Handle file download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `team-${teamId}-audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    console.log('✅ Audit logs exported successfully');
    
  } catch (error) {
    console.error('❌ Failed to export audit logs:', error);
    throw error;
  }
}