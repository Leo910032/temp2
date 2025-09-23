/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { EnterprisePermissionService } from '@/lib/services/serviceEnterprise/server/enterprisePermissionService';
import { PERMISSIONS } from '@/lib/services/constants';

export async function GET(request, { params }) {
    try {
        const { teamId } = params;
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // 1. Check Permissions: Can the user view analytics for this team?
        const userContext = await EnterprisePermissionService.getUserContext(userId);
        const canView = await EnterprisePermissionService.hasPermission(
            userContext, 
            PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS, 
            teamId
        );

        if (!canView) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        // 2. Get Team Member IDs
        const orgDoc = await adminDb.collection('Organizations').doc(userContext.organizationId).get();
        if (!orgDoc.exists) throw new Error('Organization not found');
        
        const teamData = orgDoc.data().teams?.[teamId];
        if (!teamData) throw new Error('Team not found');

        const memberIds = Object.keys(teamData.members || {});
        if (memberIds.length === 0) {
            // Return a default empty state if there are no members
            return NextResponse.json({ totalClicks: 0, totalViews: 0, totalContacts: 0, clickLeaderboard: [], viewLeaderboard: [], contactLeaderboard: [] });
        }

        // 3. Performant Batch Fetch for all member data
        // We need both AccountData (for contact count, names) and Analytics data.
        const [accountDocs, analyticsDocs] = await Promise.all([
            adminDb.collection('AccountData').where('__name__', 'in', memberIds).get(),
            adminDb.collection('Analytics').where('__name__', 'in', memberIds).get()
        ]);

        const analyticsMap = new Map();
        analyticsDocs.forEach(doc => analyticsMap.set(doc.id, doc.data()));
        
        // 4. Aggregate Data and Build Leaderboard Stats
        let totalClicks = 0;
        let totalViews = 0;
        let totalContacts = 0;
        const memberStats = [];

        accountDocs.forEach(doc => {
            const userData = doc.data();
            const analyticsData = analyticsMap.get(doc.id) || {};
            
            const memberClicks = analyticsData.totalClicks || 0;
            const memberViews = analyticsData.totalViews || 0;
            // Assuming contact count is stored on the AccountData document. Adjust if necessary.
            const memberContacts = userData.contactCount || 0; 
            
            totalClicks += memberClicks;
            totalViews += memberViews;
            totalContacts += memberContacts;
            
            memberStats.push({
                id: doc.id,
                displayName: userData.displayName || userData.email,
                avatar: userData.avatarUrl || null,
                clicks: memberClicks,
                views: memberViews,
                contacts: memberContacts
            });
        });

        // 5. Generate Leaderboards (top 3)
        const clickLeaderboard = [...memberStats].sort((a, b) => b.clicks - a.clicks).slice(0, 3);
        const viewLeaderboard = [...memberStats].sort((a, b) => b.views - a.views).slice(0, 3);
        const contactLeaderboard = [...memberStats].sort((a, b) => b.contacts - a.contacts).slice(0, 3);
        
        // 6. Return the aggregated data payload
        return NextResponse.json({
            totalClicks,
            totalViews,
            totalContacts,
            totalMembers: memberIds.length,
            avgClicksPerMember: memberIds.length > 0 ? parseFloat((totalClicks / memberIds.length).toFixed(1)) : 0,
            avgViewsPerMember: memberIds.length > 0 ? parseFloat((totalViews / memberIds.length).toFixed(1)) : 0,
            clickLeaderboard,
            viewLeaderboard,
            contactLeaderboard,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching team analytics:', error);
        return NextResponse.json({ error: 'Failed to fetch team analytics' }, { status: 500 });
    }
}