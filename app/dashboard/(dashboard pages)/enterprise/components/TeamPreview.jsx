// ✅ FIXED: Team Preview Component with Null Safety
"use client"
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

// ✅ PHASE 3: Enhanced Services - Updated imports
import { 
  teamService,
  invitationService,
  analyticsService,
  cacheService,
  useOptimizedTeamData,
  TEAM_ROLES,
  TEAM_ROLE_HIERARCHY, // ✅ Import the hierarchy constant
  PERMISSIONS
} from '@/lib/services/serviceEnterprise';


const StatCard = ({ label, value, colorClass = 'text-gray-900' }) => (
  <div className="bg-gray-50 rounded-lg p-4 text-center">
    <div className={`text-3xl font-bold ${colorClass}`}>{value || 0}</div>
    <div className="text-sm text-gray-600">{label}</div>
  </div>
);

const Leaderboard = ({ title, data, metric, unit = '' }) => (
  <div>
    <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
    <div className="space-y-3">
      {data && data.length > 0 ? data.map((item, index) => (
        <div key={item.id} className="flex items-center space-x-3 p-2 bg-white rounded-lg border">
          <div className="text-lg font-bold w-6 text-center text-gray-500">
            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
          </div>
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-gray-600">{item.displayName?.charAt(0).toUpperCase() || '?'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{item.displayName || 'Unknown'}</p>
          </div>
          <div className="font-bold text-gray-800">
            {item[metric] || 0} <span className="font-normal text-gray-500 text-sm">{unit}</span>
          </div>
        </div>
      )) : (
        <p className="text-sm text-gray-500 text-center py-4">Not enough data for a leaderboard yet.</p>
      )}
    </div>
  </div>
);

