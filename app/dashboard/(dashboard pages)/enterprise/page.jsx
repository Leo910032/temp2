"use client"
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from 'react-hot-toast';
import FixedTeamManagementModal from './components/TeamManagementModal';
import CreateTeamModal from './components/CreateTeamModal';
import TeamPreview from './components/TeamPreview';
import PendingInvitationsBanner from './components/PendingInvitationsBanner';

// ✅ PHASE 3: Updated imports using the new enhanced services
import { 
  subscriptionService,
  teamService,
  ServiceFactory,
  ErrorHandler
} from '@/lib/services/serviceEnterprise/client/enhanced-index';

// ✅ Import constants
import {
  TEAM_ROLES,
  PERMISSIONS,
  ORGANIZATION_ROLES
} from '@/lib/services/serviceEnterprise/constants/enterpriseConstants';

export default function FixedEnterprisePage() {
  const { currentUser } = useAuth();
  
  // ✅ PHASE 3: Enhanced state management
  const [enterpriseData, setEnterpriseData] = useState({
    teams: [],
    userRole: null,
    organizationId: null,
    organizationName: null,
    hasAccess: false,
    subscriptionLevel: 'free',
    features: [],
    operationPermissions: {},
    userContext: null
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isManageModalOpen, setManageModalOpen] = useState(false);

  // ✅ PHASE 3: Enhanced data fetching using new services
  const fetchEnterpriseData = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🚀 Fetching enterprise data with Phase 3 services...');

      // Use the enhanced services from Phase 3
      const subscription = subscriptionService();
      const team = teamService();

      // Fetch data in parallel using the new service architecture
      const [subscriptionStatus, teams, permissions] = await Promise.allSettled([
        subscription.getStatusWithRetry(3), // Enhanced retry logic
        team.getUserTeams(),
        subscription.getOperationPermissions()
      ]);

      // Process subscription data
      const subData = subscriptionStatus.status === 'fulfilled' ? subscriptionStatus.value : null;
      const teamsData = teams.status === 'fulfilled' ? teams.value : { teams: [] };
      const permsData = permissions.status === 'fulfilled' ? permissions.value : { permissions: {} };

      // ✅ Extract user context from subscription data (server-validated)
      const userContext = subData?.user || null;
      
      // ✅ Determine highest role from server data
      let effectiveRole = 'employee';
      if (userContext) {
        if (userContext.role === 'owner' || userContext.organizationRole === 'owner') {
          effectiveRole = 'owner';
        } else if (userContext.role === 'manager' || userContext.organizationRole === 'manager') {
          effectiveRole = 'manager';
        } else {
          // Find highest team role
          const teamRoles = Object.values(userContext.teams || {}).map(team => team.role);
          if (teamRoles.includes('manager')) effectiveRole = 'manager';
          else if (teamRoles.includes('team_lead')) effectiveRole = 'team_lead';
        }
      }

      const newData = {
        teams: Array.isArray(teamsData.teams) ? teamsData.teams : [],
        userRole: effectiveRole,
        organizationId: subData?.organization?.id || teamsData.organizationId,
        organizationName: subData?.organization?.name || teamsData.organizationName,
        hasAccess: subData?.hasEnterpriseAccess || false,
        subscriptionLevel: subData?.accountType || 'free',
        features: subData?.enterpriseFeatures || [],
        operationPermissions: permsData.permissions || {},
        userContext: userContext
      };

      setEnterpriseData(newData);

      console.log('✅ Enterprise data loaded:', {
        hasAccess: newData.hasAccess,
        teamsCount: newData.teams.length,
        userRole: newData.userRole,
        subscriptionLevel: newData.subscriptionLevel,
        hasUserContext: !!newData.userContext
      });

      // Auto-select first team
      if (newData.teams.length > 0 && !selectedTeam) {
        setSelectedTeam(newData.teams[0]);
      }

    } catch (err) {
      console.error('❌ Error fetching enterprise data:', err);
      const handledError = ErrorHandler.handle(err, 'fetchEnterpriseData');
      setError(handledError.message);
      
      if (handledError.redirectToLogin) {
        // Handle auth redirect if needed
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser, selectedTeam]);

  // ✅ Initial data load
  useEffect(() => {
    fetchEnterpriseData();
  }, [fetchEnterpriseData]);

  // ✅ PHASE 3: Enhanced team creation using new service
  const handleCreateTeam = async (teamName, description) => {
    if (!currentUser) {
      toast.error('User not authenticated');
      return false;
    }

    const toastId = toast.loading('Creating team...');
    try {
      const team = teamService();
      const result = await team.createTeam({ 
        name: teamName?.trim(), 
        description: description?.trim() || '' 
      });
      
      toast.success('Team created successfully!', { id: toastId });
      setCreateModalOpen(false);
      
      // Refresh data after successful creation
      setTimeout(async () => {
        await fetchEnterpriseData();
      }, 500);
      
      return true;
      
    } catch (err) {
      console.error('Create team error:', err);
      const handledError = ErrorHandler.handle(err, 'createTeam');
      toast.error(handledError.message, { id: toastId });
      return false;
    }
  };

  // ✅ Team selection handler
  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
  };

  const openManageModal = (team) => {
    setSelectedTeam(team);
    setManageModalOpen(true);
  };

  // ✅ PHASE 3: Server-validated permission checking
  const canPerformOperation = (operation) => {
    return enterpriseData.operationPermissions[operation]?.allowed || false;
  };

  const getUserTeamRole = (teamId) => {
    if (!enterpriseData.userContext || !teamId) return 'employee';
    
    // Check if user is organization owner (highest priority)
    if (enterpriseData.userContext.organizationRole === 'owner') {
      return 'owner';
    }
    
    // Get team-specific role from server data
    const teamData = enterpriseData.userContext.teams?.[teamId];
    return teamData?.role || 'employee';
  };

  const canManageTeam = (teamId) => {
    if (!teamId) return false;
    
    // Use server-validated permissions
    const teamRole = getUserTeamRole(teamId);
    return ['owner', 'manager'].includes(teamRole) || 
           canPerformOperation('update_member_role') ||
           canPerformOperation('invite_member');
  };

  // ✅ Access control handling (unchanged)
  if (!loading && !enterpriseData.hasAccess) {
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
              Current plan: <span className="font-medium capitalize">{enterpriseData.subscriptionLevel}</span>
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
                onClick={fetchEnterpriseData}
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

  // Loading state
  if (loading) { 
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading enterprise data...</p>
        </div>
      </div>
    ); 
  }

  // Error state
  if (error && enterpriseData.hasAccess) { 
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Unable to Load Enterprise Data
            </h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchEnterpriseData}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ PHASE 3: Server-validated permission checks
  const canCreateTeams = canPerformOperation('create_team');
  
  // Enhanced empty state messages
  const getEmptyStateMessage = () => {
    if (!enterpriseData.organizationId) {
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
            <h1 className="text-2xl font-bold text-gray-900">Enterprise Dashboard</h1>
            <PendingInvitationsBanner />

            <div className="text-gray-600">
              <p>Your organization's teams and members.</p>
              <div className="text-sm mt-1 space-y-1">
                {enterpriseData.userRole && (
                  <p>
                    Role: <span className="font-medium capitalize">{enterpriseData.userRole.replace('_', ' ')}</span>
                    {enterpriseData.organizationId && (
                      <span className="text-gray-400 ml-2">
                        • Organization: {enterpriseData.organizationName || enterpriseData.organizationId}
                      </span>
                    )}
                  </p>
                )}
                <p>
                  Plan: <span className="font-medium capitalize">{enterpriseData.subscriptionLevel}</span>
                  {enterpriseData.features.length > 0 && (
                    <span className="text-gray-400 ml-2">• {enterpriseData.features.length} enterprise features</span>
                  )}
                </p>
                {/* Debug info in development */}
                {process.env.NODE_ENV === 'development' && (
                  <p className="text-xs text-gray-400">
                    Debug: {enterpriseData.teams.length} teams loaded | UserContext: {enterpriseData.userContext ? 'Available' : 'Missing'}
                    {enterpriseData.userContext && ` | Org Role: ${enterpriseData.userContext.organizationRole || 'None'}`}
                    | Can Create Teams: {canCreateTeams ? '✅' : '❌'}
                  </p>
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
          {enterpriseData.teams.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="max-w-sm mx-auto">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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
                    Current role: {enterpriseData.userRole || 'Member'} • Requires: Manager+ permissions
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  Teams ({enterpriseData.teams.length})
                  {selectedTeam && (
                    <span className="text-purple-600 ml-2">
                      • {selectedTeam.name} selected
                    </span>
                  )}
                </h2>
                {canCreateTeams && enterpriseData.teams.length > 0 && (
                  <button 
                    onClick={() => setCreateModalOpen(true)} 
                    className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-md hover:bg-purple-200 transition-colors"
                  >
                    + Add Team
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {enterpriseData.teams.map(team => (
                  <FixedTeamCard 
                    key={team.id || team.name} 
                    team={team} 
                    onSelect={handleTeamSelect}
                    onManage={() => openManageModal(team)} 
                    canManage={canManageTeam(team.id)}
                    userRole={getUserTeamRole(team.id)}
                    userContext={enterpriseData.userContext}
                    isSelected={selectedTeam?.id === team.id}
                  />
                ))}
              </div>
            </>
          )}
        </main>

        {/* Service health indicator */}
        {enterpriseData.hasAccess && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-green-800 text-sm font-medium">
                Phase 3 services active
              </span>
              <span className="text-green-600 text-sm ml-2">
                • {enterpriseData.features.length} features • Server-validated permissions
              </span>
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
          <FixedTeamManagementModal 
            isOpen={isManageModalOpen}
            onClose={() => setManageModalOpen(false)}
            teamId={selectedTeam.id}
            teamName={selectedTeam.name}
            // ✅ Pass refresh callback for cache invalidation
            onTeamUpdated={fetchEnterpriseData}
          />
        )}
      </div>

      {/* Team Preview Sidebar */}
      <TeamPreview 
        selectedTeam={selectedTeam}
        onManageTeam={openManageModal}
        userContext={enterpriseData.userContext}
        canManage={selectedTeam ? canManageTeam(selectedTeam.id) : false}
      />
    </div>
  );
}

// ✅ PHASE 3: Enhanced TeamCard component
function FixedTeamCard({ team, onSelect, onManage, canManage, userRole, userContext, isSelected }) {
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
        <div className="flex justify-between">
          <span>{team.memberCount || Object.keys(team.members || {}).length || 0} Members</span>
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
            Active
          </span>
        </div>
        {team.createdAt && (
          <div className="text-xs text-gray-400">
            Created: {new Date(team.createdAt.toDate ? team.createdAt.toDate() : team.createdAt).toLocaleDateString()}
          </div>
        )}
        
        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-blue-500">
            Can Manage: {canManage ? '✅' : '❌'} | Role: {userRole} | Selected: {isSelected ? '✅' : '❌'}
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