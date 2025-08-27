// lib/services/appearanceService.js - FIXED VERSION with Token Caching
import { auth } from '@/important/firebase';

// ✅ ADD: Request deduplication to prevent multiple simultaneous calls
const requestCache = new Map();

/**
 * ✅ IMPROVED: Base API call helper with token caching and request deduplication
 */
async function makeAuthenticatedRequest(url, options = {}) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    // ✅ ADD: Request deduplication for GET requests
    const isGetRequest = !options.method || options.method === 'GET';
    if (isGetRequest) {
        const cacheKey = `${url}_${user.uid}`;
        if (requestCache.has(cacheKey)) {
            console.log('🔄 Using cached request for:', url);
            return requestCache.get(cacheKey);
        }
    }

    const requestPromise = (async () => {
        try {
            // ✅ FIXED: Use cached token instead of forcing refresh
            const token = await user.getIdToken(false); // Don't force refresh!
            
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
            
            // ✅ ADD: Cache GET requests for 30 seconds
            if (isGetRequest) {
                const cacheKey = `${url}_${user.uid}`;
                requestCache.set(cacheKey, result);
                setTimeout(() => requestCache.delete(cacheKey), 30000);
            }
            
            return result;
        } catch (error) {
            console.error(`API Request failed for ${url}:`, error);
            
            // ✅ ADD: Token refresh retry logic for auth errors
            if (error.message.includes('auth/') && !options._retried) {
                console.log('🔄 Retrying with fresh token...');
                try {
                    const freshToken = await user.getIdToken(true);
                    return makeAuthenticatedRequest(url, { 
                        ...options, 
                        _retried: true,
                        headers: {
                            ...options.headers,
                            'Authorization': `Bearer ${freshToken}`
                        }
                    });
                } catch (retryError) {
                    console.error('❌ Retry failed:', retryError);
                    throw retryError;
                }
            }
            
            throw error;
        }
    })();

    // Cache the promise for GET requests
    if (isGetRequest) {
        const cacheKey = `${url}_${user.uid}`;
        requestCache.set(cacheKey, requestPromise);
    }

    return requestPromise;
}

/**
 * Upload file with proper error handling
 */
async function uploadFile(file, uploadType) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    try {
        // ✅ FIXED: Don't force token refresh
        const token = await user.getIdToken(false);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadType', uploadType);

        const response = await fetch('/api/user/appearance/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                // ✅ IMPORTANT: Don't set Content-Type for FormData - let browser set it with boundary
            },
            body: formData,
        });

        if (!response.ok) {
            let errorMessage = 'Upload failed';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        return response.json();
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}

// =============================================================================
// BULK UPDATE FUNCTION (New approach to reduce API calls)
// =============================================================================

export async function updateAppearanceData(appearanceData) {
    // ✅ ADD: Clear cache when updating data
    const user = auth.currentUser;
    if (user) {
        const cacheKey = `/api/user/appearance/theme_${user.uid}`;
        requestCache.delete(cacheKey);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify(appearanceData),
    });
}

// =============================================================================
// THEME FUNCTIONS (Keep for backward compatibility)
// =============================================================================

export async function updateTheme(theme, themeColor = '#000') {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateTheme',
            data: { theme, themeColor }
        }),
    });
}

export async function updateThemeBackground(type) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateBackground',
            data: { type }
        }),
    });
}

export async function updateThemeBackgroundColor(color) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateBackgroundColor',
            data: { color }
        }),
    });
}

export async function updateThemeButton(btnType) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateButton',
            data: { btnType }
        }),
    });
}

export async function updateThemeBtnColor(color) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateButtonColor',
            data: { color }
        }),
    });
}

export async function updateThemeBtnFontColor(color) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateButtonFontColor',
            data: { color }
        }),
    });
}

export async function updateThemeBtnShadowColor(color) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateButtonShadowColor',
            data: { color }
        }),
    });
}

export async function updateThemeTextColour(color) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateTextColor',
            data: { color }
        }),
    });
}

export async function updateThemeGradientDirection(direction) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateGradientDirection',
            data: { direction }
        }),
    });
}

export async function updateThemeFont(fontType) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateFont',
            data: { fontType }
        }),
    });
}

export async function updateChristmasAccessory(accessoryType) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateChristmasAccessory',
            data: { accessoryType }
        }),
    });
}

// =============================================================================
// FILE UPLOAD FUNCTIONS
// =============================================================================

export async function uploadProfileImage(file) {
    return uploadFile(file, 'profile');
}

export async function uploadBackgroundImage(file) {
    return uploadFile(file, 'backgroundImage');
}

export async function uploadBackgroundVideo(file) {
    return uploadFile(file, 'backgroundVideo');
}

// ✅ NEW: CV Document Functions
export async function uploadCVDocument(file) {
    return uploadFile(file, 'cv');
}

export async function removeProfileImage() {
    return makeAuthenticatedRequest('/api/user/appearance/upload', {
        method: 'DELETE',
        body: JSON.stringify({
            deleteType: 'profile'
        }),
    });
}

export async function removeBackgroundImage() {
    return makeAuthenticatedRequest('/api/user/appearance/upload', {
        method: 'DELETE',
        body: JSON.stringify({
            deleteType: 'backgroundImage'
        }),
    });
}

export async function removeBackgroundVideo() {
    return makeAuthenticatedRequest('/api/user/appearance/upload', {
        method: 'DELETE',
        body: JSON.stringify({
            deleteType: 'backgroundVideo'
        }),
    });
}

// ✅ NEW: Remove CV Document
export async function removeCVDocument() {
    return makeAuthenticatedRequest('/api/user/appearance/upload', {
        method: 'DELETE',
        body: JSON.stringify({
            deleteType: 'cv'
        }),
    });
}

// =============================================================================
// DATA FETCHING
// =============================================================================

export async function getAppearanceData() {
    return makeAuthenticatedRequest('/api/user/appearance/theme', {
        method: 'GET',
    });
}

// =============================================================================
// PROFILE TEXT UPDATES
// =============================================================================

export async function updateDisplayName(displayName) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/profile/text', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateDisplayName',
            data: { displayName }
        }),
    });
}

export async function updateBio(bio) {
    const user = auth.currentUser;
    if (user) {
        requestCache.delete(`/api/user/appearance/theme_${user.uid}`);
    }
    
    return makeAuthenticatedRequest('/api/user/appearance/profile/text', {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateBio',
            data: { bio }
        }),
    });
}