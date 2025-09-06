// app/api/user/analytics/impersonate/[userId]/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// ✅ Import your existing enterprise services with CORRECT paths
import { 
    validateTeamPermission,
    checkUserTeamMembership 
} from '@/lib/services/serviceEnterprise/server/enterprisePermissionService';
import { logSecurityEvent } from '@/lib/services/serviceEnterprise/server/enterpriseSecurityService';
import { createAuditLogEntry } from '@/lib/services/serviceEnterprise/server/enterpriseAuditService';
import { 
    PERMISSIONS,
    TEAM_ROLES 
} from '@/lib/services/serviceEnterprise/constants/enterpriseConstants';

// ✅ REUSE THE SAME HELPER FUNCTIONS FROM YOUR WORKING ANALYTICS API
function getDateKeys() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
    const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    return { today, yesterday, weekKey, monthKey };
}

// ✅ IDENTICAL PROCESSING FUNCTION FROM YOUR WORKING API
function processAnalyticsData(rawData) {
    console.log('🔍 IMPERSONATION - RAW FIRESTORE DATA:', JSON.stringify(rawData, null, 2));
    
    const safeData = rawData || {};
    const { today, yesterday, weekKey, monthKey } = getDateKeys();

    // ✅ NEW APPROACH: Extract daily data from ALL possible locations
    const dailyViews = {};
    const dailyClicks = {};

    // Method 1: Direct dailyViews/dailyClicks properties
    if (safeData.dailyViews && typeof safeData.dailyViews === 'object') {
        Object.assign(dailyViews, safeData.dailyViews);
        console.log('📊 IMPERSONATION - Method 1 - Direct dailyViews found:', safeData.dailyViews);
    }

    if (safeData.dailyClicks && typeof safeData.dailyClicks === 'object') {
        Object.assign(dailyClicks, safeData.dailyClicks);
        console.log('📊 IMPERSONATION - Method 1 - Direct dailyClicks found:', safeData.dailyClicks);
    }

    // Method 2: Check if data is stored with dot notation flattened
    Object.keys(safeData).forEach(key => {
        if (key.startsWith('dailyViews.')) {
            const dateKey = key.replace('dailyViews.', '');
            dailyViews[dateKey] = safeData[key];
            console.log(`📊 IMPERSONATION - Method 2 - Found flattened dailyView: ${dateKey} = ${safeData[key]}`);
        }
        if (key.startsWith('dailyClicks.')) {
            const dateKey = key.replace('dailyClicks.', '');
            dailyClicks[dateKey] = safeData[key];
            console.log(`📊 IMPERSONATION - Method 2 - Found flattened dailyClick: ${dateKey} = ${safeData[key]}`);
        }
    });

    console.log('✅ IMPERSONATION - EXTRACTED DAILY DATA:');
    console.log('   Daily Views:', dailyViews);
    console.log('   Daily Clicks:', dailyClicks);
    console.log('   Today key:', today);
    console.log('   Today views:', dailyViews[today]);
    console.log('   Today clicks:', dailyClicks[today]);

    // ✅ IMPROVED: Process top links with more robust extraction
    const topLinks = [];
    
    // Method 1: Direct linkClicks property (nested structure)
    if (safeData.linkClicks && typeof safeData.linkClicks === 'object') {
        Object.entries(safeData.linkClicks).forEach(([linkId, linkData]) => {
            if (linkData && typeof linkData === 'object') {
                topLinks.push({
                    linkId,
                    title: linkData.title || 'Untitled Link',
                    url: linkData.url || '',
                    type: linkData.type || 'custom',
                    totalClicks: linkData.totalClicks || 0,
                    todayClicks: linkData.dailyClicks?.[today] || 0,
                    weekClicks: linkData.weeklyClicks?.[weekKey] || 0,
                    monthClicks: linkData.monthlyClicks?.[monthKey] || 0,
                    lastClicked: linkData.lastClicked?.toDate?.()?.toISOString() || null,
                });
                console.log(`📊 IMPERSONATION - Method 1 - Processed link: ${linkId}, todayClicks: ${linkData.dailyClicks?.[today] || 0}`);
            }
        });
    }

    // Method 2: Extract from dot notation keys like "linkClicks.linkId.property"
    const linkClicksFromDots = {};
    Object.keys(safeData).forEach(key => {
        const match = key.match(/^linkClicks\.([^.]+)\.(.+)$/);
        if (match) {
            const linkId = match[1];
            const property = match[2];
            
            if (!linkClicksFromDots[linkId]) {
                linkClicksFromDots[linkId] = { linkId };
            }
            
            // Handle nested properties like "dailyClicks.2025-07-23"
            if (property.includes('.')) {
                const [mainProp, subProp] = property.split('.', 2);
                if (!linkClicksFromDots[linkId][mainProp]) {
                    linkClicksFromDots[linkId][mainProp] = {};
                }
                linkClicksFromDots[linkId][mainProp][subProp] = safeData[key];
                console.log(`📊 IMPERSONATION - Method 2 - Found nested link data: ${linkId}.${mainProp}.${subProp} = ${safeData[key]}`);
            } else {
                linkClicksFromDots[linkId][property] = safeData[key];
                console.log(`📊 IMPERSONATION - Method 2 - Found link data: ${linkId}.${property} = ${safeData[key]}`);
            }
        }
    });

    // Process dot notation links if we found any and didn't get them from method 1
    if (Object.keys(linkClicksFromDots).length > 0 && topLinks.length === 0) {
        Object.entries(linkClicksFromDots).forEach(([linkId, linkData]) => {
            if (linkData && typeof linkData === 'object') {
                const processedLink = {
                    linkId,
                    title: linkData.title || 'Untitled Link',
                    url: linkData.url || '',
                    type: linkData.type || 'custom',
                    totalClicks: linkData.totalClicks || 0,
                    todayClicks: linkData.dailyClicks?.[today] || 0,
                    weekClicks: linkData.weeklyClicks?.[weekKey] || 0,
                    monthClicks: linkData.monthlyClicks?.[monthKey] || 0,
                    lastClicked: linkData.lastClicked?.toDate?.()?.toISOString() || linkData.lastClicked || null,
                };
                topLinks.push(processedLink);
                console.log(`📊 IMPERSONATION - Method 2 - Processed dot notation link: ${linkId}`, {
                    totalClicks: processedLink.totalClicks,
                    todayClicks: processedLink.todayClicks,
                    dailyClicksData: linkData.dailyClicks
                });
            }
        });
    }

    console.log('✅ IMPERSONATION - FINAL TOP LINKS:', topLinks.length, 'links processed');
    topLinks.forEach(link => {
        console.log(`   Link: ${link.linkId} - Total: ${link.totalClicks}, Today: ${link.todayClicks}`);
    });

    // Sort links by total clicks
    topLinks.sort((a, b) => b.totalClicks - a.totalClicks);

    // ✅ FIXED: Process traffic sources with more robust extraction
    const trafficSources = {};
    
    // Method 1: Direct trafficSources property
    if (safeData.trafficSources && typeof safeData.trafficSources === 'object') {
        Object.assign(trafficSources, safeData.trafficSources);
        console.log('📊 IMPERSONATION - Method 1 - Direct trafficSources found:', safeData.trafficSources);
    }

    // Method 2: Extract from dot notation keys like "trafficSources.localhost.clicks"
    Object.keys(safeData).forEach(key => {
        const match = key.match(/^trafficSources\.([^.]+)\.(.+)$/);
        if (match) {
            const sourceKey = match[1];  // e.g., "localhost"
            const property = match[2];   // e.g., "clicks", "views", "medium"
            
            if (!trafficSources[sourceKey]) {
                trafficSources[sourceKey] = {};
            }
            trafficSources[sourceKey][property] = safeData[key];
            console.log(`📊 IMPERSONATION - Method 2 - Found traffic source: ${sourceKey}.${property} = ${safeData[key]}`);
        }
    });

    console.log('✅ IMPERSONATION - FINAL TRAFFIC SOURCES:', trafficSources);

    // Calculate traffic source stats
    const trafficSourceStats = {
        totalSources: Object.keys(trafficSources).length,
        topSource: null,
        socialTraffic: 0, 
        searchTraffic: 0, 
        directTraffic: 0, 
        referralTraffic: 0
    };

    console.log('📊 IMPERSONATION - Traffic source stats calculation:', {
        totalSources: trafficSourceStats.totalSources,
        sources: Object.keys(trafficSources)
    });

    if (trafficSourceStats.totalSources > 0) {
        const sortedSources = Object.entries(trafficSources).sort(([, a], [, b]) => (b?.views || b?.clicks || 0) - (a?.views || a?.clicks || 0));
        if (sortedSources.length > 0) {
            trafficSourceStats.topSource = { 
                name: sortedSources[0][0], 
                views: sortedSources[0][1]?.views || 0,
                clicks: sortedSources[0][1]?.clicks || 0 
            };
        }
        
        Object.entries(trafficSources).forEach(([source, sourceData]) => {
            const views = sourceData?.views || 0;
            const clicks = sourceData?.clicks || 0;
            const totalTraffic = views + clicks;
            const medium = sourceData?.medium || 'unknown';
            console.log(`📊 IMPERSONATION - Processing traffic source: ${source}, medium: ${medium}, views: ${views}, clicks: ${clicks}`);
            
            if (medium === 'social') trafficSourceStats.socialTraffic += totalTraffic;
            else if (['search', 'organic'].includes(medium)) trafficSourceStats.searchTraffic += totalTraffic;
            else if (medium === 'direct') trafficSourceStats.directTraffic += totalTraffic;
            else if (medium === 'referral') trafficSourceStats.referralTraffic += totalTraffic;
        });
    }

    // Build final response
    const processedData = {
        totalViews: safeData.totalViews || 0,
        todayViews: dailyViews[today] || 0,
        yesterdayViews: dailyViews[yesterday] || 0,
        thisWeekViews: safeData.weeklyViews?.[weekKey] || 0,
        thisMonthViews: safeData.monthlyViews?.[monthKey] || 0,
        totalClicks: safeData.totalClicks || 0,
        todayClicks: dailyClicks[today] || 0,
        yesterdayClicks: dailyClicks[yesterday] || 0,
        thisWeekClicks: safeData.weeklyClicks?.[weekKey] || 0,
        thisMonthClicks: safeData.monthlyClicks?.[monthKey] || 0,
        
        // ✅ RETURN THE EXTRACTED DAILY DATA
        dailyViews,
        dailyClicks,
        
        topLinks,
        trafficSources,
        trafficSourceStats,
    };

    console.log('📊 IMPERSONATION - FINAL PROCESSED DATA:');
    console.log('   Total Views:', processedData.totalViews);
    console.log('   Today Views:', processedData.todayViews);
    console.log('   Total Clicks:', processedData.totalClicks);
    console.log('   Today Clicks:', processedData.todayClicks);
    console.log('   Daily Views Object:', processedData.dailyViews);
    console.log('   Daily Clicks Object:', processedData.dailyClicks);

    return processedData;
}

