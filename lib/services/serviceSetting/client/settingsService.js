// lib/services/serviceSettings/client/settingsService.js
import { ContactApiClient } from '@/lib/services/core/ApiClient';

/**
 * Client-side service for user settings operations
 * Follows the same pattern as AppearanceService
 */
export class SettingsService {
    
    /**
     * Get user's settings data
     * @returns {Promise<Object>} Settings data
     */
    static async getSettingsData() {
        return ContactApiClient.get('/api/user/settings');
    }

    /**
     * Update settings data (primary save function)
     * @param {Object} settingsData - Complete or partial settings data to update
     * @returns {Promise<Object>} Update result
     */
    static async updateSettingsData(settingsData) {
        return ContactApiClient.post('/api/user/settings', settingsData);
    }

    // ===== INDIVIDUAL SETTING FUNCTIONS (for backward compatibility) =====
    
    /**
     * Update social media links
     * @param {Object} socials - Social media configuration
     * @returns {Promise<Object>} Update result
     */
    static async updateSocials(socials) {
        return ContactApiClient.post('/api/user/settings', {
            action: 'updateSocials',
            data: { socials }
        });
    }

    /**
     * Update social media position
     * @param {string} position - Position configuration ('top', 'bottom', etc.)
     * @returns {Promise<Object>} Update result
     */
    static async updateSocialPosition(position) {
        return ContactApiClient.post('/api/user/settings', {
            action: 'updateSocialPosition',
            data: { position }
        });
    }

    /**
     * Update support banner configuration
     * @param {Object} supportBanner - Banner configuration object
     * @param {boolean} supportBannerStatus - Banner enabled/disabled status
     * @returns {Promise<Object>} Update result
     */
    static async updateSupportBanner(supportBanner, supportBannerStatus) {
        return ContactApiClient.post('/api/user/settings', {
            action: 'updateSupportBanner',
            data: { supportBanner, supportBannerStatus }
        });
    }

    /**
     * Update sensitive content status
     * @param {boolean} status - Sensitive content enabled/disabled
     * @returns {Promise<Object>} Update result
     */
    static async updateSensitiveStatus(status) {
        return ContactApiClient.post('/api/user/settings', {
            action: 'updateSensitiveStatus',
            data: { status }
        });
    }

    /**
     * Update sensitive content type
     * @param {string} type - Type of sensitive content filtering
     * @returns {Promise<Object>} Update result
     */
    static async updateSensitiveType(type) {
        return ContactApiClient.post('/api/user/settings', {
            action: 'updateSensitiveType',
            data: { type }
        });
    }

    /**
     * Update page metadata
     * @param {string} title - Page title
     * @param {string} description - Page description
     * @returns {Promise<Object>} Update result
     */
    static async updateMetaData(title, description) {
        return ContactApiClient.post('/api/user/settings', {
            action: 'updateMetaData',
            data: { title, description }
        });
    }

    // ===== ADDITIONAL HELPER METHODS =====

    /**
     * Batch update multiple settings at once
     * @param {Object} updates - Object with multiple setting updates
     * @returns {Promise<Object>} Update result
     * @example
     * await SettingsService.batchUpdate({
     *   socials: {...},
     *   socialPosition: 'top',
     *   metaTitle: 'My Page',
     *   metaDescription: 'Welcome'
     * })
     */
    static async batchUpdate(updates) {
        return this.updateSettingsData(updates);
    }

    /**
     * Reset settings to defaults
     * @param {Array<string>} fields - Specific fields to reset, or empty for all
     * @returns {Promise<Object>} Reset result
     */
    static async resetSettings(fields = []) {
        return ContactApiClient.post('/api/user/settings', {
            action: 'resetSettings',
            data: { fields }
        });
    }

    /**
     * Validate settings before saving
     * @param {Object} settingsData - Settings to validate
     * @returns {Promise<Object>} Validation result
     */
    static async validateSettings(settingsData) {
        return ContactApiClient.post('/api/user/settings/validate', settingsData);
    }
}

// ===== BACKWARD COMPATIBILITY EXPORTS =====
// These maintain the old function-based API for existing code

export async function getSettingsData() {
    return SettingsService.getSettingsData();
}

export async function updateSettingsData(settingsData) {
    return SettingsService.updateSettingsData(settingsData);
}

export async function updateSocials(socials) {
    return SettingsService.updateSocials(socials);
}

export async function updateSocialPosition(position) {
    return SettingsService.updateSocialPosition(position);
}

export async function updateSupportBanner(supportBanner, supportBannerStatus) {
    return SettingsService.updateSupportBanner(supportBanner, supportBannerStatus);
}

export async function updateSensitiveStatus(status) {
    return SettingsService.updateSensitiveStatus(status);
}

export async function updateSensitiveType(type) {
    return SettingsService.updateSensitiveType(type);
}

export async function updateMetaData(title, description) {
    return SettingsService.updateMetaData(title, description);
}