// lib/services/serviceEnterprise/server/enterpriseInvitationService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { enterpriseConfig } from '../../../config/enterpriseConfig';
import { EnterpriseSecurityService } from './enterpriseSecurityService';
import { DEFAULT_PERMISSIONS_BY_ROLE, INVITATION_STATUS } from '@/lib/services/serviceEnterprise/constants/enterpriseConstants';
import crypto from 'crypto';

// Import your email services
import { EmailJs } from '@/lib/EmailJs';
import { teamInvitationEmail } from '@/lib/emailTemplate';

export class EnterpriseInvitationService {
    
    static _generateInviteCode() {
        return crypto.randomBytes(3).toString('hex').toUpperCase();
    }

    static async createInvitation(inviterId, organizationId, teamId, invitedEmail, role) {
        console.log('📧 Creating invitation for:', { invitedEmail, teamId, role });

        // ✅ ENHANCED: Check for existing invitations and handle them gracefully
        const existingInviteQuery = await adminDb.collection('TeamInvitations')
            .where('teamId', '==', teamId)
            .where('invitedEmail', '==', invitedEmail.toLowerCase())
            .where('status', 'in', [INVITATION_STATUS.PENDING, INVITATION_STATUS.EXPIRED])
            .get();
            
        if (!existingInviteQuery.empty) {
            const existingInvite = existingInviteQuery.docs[0];
            const existingData = existingInvite.data();
            
            console.log('⚠️ Found existing invitation:', {
                id: existingInvite.id,
                status: existingData.status,
                createdAt: existingData.createdAt,
                expiresAt: existingData.expiresAt
            });

            // If it's expired, we can reuse it
            if (existingData.status === INVITATION_STATUS.EXPIRED) {
                console.log('🔄 Reusing expired invitation');
                
                const newInviteCode = this._generateInviteCode();
                const newExpiresAt = new Date(Date.now() + (enterpriseConfig.invitations?.expirationDays || 7) * 24 * 60 * 60 * 1000);
                const permissions = DEFAULT_PERMISSIONS_BY_ROLE[role] || DEFAULT_PERMISSIONS_BY_ROLE.employee;

                // Update the existing invitation
                await existingInvite.ref.update({
                    role,
                    permissions,
                    inviteCode: newInviteCode,
                    status: INVITATION_STATUS.PENDING,
                    expiresAt: newExpiresAt,
                    updatedAt: FieldValue.serverTimestamp(),
                    resentCount: (existingData.resentCount || 0) + 1
                });

                // Send email for renewed invitation
                await this._sendInvitationEmail(inviterId, organizationId, teamId, invitedEmail, newInviteCode, 'renewed');

                await EnterpriseSecurityService.logAuditEvent({
                    userId: inviterId,
                    organizationId,
                    action: 'invitation_renewed',
                    resourceType: 'invitation',
                    resourceId: existingInvite.id,
                    details: { invitedEmail, teamId, role }
                });

                return { 
                    id: existingInvite.id, 
                    ...existingData,
                    role,
                    permissions,
                    inviteCode: newInviteCode,
                    status: INVITATION_STATUS.PENDING,
                    expiresAt: newExpiresAt,
                    resentCount: (existingData.resentCount || 0) + 1
                };
            }
            
            // If it's still pending, throw an error with details
            throw new Error(`Pending invitation already exists for this email. Created on ${existingData.createdAt?.toDate?.()?.toLocaleDateString() || 'unknown date'}.`);
        }

        // Create new invitation
        const inviteCode = this._generateInviteCode();
        const expiresAt = new Date(Date.now() + (enterpriseConfig.invitations?.expirationDays || 7) * 24 * 60 * 60 * 1000);
        const permissions = DEFAULT_PERMISSIONS_BY_ROLE[role] || DEFAULT_PERMISSIONS_BY_ROLE.employee;

        const newInvitation = { 
            organizationId, 
            teamId, 
            invitedEmail: invitedEmail.toLowerCase(), 
            invitedBy: inviterId, 
            inviteCode, 
            role, 
            permissions, 
            status: INVITATION_STATUS.PENDING, 
            createdAt: FieldValue.serverTimestamp(), 
            expiresAt,
            resentCount: 0
        };
        
        const docRef = await adminDb.collection('TeamInvitations').add(newInvitation);

        // Send invitation email
        await this._sendInvitationEmail(inviterId, organizationId, teamId, invitedEmail, inviteCode, 'new');

        // Log audit event
  await EnterpriseSecurityService.logAuditEvent({ 
    userId: inviterId, 
    organizationId, 
    action: 'invitation_sent', 
    resourceType: 'team',      // ✅ Correct: The event happened TO the team
    resourceId: teamId,        // ✅ Correct: The ID of the resource is the team's ID
    details: { 
        invitedEmail, 
        role,
        invitationId: docRef.id // Add the specific invitation ID to the details for context
    } 
});
        
        console.log('✅ Invitation created successfully:', docRef.id);
        
        return { id: docRef.id, ...newInvitation };
    }

