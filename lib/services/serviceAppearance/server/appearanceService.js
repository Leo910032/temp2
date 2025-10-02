// lib/services/serviceAppearance/server/appearanceService.js - Updated with Banner Support
import { adminDb } from '@/lib/firebaseAdmin';
import { APPEARANCE_FEATURES } from '@/lib/services/constants';

/**
 * Server-side service for handling all appearance-related business logic
 * Updated to include banner functionality
 */
export class AppearanceService {
    
    /**
     * Get user's appearance data from the new user document structure
     * @param {Object} session - Session object from createApiSession
     * @returns {Object} Complete appearance data with defaults
     */
    static async getAppearance({ session }) {
        try {
            if (!session.userId) {
                throw new Error('Invalid session: missing userId');
            }

            const userData = session.userData;
            
            if (!userData) {
                throw new Error('User data not found in session');
            }

            const profile = userData.profile || {};
            const appearance = userData.appearance || {};
            
            // Construct clean appearance data with defaults including banner fields
            const appearanceData = {
                // User profile fields from profile object
                username: userData.username || '',
                displayName: profile.displayName || '',
                bio: profile.bio || '',
                avatarUrl: profile.avatarUrl || '',
                location: profile.location || '',

                // Appearance settings from appearance object
                selectedTheme: appearance.selectedTheme || 'Lake White',
                themeFontColor: appearance.themeFontColor || '#000000',
                fontType: appearance.fontType || 0,
                backgroundColor: appearance.backgroundColor || '#FFFFFF',
                backgroundType: appearance.backgroundType || 'Color',
                btnColor: appearance.btnColor || '#000000',
                btnFontColor: appearance.btnFontColor || '#FFFFFF',
                btnShadowColor: appearance.btnShadowColor || '#dcdbdb',
                btnType: appearance.btnType || 0,

                // Background gradient settings
                gradientDirection: appearance.gradientDirection || 0,
                gradientColorStart: appearance.gradientColorStart || '#FFFFFF',
                gradientColorEnd: appearance.gradientColorEnd || '#000000',

                // 🆕 Banner settings
                bannerType: appearance.bannerType || 'None', // None, Color, Gradient, Image, Video, preset names
                bannerColor: appearance.bannerColor || '#3B82F6', // Default blue color
                bannerGradientStart: appearance.bannerGradientStart || '#667eea',
                bannerGradientEnd: appearance.bannerGradientEnd || '#764ba2',
                bannerGradientDirection: appearance.bannerGradientDirection || 'to right',
                bannerImage: appearance.bannerImage || null, // URL for uploaded banner image
                bannerVideo: appearance.bannerVideo || null, // URL for uploaded banner video

                // CV document from appearance object
                cvDocument: appearance.cvDocument || null
            };

            console.log('✅ AppearanceService: Retrieved appearance data for user:', session.userId);
            
            return appearanceData;

        } catch (error) {
            console.error('❌ AppearanceService.getAppearance error:', error);
            throw new Error(`Failed to get appearance data: ${error.message}`);
        }
    }

