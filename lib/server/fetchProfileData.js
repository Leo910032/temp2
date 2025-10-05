// File: lib/server/fetchProfileData.js
/**
 * THIS FILE HAS BEEN REFACTORED
 * Updated to work with the new user document structure in 'users' collection
 */

import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}
const adminDb = getFirestore();

// Add this function to lib/server/fetchProfileData.js

/**
 * Fetches all usernames for static site generation (SSG).
 * This function uses the Admin SDK and bypasses security rules.
 * @returns {Promise<string[]>} An array of usernames.
 */
export async function fetchAllUsernames() {
    try {
        console.log('🔥 [Admin] Fetching all usernames for generateStaticParams...');
        const usersRef = adminDb.collection('users');
        
        // Only get documents where the profile is public
        const snapshot = await usersRef.where('settings.isPublic', '==', true).get();
        
        if (snapshot.empty) {
            console.log('⚠️ [Admin] No public users found to generate static pages.');
            return [];
        }

        const usernames = snapshot.docs.map(doc => doc.data().username).filter(Boolean);
        console.log(`✅ [Admin] Found ${usernames.length} usernames to build.`);
        return usernames;

    } catch (error) {
        console.error('❌ FATAL ERROR in fetchAllUsernames:', error);
        return [];
    }
}
export async function fetchProfileByUsername(identifier) {
    try {
        // Updated to use 'users' collection instead of 'AccountData'
        const usersRef = adminDb.collection('users');
        let userDoc = null;

        // 1. Try to find user by username (case insensitive)
        const usernameQuery = await usersRef.where('username', '==', identifier.toLowerCase()).limit(1).get();
        if (!usernameQuery.empty) {
            userDoc = usernameQuery.docs[0];
        } else {
            // 2. If not found, try to find by UID
            const uidDoc = await usersRef.doc(identifier).get();
            if (uidDoc.exists) {
                userDoc = uidDoc;
            }
        }

        if (!userDoc) {
            console.log(`Profile not found for identifier: "${identifier}"`);
            return null;
        }
        
        const userData = userDoc.data();
        
        // Extract data from the new nested document structure
        const profile = userData.profile || {};
        const appearance = userData.appearance || {};
        const settings = userData.settings || {};

        // 3. Sanitize the data: Create a new object with only public-safe fields.
        const publicProfileData = {
            // Core identity fields
            uid: userDoc.id,
            username: userData.username || '',
            
            // Profile data from profile object
            displayName: profile.displayName || '',
            bio: profile.bio || '',
            avatarUrl: profile.avatarUrl || '',
            location: profile.location || '',
            
            // Content arrays
            links: userData.links || [],
            socials: userData.socials || [],
            
            // ✅ FIXED: Complete appearance settings - ADD ALL MISSING FIELDS
            selectedTheme: appearance.selectedTheme || 'Lake White',
            themeFontColor: appearance.themeFontColor || '#000000',
            fontType: appearance.fontType || 0,
            backgroundColor: appearance.backgroundColor || '#FFFFFF',
            backgroundType: appearance.backgroundType || 'Color',
            btnColor: appearance.btnColor || '#000000',
            btnFontColor: appearance.btnFontColor || '#FFFFFF',
            btnShadowColor: appearance.btnShadowColor || '#dcdbdb', // ✅ ADD THIS
            btnType: appearance.btnType || 0,
            
            // ✅ ADD MISSING GRADIENT FIELDS
            gradientDirection: appearance.gradientDirection || 0,
            gradientColorStart: appearance.gradientColorStart || '#FFFFFF',
            gradientColorEnd: appearance.gradientColorEnd || '#000000',

            backgroundImage: appearance.backgroundImage || '',
            gradientSettings: appearance.gradientSettings || null,
            customCSS: appearance.customCSS || '',

            // 🆕 Banner fields
            bannerType: appearance.bannerType || 'None',
            bannerColor: appearance.bannerColor || '#3B82F6',
            bannerGradientStart: appearance.bannerGradientStart || '#667eea',
            bannerGradientEnd: appearance.bannerGradientEnd || '#764ba2',
            bannerGradientDirection: appearance.bannerGradientDirection || 'to right',
            bannerImage: appearance.bannerImage || null,
            bannerVideo: appearance.bannerVideo || null,

            // 🆕 Carousel fields
            carouselEnabled: appearance.carouselEnabled || false,
            carouselItems: appearance.carouselItems || [],
            carouselStyle: appearance.carouselStyle || 'modern',

            // 🆕 Video Embed fields
            videoEmbedEnabled: appearance.videoEmbedEnabled || false,
            videoEmbedItems: appearance.videoEmbedItems || [],

            // 🆕 CV fields
            cvEnabled: appearance.cvEnabled || false,
            cvItems: appearance.cvItems || [],
            // CV Document from appearance (legacy)
            cvDocument: appearance.cvDocument || null,

            // 🆕 Subscription level for permission checks
subscriptionLevel: userData.accountType || 'base', // ✅ FI X: Read from accountType instead of subscriptionLevel
            
            // Public settings
            isPublic: settings.isPublic !== false,
            allowMessages: settings.allowMessages !== false,
            contactExchangeEnabled: settings.contactExchangeEnabled !== false,
            sensitiveStatus: settings.sensitiveStatus || false,
            
            // Add the nested objects for components that need them
            profile: profile,
            appearance: appearance,
            settings: settings,
            
            // Metadata for SEO
            metaData: {
                title: `${profile.displayName || userData.username || 'User'}'s Profile`,
                description: profile.bio || `Check out ${profile.displayName || userData.username || 'this user'}'s links`
            }
        };

        // Only return data if the profile is public
        if (!publicProfileData.isPublic) {
            console.log(`Profile for "${identifier}" is private`);
            return null;
        }

        console.log(`✅ Successfully fetched public profile for: "${identifier}"`);
        console.log('📋 Profile data keys:', Object.keys(publicProfileData));
        
        // ✅ ADD DEBUG LOG FOR THEME DATA
        console.log('🎨 Theme data in fetch:', {
            selectedTheme: publicProfileData.selectedTheme,
            backgroundType: publicProfileData.backgroundType,
            gradientDirection: publicProfileData.gradientDirection,
            gradientColorStart: publicProfileData.gradientColorStart,
            gradientColorEnd: publicProfileData.gradientColorEnd
        });
        
        return publicProfileData;

    } catch (error) {
        console.error(`❌ Error fetching profile for "${identifier}":`, error);
        return null;
    }
}