    /**
     * ✅ NEW: Resend invitation method
     */
    static async resendInvitation(invitationId, resenderId = null) {
        console.log('📧 Resending invitation:', { invitationId, resenderId });

        const inviteRef = adminDb.collection('TeamInvitations').doc(invitationId);
        const inviteDoc = await inviteRef.get();
        
        if (!inviteDoc.exists) {
            throw new Error('Invitation not found.');
        }

        const invitation = inviteDoc.data();
        const { organizationId, teamId, invitedEmail, role } = invitation;

        // Validate invitation can be resent
        if (invitation.status === INVITATION_STATUS.ACCEPTED) {
            throw new Error('Cannot resend an already accepted invitation.');
        }
        
        if (invitation.status === INVITATION_STATUS.REVOKED) {
            throw new Error('Cannot resend a revoked invitation.');
        }

        // Check resend limits (optional)
        const maxResends = enterpriseConfig.invitations?.maxResends || 5;
        const currentResendCount = invitation.resentCount || 0;
        
        if (currentResendCount >= maxResends) {
            throw new Error(`Maximum resend limit (${maxResends}) reached for this invitation.`);
        }

        // Generate new invite code and extend expiration
        const newInviteCode = this._generateInviteCode();
        const newExpiresAt = new Date(Date.now() + (enterpriseConfig.invitations?.expirationDays || 7) * 24 * 60 * 60 * 1000);

        // Update invitation with new details
        await inviteRef.update({
            inviteCode: newInviteCode,
            status: INVITATION_STATUS.PENDING,
            expiresAt: newExpiresAt,
            lastResentAt: FieldValue.serverTimestamp(),
            resentCount: currentResendCount + 1,
            ...(resenderId && { lastResentBy: resenderId })
        });

        // Send new invitation email
        await this._sendInvitationEmail(
            resenderId || invitation.invitedBy, 
            organizationId, 
            teamId, 
            invitedEmail, 
            newInviteCode, 
            'resent'
        );

// Replace it with this corrected version:
await EnterpriseSecurityService.logAuditEvent({
    userId: resenderId || invitation.invitedBy,
    organizationId,
    action: 'invitation_resent',
    resourceType: 'team',       // ✅ Correct
    resourceId: teamId,         // ✅ Correct
    details: { 
        invitedEmail, 
        role,
        invitationId: invitationId, // Add for context
        resentCount: currentResendCount + 1
    }
});

        console.log('✅ Invitation resent successfully:', invitationId);

        return {
            id: invitationId,
            inviteCode: newInviteCode,
            expiresAt: newExpiresAt,
            resentCount: currentResendCount + 1
        };
    }

   // Enhanced _sendInvitationEmail method for enterpriseInvitationService.js

static async _sendInvitationEmail(inviterId, organizationId, teamId, invitedEmail, inviteCode, type = 'new') {
    try {
        console.log('📧 Starting invitation email process:', {
            inviterId,
            organizationId,
            teamId,
            invitedEmail,
            inviteCode,
            type
        });

        const [inviterDoc, orgDoc] = await Promise.all([
            adminDb.collection('AccountData').doc(inviterId).get(),
            adminDb.collection('Organizations').doc(organizationId).get()
        ]);
        
        if (inviterDoc.exists && orgDoc.exists) {
            const inviterName = inviterDoc.data().displayName || 'Your Manager';
            const orgData = orgDoc.data();
            const orgName = orgData.name;
            const teamName = orgData.teams?.[teamId]?.name || 'Unknown Team';

            // URL construction with debugging
            const baseUrl = process.env.APP_URL || 'http://localhost:3000';
            const acceptUrl = `${baseUrl}/join-team?code=${inviteCode}`;
            
            console.log('🔗 URL Generation Debug:', {
                NODE_ENV: process.env.NODE_ENV,
                APP_URL: process.env.APP_URL,
                baseUrl,
                inviteCode,
                acceptUrl
            });
            
            // Email subjects
            const subjects = {
                new: `You're invited to join ${teamName}!`,
                resent: `Reminder: Join ${teamName} (New Invitation Code)`,
                renewed: `Updated invitation to join ${teamName}`
            };
            
            // ✅ FIXED: Pass the inviteCode parameter correctly
            const emailHtml = teamInvitationEmail(
                inviterName, 
                teamName, 
                orgName, 
                acceptUrl, 
                type,
                inviteCode  // ✅ This was missing!
            );
            
            console.log('📧 Email parameters:', {
                inviterName,
                teamName,
                orgName,
                acceptUrl,
                type,
                inviteCode,
                subject: subjects[type] || subjects.new
            });
            
            // Send the email
            await EmailJs(invitedEmail, invitedEmail, subjects[type] || subjects.new, emailHtml);
            console.log(`✅ ${type} invitation email sent successfully to ${invitedEmail} with code ${inviteCode}`);
            
        } else {
            console.warn('⚠️ Missing inviter or organization data:', {
                inviterExists: inviterDoc.exists,
                orgExists: orgDoc.exists,
                inviterId,
                organizationId
            });
        }
        
    } catch (emailError) {
        console.error(`❌ Failed to send ${type} invitation email:`, {
            error: emailError.message,
            stack: emailError.stack,
            invitedEmail,
            inviteCode,
            type
        });
        // Don't throw - invitation creation should succeed even if email fails
    }
}

