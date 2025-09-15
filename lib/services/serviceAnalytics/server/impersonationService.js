// lib/services/server/impersonationService.js

import { adminDb } from '@/lib/firebaseAdmin';
import { AnalyticsService } from './analyticsService'; // ✅ Import our new Analytics service
import { PERMISSIONS } from '../constants/analyticsConstants'; // ✅ Import permissions from the barrel file

// ✅ NOTE: These would ideally be in their own dedicated enterprise/team service file,
// but for now, we can keep them here as private helpers for this service.
import { 
    validateTeamPermission,
    checkUserTeamMembership 
} from '../serviceEnterprise/server/enterprisePermissionService'; 
import { logSecurityEvent } from '../serviceEnterprise/server/enterpriseSecurityService';
import { createAuditLogEntry } from '../serviceEnterprise/server/enterpriseAuditService';


export class ImpersonationService {
    /**
     * Securely fetches analytics for a target user on behalf of a manager.
     * This function is the gatekeeper for all impersonation actions.
     * @param {object} options
     * @param {string} options.managerId - The UID of the user performing the action.
     * @param {string} options.targetUserId - The UID of the user whose data is being requested.
     * @param {string} options.teamId - The ID of the team that provides the context for the permission.
     * @param {object} options.requestMetadata - Optional metadata like IP address for logging.
     * @returns {Promise<object>} The processed analytics data, including impersonation context.
     */
    static async getImpersonatedAnalytics({ managerId, targetUserId, teamId, requestMetadata = {} }) {
        console.log(`[ImpersonationService] 🛡️ Initiating impersonation check: Manager ${managerId} -> Target ${targetUserId} in Team ${teamId}`);

        // --- 1. Permission Validation ---
        const hasViewPermission = await validateTeamPermission(
            managerId, 
            teamId, 
            PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS
        );

        if (!hasViewPermission) {
            await this._logSecurityEvent({ managerId, targetUserId, teamId, reason: 'Insufficient permissions', ...requestMetadata });
            throw new Error('Insufficient permissions to view team member analytics');
        }
        console.log(`[ImpersonationService] ✅ Permission check passed.`);

        // --- 2. Team Membership Verification ---
        const [isTargetInTeam, isManagerInTeam] = await Promise.all([
            checkUserTeamMembership(targetUserId, teamId),
            checkUserTeamMembership(managerId, teamId)
        ]);
        
        if (!isTargetInTeam || !isManagerInTeam) {
            await this._logSecurityEvent({ managerId, targetUserId, teamId, reason: 'Team membership mismatch', ...requestMetadata });
            throw new Error('User is not a member of the specified team');
        }
        console.log(`[ImpersonationService] ✅ Team membership verified.`);
        
        // --- 3. Fetch Data using the AnalyticsService ---
        // If all checks pass, we delegate the actual data fetching.
        console.log(`[ImpersonationService] 📊 Delegating to AnalyticsService for user ${targetUserId}`);
        const analyticsData = await AnalyticsService.getAnalyticsForUser({ userId: targetUserId });
        
        // --- 4. Fetch Target User's Display Info ---
        const targetUserDoc = await adminDb.collection('AccountData').doc(targetUserId).get();
        if (!targetUserDoc.exists()) {
            throw new Error('Target user account not found');
        }
        const targetUserData = targetUserDoc.data();
        
        // --- 5. Audit Logging ---
        await createAuditLogEntry({
            teamId,
            action: 'ANALYTICS_IMPERSONATION',
            performedBy: managerId,
            targetUserId: targetUserId,
            details: {
                accessReason: 'Manager viewing team member analytics'
            },
            metadata: {
                ipAddress: requestMetadata.ipAddress || 'unknown',
                userAgent: requestMetadata.userAgent || 'unknown'
            }
        });
        console.log(`[ImpersonationService] ✅ Audit log created.`);

        // --- 6. Construct Final Response ---
        // Combine the fetched analytics data with the context of the impersonation.
        return {
            ...analyticsData,
            impersonationContext: {
                targetUserId,
                targetUserData: {
                    username: targetUserData.username,
                    displayName: targetUserData.displayName || targetUserData.username
                },
                managerId,
                teamId,
                accessTimestamp: new Date().toISOString(),
            }
        };
    }
    
    /**
     * Private helper for logging security events.
     */
    static async _logSecurityEvent({ managerId, targetUserId, teamId, reason, ipAddress }) {
        try {
            await logSecurityEvent({
                userId: managerId,
                action: 'UNAUTHORIZED_IMPERSONATION_ATTEMPT',
                details: { targetUserId, teamId, reason },
                severity: 'HIGH',
                ipAddress: ipAddress || 'unknown'
            });
        } catch (logError) {
            console.error(`[ImpersonationService] 🚨 FAILED TO LOG SECURITY EVENT:`, logError);
        }
    }
}