    /**
     * Update user's appearance data in the new document structure
     * @param {Object} data - Appearance data to update
     * @param {Object} session - Session object from createApiSession
     * @returns {Object} Update result
     */
    static async updateAppearance({ data, session }) {
        try {
            if (!session.userId) {
                throw new Error('Invalid session: missing userId');
            }

            if (!session.permissions[APPEARANCE_FEATURES.CAN_UPDATE_APPEARANCE]) {
                throw new Error('Insufficient permissions to update appearance');
            }

            // Define allowed fields organized by document section
            const profileFields = ['displayName', 'bio', 'avatarUrl', 'location'];
            const appearanceFields = [
                'selectedTheme', 'themeFontColor', 'fontType',
                'backgroundColor', 'backgroundType', 'backgroundVideo', 'btnColor', 'btnShadowColor',
                'btnFontColor', 'btnType', 'cvDocument',
                'gradientDirection', 'gradientColorStart', 'gradientColorEnd',
                // 🆕 Banner fields
                'bannerType', 'bannerColor', 'bannerGradientStart', 'bannerGradientEnd',
                'bannerGradientDirection', 'bannerImage', 'bannerVideo'
            ];
            const rootFields = ['username'];

            const updateData = {};
            const validationErrors = [];

            for (const [key, value] of Object.entries(data)) {
                // Check if field is allowed
                if (![...profileFields, ...appearanceFields, ...rootFields].includes(key)) {
                    console.warn(`⚠️ Skipping disallowed field: ${key}`);
                    continue;
                }

                // Skip undefined values
                if (value === undefined) {
                    continue;
                }

                // Field-specific validation
                const validation = this._validateField(key, value);
                if (!validation.valid) {
                    validationErrors.push(`${key}: ${validation.error}`);
                    continue;
                }

                // Use dot notation to preserve other fields in nested objects
                if (profileFields.includes(key)) {
                    updateData[`profile.${key}`] = validation.sanitizedValue;
                } else if (appearanceFields.includes(key)) {
                    updateData[`appearance.${key}`] = validation.sanitizedValue;
                } else if (rootFields.includes(key)) {
                    updateData[key] = validation.sanitizedValue;
                }
            }

            // Check if there are validation errors
            if (validationErrors.length > 0) {
                throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
            }

            // Check if there's anything to update
            if (Object.keys(updateData).length === 0) {
                throw new Error('No valid fields to update');
            }

            // Update the user document using dot notation
            const userDocRef = adminDb.collection('users').doc(session.userId);
            await userDocRef.update(updateData);

            console.log('✅ AppearanceService: Updated appearance for user:', session.userId, 
                       'Update data:', JSON.stringify(updateData, null, 2));

            return {
                success: true,
                updatedFields: Object.keys(updateData),
                message: 'Appearance updated successfully'
            };

        } catch (error) {
            console.error('❌ AppearanceService.updateAppearance error:', error);
            throw new Error(`Failed to update appearance: ${error.message}`);
        }
    }

    /**
     * Upload and process file with new document structure
     * @param {File} file - File to upload
     * @param {string} uploadType - Type of upload (profile, backgroundImage, backgroundVideo, bannerImage, bannerVideo, cv)
     * @param {Object} session - Session object
     * @returns {Object} Upload result with download URL
     */
    static async uploadFile({ file, uploadType, session }) {
        try {
            if (!session.userId) {
                throw new Error('Invalid session: missing userId');
            }
            
            if (!session.permissions[APPEARANCE_FEATURES.CAN_UPLOAD_FILES]) {
                throw new Error('Insufficient permissions to upload files');
            }

            // Validate upload type (🆕 added banner types)
            const validUploadTypes = ['profile', 'backgroundImage', 'backgroundVideo', 'bannerImage', 'bannerVideo', 'cv'];
            if (!validUploadTypes.includes(uploadType)) {
                throw new Error(`Invalid upload type: ${uploadType}`);
            }

            // Validate file
            const validation = this._validateFile(file, uploadType);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Generate storage path and filename
            const fileExtension = file.name.substring(file.name.lastIndexOf('.') + 1);
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
            const storagePath = this._getStoragePath(uploadType, session.userId, fileName);

            // Upload to Firebase Storage
            const downloadURL = await this._uploadToStorage(file, storagePath);

            // Prepare database update for new structure
            const updateData = this._getFileUpdateData(uploadType, downloadURL, file);

            // Update user document using our own service
            await this.updateAppearance({ data: updateData, session });

            console.log('✅ AppearanceService: File uploaded successfully:', uploadType, fileName);

            return {
                success: true,
                downloadURL,
                fileName: uploadType === 'cv' ? file.name : fileName,
                uploadType,
                fileInfo: uploadType === 'cv' ? {
                    originalName: file.name,
                    size: file.size,
                    type: file.type
                } : null,
                message: 'File uploaded successfully'
            };

        } catch (error) {
            console.error('❌ AppearanceService.uploadFile error:', error);
            throw new Error(`File upload failed: ${error.message}`);
        }
    }