    static async verifyInvitation(email, code) {
        const inviteQuery = await adminDb.collection('TeamInvitations')
            .where('invitedEmail', '==', email.toLowerCase())
            .where('inviteCode', '==', code.toUpperCase())
            .limit(1)
            .get();
        
        if (inviteQuery.empty) {
            throw new Error('Invalid or expired invitation code. Please check your code and try again.');
        }
        
        const inviteDoc = inviteQuery.docs[0];
        const invitation = { id: inviteDoc.id, ...inviteDoc.data() };

        // ✅ Better status handling and user-friendly messages
        if (invitation.status === INVITATION_STATUS.ACCEPTED) {
            throw new Error('This invitation has already been accepted. You are likely already a member of this team. Please check your team dashboard or contact your manager if you need assistance.');
        }
        
        if (invitation.status === INVITATION_STATUS.EXPIRED) {
            throw new Error('This invitation has expired. Please request a new invitation from your team manager.');
        }
        
        if (invitation.status === INVITATION_STATUS.REVOKED) {
            throw new Error('This invitation has been revoked. Please contact your team manager for assistance.');
        }
        
        if (invitation.status !== INVITATION_STATUS.PENDING) {
            throw new Error(`Invitation is no longer valid. Status: ${invitation.status}`);
        }
        
        // ✅ Better expiration handling
        const expiresAt = invitation.expiresAt.toDate ? invitation.expiresAt.toDate() : new Date(invitation.expiresAt);
        if (new Date() > expiresAt) {
            // Mark as expired in database to prevent future attempts
            try {
                await inviteDoc.ref.update({ 
                    status: INVITATION_STATUS.EXPIRED,
                    expiredAt: FieldValue.serverTimestamp()
                });
            } catch (updateError) {
                console.warn('Failed to update expired invitation status:', updateError.message);
            }
            throw new Error('This invitation has expired. Please request a new invitation from your team manager.');
        }

        return invitation;
    }

