"use client"
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from 'react-hot-toast';
import AdvancedTeamPermissions from './AdvancedTeamPermissions';
import TeamAuditLog from './TeamAuditLog';

// 🚀 OPTIMIZED: Import the new optimized services
import {
  updateMemberRole,
  removeTeamMember,
  inviteTeamMember,
  resendInvitation,
  revokeInvitation,
  bulkResendInvitations,
  bulkRevokeInvitations,
  getTeamPermissions,
  updateTeamPermissions,
  getCacheStats
} from '@/lib/services/serviceEnterprise/client/optimizedEnterpriseService';

// 🚀 OPTIMIZED: Use the new team data hook
import { useOptimizedTeamData } from '@/lib/hooks/useOptimizedEnterpriseData';

// Import constants
import {
  TEAM_ROLES,
  TEAM_ROLE_HIERARCHY,
  PERMISSIONS,
  DEFAULT_PERMISSIONS_BY_ROLE
} from '@/lib/services/serviceEnterprise/constants/enterpriseConstants';

// Helper functions (moved outside component for better performance)
const getTeamPermissionSummary = (userContext, teamId) => {
  if (!userContext || !teamId) return null;
  
  const effectiveRole = getUserTeamRole(userContext, teamId);
  const teamData = userContext.teams?.[teamId];
  
  return {
    role: effectiveRole,
    isOwner: effectiveRole === TEAM_ROLES.OWNER,
    isManager: effectiveRole === TEAM_ROLES.MANAGER,
    isTeamLead: effectiveRole === TEAM_ROLES.TEAM_LEAD,
    isEmployee: effectiveRole === TEAM_ROLES.EMPLOYEE,
    customPermissions: teamData?.permissions || {},
    permissions: {
      canManageTeam: hasPermission(userContext, PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS, teamId),
      canInviteMembers: hasPermission(userContext, PERMISSIONS.CAN_INVITE_TEAM_MEMBERS, teamId),
      canRemoveMembers: hasPermission(userContext, PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS, teamId),
      canUpdateRoles: hasPermission(userContext, PERMISSIONS.CAN_UPDATE_MEMBER_ROLES, teamId),
      canManageInvitations: hasPermission(userContext, PERMISSIONS.CAN_REVOKE_INVITATIONS, teamId) || 
                           hasPermission(userContext, PERMISSIONS.CAN_RESEND_INVITATIONS, teamId),
      canDeleteTeam: hasPermission(userContext, PERMISSIONS.CAN_DELETE_TEAMS, teamId)
    }
  };
};

const getUserTeamRole = (userContext, teamId) => {
  if (!userContext) return TEAM_ROLES.EMPLOYEE;
  
  if (userContext.organizationRole === 'owner') {
    return TEAM_ROLES.OWNER;
  }
  
  const teamData = userContext.teams?.[teamId];
  return teamData?.role || TEAM_ROLES.EMPLOYEE;
};

const hasPermission = (userContext, permission, teamId = null) => {
  if (!userContext) return false;
  
  const effectiveRole = teamId 
    ? getUserTeamRole(userContext, teamId)
    : getHighestRole(userContext);
  
  const teamData = userContext.teams?.[teamId];
  const customPermissions = teamData?.permissions || {};
  
  if (customPermissions.hasOwnProperty(permission)) {
    return customPermissions[permission];
  }
  
  const rolePermissions = DEFAULT_PERMISSIONS_BY_ROLE[effectiveRole] || {};
  return rolePermissions[permission] || false;
};

const getHighestRole = (userContext) => {
  if (userContext.organizationRole === 'owner') {
    return TEAM_ROLES.OWNER;
  }
  
  const teamRoles = Object.values(userContext.teams || {}).map(team => team.role);
  
  if (teamRoles.length === 0) {
    return TEAM_ROLES.EMPLOYEE;
  }
  
  return teamRoles.reduce((highest, current) => {
    const currentLevel = TEAM_ROLE_HIERARCHY[current] || 0;
    const highestLevel = TEAM_ROLE_HIERARCHY[highest] || 0;
    return currentLevel > highestLevel ? current : highest;
  }, TEAM_ROLES.EMPLOYEE);
};

