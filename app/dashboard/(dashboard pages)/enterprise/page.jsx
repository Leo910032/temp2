// ✅ FIXED: Main Enterprise Page Component
"use client"
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from 'react-hot-toast';
import TeamManagementModal from './components/TeamManagementModal';
import CreateTeamModal from './components/CreateTeamModal';
import TeamPreview from './components/TeamPreview';
import PendingInvitationsBanner from './components/PendingInvitationsBanner';

// ✅ PHASE 3: Enhanced Services - Updated imports
import { 
  subscriptionService,
  teamService,
  cacheService,
  initializeServices,
  checkServiceHealth,
  useEnterpriseData,
  ErrorHandler
} from '@/lib/services/serviceEnterprise';

// ✅ Import constants
import {
  TEAM_ROLES,
  PERMISSIONS,
  ORGANIZATION_ROLES
} from '@/lib/services/serviceEnterprise';

export default function EnhancedEnterprisePage() {
  const { currentUser } = useAuth();
  
  // ✅ PHASE 3: Use the Enhanced Services hook instead of manual state management
  const {
    teams,
    userRole,
    organizationId,
    organizationName,
    hasAccess,
    subscriptionLevel,
    features,
    userContext,
    loading,
    error,
    refetch,
    hasFeature,
    canPerformAction
  } = useEnterpriseData();
  
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isManageModalOpen, setManageModalOpen] = useState(false);
  const [serviceHealth, setServiceHealth] = useState(null);

  // ✅ PHASE 3: Initialize services on component mount
  useEffect(() => {
    const initServices = async () => {
      try {
        await initializeServices();
        const health = await checkServiceHealth();
        setServiceHealth(health);
        console.log('✅ Enhanced services initialized:', health);
      } catch (error) {
        console.warn('⚠️ Service initialization warning:', error.message);
      }
    };

    initServices();
  }, []);

  // ✅ Auto-select first team when teams load
  useEffect(() => {
    if (teams.length > 0 && !selectedTeam) {
      setSelectedTeam(teams[0]);
    }
  }, [teams, selectedTeam]);

  // ✅ PHASE 3: Enhanced team creation using new service with better error handling
  const handleCreateTeam = async (teamName, description) => {
    if (!currentUser) {
      toast.error('User not authenticated');
      return false;
    }

    const toastId = toast.loading('Creating team...');
    
    try {
      console.log('🚀 Creating team with Enhanced Services...');
      
      // Use the enhanced team service
      const team = teamService();
      const result = await team.createTeam({ 
        name: teamName?.trim(), 
        description: description?.trim() || '' 
      });
      
      console.log('✅ Team created successfully:', result);
      toast.success('Team created successfully!', { id: toastId });
      setCreateModalOpen(false);
      
      // Refresh data using the hook's refetch method
      await refetch();
      
      // Auto-select the newly created team if possible
      if (result.id) {
        const newTeam = { id: result.id, name: teamName, description };
        setSelectedTeam(newTeam);
      }
      
      return true;
      
    } catch (err) {
      console.error('❌ Create team error:', err);
      const handledError = ErrorHandler.handle(err, 'createTeam');
      toast.error(handledError.message, { id: toastId });
      return false;
    }
  };

  // ✅ PHASE 3: Enhanced team management with cache optimization
  const handleTeamUpdated = useCallback(async () => {
    console.log('🔄 Team updated - refreshing data...');
    
    try {
      // Clear relevant caches for better performance
      const cache = cacheService();
      await cache.clearTeamCaches(selectedTeam?.id);
      
      // Refresh data
      await refetch();
      
      console.log('✅ Team data refreshed after update');
    } catch (error) {
      console.warn('⚠️ Warning: Could not refresh data after team update:', error.message);
      // Still try to refresh using the hook
      await refetch();
    }
  }, [selectedTeam?.id, refetch]);

  // ✅ PHASE 3: Enhanced permission checking using server-validated data
  const canCreateTeams = canPerformAction('create_team');
  
  const getUserTeamRole = (teamId) => {
    if (!userContext || !teamId) return 'employee';
    
    // Check if user is organization owner (highest priority)
    if (userContext.organizationRole === 'owner') {
      return 'owner';
    }
    
    // Get team-specific role from server data
    const teamData = userContext.teams?.[teamId];
    return teamData?.role || 'employee';
  };

  const canManageTeam = (teamId) => {
    if (!teamId) return false;
    
    // Use enhanced permission checking
    const teamRole = getUserTeamRole(teamId);
    return ['owner', 'manager'].includes(teamRole) || 
           canPerformAction('update_member_role', { teamId }) ||
           canPerformAction('invite_member', { teamId });
  };

  // ✅ Team selection handlers
  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
  };

  const openManageModal = (team) => {
    setSelectedTeam(team);
    setManageModalOpen(true);
  };

  // ✅ PHASE 3: Enhanced access control with better messaging
  if (!loading && !hasAccess) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0l3-3m-3 3l-3-3m3 3V9a6 6 0 00-12 0v3" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
              Enterprise Access Required
            </h3>
            <p className="text-yellow-700 mb-2">
              Current plan: <span className="font-medium capitalize">{subscriptionLevel}</span>
            </p>
            <p className="text-yellow-700 mb-4">
              You need an Enterprise subscription to access enterprise team management features.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.href = '/pricing'}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Upgrade to Enterprise
              </button>
              <button
                onClick={refetch}
                className="w-full text-yellow-600 hover:text-yellow-700 text-sm"
              >
                Check Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced loading state
  if (loading) { 
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading enterprise data...</p>
          <p className="text-sm text-gray-400 mt-2">Initializing Enhanced Services...</p>
        </div>
      </div>
    ); 
  }

  // Enhanced error state
  if (error && hasAccess) { 
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Unable to Load Enterprise Data
            </h3>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={refetch}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
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
        </div>
      </div>
    );
  }
  
  // Enhanced empty state messages
  const getEmptyStateMessage = () => {
    if (!organizationId) {
      return {
        title: "Not part of an organization",
        description: "You need to be invited to an organization to access enterprise features.",
        action: "Contact Support"
      };
    }
    
    if (canCreateTeams) {
      return {
        title: "No teams created yet",
        description: "Get started by creating your first team to organize your organization's members.",
        action: "Create Team"
      };
    }
    
    return {
      title: "You are not assigned to any teams",
      description: "Contact your organization manager to be added to a team or to get team creation permissions.",
      action: "Contact Manager"
    };
  };

  const emptyState = getEmptyStateMessage();

  return (
    <div className="flex-1 flex">
      {/* Main Content */}
      <div className="flex-1 py-4 px-6 flex flex-col max-h-full overflow-y-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Enhanced Enterprise Dashboard</h1>
            <PendingInvitationsBanner />

            <div className="text-gray-600">
              <p>Your organization's teams and members.</p>
              <div className="text-sm mt-1 space-y-1">
                {userRole && (
                  <p>
                    Role: <span className="font-medium capitalize">{userRole.replace('_', ' ')}</span>
                    {organizationId && (
                      <span className="text-gray-400 ml-2">
                        • Organization: {organizationName || organizationId}
                      </span>
                    )}
                  </p>
                )}
                <p>
                  Plan: <span className="font-medium capitalize">{subscriptionLevel}</span>
                  {features.length > 0 && (
                    <span className="text-gray-400 ml-2">• {features.length} enterprise features</span>
                  )}
                </p>
                
                {/* Enhanced service status */}
                {serviceHealth && (
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-green-600">✅ Enhanced Services Active</span>
                    <span className="text-gray-400">
                      ({Object.values(serviceHealth).filter(s => s.healthy).length}/{Object.keys(serviceHealth).length} services healthy)
                    </span>
                  </div>
                )}
                
                {/* Debug info in development */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded">
                    <p>Debug: {teams.length} teams loaded | UserContext: {userContext ? 'Available' : 'Missing'}</p>
                    <p>Can Create Teams: {canCreateTeams ? '✅' : '❌'} | Services: {serviceHealth ? Object.keys(serviceHealth).join(', ') : 'Loading...'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          {canCreateTeams && (
            <button 
              onClick={() => setCreateModalOpen(true)} 
              className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
            >
              Create New Team
            </button>
          )}
        </header>

        <main className="space-y-4">
          {teams.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="max-w-sm mx-auto">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {emptyState.title}
                </h3>
                <p className="text-gray-500 mb-4">
                  {emptyState.description}
                </p>
                {canCreateTeams ? (
                  <button
                    onClick={() => setCreateModalOpen(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Create Your First Team
                  </button>
                ) : (
                  <div className="text-xs text-gray-400 mt-2">
                    Current role: {userRole || 'Member'} • Requires: Manager+ permissions
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  Teams ({teams.length})
                  {selectedTeam && (
                    <span className="text-purple-600 ml-2">
                      • {selectedTeam.name} selected
                    </span>
                  )}
                </h2>
                {canCreateTeams && teams.length > 0 && (
                  <button 
                    onClick={() => setCreateModalOpen(true)} 
                    className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-md hover:bg-purple-200 transition-colors"
                  >
                    + Add Team
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(team => (
                  <EnhancedTeamCard 
                    key={team.id || team.name} 
                    team={team} 
                    onSelect={handleTeamSelect}
                    onManage={() => openManageModal(team)} 
                    canManage={canManageTeam(team.id)}
                    userRole={getUserTeamRole(team.id)}
                    userContext={userContext}
                    isSelected={selectedTeam?.id === team.id}
                  />
                ))}
              </div>
            </>
          )}
        </main>

        {/* Enhanced service status indicator */}
        {hasAccess && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-green-800 text-sm font-medium">
                  Enhanced Services v3.0 Active
                </span>
                <span className="text-green-600 text-sm ml-2">
                  • {features.length} features • Server-validated permissions
                </span>
              </div>
              
              {/* Cache management controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={async () => {
                    const cache = cacheService();
                    const stats = cache.getCacheStats();
                    toast.success(`Cache: ${stats.hitRate} hit rate, ${stats.size} entries`);
                  }}
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  Cache Stats
                </button>
                <button
                  onClick={async () => {
                    const cache = cacheService();
                    await cache.optimizeCache();
                    toast.success('Cache optimized');
                  }}
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  Optimize
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {canCreateTeams && (
          <CreateTeamModal 
            isOpen={isCreateModalOpen} 
            onClose={() => setCreateModalOpen(false)} 
            onSubmit={handleCreateTeam} 
          />
        )}
        
        {selectedTeam && canManageTeam(selectedTeam.id) && (
          <TeamManagementModal 
            isOpen={isManageModalOpen}
            onClose={() => setManageModalOpen(false)}
            teamId={selectedTeam.id}
            teamName={selectedTeam.name}
            onTeamUpdated={handleTeamUpdated}
          />
        )}
      </div>

      {/* Team Preview Sidebar */}
      <TeamPreview 
        selectedTeam={selectedTeam}
        onManageTeam={openManageModal}
        userContext={userContext}
        canManage={selectedTeam ? canManageTeam(selectedTeam.id) : false}
      />
    </div>
  );
}

// ✅ FIXED: Enhanced TeamCard component with proper null safety
function EnhancedTeamCard({ team, onSelect, onManage, canManage, userRole, userContext, isSelected }) {
  const [teamStats, setTeamStats] = useState(null);

  // ✅ Load team statistics using enhanced services
  useEffect(() => {
    const loadTeamStats = async () => {
      if (!team.id) return;
      
      try {
        const stats = await teamService().getTeamStats(team.id);
        setTeamStats(stats);
      } catch (error) {
        console.warn('Could not load team stats:', error.message);
      }
    };

    loadTeamStats();
  }, [team.id]);

  const roleColors = {
    owner: 'bg-red-100 text-red-800',
    manager: 'bg-purple-100 text-purple-800',
    team_lead: 'bg-blue-100 text-blue-800',
    employee: 'bg-gray-100 text-gray-700'
  };

  return (
    <div 
      className={`bg-white rounded-lg border shadow-sm p-4 flex flex-col hover:shadow-md transition-all cursor-pointer relative ${
        isSelected ? 'ring-2 ring-purple-500 border-purple-300 bg-purple-50' : ''
      }`}
      onClick={() => onSelect(team)}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="flex justify-between items-start mb-2 pr-8">
        <h3 className="font-bold text-lg text-gray-900">{team.name || 'Unnamed Team'}</h3>
        {userRole && (
          <span className={`text-xs px-2 py-1 rounded-full capitalize ${roleColors[userRole] || roleColors.employee}`}>
            {userRole.replace('_', ' ')}
          </span>
        )}
      </div>
      
      <p className="text-sm text-gray-600 mt-1 flex-1 min-h-[40px]">
        {team.description || 'No description provided.'}
      </p>
      
      <div className="mt-4 text-sm text-gray-500 space-y-1">
        <div className="flex justify-between items-center">
          <span>
            {teamStats?.memberCount || team.memberCount || Object.keys(team.members || {}).length || 0} Members
            {teamStats?.pendingInvitations > 0 && (
              <span className="text-xs text-orange-600 ml-1">
                (+{teamStats.pendingInvitations} pending)
              </span>
            )}
          </span>
          <div className="flex space-x-1">
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
              Active
            </span>
            {/* ✅ FIXED: Added null safety for recentActivity */}
            {teamStats?.recentActivity?.newMembersThisWeek > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                +{teamStats.recentActivity.newMembersThisWeek} this week
              </span>
            )}
          </div>
        </div>
        
        {/* Enhanced team statistics with null safety */}
        {teamStats && (
          <div className="text-xs text-gray-400 space-y-1">
            {teamStats.invitationCount > 0 && (
              <div>Invitations: {teamStats.invitationCount} ({teamStats.expiringSoonInvitations || 0} expiring soon)</div>
            )}
            {teamStats.roleDistribution && Object.keys(teamStats.roleDistribution).length > 0 && (
              <div>
                Roles: {Object.entries(teamStats.roleDistribution).map(([role, count]) => 
                  `${count} ${role}${count > 1 ? 's' : ''}`
                ).join(', ')}
              </div>
            )}
          </div>
        )}
        
        {team.createdAt && (
          <div className="text-xs text-gray-400">
            Created: {new Date(team.createdAt.toDate ? team.createdAt.toDate() : team.createdAt).toLocaleDateString()}
          </div>
        )}
        
        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-blue-500 bg-blue-50 p-1 rounded">
            Can Manage: {canManage ? '✅' : '❌'} | Role: {userRole} | Selected: {isSelected ? '✅' : '❌'}
            {teamStats && <div>Stats loaded: ✅</div>}
          </div>
        )}
      </div>
      
      {/* Action button */}
      <div className="mt-4 border-t pt-4">
        {canManage ? (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onManage();
            }}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Manage Team
          </button>
        ) : (
          <div className="text-xs text-gray-400 text-center py-2">
            {userRole === 'employee' ? 'View only access' : 'Limited permissions'}
          </div>
        )}
      </div>
    </div>
  );
}