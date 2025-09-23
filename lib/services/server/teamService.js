// lib/services/server/teamService.js

import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { DEFAULT_PERMISSIONS_BY_ROLE, TEAM_ROLES } from '@/lib/services/constants';
// Import for audit logging - will be available after we create the security service
import { EnterpriseAuditService } from '../serviceEnterprise/server/enterpriseAuditService';

export class TeamService {

    /**
     * Creates a new team document in the top-level `teams` collection.
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {object} options.teamDetails - Contains { name, description, settings }.
     * @returns {Promise<object>} The newly created team data.
     */
    static async createTeam({ session, teamDetails }) {
        const { name, description = '', settings = {} } = teamDetails;
        const { userId, organizationId } = session; // Get IDs from the session

        const timestamp = new Date();
        const teamRef = adminDb.collection('teams').doc(); // Auto-generate ID
        const managerPermissions = DEFAULT_PERMISSIONS_BY_ROLE[TEAM_ROLES.MANAGER];
        
        const newTeamData = {
            id: teamRef.id,
            name: name.trim(),
            description: description.trim(),
            organizationId: organizationId,
            managerId: userId, // Keep track of who created/manages the team
            teamLeads: [],
            createdAt: timestamp,
            lastModified: timestamp,
            members: {
                [userId]: {
                    role: TEAM_ROLES.MANAGER,
                    joinedAt: timestamp.toISOString(),
                    invitedBy: userId,
                    permissions: managerPermissions
                }
            },
            settings: settings,
            customPermissions: { ...DEFAULT_PERMISSIONS_BY_ROLE } // Start with default permissions
        };

        const userRef = adminDb.collection('users').doc(userId);
        
        // Use a transaction for atomicity
        await adminDb.runTransaction(async (transaction) => {
            transaction.set(teamRef, newTeamData);
            transaction.update(userRef, {
                [`enterprise.teams.${teamRef.id}`]: {
                    role: TEAM_ROLES.MANAGER,
                    joinedAt: timestamp.toISOString(),
                    permissions: managerPermissions
                }
            });
        });

        // Log audit event
        await EnterpriseAuditService.logTeamAction({
            userId, 
            organizationId, 
            action: 'team_created',
            resourceId: teamRef.id, 
            details: { name: newTeamData.name }
        });

        return newTeamData;
    }

    /**
     * Fetches a single team document by its ID.
     * @param {object} options
     * @param {string} options.teamId - The ID of the team to fetch.
     * @returns {Promise<object|null>} The team data or null if not found.
     */
    static async getTeamById({ teamId }) {
        const teamDoc = await adminDb.collection('teams').doc(teamId).get();
        if (!teamDoc.exists) {
            console.warn(`TeamService: Team with ID ${teamId} not found.`);
            return null;
        }
        return { id: teamDoc.id, ...teamDoc.data() };
    }

    /**
     * Fetches all teams a specific user belongs to.
     * @param {object} options
     * @param {string} options.userId - The user's ID.
     * @returns {Promise<Array>} A list of team data objects.
     */
    static async getTeamsForUser({ userId }) {
        const userDocSnap = await adminDb.collection('users').doc(userId).get();
        if (!userDocSnap.exists) return [];

        const teamMap = userDocSnap.data().enterprise?.teams || {};
        const teamIds = Object.keys(teamMap);

        if (teamIds.length === 0) return [];
        
        // Fetch all team documents in a single batch
        const teamRefs = teamIds.map(id => adminDb.collection('teams').doc(id));
        const teamDocs = await adminDb.getAll(...teamRefs);
        
        return teamDocs.map(doc => doc.exists ? { id: doc.id, ...doc.data() } : null).filter(Boolean);
    }

