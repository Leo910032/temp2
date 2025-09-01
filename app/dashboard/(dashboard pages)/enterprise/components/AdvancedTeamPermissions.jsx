// ✅ FIXED: AdvancedTeamPermissions component with proper imports
"use client"
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

// ✅ FIX: Import the missing functions and constants
import { 
  teamService,
  TEAM_ROLES,
  PERMISSIONS,
  DEFAULT_PERMISSIONS_BY_ROLE,
  CUSTOMIZABLE_ROLES,
  PERMISSION_CATEGORIES,
  PERMISSION_LABELS,
  ErrorHandler
} from '@/lib/services/serviceEnterprise';


export default function AdvancedTeamPermissions({ 
  isOpen, 
  onClose, 
  teamId, 
  teamName, 
  userContext,
  onPermissionsUpdated 
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [userAccess, setUserAccess] = useState(null);

  // ✅ FIX: Define getUserTeamRole function locally or import it properly
  const getUserTeamRole = (userContext, teamId) => {
    if (!userContext || !teamId) return TEAM_ROLES.EMPLOYEE;
    
    // Check if user is organization owner (highest priority)
    if (userContext.organizationRole === 'owner') {
      return TEAM_ROLES.OWNER;
    }
    
    // Get team-specific role from server data
    const teamData = userContext.teams?.[teamId];
    return teamData?.role || TEAM_ROLES.EMPLOYEE;
  };

  // ✅ FIX: Define hasPermission function locally
  const hasPermission = (userContext, permission, teamId) => {
    if (!userContext) return false;
    
    // Organization owners have all permissions
    if (userContext.organizationRole === 'owner') return true;
    
    // Get user's role for this team
    const teamRole = getUserTeamRole(userContext, teamId);
    
    // Check custom permissions first
    const teamData = userContext.teams?.[teamId];
    if (teamData?.permissions && teamData.permissions.hasOwnProperty(permission)) {
      return teamData.permissions[permission];
    }
    
    // Fall back to default role permissions
    const rolePermissions = DEFAULT_PERMISSIONS_BY_ROLE[teamRole] || {};
    return rolePermissions[permission] || false;
  };

  // ✅ UPDATED: Check if user can manage OR view permissions
  const canAccessPermissions = () => {
    if (!userContext || !teamId) return false;
    
    // Check for either management or view permissions
    return userContext.organizationRole === 'owner' || 
           getUserTeamRole(userContext, teamId) === TEAM_ROLES.MANAGER ||
           hasPermission(userContext, PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS, teamId);
  };

  // ✅ Helper functions for the component
  const getPermissionStatus = (role, permission) => {
    return permissions[role]?.[permission] || false;
  };

  const handlePermissionToggle = (role, permission) => {
    if (!userAccess?.canModify) return;
    
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permission]: !prev[role]?.[permission]
      }
    }));
    setHasChanges(true);
  };

  const canModifyPermission = (role, permission) => {
    // Employees cannot have certain restricted permissions
    if (role === TEAM_ROLES.EMPLOYEE) {
      const restrictedPermissions = [
        PERMISSIONS.CAN_INVITE_TEAM_MEMBERS,
        PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS,
        PERMISSIONS.CAN_UPDATE_MEMBER_ROLES,
        PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS,
        PERMISSIONS.CAN_CREATE_TEAMS,
        PERMISSIONS.CAN_DELETE_TEAMS,
        PERMISSIONS.CAN_REVOKE_INVITATIONS,
        PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM,
        PERMISSIONS.CAN_EDIT_TEAM_CONTACTS,
        PERMISSIONS.CAN_RESEND_INVITATIONS
      ];
      return !restrictedPermissions.includes(permission);
    }
    return true;
  };

  const getPermissionDescription = (permission) => {
    const descriptions = {
      [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: "Send invitations to new team members",
      [PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS]: "Remove existing members from the team",
      [PERMISSIONS.CAN_UPDATE_MEMBER_ROLES]: "Change roles of team members",
      [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: "Modify team settings and configuration",
      [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: "Access team performance and analytics",
      [PERMISSIONS.CAN_CREATE_TEAMS]: "Create new teams in the organization",
      [PERMISSIONS.CAN_DELETE_TEAMS]: "Delete teams from the organization",
      [PERMISSIONS.CAN_REVOKE_INVITATIONS]: "Cancel pending invitations",
      [PERMISSIONS.CAN_RESEND_INVITATIONS]: "Resend invitation emails",
      [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: "Share contact information with team",
      [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: "Modify team contact database"
    };
    return descriptions[permission] || "Permission description not available";
  };

  const resetRoleToDefaults = (role) => {
    if (!userAccess?.canModify) return;
    
    const defaultPermissions = DEFAULT_PERMISSIONS_BY_ROLE[role] || {};
    setPermissions(prev => ({
      ...prev,
      [role]: { ...defaultPermissions }
    }));
    setHasChanges(true);
    toast.success(`Reset ${role} permissions to defaults`);
  };

  const handleClose = () => {
    if (hasChanges && userAccess?.canModify) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // ✅ UPDATED: Data loading with enhanced error handling
  useEffect(() => {
    const loadData = async () => {
      if (!isOpen || !teamId) return;
      
      setLoading(true);
      try {
        console.log('Loading team permissions for teamId:', teamId);
        
        // Use the team service to get team permissions
        const teamPermissionsData = await teamService().getTeamPermissions(teamId);
        
        console.log('Received permissions data:', teamPermissionsData);
        
        // ✅ HANDLE: Enhanced API response with userAccess info
        if (teamPermissionsData?.userAccess) {
          setUserAccess(teamPermissionsData.userAccess);
        }
        
        if (teamPermissionsData?.permissions && Object.keys(teamPermissionsData.permissions).length > 0) {
          console.log('Loaded custom team permissions:', teamPermissionsData.permissions);
          setPermissions(teamPermissionsData.permissions);
        } else {
          console.log('No custom permissions found, using defaults');
          setPermissions(DEFAULT_PERMISSIONS_BY_ROLE);
        }
        
      } catch (error) {
        console.error('Error loading permissions:', error);
        const handledError = ErrorHandler.handle(error, 'loadPermissions');
        
        // ✅ BETTER ERROR HANDLING: Distinguish between access denied and other errors
        if (error.message?.includes('Insufficient permissions') || error.status === 403) {
          toast.error('You do not have permission to view team permissions');
          onClose(); // Close the modal if access is denied
          return;
        } else {
          toast.error(handledError.message);
          // Fallback to defaults on other errors
          setPermissions(DEFAULT_PERMISSIONS_BY_ROLE);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, teamId, onClose]);

  // Save permissions using service
  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    // ✅ CHECK: Only allow save if user can manage (not just view)
    if (userAccess && !userAccess.canModify) {
      toast.error('You can view permissions but cannot modify them. Only team managers can make changes.');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Updating team permissions...');
    
    try {
      // Use the team service to update permissions
      await teamService().updateTeamPermissions(teamId, permissions);
      
      toast.success('Team permissions updated successfully!', { id: toastId });
      setHasChanges(false);
      
      if (onPermissionsUpdated) {
        onPermissionsUpdated(permissions);
      }
      
      onClose();
    } catch (error) {
      const handledError = ErrorHandler.handle(error, 'updatePermissions');
      toast.error(handledError.message, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // ✅ Loading component
  const LoadingState = () => (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading team permissions...</p>
      </div>
    </div>
  );

  if (!isOpen) return null;

  // ✅ UPDATED ACCESS CONTROL: Show different messages based on access level
  if (!canAccessPermissions()) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Access Denied</h3>
          <p className="text-gray-600 mb-6">
            You need either team management permissions or team analytics permissions to view team permissions.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col">
        {/* HEADER */}
        <header className="p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Advanced Team Permissions</h2>
              <p className="text-gray-600 mt-1">
                {userAccess?.canModify ? 'Customize' : 'View'} permissions for <span className="font-medium">{teamName}</span>
              </p>
              <div className="mt-2 flex items-center space-x-2">
                {userAccess?.canModify ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Manager Access - Can Modify
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    View Only Access
                  </span>
                )}
                {hasChanges && userAccess?.canModify && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Unsaved Changes
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="p-2 hover:bg-gray-200 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
              disabled={saving}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <LoadingState />
          ) : (
            <div className="space-y-8">
              {/* ✅ UPDATED INSTRUCTIONS based on access level */}
              <div className={`border rounded-lg p-4 ${
                userAccess?.canModify ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-start">
                  <svg className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${
                    userAccess?.canModify ? 'text-blue-600' : 'text-yellow-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className={`text-sm font-medium mb-1 ${
                      userAccess?.canModify ? 'text-blue-800' : 'text-yellow-800'
                    }`}>
                      {userAccess?.canModify ? 'Permission Management' : 'Permission Viewing'}
                    </h3>
                    <p className={`text-sm ${
                      userAccess?.canModify ? 'text-blue-700' : 'text-yellow-700'
                    }`}>
                      {userAccess?.canModify ? (
                        <>
                          Customize what each role can do in this team. Changes will apply to all current and future members with these roles. 
                          <strong className="ml-1">Owner permissions cannot be modified</strong> as they always have full access.
                        </>
                      ) : (
                        <>
                          You can view the current permission settings for this team but cannot modify them. 
                          <strong className="ml-1">Only team managers can make changes</strong> to team permissions.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* PERMISSIONS TABLE */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                          Permission
                        </th>
                        {CUSTOMIZABLE_ROLES.map(role => (
                          <th key={role} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex flex-col items-center space-y-2">
                              <span className="capitalize">{role.replace('_', ' ')}</span>
                              {userAccess?.canModify && (
                                <button
                                  onClick={() => resetRoleToDefaults(role)}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                  disabled={saving}
                                >
                                  Reset to Default
                                </button>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span>Owner</span>
                            <span className="text-xs text-green-600 font-normal">(Always All)</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.entries(PERMISSION_CATEGORIES).map(([category, categoryPermissions]) => (
                        <React.Fragment key={category}>
                          {/* Category Header */}
                          <tr className="bg-gray-25">
                            <td colSpan={CUSTOMIZABLE_ROLES.length + 2} className="px-6 py-3">
                              <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                                <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                {category}
                              </h4>
                            </td>
                          </tr>
                          
                          {/* Category Permissions */}
                          {categoryPermissions.map(permission => (
                            <tr key={permission} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-200">
                                <div className="flex flex-col">
                                  <span className="font-medium">{PERMISSION_LABELS[permission] || permission}</span>
                                  <span className="text-xs text-gray-500 mt-1">
                                    {getPermissionDescription(permission)}
                                  </span>
                                </div>
                              </td>
                              
                              {CUSTOMIZABLE_ROLES.map(role => {
                                const isRestricted = !canModifyPermission(role, permission);
                                const isEmployeeRestricted = role === TEAM_ROLES.EMPLOYEE && isRestricted;
                                
                                return (
                                  <td key={`${role}-${permission}`} className="px-6 py-4 text-center">
                                    <div className="flex justify-center">
                                      {canModifyPermission(role, permission) && userAccess?.canModify ? (
                                        <label className="inline-flex items-center">
                                          <input
                                            type="checkbox"
                                            checked={getPermissionStatus(role, permission)}
                                            onChange={() => handlePermissionToggle(role, permission)}
                                            disabled={saving}
                                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                                          />
                                        </label>
                                      ) : (
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                          getPermissionStatus(role, permission) ?
                                            'bg-green-100 border-green-300' :
                                            isEmployeeRestricted ? 'bg-red-100 border-red-300' : 'bg-gray-200 border-gray-300'
                                        }`}>
                                          {getPermissionStatus(role, permission) ? (
                                            <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                          ) : (
                                            <svg className={`w-3 h-3 ${
                                              isEmployeeRestricted ? 'text-red-400' : 'text-gray-400'
                                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {isEmployeeRestricted && (
                                      <div className="text-xs text-red-500 mt-1">
                                        Role Restricted
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                              
                              {/* Owner column - always checked */}
                              <td className="px-6 py-4 text-center">
                                <div className="flex justify-center">
                                  <div className="w-4 h-4 bg-green-500 rounded border border-green-600 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* FOOTER */}
        <footer className="p-6 border-t bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {userAccess?.canModify ? (
                hasChanges ? (
                  <span className="text-orange-600 font-medium">You have unsaved changes</span>
                ) : (
                  <span>All changes saved</span>
                )
              ) : (
                <span>View-only access</span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                disabled={saving}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {userAccess?.canModify ? 'Cancel' : 'Close'}
              </button>
              {userAccess?.canModify && (
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {saving && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}