"use client"
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useOptimizedTeamData } from '@/lib/hooks/useOptimizedEnterpriseData';
import { 
  TEAM_ROLES, 
  PERMISSIONS 
} from '@/lib/services/serviceEnterprise/constants/enterpriseConstants';
import { 
  getAggregatedTeamAnalytics 
} from '@/lib/services/serviceEnterprise/client/transitionService';

export default function TeamPreview({ selectedTeam, onManageTeam, userContext }) {
  // Early return for null selectedTeam - BEFORE any hooks
  if (!selectedTeam) {
    return (
      <div className="hidden lg:flex lg:w-[30rem] xl:w-[35rem] bg-white border-l border-gray-200 p-6 flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Team</h3>
            <p className="text-sm text-gray-500">
              Click on a team card to view detailed information, analytics, and team member insights.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Now it's safe to use hooks since selectedTeam is not null
  const {
    members,
    invitations,
    stats,
    loading,
    error
  } = useOptimizedTeamData(selectedTeam.id);

  const [activeTab, setActiveTab] = useState('overview');
  const [teamAnalytics, setTeamAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);

  // Permission check functions with null safety
  const canManageTeam = () => {
    if (!selectedTeam?.id || !userContext) return false;
    return hasPermission(userContext, PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS, selectedTeam.id);
  };

  const canViewTeamAnalytics = () => {
    if (!selectedTeam?.id || !userContext) return false;
    return hasPermission(userContext, PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS, selectedTeam.id);
  };

  // Helper function to check specific permissions
  const hasPermission = (userContext, permission, teamId = null) => {
    if (!userContext || !teamId) return false;
    
    try {
      const effectiveRole = getUserTeamRole(userContext, teamId);
      const teamData = userContext.teams?.[teamId];
      const customPermissions = teamData?.permissions || {};
      
      if (customPermissions.hasOwnProperty(permission)) {
        return customPermissions[permission];
      }
      
      const rolePermissions = getDefaultPermissionsForRole(effectiveRole);
      return rolePermissions[permission] || false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  };

  const getUserTeamRole = (userContext, teamId) => {
    if (!userContext || !teamId) return TEAM_ROLES.EMPLOYEE;
    
    try {
      if (userContext.organizationRole === 'owner') {
        return TEAM_ROLES.OWNER;
      }
      
      const teamData = userContext.teams?.[teamId];
      return teamData?.role || TEAM_ROLES.EMPLOYEE;
    } catch (error) {
      console.error('Error getting user team role:', error);
      return TEAM_ROLES.EMPLOYEE;
    }
  };

  const getDefaultPermissionsForRole = (role) => {
    const DEFAULT_PERMISSIONS_BY_ROLE = {
      [TEAM_ROLES.EMPLOYEE]: {
        [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: false,
        [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: false
      },
      [TEAM_ROLES.TEAM_LEAD]: {
        [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: true,
        [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: true
      },
      [TEAM_ROLES.MANAGER]: {
        [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: true,
        [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: true
      },
      [TEAM_ROLES.OWNER]: {
        [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: true,
        [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: true
      }
    };

    return DEFAULT_PERMISSIONS_BY_ROLE[role] || DEFAULT_PERMISSIONS_BY_ROLE[TEAM_ROLES.EMPLOYEE];
  };

  // Load team analytics function with null safety
  const loadTeamAnalytics = async () => {
    if (!selectedTeam?.id || !members?.length || !canViewTeamAnalytics()) {
      return null;
    }

    try {
      console.log('Loading team analytics for team:', selectedTeam.id);
      
      const analytics = await getAggregatedTeamAnalytics(selectedTeam.id, userContext?.userId);
      
      console.log('Team analytics loaded:', {
        totalClicks: analytics?.totalClicks || 0,
        totalViews: analytics?.totalViews || 0,
        memberCount: analytics?.dataQuality?.membersWithData || 0,
        coverage: analytics?.dataQuality?.coverage || 0
      });

      return analytics;

    } catch (error) {
      console.error('Error loading team analytics:', error);
      throw error;
    }
  };

  // Role distribution with null safety
  const getRoleDistribution = () => {
    if (!members || !Array.isArray(members)) return {};
    
    const distribution = {};
    Object.values(TEAM_ROLES).forEach(role => {
      distribution[role] = members.filter(member => member?.role === role).length;
    });
    return distribution;
  };

  const roleDistribution = getRoleDistribution();

  // Handle viewing user analytics
  const handleViewUserAnalytics = async (targetUser) => {
    if (!targetUser?.id || !selectedTeam?.id) {
      toast.error('Invalid user or team data');
      return;
    }

    try {
      const canViewAnalytics = canViewTeamAnalytics();

      if (!canViewAnalytics) {
        toast.error('You do not have permission to view team analytics');
        return;
      }

      if (targetUser.id === userContext?.userId) {
        window.location.href = `/dashboard/analytics`;
        return;
      }

      const toastId = toast.loading(`Loading analytics for ${targetUser.displayName || targetUser.email}...`);

      try {
        const impersonationUrl = `/dashboard/analytics?impersonate=${targetUser.id}&team=${selectedTeam.id}&from=enterprise`;
        window.location.href = impersonationUrl;
        toast.success(`Viewing analytics for ${targetUser.displayName || targetUser.email}`, { id: toastId });
      } catch (error) {
        console.error('Failed to access impersonated analytics:', error);
        toast.error(error.message || 'Failed to load analytics', { id: toastId });
      }

    } catch (error) {
      console.error('Analytics access error:', error);
      toast.error('Failed to access user analytics');
    }
  };

  // Effect with null safety
  useEffect(() => {
    if ((activeTab === 'leaderboard' || activeTab === 'overview') && 
        selectedTeam?.id && 
        members?.length > 0 && 
        canViewTeamAnalytics() && 
        !teamAnalytics && 
        !analyticsLoading) {
      
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      
      loadTeamAnalytics()
        .then(data => {
          setTeamAnalytics(data);
          setAnalyticsError(null);
        })
        .catch(error => {
          console.error('Failed to fetch team analytics:', error);
          setAnalyticsError(error.message);
          toast.error('Failed to load team analytics');
        })
        .finally(() => {
          setAnalyticsLoading(false);
        });
    }
  }, [activeTab, members, selectedTeam?.id, userContext]);

  // Clear analytics when team changes
  useEffect(() => {
    setTeamAnalytics(null);
    setAnalyticsError(null);
  }, [selectedTeam?.id]);

  const analytics = teamAnalytics;

  return (
    <div className="hidden lg:flex lg:w-[30rem] xl:w-[35rem] bg-white border-l border-gray-200 flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {selectedTeam?.name?.charAt(0)?.toUpperCase() || 'T'}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {selectedTeam?.name || 'Unnamed Team'}
              </h2>
              <p className="text-sm text-gray-500">
                {selectedTeam?.status === 'active' ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
        </div>

        {selectedTeam?.description && (
          <p className="text-sm text-gray-600 mb-4">
            {selectedTeam.description}
          </p>
        )}
   {/*
        {canManageTeam() && (
          <button
            onClick={() => onManageTeam?.(selectedTeam)}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Manage Team
          </button>
        )} */}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {[
            { id: 'overview', name: 'Overview', icon: '📊' },
            { id: 'members', name: 'Members', icon: '👥' },
            { id: 'leaderboard', name: 'Leaderboard', icon: '🏆' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-600 p-4">
            <p>Failed to load team data: {error}</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {stats?.totalMembers || members?.length || 0}
                    </div>
                    <div className="text-sm text-purple-700">Members</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats?.totalInvitations || invitations?.length || 0}
                    </div>
                    <div className="text-sm text-blue-700">Pending</div>
                  </div>
                </div>

                {/* Team Analytics Section */}
                {canViewTeamAnalytics() && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">Team Performance</h3>
                      {analyticsLoading && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                      )}
                    </div>
                    
                    {analyticsLoading ? (
                      <div className="bg-gray-50 rounded-lg p-4 animate-pulse">
                        <div className="space-y-3">
                          {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="flex justify-between">
                              <div className="h-4 bg-gray-200 rounded w-24"></div>
                              <div className="h-4 bg-gray-200 rounded w-16"></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : analyticsError ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-700">Analytics Error: {analyticsError}</p>
                        <button
                          onClick={() => {
                            setAnalyticsLoading(true);
                            setAnalyticsError(null);
                            setTeamAnalytics(null);
                            loadTeamAnalytics()
                              .then(setTeamAnalytics)
                              .catch(error => setAnalyticsError(error.message))
                              .finally(() => setAnalyticsLoading(false));
                          }}
                          className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    ) : analytics ? (
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Team Clicks</span>
                          <span className="font-medium">{analytics.totalClicks?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Team Views</span>
                          <span className="font-medium">{analytics.totalViews?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Today's Activity</span>
                          <span className="font-medium">
                            {(analytics.todayClicks || 0) + (analytics.todayViews || 0)} interactions
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Avg Performance/Member</span>
                          <span className="font-medium">{analytics.avgClicksPerMember || 0} clicks</span>
                        </div>
                        {analytics.dataQuality && (
                          <div className="border-t border-gray-200 pt-3 mt-3">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Data Coverage</span>
                              <span className={`font-medium ${
                                analytics.dataQuality.coverage >= 90 ? 'text-green-600' :
                                analytics.dataQuality.coverage >= 70 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {analytics.dataQuality.coverage}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-500 mb-2">Analytics not loaded</p>
                        <button
                          onClick={() => setActiveTab('leaderboard')}
                          className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                        >
                          Load Team Analytics
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Role Distribution */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Role Distribution</h3>
                  <div className="space-y-2">
                    {Object.entries(roleDistribution).map(([role, count]) => {
                      if (count === 0) return null;
                      return (
                        <div key={role} className="flex items-center justify-between">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            role === TEAM_ROLES.OWNER ? 'bg-red-100 text-red-800' :
                            role === TEAM_ROLES.MANAGER ? 'bg-purple-100 text-purple-800' :
                            role === TEAM_ROLES.TEAM_LEAD ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                          <span className="font-medium">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Team Details</h3>
                                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {selectedTeam?.createdAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Created</span>
                        <span>{new Date(selectedTeam.createdAt.toDate ? selectedTeam.createdAt.toDate() : selectedTeam.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    {selectedTeam?.lastModified && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Last Updated</span>
                        <span>{new Date(selectedTeam.lastModified.toDate ? selectedTeam.lastModified.toDate() : selectedTeam.lastModified).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Team ID</span>
                      <span className="font-mono text-xs">{selectedTeam?.id || 'N/A'}</span>
                    </div>
                    
                    {canViewTeamAnalytics() && (
                      <div className="pt-2 border-t border-gray-200">
                        <button
                          onClick={() => {
                            setAnalyticsLoading(true);
                            setAnalyticsError(null);
                            setTeamAnalytics(null);
                            loadTeamAnalytics()
                              .then(setTeamAnalytics)
                              .catch(error => {
                                setAnalyticsError(error.message);
                                toast.error('Failed to refresh team analytics');
                              })
                              .finally(() => setAnalyticsLoading(false));
                          }}
                          disabled={analyticsLoading}
                          className="w-full text-xs text-purple-600 hover:text-purple-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {analyticsLoading ? 'Refreshing Analytics...' : 'Refresh Team Analytics'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Members Tab */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Team Members</h3>
                  <span className="text-sm text-gray-500">{members?.length || 0} total</span>
                </div>
                
                <div className="space-y-3">
                  {members && Array.isArray(members) ? members.map((member) => (
                    <div key={member.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-purple-600 font-medium text-sm">
                          {(member?.displayName || member?.email || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {member?.displayName || member?.email || 'Unknown User'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{member?.email || ''}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            member?.role === TEAM_ROLES.OWNER ? 'bg-red-100 text-red-800' :
                            member?.role === TEAM_ROLES.MANAGER ? 'bg-purple-100 text-purple-800' :
                            member?.role === TEAM_ROLES.TEAM_LEAD ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {member?.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Member'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {analytics?.memberAnalytics && (
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {(analytics.memberAnalytics.find(ma => ma.member?.id === member?.id)?.analytics?.totalClicks || 0).toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">clicks</div>
                          </div>
                        )}
                        
                        {canViewTeamAnalytics() && member?.id !== userContext?.userId && (
                          <button
                            onClick={() => handleViewUserAnalytics(member)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={`View analytics for ${member?.displayName || member?.email}`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500 text-center py-4">No members found</p>
                  )}
                </div>

                {invitations && Array.isArray(invitations) && invitations.length > 0 && (
                  <div className="border-t border-gray-200 pt-4 mt-6">
                    <h4 className="font-medium text-gray-900 mb-3">Pending Invitations</h4>
                    <div className="space-y-2">
                      {invitations.slice(0, 3).map((invitation) => (
                        <div key={invitation.id} className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{invitation.invitedEmail}</p>
                            <p className="text-xs text-gray-500 capitalize">{invitation.role?.replace('_', ' ')}</p>
                          </div>
                          <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                            Pending
                          </span>
                        </div>
                      ))}
                      {invitations.length > 3 && (
                        <p className="text-xs text-gray-500 text-center">
                          +{invitations.length - 3} more invitations
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              <div className="space-y-6">
                {!canViewTeamAnalytics() ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
                    <p className="text-sm text-gray-500">
                      You need team analytics permissions to view the leaderboard.
                    </p>
                  </div>
                ) : analyticsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-sm text-gray-600">Loading team analytics...</p>
                  </div>
                ) : analyticsError ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Analytics</h3>
                    <p className="text-sm text-gray-500 mb-4">{analyticsError}</p>
                    <button
                      onClick={() => {
                        setAnalyticsLoading(true);
                        setAnalyticsError(null);
                        loadTeamAnalytics()
                          .then(setTeamAnalytics)
                          .catch(error => {
                            setAnalyticsError(error.message);
                            toast.error('Failed to reload team analytics');
                          })
                          .finally(() => setAnalyticsLoading(false));
                      }}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    >
                      Retry
                    </button>
                  </div>
                ) : !analytics ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
                    <p className="text-sm text-gray-500">
                      No analytics data is available for this team yet.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Data Quality Indicator */}
                    {analytics.dataQuality && analytics.dataQuality.coverage < 100 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                              Analytics available for {analytics.dataQuality.membersWithData} of {analytics.dataQuality.totalMembers} members 
                              ({analytics.dataQuality.coverage}% coverage)
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Enhanced Overview Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {analytics.totalClicks?.toLocaleString() || 0}
                        </div>
                        <div className="text-sm text-purple-700">Total Clicks</div>
                        <div className="text-xs text-purple-600 mt-1">
                          Today: {analytics.todayClicks || 0}
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {analytics.totalViews?.toLocaleString() || 0}
                        </div>
                        <div className="text-sm text-blue-700">Total Views</div>
                        <div className="text-xs text-blue-600 mt-1">
                          Today: {analytics.todayViews || 0}
                        </div>
                      </div>
                    </div>

                    {/* Clicks Leaderboard */}
                    <div>
                      <div className="flex items-center space-x-2 mb-4">
                        <span className="text-lg">🚀</span>
                        <h3 className="font-semibold text-gray-900">Top Performers - Clicks</h3>
                      </div>
                      <div className="space-y-2">
                        {analytics.clickLeaderboard?.length > 0 ? analytics.clickLeaderboard.map((member, index) => (
                          <div key={member.id} className="flex items-center space-x-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              index === 0 ? 'bg-yellow-400 text-white' :
                              index === 1 ? 'bg-gray-300 text-white' :
                              index === 2 ? 'bg-amber-600 text-white' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {member?.displayName || member?.email || 'Unknown User'}
                              </p>
                              <p className="text-xs text-gray-500">{member?.role?.replace('_', ' ') || 'member'}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-gray-900">
                                {(member?.totalClicks || 0).toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                Today: {member?.todayClicks || 0}
                              </div>
                            </div>
                          </div>
                        )) : (
                          <p className="text-sm text-gray-500 text-center py-4">No click data available</p>
                        )}
                      </div>
                    </div>

                    {/* Views Leaderboard */}
                    <div>
                      <div className="flex items-center space-x-2 mb-4">
                        <span className="text-lg">👀</span>
                        <h3 className="font-semibold text-gray-900">Top Performers - Views</h3>
                      </div>
                      <div className="space-y-2">
                        {analytics.viewLeaderboard?.length > 0 ? analytics.viewLeaderboard.map((member, index) => (
                          <div key={member.id} className="flex items-center space-x-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              index === 0 ? 'bg-green-500 text-white' :
                              index === 1 ? 'bg-emerald-400 text-white' :
                              index === 2 ? 'bg-teal-400 text-white' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {member?.displayName || member?.email || 'Unknown User'}
                              </p>
                              <p className="text-xs text-gray-500">{member?.role?.replace('_', ' ') || 'member'}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-gray-900">
                                {(member?.totalViews || 0).toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                Today: {member?.todayViews || 0}
                              </div>
                            </div>
                          </div>
                        )) : (
                          <p className="text-sm text-gray-500 text-center py-4">No view data available</p>
                        )}
                      </div>
                    </div>

                    {/* Top Team Links */}
                    {analytics.topTeamLinks && analytics.topTeamLinks.length > 0 && (
                      <div>
                        <div className="flex items-center space-x-2 mb-4">
                          <span className="text-lg">🔗</span>
                          <h3 className="font-semibold text-gray-900">Top Team Links</h3>
                        </div>
                        <div className="space-y-2">
                          {analytics.topTeamLinks.slice(0, 5).map((link, index) => (
                            <div key={`${link.ownerId}-${link.linkId}`} className="flex items-center space-x-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-indigo-600 font-bold text-sm">{index + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate" title={link.title}>
                                  {link.title || 'Untitled Link'}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  by {link.ownerName || 'Unknown'}
                                </p>
                                {link.url && (
                                  <p className="text-xs text-blue-600 truncate" title={link.url}>
                                    {link.url}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-gray-900">
                                  {(link.totalClicks || 0).toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Today: {link.todayClicks || 0}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team Performance Summary */}
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Team Performance Summary</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-xl font-bold text-purple-600">
                            {analytics.avgClicksPerMember || 0}
                          </div>
                          <div className="text-xs text-purple-700">Avg Clicks/Member</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-blue-600">
                            {analytics.avgViewsPerMember || 0}
                          </div>
                          <div className="text-xs text-blue-700">Avg Views/Member</div>
                        </div>
                      </div>
                      
                      {/* Time-based Performance */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <div className="text-sm font-semibold text-gray-700">
                              {(analytics.todayClicks || 0) + (analytics.todayViews || 0)}
                            </div>
                            <div className="text-xs text-gray-500">Today</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-700">
                              {(analytics.yesterdayClicks || 0) + (analytics.yesterdayViews || 0)}
                            </div>
                            <div className="text-xs text-gray-500">Yesterday</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-700">
                              {(analytics.thisWeekClicks || 0) + (analytics.thisWeekViews || 0)}
                            </div>
                            <div className="text-xs text-gray-500">This Week</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-700">
                              {(analytics.thisMonthClicks || 0) + (analytics.thisMonthViews || 0)}
                            </div>
                            <div className="text-xs text-gray-500">This Month</div>
                          </div>
                        </div>
                      </div>
                      
                      {analytics.lastUpdated && (
                        <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                          <p className="text-xs text-gray-500">
                            Last updated: {new Date(analytics.lastUpdated).toLocaleTimeString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}