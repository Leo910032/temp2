// File: lib/rateLimiter.js
/**
 * THIS FILE HAS BEEN REFACTORED
 *
 * Enhanced rate limiter with sophisticated fingerprinting to prevent false positives
 * while still protecting against abuse.
 *
 * Key features:
 * - Multi-factor fingerprinting (IP + User Agent + Session Cookie)
 * - Sliding window algorithm with burst allowance
 * - Different limits for different event types
 * - Convention-friendly: Won't block legitimate use at events
 */

import crypto from 'crypto';

const rateLimitMap = new Map();
const fingerprintCache = new Map();

// Lazy import adminDb to avoid circular dependencies
let adminDb = null;
async function getAdminDb() {
    if (!adminDb) {
        const { adminDb: db } = await import('./firebaseAdmin.js');
        adminDb = db;
    }
    return adminDb;
}

/**
 * Generate a sophisticated fingerprint from multiple factors
 * @param {Object} factors - Fingerprinting factors
 * @param {string} factors.ip - IP address
 * @param {string} factors.userAgent - User agent string
 * @param {string} factors.sessionId - Session ID from cookie
 * @param {string} factors.salt - Salt for hashing
 * @returns {string} - Fingerprint hash
 */
export function generateFingerprint({ ip, userAgent, sessionId, salt = 'default_salt' }) {
    // Create a composite key from multiple factors
    const factors = [
        ip || 'unknown_ip',
        userAgent ? crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 8) : 'unknown_ua',
        sessionId || 'no_session',
        salt
    ].join('::');

    // Hash the composite key for privacy
    return crypto.createHash('sha256').update(factors).digest('hex').substring(0, 16);
}

/**
 * Log rate limit event to Firestore
 * @param {Object} eventData - Rate limit event data
 */
async function logRateLimitEvent(eventData) {
    try {
        const db = await getAdminDb();
        const logRef = db.collection('RateLimits').doc();

        await logRef.set({
            ...eventData,
            timestamp: new Date(),
            createdAt: new Date().toISOString()
        });

        console.log(`📊 Rate limit event logged: ${eventData.eventType} - ${eventData.scenario}`);
    } catch (error) {
        console.error('❌ Failed to log rate limit event:', error);
        // Don't throw - logging failures shouldn't break the rate limiter
    }
}

/**
 * Enhanced rate limiter with burst allowance and sliding window
 * @param {string} identifier - Unique identifier for the request source
 * @param {Object} options - Rate limit configuration
 * @param {number} options.maxRequests - Maximum requests in the window
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.burstAllowance - Additional burst requests allowed
 * @param {Object} options.metadata - Additional metadata for logging (eventType, userId, ip, userAgent)
 * @returns {Object} - { allowed: boolean, remaining: number, resetTime: number }
 */
