// app/api/admin/users/route.js - ENHANCED WITH ANALYTICS DATA

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

/**
 * Server-side admin authorization check
 * @param {string} email - User's email address
 * @returns {boolean} - Whether the user is an admin
 */
function isServerAdmin(email) {
    if (!email) return false;
    
    // Get admin emails from environment variables (secure, server-only)
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    return adminEmails
        .map(e => e.toLowerCase().trim())
        .includes(email.toLowerCase().trim());
}

/**
 * Verify Firebase Auth token and check admin status
 * @param {string} token - Firebase ID token
 * @returns {Promise<{isValid: boolean, email?: string, isAdmin: boolean, error?: string}>}
 */
async function verifyAdminToken(token) {
    try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        return {
            isValid: true,
            email: decodedToken.email,
            isAdmin: isServerAdmin(decodedToken.email),
            uid: decodedToken.uid
        };
    } catch (error) {
        console.error('Token verification failed:', error);
        return { 
            isValid: false, 
            isAdmin: false, 
            error: error.code || 'Invalid token' 
        };
    }
}

/**
 * ✅ NEW: Process analytics data from the flattened Firestore structure
 */
function processAnalyticsData(analyticsData) {
    if (!analyticsData) {
        return {
            totalViews: 0,
            totalClicks: 0,
            todayViews: 0,
            todayClicks: 0,
            topTrafficSource: null,
            linkCount: 0,
            hasAnalytics: false
        };
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Extract daily data
    const dailyViews = {};
    const dailyClicks = {};
    const linkClicks = {};
    const trafficSources = {};

    // Process all fields in the analytics document
    Object.keys(analyticsData).forEach(key => {
        // Extract daily views
        if (key.startsWith('dailyViews.')) {
            const date = key.replace('dailyViews.', '');
            dailyViews[date] = analyticsData[key];
        }
        // Extract daily clicks
        else if (key.startsWith('dailyClicks.')) {
            const date = key.replace('dailyClicks.', '');
            dailyClicks[date] = analyticsData[key];
        }
        // Extract link clicks data
        else if (key.startsWith('linkClicks.')) {
            const parts = key.split('.');
            if (parts.length >= 3) {
                const linkId = parts[1];
                const property = parts.slice(2).join('.');
                
                if (!linkClicks[linkId]) {
                    linkClicks[linkId] = {};
                }
                
                // Handle nested properties like dailyClicks.2025-07-23
                if (property.includes('.')) {
                    const [mainProp, subProp] = property.split('.', 2);
                    if (!linkClicks[linkId][mainProp]) {
                        linkClicks[linkId][mainProp] = {};
                    }
                    linkClicks[linkId][mainProp][subProp] = analyticsData[key];
                } else {
                    linkClicks[linkId][property] = analyticsData[key];
                }
            }
        }
        // Extract traffic sources
        else if (key.startsWith('trafficSources.')) {
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

    // Find top traffic source by total engagement (views + clicks)
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

    return {
        totalViews: analyticsData.totalViews || 0,
        totalClicks: analyticsData.totalClicks || 0,
        todayViews: dailyViews[today] || 0,
        todayClicks: dailyClicks[today] || 0,
        topTrafficSource,
        linkCount: Object.keys(linkClicks).length,
        trafficSourceCount: Object.keys(trafficSources).length,
        hasAnalytics: true
    };
}

/**
 * ✅ ENHANCED: Sanitize user data for admin view with analytics
 * @param {object} userData - Raw user data from Firestore
 * @param {string} docId - Document ID
 * @param {object} analyticsData - Analytics data from Analytics collection
 * @returns {object} - Sanitized user data with analytics
 */
function sanitizeUserData(userData, docId, analyticsData = null) {
    const analytics = processAnalyticsData(analyticsData);
    
    return {
        id: docId,
        username: userData.username || 'N/A',
        displayName: userData.displayName || 'N/A',
        email: userData.email || 'N/A',
        selectedTheme: userData.selectedTheme || 'N/A',
        linksCount: userData.links?.length || 0,
        socialsCount: userData.socials?.length || 0,
        createdAt: userData.createdAt?.toDate?.()?.toISOString?.() || null,
        profilePhoto: userData.profilePhoto || null,
        sensitiveStatus: userData.sensitiveStatus || false,
        supportBannerStatus: userData.supportBannerStatus || false,
        lastLogin: userData.lastLogin?.toDate?.()?.toISOString?.() || null,
        emailVerified: userData.emailVerified || false,
        accountType: userData.accountType || 'base',
        // ✅ NEW: Analytics data
        analytics: {
            totalViews: analytics.totalViews,
            totalClicks: analytics.totalClicks,
            todayViews: analytics.todayViews,
            todayClicks: analytics.todayClicks,
            topTrafficSource: analytics.topTrafficSource,
            linkCount: analytics.linkCount,
            trafficSourceCount: analytics.trafficSourceCount,
            hasAnalytics: analytics.hasAnalytics,
            totalEngagement: analytics.totalViews + analytics.totalClicks
        }
    };
}

/**
 * ✅ ENHANCED: GET /api/admin/users
 * Fetch all users for admin dashboard with analytics data
 */
export async function GET(request) {
    const startTime = Date.now();
    
    try {
        // --- 1. Extract Authorization Token ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn('🚨 Admin API access attempted without valid authorization header');
            return NextResponse.json(
                { error: 'Unauthorized: No valid token provided' }, 
                { status: 401 }
            );
        }

        const token = authHeader.split('Bearer ')[1];

        // --- 2. Verify Token and Check Admin Status ---
        const { isValid, email, isAdmin, error } = await verifyAdminToken(token);

        if (!isValid) {
            console.warn(`🚨 Admin API access attempted with invalid token: ${error}`);
            return NextResponse.json(
                { error: `Unauthorized: ${error}` }, 
                { status: 401 }
            );
        }

        if (!isAdmin) {
            console.warn(`🚨 UNAUTHORIZED ADMIN ACCESS ATTEMPT by user: ${email}`);
            return NextResponse.json(
                { error: 'Forbidden: You do not have admin privileges' }, 
                { status: 403 }
            );
        }

        console.log(`✅ Authorized admin access by: ${email}`);

        // --- 3. Fetch Users and Analytics Data ---
        console.log('📊 Fetching users and analytics data...');
        
        const [usersSnapshot, analyticsSnapshot] = await Promise.all([
            adminDb.collection('AccountData').get(),
            adminDb.collection('Analytics').get()
        ]);
        
        if (usersSnapshot.empty) {
            return NextResponse.json({ 
                users: [], 
                total: 0,
                message: 'No users found',
                timestamp: new Date().toISOString()
            });
        }

        // --- 4. Create analytics lookup map ---
        const analyticsMap = new Map();
        analyticsSnapshot.docs.forEach(doc => {
            analyticsMap.set(doc.id, doc.data());
        });

        console.log(`📊 Found ${analyticsSnapshot.size} analytics documents`);

        // --- 5. Process and Sanitize User Data with Analytics ---
        const users = [];
        const errors = [];

        usersSnapshot.forEach(doc => {
            try {
                const userData = doc.data();
                const analyticsData = analyticsMap.get(doc.id);
                const sanitizedUser = sanitizeUserData(userData, doc.id, analyticsData);
                users.push(sanitizedUser);
            } catch (error) {
                console.error(`Error processing user document ${doc.id}:`, error);
                errors.push(`Failed to process user ${doc.id}`);
            }
        });

        // --- 6. Sort Users (most engaged first, then by creation date) ---
        users.sort((a, b) => {
            // First sort by total engagement (views + clicks)
            const engagementDiff = b.analytics.totalEngagement - a.analytics.totalEngagement;
            if (engagementDiff !== 0) return engagementDiff;
            
            // Then by creation date
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });

        // --- 7. Calculate Enhanced Statistics ---
        const stats = {
            total: users.length,
            withLinks: users.filter(u => u.linksCount > 0).length,
            withSocials: users.filter(u => u.socialsCount > 0).length,
            sensitiveContent: users.filter(u => u.sensitiveStatus).length,
            supportBanners: users.filter(u => u.supportBannerStatus).length,
            emailVerified: users.filter(u => u.emailVerified).length,
            // ✅ NEW: Analytics statistics
            withAnalytics: users.filter(u => u.analytics.hasAnalytics).length,
            totalViews: users.reduce((sum, u) => sum + u.analytics.totalViews, 0),
            totalClicks: users.reduce((sum, u) => sum + u.analytics.totalClicks, 0),
            activeToday: users.filter(u => u.analytics.todayViews > 0 || u.analytics.todayClicks > 0).length,
            // Account type breakdown
            accountTypes: {
                base: users.filter(u => u.accountType === 'base').length,
                pro: users.filter(u => u.accountType === 'pro').length,
                premium: users.filter(u => u.accountType === 'premium').length,
                business: users.filter(u => u.accountType === 'business').length
            }
        };

        const processingTime = Date.now() - startTime;

        // --- 8. Return Enhanced Response ---
        const response = {
            users,
            stats,
            total: users.length,
            timestamp: new Date().toISOString(),
            processingTimeMs: processingTime,
            adminUser: email
        };

        if (errors.length > 0) {
            response.warnings = errors;
        }

        console.log(`✅ Admin users API with analytics completed successfully for ${email} (${processingTime}ms, ${users.length} users)`);
        
        return NextResponse.json(response);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('💥 Admin users API error:', {
            error: error.message,
            code: error.code,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            processingTime
        });

        // Different error responses based on error type
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json(
                { error: 'Unauthorized: Token expired, please log in again' }, 
                { status: 401 }
            );
        }

        if (error.code === 'auth/argument-error') {
            return NextResponse.json(
                { error: 'Unauthorized: Invalid token format' }, 
                { status: 401 }
            );
        }

        return NextResponse.json(
            { 
                error: 'Internal server error',
                timestamp: new Date().toISOString(),
                ...(process.env.NODE_ENV === 'development' && { 
                    details: error.message 
                })
            }, 
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/users
 * Handle admin actions on users (future: ban, unban, etc.)
 */
export async function POST(request) {
    try {
        // Similar authentication flow
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const { isValid, email, isAdmin } = await verifyAdminToken(token);

        if (!isValid || !isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body
        const body = await request.json();
        const { action, userId, data } = body;

        // Handle different admin actions
        switch (action) {
            case 'updateUser':
                // Implementation for updating user data
                // Add validation and sanitization
                break;
            case 'suspendUser':
                // Implementation for suspending users
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Placeholder response
        return NextResponse.json({ 
            message: 'Admin action completed',
            action,
            userId,
            adminUser: email,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Admin POST API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' }, 
            { status: 500 }
        );
    }
}