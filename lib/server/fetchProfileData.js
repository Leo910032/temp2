// File: lib/server/fetchProfileData.js

import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin SDK (this is safe in a server-only file)
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

/**
 * Fetches and sanitizes public profile data for a user by their username or UID.
 * @param {string} identifier - The username or UID of the user.
 * @returns {Promise<object|null>} A promise that resolves to the user data object or null if not found.
 */
export async function fetchProfileByUsername(identifier) {
    try {
        const accountsRef = adminDb.collection('AccountData');
        let userDoc = null;

        // 1. Try to find user by username
        const usernameQuery = await accountsRef.where('username', '==', identifier.toLowerCase()).limit(1).get();
        if (!usernameQuery.empty) {
            userDoc = usernameQuery.docs[0];
        } else {
            // 2. If not found, try to find by UID
            const uidDoc = await accountsRef.doc(identifier).get();
            if (uidDoc.exists) {
                userDoc = uidDoc;
            }
        }

        if (!userDoc) {
            return null; // User not found
        }
        
        const userData = userDoc.data();

        // 3. Sanitize the data: Create a new object with only public-safe fields.
        //    CRITICAL: Never return the full document. Explicitly exclude sensitive fields like 'email'.
        const publicProfileData = {
            uid: userDoc.id, // The actual Firebase Auth UID
            username: userData.username || '',
            displayName: userData.displayName || '',
            bio: userData.bio || '',
            profilePhoto: userData.profilePhoto || '',
            links: userData.links || [],
            socials: userData.socials || [],
            socialPosition: userData.socialPosition || 0,
            
            // Theme Data
            selectedTheme: userData.selectedTheme || 'Lake White',
            themeFontColor: userData.themeFontColor || '',
            themeTextColour: userData.themeTextColour || '',
            backgroundType: userData.backgroundType || 'Flat Colour',
            backgroundColor: userData.backgroundColor || '#e8edf5',
            backgroundImage: userData.backgroundImage || '',
            backgroundVideo: userData.backgroundVideo || '',
            gradientDirection: userData.gradientDirection || 0,
            btnType: userData.btnType || 0,
            btnColor: userData.btnColor || '#fff',
            btnFontColor: userData.btnFontColor || '#000',
            btnShadowColor: userData.btnShadowColor || '#000',
            fontType: userData.fontType || 0,

            // Banners and Warnings
            supportBanner: userData.supportBanner || 0,
            supportBannerStatus: userData.supportBannerStatus || false,
            sensitiveStatus: userData.sensitiveStatus || false,
            sensitivetype: userData.sensitivetype || 3,

            // Metadata
            metaData: userData.metaData || { title: '', description: '' },
        };

        return publicProfileData;

    } catch (error) {
        console.error(`Error fetching profile for "${identifier}":`, error);
        return null;
    }
}