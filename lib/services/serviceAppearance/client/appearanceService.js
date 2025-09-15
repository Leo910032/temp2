/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// lib/services/serviceAppearance/client/appearanceService.js- REFACTORED to use ContactApiClient
import { ContactApiClient } from '@/lib/services/core/ApiClient';

/**
 * Client-side service for appearance operations
 * Follows the new architecture pattern as a thin wrapper around API calls
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
     * Update appearance data (primary save function)
     * @param {Object} appearanceData - Complete or partial appearance data to update
     * @returns {Promise<Object>} Update result
     */
    static async updateAppearanceData(appearanceData) {
        return ContactApiClient.post('/api/user/appearance/theme', appearanceData);
    }

    // ===== FILE UPLOAD FUNCTIONS =====
    // ✅ ADD THIS PUBLIC METHOD
    /**
     * Handles file uploads for appearance (profile photo, background, etc.).
     * This is the generic method called by the AppearancePage.
     * @param {File} file - The file to upload.
     * @param {string} uploadType - 'profile', 'backgroundImage', 'backgroundVideo', or 'cv'.
     * @returns {Promise<object>}
     */
    static async uploadFile(file, uploadType) {
        // It simply calls the private helper method.
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
     * Remove CV document
     * @returns {Promise<Object>} Remove result
     */
    static async removeCVDocument() {
        return this._removeFile('cv');
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
    updateAppearanceData,
    uploadProfileImage,
    uploadBackgroundImage,
    uploadBackgroundVideo,
    uploadCVDocument,
    removeProfileImage,
    removeBackgroundImage,
    removeBackgroundVideo,
    removeCVDocument,
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