/**
 * Fetches multiple profiles by usernames (batch operation)
 * Useful for bulk operations or related user fetching
 * @param {string[]} identifiers - Array of usernames or UIDs
 * @returns {Promise<object[]>} Array of profile data objects (non-null results only)
 */
export async function fetchMultipleProfiles(identifiers) {
    try {
        if (!Array.isArray(identifiers) || identifiers.length === 0) {
            return [];
        }

        // Limit batch size for performance
        const batchSize = 10;
        const results = [];

        for (let i = 0; i < identifiers.length; i += batchSize) {
            const batch = identifiers.slice(i, i + batchSize);
            const batchPromises = batch.map(id => fetchProfileByUsername(id));
            const batchResults = await Promise.all(batchPromises);
            
            // Filter out null results
            results.push(...batchResults.filter(result => result !== null));
        }

        return results;

    } catch (error) {
        console.error('❌ Error fetching multiple profiles:', error);
        return [];
    }
}

/**
 * Check if a username is available (not taken)
 * @param {string} username - Username to check
 * @returns {Promise<boolean>} True if username is available, false if taken
 */
export async function isUsernameAvailable(username) {
    try {
        if (!username || typeof username !== 'string') {
            return false;
        }

        const usersRef = adminDb.collection('users');
        const query = await usersRef.where('username', '==', username.toLowerCase()).limit(1).get();
        
        return query.empty; // True if no documents found (username available)

    } catch (error) {
        console.error(`❌ Error checking username availability for "${username}":`, error);
        return false; // Assume unavailable on error for safety
    }
}

/**
 * Get basic user info by UID (for internal use)
 * Returns minimal user data for system operations
 * @param {string} uid - User ID
 * @returns {Promise<object|null>} Basic user info or null
 */
export async function getUserBasicInfo(uid) {
    try {
        if (!uid) return null;

        const userDoc = await adminDb.collection('users').doc(uid).get();
        
        if (!userDoc.exists) {
            return null;
        }

        const userData = userDoc.data();
        const profile = userData.profile || {};

        return {
            uid: uid,
            username: userData.username || '',
            displayName: profile.displayName || '',
            avatarUrl: profile.avatarUrl || '',
            accountType: userData.accountType || 'base'
        };

    } catch (error) {
        console.error(`❌ Error fetching basic user info for UID "${uid}":`, error);
        return null;
    }
}