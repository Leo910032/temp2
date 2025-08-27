"use client"
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/LocalHooks/useDebounce';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import { getSettingsData, updateSettingsData } from '@/lib/services/settingsService';

// ✅ FIXED: Import context from separate file
import { SettingsContext } from './SettingsContext';

// Import components
import Controller from "./components/Controller";
import SEO from "./components/SEO";
import SensitiveMaterial from "./components/SensitiveMaterial";
import SocialSetting from "./components/SocialSetting";
import SupportBanner from "./components/SupportBanner";

function SettingsPage() {
    const { currentUser } = useAuth();
    const { t, isInitialized } = useTranslation();
    
    const [settings, setSettings] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const debouncedSettings = useDebounce(settings, 2000);
    const isInitialLoad = useRef(true);
    const lastSavedData = useRef(null);
    const isServerUpdate = useRef(false);
    const fetchInProgress = useRef(false); // ✅ NEW: Prevent duplicate fetches
    const hasInitialized = useRef(false); // ✅ NEW: Track if we've initialized

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            saving: t('common.saving') || "Saving...",
            saved: t('common.saved') || "Settings saved!",
            error: t('common.error') || "Failed to save settings.",
            loadingError: t('common.loading_error') || "Failed to load settings"
        };
    }, [t, isInitialized]);

    // ✅ FIXED: Deduplicated data fetching
    const fetchSettingsData = useCallback(async () => {
        if (!currentUser || fetchInProgress.current) {
            console.log('⏸️ Skipping fetch - no user or fetch in progress');
            return;
        }
        
        fetchInProgress.current = true;
        setIsLoading(true);
        
        try {
            console.log('📥 Fetching settings data...');
            const data = await getSettingsData();
            
            // ✅ FIXED: Ensure all fields have proper defaults
            const normalizedData = {
                socials: data.socials || [],
                socialPosition: data.socialPosition ?? 0,
                supportBanner: data.supportBanner ?? 0,
                supportBannerStatus: data.supportBannerStatus ?? false,
                sensitiveStatus: data.sensitiveStatus ?? false,
                sensitivetype: data.sensitivetype ?? 3,
                metaData: data.metaData || { title: '', description: '' },
            };
            
            // ✅ FIXED: Mark as server update and store reference
            isServerUpdate.current = true;
            setSettings(normalizedData);
            lastSavedData.current = JSON.stringify(normalizedData);
            hasInitialized.current = true;
            
            console.log('✅ Settings data loaded from server:', normalizedData);
            
            // Reset server update flag after a brief delay
            setTimeout(() => {
                isServerUpdate.current = false;
            }, 150); // ✅ INCREASED: Slightly longer delay
            
        } catch (error) {
            console.error('Failed to fetch settings data:', error);
            toast.error(translations.loadingError);
        } finally {
            setIsLoading(false);
            fetchInProgress.current = false;
        }
    }, [currentUser, translations.loadingError]);

    // ✅ FIXED: Single initialization effect
    useEffect(() => {
        if (currentUser && isInitialized && !hasInitialized.current) {
            console.log('🚀 Initializing settings page...');
            fetchSettingsData();
        }
    }, [currentUser, isInitialized, fetchSettingsData]);

    // ✅ FIXED: Improved save logic
    const saveSettings = useCallback(async (dataToSave) => {
        if (!currentUser || !dataToSave || fetchInProgress.current) return;
        
        // Check if data actually changed from last saved state
        const currentDataString = JSON.stringify(dataToSave);
        if (currentDataString === lastSavedData.current) {
            console.log('🔄 No changes detected, skipping save');
            return;
        }
        
        setIsSaving(true);
        
        try {
            console.log('💾 Saving settings data...');
            
            const result = await updateSettingsData(dataToSave);
            
            // Update the last saved data reference
            lastSavedData.current = currentDataString;
            
            toast.success(translations.saved);
            console.log('✅ Settings saved:', result.updatedFields);
            
        } catch (error) {
            console.error('❌ Save settings error:', error);
            toast.error(error.message || translations.error);
            
            // Reload data on error to sync state
            if (!fetchInProgress.current) {
                await fetchSettingsData();
            }
        } finally {
            setIsSaving(false);
        }
    }, [currentUser, translations.error, translations.saved, fetchSettingsData]);

    // ✅ FIXED: Better debounced save logic
    useEffect(() => {
        // Guard 1: Don't save until we've initialized
        if (!hasInitialized.current || debouncedSettings === null) {
            return;
        }

        // Guard 2: Don't save on initial load
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            console.log('🔄 Initial load complete, ready for user changes');
            return;
        }

        // Guard 3: Don't save if this update came from the server
        if (isServerUpdate.current) {
            console.log('🔄 Skipping save - server update detected');
            return;
        }

        // Guard 4: Don't save if fetch is in progress
        if (fetchInProgress.current) {
            console.log('🔄 Skipping save - fetch in progress');
            return;
        }

        // If we get here, it's a real user change that needs saving
        console.log('💾 User change detected, saving settings...');
        saveSettings(debouncedSettings);
        
    }, [debouncedSettings, saveSettings]);

    // ✅ IMPROVED: Better update function with more guards
    const updateSettings = useCallback((fieldOrData, value) => {
        // Don't update during server updates or fetches
        if (isServerUpdate.current || fetchInProgress.current) {
            console.log('🔄 Server update/fetch in progress, skipping client update');
            return;
        }
        
        setSettings(prev => {
            if (!prev) return prev;
            
            let newSettings;
            if (typeof fieldOrData === 'object') {
                // Check if the object actually contains changes
                const hasChanges = Object.keys(fieldOrData).some(key => 
                    JSON.stringify(prev[key]) !== JSON.stringify(fieldOrData[key])
                );
                
                if (!hasChanges) {
                    console.log('🔄 No actual changes in object update, skipping');
                    return prev;
                }
                
                newSettings = { ...prev, ...fieldOrData };
            } else {
                // Check if the field value actually changed
                if (JSON.stringify(prev[fieldOrData]) === JSON.stringify(value)) {
                    console.log('🔄 No change for field:', fieldOrData, 'skipping');
                    return prev;
                }
                
                newSettings = { ...prev, [fieldOrData]: value };
            }
            
            console.log('🔄 Settings updated:', fieldOrData);
            return newSettings;
        });
    }, []);

    // ✅ IMPROVED: Memoized context value with stability
    const contextValue = useMemo(() => ({
        settings,
        updateSettings,
        isSaving,
        isLoading,
        refreshData: fetchSettingsData
    }), [settings, updateSettings, isSaving, isLoading, fetchSettingsData]);

    // ✅ IMPROVED: Better loading conditions
    if (!isInitialized || isLoading || !settings || !hasInitialized.current) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto scroll-smooth">
                <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <div className="text-gray-500">Loading settings...</div>
                </div>
            </div>
        );
    }

    return (
        <SettingsContext.Provider value={contextValue}>
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto scroll-smooth">
                {/* Save indicator */}
                {isSaving && (
                    <div className="fixed top-20 right-6 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {translations.saving}
                    </div>
                )}
                
                <Controller />
                <SocialSetting />
                <SupportBanner />
                <SensitiveMaterial />
                <SEO />
            </div>
        </SettingsContext.Provider>
    );
}

// ✅ FIXED: Only export the default component function
export default SettingsPage;