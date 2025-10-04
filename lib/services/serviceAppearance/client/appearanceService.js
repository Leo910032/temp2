// lib/services/serviceAppearance/client/appearanceService.js - Updated with Banner Support
import { ContactApiClient } from '@/lib/services/core/ApiClient';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { app } from '@/important/firebase';

/**
 * Client-side service for appearance operations
 * Updated to include banner functionality and real-time listeners
 */
export class AppearanceService {

    /**
     * Get user's appearance data
     * @returns {Promise<Object>} Appearance data
     */
    static async getAppearanceData() {
        return ContactApiClient.get('/api/user/appearance/theme');
    }

    /**
     * Listen to real-time appearance data changes
     * Returns data in the same format as getAppearanceData() for consistency
     * @param {string} userId - User ID to listen to
     * @param {Function} callback - Callback function that receives updated appearance data
     * @returns {Function} Unsubscribe function to stop listening
     */
    static listenToAppearanceData(userId, callback) {
        if (!userId) {
            console.error('listenToAppearanceData: userId is required');
            return () => {};
        }

        const db = getFirestore(app);
        const userRef = doc(db, 'users', userId);

        const unsubscribe = onSnapshot(
            userRef,
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const userData = docSnapshot.data();
                    const profile = userData.profile || {};
                    const appearance = userData.appearance || {};

                    // Format data to match getAppearance() structure from server
                    const formattedData = {
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

                        // Banner settings
                        bannerType: appearance.bannerType || 'None',
                        bannerColor: appearance.bannerColor || '#3B82F6',
                        bannerGradientStart: appearance.bannerGradientStart || '#667eea',
                        bannerGradientEnd: appearance.bannerGradientEnd || '#764ba2',
                        bannerGradientDirection: appearance.bannerGradientDirection || 'to right',
                        bannerImage: appearance.bannerImage || null,
                        bannerVideo: appearance.bannerVideo || null,

                        // Carousel settings
                        carouselEnabled: appearance.carouselEnabled || false,
                        carouselItems: appearance.carouselItems || [],
                        carouselStyle: appearance.carouselStyle || 'modern',

                        // CV settings
                        cvEnabled: appearance.cvEnabled || false,
                        cvDocument: appearance.cvDocument || null
                    };

                    callback(formattedData);
                } else {
                    console.warn('listenToAppearanceData: User document does not exist');
                    callback({});
                }
            },
            (error) => {
                console.error('listenToAppearanceData: Error listening to appearance data:', error);
            }
        );

        return unsubscribe;
    }

    /**
     * Update appearance data (primary save function)
     * @param {Object} appearanceData - Complete or partial appearance data to update
     * @returns {Promise<Object>} Update result
     */
    static async updateAppearanceData(appearanceData) {
        return ContactApiClient.post('/api/user/appearance/theme', appearanceData);
    }

    // ===== FILE UPLOAD FUNCTIONS =====
    
    /**
     * Handles file uploads for appearance (profile photo, background, banner, etc.).
     * @param {File} file - The file to upload.
     * @param {string} uploadType - 'profile', 'backgroundImage', 'backgroundVideo', 'bannerImage', 'bannerVideo', or 'cv'.
     * @returns {Promise<object>}
     */
    static async uploadFile(file, uploadType) {
        return this._uploadFile(file, uploadType);
    }

    /**
     * Upload profile image
     * @param {File} file - Image file to upload
     * @returns {Promise<Object>} Upload result
     */
    static async uploadProfileImage(file) {
        return this._uploadFile(file, 'profile');
    }

    /**
     * Upload background image  
     * @param {File} file - Image file to upload
     * @returns {Promise<Object>} Upload result
     */
    static async uploadBackgroundImage(file) {
        return this._uploadFile(file, 'backgroundImage');
    }

    /**
     * Upload background video
     * @param {File} file - Video file to upload
     * @returns {Promise<Object>} Upload result
     */
    static async uploadBackgroundVideo(file) {
        return this._uploadFile(file, 'backgroundVideo');
    }

    /**
     * 🆕 Upload banner image
     * @param {File} file - Image file to upload
     * @returns {Promise<Object>} Upload result
     */
    static async uploadBannerImage(file) {
        return this._uploadFile(file, 'bannerImage');
    }

    /**
     * 🆕 Upload banner video
     * @param {File} file - Video file to upload
     * @returns {Promise<Object>} Upload result
     */
    static async uploadBannerVideo(file) {
        return this._uploadFile(file, 'bannerVideo');
    }

    /**
     * Upload CV document
     * @param {File} file - Document file to upload
     * @returns {Promise<Object>} Upload result
     */
    static async uploadCVDocument(file) {
        return this._uploadFile(file, 'cv');
    }

    // ===== FILE REMOVAL FUNCTIONS =====

    /**
     * Remove profile image
     * @returns {Promise<Object>} Remove result
     */
    static async removeProfileImage() {
        return this._removeFile('profile');
    }

    /**
     * Remove background image
     * @returns {Promise<Object>} Remove result
     */
    static async removeBackgroundImage() {
        return this._removeFile('backgroundImage');
    }

    /**
     * Remove background video
     * @returns {Promise<Object>} Remove result
     */
    static async removeBackgroundVideo() {
        return this._removeFile('backgroundVideo');
    }

    /**
     * 🆕 Remove banner image
     * @returns {Promise<Object>} Remove result
     */
    static async removeBannerImage() {
        return this._removeFile('bannerImage');
    }

    /**
     * 🆕 Remove banner video
     * @returns {Promise<Object>} Remove result
     */
    static async removeBannerVideo() {
        return this._removeFile('bannerVideo');
    }

    /**
     * Remove CV document
     * @returns {Promise<Object>} Remove result
     */
    static async removeCVDocument() {
        return this._removeFile('cv');
    }

    // ===== BANNER-SPECIFIC FUNCTIONS =====

    /**
     * 🆕 Update banner type
     * @param {string} type - Banner type ('None', 'Color', 'Gradient', 'Image', 'Video', etc.)
     * @returns {Promise<Object>} Update result
     */
    static async updateBannerType(type) {
        return this.updateAppearanceData({
            bannerType: type
        });
    }

    /**
     * 🆕 Update banner color
     * @param {string} color - Banner color (hex)
     * @returns {Promise<Object>} Update result
     */
    static async updateBannerColor(color) {
        return this.updateAppearanceData({
            bannerColor: color
        });
    }

    /**
     * 🆕 Update banner gradient settings
     * @param {Object} gradientSettings - Gradient configuration
     * @param {string} gradientSettings.start - Start color
     * @param {string} gradientSettings.end - End color
     * @param {string} gradientSettings.direction - Gradient direction
     * @returns {Promise<Object>} Update result
     */
    static async updateBannerGradient(gradientSettings) {
        return this.updateAppearanceData({
            bannerGradientStart: gradientSettings.start,
            bannerGradientEnd: gradientSettings.end,
            bannerGradientDirection: gradientSettings.direction
        });
    }

    // ===== CAROUSEL-SPECIFIC FUNCTIONS =====

    /**
     * 🆕 Update carousel enabled status
     * @param {boolean} enabled - Whether carousel is enabled
     * @returns {Promise<Object>} Update result
     */
    static async updateCarouselEnabled(enabled) {
        return this.updateAppearanceData({
            carouselEnabled: enabled
        });
    }

    /**
     * 🆕 Update carousel style
     * @param {string} style - Carousel style ('modern', 'minimal', 'bold')
     * @returns {Promise<Object>} Update result
     */
    static async updateCarouselStyle(style) {
        return this.updateAppearanceData({
            carouselStyle: style
        });
    }

    /**
     * 🆕 Update carousel items
     * @param {Array} items - Array of carousel items
     * @returns {Promise<Object>} Update result
     */
    static async updateCarouselItems(items) {
        return this.updateAppearanceData({
            carouselItems: items
        });
    }

    /**
     * 🆕 Upload carousel image
     * @param {File} file - Image file to upload
     * @returns {Promise<Object>} Upload result with downloadURL
     */
    static async uploadCarouselImage(file) {
        return this._uploadFile(file, 'carouselImage');
    }

    // ===== BACKWARD COMPATIBILITY FUNCTIONS =====
    // These maintain compatibility with existing code but use the new bulk update method

    /**
     * Update theme and theme color
     * @param {string} theme - Theme name
     * @param {string} themeColor - Theme color (hex)
     * @returns {Promise<Object>} Update result
     */
    static async updateTheme(theme, themeColor = '#000') {
        return this.updateAppearanceData({
            selectedTheme: theme,
            themeFontColor: themeColor
        });
    }

    /**
     * Update background type
     * @param {string} type - Background type
     * @returns {Promise<Object>} Update result
     */
    static async updateThemeBackground(type) {
        return this.updateAppearanceData({
            backgroundType: type
        });
    }

    /**
     * Update background color
     * @param {string} color - Background color (hex)
     * @returns {Promise<Object>} Update result
     */
    static async updateThemeBackgroundColor(color) {
        return this.updateAppearanceData({
            backgroundColor: color
        });
    }

    /**
     * Update button type
     * @param {number} btnType - Button type index
     * @returns {Promise<Object>} Update result
     */
    static async updateThemeButton(btnType) {
        return this.updateAppearanceData({
            btnType: btnType
        });
    }

    /**
     * Update button color
     * @param {string} color - Button color (hex)
     * @returns {Promise<Object>} Update result
     */
    static async updateThemeBtnColor(color) {
        return this.updateAppearanceData({
            btnColor: color
        });
    }

    /**
     * Update button font color
     * @param {string} color - Button font color (hex)
     * @returns {Promise<Object>} Update result
     */
    static async updateThemeBtnFontColor(color) {
        return this.updateAppearanceData({
            btnFontColor: color
        });
    }

    /**
     * Update button shadow color
     * @param {string} color - Button shadow color (hex)
     * @returns {Promise<Object>} Update result
     */
    static async updateThemeBtnShadowColor(color) {
        return this.updateAppearanceData({
            btnShadowColor: color
        });
    }

    /**
     * Update text color
     * @param {string} color - Text color (hex)
     * @returns {Promise<Object>} Update result
     */
    static async updateThemeTextColour(color) {
        return this.updateAppearanceData({
            themeTextColour: color
        });
    }

    /**
     * Update gradient direction
     * @param {number} direction - Gradient direction in degrees
     * @returns {Promise<Object>} Update result
     */
    static async updateThemeGradientDirection(direction) {
        return this.updateAppearanceData({
            gradientDirection: direction
        });
    }

    /**
     * Update font type
     * @param {number} fontType - Font type index
     * @returns {Promise<Object>} Update result
     */
    static async updateThemeFont(fontType) {
        return this.updateAppearanceData({
            fontType: fontType
        });
    }

    /**
     * Update Christmas accessory
     * @param {string} accessoryType - Christmas accessory type
     * @returns {Promise<Object>} Update result
     */
    static async updateChristmasAccessory(accessoryType) {
        return this.updateAppearanceData({
            christmasAccessory: accessoryType
        });
    }

    /**
     * Update display name
     * @param {string} displayName - User's display name
     * @returns {Promise<Object>} Update result
     */
    static async updateDisplayName(displayName) {
        return this.updateAppearanceData({
            displayName: displayName
        });
    }

    /**
     * Update bio
     * @param {string} bio - User's bio
     * @returns {Promise<Object>} Update result
     */
    static async updateBio(bio) {
        return this.updateAppearanceData({
            bio: bio
        });
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Generic file upload function
     * @private
     * @param {File} file - File to upload
     * @param {string} uploadType - Type of upload
     * @returns {Promise<Object>} Upload result
     */
    static async _uploadFile(file, uploadType) {
        try {
            const token = await ContactApiClient.getAuthToken();
            const formData = new FormData();
            formData.append('file', file);
            formData.append('uploadType', uploadType);

            const response = await fetch('/api/user/appearance/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    // Don't set Content-Type for FormData - let browser set it with boundary
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
            console.error(`Upload error (${uploadType}):`, error);
            throw error;
        }
    }

    /**
     * Generic file removal function
     * @private
     * @param {string} deleteType - Type of file to delete
     * @returns {Promise<Object>} Delete result
     */
    static async _removeFile(deleteType) {
        return ContactApiClient.delete('/api/user/appearance/upload', {
            body: { deleteType }
        });
    }
}

// For backward compatibility, also export individual functions
export const {
    getAppearanceData,
    listenToAppearanceData, // 🆕 Real-time listener
    updateAppearanceData,
    uploadProfileImage,
    uploadBackgroundImage,
    uploadBackgroundVideo,
    uploadBannerImage, // 🆕
    uploadBannerVideo, // 🆕
    uploadCVDocument,
    uploadCarouselImage, // 🆕
    removeProfileImage,
    removeBackgroundImage,
    removeBackgroundVideo,
    removeBannerImage, // 🆕
    removeBannerVideo, // 🆕
    removeCVDocument,
    updateBannerType, // 🆕
    updateBannerColor, // 🆕
    updateBannerGradient, // 🆕
    updateCarouselEnabled, // 🆕
    updateCarouselStyle, // 🆕
    updateCarouselItems, // 🆕
    updateTheme,
    updateThemeBackground,
    updateThemeBackgroundColor,
    updateThemeButton,
    updateThemeBtnColor,
    updateThemeBtnFontColor,
    updateThemeBtnShadowColor,
    updateThemeTextColour,
    updateThemeGradientDirection,
    updateThemeFont,
    updateChristmasAccessory,
    updateDisplayName,
    updateBio
} = AppearanceService;