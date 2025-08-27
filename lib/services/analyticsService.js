// File: lib/services/analyticsService.js

// --- Session Manager (Client-Side) ---
class SessionManager {
    static SESSION_KEY = 'tapit_session_data';
    static SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

    static getOrCreateSession() {
        if (typeof window === 'undefined') return {};
        try {
            const stored = sessionStorage.getItem(this.SESSION_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Date.now() - parsed.timestamp < this.SESSION_DURATION) {
                    return parsed; // Return existing, valid session
                }
            }
        } catch (e) { /* ignore parsing errors */ }

        // Create a new session if none exists or is expired
        const referrer = document.referrer;
        const utmParams = new URLSearchParams(window.location.search);
        const trafficSource = this.detectTrafficSource(referrer, utmParams);

        const newSession = {
            sessionId: `sid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            originalReferrer: referrer,
            landingPage: window.location.href,
            trafficSource,
            utm: {
                source: utmParams.get('utm_source'),
                medium: utmParams.get('utm_medium'),
                campaign: utmParams.get('utm_campaign'),
            },
            timestamp: Date.now(),
        };
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(newSession));
        return newSession;
    }

    static detectTrafficSource(referrer, utmParams) {
        if (utmParams.get('utm_source')) {
            return { source: utmParams.get('utm_source'), medium: utmParams.get('utm_medium') || 'cpc', type: 'utm' };
        }
        if (!referrer) return { source: 'direct', medium: 'direct', type: 'direct' };
        
        const domain = new URL(referrer).hostname.toLowerCase();
        // Simplified detection logic
        if (/(google|bing|yahoo|duckduckgo)\./.test(domain)) return { source: domain.split('.')[0], medium: 'organic', type: 'search' };
        if (/(facebook|instagram|twitter|linkedin|tiktok|youtube)\./.test(domain)) return { source: domain.split('.')[0], medium: 'social', type: 'social' };
        
        return { source: domain, medium: 'referral', type: 'referral' };
    }
}

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