    /**
     * Delete uploaded file with new document structure
     * @param {string} deleteType - Type of file to delete
     * @param {Object} session - Session object
     * @returns {Object} Delete result
     */
    static async deleteFile({ deleteType, session }) {
        try {
            if (!session.userId) {
                throw new Error('Invalid session: missing userId');
            }
            
            if (!session.permissions[APPEARANCE_FEATURES.CAN_UPDATE_APPEARANCE]) {
                throw new Error('Insufficient permissions to delete files');
            }

            const validDeleteTypes = ['profile', 'backgroundImage', 'backgroundVideo', 'bannerImage', 'bannerVideo', 'cv'];
            if (!validDeleteTypes.includes(deleteType)) {
                throw new Error(`Invalid delete type: ${deleteType}`);
            }

            // Prepare update data to clear file reference in new structure
            const updateData = {};
            switch (deleteType) {
                case 'profile':
                    updateData.avatarUrl = '';
                    break;
                case 'backgroundImage':
                    updateData.backgroundColor = '#FFFFFF';
                    updateData.backgroundType = 'Color';
                    break;
                case 'backgroundVideo':
                    updateData.backgroundColor = '#FFFFFF';
                    updateData.backgroundType = 'Color';
                    break;
                // 🆕 Banner deletion cases
                case 'bannerImage':
                    updateData.bannerImage = null;
                    updateData.bannerType = 'None';
                    break;
                case 'bannerVideo':
                    updateData.bannerVideo = null;
                    updateData.bannerType = 'None';
                    break;
                case 'cv':
                    updateData.cvDocument = null;
                    break;
            }

            // Update using our own service
            await this.updateAppearance({ data: updateData, session });

            console.log('✅ AppearanceService: File deleted successfully:', deleteType);

            return {
                success: true,
                message: 'File reference removed successfully'
            };

        } catch (error) {
            console.error('❌ AppearanceService.deleteFile error:', error);
            throw new Error(`File deletion failed: ${error.message}`);
        }
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Validate individual field
     * @private
     */
    static _validateField(key, value) {
        // Color validation (🆕 added banner color fields)
        // Note: backgroundColor can also be a URL when backgroundType is Image or Video
        if (['backgroundColor', 'btnColor', 'btnFontColor', 'themeFontColor', 'gradientColorStart', 'gradientColorEnd', 'bannerColor', 'bannerGradientStart', 'bannerGradientEnd'].includes(key)) {
            // For backgroundColor, allow both colors and URLs (for images/videos)
            if (key === 'backgroundColor') {
                if (value && !this._isValidColor(value) && !this._isValidUrl(value)) {
                    return { valid: false, error: 'Invalid color format or URL' };
                }
                return { valid: true, sanitizedValue: value };
            }
            // For other color fields, only validate hex colors
            if (value && !this._isValidColor(value)) {
                return { valid: false, error: 'Invalid color format' };
            }
            return { valid: true, sanitizedValue: value };
        }

        // String fields with length limits
        const stringFields = {
            displayName: { maxLength: 100, required: false },
            bio: { maxLength: 500, required: false },
            username: { maxLength: 50, required: false },
            location: { maxLength: 100, required: false },
            avatarUrl: { maxLength: 1000, required: false },
            bannerImage: { maxLength: 1000, required: false }, // 🆕
            bannerVideo: { maxLength: 1000, required: false }, // 🆕
            bannerGradientDirection: { maxLength: 50, required: false }, // 🆕
        };

        if (stringFields[key]) {
            if (typeof value !== 'string') {
                return { valid: false, error: 'Must be a string' };
            }
            
            const trimmed = value.trim();
            if (trimmed.length > stringFields[key].maxLength) {
                return { valid: false, error: `Too long (max ${stringFields[key].maxLength} characters)` };
            }
            
            return { valid: true, sanitizedValue: trimmed };
        }

        // Numeric fields
        if (['btnType', 'fontType'].includes(key)) {
            if (typeof value !== 'number' && !Number.isInteger(Number(value))) {
                return { valid: false, error: 'Must be a number' };
            }
            return { valid: true, sanitizedValue: Number(value) };
        }

        // Background type validation
        if (key === 'backgroundType') {
            const validTypes = ['Color', 'Image', 'Video', 'Gradient', 'Polka', 'Stripe', 'Waves', 'Zig Zag'];
            if (!validTypes.includes(value)) {
                return { valid: false, error: `Must be one of: ${validTypes.join(', ')}` };
            }
            return { valid: true, sanitizedValue: value };
        }

        // 🆕 Banner type validation
        if (key === 'bannerType') {
            const validBannerTypes = ['None', 'Color', 'Gradient', 'Image', 'Video', 'Corporate', 'Creative', 'Minimal'];
            if (!validBannerTypes.includes(value)) {
                return { valid: false, error: `Must be one of: ${validBannerTypes.join(', ')}` };
            }
            return { valid: true, sanitizedValue: value };
        }

        // Default case - always return a valid object
        return { valid: true, sanitizedValue: value };
    }

    /**
     * Validate color format
     * @private
     */
    static _isValidColor(color) {
        if (!color || typeof color !== 'string') return false;
        const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        return hexRegex.test(color);
    }

    /**
     * Validate URL format
     * @private
     */
    static _isValidUrl(url) {
        if (!url || typeof url !== 'string') return false;
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate uploaded file
     * @private
     */
    static _validateFile(file, uploadType) {
        const maxSizes = {
            profile: 5 * 1024 * 1024,        // 5MB
            backgroundImage: 10 * 1024 * 1024, // 10MB
            backgroundVideo: 50 * 1024 * 1024, // 50MB
            bannerImage: 10 * 1024 * 1024,    // 🆕 10MB
            bannerVideo: 50 * 1024 * 1024,    // 🆕 50MB
            cv: 50 * 1024 * 1024              // 50MB
        };

        const allowedTypes = {
            profile: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            backgroundImage: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            backgroundVideo: ['video/mp4', 'video/webm', 'video/mov', 'video/avi'],
            bannerImage: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], // 🆕
            bannerVideo: ['video/mp4', 'video/webm', 'video/mov', 'video/avi'], // 🆕
            cv: [
                'application/pdf', 'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/plain'
            ]
        };

        // Check file size
        if (file.size > maxSizes[uploadType]) {
            return {
                valid: false,
                error: `File too large. Maximum size: ${Math.round(maxSizes[uploadType] / (1024 * 1024))}MB`
            };
        }

        // Check file type
        if (!allowedTypes[uploadType].includes(file.type)) {
            return {
                valid: false,
                error: `Invalid file type. Allowed: ${allowedTypes[uploadType].join(', ')}`
            };
        }

        return { valid: true };
    }

    /**
     * Generate storage path for file (🆕 added banner paths)
     * @private
     */
    static _getStoragePath(uploadType, userId, fileName) {
        const pathMap = {
            profile: `profilePhoto/${userId}/${fileName}`,
            backgroundImage: `backgroundImage/${userId}/${fileName}`,
            backgroundVideo: `backgroundVideo/${userId}/${fileName}`,
            bannerImage: `bannerImage/${userId}/${fileName}`, // 🆕
            bannerVideo: `bannerVideo/${userId}/${fileName}`, // 🆕
            cv: `cvDocuments/${userId}/${fileName}`
        };
        return pathMap[uploadType];
    }

    /**
     * Upload file to Firebase Storage
     * @private
     */
    static async _uploadToStorage(file, storagePath) {
        const { initializeApp: initClientApp, getApps: getClientApps } = await import('firebase/app');
        const { getStorage: getClientStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
        
        let clientApp;
        if (getClientApps().length === 0) {
            clientApp = initClientApp({
                apiKey: process.env.NEXT_PUBLIC_apiKey,
                authDomain: process.env.NEXT_PUBLIC_authDomain,
                projectId: process.env.FIREBASE_PROJECT_ID,
                storageBucket: process.env.NEXT_PUBLIC_storageBucket,
                messagingSenderId: process.env.NEXT_PUBLIC_messagingSenderId,
                appId: process.env.NEXT_PUBLIC_appId,
            });
        } else {
            clientApp = getClientApps()[0];
        }

        const storage = getClientStorage(clientApp);
        const storageRef = ref(storage, storagePath);
        
        // Convert file to buffer
        const fileBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(fileBuffer);

        // Upload file
        const snapshot = await uploadBytes(storageRef, uint8Array, {
            contentType: file.type,
        });

        // Get download URL
        return await getDownloadURL(snapshot.ref);
    }

    /**
     * Get update data for file upload in new document structure (🆕 added banner cases)
     * @private
     */
    static _getFileUpdateData(uploadType, downloadURL, file) {
        switch (uploadType) {
            case 'profile':
                return { avatarUrl: downloadURL };
            case 'backgroundImage':
                return { 
                    backgroundColor: downloadURL,
                    backgroundType: 'Image'
                };
            case 'backgroundVideo':
                return { 
                    backgroundColor: downloadURL,
                    backgroundType: 'Video'
                };
            // 🆕 Banner upload cases
            case 'bannerImage':
                return {
                    bannerImage: downloadURL,
                    bannerType: 'Image'
                };
            case 'bannerVideo':
                return {
                    bannerVideo: downloadURL,
                    bannerType: 'Video'
                };
            case 'cv':
                return {
                    cvDocument: {
                        url: downloadURL,
                        fileName: file.name,
                        uploadDate: new Date().toISOString(),
                        fileSize: file.size,
                        fileType: file.type
                    }
                };
            default:
                return {};
        }
    }
}