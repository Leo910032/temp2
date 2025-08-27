// lib/services/serviceEnterprise/server/enterpriseContactService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Enterprise Contact Service
 * Handles team contact sharing, management, and access control
 */
export class EnterpriseContactService {
    
    /**
     * Share contacts with team members
     * @param {string} managerId - ID of the user sharing contacts
     * @param {Array} contactIds - Array of contact IDs to share
     * @param {string} teamId - Target team ID
     * @param {Object} options - Sharing options
     */
    static async shareContactsWithTeam(managerId, contactIds, teamId, options = {}) {
        try {
            console.log('📤 Sharing contacts with team:', { managerId, contactIds: contactIds.length, teamId });

            // Verify manager permissions
            const canShare = await this.verifyTeamPermission(managerId, teamId, 'canShareContactsWithTeam');
            if (!canShare) {
                throw new Error('Insufficient permissions to share contacts');
            }

            // Get team data
            const teamData = await this.getTeamData(teamId);
            const memberIds = Object.keys(teamData.members || {});

            // Get manager's contacts
            const managerContacts = await this.getUserContacts(managerId);
            
            // Filter contacts to share (only those that exist and belong to manager)
            const contactsToShare = managerContacts.filter(contact => 
                contactIds.includes(contact.id || contact._id)
            );

            if (contactsToShare.length === 0) {
                throw new Error('No valid contacts found to share');
            }

            // Prepare sharing metadata
            const sharingData = {
                sharedWithTeams: [teamId],
                sharedAt: new Date().toISOString(),
                sharedBy: managerId,
                accessLevel: options.accessLevel || 'view_only',
                teamContext: teamId
            };

            // Update contacts with sharing information
            const updatePromises = contactsToShare.map(contact => 
                this.updateContactSharing(managerId, contact.id || contact._id, sharingData)
            );

            await Promise.all(updatePromises);

            // Create team contact entries for each member
            const shareResults = [];
            for (const memberId of memberIds) {
                if (memberId === managerId) continue; // Skip the manager

                try {
                    await this.addSharedContactsToUser(memberId, contactsToShare, {
                        sharedBy: managerId,
                        teamId: teamId,
                        accessLevel: sharingData.accessLevel,
                        sharedAt: sharingData.sharedAt
                    });

                    shareResults.push({ memberId, success: true });
                } catch (error) {
                    console.error(`Failed to share with member ${memberId}:`, error);
                    shareResults.push({ 
                        memberId, 
                        success: false, 
                        error: error.message 
                    });
                }
            }

            // Log audit event
            await this.logAuditEvent({
                userId: managerId,
                action: 'contacts_shared',
                resourceType: 'team_contacts',
                resourceId: teamId,
                details: {
                    contactCount: contactsToShare.length,
                    teamMembers: memberIds.length,
                    shareResults: shareResults,
                    accessLevel: sharingData.accessLevel
                }
            });

            console.log('✅ Contacts shared successfully:', {
                sharedContacts: contactsToShare.length,
                sharedWith: shareResults.filter(r => r.success).length,
                totalMembers: memberIds.length
            });

            return {
                success: true,
                sharedContacts: contactsToShare.length,
                sharedWith: shareResults.filter(r => r.success).length,
                totalMembers: memberIds.length,
                results: shareResults
            };

        } catch (error) {
            console.error('❌ Error sharing contacts with team:', error);
            throw error;
        }
    }

