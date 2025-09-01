// app/api/enterprise/teams/[teamId]/members/[memberId]/can-impersonate/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

// ✅ Import the specific helpers we need, including the new role function
import { 
    EnterprisePermissionService, // Import the full service to access static methods
    validateTeamPermission,
    checkUserTeamMembership,
    getUserTeamRole as getTeamRole // Use an alias to avoid naming conflicts
} from '@/lib/services/serviceEnterprise/server/enterprisePermissionService';
import { 
    PERMISSIONS 
} from '@/lib/services/serviceEnterprise/constants/enterpriseConstants';

/**
 * GET /api/enterprise/teams/[teamId]/members/[memberId]/can-impersonate
 * Check if current user can impersonate analytics for a team member
 */
export async function GET(request, { params }) {
    const requestId = `can-impersonate-${Math.random().toString(36).substring(2, 9)}`;
    
    try {
        // ✅ Authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const managerId = decodedToken.uid;
        const { teamId, memberId } = params;

        console.log(`[${requestId}] 🔒 Checking impersonation permissions: ${managerId} -> ${memberId} in team ${teamId}`);

        // Prevent self-impersonation early
        if (managerId === memberId) {
            return NextResponse.json({ canImpersonate: false, reasons: { isNotSelf: false } });
        }

         // 1. Basic permission checks (are both users in the team and does the manager have the base permission?)
        const [hasViewPermission, isManagerInTeam, isTargetInTeam] = await Promise.all([
            validateTeamPermission(managerId, teamId, PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS),
            checkUserTeamMembership(managerId, teamId),
            checkUserTeamMembership(memberId, teamId)
        ]);
        // If basic checks fail, deny immediately.
        if (!hasViewPermission || !isManagerInTeam || !isTargetInTeam) {
            return NextResponse.json({
                canImpersonate: false,
                reasons: { hasViewPermission, isManagerInTeam, isTargetInTeam, hierarchyCheckPassed: false }
            });
        }

        // 2. ✅ HIERARCHY CHECK: Get both users' roles and compare them.
        const [managerRole, targetRole] = await Promise.all([
            getTeamRole(managerId, teamId),
            getTeamRole(memberId, teamId)
        ]);

        const hierarchyCheckPassed = EnterprisePermissionService.canManageRole(managerRole, targetRole);
        const canImpersonate = hierarchyCheckPassed;

        console.log(`[${requestId}] ✅ Impersonation check result: ${canImpersonate}`);

        return NextResponse.json({
            canImpersonate,
            reasons: {
                hasViewPermission,
                isManagerInTeam,
                isTargetInTeam,
                hierarchyCheckPassed,
                managerRole,
                targetRole
            }
        });

    } catch (error) {
        console.error(`Impersonation permission check error:`, error);
        return NextResponse.json({ canImpersonate: false, error: 'Permission check failed' }, { status: 500 });
    }
}