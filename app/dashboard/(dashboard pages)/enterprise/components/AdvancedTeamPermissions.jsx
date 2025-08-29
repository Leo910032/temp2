"use client"
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

// ✅ STEP 1: Import the new Phase 3 services and constants
import { teamService, subscriptionService, ErrorHandler } from '@/lib/services/serviceEnterprise/client/enhanced-index';
import { TEAM_ROLES, PERMISSIONS, DEFAULT_PERMISSIONS_BY_ROLE } from '@/lib/services/serviceEnterprise/constants/enterpriseConstants';

// Helper components for loading and access denied states
const LoadingState = () => (
    <div className="flex justify-center items-center h-full p-6">
        <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading permissions...</p>
        </div>
    </div>
);

const AccessDeniedState = ({ onClose }) => (
    <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Access Denied</h3>
        <p className="text-gray-600 mb-6">
            Only team managers and organization owners can modify team permissions.
        </p>
        <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
            Close
        </button>
    </div>
);
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
  const [canManage, setCanManage] = useState(false);

  // Permission labels for better UX
  const PERMISSION_LABELS = {
    [PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS]: 'View All Team Contacts',
    [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: 'Edit Team Contacts',
    [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: 'Share Contacts with Team',
    [PERMISSIONS.CAN_EXPORT_TEAM_DATA]: 'Export Team Data',
    [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: 'Invite Team Members',
    [PERMISSIONS.CAN_CREATE_TEAMS]: 'Create New Teams',
    [PERMISSIONS.CAN_DELETE_TEAMS]: 'Delete Teams',
    [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: 'Manage Team Settings',
    [PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS]: 'Remove Team Members',
    [PERMISSIONS.CAN_UPDATE_MEMBER_ROLES]: 'Update Member Roles',
    [PERMISSIONS.CAN_REVOKE_INVITATIONS]: 'Revoke Invitations',
    [PERMISSIONS.CAN_RESEND_INVITATIONS]: 'Resend Invitations',
    [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: 'View Team Analytics'
  };

  // Group permissions by category for better organization
const PERMISSION_CATEGORIES = {
  'Contact Management': [
    PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS,
    PERMISSIONS.CAN_EDIT_TEAM_CONTACTS, // Restricted for employees
    PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM, // Restricted for employees
    PERMISSIONS.CAN_EXPORT_TEAM_DATA
  ],
  'Team Management': [ // Entirely restricted for employees
    PERMISSIONS.CAN_INVITE_TEAM_MEMBERS,
    PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS,
    PERMISSIONS.CAN_UPDATE_MEMBER_ROLES,
    PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS
  ],
  'Organization Management': [ // Entirely restricted for employees
    PERMISSIONS.CAN_CREATE_TEAMS,
    PERMISSIONS.CAN_DELETE_TEAMS
  ],
  'Invitation Management': [
    PERMISSIONS.CAN_REVOKE_INVITATIONS,
    PERMISSIONS.CAN_RESEND_INVITATIONS
  ],
  'Analytics & Reporting': [
    PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS
  ]
};


  // Roles that can be customized (excluding OWNER as they have all permissions)
  const CUSTOMIZABLE_ROLES = [TEAM_ROLES.MANAGER, TEAM_ROLES.TEAM_LEAD, TEAM_ROLES.EMPLOYEE];

  // Check if user can manage permissions
  const canManagePermissions = () => {
    if (!userContext || !teamId) return false;
    
    // Only organization owners and team managers can modify permissions
    return userContext.organizationRole === 'owner' || 
           getUserTeamRole(userContext, teamId) === TEAM_ROLES.MANAGER;
  };

  const getUserTeamRole = (userContext, teamId) => {
    if (userContext.organizationRole === 'owner') return TEAM_ROLES.OWNER;
    const teamData = userContext.teams?.[teamId];
    return teamData?.role || TEAM_ROLES.EMPLOYEE;
  };


  // ✅ STEP 2: Refactor data loading and permission checking
  useEffect(() => {
    const loadData = async () => {
      if (!isOpen || !teamId) return;
      
      setLoading(true);
      try {
        // Use the subscription service to check permissions first
        const canManagePerms = await subscriptionService().canPerformOperation('manage_team_permissions', { teamId });
        setCanManage(canManagePerms);

        if (!canManagePerms) {
            setLoading(false);
            return; // Don't fetch data if user doesn't have permission
        }
        
        // Use the new team service to get team permissions
        const teamPermissionsData = await teamService().getTeamPermissions(teamId);
        
        if (teamPermissionsData?.permissions && Object.keys(teamPermissionsData.permissions).length > 0) {
          console.log('Loaded custom team permissions:', teamPermissionsData.permissions);
          setPermissions(teamPermissionsData.permissions);
        } else {
          console.log('No custom permissions found, using defaults');
          setPermissions(DEFAULT_PERMISSIONS_BY_ROLE);
        }
        
      } catch (error) {
        const handledError = ErrorHandler.handle(error, 'loadPermissions');
        toast.error(handledError.message);
        // Fallback to defaults on error
        setPermissions(DEFAULT_PERMISSIONS_BY_ROLE);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, teamId]);
  

  // Handle permission toggle
  const handlePermissionToggle = (role, permission) => {
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permission]: !prev[role]?.[permission]
      }
    }));
    setHasChanges(true);
  };

  // Reset to default permissions for a role
  const resetRoleToDefaults = (role) => {
    setPermissions(prev => ({
      ...prev,
      [role]: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] }
    }));
    setHasChanges(true);
    toast.success(`${role.replace('_', ' ')} permissions reset to defaults`);
  };

  // Save permissions using service
    const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Updating team permissions...');
    
   
    try {
      // Use the new team service to update permissions
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
  // Handle close with unsaved changes warning
  const handleClose = () => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) return;
    }
    onClose();
  };

  // Get permission status for role - IMPROVED VERSION
  const getPermissionStatus = (role, permission) => {
    // First check if we have custom permissions for this role
    if (permissions[role] && permissions[role].hasOwnProperty(permission)) {
      return permissions[role][permission];
    }
    
    // Fall back to defaults if no custom permission is set
    return DEFAULT_PERMISSIONS_BY_ROLE[role]?.[permission] ?? false;
  };

  // Check if permission can be modified for role
  const canModifyPermission = (role, permission) => {
  // Owner role cannot be modified (always has all permissions)
  if (role === TEAM_ROLES.OWNER) return false;
  
  // Employee role restrictions - they cannot have these permissions at all
  if (role === TEAM_ROLES.EMPLOYEE) {
    const restrictedPermissions = [
      // Team Management permissions
      PERMISSIONS.CAN_INVITE_TEAM_MEMBERS,
      PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS,
      PERMISSIONS.CAN_UPDATE_MEMBER_ROLES,
      PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS,
      PERMISSIONS.CAN_REVOKE_INVITATIONS,
      PERMISSIONS.CAN_RESEND_INVITATIONS,
      
      // Organization Management permissions
      PERMISSIONS.CAN_CREATE_TEAMS,
      PERMISSIONS.CAN_DELETE_TEAMS,
      
      // Specific contact permissions
      PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM,
      PERMISSIONS.CAN_EDIT_TEAM_CONTACTS
    ];
    
    if (restrictedPermissions.includes(permission)) {
      return false; // Cannot modify these permissions for employees
    }
  }
  
  return true;
};

  if (!isOpen) return null;

  // Access control
  if (!canManagePermissions()) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Access Denied</h3>
          <p className="text-gray-600 mb-6">
            Only team managers and organization owners can modify team permissions.
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
                Customize permissions for <span className="font-medium">{teamName}</span>
              </p>
              <div className="mt-2 flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Manager Access Required
                </span>
                {hasChanges && (
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
            <div className="flex justify-center items-center h-48">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading permissions...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* INSTRUCTIONS */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-blue-800 mb-1">Permission Management</h3>
                    <p className="text-sm text-blue-700">
                      Customize what each role can do in this team. Changes will apply to all current and future members with these roles. 
                      <strong className="ml-1">Owner permissions cannot be modified</strong> as they always have full access.
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
                              <button
                                onClick={() => resetRoleToDefaults(role)}
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                                disabled={saving}
                              >
                                Reset to Default
                              </button>
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
        <span className="font-medium">{PERMISSION_LABELS[permission]}</span>
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
            {canModifyPermission(role, permission) ? (
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
                isEmployeeRestricted 
                  ? 'bg-red-100 border-red-300' 
                  : 'bg-gray-200 border-gray-300'
              }`}>
                <svg className={`w-3 h-3 ${
                  isEmployeeRestricted ? 'text-red-400' : 'text-gray-400'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
<div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
  <div className="flex items-start">
    <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
    <div>
      <h3 className="text-sm font-medium text-red-800 mb-1">Employee Role Restrictions</h3>
      <p className="text-sm text-red-700">
        Employees cannot be granted permissions for <strong>Team Management</strong>, <strong>Organization Management</strong>, 
        <strong>Share Contacts with Team</strong>, or <strong>Edit Team Contacts</strong>. These permissions are restricted to Team Leads and above.
      </p>
    </div>
  </div>
</div>

              {/* SUMMARY SECTION */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Permission Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {CUSTOMIZABLE_ROLES.map(role => {
                    const rolePermissions = permissions[role] || {};
                    const enabledCount = Object.values(rolePermissions).filter(Boolean).length;
                    const totalCount = Object.keys(PERMISSION_LABELS).length;
                    
                    return (
                      <div key={role} className="bg-white rounded-lg p-3 border border-gray-200">
                        <h4 className="font-medium capitalize text-gray-900 mb-2">
                          {role.replace('_', ' ')}
                        </h4>
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(enabledCount / totalCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {enabledCount}/{totalCount}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* FOOTER */}
        <footer className="p-6 border-t bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {hasChanges ? (
                <span className="text-orange-600 font-medium">You have unsaved changes</span>
              ) : (
                <span>All changes saved</span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                disabled={saving}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
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
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Helper function to provide permission descriptions
function getPermissionDescription(permission) {
  const descriptions = {
    [PERMISSIONS.CAN_VIEW_ALL_TEAM_CONTACTS]: 'Access to view all team member contacts',
    [PERMISSIONS.CAN_EDIT_TEAM_CONTACTS]: 'Ability to modify team contacts',
    [PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM]: 'Share personal contacts with team',
    [PERMISSIONS.CAN_EXPORT_TEAM_DATA]: 'Export team data and reports',
    [PERMISSIONS.CAN_INVITE_TEAM_MEMBERS]: 'Send invitations to new team members',
    [PERMISSIONS.CAN_CREATE_TEAMS]: 'Create new teams in organization',
    [PERMISSIONS.CAN_DELETE_TEAMS]: 'Delete teams from organization',
    [PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS]: 'Modify team settings and configuration',
    [PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS]: 'Remove members from team',
    [PERMISSIONS.CAN_UPDATE_MEMBER_ROLES]: 'Change member roles and permissions',
    [PERMISSIONS.CAN_REVOKE_INVITATIONS]: 'Cancel pending invitations',
    [PERMISSIONS.CAN_RESEND_INVITATIONS]: 'Resend invitation emails',
    [PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS]: 'Access team analytics and insights'
  };
  
  return descriptions[permission] || 'Team permission';
}