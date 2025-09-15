// lib/services/server/appearanceService.js
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * Server-side service for handling all appearance-related business logic
 * Follows the new architecture pattern with session-based operations
 */
export class AppearanceService {
    
    /**
     * Get user's appearance data
     * @param {Object} session - Session object from createApiSession
     * @returns {Object} Complete appearance data with defaults
     */
    static async getAppearance({ session }) {
        try {
            // Validate session
            if (!session.userId) {
                throw new Error('Invalid session: missing userId');
            }

            // The session already contains userData, so we don't need to fetch it again
            const userData = session.userData;
            
            if (!userData) {
                throw new Error('User data not found in session');
            }

            // Construct clean appearance data with defaults
            const appearanceData = {
                // User profile fields
                username: userData.username || '',
                displayName: userData.displayName || '',
                bio: userData.bio || '',
                profilePhoto: userData.profilePhoto || '',
                
                // Appearance settings
                selectedTheme: userData.selectedTheme || 'Lake White',
                themeFontColor: userData.themeFontColor || '#000',
                themeTextColour: userData.themeTextColour || '#000',
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
                
                // Christmas accessories
                christmasAccessory: userData.christmasAccessory || null,
                
                // CV document
                cvDocument: userData.cvDocument || null
            };

            console.log('✅ AppearanceService: Retrieved appearance data for user:', session.userId);
            
            return appearanceData;

        } catch (error) {
            console.error('❌ AppearanceService.getAppearance error:', error);
            throw new Error(`Failed to get appearance data: ${error.message}`);
        }
    }

    /**
     * Update user's appearance data
     * @param {Object} data - Appearance data to update
     * @param {Object} session - Session object from createApiSession
     * @returns {Object} Update result
     */
    static async updateAppearance({ data, session }) {
        try {
            // Validate session
            if (!session.userId) {
                throw new Error('Invalid session: missing userId');
            }

            // Validate permissions (if needed)
            if (!session.permissions.canUpdateAppearance) {
                throw new Error('Insufficient permissions to update appearance');
            }

            // Define allowed fields for security
            const allowedFields = [
                'username', 'displayName', 'bio', 'profilePhoto',
                'selectedTheme', 'themeFontColor', 'themeTextColour', 
                'backgroundType', 'backgroundColor', 'backgroundImage', 
                'backgroundVideo', 'gradientDirection', 'btnType', 
                'btnColor', 'btnFontColor', 'btnShadowColor', 'fontType',
                'christmasAccessory', 'cvDocument'
            ];

            // Validate and sanitize incoming data
            const updateData = {};
            const validationErrors = [];

            for (const [key, value] of Object.entries(data)) {
                if (!allowedFields.includes(key)) {
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

                updateData[key] = validation.sanitizedValue;
            }

            // Check if there are validation errors
            if (validationErrors.length > 0) {
                throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
            }

            // Check if there's anything to update
            if (Object.keys(updateData).length === 0) {
                throw new Error('No valid fields to update');
            }

            // Update the database
            const userDocRef = adminDb.collection('AccountData').doc(session.userId);
            await userDocRef.update(updateData);

            console.log('✅ AppearanceService: Updated appearance for user:', session.userId, 
                       'Fields:', Object.keys(updateData));

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
     * Upload and process file
     * @param {File} file - File to upload
     * @param {string} uploadType - Type of upload (profile, backgroundImage, backgroundVideo, cv)
     * @param {Object} session - Session object
     * @returns {Object} Upload result with download URL
     */
    static async uploadFile({ file, uploadType, session }) {
        try {
            // Validate session
            if (!session.userId) {
                throw new Error('Invalid session: missing userId');
            }

            // Validate upload type
            const validUploadTypes = ['profile', 'backgroundImage', 'backgroundVideo', 'cv'];
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

            // Prepare database update
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
     * Delete uploaded file
     * @param {string} deleteType - Type of file to delete
     * @param {Object} session - Session object
     * @returns {Object} Delete result
     */
    static async deleteFile({ deleteType, session }) {
        try {
            // Validate session
            if (!session.userId) {
                throw new Error('Invalid session: missing userId');
            }

            const validDeleteTypes = ['profile', 'backgroundImage', 'backgroundVideo', 'cv'];
            if (!validDeleteTypes.includes(deleteType)) {
                throw new Error(`Invalid delete type: ${deleteType}`);
            }

            // Prepare update data to clear file reference
            const updateData = {};
            switch (deleteType) {
                case 'profile':
                    updateData.profilePhoto = '';
                    break;
                case 'backgroundImage':
                    updateData.backgroundImage = '';
                    break;
                case 'backgroundVideo':
                    updateData.backgroundVideo = '';
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
        // Color validation
        if (['backgroundColor', 'btnColor', 'btnFontColor', 'btnShadowColor', 'themeFontColor', 'themeTextColour'].includes(key)) {
            if (value && !this._isValidColor(value)) {
                return { valid: false, error: 'Invalid color format' };
            }
            return { valid: true, sanitizedValue: value };
        }

        // String fields with length limits
        const stringFields = {
            displayName: { maxLength: 100, required: false },
            bio: { maxLength: 500, required: false },
            username: { maxLength: 50, required: false }
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
        if (['btnType', 'fontType', 'gradientDirection'].includes(key)) {
            if (typeof value !== 'number' && !Number.isInteger(Number(value))) {
                return { valid: false, error: 'Must be a number' };
            }
            return { valid: true, sanitizedValue: Number(value) };
        }

        // Default: allow value as-is
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
     * Validate uploaded file
     * @private
     */
    static _validateFile(file, uploadType) {
        const maxSizes = {
            profile: 5 * 1024 * 1024,        // 5MB
            backgroundImage: 10 * 1024 * 1024, // 10MB
            backgroundVideo: 50 * 1024 * 1024, // 50MB
            cv: 50 * 1024 * 1024              // 50MB
        };

        const allowedTypes = {
            profile: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            backgroundImage: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            backgroundVideo: ['video/mp4', 'video/webm', 'video/mov', 'video/avi'],
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
     * Generate storage path for file
     * @private
     */
    static _getStoragePath(uploadType, userId, fileName) {
        const pathMap = {
            profile: `profilePhoto/${userId}/${fileName}`,
            backgroundImage: `backgroundImage/${userId}/${fileName}`,
            backgroundVideo: `backgroundVideo/${userId}/${fileName}`,
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
     * Get update data for file upload
     * @private
     */
    static _getFileUpdateData(uploadType, downloadURL, file) {
        switch (uploadType) {
            case 'profile':
                return { profilePhoto: downloadURL };
            case 'backgroundImage':
                return { 
                    backgroundImage: downloadURL,
                    backgroundType: 'Image'
                };
            case 'backgroundVideo':
                return { 
                    backgroundVideo: downloadURL,
                    backgroundType: 'Video'
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