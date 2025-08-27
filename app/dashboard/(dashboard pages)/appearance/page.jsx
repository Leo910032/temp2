//app/dashboard/(dashboard pages)/appearance/page
"use client"
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/LocalHooks/useDebounce';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import { updateAppearanceData, getAppearanceData } from '@/lib/services/appearanceService';

// ✅ FIXED: Import context from separate file
import { AppearanceContext } from './AppearanceContext';

// Import all the child components for this page
import ProfileCard from './components/ProfileCard';
import Themes from './components/Themes';
import Backgrounds from './components/Backgrounds';
import Buttons from './components/Buttons';
import FontsOptions from './components/FontsOptions';
import ChristmasAccessories from './components/ChristmasAccessories';

// ✅ GLOBAL STATE: Store appearance data AND last saved hash outside component
let globalAppearanceCache = null;
let globalDataFetched = false;
let globalLastSavedHash = null; // ✅ FIXED: Store hash globally so it persists across navigations

function AppearancePage() {
    const { currentUser } = useAuth();
    const { t, isInitialized } = useTranslation();
    
    const [appearance, setAppearance] = useState(globalAppearanceCache);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(!globalDataFetched);
    const [hasLoadError, setHasLoadError] = useState(false);
    const debouncedAppearance = useDebounce(appearance, 2000);
    const isInitialLoad = useRef(!globalDataFetched);
    const componentId = useRef(Math.random().toString(36).substring(7)); // Unique ID for debugging

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

    // ✅ HELPER: Create deterministic hash from appearance data
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

    // ✅ PERSISTENT DATA FETCH: Only fetch once and cache globally
    const fetchAppearanceData = useCallback(async (forceRefresh = false) => {
        if (!currentUser) return;
        
        // If we have cached data and not forcing refresh, use cache
        if (globalAppearanceCache && !forceRefresh) {
            console.log(`📋 [${componentId.current}] Using cached appearance data`);
            setAppearance(globalAppearanceCache);
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        setHasLoadError(false);
        
        try {
            console.log(`📥 [${componentId.current}] Fetching fresh appearance data from server...`);
            const data = await getAppearanceData();
            
            // ✅ CACHE GLOBALLY: Store data and hash globally
            globalAppearanceCache = data;
            globalDataFetched = true;
            globalLastSavedHash = createAppearanceHash(data); // ✅ Store hash globally
            
            setAppearance(data);
            
            console.log(`✅ [${componentId.current}] Appearance data loaded and cached`);
            
        } catch (error) {
            console.error(`❌ [${componentId.current}] Failed to fetch appearance data:`, error);
            setHasLoadError(true);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, createAppearanceHash]);

    // ✅ LOAD DATA: Only on first mount or when user changes
    useEffect(() => {
        if (currentUser && isInitialized) {
            if (!globalAppearanceCache) {
                console.log(`🚀 [${componentId.current}] Component mounted, fetching data...`);
                fetchAppearanceData();
            } else {
                console.log(`⚡ [${componentId.current}] Component mounted, using cached data`);
                setAppearance(globalAppearanceCache);
                setIsLoading(false);
            }
        }
        
        // Reset cache when user changes
        if (!currentUser) {
            console.log(`👋 [${componentId.current}] User logged out, clearing cache`);
            globalAppearanceCache = null;
            globalDataFetched = false;
            globalLastSavedHash = null; // ✅ Clear hash too
            setAppearance(null);
            setIsLoading(false);
            isInitialLoad.current = true;
        }
    }, [currentUser, isInitialized, fetchAppearanceData]);

    // ✅ IMPROVED SAVE LOGIC: Use global hash for change detection
    const saveAppearance = useCallback(async (dataToSave) => {
        if (!currentUser || !dataToSave || isSaving) return;
        
        const currentDataHash = createAppearanceHash(dataToSave);
        
        // ✅ FIXED: Compare with global hash that persists across navigations
        if (currentDataHash === globalLastSavedHash) {
            console.log(`🔄 [${componentId.current}] No changes detected, skipping save`);
            return;
        }
        
        const { 
            links, socials, createdAt, email, uid, username, lastLogin, 
            emailVerified, onboardingCompleted, isTestUser, testUserIndex,
            sensitiveStatus, sensitivetype, supportBannerStatus, supportBanner,
            metaData, socialPosition,
            ...appearanceData 
        } = dataToSave;
        
        // Remove undefined keys
        const cleanedData = {};
        Object.keys(appearanceData).forEach(key => {
            if (key !== 'undefined' && appearanceData[key] !== undefined) {
                cleanedData[key] = appearanceData[key];
            }
        });
        
        setIsSaving(true);
        console.log(`💾 [${componentId.current}] Saving appearance data...`, Object.keys(cleanedData));
        
        try {
            const result = await updateAppearanceData(cleanedData);
            
            // ✅ UPDATE GLOBAL CACHE AND HASH: Keep them in sync
            globalAppearanceCache = { ...globalAppearanceCache, ...cleanedData };
            globalLastSavedHash = currentDataHash; // ✅ Update global hash
            
            toast.success(translations.saved, { 
                duration: 2000,
                icon: '✅',
                position: 'bottom-right'
            });
            
            console.log(`✅ [${componentId.current}] Appearance saved:`, Object.keys(cleanedData));
            
        } catch (error) {
            console.error(`❌ [${componentId.current}] Save error:`, error);
            toast.error(error.message || translations.error);
        } finally {
            setIsSaving(false);
        }
    }, [currentUser, translations.saved, translations.error, createAppearanceHash]);

    // ✅ FIXED: Handle debounced saves with better initial load detection
    useEffect(() => {
        // Skip if no data or still in initial load phase
        if (debouncedAppearance === null) return;
        
        // Skip initial load - wait until cache is established
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

    // ✅ UPDATE FUNCTION: Update both local state and cache
    const updateAppearance = useCallback((fieldOrData, value) => {
        setAppearance(prev => {
            if (!prev) return prev;
            
            let newAppearance;
            if (typeof fieldOrData === 'object') {
                newAppearance = { ...prev, ...fieldOrData };
                console.log(`🔄 [${componentId.current}] Appearance bulk update:`, Object.keys(fieldOrData));
            } else {
                // Skip undefined fields
                if (fieldOrData === 'undefined' || fieldOrData === undefined) {
                    console.warn(`⚠️ [${componentId.current}] Attempted to update undefined field, skipping`);
                    return prev;
                }
                newAppearance = { ...prev, [fieldOrData]: value };
                console.log(`🔄 [${componentId.current}] Appearance field updated:`, fieldOrData, '→', value);
            }
            
            // ✅ UPDATE CACHE: Keep global cache in sync
            globalAppearanceCache = newAppearance;
            
            return newAppearance;
        });
    }, []);

    const contextValue = useMemo(() => ({
        appearance,
        updateAppearance,
        isSaving,
        isLoading,
        hasLoadError,
        refreshData: () => fetchAppearanceData(true),
        isDataLoaded: !!appearance && !isLoading
    }), [appearance, updateAppearance, isSaving, isLoading, hasLoadError, fetchAppearanceData]);

    if (!isInitialized) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 text-center">
                    <div className="animate-pulse">Loading translations...</div>
                </div>
            </div>
        );
    }

    if (isLoading && !appearance) {
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
                    <Backgrounds />
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
                    <Buttons />
                </div>
                <div className="py-4">
                    <h2 className="text-lg font-semibold my-4">{translations.fonts}</h2>
                    <FontsOptions />
                </div>
            </div>
        </AppearanceContext.Provider>
    );
}

// ✅ FIXED: Only export the default component function
export default AppearancePage;