/**
 * GET /api/user/analytics/impersonate/[userId]
 * Allow managers to view analytics of their team members
 */
export async function GET(request, { params }) {
    const requestId = `impersonate-${Math.random().toString(36).substring(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`[${requestId}] 🔍 Analytics impersonation request for userId: ${params.userId}`);

    let decodedToken = null;

    try {
        // ✅ 1. Authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            console.warn(`[${requestId}] 🛡️ Authentication failed: No Bearer token`);
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        decodedToken = await adminAuth.verifyIdToken(token);
        const managerId = decodedToken.uid;
        const targetUserId = params.userId;

        console.log(`[${requestId}] 🛡️ Manager: ${managerId} requesting analytics for: ${targetUserId}`);

        // ✅ 2. Get query parameters
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const period = searchParams.get('period') || '30d';

        if (!teamId) {
            console.warn(`[${requestId}] ❌ Missing teamId parameter`);
            return NextResponse.json({ 
                error: 'teamId is required for analytics impersonation' 
            }, { status: 400 });
        }

        // ✅ 3. Permission validation
        console.log(`[${requestId}] 🔒 Validating permissions for team: ${teamId}`);
        
        const hasViewPermission = await validateTeamPermission(
            managerId, 
            teamId, 
            PERMISSIONS.CAN_VIEW_TEAM_ANALYTICS
        );

        if (!hasViewPermission) {
            console.warn(`[${requestId}] ❌ Manager lacks CAN_VIEW_TEAM_ANALYTICS permission`);
            
            await logSecurityEvent({
                userId: managerId,
                action: 'UNAUTHORIZED_IMPERSONATION_ATTEMPT',
                details: {
                    targetUserId,
                    teamId,
                    reason: 'Insufficient permissions'
                },
                severity: 'HIGH',
                ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
            });

            return NextResponse.json({ 
                error: 'Insufficient permissions to view team member analytics' 
            }, { status: 403 });
        }

        // ✅ 4. Verify team membership
        console.log(`[${requestId}] 👥 Verifying team membership`);
        
        const isTargetInTeam = await checkUserTeamMembership(targetUserId, teamId);
        const isManagerInTeam = await checkUserTeamMembership(managerId, teamId);

        if (!isTargetInTeam || !isManagerInTeam) {
            console.warn(`[${requestId}] ❌ Team membership validation failed`);
            
            await logSecurityEvent({
                userId: managerId,
                action: 'INVALID_TEAM_IMPERSONATION_ATTEMPT',
                details: {
                    targetUserId,
                    teamId,
                    targetInTeam: isTargetInTeam,
                    managerInTeam: isManagerInTeam
                },
                severity: 'HIGH',
                ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
            });

            return NextResponse.json({ 
                error: 'User is not a member of your team' 
            }, { status: 403 });
        }

        // ✅ 5. Get target user's account data
        console.log(`[${requestId}] 📊 Fetching target user analytics data`);
        
        const targetUserDoc = await adminDb.collection('AccountData').doc(targetUserId).get();
        if (!targetUserDoc.exists) {
            console.warn(`[${requestId}] ❌ Target user not found`);
            return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
        }

        const targetUserData = targetUserDoc.data();

        // ✅ 6. CORRECTED: Fetch analytics data from Analytics collection (not AnalyticsData)
        console.log(`📊 [${requestId}] Fetching single analytics document for user: ${targetUserId}`);
        
        const analyticsRef = adminDb.collection('Analytics').doc(targetUserId);
        const analyticsDoc = await analyticsRef.get();
        
        let processedAnalytics;
        
        if (!analyticsDoc.exists) {
            console.log(`🟡 [${requestId}] No analytics document found for user: ${targetUserId}. Returning empty state.`);
            // Return empty analytics structure
            processedAnalytics = {
                totalViews: 0,
                todayViews: 0,
                yesterdayViews: 0,
                thisWeekViews: 0,
                thisMonthViews: 0,
                totalClicks: 0,
                todayClicks: 0,
                yesterdayClicks: 0,
                thisWeekClicks: 0,
                thisMonthClicks: 0,
                dailyViews: {},
                dailyClicks: {},
                topLinks: [],
                trafficSources: {},
                trafficSourceStats: {
                    totalSources: 0,
                    topSource: null,
                    socialTraffic: 0,
                    searchTraffic: 0,
                    directTraffic: 0,
                    referralTraffic: 0
                }
            };
        } else {
            const rawData = analyticsDoc.data();
            console.log(`📊 [${requestId}] Raw analytics document keys:`, Object.keys(rawData));
            console.log(`📊 [${requestId}] Has dailyViews property:`, 'dailyViews' in rawData);
            console.log(`📊 [${requestId}] Has dailyClicks property:`, 'dailyClicks' in rawData);
            
            // Check for dot notation keys
            const dotNotationKeys = Object.keys(rawData).filter(key => 
                key.startsWith('dailyViews.') || key.startsWith('dailyClicks.')
            );
            console.log(`📊 [${requestId}] Dot notation keys found:`, dotNotationKeys);
            
            processedAnalytics = processAnalyticsData(rawData);
        }

        // ✅ 7. Log the impersonation
        await createAuditLogEntry({
            teamId,
            action: 'ANALYTICS_IMPERSONATION',
            performedBy: managerId,
            targetUserId: targetUserId,
            details: {
                period,
                dataTypes: Object.keys(processedAnalytics),
                accessReason: 'Manager viewing team member analytics'
            },
            metadata: {
                requestId,
                ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
                userAgent: request.headers.get('user-agent') || 'unknown'
            }
        });

        // ✅ 8. Return analytics data with impersonation context
        const processingTime = Date.now() - startTime;
        console.log(`[${requestId}] ✅ Impersonation successful. Processing time: ${processingTime}ms`);

        return NextResponse.json({
            // Analytics data (processed in the same way as your main API)
            ...processedAnalytics,
            
            // Impersonation context
            impersonationContext: {
                targetUserId,
                targetUserData: {
                    username: targetUserData.username,
                    email: targetUserData.email,
                    displayName: targetUserData.displayName || targetUserData.username
                },
                managerId,
                teamId,
                period,
                accessTimestamp: new Date().toISOString(),
                requestId
            }
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`[${requestId}] 💥 Impersonation error:`, {
            errorMessage: error.message,
            errorCode: error.code,
            processingTime: `${processingTime}ms`,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });

        // ✅ Log error
        try {
            await logSecurityEvent({
                userId: decodedToken?.uid || 'unknown',
                action: 'IMPERSONATION_ERROR',
                details: {
                    targetUserId: params.userId,
                    errorMessage: error.message,
                    errorCode: error.code
                },
                severity: 'MEDIUM',
                ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
            });
        } catch (logError) {
            console.error(`[${requestId}] Failed to log security event:`, logError);
        }

        // Return appropriate error response
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
            return NextResponse.json({ 
                error: 'Token is invalid or expired. Please sign in again.' 
            }, { status: 401 });
        }

        return NextResponse.json({ 
            error: 'Internal server error',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }, { status: 500 });
    }
}