    /**
     * Get all contacts accessible to a team manager
     * @param {string} managerId - Manager's user ID
     * @param {string} teamId - Team ID
     */
    static async getManagerTeamContacts(managerId, teamId) {
        try {
            console.log('📋 Getting team contacts for manager:', { managerId, teamId });

            // Verify manager permissions
            const canView = await this.verifyTeamPermission(managerId, teamId, 'canViewAllTeamContacts');
            if (!canView) {
                throw new Error('Insufficient permissions to view team contacts');
            }

            // Get team data
            const teamData = await this.getTeamData(teamId);
            const memberIds = Object.keys(teamData.members || {});

            // Get organization data for additional context
            const orgData = await this.getOrganizationData(teamData.organizationId);

            // Aggregate contacts from all team members
            const allContacts = [];
            const memberDetails = {};

            for (const memberId of memberIds) {
                try {
                    // Get member details
                    const memberData = await this.getUserData(memberId);
                    memberDetails[memberId] = {
                        name: memberData.displayName || memberData.username || 'Unknown',
                        email: memberData.email,
                        role: teamData.members[memberId].role
                    };

                    // Get member's contacts
                    const memberContacts = await this.getUserContacts(memberId);
                    
                    // Process and enrich contacts
                    const enrichedContacts = memberContacts.map(contact => ({
                        ...contact,
                        // Ownership information
                        originalOwner: memberId,
                        ownerName: memberDetails[memberId].name,
                        ownerEmail: memberDetails[memberId].email,
                        ownerRole: memberDetails[memberId].role,
                        
                        // Sharing context
                        isSharedContact: memberId !== managerId,
                        isOwnContact: memberId === managerId,
                        teamContext: teamId,
                        
                        // Access information
                        canEdit: this.canEditContact(managerId, contact, teamData),
                        canDelete: memberId === managerId, // Only owner can delete
                        
                        // Metadata
                        viewedAt: new Date().toISOString(),
                        accessLevel: contact.sharing?.accessLevel || 'view_only'
                    }));

                    allContacts.push(...enrichedContacts);

                } catch (error) {
                    console.warn(`Failed to get contacts for member ${memberId}:`, error.message);
                    // Add placeholder member info
                    memberDetails[memberId] = {
                        name: 'Unknown User',
                        email: 'unknown@example.com',
                        role: teamData.members[memberId]?.role || 'employee',
                        error: true
                    };
                }
            }

            // Sort contacts by relevance and recency
            allContacts.sort((a, b) => {
                // Own contacts first
                if (a.isOwnContact && !b.isOwnContact) return -1;
                if (!a.isOwnContact && b.isOwnContact) return 1;
                
                // Then by last modified/created date
                const aDate = new Date(a.lastModified || a.createdAt || 0);
                const bDate = new Date(b.lastModified || b.createdAt || 0);
                return bDate - aDate;
            });

            // Calculate team statistics
            const statistics = {
                totalContacts: allContacts.length,
                ownContacts: allContacts.filter(c => c.isOwnContact).length,
                sharedContacts: allContacts.filter(c => c.isSharedContact).length,
                contactsByMember: {},
                contactsBySource: {}
            };

            // Group contacts by member
            for (const contact of allContacts) {
                const ownerId = contact.originalOwner;
                if (!statistics.contactsByMember[ownerId]) {
                    statistics.contactsByMember[ownerId] = {
                        count: 0,
                        member: memberDetails[ownerId]
                    };
                }
                statistics.contactsByMember[ownerId].count++;

                // Group by source
                const source = contact.source || 'manual';
                statistics.contactsBySource[source] = (statistics.contactsBySource[source] || 0) + 1;
            }

            // Log audit event
            await this.logAuditEvent({
                userId: managerId,
                action: 'team_contacts_viewed',
                resourceType: 'team_contacts',
                resourceId: teamId,
                details: {
                    contactCount: allContacts.length,
                    teamMembers: memberIds.length,
                    statistics
                }
            });

            console.log('✅ Team contacts retrieved:', {
                totalContacts: allContacts.length,
                teamMembers: memberIds.length,
                managerId
            });

            return {
                contacts: allContacts,
                statistics,
                memberDetails,
                teamInfo: {
                    id: teamId,
                    name: teamData.name,
                    memberCount: memberIds.length,
                    organizationName: orgData.name
                }
            };

        } catch (error) {
            console.error('❌ Error getting team contacts:', error);
            throw error;
        }
    }

    /**
     * Get contacts shared with a specific user
     * @param {string} userId - User ID
     * @param {string} teamId - Team ID (optional filter)
     */
    static async getSharedContacts(userId, teamId = null) {
        try {
            console.log('📥 Getting shared contacts:', { userId, teamId });

            const userContacts = await this.getUserContacts(userId);
            
            // Filter for shared contacts
            const sharedContacts = userContacts.filter(contact => {
                const sharing = contact.sharing;
                if (!sharing) return false;
                
                // Check if contact is shared with user's teams
                const userTeams = sharing.sharedWithTeams || [];
                if (teamId) {
                    return userTeams.includes(teamId);
                }
                
                return userTeams.length > 0 || sharing.sharedWithOrganization;
            });

            // Enrich with sharing context
            const enrichedContacts = sharedContacts.map(contact => ({
                ...contact,
                isSharedContact: true,
                sharedBy: contact.sharing.sharedBy,
                sharedAt: contact.sharing.sharedAt,
                accessLevel: contact.sharing.accessLevel || 'view_only',
                canEdit: contact.sharing.accessLevel === 'edit',
                canDelete: false // Shared contacts cannot be deleted by recipients
            }));

            return enrichedContacts;

        } catch (error) {
            console.error('❌ Error getting shared contacts:', error);
            throw error;
        }
    }