const getAssignableRoles = (userContext, teamId) => {
  const userRole = getUserTeamRole(userContext, teamId);
  const userLevel = TEAM_ROLE_HIERARCHY[userRole] || 0;
  
  return Object.keys(TEAM_ROLE_HIERARCHY).filter(role => {
    const roleLevel = TEAM_ROLE_HIERARCHY[role];
    
    if (userRole === TEAM_ROLES.MANAGER) {
      return role !== TEAM_ROLES.OWNER;
    }
    
    return roleLevel < userLevel;
  });
};

const canAssignRole = (userContext, targetRole, teamId) => {
  const userRole = getUserTeamRole(userContext, teamId);
  const userLevel = TEAM_ROLE_HIERARCHY[userRole] || 0;
  const targetLevel = TEAM_ROLE_HIERARCHY[targetRole] || 0;
  
  if (userRole === TEAM_ROLES.MANAGER && targetRole === TEAM_ROLES.MANAGER) {
    return true;
  }
  
  if (userRole === TEAM_ROLES.MANAGER) {
    return targetRole !== TEAM_ROLES.OWNER;
  }
  
  return userLevel > targetLevel;
};

const canManageAdvancedPermissions = (userContext, teamId) => {
  if (!userContext || !teamId) return false;
  return userContext.organizationRole === 'owner' || 
         getUserTeamRole(userContext, teamId) === TEAM_ROLES.MANAGER;
};

