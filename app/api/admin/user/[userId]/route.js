// app/api/admin/user/[userId]/route.js - FIXED VERSION

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { isServerAdmin } from '@/lib/serverAdminAuth';

export async function GET(request, { params }) {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`🎯 [${requestId}] === USER DETAIL API START ===`);
    
    try {
        // Extract userId from params
        const { userId } = params;
        console.log(`🎯 [${requestId}] Received userId:`, userId);
        console.log(`🎯 [${requestId}] Type of userId:`, typeof userId);

        if (!userId) {
            console.error(`🎯 [${requestId}] ❌ User ID is required`);
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Authentication
        const authHeader = request.headers.get('authorization');
        console.log(`🎯 [${requestId}] Auth header present:`, !!authHeader);
        
        if (!authHeader?.startsWith('Bearer ')) {
            console.error(`🎯 [${requestId}] ❌ No valid authorization header`);
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        console.log(`🎯 [${requestId}] Token extracted:`, !!token);
        
        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
            console.log(`🎯 [${requestId}] Token verified for user:`, decodedToken.email);
        } catch (tokenError) {
            console.error(`🎯 [${requestId}] ❌ Token verification failed:`, tokenError.message);
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Admin check
        if (!isServerAdmin(decodedToken.email)) {
            console.error(`🎯 [${requestId}] ❌ User ${decodedToken.email} is not an admin`);
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        console.log(`🎯 [${requestId}] ✅ Admin access confirmed for:`, decodedToken.email);

        // Fetch user document
        console.log(`🎯 [${requestId}] 📊 Fetching user document from AccountData collection...`);
        const userDocRef = adminDb.collection('AccountData').doc(userId);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            console.error(`🎯 [${requestId}] ❌ User document not found for ID: ${userId}`);
            return NextResponse.json({ 
                error: `User document with ID ${userId} not found.` 
            }, { status: 404 });
        }

        console.log(`🎯 [${requestId}] ✅ User document found`);
        const userData = userDoc.data();

        // Also fetch analytics data if available
        let analyticsData = null;
        try {
            console.log(`🎯 [${requestId}] 📊 Fetching analytics data...`);
            const analyticsDocRef = adminDb.collection('Analytics').doc(userId);
            const analyticsDoc = await analyticsDocRef.get();
            
            if (analyticsDoc.exists) {
                analyticsData = analyticsDoc.data();
                console.log(`🎯 [${requestId}] ✅ Analytics data found`);
            } else {
                console.log(`🎯 [${requestId}] ℹ️ No analytics data found (this is normal)`);
            }
        } catch (analyticsError) {
            console.warn(`🎯 [${requestId}] ⚠️ Error fetching analytics:`, analyticsError.message);
        }

        // Process analytics data if available
        let processedAnalytics = {
            totalViews: 0,
            totalClicks: 0,
            todayViews: 0,
            todayClicks: 0,
            topTrafficSource: null,
            linkCount: 0,
            trafficSourceCount: 0,
            hasAnalytics: false
        };

        if (analyticsData) {
            const today = new Date().toISOString().split('T')[0];
            
            // Extract daily data
            const dailyViews = {};
            const dailyClicks = {};
            const trafficSources = {};

            // Process all fields in the analytics document
            Object.keys(analyticsData).forEach(key => {
                if (key.startsWith('dailyViews.')) {
                    const date = key.replace('dailyViews.', '');
                    dailyViews[date] = analyticsData[key];
                } else if (key.startsWith('dailyClicks.')) {
                    const date = key.replace('dailyClicks.', '');
                    dailyClicks[date] = analyticsData[key];
                } else if (key.startsWith('trafficSources.')) {
                    const parts = key.split('.');
                    if (parts.length >= 3) {
                        const source = parts[1];
                        const property = parts[2];
                        if (!trafficSources[source]) {
                            trafficSources[source] = {};
                        }
                        trafficSources[source][property] = analyticsData[key];
                    }
                }
            });

            // Find top traffic source
            let topTrafficSource = null;
            let maxEngagement = 0;
            
            Object.entries(trafficSources).forEach(([source, data]) => {
                const engagement = (data.views || 0) + (data.clicks || 0);
                if (engagement > maxEngagement) {
                    maxEngagement = engagement;
                    topTrafficSource = {
                        name: source,
                        views: data.views || 0,
                        clicks: data.clicks || 0,
                        medium: data.medium || 'unknown'
                    };
                }
            });

            processedAnalytics = {
                totalViews: analyticsData.totalViews || 0,
                totalClicks: analyticsData.totalClicks || 0,
                todayViews: dailyViews[today] || 0,
                todayClicks: dailyClicks[today] || 0,
                topTrafficSource,
                linkCount: Object.keys(analyticsData.linkClicks || {}).length,
                trafficSourceCount: Object.keys(trafficSources).length,
                hasAnalytics: true
            };
        }

        // Prepare response data
        const responseData = {
            id: userDoc.id,
            username: userData.username || 'N/A',
            displayName: userData.displayName || 'N/A',
            email: userData.email || 'N/A',
            bio: userData.bio || '',
            profilePhoto: userData.profilePhoto || '',
            selectedTheme: userData.selectedTheme || 'N/A',
            accountType: userData.accountType || 'base',
            links: userData.links || [],
            socials: userData.socials || [],
            sensitiveStatus: userData.sensitiveStatus || false,
            supportBannerStatus: userData.supportBannerStatus || false,
            emailVerified: userData.emailVerified || false,
            createdAt: userData.createdAt?.toDate?.()?.toISOString() || null,
            lastLogin: userData.lastLogin?.toDate?.()?.toISOString() || null,
            analytics: processedAnalytics
        };

        console.log(`🎯 [${requestId}] ✅ SUCCESS - Returning user data for: ${userData.username}`);
        
        return NextResponse.json(responseData);

    } catch (error) {
        console.error(`🎯 [${requestId}] 💥 API Error in /api/admin/user/${params?.userId}:`, {
            message: error.message,
            code: error.code,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
        
        // Handle specific errors
        if (error.code?.startsWith('auth/')) {
            return NextResponse.json({ 
                error: 'Authentication failed', 
                details: error.message 
            }, { status: 401 });
        }

        return NextResponse.json({ 
            error: 'Internal Server Error', 
            details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
        }, { status: 500 });
    }
}