    static async acceptInvitation(accepterId, invitationId) {
        // ✅ Use transaction to prevent race conditions
    return await adminDb.runTransaction(async (transaction) => {
        const inviteRef = adminDb.collection('TeamInvitations').doc(invitationId);
        const inviteDoc = await transaction.get(inviteRef);
        
        if (!inviteDoc.exists) {
            throw new Error('Invitation not found.');
        }

        const invitation = inviteDoc.data();
        const { organizationId, teamId, role, permissions, invitedBy } = invitation;

            // Validate invitation status
            if (invitation.status === INVITATION_STATUS.ACCEPTED) {
                throw new Error('This invitation has already been accepted. You are already a member of this team.');
            }
            
            if (invitation.status !== INVITATION_STATUS.PENDING) {
                throw new Error(`Cannot accept invitation. Current status: ${invitation.status}`);
            }

            // Check expiration within transaction
            const expiresAt = invitation.expiresAt.toDate ? invitation.expiresAt.toDate() : new Date(invitation.expiresAt);
            if (new Date() > expiresAt) {
                transaction.update(inviteRef, { 
                    status: INVITATION_STATUS.EXPIRED,
                    expiredAt: FieldValue.serverTimestamp()
                });
                throw new Error('This invitation has expired and cannot be accepted.');
            }

            const orgRef = adminDb.collection('Organizations').doc(organizationId);
            const userRef = adminDb.collection('AccountData').doc(accepterId);

            // Get current organization and user data
            const [orgDoc, userDoc] = await Promise.all([
                transaction.get(orgRef),
                transaction.get(userRef)
            ]);
            
            if (!orgDoc.exists) {
                throw new Error('Organization not found.');
            }
            
            if (!userDoc.exists) {
                throw new Error('User not found.');
            }

            const userData = userDoc.data();
            const orgData = orgDoc.data();
            
            // Check if user is already a team member
            const existingMember = orgData.teams?.[teamId]?.members?.[accepterId];
            if (existingMember) {
                // Update invitation status to accepted since user is already a member
                transaction.update(inviteRef, {
                    status: INVITATION_STATUS.ACCEPTED,
                    acceptedAt: FieldValue.serverTimestamp(),
                    acceptedBy: accepterId
                });
                throw new Error('You are already a member of this team.');
            }
            
            // Update user's account type to business if not already
            const updates = {
                'enterprise.organizationId': organizationId,
                'enterprise.organizationRole': userData?.enterprise?.organizationRole || role,
                [`enterprise.teams.${teamId}`]: {
                    role,
                    permissions,
                    joinedAt: FieldValue.serverTimestamp()
                },
                accountType: 'enterprise', // Ensure they have enterprise access
                updatedAt: FieldValue.serverTimestamp()
            };

            // Add user to team in Organization doc
            transaction.update(orgRef, {
                [`teams.${teamId}.members.${accepterId}`]: {
                    role,
                    joinedAt: FieldValue.serverTimestamp(),
                    invitedBy: invitation.invitedBy,
                    permissions
                }
            });

            // Add team to user's profile
            transaction.update(userRef, updates);
            
            // Update invitation status
             transaction.update(inviteRef, {
            status: INVITATION_STATUS.ACCEPTED,
            acceptedAt: FieldValue.serverTimestamp(),
            acceptedBy: accepterId
        })

        return { success: true, teamId, organizationId, role, invitedBy };
        }).then(async (result) => {
        // ✅ THE FIX: Log the correct audit event AFTER the transaction succeeds.
        if (result.success) {
            try {
                await EnterpriseSecurityService.logAuditEvent({
                    userId: result.invitedBy, // The user who SENT the invite performed the action
                    organizationId: result.organizationId,
                    action: 'invitation_accepted',
                    resourceType: 'team',       // Log against the TEAM
                    resourceId: result.teamId,  // The ID of the team
                    details: { 
                        acceptedByUserId: accepterId, // Who accepted it
                        role: result.role,
                        invitationId: invitationId,
                        description: `Invitation was accepted by a new member.`
                    }
                });
            } catch (auditError) {
                console.warn('Failed to log invitation_accepted audit event:', auditError.message);
            }
        }
        
        // Return only what the client needs
        return { success: true, teamId: result.teamId, organizationId: result.organizationId };
    });
}

