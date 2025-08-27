"use client"
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from 'react-hot-toast';
import FixedTeamManagementModal from './components/TeamManagementModal';
import CreateTeamModal from './components/CreateTeamModal';
import TeamPreview from './components/TeamPreview';  // ✅ Import the new component
import PendingInvitationsBanner from './components/PendingInvitationsBanner';

// ✅ Clean imports using the updated enterprise service
import { 
  useEnterpriseData, 
  createTeam,
} from '@serviceEnterprise';

// ✅ Import the proper constants for permission checking
import {
  TEAM_ROLES,
  PERMISSIONS,
  DEFAULT_PERMISSIONS_BY_ROLE
} from '@/lib/services/serviceEnterprise/constants/enterpriseConstants';

export default function FixedEnterprisePage() {
    const { currentUser } = useAuth();
    
    // ✅ Use the updated hook with user context support
    const {
        teams,
        userRole,
        organizationId,
        organizationName,
        hasAccess,
        subscriptionLevel,
        features,
        userContext, // ✅ User context for permissions
        loading,
        error,
        refetch
    } = useEnterpriseData();

    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null);  // ✅ State for selected team
    const [isManageModalOpen, setManageModalOpen] = useState(false);

    // ✅ Debug: Log received data
    useEffect(() => {
        console.log('🔍 Enterprise Page Data:', {
            teams,
            teamsType: typeof teams,
            teamsIsArray: Array.isArray(teams),
            teamsLength: teams?.length,
            userRole,
            organizationId,
            organizationName,
            hasAccess,
            subscriptionLevel,
            features,
            hasUserContext: !!userContext
        });
    }, [teams, userRole, organizationId, organizationName, hasAccess, subscriptionLevel, features, userContext]);

    // ✅ Auto-select first team when teams load
    useEffect(() => {
        const safeTeams = Array.isArray(teams) ? teams : [];
        
        // Auto-select first team if:
        // 1. Teams are loaded and not empty
        // 2. No team is currently selected
        // 3. Not in loading state
        if (safeTeams.length > 0 && !selectedTeam && !loading) {
            console.log('🎯 Auto-selecting first team:', safeTeams[0].name);
            setSelectedTeam(safeTeams[0]);
        }
    }, [teams, selectedTeam, loading]);

    const handleCreateTeam = async (teamName, description) => {
        if (!currentUser) {
            toast.error('User not authenticated');
            return false;
        }

        const toastId = toast.loading('Creating team...');
        try {
            const result = await createTeam({ 
                name: teamName?.trim(), 
                description: description?.trim() || '' 
            });
            
            toast.success('Team created successfully!', { id: toastId });
            setCreateModalOpen(false);
            
            // ✅ Wait a bit before reloading to allow DB time
            setTimeout(async () => {
                await refetch();
            }, 500);
            
            return true;
            
        } catch (err) {
            console.error('Create team error:', err);
            toast.error(err.message, { id: toastId });
            return false;
        }
    };

    // ✅ Handle team selection
    const handleTeamSelect = (team) => {
        setSelectedTeam(team);
    };

    const openManageModal = (team) => {
        setSelectedTeam(team);
        setManageModalOpen(true);
    };

    // ✅ Enhanced permission checking functions using proper constants
    const hasPermission = (permission, teamId = null) => {
        if (!userContext) return false;
        
        // Get effective role for this team
        const effectiveRole = teamId ? getUserTeamRole(teamId) : getHighestRole();
        
        // Get custom permissions for this team (if any)
        const teamData = userContext.teams?.[teamId];
        const customPermissions = teamData?.permissions || {};
        
        // Check custom permission first, then fall back to role defaults
        if (customPermissions.hasOwnProperty(permission)) {
            return customPermissions[permission];
        }
        
        // Fall back to default role permissions
        const rolePermissions = DEFAULT_PERMISSIONS_BY_ROLE[effectiveRole] || {};
        return rolePermissions[permission] || false;
    };

    const getUserTeamRole = (teamId) => {
        if (!userContext) return TEAM_ROLES.EMPLOYEE;
        
        // Check if user is organization owner (highest priority)
        if (userContext.organizationRole === 'owner') {
            return TEAM_ROLES.OWNER;
        }
        
        // Get team-specific role
        const teamData = userContext.teams?.[teamId];
        return teamData?.role || TEAM_ROLES.EMPLOYEE;
    };

    const getHighestRole = () => {
        if (!userContext) return TEAM_ROLES.EMPLOYEE;
        
        // Organization owner always has highest role
        if (userContext.organizationRole === 'owner') {
            return TEAM_ROLES.OWNER;
        }
        
        // Find highest team role
        const teamRoles = Object.values(userContext.teams || {}).map(team => team.role);
        
        if (teamRoles.length === 0) {
            return TEAM_ROLES.EMPLOYEE;
        }
        
        // Return the highest role based on hierarchy
        const roleHierarchy = { owner: 4, manager: 3, team_lead: 2, employee: 1 };
        return teamRoles.reduce((highest, current) => {
            const currentLevel = roleHierarchy[current] || 0;
            const highestLevel = roleHierarchy[highest] || 0;
            return currentLevel > highestLevel ? current : highest;
        }, TEAM_ROLES.EMPLOYEE);
    };

    // ✅ Check if user can manage a specific team
    const canManageTeam = (teamId) => {
        return hasPermission(PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS, teamId) ||
               hasPermission(PERMISSIONS.CAN_INVITE_TEAM_MEMBERS, teamId) ||
               hasPermission(PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS, teamId) ||
               hasPermission(PERMISSIONS.CAN_UPDATE_MEMBER_ROLES, teamId);
    };

    // ✅ Access control handling
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
    if (error && hasAccess) { 
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-red-800 mb-2">
                            Unable to Load Enterprise Data
                        </h3>
                        <p className="text-red-600 mb-4">{error}</p>
                        <button
                            onClick={refetch}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ✅ Permission checks based on user context and proper constants
    const canCreateTeams = hasPermission(PERMISSIONS.CAN_CREATE_TEAMS);
    
    // ✅ CRITICAL CORRECTION: Ensure teams is always an array
    const safeTeams = Array.isArray(teams) ? teams : [];
    
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

                        <h1 className="text-2xl font-bold text-gray-900">Enterprise Dashboard</h1>
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
                                {/* ✅ Debug info in development */}
                                {process.env.NODE_ENV === 'development' && (
                                    <p className="text-xs text-gray-400">
                                        Debug: {safeTeams.length} teams loaded (type: {typeof teams}) | UserContext: {userContext ? 'Available' : 'Missing'}
                                        {userContext && ` | Org Role: ${userContext.organizationRole || 'None'}`}
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
                    {safeTeams.length === 0 ? (
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
                                        Current role: {userRole || 'Member'} • Requires: Manager+ permissions
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Teams ({safeTeams.length})
                                    {selectedTeam && (
                                        <span className="text-purple-600 ml-2">
                                            • {selectedTeam.name} selected
                                        </span>
                                    )}
                                </h2>
                                {canCreateTeams && safeTeams.length > 0 && (
                                    <button 
                                        onClick={() => setCreateModalOpen(true)} 
                                        className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-md hover:bg-purple-200 transition-colors"
                                    >
                                        + Add Team
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {safeTeams.map(team => (
                                    <FixedTeamCard 
                                        key={team.id || team.name} 
                                        team={team} 
                                        onSelect={handleTeamSelect}  // ✅ Add selection handler
                                        onManage={() => openManageModal(team)} 
                                        canManage={canManageTeam(team.id)}
                                        userRole={userRole}
                                        userContext={userContext}
                                        isSelected={selectedTeam?.id === team.id}  // ✅ Add selection state
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </main>

                {/* ✅ Feature availability indicator */}
                {hasAccess && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-green-800 text-sm font-medium">
                                Enterprise features active
                            </span>
                            <span className="text-green-600 text-sm ml-2">
                                • {features.length} features available
                            </span>
                            {userContext && (
                                <span className="text-green-600 text-sm ml-2">
                                    • Permissions loaded
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* ✅ User Context Status Indicator (Development only) */}
                {process.env.NODE_ENV === 'development' && (
                    <div className={`mt-2 p-3 border rounded-lg ${userContext ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-center text-sm">
                            <span className={userContext ? 'text-blue-800' : 'text-red-800'}>
                                User Context: {userContext ? 'Loaded' : 'Missing'}
                            </span>
                            {userContext && (
                                <span className="text-blue-600 ml-2">
                                    • Org Role: {userContext.organizationRole || 'None'} 
                                    • Teams: {Object.keys(userContext.teams || {}).length}
                                    • Can Create Teams: {canCreateTeams ? '✅' : '❌'}
                                </span>
                            )}
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
                
                {/* ✅ Updated modal - only show if user can manage this specific team */}
                {selectedTeam && canManageTeam(selectedTeam.id) && (
                    <FixedTeamManagementModal 
                        isOpen={isManageModalOpen}
                        onClose={() => setManageModalOpen(false)}
                        teamId={selectedTeam.id}
                        teamName={selectedTeam.name}
                    />
                )}
            </div>

            {/* ✅ Team Preview Sidebar - Replaces the Profile Preview */}
            <TeamPreview 
                selectedTeam={selectedTeam}
                onManageTeam={openManageModal}
                userContext={userContext}
            />
        </div>
    );
}

// ✅ Enhanced TeamCard component with selection functionality
function FixedTeamCard({ team, onSelect, onManage, canManage, userRole, userContext, isSelected }) {
    // ✅ Enhanced team role detection
    const getTeamRoleDisplay = () => {
        if (team.role) return team.role;
        if (team.isOwner) return 'owner';
        if (team.managerId === team.currentUserId) return 'manager';
        return 'member';
    };

    const teamRole = getTeamRoleDisplay();

    // ✅ Get user's role for this specific team
    const getUserTeamRole = () => {
        if (!userContext || !team.id) return 'employee';
        
        // Check if user is organization owner
        if (userContext.organizationRole === 'owner') {
            return 'owner';
        }
        
        // Get team-specific role
        const teamData = userContext.teams?.[team.id];
        return teamData?.role || 'employee';
    };

    const userTeamRole = getUserTeamRole();

    return (
        <div 
            className={`bg-white rounded-lg border shadow-sm p-4 flex flex-col hover:shadow-md transition-all cursor-pointer ${
                isSelected ? 'ring-2 ring-purple-500 border-purple-300 bg-purple-50' : ''
            }`}
            onClick={() => onSelect(team)}  // ✅ Handle team selection
        >
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-900">{team.name || 'Unnamed Team'}</h3>
                <div className="flex flex-col gap-1">
                    {team.isOwner && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            Owner
                        </span>
                    )}
                    {userTeamRole && (
                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                            userTeamRole === 'owner' ? 'bg-red-100 text-red-800' :
                            userTeamRole === 'manager' ? 'bg-purple-100 text-purple-800' :
                            userTeamRole === 'team_lead' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-700'
                        }`}>
                            {userTeamRole.replace('_', ' ')}
                        </span>
                    )}
                </div>
            </div>
            
            <p className="text-sm text-gray-600 mt-1 flex-1 min-h-[40px]">
                {team.description || 'No description provided.'}
            </p>
            
            <div className="mt-4 text-sm text-gray-500 space-y-1">
                <div className="flex justify-between">
                    <span>{team.memberCount || Object.keys(team.members || {}).length || 0} Members</span>
                    {team.status && (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                            team.status === 'active' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-yellow-100 text-yellow-700'
                        }`}>
                            {team.status}
                        </span>
                    )}
                </div>
                {team.createdAt && (
                    <div className="text-xs text-gray-400">
                        Created: {new Date(team.createdAt.toDate ? team.createdAt.toDate() : team.createdAt).toLocaleDateString()}
                    </div>
                )}
                {team.lastModified && (
                    <div className="text-xs text-gray-400">
                        Modified: {new Date(team.lastModified.toDate ? team.lastModified.toDate() : team.lastModified).toLocaleDateString()}
                    </div>
                )}
                {/* ✅ Show selection and permission indicator */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-blue-500">
                        Can Manage: {canManage ? '✅' : '❌'} | Role: {userTeamRole} | Selected: {isSelected ? '✅' : '❌'}
                    </div>
                )}
            </div>
            
            {/* ✅ Show manage button based on specific team permissions */}
            {canManage ? (
                <div className="mt-4 border-t pt-4">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent team selection when clicking manage
                            onManage();
                        }}
                        className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Manage Team
                    </button>
                </div>
            ) : (
                <div className="mt-4 border-t pt-4">
                    <div className="text-xs text-gray-400 text-center py-2">
                        {userTeamRole === 'employee' ? 'Insufficiant permissions' : 'Limited access'}
                    </div>
                </div>
            )}
            
            {/* ✅ Selection indicator */}
            {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            )}
        </div>
    );
}