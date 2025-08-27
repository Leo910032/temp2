"use client"
import React from 'react';

const AuditLogViewer = ({ logs, loading = false, onLoadMore, hasMore = false, className = "" }) => {
  if (loading && (!logs || logs.length === 0)) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex mb-6">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full mr-4"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className={`p-8 text-center text-gray-500 ${className}`}>
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-lg font-medium mb-2">No audit logs available</p>
        <p className="text-sm">Team activity will appear here when actions are performed</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main timeline container */}
      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 via-purple-400 to-gray-300"></div>
        
        <div className="space-y-6 pb-6">
          {logs.map((log, index) => (
            <GitBranchLogItem 
              key={log.id || `${log.timestamp}-${index}`} 
              log={log} 
              index={index}
              isLast={index === logs.length - 1}
            />
          ))}
        </div>

        {/* Load More Button */}
        {hasMore && onLoadMore && (
          <div className="relative flex items-center justify-center mt-6">
            {/* Timeline continues indicator */}
            <div className="absolute left-4 w-0.5 h-6 bg-gray-200"></div>
            
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="relative z-10 px-6 py-3 bg-white border-2 border-gray-300 rounded-full hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-2">
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm font-medium text-gray-600">Loading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span className="text-sm font-medium text-gray-600">Load More</span>
                  </>
                )}
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Individual log item component with Git branch styling
const GitBranchLogItem = ({ log, index, isLast }) => {
  const getActionColor = (action) => {
    const colorMap = {
      'member_added': 'bg-green-500 border-green-600',
      'member_removed': 'bg-red-500 border-red-600',
      'role_updated': 'bg-blue-500 border-blue-600',
      'invitation_sent': 'bg-purple-500 border-purple-600',
      'invitation_revoked': 'bg-orange-500 border-orange-600',
      'invitation_resent': 'bg-indigo-500 border-indigo-600',
      'team_created': 'bg-emerald-500 border-emerald-600',
      'team_updated': 'bg-cyan-500 border-cyan-600',
      'team_permissions_updated': 'bg-violet-500 border-violet-600',
      'settings_changed': 'bg-yellow-500 border-yellow-600',
      'bulk_invitations_resent': 'bg-indigo-400 border-indigo-500',
      'bulk_invitations_revoked': 'bg-orange-400 border-orange-500'
    };
    return colorMap[action] || 'bg-gray-500 border-gray-600';
  };

  const getActionIcon = (action) => {
    if (action.includes('member')) {
      return (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    }
    if (action.includes('invitation')) {
      return (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    }
    if (action.includes('permission') || action.includes('role')) {
      return (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    }
    if (action.includes('team')) {
      return (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
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

  return (
    <div className="relative flex items-start group">
      {/* Branch point */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full border-4 border-white shadow-md z-20 ${getActionColor(log.action)} flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
        {getActionIcon(log.action)}
      </div>
      
      {/* Branch line extending to content */}
      <div className="absolute left-8 top-4 w-6 h-0.5 bg-gray-300 z-10"></div>
      
      {/* Content card */}
      <div className="ml-6 flex-1 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 group-hover:border-gray-300">
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-sm font-semibold text-gray-900">
              {formatAction(log.action)}
            </h4>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {getRelativeTime(log.timestamp)}
              </span>
            </div>
          </div>
          
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">
            {formatDetails(log)}
          </p>
          
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-3 text-gray-500">
              <span className="flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{log.user?.displayName || log.user?.email || 'System'}</span>
              </span>
              
              {log.ipAddress && (
                <span className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                  </svg>
                  <span>{log.ipAddress}</span>
                </span>
              )}
            </div>
            
            {log.commitHash && (
              <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
                {log.commitHash.substring(0, 7)}
              </span>
            )}
          </div>

          {/* Expandable details */}
          {log.details && Object.keys(log.details).length > 0 && (
            <details className="mt-3 group/details">
              <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 select-none flex items-center space-x-1">
                <svg className="w-3 h-3 transition-transform group-open/details:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>View technical details</span>
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded border-l-4 border-blue-200">
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
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
    'settings_changed': 'Settings Changed',
    'bulk_invitations_resent': 'Bulk Invitations Resent',
    'bulk_invitations_revoked': 'Bulk Invitations Revoked'
  };
  return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatDetails = (log) => {
  const { action, details, targetUser, metadata } = log;
  
  switch (action) {
    case 'member_added':
      return `Added ${targetUser?.displayName || targetUser?.email || 'user'} as ${details?.role || 'member'}`;
    case 'member_removed':
      return `Removed ${targetUser?.displayName || targetUser?.email || 'user'} from team`;
    case 'role_updated':
      return `Changed ${targetUser?.displayName || targetUser?.email || 'user'}'s role from ${details?.oldRole || 'unknown'} to ${details?.newRole || 'unknown'}`;
    case 'invitation_sent':
      return `Sent invitation to ${details?.email || details?.invitedEmail || 'unknown'} for ${details?.role || details?.invitedRole || 'member'} role`;
    case 'invitation_revoked':
      return `Revoked invitation for ${details?.email || details?.invitedEmail || 'unknown'}`;
    case 'invitation_resent':
      return `Resent invitation to ${details?.email || details?.invitedEmail || 'unknown'}`;
    case 'team_permissions_updated':
      const changedRoles = details?.affectedRoles?.join(', ') || 'multiple roles';
      return `Updated permissions for ${changedRoles}`;
    case 'settings_changed':
      return `Modified team settings: ${details?.changedFields?.join(', ') || 'various fields'}`;
    case 'bulk_invitations_resent':
      return `Resent ${details?.invitationCount || 'multiple'} invitations in bulk`;
    case 'bulk_invitations_revoked':
      return `Revoked ${details?.invitationCount || 'multiple'} invitations in bulk`;
    default:
      return details?.description || log.description || 'Team action performed';
  }
};

export default AuditLogViewer;