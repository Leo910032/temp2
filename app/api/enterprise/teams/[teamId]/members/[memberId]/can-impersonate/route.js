// app/api/enterprise/teams/[teamId]/members/[memberId]/can-impersonate/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

// ✅ Import your existing enterprise services
import { 
    validateTeamPermission,
    checkUserTeamMembership 
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

        // ✅ Quick permission checks
        const [hasViewPermission, isManagerInTeam, isTargetInTeam] = await Promise.all([
            validateTeamPermission(managerId, teamId, PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS),
            checkUserTeamMembership(managerId, teamId),
            checkUserTeamMembership(memberId, teamId)
        ]);

        const canImpersonate = hasViewPermission && isManagerInTeam && isTargetInTeam && managerId !== memberId;

        console.log(`[${requestId}] ✅ Impersonation check result: ${canImpersonate}`);

        return NextResponse.json({
            canImpersonate,
            teamId,
            memberId,
            reasons: {
                hasViewPermission,
                isManagerInTeam,
                isTargetInTeam,
                isNotSelf: managerId !== memberId
            }
        });

    } catch (error) {
        console.error(`[${requestId}] ❌ Impersonation permission check error:`, error);
        return NextResponse.json({ 
            canImpersonate: false,
            error: 'Permission check failed'
        }, { status: 500 });
    }
}
