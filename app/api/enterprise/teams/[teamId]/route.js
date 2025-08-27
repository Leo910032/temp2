// app/api/enterprise/teams/[teamId]/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

// ✅ NEW: Clean imports using the serviceEnterprise alias
import { 
  EnterpriseTeamService,
  EnterprisePermissionService,
  EnterpriseOrganizationService
} from '@serviceEnterprise/server';

export async function PUT(request, { params }) {
    try {
        const { teamId } = params;
        const token = request.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decodedToken = await adminAuth.verifyIdToken(token);

        const userContext = await EnterprisePermissionService.getUserContext(decodedToken.uid);
        const org = await EnterpriseOrganizationService.getOrganizationDetails(userContext.organizationId);
        const teamData = org.teams?.[teamId];
        if (!teamData) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

        if (!EnterprisePermissionService.canManageTeam(userContext, {id: teamId, ...teamData})) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        
        const body = await request.json();
        const updatedTeam = await EnterpriseTeamService.updateTeam(decodedToken.uid, userContext.organizationId, teamId, body);

        return NextResponse.json(updatedTeam);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const { teamId } = params;
        const token = request.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        const userContext = await EnterprisePermissionService.getUserContext(decodedToken.uid);
        const org = await EnterpriseOrganizationService.getOrganizationDetails(userContext.organizationId);
        const teamData = org.teams?.[teamId];
        if (!teamData) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

        if (!EnterprisePermissionService.canManageTeam(userContext, {id: teamId, ...teamData})) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        await EnterpriseTeamService.deleteTeam(decodedToken.uid, userContext.organizationId, teamId);

        return NextResponse.json({ success: true, message: 'Team deleted' });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}