    /**
     * Remove contact sharing from team
     * @param {string} managerId - Manager's user ID
     * @param {string} contactId - Contact ID
     * @param {string} teamId - Team ID
     */
    static async removeContactSharing(managerId, contactId, teamId) {
        try {
            console.log('🗑️ Removing contact sharing:', { managerId, contactId, teamId });

            // Verify permissions
            const canManage = await this.verifyTeamPermission(managerId, teamId, 'canShareContactsWithTeam');
            if (!canManage) {
                throw new Error('Insufficient permissions to manage contact sharing');
            }

            // Get contact data
            const managerContacts = await this.getUserContacts(managerId);
            const contact = managerContacts.find(c => (c.id || c._id) === contactId);

            if (!contact) {
                throw new Error('Contact not found');
            }

            // Update contact sharing data
            const updatedSharing = {
                ...contact.sharing,
                sharedWithTeams: (contact.sharing?.sharedWithTeams || []).filter(id => id !== teamId)
            };

            // If no teams left, remove sharing entirely
            if (updatedSharing.sharedWithTeams.length === 0 && !updatedSharing.sharedWithOrganization) {
                updatedSharing.sharedAt = null;
                updatedSharing.sharedBy = null;
                updatedSharing.accessLevel = null;
            }

            await this.updateContactSharing(managerId, contactId, updatedSharing);

            // Remove from team members' shared contacts
            const teamData = await this.getTeamData(teamId);
            const memberIds = Object.keys(teamData.members || {});

            const removePromises = memberIds.map(memberId => {
                if (memberId === managerId) return Promise.resolve();
                return this.removeSharedContactFromUser(memberId, contactId);
            });

            await Promise.all(removePromises);

            // Log audit event
            await this.logAuditEvent({
                userId: managerId,
                action: 'contact_sharing_removed',
                resourceType: 'team_contacts',
                resourceId: teamId,
                details: {
                    contactId,
                    teamMembers: memberIds.length
                }
            });

            return { success: true };

        } catch (error) {
            console.error('❌ Error removing contact sharing:', error);
            throw error;
        }
    }

    /**
     * Bulk share multiple contacts with team
     * @param {string} managerId - Manager's user ID
     * @param {Array} contactIds - Array of contact IDs
     * @param {string} teamId - Team ID
     * @param {Object} options - Sharing options
     */
    static async bulkShareContacts(managerId, contactIds, teamId, options = {}) {
        try {
            console.log('📦 Bulk sharing contacts:', { managerId, count: contactIds.length, teamId });

            if (!Array.isArray(contactIds) || contactIds.length === 0) {
                throw new Error('Contact IDs array is required');
            }

            // Process in batches to avoid overwhelming the system
            const batchSize = 10;
            const results = [];

            for (let i = 0; i < contactIds.length; i += batchSize) {
                const batch = contactIds.slice(i, i + batchSize);
                
                try {
                    const result = await this.shareContactsWithTeam(managerId, batch, teamId, options);
                    results.push(result);
                } catch (error) {
                    console.error(`Batch ${i / batchSize + 1} failed:`, error);
                    results.push({
                        success: false,
                        error: error.message,
                        batch: i / batchSize + 1
                    });
                }
            }

            // Aggregate results
            const summary = {
                totalRequested: contactIds.length,
                totalShared: results.reduce((sum, r) => sum + (r.sharedContacts || 0), 0),
                totalRecipients: results.reduce((sum, r) => sum + (r.sharedWith || 0), 0),
                batches: results.length,
                errors: results.filter(r => !r.success).length
            };

            console.log('✅ Bulk sharing completed:', summary);

            return {
                success: summary.errors === 0,
                summary,
                results
            };

        } catch (error) {
            console.error('❌ Error in bulk share:', error);
            throw error;
        }
    }

    // ==================== HELPER METHODS ====================

    /**
     * Verify user's permission for a team action
     */
    static async verifyTeamPermission(userId, teamId, permission) {
        try {
            const userDoc = await adminDb.collection('AccountData').doc(userId).get();
            if (!userDoc.exists) return false;

            const userData = userDoc.data();
            const enterprise = userData.enterprise;

            if (!enterprise?.teams?.[teamId]) return false;

            const teamData = enterprise.teams[teamId];
            return teamData.permissions?.[permission] || 
                   ['owner', 'manager'].includes(enterprise.organizationRole);

        } catch (error) {
            console.error('Error verifying team permission:', error);
            return false;
        }
    }

    /**
     * Get team data from organization
     */
    static async getTeamData(teamId) {
        // First, find which organization contains this team
        const orgsSnapshot = await adminDb.collection('Organizations').get();
        
        for (const orgDoc of orgsSnapshot.docs) {
            const orgData = orgDoc.data();
            if (orgData.teams?.[teamId]) {
                return {
                    ...orgData.teams[teamId],
                    organizationId: orgDoc.id
                };
            }
        }
        
        throw new Error('Team not found');
    }

