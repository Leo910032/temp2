//app/api/user/analytics/track/route.js
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// --- In-Memory Rate Limiting (Simple & Effective for Vercel) ---
const rateLimitMap = new Map();

function applyRateLimit(ip) {
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 30; // Max 30 tracking events per minute from a single IP

    const now = Date.now();
    const records = rateLimitMap.get(ip) || [];

    // Filter out old requests
    const recentRecords = records.filter(timestamp => now - timestamp < windowMs);
    
    if (recentRecords.length >= maxRequests) {
        // Limit exceeded
        return false;
    }

    // Add current request timestamp and update the map
    recentRecords.push(now);
    rateLimitMap.set(ip, recentRecords);
    
    return true;
}


// --- Helper Functions ---
function getDateKeys() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
    const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    return { today, weekKey, monthKey };
}

// --- Main API Handler ---
export async function POST(request) {
    try {
             // ✅ STEP 1: APPLY RATE LIMITING
        const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';
        if (!applyRateLimit(ip)) {
            console.warn(`🚨 Rate limit exceeded for IP: ${ip}`);
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }
        const body = await request.json();
        const {
            userId,      // UID of the profile owner
            username,    // Username of the profile owner
            eventType,   // 'view' or 'click'
            linkData,    // For 'click' events
            sessionData, // Referrer, UTM, etc.
        } = body;

        // --- 1. Validation ---
        if (!userId || !eventType || !['view', 'click'].includes(eventType)) {
            return NextResponse.json({ error: 'Invalid tracking payload' }, { status: 400 });
        }
        if (eventType === 'click' && !linkData?.linkId) {
            return NextResponse.json({ error: 'Link data is required for click events' }, { status: 400 });
        }

        const analyticsRef = adminDb.collection('Analytics').doc(userId);
        const { today, weekKey, monthKey } = getDateKeys();
        const increment = FieldValue.increment(1);
        let updatePayload = { 
            lastUpdated: new Date(),
            username: username || 'unknown' // Ensure username is always present
        };

        // --- 2. Build Payload based on Event Type ---
        if (eventType === 'view') {
            updatePayload = {
                ...updatePayload,
                totalViews: increment,
                [`dailyViews.${today}`]: increment,
                [`weeklyViews.${weekKey}`]: increment,
                [`monthlyViews.${monthKey}`]: increment,
            };
        } else { // 'click' event
            updatePayload = {
                ...updatePayload,
                totalClicks: increment,
                [`dailyClicks.${today}`]: increment,
                [`weeklyClicks.${weekKey}`]: increment,
                [`monthlyClicks.${monthKey}`]: increment,
                // Detailed Link Click Data
                [`linkClicks.${linkData.linkId}.totalClicks`]: increment,
                [`linkClicks.${linkData.linkId}.lastClicked`]: new Date(),
                [`linkClicks.${linkData.linkId}.title`]: linkData.linkTitle,
                [`linkClicks.${linkData.linkId}.url`]: linkData.linkUrl,
                [`linkClicks.${linkData.linkId}.type`]: linkData.linkType,
                // Add daily/weekly/monthly stats per link
                [`linkClicks.${linkData.linkId}.dailyClicks.${today}`]: increment,
                [`linkClicks.${linkData.linkId}.weeklyClicks.${weekKey}`]: increment,
                [`linkClicks.${linkData.linkId}.monthlyClicks.${monthKey}`]: increment,
            };
        }

        // --- 3. Add Rich Traffic Source and Referrer Data ---
        if (sessionData?.trafficSource?.source && sessionData?.sessionId) {
            const sourceKey = sessionData.trafficSource.source.replace(/\./g, '_'); // Sanitize dots for Firestore keys
            const fieldPrefix = eventType === 'view' ? 'views' : 'clicks';
            const lastEventField = eventType === 'view' ? 'lastView' : 'lastClick';
            
            // Update the main trafficSources map
            updatePayload[`trafficSources.${sourceKey}.${fieldPrefix}`] = increment;
            updatePayload[`trafficSources.${sourceKey}.${lastEventField}`] = new Date();
            updatePayload[`trafficSources.${sourceKey}.medium`] = sessionData.trafficSource.medium;

            // For clicks, add the detailed referrer data to the specific link
            if (eventType === 'click') {
                updatePayload[`linkClicks.${linkData.linkId}.referrerData.${sessionData.sessionId}`] = {
                    source: sessionData.trafficSource.source,
                    medium: sessionData.trafficSource.medium,
                    campaign: sessionData.utm?.campaign || '',
                    originalReferrer: sessionData.originalReferrer || '',
                    clickedAt: new Date(),
                    utmParams: sessionData.utm || {},
                };
            }
        }

        // --- 4. Perform Firestore Write Operation ---
        // Use `set({ merge: true })` to create or update the document atomically.
        await analyticsRef.set(updatePayload, { merge: true });

        return NextResponse.json({ success: true, message: `${eventType} tracked.` });

    } catch (error) {
        console.error('💥 Analytics Tracking API Error:', error);
        return NextResponse.json({ error: 'Failed to track event.' }, { status: 500 });
    }
}
