//app/api/user/analytics/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// --- Helper Functions (Server-Side) ---

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

// ✅ COMPLETELY REWRITTEN: More robust data extraction
function processAnalyticsData(rawData) {
    console.log('🔍 RAW FIRESTORE DATA:', JSON.stringify(rawData, null, 2));
    
    const safeData = rawData || {};
    const { today, yesterday, weekKey, monthKey } = getDateKeys();

    // ✅ NEW APPROACH: Extract daily data from ALL possible locations
    const dailyViews = {};
    const dailyClicks = {};

    // Method 1: Direct dailyViews/dailyClicks properties
    if (safeData.dailyViews && typeof safeData.dailyViews === 'object') {
        Object.assign(dailyViews, safeData.dailyViews);
        console.log('📊 Method 1 - Direct dailyViews found:', safeData.dailyViews);
    }

    if (safeData.dailyClicks && typeof safeData.dailyClicks === 'object') {
        Object.assign(dailyClicks, safeData.dailyClicks);
        console.log('📊 Method 1 - Direct dailyClicks found:', safeData.dailyClicks);
    }

    // Method 2: Check if data is stored with dot notation flattened
    Object.keys(safeData).forEach(key => {
        if (key.startsWith('dailyViews.')) {
            const dateKey = key.replace('dailyViews.', '');
            dailyViews[dateKey] = safeData[key];
            console.log(`📊 Method 2 - Found flattened dailyView: ${dateKey} = ${safeData[key]}`);
        }
        if (key.startsWith('dailyClicks.')) {
            const dateKey = key.replace('dailyClicks.', '');
            dailyClicks[dateKey] = safeData[key];
            console.log(`📊 Method 2 - Found flattened dailyClick: ${dateKey} = ${safeData[key]}`);
        }
    });

    // Method 3: Extract from nested structure if it exists
    if (safeData['dailyViews.2025-07-23']) {
        console.log('📊 Method 3 - Found dot notation data for today:', safeData['dailyViews.2025-07-23']);
        // This means your data is stored with dot notation
        Object.keys(safeData).forEach(key => {
            const match = key.match(/^dailyViews\.(.+)$/);
            if (match) {
                dailyViews[match[1]] = safeData[key];
            }
            const clickMatch = key.match(/^dailyClicks\.(.+)$/);
            if (clickMatch) {
                dailyClicks[clickMatch[1]] = safeData[key];
            }
        });
    }

    console.log('✅ EXTRACTED DAILY DATA:');
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
                console.log(`📊 Method 1 - Processed link: ${linkId}, todayClicks: ${linkData.dailyClicks?.[today] || 0}`);
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
                console.log(`📊 Method 2 - Found nested link data: ${linkId}.${mainProp}.${subProp} = ${safeData[key]}`);
            } else {
                linkClicksFromDots[linkId][property] = safeData[key];
                console.log(`📊 Method 2 - Found link data: ${linkId}.${property} = ${safeData[key]}`);
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
                console.log(`📊 Method 2 - Processed dot notation link: ${linkId}`, {
                    totalClicks: processedLink.totalClicks,
                    todayClicks: processedLink.todayClicks,
                    dailyClicksData: linkData.dailyClicks
                });
            }
        });
    }

    console.log('✅ FINAL TOP LINKS:', topLinks.length, 'links processed');
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
        console.log('📊 Method 1 - Direct trafficSources found:', safeData.trafficSources);
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
            console.log(`📊 Method 2 - Found traffic source: ${sourceKey}.${property} = ${safeData[key]}`);
        }
    });

    console.log('✅ FINAL TRAFFIC SOURCES:', trafficSources);

    // Calculate traffic source stats
    const trafficSourceStats = {
        totalSources: Object.keys(trafficSources).length,
        topSource: null,
        socialTraffic: 0, 
        searchTraffic: 0, 
        directTraffic: 0, 
        referralTraffic: 0
    };

    console.log('📊 Traffic source stats calculation:', {
        totalSources: trafficSourceStats.totalSources,
        sources: Object.keys(trafficSources)
    });

    if (trafficSourceStats.totalSources > 0) {
        const sortedSources = Object.entries(trafficSources).sort(([, a], [, b]) => (b?.clicks || 0) - (a?.clicks || 0));
        if (sortedSources.length > 0) {
            trafficSourceStats.topSource = { 
                name: sortedSources[0][0], 
                clicks: sortedSources[0][1]?.clicks || 0 
            };
        }
        
        Object.entries(trafficSources).forEach(([source, sourceData]) => {
            const clicks = sourceData?.clicks || 0;
            const medium = sourceData?.medium || 'unknown';
            console.log(`📊 Processing traffic source: ${source}, medium: ${medium}, clicks: ${clicks}`);
            
            if (medium === 'social') trafficSourceStats.socialTraffic += clicks;
            else if (['search', 'organic'].includes(medium)) trafficSourceStats.searchTraffic += clicks;
            else if (medium === 'direct') trafficSourceStats.directTraffic += clicks;
            else if (medium === 'referral') trafficSourceStats.referralTraffic += clicks;
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

    console.log('📊 FINAL PROCESSED DATA:');
    console.log('   Total Views:', processedData.totalViews);
    console.log('   Today Views:', processedData.todayViews);
    console.log('   Total Clicks:', processedData.totalClicks);
    console.log('   Today Clicks:', processedData.todayClicks);
    console.log('   Daily Views Object:', processedData.dailyViews);
    console.log('   Daily Clicks Object:', processedData.dailyClicks);

    return processedData;
}

// --- Main API Handler ---
export async function GET(request) {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`📊 [${requestId}] Analytics API called`);
    
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log(`📊 [${requestId}] Missing authorization header`);
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const { uid } = decodedToken;

        console.log(`📊 [${requestId}] Fetching analytics for user: ${uid}`);

        const analyticsRef = adminDb.collection('Analytics').doc(uid);
        const analyticsDoc = await analyticsRef.get();
        
        if (!analyticsDoc.exists) {
            console.log(`📊 [${requestId}] No analytics document found for user: ${uid}`);
            // Return empty analytics structure
            return NextResponse.json({
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
            });
        }
        
        const rawData = analyticsDoc.data();
        console.log(`📊 [${requestId}] Raw document keys:`, Object.keys(rawData));
        console.log(`📊 [${requestId}] Has dailyViews property:`, 'dailyViews' in rawData);
        console.log(`📊 [${requestId}] Has dailyClicks property:`, 'dailyClicks' in rawData);
        
        // Check for dot notation keys
        const dotNotationKeys = Object.keys(rawData).filter(key => 
            key.startsWith('dailyViews.') || key.startsWith('dailyClicks.')
        );
        console.log(`📊 [${requestId}] Dot notation keys found:`, dotNotationKeys);
        
        const processedData = processAnalyticsData(rawData);
        
        console.log(`📊 [${requestId}] API response prepared successfully`);
        return NextResponse.json(processedData);

    } catch (error) {
        console.error(`💥 [${requestId}] API Error in /api/user/analytics:`, error);
        if (error.code?.startsWith('auth/')) {
            return NextResponse.json({ error: 'Unauthorized: Invalid Token' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}