"use client"
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

// Phase 3 imports - enhanced services
import { 
  teamService,
  invitationService,
  subscriptionService,
  ErrorHandler
} from '@/lib/services/serviceEnterprise/client/enhanced-index';

import {
  TEAM_ROLES,
  PERMISSIONS
} from '@/lib/services/serviceEnterprise/constants/enterpriseConstants';

export default function TeamPreview({ selectedTeam, onManageTeam, userContext, canManage }) {
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Team data
  const [teamData, setTeamData] = useState({
    members: [],
    invitations: [],
    analytics: null,
    permissions: null
  });

  // Permission checks - use server-validated data from userContext
  const getUserTeamRole = () => {
    if (!selectedTeam?.id || !userContext) return 'employee';
    
    if (userContext.organizationRole === 'owner') {
      return 'owner';
    }
    
    const teamData = userContext.teams?.[selectedTeam.id];
    return teamData?.role || 'employee';
  };

  const canViewTeamAnalytics = () => {
    if (!selectedTeam?.id || !userContext) return false;
    
    const userRole = getUserTeamRole();
    return ['owner', 'manager', 'team_lead'].includes(userRole);
  };

  // Fetch team details using Phase 3 services
  const fetchTeamData = async () => {
    if (!selectedTeam?.id) return;

    try {
      setLoading(true);
      setError(null);

      console.log('Fetching team data with Phase 3 services for team:', selectedTeam.id);

      const team = teamService();
      const invitation = invitationService();

      // Fetch team details and invitations in parallel
      const [teamDetails, teamInvitations] = await Promise.allSettled([
        team.getTeamDetails(selectedTeam.id),
        invitation.getTeamInvitations(selectedTeam.id)
      ]);

      // Process results
      const members = teamDetails.status === 'fulfilled' 
        ? teamDetails.value.members || []
        : [];

      const invitations = teamInvitations.status === 'fulfilled'
        ? teamInvitations.value || []
        : [];

      // Get analytics if user has permissions
      let analytics = null;
      if (canViewTeamAnalytics() && members.length > 0) {
        try {
          // For now, we'll create a placeholder for analytics
          // You'll need to implement the analytics service in Phase 3
          analytics = await fetchTeamAnalytics(selectedTeam.id, members);
        } catch (analyticsError) {
          console.warn('Analytics fetch failed:', analyticsError.message);
          // Don't fail the whole component if analytics fails
        }
      }

      setTeamData({
        members,
        invitations,
        analytics,
        permissions: teamDetails.status === 'fulfilled' 
          ? teamDetails.value.permissions 
          : null
      });

      console.log('Team data loaded:', {
        membersCount: members.length,
        invitationsCount: invitations.length,
        hasAnalytics: !!analytics
      });

    } catch (err) {
      console.error('Error fetching team data:', err);
      const handledError = ErrorHandler.handle(err, 'fetchTeamData');
      setError(handledError.message);
    } finally {
      setLoading(false);
    }
  };

  // Placeholder analytics function - implement with your actual analytics service
  const fetchTeamAnalytics = async (teamId, members) => {
    // This should be implemented with your Phase 3 analytics service
    // For now, return mock data structure
    return {
      totalClicks: 0,
      totalViews: 0,
      todayClicks: 0,
      todayViews: 0,
      thisWeekClicks: 0,
      thisWeekViews: 0,
      thisMonthClicks: 0,
      thisMonthViews: 0,
      avgClicksPerMember: 0,
      avgViewsPerMember: 0,
      clickLeaderboard: [],
      viewLeaderboard: [],
      topTeamLinks: [],
      dataQuality: {
        membersWithData: 0,
        totalMembers: members.length,
        coverage: 0
      },
      lastUpdated: new Date().toISOString()
    };
  };

  // Handle viewing user analytics
  const handleViewUserAnalytics = async (targetUser) => {
    if (!targetUser?.id || !selectedTeam?.id) {
      toast.error('Invalid user or team data');
      return;
    }

    if (!canViewTeamAnalytics()) {
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
      toast.error('Failed to load analytics', { id: toastId });
    }
  };

  // Refresh team data
  const refreshTeamData = async () => {
    setTeamData(prev => ({
      ...prev,
      analytics: null // Clear analytics to force reload
    }));
    await fetchTeamData();
  };

  // Effect to load team data when team changes
  useEffect(() => {
    if (selectedTeam?.id) {
      fetchTeamData();
    } else {
      setTeamData({ members: [], invitations: [], analytics: null, permissions: null });
    }
  }, [selectedTeam?.id, userContext]);

  // Early return for no selected team
  if (!selectedTeam) {
    return (
      <div className="hidden lg:flex lg:w-[30rem] xl:w-[35rem] bg-white border-l border-gray-200 p-6 flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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

  const userRole = getUserTeamRole();
  const { members, invitations, analytics } = teamData;

  // Role distribution calculation
  const getRoleDistribution = () => {
    const distribution = {};
    Object.values(TEAM_ROLES).forEach(role => {
      distribution[role] = members.filter(member => member?.role === role).length;
    });
    return distribution;
  };

  const roleDistribution = getRoleDistribution();

  return (
    <div className="hidden lg:flex lg:w-[30rem] xl:w-[35rem] bg-white border-l border-gray-200 flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {selectedTeam.name?.charAt(0)?.toUpperCase() || 'T'}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {selectedTeam.name || 'Unnamed Team'}
              </h2>
              <p className="text-sm text-gray-500">
                Your role: <span className="capitalize">{userRole.replace('_', ' ')}</span>
              </p>
            </div>
          </div>
        </div>

        {selectedTeam.description && (
          <p className="text-sm text-gray-600 mb-4">
            {selectedTeam.description}
          </p>
        )}

        {/* Service Status Indicator */}
        <div className="flex items-center text-xs text-gray-500 space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>Phase 3 services active</span>
          {loading && (
            <>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Loading...</span>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {[
            { id: 'overview', name: 'Overview', icon: '📊' },
            { id: 'members', name: 'Members', icon: '👥' },
            ...(canViewTeamAnalytics() ? [{ id: 'analytics', name: 'Analytics', icon: '📈' }] : [])
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
        {loading && !teamData.members.length ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading team data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Team Data</h3>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button
              onClick={refreshTeamData}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {members.length}
                    </div>
                    <div className="text-sm text-purple-700">Members</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {invitations.length}
                    </div>
                    <div className="text-sm text-blue-700">Pending</div>
                  </div>
                </div>

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
                    {selectedTeam.createdAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Created</span>
                        <span>{new Date(selectedTeam.createdAt.toDate ? selectedTeam.createdAt.toDate() : selectedTeam.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Your Role</span>
                      <span className="capitalize font-medium">{userRole.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Can Manage</span>
                      <span>{canManage ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  <button
                    onClick={refreshTeamData}
                    disabled={loading}
                    className="w-full text-sm text-purple-600 hover:text-purple-700 disabled:text-gray-400 py-2 transition-colors"
                  >
                    {loading ? 'Refreshing...' : 'Refresh Team Data'}
                  </button>
                  
                  {canManage && (
                    <button
                      onClick={() => onManageTeam?.(selectedTeam)}
                      className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                    >
                      Manage Team
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Members Tab */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Team Members</h3>
                  <span className="text-sm text-gray-500">{members.length} total</span>
                </div>
                
                <div className="space-y-3">
                  {members.length > 0 ? members.map((member) => (
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

                {/* Pending Invitations */}
                {invitations.length > 0 && (
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

            {/* Analytics Tab - Only shown if user has permissions */}
            {activeTab === 'analytics' && canViewTeamAnalytics() && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Coming Soon</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Team analytics will be integrated with the Phase 3 services in the next update.
                  </p>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-xs text-blue-700">
                      Phase 3 services are active and ready for analytics integration.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}