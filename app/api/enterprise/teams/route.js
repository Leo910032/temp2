// app/api/enterprise/teams/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// ✅ CORRECT: Import services and constants
import { 
  EnterpriseTeamService, 
  EnterprisePermissionService 
} from '@serviceEnterprise/server';
import { PERMISSIONS } from '@/lib/services/serviceEnterprise/constants/enterpriseConstants';


export async function GET(request) {
    try {
        const token = request.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userContext = await EnterprisePermissionService.getUserContext(decodedToken.uid);
        
        // If user isn't in an org or has no teams, return empty.
        if (!userContext.organizationId || Object.keys(userContext.teams).length === 0) {
            return NextResponse.json({ 
                teams: {}, 
                organizationId: userContext.organizationId, 
                userRole: userContext.organizationRole || 'employee'
            });
        }

        // Get the full organization document to enrich the team data
        const orgDoc = await adminDb.collection('Organizations').doc(userContext.organizationId).get();
        if (!orgDoc.exists) {
            return NextResponse.json({ teams: {} });
        }
        
        const allTeamsData = orgDoc.data().teams || {};
        const accessibleTeams = {};
        let highestRole = 'employee';
        
        for (const teamId in userContext.teams) {
            if (allTeamsData[teamId]) {
                const userTeamData = userContext.teams[teamId];
                const teamRole = userTeamData.role;
                
                const roleHierarchy = { owner: 4, manager: 3, team_lead: 2, employee: 1 };
                if ((roleHierarchy[teamRole] || 0) > (roleHierarchy[highestRole] || 0)) {
                    highestRole = teamRole;
                }
                
                accessibleTeams[teamId] = {
                    ...allTeamsData[teamId],
                    id: teamId,
                    memberCount: Object.keys(allTeamsData[teamId].members || {}).length,
                    role: teamRole,
                    permissions: userTeamData.permissions,
                };
            }
        }

        return NextResponse.json({
            teams: accessibleTeams,
            organizationId: userContext.organizationId,
            organizationName: orgDoc.data().name,
            userRole: highestRole,
            organizationRole: userContext.organizationRole,
            teamCount: Object.keys(accessibleTeams).length
        });
        
    } catch (error) {
        console.error('❌ API Error in GET /api/enterprise/teams:', error);
        return NextResponse.json({ error: error.message, teams: {} }, { status: 500 });
    }
}


// ✅ CORRECTED POST HANDLER
export async function POST(request) {
    const requestId = `create-team-${Math.random().toString(36).substring(7)}`;
    try {
        console.log(`[${requestId}] 🚀 Create team request received.`);

        // 1. Authentication
        const token = request.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;
        
        // 2. Input Validation
        const body = await request.json();
        const { name, description } = body;
        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Team name is required.' }, { status: 400 });
        }
        
        // 3. Authorization (DELEGATED TO SERVICE)
        console.log(`[${requestId}] 🛡️ Checking permissions for user: ${userId}`);
        
        // The EnterpriseTeamService.createTeam should internally check permissions.
        // For an extra layer of security at the API boundary, we can check here too.
        const userContext = await EnterprisePermissionService.getUserContext(userId);
        
        if (!userContext.organizationId) {
            return NextResponse.json({ error: 'You must belong to an organization to create a team.' }, { status: 403 });
        }
        
        // Use the permission service to check if the user has the 'CAN_CREATE_TEAMS' permission.
        const canCreateTeams = EnterprisePermissionService.hasPermission(userContext, PERMISSIONS.CAN_CREATE_TEAMS);

        if (!canCreateTeams) {
            console.warn(`[${requestId}] 🚫 Permission denied for user ${userId} to create teams.`);
            return NextResponse.json({ error: 'You do not have permission to create new teams.' }, { status: 403 });
        }
        
        console.log(`[${requestId}] ✅ Permission granted. Creating team...`);

        // 4. Core Logic (DELEGATED TO SERVICE)
        // The service layer handles creating the team, adding the creator as manager, and logging the audit event.
        const newTeam = await EnterpriseTeamService.createTeam(
            userId,
            userContext.organizationId,
            { name, description } // Pass details as an object
        );
        
        console.log(`[${requestId}] ✅ Team "${name}" created successfully with ID: ${newTeam.id}`);

        // 5. Success Response
        return NextResponse.json(newTeam, { status: 201 }); // 201 Created

    } catch (error) {
        console.error(`[${requestId}] ❌ API Error in POST /api/enterprise/teams:`, error);
        
        if (error.message.includes('permission')) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('already exists')) {
            return NextResponse.json({ error: error.message }, { status: 409 }); // 409 Conflict
        }
        
        return NextResponse.json({ error: 'An internal error occurred while creating the team.' }, { status: 500 });
    }
}