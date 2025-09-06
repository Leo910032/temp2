// File: lib/rateLimiter.js
const rateLimitMap = new Map();

/**
 * A simple in-memory rate limiter.
 * @param {string} identifier - A unique identifier for the request source (e.g., user UID or IP address).
 * @param {number} maxRequests - The maximum number of requests allowed in the window.
 * @param {number} windowMs - The time window in milliseconds.
 * @returns {boolean} - True if the request is allowed, false if it's rate-limited.
 */
export function rateLimit(identifier, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const userRequests = rateLimitMap.get(identifier) || [];

    // Filter out requests that are older than the time window
    const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);

    if (recentRequests.length >= maxRequests) {
        return false; // Rate limit exceeded
    }

    // Add the current request timestamp and update the map
    recentRequests.push(now);
    rateLimitMap.set(identifier, recentRequests);
    
    return true; // Request is allowed
}
