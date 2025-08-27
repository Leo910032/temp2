// lib/services/serviceEnterprise/server/enterpriseTeamPermissionService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { EnterpriseSecurityService } from './enterpriseSecurityService';
import { DEFAULT_PERMISSIONS_BY_ROLE, TEAM_ROLES, PERMISSIONS } from '../constants/enterpriseConstants';

export class EnterpriseTeamPermissionService {

 // Complete the missing getTeamPermissions method in your EnterpriseTeamPermissionService

/**
 * Get team's custom permissions or return defaults
 */
static async getTeamPermissions(organizationId, teamId) {
  try {
    console.log('📋 Getting team permissions:', { organizationId, teamId });

    const orgDoc = await adminDb.collection('Organizations').doc(organizationId).get();
    if (!orgDoc.exists) {
      throw new Error('Organization not found');
    }

    const orgData = orgDoc.data();
    const teamData = orgData.teams?.[teamId];
    
    if (!teamData) {
      throw new Error('Team not found');
    }

    // Return custom permissions if they exist, otherwise return defaults
    const customPermissions = teamData.customPermissions;
    
    if (customPermissions) {
      console.log('✅ Found custom permissions for team');
      return customPermissions;
    } else {
      console.log('✅ Using default permissions for team');
      return DEFAULT_PERMISSIONS_BY_ROLE;
    }

  } catch (error) {
    console.error('❌ Error getting team permissions:', error);
    throw error;
  }
}
/**
   * Define permissions that employees cannot have
   */
  static getEmployeeRestrictedPermissions() {
    return [
      // Team Management permissions
      PERMISSIONS.CAN_INVITE_TEAM_MEMBERS,
      PERMISSIONS.CAN_REMOVE_TEAM_MEMBERS,
      PERMISSIONS.CAN_UPDATE_MEMBER_ROLES,
      PERMISSIONS.CAN_MANAGE_TEAM_SETTINGS,
      
      // Organization Management permissions
      PERMISSIONS.CAN_CREATE_TEAMS,
      PERMISSIONS.CAN_DELETE_TEAMS,
      
      // Specific contact permissions
      PERMISSIONS.CAN_SHARE_CONTACTS_WITH_TEAM,
      PERMISSIONS.CAN_EDIT_TEAM_CONTACTS
    ];
  }
  
  /**
   * Validate that employee permissions don't include restricted ones
   */
  static validateEmployeePermissions(permissions) {
    const restrictedPermissions = this.getEmployeeRestrictedPermissions();
    const employeePermissions = permissions[TEAM_ROLES.EMPLOYEE] || {};
    
    // Check if any restricted permission is set to true for employees
    for (const permission of restrictedPermissions) {
      if (employeePermissions[permission] === true) {
        return {
          valid: false,
          error: `Employees cannot have permission: ${permission}`
        };
      }
    }
    
    return { valid: true };
  }

  /**
   * Sanitize permissions to remove restricted ones for employees
   */
  static sanitizeEmployeePermissions(permissions) {
    const sanitized = { ...permissions };
    const restrictedPermissions = this.getEmployeeRestrictedPermissions();
    
    if (sanitized[TEAM_ROLES.EMPLOYEE]) {
      // Force restricted permissions to false for employees
      for (const permission of restrictedPermissions) {
        sanitized[TEAM_ROLES.EMPLOYEE][permission] = false;
      }
      
      console.log('Sanitized employee permissions by removing restricted ones');
    }
    
    return sanitized;
  }

