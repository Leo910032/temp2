/**
 * THIS FILE HAS BEEN REFACTORED
 */
// lib/services/serviceSettings/server/settingsService.js
import { adminDb } from '@/lib/firebaseAdmin';

export class SettingsService {
    /**
     * Get user settings
     */
    static async getUserSettings({ session }) {
        if (!session?.userId) {
            throw new Error('Authorization failed: No user session');
        }

        try {
            const userDoc = await adminDb
                .collection('users')  // ✅ Changed from 'AccountData' to 'users'
                .doc(session.userId)
                .get();

            if (!userDoc.exists) {
                throw new Error('User not found');
            }

            const userData = userDoc.data();

            // Based on your Firestore structure, settings are nested under 'settings'
            const settingsData = userData.settings || {};
            const profile = userData.profile || {};

            // Return settings-related data matching your structure
            return {
                // Settings from the settings object
                allowMessages: settingsData.allowMessages ?? true,
                isPublic: settingsData.isPublic ?? true,
                theme: settingsData.theme || 'light',
                notifications: settingsData.notifications || {
                    email: true,
                    push: true
                },
                
                // Profile-related settings
                bio: profile.bio || '',
                location: profile.location || '',
                displayName: profile.displayName || '',
                
                // Socials (from root level based on your structure)
                socials: userData.socials || [],
                
                // Additional settings you might have
                socialPosition: userData.socialPosition || 0,
                supportBanner: userData.supportBanner || 0,
                supportBannerStatus: userData.supportBannerStatus || false,
                sensitiveStatus: userData.sensitiveStatus || false,
                sensitivetype: userData.sensitivetype || 3,
                metaData: userData.metaData || { title: '', description: '' },
            };
        } catch (error) {
            console.error('❌ SettingsService.getUserSettings error:', error);
            throw error;
        }
    }

    /**
     * Update user settings
     * Supports both bulk updates and action-based updates
     */
    static async updateUserSettings({ settingsData, session }) {
        if (!session?.userId) {
            throw new Error('Authorization failed: No user session');
        }

        try {
            const userDocRef = adminDb.collection('users').doc(session.userId);  // ✅ Changed collection
            
            // Check if this is a bulk update or action-based update
            const isBulkUpdate = !settingsData.action && !settingsData.data;
            let updateData = {};

            if (isBulkUpdate) {
                // ✅ BULK UPDATE: Handle direct settings data
                console.log('Processing bulk settings update for user:', session.userId);
                
                const allowedFields = [
                    'socials', 'socialPosition', 'supportBanner', 'supportBannerStatus',
                    'sensitiveStatus', 'sensitivetype', 'metaData',
                    // Settings nested fields
                    'settings.allowMessages', 'settings.isPublic', 'settings.theme',
                    'settings.notifications',
                    // Profile fields
                    'profile.bio', 'profile.location', 'profile.displayName'
                ];
                
                for (const [key, value] of Object.entries(settingsData)) {
                    // Handle nested settings
                    if (key === 'settings' && typeof value === 'object') {
                        for (const [settingKey, settingValue] of Object.entries(value)) {
                            updateData[`settings.${settingKey}`] = settingValue;
                        }
                    } 
                    // Handle nested profile
                    else if (key === 'profile' && typeof value === 'object') {
                        for (const [profileKey, profileValue] of Object.entries(value)) {
                            updateData[`profile.${profileKey}`] = profileValue;
                        }
                    }
                    // Handle root-level fields
                    else if (allowedFields.includes(key)) {
                        updateData[key] = value;
                    }
                }

                if (Object.keys(updateData).length === 0) {
                    throw new Error('No valid fields to update');
                }
            } else {
                // ✅ ACTION-BASED UPDATE
                const { action, data } = settingsData;

                if (!action || !data) {
                    throw new Error('Missing action or data');
                }

                console.log(`Processing settings action: ${action} for user:`, session.userId);

                updateData = this._buildUpdateDataFromAction(action, data);
            }

            // Perform the update
            await userDocRef.update(updateData);

            return {
                updatedFields: Object.keys(updateData),
                updateType: isBulkUpdate ? 'bulk' : 'action',
                isBulkUpdate
            };
        } catch (error) {
            console.error('❌ SettingsService.updateUserSettings error:', error);
            
            // Re-throw with specific error messages
            if (error.code === 'not-found') {
                throw new Error('User document not found');
            }
            
            throw error;
        }
    }

    /**
     * Build update data based on action type
     */
    static _buildUpdateDataFromAction(action, data) {
        switch (action) {
            case 'updateSocials':
                if (!Array.isArray(data.socials)) {
                    throw new Error('Socials must be an array');
                }
                return { socials: data.socials };

            case 'updateSocialPosition':
                if (typeof data.position !== 'number') {
                    throw new Error('Position must be a number');
                }
                return { socialPosition: data.position };

            case 'updateSupportBanner':
                const bannerUpdate = {};
                if (data.supportBanner !== undefined) {
                    bannerUpdate.supportBanner = data.supportBanner;
                }
                if (data.supportBannerStatus !== undefined) {
                    bannerUpdate.supportBannerStatus = data.supportBannerStatus;
                }
                return bannerUpdate;

            case 'updateSensitiveStatus':
                return { sensitiveStatus: !!data.status };

            case 'updateSensitiveType':
                if (typeof data.type !== 'number') {
                    throw new Error('Sensitive type must be a number');
                }
                return { sensitivetype: data.type };

            case 'updateMetaData':
                if (typeof data.title !== 'string' || typeof data.description !== 'string') {
                    throw new Error('Title and description must be strings');
                }
                return {
                    metaData: {
                        title: data.title.trim(),
                        description: data.description.trim()
                    }
                };

            // New actions for nested settings
            case 'updateTheme':
                return { 'settings.theme': data.theme };

            case 'updateNotifications':
                return { 'settings.notifications': data.notifications };

            case 'updatePrivacy':
                const privacyUpdate = {};
                if (data.allowMessages !== undefined) {
                    privacyUpdate['settings.allowMessages'] = data.allowMessages;
                }
                if (data.isPublic !== undefined) {
                    privacyUpdate['settings.isPublic'] = data.isPublic;
                }
                return privacyUpdate;

            case 'updateProfile':
                const profileUpdate = {};
                if (data.bio !== undefined) {
                    profileUpdate['profile.bio'] = data.bio;
                }
                if (data.location !== undefined) {
                    profileUpdate['profile.location'] = data.location;
                }
                if (data.displayName !== undefined) {
                    profileUpdate['profile.displayName'] = data.displayName;
                }
                return profileUpdate;

            default:
                throw new Error('Invalid action');
        }
    }
}