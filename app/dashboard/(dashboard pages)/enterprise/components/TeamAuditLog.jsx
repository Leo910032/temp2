// TeamAuditLog.jsx - Fixed timestamp handling

"use client"
import React, { useState, useEffect } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from 'react-hot-toast';

export default function TeamAuditLog({ teamId, teamName, userContext, isOpen, onClose }) {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // ✅ FIXED: Timestamp parsing function
  const parseTimestamp = (timestamp) => {
    if (!timestamp) return new Date();
    
    // Handle Firestore Timestamp objects
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Handle ISO strings
    if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    
    // Handle JavaScript Date objects
    if (timestamp instanceof Date) {
      return isNaN(timestamp.getTime()) ? new Date() : timestamp;
    }
    
    // Handle timestamps as numbers (milliseconds or seconds)
    if (typeof timestamp === 'number') {
      // If it's likely in seconds (Unix timestamp), convert to milliseconds
      const date = timestamp < 10000000000 ? new Date(timestamp * 1000) : new Date(timestamp);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    
    // Fallback to current date
    console.warn('Could not parse timestamp:', timestamp);
    return new Date();
  };

  // ✅ Load audit logs
  useEffect(() => {
    if (isOpen && teamId) {
      loadAuditLogs();
    }
  }, [isOpen, teamId, filter, sortBy]);

  const loadAuditLogs = async (pageNum = 1, reset = true) => {
    try {
      setLoading(true);
      
      if (!currentUser) throw new Error('User not authenticated');
      
      const token = await currentUser.getIdToken();
      
      const queryParams = new URLSearchParams({
        teamId,
        filter,
        sortBy,
        page: pageNum.toString(),
        limit: '20'
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
        throw new Error(errorData.error || 'Failed to load audit logs');
      }

      const data = await response.json();
      
      // ✅ FIXED: Process logs with proper timestamp handling
      const processedLogs = data.logs.map(log => ({
        ...log,
        timestamp: parseTimestamp(log.timestamp || log.createdAt),
        displayTimestamp: log.timestamp || log.createdAt // Keep original for debugging
      }));
      
      if (reset) {
        setLogs(processedLogs);
      } else {
        setLogs(prev => [...prev, ...processedLogs]);
      }
      
      setHasMore(data.hasMore);
      setPage(pageNum);
      
    } catch (error) {
      console.error('Error loading audit logs:', error);
      toast.error(error.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Load more logs (pagination)
  const loadMore = () => {
    if (!loading && hasMore) {
      loadAuditLogs(page + 1, false);
    }
  };

  // ✅ Format action for display
  const formatAction = (action) => {
    const actionMap = {
      'member_added': 'Member Added',
      'member_removed': 'Member Removed',
      'role_updated': 'Role Updated',
      'invitation_sent': 'Invitation Sent',
      'invitation_revoked': 'Invitation Revoked',
      'invitation_resent': 'Invitation Resent',
      'team_created': 'Team Created',
      'team_updated': 'Team Updated',
      'team_permissions_updated': 'Permissions Updated',
      'settings_changed': 'Settings Changed'
    };
    return actionMap[action] || action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // ✅ Get action color
  const getActionColor = (action) => {
    const colorMap = {
      'member_added': 'text-green-600 bg-green-50',
      'member_removed': 'text-red-600 bg-red-50',
      'role_updated': 'text-blue-600 bg-blue-50',
      'invitation_sent': 'text-purple-600 bg-purple-50',
      'invitation_revoked': 'text-orange-600 bg-orange-50',
      'invitation_resent': 'text-indigo-600 bg-indigo-50',
      'team_created': 'text-green-600 bg-green-50',
      'team_updated': 'text-blue-600 bg-blue-50',
      'team_permissions_updated': 'text-purple-600 bg-purple-50',
      'settings_changed': 'text-yellow-600 bg-yellow-50'
    };
    return colorMap[action] || 'text-gray-600 bg-gray-50';
  };

  // ✅ FIXED: Format log details with better error handling
  const formatDetails = (log) => {
    const { action, details, targetUser, metadata } = log;
    
    try {
      switch (action) {
        case 'member_added':
          return `Added ${targetUser?.displayName || targetUser?.email || details?.targetUserName || details?.targetUserEmail || 'user'} as ${details?.role || 'member'}`;
        case 'member_removed':
          return `Removed ${targetUser?.displayName || targetUser?.email || details?.targetUserName || details?.targetUserEmail || 'user'} from team`;
        case 'role_updated':
          return `Changed ${targetUser?.displayName || targetUser?.email || details?.targetUserName || details?.targetUserEmail || 'user'}'s role from ${details?.oldRole || 'unknown'} to ${details?.newRole || 'unknown'}`;
        case 'invitation_sent':
          return `Sent invitation to ${details?.invitedEmail || details?.email || 'unknown'} for ${details?.invitedRole || details?.role || 'member'} role`;
        case 'invitation_revoked':
          return `Revoked invitation for ${details?.invitedEmail || details?.email || 'unknown'}`;
        case 'invitation_resent':
          return `Resent invitation to ${details?.invitedEmail || details?.email || 'unknown'}`;
        case 'team_permissions_updated':
          const changedRoles = details?.affectedRoles?.join(', ') || 'multiple roles';
          return `Updated permissions for ${changedRoles}`;
        case 'settings_changed':
          return `Modified team settings: ${details?.changedFields?.join(', ') || 'various fields'}`;
        default:
          return details?.description || details?.roleChangeDescription || 'Team action performed';
      }
    } catch (error) {
      console.warn('Error formatting log details:', error);
      return 'Team action performed';
    }
  };

 // ✅ Get relative time with better timestamp handling
  const getRelativeTime = (timestamp) => {
    try {
      const now = new Date();
      let logTime;
      
      // Handle different timestamp formats
      if (timestamp?.toDate) {
        // Firestore timestamp
        logTime = timestamp.toDate();
      } else if (typeof timestamp === 'string') {
        // ISO string
        logTime = new Date(timestamp);
      } else if (timestamp instanceof Date) {
        // Already a Date object
        logTime = timestamp;
      } else {
        // Fallback
        logTime = new Date(timestamp);
      }
      
      // Check if date is valid
      if (isNaN(logTime.getTime())) {
        console.warn('Invalid timestamp:', timestamp);
        return 'Unknown time';
      }
      
      const diffMs = now - logTime;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return logTime.toLocaleDateString();
    } catch (error) {
      console.error('Error parsing timestamp:', error, timestamp);
      return 'Unknown time';
    }
  };

  // ✅ Export logs function (for organization owners)
  const handleExportLogs = async () => {
    try {
      if (!currentUser) throw new Error('User not authenticated');
      
      const token = await currentUser.getIdToken();
      
      const response = await fetch(`/api/enterprise/teams/${teamId}/audit-logs/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export logs');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `team-${teamId}-audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Audit logs exported successfully');
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast.error(error.message || 'Failed to export logs');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* ==================== HEADER ==================== */}
        <header className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Team Activity Log</h2>
              <p className="text-gray-600 mt-1">
                Activity history for <span className="font-medium">{teamName}</span>
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* ==================== FILTERS ==================== */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1"
              >
                <option value="all">All Actions</option>
                <option value="members">Member Changes</option>
                <option value="invitations">Invitations</option>
                <option value="permissions">Permissions</option>
                <option value="settings">Settings</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            <div className="ml-auto text-sm text-gray-500">
              {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
            </div>
          </div>
        </div>

        {/* ==================== LOGS LIST ==================== */}
        <div className="flex-1 overflow-y-auto">
          {loading && logs.length === 0 ? (
            <div className="flex justify-center items-center h-48">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading activity logs...</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex justify-center items-center h-48">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">No activity logs found</p>
                <p className="text-sm text-gray-400 mt-1">Team actions will appear here</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {logs.map((log, index) => (
                <div key={log.id || index} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-4">
                    {/* ✅ Action Icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getActionColor(log.action)}`}>
                      {log.action.includes('member') ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      ) : log.action.includes('invitation') ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      ) : log.action.includes('permission') ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        </svg>
                      )}
                    </div>

                    {/* ✅ Log Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {formatAction(log.action)}
                        </p>
                        <span className="text-xs text-gray-500">
                          {getRelativeTime(log.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-1">
                        {formatDetails(log)}
                      </p>
                      
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-xs text-gray-500">
                          by {log.user?.displayName || log.user?.email || log.userDisplayName || log.userEmail || 'Unknown'}
                        </span>
                        
                        {log.ipAddress && (
                          <span className="text-xs text-gray-400">
                            IP: {log.ipAddress}
                          </span>
                        )}
                        
                        {log.userAgent && (
                          <span className="text-xs text-gray-400 truncate max-w-xs">
                            {log.userAgent.includes('Mobile') ? '📱' : '💻'} 
                            {log.userAgent.split(' ')[0]}
                          </span>
                        )}
                      </div>

                      {/* ✅ Additional Details (expandable) */}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                            View Details
                          </summary>
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono">
                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                          </div>
                        </details>
                      )}

                      {/* ✅ DEBUG: Show raw timestamp in development */}
                      {process.env.NODE_ENV === 'development' && (
                        <div className="mt-1 text-xs text-gray-400">
                          Debug: {log.displayTimestamp?.toString()} → {log.timestamp?.toString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* ✅ Load More Button */}
              {hasMore && (
                <div className="p-4 text-center border-t">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ==================== FOOTER ==================== */}
        <footer className="p-4 border-t bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Activity logs are retained for 90 days. 
            {userContext?.organizationRole === 'owner' && (
              <span className="ml-2">
                <button 
                  onClick={handleExportLogs}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Export Logs
                </button>
              </span>
            )}
          </p>
        </footer>
      </div>
    </div>
  );
}