  /**
   * Enhanced validation that includes employee restrictions
   */
  static validatePermissions(permissions) {
    try {
      // Check if permissions is an object
      if (!permissions || typeof permissions !== 'object') {
        return { valid: false, error: 'Permissions must be an object' };
      }

      // Check if it has valid role keys
      const validRoles = Object.values(TEAM_ROLES);
      const providedRoles = Object.keys(permissions);
      
      for (const role of providedRoles) {
        if (!validRoles.includes(role)) {
          return { valid: false, error: `Invalid role: ${role}` };
        }
        
        // Check if role permissions is an object
        if (!permissions[role] || typeof permissions[role] !== 'object') {
          return { valid: false, error: `Role ${role} permissions must be an object` };
        }
        
        // Check if all permission keys are valid
        const rolePermissions = permissions[role];
        const validPermissions = Object.values(PERMISSIONS);
        
        for (const permission of Object.keys(rolePermissions)) {
          if (!validPermissions.includes(permission)) {
            return { valid: false, error: `Invalid permission: ${permission}` };
          }
          
          // Check if permission value is boolean
          if (typeof rolePermissions[permission] !== 'boolean') {
            return { valid: false, error: `Permission ${permission} must be a boolean` };
          }
        }
      }

      // Additional validation for employee restrictions
      const employeeValidation = this.validateEmployeePermissions(permissions);
      if (!employeeValidation.valid) {
        return employeeValidation;
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Updated updateTeamPermissions with employee restriction enforcement
   */
  static async updateTeamPermissions(updaterId, organizationId, teamId, permissions) {
    try {
      console.log('Updating team permissions:', { organizationId, teamId, updaterId });

      // Sanitize permissions to enforce employee restrictions
      const sanitizedPermissions = this.sanitizeEmployeePermissions(permissions);
      
      // Validate the sanitized permissions structure
      const validationResult = this.validatePermissions(sanitizedPermissions);
      if (!validationResult.valid) {
        throw new Error(`Invalid permissions: ${validationResult.error}`);
      }

      const orgRef = adminDb.collection('Organizations').doc(organizationId);
      
      // Update the team's custom permissions with sanitized data
      await orgRef.update({
        [`teams.${teamId}.customPermissions`]: sanitizedPermissions,
        [`teams.${teamId}.lastModified`]: FieldValue.serverTimestamp(),
        [`teams.${teamId}.permissionsLastModifiedBy`]: updaterId,
        [`teams.${teamId}.permissionsLastModifiedAt`]: FieldValue.serverTimestamp()
      });

      // Update all current team members with new permissions
      await this.updateMemberPermissions(organizationId, teamId, sanitizedPermissions);

      // Log audit event with information about sanitization
      try {
        const wasModified = JSON.stringify(permissions) !== JSON.stringify(sanitizedPermissions);
        
        await EnterpriseSecurityService.logAuditEvent({
          userId: updaterId,
          organizationId,
          action: 'team_permissions_updated',
          resourceType: 'team',
          resourceId: teamId,
          details: {
            permissionsChanged: this.getChangedPermissions(DEFAULT_PERMISSIONS_BY_ROLE, sanitizedPermissions),
            affectedRoles: Object.keys(sanitizedPermissions),
            employeePermissionsSanitized: wasModified,
            originalPermissionCount: Object.keys(permissions).length,
            finalPermissionCount: Object.keys(sanitizedPermissions).length
          }
        });
      } catch (auditError) {
        console.warn('Could not log audit event:', auditError.message);
      }

      console.log('Team permissions updated successfully with employee restrictions enforced');
      return { 
        success: true, 
        permissionsApplied: sanitizedPermissions,
        employeeRestrictionsEnforced: JSON.stringify(permissions) !== JSON.stringify(sanitizedPermissions)
      };

    } catch (error) {
      console.error('Error updating team permissions:', error);
      throw error;
    }
  }

  /**
   * Enhanced updateMemberPermissions that respects employee restrictions
   */
  static async updateMemberPermissions(organizationId, teamId, newPermissions) {
    try {
      console.log('Updating member permissions for team:', teamId);

      const orgDoc = await adminDb.collection('Organizations').doc(organizationId).get();
      const orgData = orgDoc.data();
      const teamData = orgData.teams?.[teamId];
      
      if (!teamData?.members) {
        console.log('No members to update');
        return;
      }

      const batch = adminDb.batch();
      const memberIds = Object.keys(teamData.members);
      const restrictedPermissions = this.getEmployeeRestrictedPermissions();

      // Update each member's permissions in their user document
      for (const memberId of memberIds) {
        const memberRole = teamData.members[memberId].role;
        let rolePermissions = newPermissions[memberRole] || DEFAULT_PERMISSIONS_BY_ROLE[memberRole];
        
        // Additional safety check: if this member is an employee, ensure no restricted permissions
        if (memberRole === TEAM_ROLES.EMPLOYEE) {
          rolePermissions = { ...rolePermissions };
          for (const restrictedPermission of restrictedPermissions) {
            if (rolePermissions[restrictedPermission] === true) {
              console.warn(`Removing restricted permission ${restrictedPermission} from employee ${memberId}`);
              rolePermissions[restrictedPermission] = false;
            }
          }
        }
        
        // Update in Organization document
        batch.update(adminDb.collection('Organizations').doc(organizationId), {
          [`teams.${teamId}.members.${memberId}.permissions`]: rolePermissions,
          [`teams.${teamId}.members.${memberId}.lastModified`]: FieldValue.serverTimestamp()
        });

        // Update in User document
        batch.update(adminDb.collection('AccountData').doc(memberId), {
          [`enterprise.teams.${teamId}.permissions`]: rolePermissions,
          [`enterprise.teams.${teamId}.lastModified`]: FieldValue.serverTimestamp()
        });
      }

      // Execute all updates in a single batch
      await batch.commit();
      console.log(`Updated permissions for ${memberIds.length} team members with employee restrictions enforced`);

    } catch (error) {
      console.error('Error updating member permissions:', error);
      throw error;
    }
  }

  /**
   * ✅ FIXED: Validate permissions structure
   */
  static validatePermissions(permissions) {
    try {
      // Check if permissions is an object
      if (!permissions || typeof permissions !== 'object') {
        return { valid: false, error: 'Permissions must be an object' };
      }

      // Check if it has valid role keys
      const validRoles = Object.values(TEAM_ROLES);
      const providedRoles = Object.keys(permissions);
      
      for (const role of providedRoles) {
        if (!validRoles.includes(role)) {
          return { valid: false, error: `Invalid role: ${role}` };
        }
        
        // Check if role permissions is an object
        if (!permissions[role] || typeof permissions[role] !== 'object') {
          return { valid: false, error: `Role ${role} permissions must be an object` };
        }
        
        // Check if all permission keys are valid
        const rolePermissions = permissions[role];
        const validPermissions = Object.values(PERMISSIONS);
        
        for (const permission of Object.keys(rolePermissions)) {
          if (!validPermissions.includes(permission)) {
            return { valid: false, error: `Invalid permission: ${permission}` };
          }
          
          // Check if permission value is boolean
          if (typeof rolePermissions[permission] !== 'boolean') {
            return { valid: false, error: `Permission ${permission} must be a boolean` };
          }
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * ✅ FIXED: Update team's custom permissions
   */
  static async updateTeamPermissions(updaterId, organizationId, teamId, permissions) {
    try {
      console.log('🔄 Updating team permissions:', { organizationId, teamId, updaterId });

      // Validate the permissions structure
      const validationResult = this.validatePermissions(permissions);
      if (!validationResult.valid) {
        throw new Error(`Invalid permissions: ${validationResult.error}`);
      }

      const orgRef = adminDb.collection('Organizations').doc(organizationId);
      
      // Update the team's custom permissions
      await orgRef.update({
        [`teams.${teamId}.customPermissions`]: permissions,
        [`teams.${teamId}.lastModified`]: FieldValue.serverTimestamp(),
        [`teams.${teamId}.permissionsLastModifiedBy`]: updaterId,
        [`teams.${teamId}.permissionsLastModifiedAt`]: FieldValue.serverTimestamp()
      });

      // Also need to update all current team members with new permissions
      await this.updateMemberPermissions(organizationId, teamId, permissions);

      // ✅ FIXED: Only log audit event if service exists
      try {
        await EnterpriseSecurityService.logAuditEvent({
          userId: updaterId,
          organizationId,
          action: 'team_permissions_updated',
          resourceType: 'team',
          resourceId: teamId,
          details: {
            permissionsChanged: this.getChangedPermissions(DEFAULT_PERMISSIONS_BY_ROLE, permissions),
            affectedRoles: Object.keys(permissions)
          }
        });
      } catch (auditError) {
        console.warn('⚠️ Could not log audit event:', auditError.message);
        // Don't fail the whole operation if audit logging fails
      }

      console.log('✅ Team permissions updated successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ Error updating team permissions:', error);
      throw error;
    }
  }

  /**
   * ✅ FIXED: Get changed permissions between old and new
   */
  static getChangedPermissions(oldPermissions, newPermissions) {
    const changes = {};
    
    for (const role of Object.keys(newPermissions)) {
      const oldRolePerms = oldPermissions[role] || {};
      const newRolePerms = newPermissions[role] || {};
      const roleChanges = {};
      
      // Find changed permissions for this role
      for (const permission of Object.keys(newRolePerms)) {
        if (oldRolePerms[permission] !== newRolePerms[permission]) {
          roleChanges[permission] = {
            from: oldRolePerms[permission] || false,
            to: newRolePerms[permission]
          };
        }
      }
      
      if (Object.keys(roleChanges).length > 0) {
        changes[role] = roleChanges;
      }
    }
    
    return changes;
  }

  /**
   * ✅ FIXED: Update permissions for all current team members
   */
  static async updateMemberPermissions(organizationId, teamId, newPermissions) {
    try {
      console.log('🔄 Updating member permissions for team:', teamId);

      const orgDoc = await adminDb.collection('Organizations').doc(organizationId).get();
      const orgData = orgDoc.data();
      const teamData = orgData.teams?.[teamId];
      
      if (!teamData?.members) {
        console.log('ℹ️ No members to update');
        return;
      }

      const batch = adminDb.batch();
      const memberIds = Object.keys(teamData.members);

      // Update each member's permissions in their user document
      for (const memberId of memberIds) {
        const memberRole = teamData.members[memberId].role;
        const rolePermissions = newPermissions[memberRole] || DEFAULT_PERMISSIONS_BY_ROLE[memberRole];
        
        // Update in Organization document
        batch.update(adminDb.collection('Organizations').doc(organizationId), {
          [`teams.${teamId}.members.${memberId}.permissions`]: rolePermissions,
          [`teams.${teamId}.members.${memberId}.lastModified`]: FieldValue.serverTimestamp()
        });

        // Update in User document
        batch.update(adminDb.collection('AccountData').doc(memberId), {
          [`enterprise.teams.${teamId}.permissions`]: rolePermissions,
          [`enterprise.teams.${teamId}.lastModified`]: FieldValue.serverTimestamp()
        });
      }

      // Execute all updates in a single batch
      await batch.commit();
      console.log(`✅ Updated permissions for ${memberIds.length} team members`);

    } catch (error) {
      console.error('❌ Error updating member permissions:', error);
      throw error;
    }
  }
}