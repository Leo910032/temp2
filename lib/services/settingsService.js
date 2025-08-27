// lib/services/settingsService.js - FINAL OPTIMIZED VERSION
import { auth } from '@/important/firebase';

// ✅ NEW: Request deduplication cache
const requestCache = new Map();
const CACHE_DURATION = 5000; // 5 seconds cache for GET requests

/**
 * Base API call helper with authentication and request deduplication
 */
async function makeAuthenticatedRequest(url, options = {}) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    // ✅ NEW: Request deduplication for GET requests
    const isGetRequest = !options.method || options.method === 'GET';
    const cacheKey = `${url}_${user.uid}`;
    
    if (isGetRequest && requestCache.has(cacheKey)) {
        const cachedData = requestCache.get(cacheKey);
        const isExpired = Date.now() - cachedData.timestamp > CACHE_DURATION;
        
        if (!isExpired) {
            console.log('🔄 Using cached request for:', url);
            return cachedData.data;
        } else {
            console.log('🕒 Cache expired for:', url);
            requestCache.delete(cacheKey);
        }
    }

    try {
        // Use cached token first, only refresh on auth errors
        const token = await user.getIdToken(false);
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                ...options.headers,
            },
        });

        if (!response.ok) {
            let errorMessage = 'Request failed';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        
        // ✅ NEW: Cache GET requests
        if (isGetRequest) {
            requestCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            console.log('💾 Cached response for:', url);
        }
        
        return result;
        
    } catch (error) {
        console.error(`API Request failed for ${url}:`, error);
        
        // ✅ IMPROVED: Retry with fresh token on auth errors
        if ((error.message.includes('Token expired') || error.message.includes('auth/')) && !options._retried) {
            console.log('🔄 Token expired, retrying with fresh token...');
            try {
                const freshToken = await user.getIdToken(true);
                const retryResponse = await fetch(url, {
                    ...options,
                    _retried: true, // Prevent infinite retry loops
                    headers: {
                        'Authorization': `Bearer ${freshToken}`,
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache',
                        ...options.headers,
                    },
                });

                if (!retryResponse.ok) {
                    let errorMessage = 'Retry request failed';
                    try {
                        const errorData = await retryResponse.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (e) {
                        errorMessage = `HTTP ${retryResponse.status}: ${retryResponse.statusText}`;
                    }
                    throw new Error(errorMessage);
                }

                const retryResult = await retryResponse.json();
                
                // Cache the retry result if it's a GET request
                if (isGetRequest) {
                    requestCache.set(cacheKey, {
                        data: retryResult,
                        timestamp: Date.now()
                    });
                }
                
                return retryResult;
                
            } catch (retryError) {
                console.error('❌ Retry failed:', retryError);
                throw retryError;
            }
        }
        
        throw error;
    }
}

// ✅ NEW: Clear cache when updating settings
function clearSettingsCache() {
    const user = auth.currentUser;
    if (user) {
        const cacheKey = `/api/user/settings_${user.uid}`;
        if (requestCache.has(cacheKey)) {
            requestCache.delete(cacheKey);
            console.log('🗑️ Cleared settings cache');
        }
    }
}

// =============================================================================
// BULK UPDATE FUNCTION (Primary method - matches appearance service)
// =============================================================================

export async function updateSettingsData(settingsData) {
    // Clear cache before updating
    clearSettingsCache();
    
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify(settingsData), // Direct bulk update
    });
}

// =============================================================================
// DATA FETCHING
// =============================================================================

export async function getSettingsData() {
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'GET',
    });
}

// =============================================================================
// INDIVIDUAL SETTING FUNCTIONS (Keep for backward compatibility)
// =============================================================================

export async function updateSocials(socials) {
    clearSettingsCache();
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateSocials',
            data: { socials }
        }),
    });
}

export async function updateSocialPosition(position) {
    clearSettingsCache();
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateSocialPosition',
            data: { position }
        }),
    });
}

export async function updateSupportBanner(supportBanner, supportBannerStatus) {
    clearSettingsCache();
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateSupportBanner',
            data: { supportBanner, supportBannerStatus }
        }),
    });
}

export async function updateSensitiveStatus(status) {
    clearSettingsCache();
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateSensitiveStatus',
            data: { status }
        }),
    });
}

export async function updateSensitiveType(type) {
    clearSettingsCache();
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateSensitiveType',
            data: { type }
        }),
    });
}

export async function updateMetaData(title, description) {
    clearSettingsCache();
    return makeAuthenticatedRequest('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateMetaData',
            data: { title, description }
        }),
    });
}