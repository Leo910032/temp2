/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// lib/services/client/appearanceService/index.js
// Central export file for all appearance service functions

export { AppearanceService } from '@/lib/services/serviceAppearance/client/appearanceService.js';

// Export all individual functions for convenience
export {
    // Core functions
    getAppearanceData,
    updateAppearanceData,
    
    // File upload functions
    uploadProfileImage,
    uploadBackgroundImage,
    uploadBackgroundVideo,
    uploadCVDocument,
    
    // File removal functions
    removeProfileImage,
    removeBackgroundImage,
    removeBackgroundVideo,
    removeCVDocument,
    
    // Theme functions
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
    
    // Profile functions
    updateDisplayName,
    updateBio
} from './appearanceService.js';