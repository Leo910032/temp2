// Create this file: app/api/debug/user-context/route.js
// This will help us debug what's happening with user roles

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { EnterprisePermissionService } from '@serviceEnterprise/server';

export async function POST(request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        const { userId } = await request.json();
        const targetUserId = userId || decodedToken.uid;

        console.log('🐛 DEBUG API: Fetching context for user:', targetUserId);

        // Get raw user document
        const userDoc = await adminDb.collection('AccountData').doc(targetUserId).get();
        const rawUserData = userDoc.exists ? userDoc.data() : null;

        // Get processed user context
        const userContext = await EnterprisePermissionService.getUserContext(targetUserId);

        // Get organization data for comparison
        let orgData = null;
        if (userContext.organizationId) {
            const orgDoc = await adminDb.collection('Organizations').doc(userContext.organizationId).get();
            orgData = orgDoc.exists ? orgDoc.data() : null;
        }

        // Debug info
        const debugInfo = {
            requestedUserId: targetUserId,
            timestamp: new Date().toISOString(),
            
            // Raw data
            rawUserExists: userDoc.exists,
            rawUserEnterprise: rawUserData?.enterprise,
            
            // Processed context
            userContext: {
                userId: userContext.userId,
                organizationId: userContext.organizationId,
                organizationRole: userContext.organizationRole,
                teams: userContext.teams,
                isSystemAdmin: userContext.isSystemAdmin
            },
            
            // Organization data for comparison
            organizationExists: !!orgData,
            organizationTeams: orgData ? Object.keys(orgData.teams || {}) : [],
            
            // Team-specific debug for each team the user is in
            teamDetails: {}
        };

        // For each team the user is in, show both perspectives
        if (userContext.teams) {
            for (const [teamId, userTeamData] of Object.entries(userContext.teams)) {
                debugInfo.teamDetails[teamId] = {
                    userPerspective: userTeamData,
                    orgPerspective: orgData?.teams?.[teamId]?.members?.[targetUserId] || null,
                    dataMatch: {
                        roleMatches: userTeamData.role === orgData?.teams?.[teamId]?.members?.[targetUserId]?.role,
                        userRole: userTeamData.role,
                        orgRole: orgData?.teams?.[teamId]?.members?.[targetUserId]?.role
                    }
                };
            }
        }

        console.log('🐛 DEBUG API: Context comparison:', debugInfo);

        return NextResponse.json({
            success: true,
            debug: debugInfo
        });

    } catch (error) {
        console.error('🐛 DEBUG API: Error:', error);
        return NextResponse.json({ 
            error: error.message,
            debug: {
                errorOccurred: true,
                errorMessage: error.message,
                timestamp: new Date().toISOString()
            }
        }, { status: 500 });
    }
}
