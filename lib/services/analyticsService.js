// File: lib/services/analyticsService.js
/**
 * ⚠️ DEPRECATED - This file is kept for backward compatibility only
 *
 * Please use the new analytics service instead:
 * @see lib/services/serviceUser/client/services/TrackAnalyticsService.js
 *
 * Migration guide:
 * - Old: import { trackView, trackClick } from '@/lib/services/analyticsService'
 * - New: import { TrackAnalyticsService } from '@/lib/services/serviceUser/client/services/TrackAnalyticsService'
 *
 * - Old: trackView(userId, username)
 * - New: TrackAnalyticsService.trackView(userId, username)
 *
 * - Old: trackClick(userId, linkData)
 * - New: TrackAnalyticsService.trackClick(userId, linkData)
 */

// --- Session Manager (Client-Side) ---
// Simple session manager for backward compatibility
const SessionManager = {
    getOrCreateSession() {
        if (typeof window === 'undefined') return null;

        try {
            const now = Date.now();
            const sessionKey = 'analytics_session';
            const storedSession = localStorage.getItem(sessionKey);

            if (storedSession) {
                const session = JSON.parse(storedSession);
                // Check if session is still valid (30 minutes)
                if (now - session.startTime < 30 * 60 * 1000) {
                    return session;
                }
            }

            // Create new session
            const newSession = {
                sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
                startTime: now,
                referrer: document.referrer || 'direct',
                userAgent: navigator.userAgent
            };

            localStorage.setItem(sessionKey, JSON.stringify(newSession));
            return newSession;
        } catch (error) {
            console.warn('SessionManager error:', error);
            return null;
        }
    }
};


// --- Main Tracking Function ---
async function trackEvent(payload) {
    if (typeof window === 'undefined') return;

    // Do not track in preview mode
    const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
    if (isPreview) {
        console.log(' G-Analytics: Preview mode detected, tracking skipped.');
        return;
    }
    
    try {
        // Use `navigator.sendBeacon` if available for reliability.
        // It sends the request even if the page is closing (e.g., after a link click).
        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            navigator.sendBeacon('/api/user/analytics/track', blob);
        } else {
            await fetch('/api/analytics/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true, // Important for requests during page unload
            });
        }
    } catch (error) {
        console.error(' G-Analytics Service Error:', error);
    }
}

/**
 * Tracks a profile view.
 * @param {string} userId - The UID of the profile being viewed.
 * @param {string} username - The username of the profile being viewed.
 */
export function trackView(userId, username) {
    console.log(` G-Analytics: Queuing 'view' for ${username} (${userId})`);
    const sessionData = SessionManager.getOrCreateSession();
    trackEvent({
        eventType: 'view',
        userId,
        username,
        sessionData,
    });
}

/**
 * Tracks an outbound link click.
 * @param {string} userId - The UID of the profile owner.
 * @param {object} linkData - Contains linkId, linkTitle, linkUrl, linkType.
 */
export function trackClick(userId, linkData) {
    console.log(` G-Analytics: Queuing 'click' on "${linkData.linkTitle}"`);
    const sessionData = SessionManager.getOrCreateSession();
    trackEvent({
        eventType: 'click',
        userId,
        linkData,
        sessionData,
    });
}
