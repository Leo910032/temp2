/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/dashboard/(dashboard pages)/appearance/page.jsx
"use client"
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDashboard } from '@/app/dashboard/DashboardContext';
import { useDebounce } from '@/LocalHooks/useDebounce';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import { AppearanceService } from '@/lib/services/serviceAppearance/client/appearanceService.js';
import { APPEARANCE_FEATURES } from '@/lib/services/constants';

// Import context and components
import { AppearanceContext } from './AppearanceContext';
import ProfileCard from './components/ProfileCard';
import Themes from './components/Themes';
import Backgrounds from './components/Backgrounds';
import Buttons from './components/Buttons';
import FontsOptions from './components/FontsOptions';
import ChristmasAccessories from './components/ChristmasAccessories';

// Global state for caching
let globalAppearanceCache = null;
let globalDataFetched = false;
let globalLastSavedHash = null;

export default function AppearancePage() {
    // 1. GET GLOBAL DATA (permissions, session state)
    const { permissions, isLoading: isSessionLoading, currentUser } = useDashboard();
    const { t, isInitialized } = useTranslation();

    // 2. MANAGE PAGE-SPECIFIC STATE
    const [appearance, setAppearance] = useState(globalAppearanceCache);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingAppearance, setIsLoadingAppearance] = useState(!globalDataFetched);
    const [hasLoadError, setHasLoadError] = useState(false);
    
    const debouncedAppearance = useDebounce(appearance, 100);
    const isInitialLoad = useRef(!globalDataFetched);
    const componentId = useRef(Math.random().toString(36).substring(7));

    const canUseCustomButtons = permissions[APPEARANCE_FEATURES.CUSTOM_BUTTONS];
    const canUseCustomFonts = permissions[APPEARANCE_FEATURES.CUSTOM_FONTS];
    const canUseCustomBackground = permissions[APPEARANCE_FEATURES.CUSTOM_BACKGROUND];


    // Pre-compute translations
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            profile: t('dashboard.appearance.headings.profile'),
            themes: t('dashboard.appearance.headings.themes'),
            customAppearance: t('dashboard.appearance.headings.custom_appearance'),
            customAppearanceDesc: t('dashboard.appearance.custom_appearance_description'),
            backgrounds: t('dashboard.appearance.headings.backgrounds'),
            christmas: t('dashboard.appearance.headings.christmas'),
            buttons: t('dashboard.appearance.headings.buttons'),
            fonts: t('dashboard.appearance.headings.fonts'),
            newBadge: t('dashboard.appearance.new_badge'),
            saving: t('common.saving') || "Saving...",
            saved: t('common.saved') || "Appearance saved!",
            error: t('common.error') || "Failed to save settings.",
            loadingError: t('common.loading_error') || "Failed to load appearance data"
        };
    }, [t, isInitialized]);

    // HELPER: Hash function for change detection
    const createAppearanceHash = useCallback((data) => {
        if (!data) return null;
        
        const { 
            links, socials, createdAt, email, uid, username, lastLogin, 
            emailVerified, onboardingCompleted, isTestUser, testUserIndex,
            sensitiveStatus, sensitivetype, supportBannerStatus, supportBanner,
            metaData, socialPosition,
            ...appearanceData 
        } = data;
        
        // Remove undefined keys that might cause inconsistencies
        const cleanedData = {};
        Object.keys(appearanceData).forEach(key => {
            if (key !== 'undefined' && appearanceData[key] !== undefined) {
                cleanedData[key] = appearanceData[key];
            }
        });
        
        // Sort keys to ensure consistent hash
        const sortedKeys = Object.keys(cleanedData).sort();
        const sortedData = {};
        sortedKeys.forEach(key => {
            sortedData[key] = cleanedData[key];
        });
        
        return JSON.stringify(sortedData);
    }, []);

    // 3. FETCH PAGE-SPECIFIC DATA (using the service)
    const fetchAppearanceData = useCallback(async (forceRefresh = false) => {
        if (!currentUser) return;
        
        // If we have cached data and not forcing refresh, use cache
        if (globalAppearanceCache && !forceRefresh) {
            console.log(`📋 [${componentId.current}] Using cached appearance data`);
            setAppearance(globalAppearanceCache);
            setIsLoadingAppearance(false);
            return;
        }
        
        setIsLoadingAppearance(true);
        setHasLoadError(false);
        
        try {
            console.log(`📥 [${componentId.current}] Fetching fresh appearance data from server...`);
            
            const data = await AppearanceService.getAppearanceData();
            
            // Cache globally
            globalAppearanceCache = data;
            globalDataFetched = true;
            globalLastSavedHash = createAppearanceHash(data);
            
            setAppearance(data);
            
            console.log(`✅ [${componentId.current}] Appearance data loaded and cached`);
            
        } catch (error) {
            console.error(`❌ [${componentId.current}] Failed to fetch appearance data:`, error);
            setHasLoadError(true);
            toast.error(error.message || translations.loadingError);
        } finally {
            setIsLoadingAppearance(false);
        }
    }, [currentUser, createAppearanceHash, translations.loadingError]);

    // Initial data fetch
    useEffect(() => {
        if (currentUser && isInitialized && !isSessionLoading) {
            if (!globalAppearanceCache) {
                console.log(`🚀 [${componentId.current}] Component mounted, fetching data...`);
                fetchAppearanceData();
            } else {
                console.log(`⚡ [${componentId.current}] Component mounted, using cached data`);
                setAppearance(globalAppearanceCache);
                setIsLoadingAppearance(false);
            }
        }
        
        // Reset cache when user changes
        if (!currentUser && !isSessionLoading) {
            console.log(`👋 [${componentId.current}] User logged out, clearing cache`);
            globalAppearanceCache = null;
            globalDataFetched = false;
            globalLastSavedHash = null;
            setAppearance(null);
            setIsLoadingAppearance(false);
            isInitialLoad.current = true;
        }
    }, [currentUser, isInitialized, isSessionLoading, fetchAppearanceData]);

    // 4. SAVE LOGIC (using the service)
    const saveAppearance = useCallback(async (dataToSave) => {
        if (!dataToSave || isSaving) return;

        const currentDataHash = createAppearanceHash(dataToSave);
        if (currentDataHash === globalLastSavedHash) {
            console.log(`🔄 [${componentId.current}] No changes detected, skipping save`);
            return;
        }

        setIsSaving(true);
        console.log(`💾 [${componentId.current}] Saving appearance data...`);
        
        try {
            // Only send the fields that have actually changed
            const initialData = JSON.parse(globalLastSavedHash || '{}');
            const changedData = {};
            for (const key in dataToSave) {
                if (JSON.stringify(dataToSave[key]) !== JSON.stringify(initialData[key])) {
                    changedData[key] = dataToSave[key];
                }
            }
            
            if (Object.keys(changedData).length === 0) {
                setIsSaving(false);
                return; // No real changes found
            }

            await AppearanceService.updateAppearanceData(changedData);
            globalLastSavedHash = currentDataHash; // Update hash after successful save
            globalAppearanceCache = dataToSave; // Update cache
            
            toast.success(translations.saved, { 
                duration: 2000,
                icon: '✅',
                position: 'bottom-right'
            });
            
            console.log(`✅ [${componentId.current}] Appearance saved:`, Object.keys(changedData));
            
        } catch (error) {
            console.error(`❌ [${componentId.current}] Save error:`, error);
            toast.error(error.message || translations.error);
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, createAppearanceHash, translations.saved, translations.error]);

    // Debounced auto-save effect
    useEffect(() => {
        if (debouncedAppearance === null) return;
        
        if (isInitialLoad.current) {
            if (appearance !== null && globalLastSavedHash !== null) {
                isInitialLoad.current = false;
                console.log(`🎯 [${componentId.current}] Initial data load complete, enabling auto-save`);
            }
            return;
        }
        
        console.log(`⏰ [${componentId.current}] Debounced save triggered`);
        saveAppearance(debouncedAppearance);
    }, [debouncedAppearance, saveAppearance, appearance]);

    // Function to be passed in context for child components to update state
    const updateAppearance = useCallback((fieldOrData, value) => {
        setAppearance(prev => {
            if (!prev) return prev;
            
            let newAppearance;
            if (typeof fieldOrData === 'object') {
                newAppearance = { ...prev, ...fieldOrData };
                console.log(`🔄 [${componentId.current}] Appearance bulk update:`, Object.keys(fieldOrData));
            } else {
                if (fieldOrData === 'undefined' || fieldOrData === undefined) {
                    console.warn(`⚠️ [${componentId.current}] Attempted to update undefined field, skipping`);
                    return prev;
                }
                newAppearance = { ...prev, [fieldOrData]: value };
                console.log(`🔄 [${componentId.current}] Appearance field updated:`, fieldOrData, '→', value);
            }
            
            // Update cache
            globalAppearanceCache = newAppearance;
            
            return newAppearance;
        });
    }, []);
 // ✅ STEP 1: CREATE THE NEW FILE UPLOAD HANDLER HERE
    const handleFileUpload = useCallback(async (file, uploadType) => {
        // This function will be called by child components like BackgroundCard
        console.log(`[AppearancePage] Handling upload for type: ${uploadType}`);
        
        try {
            // Call the service to perform the upload
            const result = await AppearanceService.uploadFile(file, uploadType);

            // On success, update the global state with the new URL
            const updateKey = uploadType === 'backgroundImage' ? 'backgroundImage' : 'backgroundVideo';
            updateAppearance({
                [updateKey]: result.downloadURL,
                backgroundType: uploadType === 'backgroundImage' ? 'Image' : 'Video'
            });

            toast.success('Background updated successfully!');
            return { success: true }; // Return success to the child component
        } catch (error) {
            console.error(`[AppearancePage] Upload error for ${uploadType}:`, error);
            toast.error(error.message || 'Upload failed.');
            return { success: false, error }; // Return failure
        }
    }, [updateAppearance]); // Dependency on updateAppearance

    // 5. PROVIDE CONTEXT to child components
    const contextValue = useMemo(() => ({
        appearance,
        updateAppearance,
        isSaving,
        handleFileUpload,
        isLoading: isLoadingAppearance,
        hasLoadError,
        refreshData: () => fetchAppearanceData(true),
        isDataLoaded: !!appearance && !isLoadingAppearance,
        permissions // Provide permissions to child components
    }), [appearance, updateAppearance, isSaving, isLoadingAppearance, hasLoadError, fetchAppearanceData, permissions,handleFileUpload]);

    // --- RENDER LOGIC ---
    if (isSessionLoading) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <div className="text-gray-500">Loading session...</div>
                </div>
            </div>
        );
    }

    if (!isInitialized) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 text-center">
                    <div className="animate-pulse">Loading translations...</div>
                </div>
            </div>
        );
    }

    if (isLoadingAppearance && !appearance) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <div className="text-gray-500">Loading appearance settings...</div>
                </div>
            </div>
        );
    }

    if (!appearance && hasLoadError) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 text-center">
                    <div className="text-red-500 mb-4">Failed to load appearance settings</div>
                    <button 
                        onClick={() => fetchAppearanceData(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // Permission check
    if (!permissions[APPEARANCE_FEATURES.CAN_UPDATE_APPEARANCE]) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto items-center justify-center">
                <div className="p-6 text-center bg-white rounded-lg shadow-md">
                    <div className="text-xl font-semibold text-amber-600 mb-4">
                        Appearance Customization
                    </div>
                    <p className="text-gray-600 mb-6">This feature is not included in your current plan.</p>
                    <button className="px-6 py-3 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors">
                        Upgrade Your Plan
                    </button>
                </div>
            </div>
        );
    }

    return (
        <AppearanceContext.Provider value={contextValue}>
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto pr-2">
                {isSaving && (
                    <div className="fixed top-20 right-6 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span className="font-medium">{translations.saving}</span>
                    </div>
                )}
                
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.profile}</h2>
                    <ProfileCard />
                </div>
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.themes}</h2>
                    <Themes />
                </div>
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.customAppearance}</h2>
                    <p className="py-3 sm:text-base text-sm text-gray-600">
                        {translations.customAppearanceDesc}
                    </p>
                </div>
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.backgrounds}</h2>
                    {canUseCustomBackground ? <Backgrounds /> : <UpgradePrompt feature="Custom Backgrounds" requiredTier="Premium" />}
                </div>
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">
                        {translations.christmas} 
                        <span className="py-1 px-3 rounded bg-green-500 text-white font-medium text-sm ml-2">
                            {translations.newBadge}
                        </span>
                    </h2>
                    <ChristmasAccessories />
                </div>
              <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.buttons}</h2>
                    {canUseCustomButtons ? <Buttons /> : <UpgradePrompt feature="Custom Buttons" requiredTier="Pro" />}
                </div>
              <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.fonts}</h2>
                    {canUseCustomFonts ? <FontsOptions /> : <UpgradePrompt feature="Custom Fonts" requiredTier="Pro" />}
                </div>
            </div>
        </AppearanceContext.Provider>
    );
}