    static async getInvitationsForTeam(teamId) {
        const snapshot = await adminDb.collection('TeamInvitations')
            .where('teamId', '==', teamId)
            .where('status', '==', INVITATION_STATUS.PENDING)
            .orderBy('createdAt', 'desc')
            .get();
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // ✅ ADD THIS NEW METHOD for the user banner
    static async getInvitationsForUser(userEmail) {
        const snapshot = await adminDb.collection('TeamInvitations')
            .where('invitedEmail', '==', userEmail.toLowerCase())
            .where('status', '==', INVITATION_STATUS.PENDING)
            .get();
        
        if (snapshot.empty) {
            return [];
        }
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // ✅ ADD THIS NEW HELPER METHOD to get team/org names
    static async enhanceInvitations(invitations) {
        if (!invitations || invitations.length === 0) return [];

        const organizationIds = [...new Set(invitations.map(inv => inv.organizationId))];
        
        const orgDocsPromises = organizationIds.map(id => adminDb.collection('Organizations').doc(id).get());
        const orgDocs = await Promise.all(orgDocsPromises);

        const organizationsMap = new Map();
        orgDocs.forEach(doc => {
            if (doc.exists) {
                organizationsMap.set(doc.id, doc.data());
            }
        });

        return invitations.map(invitation => {
            const organization = organizationsMap.get(invitation.organizationId);
            const team = organization?.teams?.[invitation.teamId];

            return {
                id: invitation.id,
                teamName: team?.name || 'an unknown team',
                organizationName: organization?.name || 'an organization',
                role: invitation.role,
                expiresAt: invitation.expiresAt, // Pass the original timestamp
            };
        });
    }
    static async revokeInvitation(revokerId, organizationId, invitationId, teamId = null) {
        const inviteRef = adminDb.collection('TeamInvitations').doc(invitationId);
        const inviteDoc = await inviteRef.get();
        
        if (!inviteDoc.exists) {
            throw new Error('Invitation not found.');
        }
        
        const invitation = inviteDoc.data();
        
        if (invitation.status !== INVITATION_STATUS.PENDING) {
            throw new Error(`Cannot revoke invitation. Current status: ${invitation.status}`);
        }
        
        await inviteRef.update({
            status: INVITATION_STATUS.REVOKED,
            revokedAt: FieldValue.serverTimestamp(),
            revokedBy: revokerId
        });

      await EnterpriseSecurityService.logAuditEvent({
    userId: revokerId,
    organizationId,
    action: 'invitation_revoked',
    resourceType: 'team',       // ✅
    resourceId: teamId,         // ✅
    details: { 
        revokedInvitationId: invitationId,
        invitedEmail: invitation.invitedEmail // Add for more context
    }
});
    }

    static async getInvitationById(invitationId) {
        const inviteRef = adminDb.collection('TeamInvitations').doc(invitationId);
        const inviteDoc = await inviteRef.get();
        
        if (!inviteDoc.exists) {
            return null;
        }
        
        return { id: inviteDoc.id, ...inviteDoc.data() };
    }

    static async getInvitationsForOrganization(organizationId, status = null) {
        let query = adminDb.collection('TeamInvitations')
            .where('organizationId', '==', organizationId);
            
        if (status) {
            query = query.where('status', '==', status);
        }
        
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // ✅ Utility method to clean up expired invitations
    static async cleanupExpiredInvitations() {
        const now = new Date();
        const expiredQuery = await adminDb.collection('TeamInvitations')
            .where('status', '==', INVITATION_STATUS.PENDING)
            .where('expiresAt', '<', now)
            .get();
        
        const batch = adminDb.batch();
        let updateCount = 0;
        
        expiredQuery.docs.forEach(doc => {
            batch.update(doc.ref, { 
                status: INVITATION_STATUS.EXPIRED,
                expiredAt: FieldValue.serverTimestamp()
            });
            updateCount++;
        });
        
        if (updateCount > 0) {
            await batch.commit();
            console.log(`✅ Marked ${updateCount} expired invitations`);
        }
        
        return updateCount;
    }

    // ✅ NEW: Get existing invitation for email/team combination
    static async getExistingInvitation(teamId, invitedEmail) {
        const inviteQuery = await adminDb.collection('TeamInvitations')
            .where('teamId', '==', teamId)
            .where('invitedEmail', '==', invitedEmail.toLowerCase())
            .where('status', 'in', [INVITATION_STATUS.PENDING, INVITATION_STATUS.EXPIRED])
            .limit(1)
            .get();
            
        if (inviteQuery.empty) {
            return null;
        }
        
        const inviteDoc = inviteQuery.docs[0];
        return { id: inviteDoc.id, ...inviteDoc.data() };
    }

    // ✅ NEW: Bulk operations for invitations
    static async bulkResendInvitations(invitationIds, resenderId) {
        const results = [];
        
        for (const invitationId of invitationIds) {
            try {
                const result = await this.resendInvitation(invitationId, resenderId);
                results.push({ id: invitationId, success: true, result });
            } catch (error) {
                results.push({ id: invitationId, success: false, error: error.message });
            }
        }
        
        return results;
    }

    static async bulkRevokeInvitations(invitationIds, revokerId, organizationId) {
        const batch = adminDb.batch();
        const results = [];
        
        for (const invitationId of invitationIds) {
            try {
                const inviteRef = adminDb.collection('TeamInvitations').doc(invitationId);
                const inviteDoc = await inviteRef.get();
                
                if (inviteDoc.exists && inviteDoc.data().status === INVITATION_STATUS.PENDING) {
                    batch.update(inviteRef, {
                        status: INVITATION_STATUS.REVOKED,
                        revokedAt: FieldValue.serverTimestamp(),
                        revokedBy: revokerId
                    });
                    results.push({ id: invitationId, success: true });
                } else {
                    results.push({ id: invitationId, success: false, error: 'Invalid invitation status' });
                }
            } catch (error) {
                results.push({ id: invitationId, success: false, error: error.message });
            }
        }
        
        if (results.some(r => r.success)) {
            await batch.commit();
            
            // Log bulk audit event
            await EnterpriseSecurityService.logAuditEvent({
                userId: revokerId,
                organizationId,
                action: 'bulk_invitations_revoked',
                resourceType: 'invitation',
                details: { 
                    revokedCount: results.filter(r => r.success).length,
                    totalAttempted: invitationIds.length 
                }
            });
        }
        
        return results;
    }
}