export function rateLimit(identifier, options = {}) {
    const {
        maxRequests = 10,
        windowMs = 60000,
        burstAllowance = 2,
        metadata = {}
    } = options;

    const now = Date.now();
    const record = rateLimitMap.get(identifier) || {
        requests: [],
        burstUsed: 0,
        firstRequest: now
    };

    // Filter out requests older than the window (for rate limiting logic)
    const recentRequests = record.requests.filter(timestamp => now - timestamp < windowMs);

    // ✅ BOT DETECTION: Add current request temporarily to check patterns
    // This ensures we catch rapid bursts INCLUDING the current request
    const allRequestsWithCurrent = [...recentRequests, now];

    // Calculate bot detection metrics on ALL requests (including current)
    const requestsInLastSecond = allRequestsWithCurrent.filter(timestamp => now - timestamp < 1000).length;
    const requestsInLast500ms = allRequestsWithCurrent.filter(timestamp => now - timestamp < 500).length;
    const requestsInLast200ms = allRequestsWithCurrent.filter(timestamp => now - timestamp < 200).length;

    // Calculate request rate from most recent burst
    let requestRate = 0;
    if (requestsInLastSecond > 0) {
        const recentBurst = allRequestsWithCurrent.filter(timestamp => now - timestamp < 1000);
        if (recentBurst.length > 1) {
            const burstTimeSpan = now - recentBurst[0];
            requestRate = burstTimeSpan > 0 ? (recentBurst.length / burstTimeSpan) * 1000 : 0;
        }
    }

    // Reset burst allowance after the window expires
    const timeSinceFirstRequest = now - record.firstRequest;
    if (timeSinceFirstRequest > windowMs) {
        record.burstUsed = 0;
        record.firstRequest = now;
    }

    // Calculate effective limit with burst
    const effectiveLimit = maxRequests + (burstAllowance - record.burstUsed);
    const remaining = Math.max(0, effectiveLimit - recentRequests.length);

    if (recentRequests.length >= effectiveLimit) {
        // Rate limit exceeded - Determine if it's a bot attack or just over limit

        // ✅ IMPROVED BOT DETECTION: Multi-factor analysis
        // Bot attack detection criteria (any of these indicates bot):
        // 1. 5+ requests in last 1 second
        // 2. 4+ requests in last 500ms
        // 3. 3+ requests in last 200ms (very rapid)
        // 4. Average rate > 8 requests/second in the recent burst
        const isBotAttack = requestsInLastSecond >= 5 ||
                           requestsInLast500ms >= 4 ||
                           requestsInLast200ms >= 3 ||
                           requestRate > 8;

        const scenario = isBotAttack ? 'bot_attack' : 'rate_limit_exceeded';

        // Log to RateLimits collection (fire and forget - don't await)
        logRateLimitEvent({
            scenario,
            fingerprint: identifier,
            eventType: metadata.eventType || 'unknown',
            userId: metadata.userId || null,
            ip: metadata.ip || 'unknown',
            userAgent: metadata.userAgent || 'unknown',
            requestCount: recentRequests.length,
            effectiveLimit,
            windowMs,
            requestsInLastSecond,
            requestsInLast500ms,
            requestsInLast200ms,
            requestRate: requestRate.toFixed(2),
            burstUsed: record.burstUsed,
            timeSinceFirstRequest,
            severity: scenario === 'bot_attack' ? 'HIGH' : 'MEDIUM'
        }).catch(err => {
            // Silently fail - don't break rate limiting
            console.error('Failed to log rate limit event:', err.message);
        });

        rateLimitMap.set(identifier, {
            ...record,
            requests: recentRequests
        });

        const oldestRequest = recentRequests[0];
        const resetTime = oldestRequest + windowMs;

        return {
            allowed: false,
            remaining: 0,
            resetTime,
            retryAfter: Math.ceil((resetTime - now) / 1000)
        };
    }

    // Track if burst capacity was used
    const wasBurstUsedBefore = record.burstUsed > 0;
    if (recentRequests.length >= maxRequests) {
        record.burstUsed = Math.min(burstAllowance, record.burstUsed + 1);

        // Log Convention Burst scenario (first time burst is used)
        if (!wasBurstUsedBefore && record.burstUsed > 0) {
            logRateLimitEvent({
                scenario: 'convention_burst',
                fingerprint: identifier,
                eventType: metadata.eventType || 'unknown',
                userId: metadata.userId || null,
                ip: metadata.ip || 'unknown',
                userAgent: metadata.userAgent || 'unknown',
                requestCount: recentRequests.length + 1, // +1 for current request
                maxRequests,
                burstAllowance,
                burstUsed: record.burstUsed,
                windowMs,
                timeSinceFirstRequest,
                severity: 'LOW',
                note: 'Legitimate burst usage detected - likely convention/event scenario'
            }).catch(err => {
                console.error('Failed to log burst event:', err.message);
            });
        }
    }

    // Add current request timestamp
    recentRequests.push(now);
    rateLimitMap.set(identifier, {
        ...record,
        requests: recentRequests
    });

    return {
        allowed: true,
        remaining: remaining - 1,
        resetTime: now + windowMs,
        retryAfter: 0
    };
}

/**
 * Apply rate limit with fingerprinting for analytics events
 * @param {Object} request - Request object
 * @param {string} eventType - Type of analytics event
 * @param {Object} rateLimitConfig - Rate limit configuration for the event type
 * @param {string} userId - Optional userId for logging
 * @returns {Object} - Rate limit result
 */
export function applyAnalyticsRateLimit(request, eventType, rateLimitConfig, userId = null) {
    // Extract fingerprinting factors from request
    const ip = request.ip ||
               request.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
               '127.0.0.1';

    const userAgent = request.headers?.get?.('user-agent') ||
                      request.headers?.['user-agent'] ||
                      'unknown';

    // Try to get session ID from cookies
    const cookieHeader = request.headers?.get?.('cookie') ||
                         request.headers?.cookie ||
                         '';
    const sessionCookie = cookieHeader.split(';')
        .find(c => c.trim().startsWith('analytics_session='));
    const sessionId = sessionCookie ? sessionCookie.split('=')[1] : null;

    // Generate fingerprint
    const fingerprint = generateFingerprint({
        ip,
        userAgent,
        sessionId,
        salt: `analytics_${eventType}`
    });

    // Apply rate limit with metadata for logging
    return rateLimit(fingerprint, {
        ...rateLimitConfig,
        metadata: {
            eventType,
            userId,
            ip,
            userAgent
        }
    });
}

/**
 * Clean up old rate limit records (call periodically)
 * @param {number} maxAge - Maximum age in milliseconds (default: 1 hour)
 */
export function cleanupRateLimitMap(maxAge = 60 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;

    for (const [identifier, record] of rateLimitMap.entries()) {
        const recentRequests = record.requests.filter(timestamp => now - timestamp < maxAge);

        if (recentRequests.length === 0) {
            rateLimitMap.delete(identifier);
            cleaned++;
        } else {
            rateLimitMap.set(identifier, {
                ...record,
                requests: recentRequests
            });
        }
    }

    if (cleaned > 0) {
        console.log(`🧹 Rate limiter: Cleaned up ${cleaned} old records`);
    }

    return cleaned;
}

/**
 * Get rate limit stats for monitoring
 * @returns {Object} - Stats about current rate limits
 */
export function getRateLimitStats() {
    return {
        totalIdentifiers: rateLimitMap.size,
        fingerprintCacheSize: fingerprintCache.size,
        memoryUsage: process.memoryUsage().heapUsed
    };
}

// Cleanup task: Run every 15 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        cleanupRateLimitMap();
    }, 15 * 60 * 1000);
}