    /**
     * Get organization data
     */
    static async getOrganizationData(organizationId) {
        const orgDoc = await adminDb.collection('Organizations').doc(organizationId).get();
        if (!orgDoc.exists) {
            throw new Error('Organization not found');
        }
        return orgDoc.data();
    }

    /**
     * Get user data
     */
    static async getUserData(userId) {
        const userDoc = await adminDb.collection('AccountData').doc(userId).get();
        if (!userDoc.exists) {
            throw new Error('User not found');
        }
        return userDoc.data();
    }

    /**
     * Get user's contacts
     */
    static async getUserContacts(userId) {
        const contactDoc = await adminDb.collection('Contacts').doc(userId).get();
        if (!contactDoc.exists) {
            return [];
        }
        
        const data = contactDoc.data();
        return data.contacts || [];
    }

    /**
     * Update contact sharing metadata
     */
    static async updateContactSharing(userId, contactId, sharingData) {
        const contactDoc = await adminDb.collection('Contacts').doc(userId).get();
        if (!contactDoc.exists) {
            throw new Error('Contact document not found');
        }

        const data = contactDoc.data();
        const contacts = data.contacts || [];
        
        const contactIndex = contacts.findIndex(c => (c.id || c._id) === contactId);
        if (contactIndex === -1) {
            throw new Error('Contact not found');
        }

        // Update the contact's sharing information
        contacts[contactIndex] = {
            ...contacts[contactIndex],
            sharing: sharingData,
            lastModified: new Date().toISOString()
        };

        await contactDoc.ref.update({ contacts });
    }

    /**
     * Add shared contacts to user's contact list
     */
    static async addSharedContactsToUser(userId, contacts, sharingContext) {
        // This would depend on your specific implementation
        // You might store shared contacts separately or merge them
        // For now, we'll assume they're stored in a separate collection or field
        
        const userContactDoc = await adminDb.collection('Contacts').doc(userId).get();
        let userData = { contacts: [] };
        
        if (userContactDoc.exists) {
            userData = userContactDoc.data();
        }

        // Add shared contacts with special metadata
        const sharedContacts = contacts.map(contact => ({
            ...contact,
            isShared: true,
            sharedBy: sharingContext.sharedBy,
            sharedAt: sharingContext.sharedAt,
            teamId: sharingContext.teamId,
            accessLevel: sharingContext.accessLevel,
            originalId: contact.id || contact._id,
            id: `shared_${contact.id || contact._id}_${sharingContext.teamId}`
        }));

        // Merge with existing contacts (avoiding duplicates)
        const existingContacts = userData.contacts || [];
        const newContacts = [...existingContacts];

        for (const sharedContact of sharedContacts) {
            const exists = newContacts.some(c => 
                c.originalId === sharedContact.originalId && 
                c.teamId === sharedContact.teamId
            );
            
            if (!exists) {
                newContacts.push(sharedContact);
            }
        }

        await adminDb.collection('Contacts').doc(userId).set({
            contacts: newContacts
        }, { merge: true });
    }

    /**
     * Remove shared contact from user
     */
    static async removeSharedContactFromUser(userId, contactId) {
        const userContactDoc = await adminDb.collection('Contacts').doc(userId).get();
        if (!userContactDoc.exists) return;

        const userData = userContactDoc.data();
        const contacts = userData.contacts || [];

        // Remove shared contacts that match the original contact ID
        const filteredContacts = contacts.filter(contact => {
            if (!contact.isShared) return true;
            return contact.originalId !== contactId;
        });

        await userContactDoc.ref.update({ contacts: filteredContacts });
    }

    /**
     * Check if user can edit a specific contact
     */
    static canEditContact(userId, contact, teamData) {
        // Users can always edit their own contacts
        if (contact.originalOwner === userId) return true;
        
        // Check team permissions for shared contacts
        if (contact.isSharedContact) {
            return contact.accessLevel === 'edit' || contact.accessLevel === 'full_access';
        }
        
        return false;
    }

    /**
     * Log audit event
     */
    static async logAuditEvent(event) {
        try {
            const auditEntry = {
                ...event,
                timestamp: new Date().toISOString(),
                id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };

            await adminDb.collection('AuditLogs').doc(auditEntry.id).set(auditEntry);
        } catch (error) {
            console.error('Failed to log audit event:', error);
            // Don't throw here as audit logging shouldn't break the main operation
        }
    }
}