export default function OptimizedTeamManagementModal({ isOpen, onClose, teamId, teamName }) {
  const { currentUser } = useAuth();
  
  // 🚀 OPTIMIZED: Single hook call instead of multiple API calls
  const {
    userContext,
    members,
    invitations,
    loading,
    error,
    refetch,
    stats,
    getMember,
    getInvitation
  } = useOptimizedTeamData(teamId);
  
  // Local state
  const [isActionLoading, setActionLoading] = useState(false);
  const [processingInvites, setProcessingInvites] = useState(new Set());
  const [showAdvancedPermissions, setShowAdvancedPermissions] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [teamCustomPermissions, setTeamCustomPermissions] = useState(null);
  
  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(TEAM_ROLES.EMPLOYEE);

  // Bulk selection state
  const [selectedInvitations, setSelectedInvitations] = useState(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Filter and sort state
  const [invitationFilter, setInvitationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');

  // 🚀 OPTIMIZED: Memoized computed values
  const teamPermissions = userContext ? getTeamPermissionSummary(userContext, teamId) : null;
  const assignableRoles = userContext ? getAssignableRoles(userContext, teamId) : [];
  const checkAdvancedPermissions = useCallback(() => {
    return canManageAdvancedPermissions(userContext, teamId);
  }, [userContext, teamId]);

  // 🚀 OPTIMIZED: Load team permissions only when needed
  const loadTeamPermissions = useCallback(async () => {
    if (!checkAdvancedPermissions()) return;
    
    try {
      const permissions = await getTeamPermissions(teamId);
      setTeamCustomPermissions(permissions);
    } catch (error) {
      console.warn('Could not load team permissions:', error.message);
      setTeamCustomPermissions(null);
    }
  }, [teamId, checkAdvancedPermissions]);

  useEffect(() => {
    if (isOpen && teamId && userContext) {
      loadTeamPermissions();
    }
  }, [isOpen, teamId, userContext, loadTeamPermissions]);

  // 🚀 OPTIMIZED: Action handlers with better error handling
  const handleApiAction = async (actionPromise, successMessage, errorMessage = null) => {
    setActionLoading(true);
    const toastId = toast.loading('Processing...');
    
    try {
      await actionPromise;
      toast.success(successMessage, { id: toastId });
      
      // 🚀 OPTIMIZED: Use the hook's refetch instead of fetchDetails
      setTimeout(() => {
        refetch();
      }, 500);
      
      return true;
    } catch (error) {
      console.error('❌ Action failed:', error);
      const errorMsg = errorMessage || error.message || 'Action failed';
      toast.error(errorMsg, { id: toastId });
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvitationAction = async (inviteId, actionPromise, successMessage, errorMessage = null) => {
    setProcessingInvites(prev => new Set([...prev, inviteId]));
    const toastId = toast.loading('Processing...');
    
    try {
      await actionPromise;
      toast.success(successMessage, { id: toastId });
      
      setTimeout(() => {
        refetch();
      }, 500);
      
      return true;
    } catch (error) {
      console.error('❌ Invitation action failed:', error);
      const errorMsg = errorMessage || error.message || 'Action failed';
      toast.error(errorMsg, { id: toastId });
      return false;
    } finally {
      setProcessingInvites(prev => {
        const newSet = new Set(prev);
        newSet.delete(inviteId);
        return newSet;
      });
    }
  };

  // 🚀 OPTIMIZED: Role change handler
  const handleRoleChange = async (memberId, newRole) => {
    const member = getMember(memberId);
    if (!member) {
      toast.error('Member not found');
      return;
    }

    if (!canAssignRole(userContext, newRole, teamId)) {
      toast.error(`You cannot assign the role "${newRole.replace('_', ' ')}"`);
      return;
    }

    const memberName = member.displayName || member.email || 'Member';

    const success = await handleApiAction(
      updateMemberRole(teamId, memberId, newRole),
      `${memberName}'s role updated to ${newRole.replace('_', ' ')}`,
      'Failed to update member role'
    );

    if (success) {
      // 🚀 Show cache stats in development
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Cache stats after role update:', getCacheStats());
      }
    }
  };

  // 🚀 OPTIMIZED: Remove member handler
  const handleRemoveMember = async (memberId) => {
    const member = getMember(memberId);
    if (!member) {
      toast.error('Member not found');
      return;
    }

    const memberName = member.displayName || member.email || 'this member';
    
    if (!window.confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
      return;
    }

    await handleApiAction(
      removeTeamMember(teamId, memberId),
      `${memberName} removed from team`,
      'Failed to remove team member'
    );
  };

  // 🚀 OPTIMIZED: Invite member handler
  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return false;
    }

    if (!inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return false;
    }

    if (!canAssignRole(userContext, inviteRole, teamId)) {
      toast.error(`You cannot invite members with the role "${inviteRole.replace('_', ' ')}"`);
      return false;
    }

    const success = await handleApiAction(
      inviteTeamMember(teamId, { 
        email: inviteEmail.trim(),
        role: inviteRole 
      }, members.length),
      `Invitation sent to ${inviteEmail}`,
      'Failed to send invitation'
    );

    if (success) {
      setInviteEmail('');
      setInviteRole(TEAM_ROLES.EMPLOYEE);
      setShowInviteForm(false);
    }

    return success;
  };

  // 🚀 OPTIMIZED: Invitation management
  const handleRevokeInvite = async (inviteId) => {
    const invitation = getInvitation(inviteId);
    if (!invitation) {
      toast.error('Invitation not found');
      return;
    }

    if (!window.confirm(`Are you sure you want to revoke the invitation to ${invitation.invitedEmail}?`)) {
      return;
    }

    await handleInvitationAction(
      inviteId,
      revokeInvitation(inviteId),
      `Invitation to ${invitation.invitedEmail} revoked`,
      'Failed to revoke invitation'
    );
  };

  const handleResendInvite = async (inviteId) => {
    const invitation = getInvitation(inviteId);
    if (!invitation) {
      toast.error('Invitation not found');
      return;
    }

    await handleInvitationAction(
      inviteId,
      resendInvitation(inviteId),
      `Invitation resent to ${invitation.invitedEmail}`,
      'Failed to resend invitation'
    );
  };

  // 🚀 OPTIMIZED: Bulk operations
  const handleBulkResend = async () => {
    if (selectedInvitations.size === 0) {
      toast.error('Please select invitations to resend');
      return;
    }

    const inviteIds = Array.from(selectedInvitations);
    const count = inviteIds.length;

    if (!window.confirm(`Are you sure you want to resend ${count} invitation${count > 1 ? 's' : ''}?`)) {
      return;
    }

    const success = await handleApiAction(
      bulkResendInvitations(inviteIds),
      `${count} invitation${count > 1 ? 's' : ''} resent successfully`,
      'Failed to resend some invitations'
    );

    if (success) {
      setSelectedInvitations(new Set());
      setShowBulkActions(false);
    }
  };

  const handleBulkRevoke = async () => {
    if (selectedInvitations.size === 0) {
      toast.error('Please select invitations to revoke');
      return;
    }

    const inviteIds = Array.from(selectedInvitations);
    const count = inviteIds.length;

    if (!window.confirm(`Are you sure you want to revoke ${count} invitation${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    const success = await handleApiAction(
      bulkRevokeInvitations(inviteIds),
      `${count} invitation${count > 1 ? 's' : ''} revoked successfully`,
      'Failed to revoke some invitations'
    );

    if (success) {
      setSelectedInvitations(new Set());
      setShowBulkActions(false);
    }
  };

  // 🚀 OPTIMIZED: Permissions update handler
  const handlePermissionsUpdated = async (newPermissions) => {
    setTeamCustomPermissions(newPermissions);
    toast.success('Team permissions updated! Changes will apply to all team members.');
    
    setTimeout(() => {
      refetch();
    }, 1000);
  };

  // Selection handlers
  const handleInvitationSelect = (inviteId, isSelected) => {
    setSelectedInvitations(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(inviteId);
      } else {
        newSet.delete(inviteId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      const filteredInvites = getFilteredAndSortedInvitations();
      setSelectedInvitations(new Set(filteredInvites.map(inv => inv.id)));
    } else {
      setSelectedInvitations(new Set());
    }
  };


const getInvitationStatusInfo = (invitation) => {
    if (!invitation || !invitation.expiresAt) {
      return { isExpired: true, daysUntilExpiry: 0, isExpiringSoon: false };
    }
    
    let expiresAt;
    const ts = invitation.expiresAt;

    // Check 1: Is it a direct Firestore Timestamp object (from cache/realtime)?
    if (ts.toDate && typeof ts.toDate === 'function') {
      expiresAt = ts.toDate();
    }
    // ✅ THE FIX: Is it a serialized Firestore Timestamp from an API route?
    else if (typeof ts === 'object' && ts._seconds !== undefined && ts._nanoseconds !== undefined) {
      expiresAt = new Date(ts._seconds * 1000 + ts._nanoseconds / 1000000);
    }
    // Check 3: Is it an ISO string or something else `new Date` can handle?
    else {
      expiresAt = new Date(ts);
    }
    
    // Final check for an invalid date
    if (isNaN(expiresAt.getTime())) {
      console.warn("Could not parse invitation expiration date:", ts);
      return { isExpired: true, daysUntilExpiry: 0, isExpiringSoon: false };
    }

    const now = new Date();
    const isExpired = now > expiresAt;
    const daysUntilExpiry = isExpired ? 0 : Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
    
    return {
      isExpired,
      daysUntilExpiry,
      isExpiringSoon: !isExpired && daysUntilExpiry <= 2,
    };
};

  const getFilteredAndSortedInvitations = () => {
    let filtered = [...invitations];

    if (invitationFilter === 'expired') {
      filtered = filtered.filter(inv => getInvitationStatusInfo(inv).isExpired);
    } else if (invitationFilter === 'expiring') {
      filtered = filtered.filter(inv => getInvitationStatusInfo(inv).isExpiringSoon);
    } else if (invitationFilter === 'pending') {
      filtered = filtered.filter(inv => !getInvitationStatusInfo(inv).isExpired);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'email':
          return a.invitedEmail.localeCompare(b.invitedEmail);
        case 'role':
          return a.role.localeCompare(b.role);
        case 'expiresAt':
          const aExpires = new Date(a.expiresAt.toDate ? a.expiresAt.toDate() : a.expiresAt);
          const bExpires = new Date(b.expiresAt.toDate ? b.expiresAt.toDate() : b.expiresAt);
          return aExpires - bExpires;
        default:
          const aCreated = new Date(a.createdAt.toDate ? a.createdAt.toDate() : a.createdAt);
          const bCreated = new Date(b.createdAt.toDate ? b.createdAt.toDate() : b.createdAt);
          return bCreated - aCreated;
      }
    });

    return filtered;
  };

  const filteredInvitations = getFilteredAndSortedInvitations();
  const allSelected = filteredInvitations.length > 0 && 
                     filteredInvitations.every(inv => selectedInvitations.has(inv.id));
  const someSelected = selectedInvitations.size > 0;

  // Don't render if modal is closed
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col">
          {/* Header with performance info in development */}
          <header className="p-6 border-b flex items-center justify-between bg-gray-50 rounded-t-lg">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Manage Team</h2>
              <p className="text-gray-600 mt-1">{teamName}</p>
              {teamPermissions && (
                <div className="flex items-center space-x-4 mt-2">
                  <p className="text-sm text-gray-500">
                    Your role: <span className="capitalize font-medium">{teamPermissions.role.replace('_', ' ')}</span>
                  </p>
                  <div className="flex space-x-1">
                    {teamPermissions.permissions.canManageTeam && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Manager Access
                      </span>
                    )}
                    {teamPermissions.permissions.canInviteMembers && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Can Invite
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* 🚀 Performance indicators in development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-2 text-xs text-gray-400">
                  📊 Cache Stats: {getCacheStats().hitRate} hit rate | 
                  ⚡ Members: {stats?.totalMembers || 0} | 
                  📨 Invites: {stats?.totalInvitations || 0}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Activity Log Button */}
              {teamPermissions?.permissions?.canManageTeam && (
                <button
                  onClick={() => setShowAuditLog(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  disabled={isActionLoading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Activity Log</span>
                </button>
              )}
              
              {/* Advanced Permissions Button */}
              {checkAdvancedPermissions() && (
                <button
                  onClick={() => setShowAdvancedPermissions(true)}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                  disabled={isActionLoading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Advanced Permissions</span>
                </button>
              )}
              
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-gray-200 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
                disabled={isActionLoading}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </header>
          
          {/* Main Content */}
          <main className="p-6 overflow-y-auto flex-1">
            {/* Custom Permissions Status */}
            {teamCustomPermissions && (
              <section className="mb-8">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-purple-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-purple-800 mb-1">Custom Permissions Active</h3>
                      <p className="text-sm text-purple-700">
                        This team uses custom permission settings that override the default role permissions. 
                        {checkAdvancedPermissions() && (
                          <button 
                            onClick={() => setShowAdvancedPermissions(true)}
                            className="underline hover:text-purple-800 ml-1"
                          >
                            Click here to modify them.
                          </button>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {loading ? (
              <div className="flex justify-center items-center h-48">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading team details...</p>
                  {process.env.NODE_ENV === 'development' && (
                    <p className="text-xs text-gray-400 mt-2">🚀 Using optimized batch loading</p>
                  )}
                </div>
              </div>
            ) : error ? (
              <div className="flex justify-center items-center h-48">
                <div className="text-center">
                  <p className="text-red-600 mb-2">Error: {error}</p>
                  <button
                    onClick={refetch}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : !userContext ? (
              <div className="flex justify-center items-center h-48">
                <div className="text-center">
                  <p className="text-gray-600">Unable to load user permissions</p>
                  <button
                    onClick={refetch}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : !teamPermissions ? (
              <div className="flex justify-center items-center h-48">
                <div className="text-center">
                  <p className="text-gray-600">You do not have access to manage this team</p>
                  <p className="text-sm text-gray-500 mt-1">Contact your organization administrator for access</p>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Team Members Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Team Members ({stats?.totalMembers || members.length})
                    </h3>
                    {teamPermissions.permissions.canInviteMembers && (
                      <button
                        onClick={() => setShowInviteForm(!showInviteForm)}
                        className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                        disabled={isActionLoading}
                      >
                        {showInviteForm ? 'Cancel' : 'Invite Member'}
                      </button>
                    )}
                  </div>

                  {/* Invite Form */}
                  {showInviteForm && teamPermissions.permissions.canInviteMembers && (
                    <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <h4 className="font-medium text-purple-900 mb-3">Invite New Member</h4>
                      <div className="flex gap-3">
                        <input
                          type="email"
                          placeholder="Enter email address"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          disabled={isActionLoading}
                        />
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          disabled={isActionLoading}
                        >
                          {assignableRoles.map(role => (
                            <option key={role} value={role}>
                              {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleInvite}
                          disabled={isActionLoading || !inviteEmail.trim()}
                          className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isActionLoading ? 'Sending...' : 'Send Invite'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Members List */}
                  {members.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p>No team members found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {members.map((member) => (
                        <OptimizedMemberCard
                          key={member.id}
                          member={member}
                          currentUserId={currentUser?.uid}
                          userContext={userContext}
                          teamId={teamId}
                          assignableRoles={assignableRoles}
                          onRoleChange={handleRoleChange}
                          onRemove={handleRemoveMember}
                          isActionLoading={isActionLoading}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Pending Invitations Section */}
                {invitations.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Pending Invitations ({stats?.totalInvitations || invitations.length})
                      </h3>
                      {teamPermissions.permissions.canManageInvitations && (
                        <button
                          onClick={() => setShowBulkActions(!showBulkActions)}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          {showBulkActions ? 'Hide' : 'Show'} Bulk Actions
                        </button>
                      )}
                    </div>

                    {/* Filters and Sorting */}
                    <div className="mb-4 flex flex-wrap gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Filter:</label>
                        <select
                          value={invitationFilter}
                          onChange={(e) => setInvitationFilter(e.target.value)}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1"
                        >
                          <option value="all">All</option>
                          <option value="pending">Active</option>
                          <option value="expiring">Expiring Soon</option>
                          <option value="expired">Expired</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Sort by:</label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1"
                        >
                          <option value="createdAt">Date Created</option>
                          <option value="email">Email</option>
                          <option value="role">Role</option>
                          <option value="expiresAt">Expiration</option>
                        </select>
                      </div>
                      
                      {/* 🚀 Performance indicator */}
                      {process.env.NODE_ENV === 'development' && (
                        <div className="text-xs text-gray-400">
                          🔥 Expired: {stats?.expiredInvitations || 0}
                        </div>
                      )}
                    </div>

                    {/* Bulk Actions */}
                    {showBulkActions && teamPermissions.permissions.canManageInvitations && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                className="mr-2"
                              />
                              Select All ({filteredInvitations.length})
                            </label>
                            {someSelected && (
                              <span className="text-sm text-blue-600">
                                {selectedInvitations.size} selected
                              </span>
                            )}
                          </div>
                          {someSelected && (
                            <div className="flex gap-2">
                              <button
                                onClick={handleBulkResend}
                                disabled={isActionLoading}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                              >
                                Resend Selected
                              </button>
                              <button
                                onClick={handleBulkRevoke}
                                disabled={isActionLoading}
                                className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                              >
                                Revoke Selected
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Invitations List */}
                    <div className="space-y-3">
                      {filteredInvitations.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <p>No invitations match your filter criteria</p>
                        </div>
                      ) : (
                        filteredInvitations.map((invitation) => (
                          <OptimizedInvitationCard
                            key={invitation.id}
                            invitation={invitation}
                            userContext={userContext}
                            teamId={teamId}
                            onRevoke={handleRevokeInvite}
                            onResend={handleResendInvite}
                            isProcessing={processingInvites.has(invitation.id)}
                            statusInfo={getInvitationStatusInfo(invitation)}
                            showBulkActions={showBulkActions}
                            isSelected={selectedInvitations.has(invitation.id)}
                            onSelect={handleInvitationSelect}
                          />
                        ))
                      )}
                    </div>
                  </section>
                )}

                {/* Team Statistics */}
                <section className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Team Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{stats?.totalMembers || members.length}</div>
                      <div className="text-sm text-gray-600">Total Members</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {members.filter(m => m.role === TEAM_ROLES.MANAGER).length}
                      </div>
                      <div className="text-sm text-gray-600">Managers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {members.filter(m => m.role === TEAM_ROLES.TEAM_LEAD).length}
                      </div>
                      <div className="text-sm text-gray-600">Team Leads</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{stats?.totalInvitations || invitations.length}</div>
                      <div className="text-sm text-gray-600">Pending Invites</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{stats?.expiredInvitations || 0}</div>
                      <div className="text-sm text-gray-600">Expired Invites</div>
                    </div>
                  </div>
                </section>

                {/* 🚀 Performance Debug Info (Development Only) */}
                {process.env.NODE_ENV === 'development' && (
                  <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-yellow-800 mb-2">🚀 Performance Debug Info</h4>
                    <div className="text-xs text-yellow-700 space-y-1">
                      <p><strong>Cache Stats:</strong> {getCacheStats().hitRate} hit rate, {getCacheStats().cacheSize} entries</p>
                      <p><strong>Load Performance:</strong> Single batch call vs {members.length + invitations.length + 2} individual calls</p>
                      <p><strong>Request Deduplication:</strong> {getCacheStats().deduplicated} requests deduplicated</p>
                      <p><strong>Team Data:</strong> {stats?.totalMembers || 0} members, {stats?.totalInvitations || 0} invites loaded in one batch</p>
                    </div>
                  </section>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Audit Log Modal */}
      {teamPermissions?.permissions?.canManageTeam && (
        <TeamAuditLog
          isOpen={showAuditLog}
          onClose={() => setShowAuditLog(false)}
          teamId={teamId}
          teamName={teamName}
          userContext={userContext}
        />
      )}

      {/* Advanced Permissions Modal */}
      {checkAdvancedPermissions() && (
        <AdvancedTeamPermissions
          isOpen={showAdvancedPermissions}
          onClose={() => setShowAdvancedPermissions(false)}
          teamId={teamId}
          teamName={teamName}
          userContext={userContext}
          onPermissionsUpdated={handlePermissionsUpdated}
        />
      )}
    </>
  );
}

// 🚀 OPTIMIZED: Member Card Component
function OptimizedMemberCard({ 
  member, 
  currentUserId, 
  userContext, 
  teamId, 
  assignableRoles, 
  onRoleChange, 
  onRemove, 
  isActionLoading 
}) {
  const isCurrentUser = member.id === currentUserId;
  const [isRoleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const canUpdateRole = hasPermission(userContext, PERMISSIONS.CAN_UPDATE_MEMBER_ROLES, teamId) && !isCurrentUser;
  const canRemove = hasPermission(userContext, PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS, teamId) && !isCurrentUser;

  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
          <span className="text-purple-600 font-medium">
            {(member.displayName || member.email || '?').charAt(0).toUpperCase()}
          </span>
        </div>
        
        <div>
          <div className="flex items-center space-x-2">
            <h4 className="font-medium text-gray-900">
              {member.displayName || member.email || 'Unknown User'}
              {isCurrentUser && <span className="text-purple-600 text-sm ml-1">(You)</span>}
            </h4>
          </div>
          <p className="text-sm text-gray-600">{member.email}</p>
          <div className="flex items-center space-x-2 mt-1">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              member.role === TEAM_ROLES.OWNER ? 'bg-red-100 text-red-800' :
              member.role === TEAM_ROLES.MANAGER ? 'bg-purple-100 text-purple-800' :
              member.role === TEAM_ROLES.TEAM_LEAD ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {member.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
            {member.joinedAt && (
              <span className="text-xs text-gray-500">
                Joined {new Date(member.joinedAt.toDate ? member.joinedAt.toDate() : member.joinedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {(canUpdateRole || canRemove) && (
        <div className="flex items-center space-x-2">
          {canUpdateRole && assignableRoles.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setRoleDropdownOpen(!isRoleDropdownOpen)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                disabled={isActionLoading}
              >
                Change Role
              </button>
              {isRoleDropdownOpen && (
                <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  {assignableRoles.map((role) => (
                    <button
                      key={role}
                      onClick={() => {
                        onRoleChange(member.id, role);
                        setRoleDropdownOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 capitalize"
                      disabled={member.role === role}
                    >
                      {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      {member.role === role && ' ✓'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {canRemove && (
            <button
              onClick={() => onRemove(member.id)}
              className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
              disabled={isActionLoading}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// 🚀 OPTIMIZED: Invitation Card Component (with robust date handling)
function OptimizedInvitationCard({ 
  invitation, 
  userContext,
  teamId,
  onRevoke, 
  onResend, 
  isProcessing, 
  statusInfo,
  showBulkActions,
  isSelected,
  onSelect
}) {
  const { isExpired, daysUntilExpiry, isExpiringSoon } = statusInfo;
  
  const canRevoke = hasPermission(userContext, PERMISSIONS.CAN_REVOKE_INVITATIONS, teamId);
  const canResend = hasPermission(userContext, PERMISSIONS.CAN_RESEND_INVITATIONS, teamId);
  const canManage = canRevoke || canResend;

  // ✅ THE FIX: A robust helper to parse the 'createdAt' timestamp in any format
  const getSentDate = (createdAt) => {
    if (!createdAt) return 'Invalid Date';
    
    let date;
    // Check 1: Firestore Timestamp object
    if (createdAt.toDate && typeof createdAt.toDate === 'function') {
      date = createdAt.toDate();
    } 
    // Check 2: Serialized Firestore Timestamp object
    else if (typeof createdAt === 'object' && createdAt._seconds !== undefined) {
      date = new Date(createdAt._seconds * 1000 + (createdAt._nanoseconds || 0) / 1000000);
    } 
    // Check 3: Fallback for ISO strings, etc.
    else {
      date = new Date(createdAt);
    }

    if (isNaN(date.getTime())) {
      console.warn("Could not parse 'Sent' date:", createdAt);
      return 'Invalid Date';
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  
  return (
    <div className={`flex items-center justify-between p-4 border rounded-lg ${
      isExpired ? 'bg-red-50 border-red-200' :
      isExpiringSoon ? 'bg-yellow-50 border-yellow-200' :
      'bg-green-50 border-green-200'
    }`}>
      <div className="flex items-center space-x-4">
        {showBulkActions && canManage && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(invitation.id, e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
        )}

        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isExpired ? 'bg-red-100' :
          isExpiringSoon ? 'bg-yellow-100' :
          'bg-green-100'
        }`}>
          {isExpired ? (
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className={`w-5 h-5 ${isExpiringSoon ? 'text-yellow-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-4-2l4-4 4 4m-4-4V5" />
            </svg>
          )}
        </div>
        
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{invitation.invitedEmail}</h4>
          <div className="flex items-center space-x-2 mt-1">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
              isExpired ? 'bg-red-100 text-red-800' :
              isExpiringSoon ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {invitation.role?.replace('_', ' ')}
            </span>
            <span className="text-xs text-gray-500">
              Sent {getSentDate(invitation.createdAt)}
            </span>
            {invitation.resentCount > 0 && (
              <span className="text-xs text-blue-500">
                Resent {invitation.resentCount}x
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {isExpired ? (
              <span className="text-red-600 font-medium">Expired</span>
            ) : isExpiringSoon ? (
              <span className="text-yellow-600 font-medium">Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}</span>
            ) : (
              <span className="text-green-600">Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}</span>
            )}
            {invitation.inviteCode && (
              <span className="ml-2 text-gray-400">Code: {invitation.inviteCode}</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Action buttons */}
      {canManage && !showBulkActions && (
        <div className="flex items-center space-x-2">
          {canResend && !isExpired && (
            <button
              onClick={() => onResend(invitation.id)}
              disabled={isProcessing}
              className="px-3 py-1 text-sm text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? 'Processing...' : 'Resend'}
            </button>
          )}
          
          {canRevoke && !isExpired && (
            <button
              onClick={() => onRevoke(invitation.id)}
              disabled={isProcessing}
              className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? 'Processing...' : 'Revoke'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}