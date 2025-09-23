//////////////////////////////////////////////
// lib/services/serviceEnterprise/server/enterpriseTeamService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { DEFAULT_PERMISSIONS_BY_ROLE, TEAM_ROLES }  from '@/lib/services/constants'; ;

export class EnterpriseTeamService {

  static async createTeam(creatorId, organizationId, teamDetails) {
    const { name, description = '', settings = {} } = teamDetails;

    // Generate a single ISO timestamp string for consistency
    const timestampString = new Date().toISOString();

    const teamId = `team_${Date.now()}`;
    const managerPermissions = DEFAULT_PERMISSIONS_BY_ROLE[TEAM_ROLES.MANAGER];
    
    const newTeamData = {
      name: name.trim(),
      description: description.trim(),
      managerId: creatorId,
      teamLeads: [],
      members: {
        [creatorId]: {
          role: TEAM_ROLES.MANAGER,
          joinedAt: timestampString,
          invitedBy: creatorId,
          permissions: managerPermissions
        }
      },
      settings: settings,
      createdAt: timestampString,
      lastModified: timestampString
    };

    const batch = adminDb.batch();
    const orgRef = adminDb.collection('Organizations').doc(organizationId);
    batch.update(orgRef, { [`teams.${teamId}`]: newTeamData });
    
    const userRef = adminDb.collection('AccountData').doc(creatorId);
    batch.update(userRef, {
      [`enterprise.teams.${teamId}`]: {
        role: TEAM_ROLES.MANAGER,
        joinedAt: timestampString,
        permissions: managerPermissions
      }
    });
    
    await batch.commit();

    // ✅ Use dynamic import to avoid circular dependency
    await this._logAuditEvent({
      userId: creatorId,
      organizationId,
      action: 'team_created',
      resourceType: 'team',
      resourceId: teamId,
      details: { name: newTeamData.name }
    });

    return { id: teamId, ...newTeamData };
  }