export default function EnhancedTeamPreview({ selectedTeam, onManageTeam, userContext, canManage }) {
  // ✅ PHASE 3: Use Enhanced Services hook instead of manual state management
  const {
    members,
    invitations,
    permissions,
    loading,
    error,
    refetch,
    stats
  } = useOptimizedTeamData(selectedTeam?.id);

  // State management for additional features
  const [activeTab, setActiveTab] = useState('overview');
  const [teamAnalytics, setTeamAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);

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
    
    // Organization owners can always view analytics
    if (userContext.organizationRole === 'owner') return true;
    
    // Check the user's specific permissions for this team from server data
    const teamData = userContext.teams?.[selectedTeam.id];
    if (teamData?.permissions?.canViewTeamAnalytics) {
      return true;
    }
    
    // Fallback to role-based check for backwards compatibility
    const userRole = getUserTeamRole();
    return ['owner', 'manager', 'team_lead'].includes(userRole);
  };
 const canViewMemberAnalytics = (targetMember) => {
    // Basic check: Does the current user have the general permission to view any analytics at all?
    if (!canViewTeamAnalytics()) {
      return false;
    }

    // Don't show the button for the user themselves.
    if (targetMember.id === userContext?.userId) {
      return false;
    }

    // HIERARCHY CHECK: Compare the current user's role level to the target member's role level.
    const currentUserRole = getUserTeamRole();
    const targetUserRole = targetMember.role;

    const currentUserLevel = TEAM_ROLE_HIERARCHY[currentUserRole] || 0;
    const targetUserLevel = TEAM_ROLE_HIERARCHY[targetUserRole] || 0;
    
    // The button should only be shown if the current user's level is >= the target's level.
    return currentUserLevel >= targetUserLevel;
  };

  // Enhanced analytics fetching with proper error handling
  const fetchTeamAnalytics = async () => {
    if (!selectedTeam?.id || !canViewTeamAnalytics()) {
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      console.log('Loading team analytics with Enhanced Services...');
      
      const analytics = analyticsService();
const analyticsData = await analytics.getAggregatedTeamAnalytics(selectedTeam.id, userContext?.userId);
      
      console.log('Team analytics loaded:', analyticsData);
      setTeamAnalytics(analyticsData);
      
    } catch (err) {
      console.error('Failed to fetch team analytics:', err);
    console.error('Failed to fetch team analytics:', err);
setAnalyticsError(err.message || 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Enhanced user analytics handling with impersonation
  const handleViewUserAnalytics = async (targetUser) => {
    if (!targetUser?.id || !selectedTeam?.id) {
      toast.error('Invalid user or team data');
      return;
    }

    if (!canViewTeamAnalytics()) {
      toast.error('You do not have permission to view team analytics');
      return;
    }

    // If viewing own analytics, go to regular analytics page
    if (targetUser.id === userContext?.userId) {
      window.location.href = `/dashboard/analytics`;
      return;
    }

    const toastId = toast.loading(`Checking permissions for ${targetUser.displayName || targetUser.email}...`);

    try {
      // Check if user can impersonate analytics for this team member
      const analytics = analyticsService();
      const canImpersonate = await analytics.canImpersonateAnalytics(targetUser.id, selectedTeam.id);
      
      if (!canImpersonate) {
        toast.error('You do not have permission to view this member\'s analytics', { id: toastId });
        return;
      }

      // Navigate to impersonated analytics
      const impersonationUrl = `/dashboard/analytics?impersonate=${targetUser.id}&team=${selectedTeam.id}&from=enterprise`;
      window.location.href = impersonationUrl;
      
      toast.success(`Viewing analytics for ${targetUser.displayName || targetUser.email}`, { id: toastId });
      
    } catch (error) {
      console.error('Failed to access impersonated analytics:', error);
     console.error('Failed to access impersonated analytics:', error);
toast.error(error.message || 'Failed to access analytics', { id: toastId });
    }
  };

  // Enhanced refresh with cache management
  const refreshTeamData = async () => {
    try {
      console.log('Refreshing team data with cache optimization...');
      
      // Clear relevant caches for better data freshness
      const cache = cacheService();
      if (selectedTeam?.id) {
        await cache.clearTeamCaches(selectedTeam.id);
      }
      
      // Clear analytics data to force reload
      setTeamAnalytics(null);
      
      // Refresh using the hook's refetch method
      await refetch();
      
      // Refetch analytics if on analytics tab
      if (activeTab === 'analytics' && canViewTeamAnalytics()) {
        await fetchTeamAnalytics();
      }
      
      
    } catch (error) {
      console.error('Failed to refresh team data:', error);
      toast.error('Failed to refresh data');
    }
  };

  // Effect to load analytics when switching to analytics tab
  useEffect(() => {
    if (activeTab === 'analytics' && canViewTeamAnalytics() && !teamAnalytics && !analyticsLoading) {
      fetchTeamAnalytics();
    }
  }, [activeTab, selectedTeam?.id, canViewTeamAnalytics()]);

  // Effect to reset analytics when team changes
  useEffect(() => {
    setTeamAnalytics(null);
    setAnalyticsError(null);
    
    // Default to appropriate tab based on permissions
    if (selectedTeam?.id) {
      if (canViewTeamAnalytics() && activeTab === 'analytics') {
        setActiveTab('analytics');
      } else {
        setActiveTab('overview');
      }
    }
  }, [selectedTeam?.id]);

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

  // Enhanced role distribution calculation with null safety
  const getRoleDistribution = () => {
    const distribution = {};
    Object.values(TEAM_ROLES).forEach(role => {
      distribution[role] = (members || []).filter(member => member?.role === role).length;
    });
    return distribution;
  };

  const roleDistribution = getRoleDistribution();

  return (
    <div className="hidden lg:flex lg:w-[30rem] xl:w-[35rem] bg-white border-l border-gray-200 flex-col">
      {/* Enhanced Header */}
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

        {/* Enhanced Service Status Indicator with null safety */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Enhanced Services v3.0</span>
            {loading && (
              <>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Loading...</span>
              </>
            )}
          </div>
          
          {/* Quick stats from enhanced hook with null safety */}
          {stats && (
            <div className="text-xs text-gray-400">
              {stats.memberCount || 0}M • {stats.invitationCount || 0}P • {stats.recentActivity?.newMembersThisWeek || 0}W
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {[
            { id: 'overview', name: 'Overview', icon: '📊' },
            { id: 'members', name: 'Members', icon: '👥', badge: (members || []).length },
            ...(canViewTeamAnalytics() ? [{ id: 'analytics', name: 'Analytics', icon: '📈' }] : [])
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap relative ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
              {tab.badge && tab.badge > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Enhanced Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (!members || members.length === 0) ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading team data...</p>
              <p className="text-xs text-gray-400 mt-1">Using Enhanced Services...</p>
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
            <div className="space-y-2">
              <button
                onClick={refreshTeamData}
                className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Try Again
              </button>
              <button
                onClick={async () => {
                  const cache = cacheService();
                  await cache.clearAllCaches();
                  await refetch();
                }}
                className="w-full text-red-600 hover:text-red-700 text-sm"
              >
                Clear Cache & Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Enhanced Overview Tab with null safety */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Enhanced stats using hook data with null safety */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {stats?.memberCount || (members || []).length}
                    </div>
                    <div className="text-sm text-purple-700">Members</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats?.pendingInvitations || (invitations || []).length}
                    </div>
                    <div className="text-sm text-blue-700">Pending</div>
                  </div>
                </div>

                {/* Additional stats from enhanced hook with null safety */}
                {stats && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-xl font-bold text-green-600">
                        {stats.recentActivity?.newMembersThisWeek || 0}
                      </div>
                      <div className="text-sm text-green-700">New This Week</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <div className="text-xl font-bold text-yellow-600">
                        {stats.expiringSoonInvitations || 0}
                      </div>
                      <div className="text-sm text-yellow-700">Expiring Soon</div>
                    </div>
                  </div>
                )}

                {/* Enhanced Role Distribution */}
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

                {/* Enhanced Team Details with null safety */}
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
                    {stats && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Coverage</span>
                          <span>{Math.round(((stats.memberCount || 0) / Math.max((stats.memberCount || 0) + (stats.pendingInvitations || 0), 1)) * 100)}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Activity</span>
                          <span>{(stats.recentActivity?.newMembersThisMonth || 0) > 0 ? 'Active' : 'Stable'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Enhanced Quick Actions */}
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
                  
                  {/* Cache management button */}
                  <button
                    onClick={async () => {
                      const cache = cacheService();
                      const stats = cache.getCacheStats();
                      toast.success(`Cache: ${stats.hitRate} hit rate, ${stats.size} entries`);
                    }}
                    className="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
                  >
                    View Cache Stats
                  </button>
                </div>
              </div>
            )}

            {/* Enhanced Members Tab with null safety */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Team Members</h3>
                  <span className="text-sm text-gray-500">{(members || []).length} total</span>
                </div>
                
                <div className="space-y-3">
                  {(members || []).length > 0 ? (members || []).map((member) => (
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
                          {/* Activity indicator with null safety */}
                          {stats?.recentActivity && (
                            <span className="w-2 h-2 bg-green-400 rounded-full" title="Active member"></span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                         {canViewMemberAnalytics(member) && (
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

                {/* Enhanced Pending Invitations with null safety */}
                {(invitations || []).length > 0 && (
                  <div className="border-t border-gray-200 pt-4 mt-6">
                    <h4 className="font-medium text-gray-900 mb-3">
                      Pending Invitations 
                      {(stats?.expiringSoonInvitations || 0) > 0 && (
                        <span className="text-xs text-orange-600 ml-2">
                          ({stats.expiringSoonInvitations} expiring soon)
                        </span>
                      )}
                    </h4>
                    <div className="space-y-2">
                      {(invitations || []).slice(0, 3).map((invitation) => (
                        <div key={invitation.id} className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{invitation.invitedEmail}</p>
                            <p className="text-xs text-gray-500 capitalize">{invitation.role?.replace('_', ' ') || 'employee'}</p>
                          </div>
                          <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                            Pending
                          </span>
                        </div>
                      ))}
                      {(invitations || []).length > 3 && (
                        <p className="text-xs text-gray-500 text-center">
                          +{(invitations || []).length - 3} more invitations
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Enhanced Analytics Tab with comprehensive null safety */}
            {activeTab === 'analytics' && canViewTeamAnalytics() && (
              <div className="space-y-6">
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Loading team analytics...</p>
                    </div>
                  </div>
                ) : analyticsError ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Error</h3>
                    <p className="text-sm text-gray-500 mb-4">{analyticsError}</p>
                    <button
                      onClick={fetchTeamAnalytics}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
                    >
                      Retry Analytics
                    </button>
                  </div>
                ) : teamAnalytics ? (
                  <>
                    {/* Enhanced Analytics Stats with null safety */}
                    <div className="grid grid-cols-2 gap-4">
                      <StatCard label="Total Clicks" value={teamAnalytics.totalClicks} colorClass="text-purple-600" />
                      <StatCard label="Total Views" value={teamAnalytics.totalViews} colorClass="text-blue-600" />
                      <StatCard label="Total Contacts" value={teamAnalytics.totalContacts} colorClass="text-green-600" />
                      <StatCard label="Avg Clicks/Member" value={teamAnalytics.avgClicksPerMember} colorClass="text-gray-800" />
                    </div>

                    {/* Enhanced Performance Metrics with null safety */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Team Performance</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">This Week:</span>
                          <div className="font-medium">{teamAnalytics.thisWeekClicks || 0} clicks, {teamAnalytics.thisWeekViews || 0} views</div>
                        </div>
                        <div>
                          <span className="text-gray-600">This Month:</span>
                          <div className="font-medium">{teamAnalytics.thisMonthClicks || 0} clicks, {teamAnalytics.thisMonthViews || 0} views</div>
                        </div>
                      </div>
                      {teamAnalytics.dataQuality && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <span className="text-gray-600 text-sm">Data Coverage:</span>
                          <div className="flex items-center space-x-2 mt-1">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full" 
                                style={{ width: `${teamAnalytics.dataQuality.coverage || 0}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{teamAnalytics.dataQuality.coverage || 0}%</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {teamAnalytics.dataQuality.membersWithData || 0}/{teamAnalytics.dataQuality.totalMembers || 0} members have data
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Enhanced Leaderboards with null safety */}
                    <Leaderboard 
                      title="Top Performers - Clicks" 
                      data={teamAnalytics.clickLeaderboard || []} 
                      metric="totalClicks" 
                      unit="clicks" 
                    />
                    
                    <Leaderboard 
                      title="Top Performers - Views" 
                      data={teamAnalytics.viewLeaderboard || []} 
                      metric="totalViews" 
                      unit="views" 
                    />
                    
                    <Leaderboard 
                      title="Contact Champions" 
                      data={teamAnalytics.contactLeaderboard || []} 
                      metric="contactCount" 
                      unit="contacts" 
                    />

                    {/* Top Team Links with null safety */}
                    {teamAnalytics.topTeamLinks && teamAnalytics.topTeamLinks.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Top Team Links</h3>
                        <div className="space-y-2">
                          {teamAnalytics.topTeamLinks.slice(0, 5).map((link, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {link.title || link.url || 'Link'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  by {link.ownerName || 'Unknown'}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-gray-800">{link.totalClicks || 0}</div>
                                <div className="text-xs text-gray-500">clicks</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Traffic Sources with null safety */}
                    {teamAnalytics.teamTrafficSources && Object.keys(teamAnalytics.teamTrafficSources).length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Team Traffic Sources</h3>
                        <div className="space-y-2">
                          {Object.entries(teamAnalytics.teamTrafficSources)
                            .sort(([,a], [,b]) => (b.clicks || 0) - (a.clicks || 0))
                            .slice(0, 5)
                            .map(([source, data]) => (
                              <div key={source} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium capitalize">{source.replace('_', ' ')}</span>
                                <div className="text-sm text-gray-600">
                                  {data.clicks || 0} clicks, {data.views || 0} views
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}

                    {/* Analytics refresh controls */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        Last updated: {teamAnalytics.lastUpdated ? 
                          new Date(teamAnalytics.lastUpdated).toLocaleString() : 
                          'Just now'
                        }
                      </span>
                      <button
                        onClick={fetchTeamAnalytics}
                        disabled={analyticsLoading}
                        className="text-purple-600 hover:text-purple-700 disabled:text-gray-400"
                      >
                        Refresh Analytics
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Analytics data is not available for this team yet.
                    </p>
                    <button
                      onClick={fetchTeamAnalytics}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    >
                      Load Analytics
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}