    /**
     * Updates a team's basic details (name, description, settings).
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {string} options.teamId - The ID of the team to update.
     * @param {object} options.updates - An object with fields to update.
     * @returns {Promise<object>} The update object.
     */
    static async updateTeam({ session, teamId, updates }) {
        const allowedFields = ['name', 'description', 'settings', 'teamLeads'];
        const updateObject = {};
        
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                updateObject[key] = value;
            }
        }

        if (Object.keys(updateObject).length === 0) {
            throw new Error('No valid update fields provided.');
        }

        updateObject.lastModified = FieldValue.serverTimestamp();
        
        const teamRef = adminDb.collection('teams').doc(teamId);
        await teamRef.update(updateObject);

        await EnterpriseAuditService.logTeamAction({
            userId: session.userId, 
            organizationId: session.organizationId,
            action: 'team_updated', 
            resourceId: teamId,
            details: { updatedFields: Object.keys(updates) }
        });

        return updates;
    }

    /**
     * Deletes a team and removes all member associations.
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {string} options.teamId - The ID of the team to delete.
     */
    static async deleteTeam({ session, teamId }) {
        // Get team data to find all members
        const teamDoc = await adminDb.collection('teams').doc(teamId).get();
        if (!teamDoc.exists) {
            throw new Error('Team not found');
        }

        const teamData = teamDoc.data();
        const memberIds = Object.keys(teamData.members || {});

        const batch = adminDb.batch();
        
        // Delete the team document
        const teamRef = adminDb.collection('teams').doc(teamId);
        batch.delete(teamRef);

        // Remove team from all member user documents
        for (const memberId of memberIds) {
            const memberRef = adminDb.collection('users').doc(memberId);
            batch.update(memberRef, { 
                [`enterprise.teams.${teamId}`]: FieldValue.delete() 
            });
        }

        await batch.commit();

        await EnterpriseAuditService.logTeamAction({
            userId: session.userId,
            organizationId: session.organizationId,
            action: 'team_deleted',
            resourceId: teamId,
            details: { teamName: teamData.name, memberCount: memberIds.length }
        });
    }

    /**
     * Adds a member to a team.
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {string} options.teamId - The ID of the team.
     * @param {string} options.newMemberId - The ID of the user to add.
     * @param {string} options.role - The role to assign to the new member.
     */
    static async addMember({ session, teamId, newMemberId, role }) {
        const permissions = DEFAULT_PERMISSIONS_BY_ROLE[role] || DEFAULT_PERMISSIONS_BY_ROLE[TEAM_ROLES.EMPLOYEE];
        const timestamp = new Date().toISOString();
        
        const memberData = {
            role,
            joinedAt: timestamp,
            invitedBy: session.userId,
            permissions
        };

        const batch = adminDb.batch();
        
        // Update team document
        const teamRef = adminDb.collection('teams').doc(teamId);
        batch.update(teamRef, { 
            [`members.${newMemberId}`]: memberData,
            lastModified: FieldValue.serverTimestamp()
        });
        
        // Update user document
        const userRef = adminDb.collection('users').doc(newMemberId);
        batch.update(userRef, { 
            [`enterprise.teams.${teamId}`]: { 
                role, 
                joinedAt: timestamp,
                permissions 
            } 
        });
        
        await batch.commit();

        await EnterpriseAuditService.logTeamAction({
            userId: session.userId,
            organizationId: session.organizationId,
            action: 'member_added',
            resourceId: teamId,
            details: { addedUserId: newMemberId, role }
        });
    }

    /**
     * Removes a member from a team.
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {string} options.teamId - The ID of the team.
     * @param {string} options.memberIdToRemove - The ID of the user to remove.
     */
    static async removeMember({ session, teamId, memberIdToRemove }) {
        const batch = adminDb.batch();
        
        // Remove from team document
        const teamRef = adminDb.collection('teams').doc(teamId);
        batch.update(teamRef, { 
            [`members.${memberIdToRemove}`]: FieldValue.delete(),
            lastModified: FieldValue.serverTimestamp()
        });
        
        // Remove from user document
        const userRef = adminDb.collection('users').doc(memberIdToRemove);
        batch.update(userRef, { 
            [`enterprise.teams.${teamId}`]: FieldValue.delete() 
        });
        
        await batch.commit();

        await EnterpriseAuditService.logTeamAction({
            userId: session.userId,
            organizationId: session.organizationId,
            action: 'member_removed',
            resourceId: teamId,
            details: { removedUserId: memberIdToRemove }
        });
    }

    /**
     * Updates a member's role in a team.
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {string} options.teamId - The ID of the team.
     * @param {string} options.memberId - The ID of the member whose role to update.
     * @param {string} options.newRole - The new role to assign.
     */
    static async updateMemberRole({ session, teamId, memberId, newRole }) {
        console.log('�� BACKEND: Updating member role:', { 
            updaterId: session.userId, 
            organizationId: session.organizationId, 
            teamId, 
            memberId, 
            newRole 
        });

        // Get permissions for the new role
        const permissions = DEFAULT_PERMISSIONS_BY_ROLE[newRole] || DEFAULT_PERMISSIONS_BY_ROLE[TEAM_ROLES.EMPLOYEE];

        const batch = adminDb.batch();
        
        // Update the team document
        const teamRef = adminDb.collection('teams').doc(teamId);
        batch.update(teamRef, { 
            [`members.${memberId}.role`]: newRole,
            [`members.${memberId}.permissions`]: permissions,
            lastModified: FieldValue.serverTimestamp()
        });

        // Update the user's enterprise data
        const userRef = adminDb.collection('users').doc(memberId);
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
            organizationId: session.organizationId
        });

        // Log audit event
        await EnterpriseAuditService.logTeamAction({
            userId: session.userId,
            organizationId: session.organizationId,
            action: 'member_role_updated',
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

    /**
     * Gets detailed team information including member details.
     * @param {object} options
     * @param {string} options.teamId - The ID of the team.
     * @returns {Promise<object>} The team details with member information.
     */
    static async getTeamDetails({ teamId }) {
        const teamDoc = await adminDb.collection('teams').doc(teamId).get();
        if (!teamDoc.exists) {
            throw new Error("Team not found");
        }

        const teamData = teamDoc.data();
        const memberIds = Object.keys(teamData.members || {});
        
        // Fetch member details
        const memberPromises = memberIds.map(id => adminDb.collection('users').doc(id).get());
        const memberDocs = await Promise.all(memberPromises);

        const members = memberDocs.map(doc => {
            if (!doc.exists) {
                return { 
                    id: doc.id, 
                    displayName: 'Unknown User', 
                    email: '', 
                    role: teamData.members[doc.id]?.role 
                };
            }
            
            const userData = doc.data();
            return {
                id: doc.id,
                displayName: userData.displayName,
                email: userData.email,
                role: teamData.members[doc.id]?.role,
                joinedAt: teamData.members[doc.id]?.joinedAt,
                permissions: teamData.members[doc.id]?.permissions
            };
        });

        return { id: teamId, ...teamData, members };
    }
}