  static async updateTeam(updaterId, organizationId, teamId, updates) {
    const allowedFields = ['name', 'description', 'settings', 'teamLeads'];
    const updateObject = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateObject[`teams.${teamId}.${key}`] = value;
      }
    }
    if (Object.keys(updateObject).length === 0) {
      throw new Error('No valid update fields provided.');
    }
    updateObject[`teams.${teamId}.lastModified`] = FieldValue.serverTimestamp();
    await adminDb.collection('Organizations').doc(organizationId).update(updateObject);

    await this._logAuditEvent({
      userId: updaterId,
      organizationId,
      action: 'team_updated',
      resourceType: 'team',
      resourceId: teamId,
      details: { updatedFields: Object.keys(updates) }
    });
    return updates;
  }

  static async deleteTeam(deleterId, organizationId, teamId) {
    const memberIds = await this.getTeamMemberIds(organizationId, teamId);
    const batch = adminDb.batch();
    const orgRef = adminDb.collection('Organizations').doc(organizationId);
    batch.update(orgRef, { [`teams.${teamId}`]: FieldValue.delete() });

    for (const memberId of memberIds) {
      const memberRef = adminDb.collection('AccountData').doc(memberId);
      batch.update(memberRef, { [`enterprise.teams.${teamId}`]: FieldValue.delete() });
    }
    await batch.commit();

    await this._logAuditEvent({
      userId: deleterId,
      organizationId,
      action: 'team_deleted',
      resourceType: 'team',
      resourceId: teamId,
      severity: 'warning'
    });
  }

  static async getTeamMemberIds(organizationId, teamId) {
    const orgDoc = await adminDb.collection('Organizations').doc(organizationId).get();
    const teamData = orgDoc.data()?.teams?.[teamId];
    return teamData ? Object.keys(teamData.members || {}) : [];
  }

  static async addMemberToTeam(adderId, organizationId, teamId, newMemberId, role) {
    const permissions = DEFAULT_PERMISSIONS_BY_ROLE[role] || DEFAULT_PERMISSIONS_BY_ROLE.employee;
    const memberData = {
      role,
      joinedAt: FieldValue.serverTimestamp(),
      invitedBy: adderId,
      permissions
    };

    const batch = adminDb.batch();
    const orgRef = adminDb.collection('Organizations').doc(organizationId);
    batch.update(orgRef, { [`teams.${teamId}.members.${newMemberId}`]: memberData });
    const userRef = adminDb.collection('AccountData').doc(newMemberId);
    batch.update(userRef, { [`enterprise.teams.${teamId}`]: { role, permissions } });
    await batch.commit();

    await this._logAuditEvent({
      userId: adderId,
      organizationId,
      action: 'member_added',
      resourceType: 'team',
      resourceId: teamId,
      details: { addedUserId: newMemberId, role }
    });
  }

  static async removeMemberFromTeam(removerId, organizationId, teamId, memberIdToRemove) {
    const batch = adminDb.batch();
    const orgRef = adminDb.collection('Organizations').doc(organizationId);
    batch.update(orgRef, { [`teams.${teamId}.members.${memberIdToRemove}`]: FieldValue.delete() });
    const userRef = adminDb.collection('AccountData').doc(memberIdToRemove);
    batch.update(userRef, { [`enterprise.teams.${teamId}`]: FieldValue.delete() });
    await batch.commit();

    await this._logAuditEvent({
      userId: removerId,
      organizationId,
      action: 'member_removed',
      resourceType: 'team',
      resourceId: teamId,
      details: { removedUserId: memberIdToRemove }
    });
  }

  // ✅ FIXED: Avoid circular dependency by using dynamic import or direct audit logging
  static async updateMemberRole(updaterId, organizationId, teamId, memberId, newRole) {
    console.log('🔄 BACKEND: Updating member role:', { 
      updaterId, organizationId, teamId, memberId, newRole 
    });

    // Get permissions for the new role
    const permissions = DEFAULT_PERMISSIONS_BY_ROLE[newRole] || DEFAULT_PERMISSIONS_BY_ROLE.employee;

    const batch = adminDb.batch();
    
    // 1. Update the team document in Organization
    const orgRef = adminDb.collection('Organizations').doc(organizationId);
    batch.update(orgRef, { 
      [`teams.${teamId}.members.${memberId}.role`]: newRole,
      [`teams.${teamId}.members.${memberId}.permissions`]: permissions,
      [`teams.${teamId}.lastModified`]: FieldValue.serverTimestamp()
    });

    // 2. Update the user's enterprise data
    const userRef = adminDb.collection('AccountData').doc(memberId);
    batch.update(userRef, { 
      [`enterprise.teams.${teamId}.role`]: newRole,
      [`enterprise.teams.${teamId}.permissions`]: permissions,
      [`enterprise.teams.${teamId}.lastModified`]: FieldValue.serverTimestamp()
    });

    await batch.commit();

    console.log('✅ BACKEND: Role updated in both documents:', {
      memberId,
      newRole,
      teamId,
      organizationId
    });

    // ✅ Log audit event without circular dependency
    await this._logAuditEvent({
      userId: updaterId,
      organizationId,
      action: 'member_role_updated',
      resourceType: 'team',
      resourceId: teamId,
      details: { updatedUserId: memberId, newRole, permissions }
    });

    // Return the updated role data
    return {
      success: true,
      memberId,
      teamId,
      newRole,
      permissions,
      updatedAt: new Date().toISOString()
    };
  }

  static async getTeamDetails(organizationId, teamId) {
    const orgDoc = await adminDb.collection('Organizations').doc(organizationId).get();
    if (!orgDoc.exists) throw new Error("Organization not found");
    const teamData = orgDoc.data().teams?.[teamId];
    if (!teamData) throw new Error("Team not found");

    const memberIds = Object.keys(teamData.members || {});
    const memberPromises = memberIds.map(id => adminDb.collection('AccountData').doc(id).get());
    const memberDocs = await Promise.all(memberPromises);

    const members = memberDocs.map(doc => {
      if (!doc.exists) return { id: doc.id, displayName: 'Unknown User', email: '', role: teamData.members[doc.id]?.role };
      return {
        id: doc.id,
        displayName: doc.data().displayName,
        email: doc.data().email,
        role: teamData.members[doc.id]?.role,
      };
    });

    return { id: teamId, ...teamData, members };
  }

  // ✅ INTERNAL: Audit logging method that avoids circular dependencies
  static async _logAuditEvent(eventDetails) {
    try {
      console.log('📝 Logging audit event:', eventDetails.action);

      // Get user information for the audit log
      let userInfo = {};
      try {
        const userDoc = await adminDb.collection('AccountData').doc(eventDetails.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userInfo = {
            displayName: userData.displayName,
            email: userData.email
          };
        }
      } catch (error) {
        console.warn('Could not fetch user info for audit log:', error);
      }

      // Create audit log entry
      const auditLog = {
        userId: eventDetails.userId,
        userEmail: userInfo.email || 'Unknown',
        userDisplayName: userInfo.displayName || 'Unknown User',
        organizationId: eventDetails.organizationId,
        action: eventDetails.action,
        resourceType: eventDetails.resourceType || 'team',
        resourceId: eventDetails.resourceId,
        details: {
          ...eventDetails.details,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date(),
        createdAt: new Date().toISOString(),
        severity: eventDetails.severity || 'info'
      };

      // Save directly to Firestore
      const docRef = await adminDb.collection('AuditLogs').add(auditLog);
      console.log('✅ Audit event logged successfully:', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('❌ Error logging audit event:', error);
      // Don't throw - audit logging should not break main operations
      return null;
    }
  }
}