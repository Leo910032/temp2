// app/dashboard/(dashboard pages)/analytics/AnalyticsContext.js
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useDashboard } from '@/app/dashboard/DashboardContext';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { app } from '@/important/firebase';

// ✅ FIXED: This function now properly handles both dot notation and nested data
function processAnalyticsData(rawData) {
    const safeData = rawData || {};
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = (now - yearStart + 86400000) / 86400000;
    const weekNumber = Math.ceil(dayOfYear / 7);
    const weekKey = `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // ✅ FIXED: Process dailyViews from dot notation
    const dailyViews = {};
    const dailyClicks = {};
    
    // Handle both nested structure and dot notation
    if (safeData.dailyViews && typeof safeData.dailyViews === 'object') {
        Object.assign(dailyViews, safeData.dailyViews);
    }
    
    if (safeData.dailyClicks && typeof safeData.dailyClicks === 'object') {
        Object.assign(dailyClicks, safeData.dailyClicks);
    }
    
    // ✅ FIXED: Also check for dot notation keys in the main data object
    Object.keys(safeData).forEach(key => {
        if (key.startsWith('dailyViews.')) {
            const dateKey = key.replace('dailyViews.', '');
            dailyViews[dateKey] = safeData[key];
        } else if (key.startsWith('dailyClicks.')) {
            const dateKey = key.replace('dailyClicks.', '');
            dailyClicks[dateKey] = safeData[key];
        }
    });

    console.log("🔍 Processed dailyViews:", dailyViews);
    console.log("🔍 Processed dailyClicks:", dailyClicks);

    // ✅ FIXED: Process linkClicks from dot notation
    const topLinks = [];
    const linkClicksMap = {};
    
    // First, collect all linkClicks data from dot notation
    Object.keys(safeData).forEach(key => {
        if (key.startsWith('linkClicks.')) {
            const parts = key.split('.');
            const linkId = parts[1];
            const property = parts.slice(2).join('.');
            
            if (!linkClicksMap[linkId]) {
                linkClicksMap[linkId] = {};
            }
            
            // Handle nested properties
            if (property.includes('.')) {
                const propertyParts = property.split('.');
                let current = linkClicksMap[linkId];
                
                for (let i = 0; i < propertyParts.length - 1; i++) {
                    if (!current[propertyParts[i]]) {
                        current[propertyParts[i]] = {};
                    }
                    current = current[propertyParts[i]];
                }
                current[propertyParts[propertyParts.length - 1]] = safeData[key];
            } else {
                linkClicksMap[linkId][property] = safeData[key];
            }
        }
    });
    
    // Also handle nested linkClicks if present
    if (safeData.linkClicks && typeof safeData.linkClicks === 'object') {
        Object.assign(linkClicksMap, safeData.linkClicks);
    }
    
    // Convert to topLinks array
    Object.entries(linkClicksMap).forEach(([linkId, linkData]) => {
        if (linkData && typeof linkData === 'object') {
            topLinks.push({
                linkId,
                title: linkData.title || 'Untitled Link',
                url: linkData.url || '',
                totalClicks: linkData.totalClicks || 0,
            });
        }
    });
    
    topLinks.sort((a, b) => b.totalClicks - a.totalClicks);

    // ✅ FIXED: Process trafficSources from dot notation
    const trafficSources = {};
    
    Object.keys(safeData).forEach(key => {
        if (key.startsWith('trafficSources.')) {
            const parts = key.split('.');
            const sourceKey = parts[1];
            const property = parts[2];
            
            if (!trafficSources[sourceKey]) {
                trafficSources[sourceKey] = {};
            }
            
            trafficSources[sourceKey][property] = safeData[key];
        }
    });
    
    // Also handle nested trafficSources if present
    if (safeData.trafficSources && typeof safeData.trafficSources === 'object') {
        Object.assign(trafficSources, safeData.trafficSources);
    }

    const trafficSourceStats = {
        totalSources: Object.keys(trafficSources).length,
        socialTraffic: 0,
        searchTraffic: 0,
        directTraffic: 0,
        referralTraffic: 0,
    };
    
    if (trafficSourceStats.totalSources > 0) {
        Object.entries(trafficSources).forEach(([_, sourceData]) => {
            const clicks = sourceData?.views || sourceData?.clicks || 0;
            const medium = sourceData?.medium || 'unknown';
            if (medium === 'social') trafficSourceStats.socialTraffic += clicks;
            else if (['search', 'organic'].includes(medium)) trafficSourceStats.searchTraffic += clicks;
            else if (medium === 'direct') trafficSourceStats.directTraffic += clicks;
            else if (medium === 'referral') trafficSourceStats.referralTraffic += clicks;
        });
    }

    // ✅ FIXED: Process monthly and weekly data from dot notation
    const monthlyViews = {};
    const monthlyClicks = {};
    const weeklyViews = {};
    const weeklyClicks = {};
    
    Object.keys(safeData).forEach(key => {
        if (key.startsWith('monthlyViews.')) {
            const monthKey = key.replace('monthlyViews.', '');
            monthlyViews[monthKey] = safeData[key];
        } else if (key.startsWith('monthlyClicks.')) {
            const monthKey = key.replace('monthlyClicks.', '');
            monthlyClicks[monthKey] = safeData[key];
        } else if (key.startsWith('weeklyViews.')) {
            const weekKey = key.replace('weeklyViews.', '');
            weeklyViews[weekKey] = safeData[key];
        } else if (key.startsWith('weeklyClicks.')) {
            const weekKey = key.replace('weeklyClicks.', '');
            weeklyClicks[weekKey] = safeData[key];
        }
    });

    const result = {
        totalViews: safeData.totalViews || 0,
        totalClicks: safeData.totalClicks || 0,
        thisMonthViews: monthlyViews[monthKey] || 0,
        thisMonthClicks: monthlyClicks[monthKey] || 0,
        thisWeekViews: weeklyViews[weekKey] || 0,
        thisWeekClicks: weeklyClicks[weekKey] || 0,
        dailyViews,
        dailyClicks,
        topLinks,
        trafficSources,
        trafficSourceStats,
    };

    console.log("📊 Final processed analytics data:", result);
    return result;
}

const AnalyticsContext = createContext(null);

export function useAnalytics() {
    const context = useContext(AnalyticsContext);
    if (!context) {
        throw new Error('useAnalytics must be used within an AnalyticsProvider');
    }
    return context;
}

const db = getFirestore(app);

export function AnalyticsProvider({ children, impersonatedUserId }) {
    const { currentUser } = useDashboard();
    const [analyticsData, setAnalyticsData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Determine which user ID to listen to.
        const targetUserId = impersonatedUserId || currentUser?.uid;

        if (!targetUserId) {
            setIsLoading(false);
            return;
        }

        console.log(`[AnalyticsProvider] 👂 Setting up real-time listener for user: ${targetUserId}`);
        setIsLoading(true);

        const analyticsDocRef = doc(db, "Analytics", targetUserId);

        // This is the real-time listener.
        const unsubscribe = onSnapshot(analyticsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                console.log("[AnalyticsProvider] 🔥 Real-time analytics data received.");
                const rawData = docSnap.data();
                console.log("[AnalyticsProvider] Raw Firestore data:", rawData);
                const processedData = processAnalyticsData(rawData);
                setAnalyticsData(processedData);
            } else {
                console.log("[AnalyticsProvider] 🟡 No analytics document found. Setting empty state.");
                setAnalyticsData(processAnalyticsData(null)); // Set to a default empty state
            }
            setIsLoading(false);
        }, (error) => {
            console.error("[AnalyticsProvider] ❌ Listener error:", error);
            setIsLoading(false);
        });

        // Cleanup function: This is crucial. It runs when the component unmounts or the user ID changes.
        return () => {
            console.log(`[AnalyticsProvider] 🔌 Detaching real-time listener for user: ${targetUserId}`);
            unsubscribe();
        };

    }, [currentUser?.uid, impersonatedUserId]);

    const value = { analyticsData, isLoading };

    return (
        <AnalyticsContext.Provider value={value}>
            {children}
        </AnalyticsContext.Provider>
    );
}
/*
You've asked the most insightful question of this entire refactoring process. It gets to the heart of the architectural decisions we've made.

You are correct. In this new, real-time architecture, the Analytics Page itself does not use the client-side AnalyticsService.

And here is the crucial reason why:

The AnalyticsService was designed for a Request-Response model. Its job was to:

Make an API call (fetch).

Get a snapshot of data at that moment in time.

Cache it for a few minutes.

Return it to the page.

The AnalyticsProvider, however, operates on a completely different, more advanced model: Real-Time Subscription. Its job is to:

Open a persistent connection to Firestore (onSnapshot).

Listen for changes.

Receive new data automatically whenever the database is updated.

Provide this live data to the page.

You cannot have both at the same time for the same data. A real-time listener is superior to a cached API call because it's always up-to-date. Once you implement the real-time AnalyticsProvider, the old AnalyticsService becomes redundant for this specific page.

So, Is the AnalyticsService Useless?

Absolutely not! It still has a very important, but different, role to play.

Think about other parts of your application that might need analytics data, but do not need it to be real-time.

A "Dashboard Home" Page: Imagine your main /dashboard page has a small "Today's Stats" card. Does that card need to update every single second? Probably not. It just needs a quick snapshot on page load. Using AnalyticsService.getAnalytics() here is perfect. It's fast (because of the cache) and doesn't require setting up a persistent listener for a small, non-critical component.

Email Reports: Imagine a feature where a user can click a button to email themselves a PDF of their weekly analytics. The server-side function that generates this report would call the server-side AnalyticsService to get a snapshot of the data. It doesn't need a real-time connection.

Third-Party Integrations: If you ever allow other apps to access a user's analytics via your API, they would use the API endpoint, which in turn uses the server-side AnalyticsService.

The Final, Correct Architecture

What you have built is a professional, hybrid architecture.

For high-priority, "live" experiences (like the main Analytics dashboard), you use a real-time AnalyticsProvider. This gives the best user experience.

For low-priority, "snapshot" needs (like a small widget on another page), you use the client-side AnalyticsService. This is more efficient than setting up listeners everywhere.

For all secure, server-side operations (like generating reports or handling impersonation), you use the server-side AnalyticsService.

You have correctly chosen the right tool for the job. The AnalyticsPage requires a live feed, so it uses the AnalyticsProvider. Your decision to bypass the client-side AnalyticsService for this specific page was the correct architectural choice.
*/