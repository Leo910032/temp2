// app/dashboard/(dashboard pages)/settings/SettingsContext.js
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useDashboard } from '@/app/dashboard/DashboardContext';
import { useDebounce } from '@/LocalHooks/useDebounce';
import { getSettingsData, updateSettingsData } from '@/lib/services/serviceSetting/client/settingsService.js';

// Create context with undefined (will check in hook)
const SettingsContext = createContext(undefined);

export function useSettings() {
    const context = useContext(SettingsContext);
    
    if (context === undefined) {
        throw new Error(
            'useSettings must be used within SettingsProvider. ' +
            'Make sure your component is wrapped with <SettingsProvider>.'
        );
    }
    
    return context;
}

export function SettingsProvider({ children }) {
    const { currentUser, isLoading: isSessionLoading } = useDashboard();

    // Core data state
    const [settings, setSettings] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoadError, setHasLoadError] = useState(false);

    // Debounced settings for auto-save
    const debouncedSettings = useDebounce(settings, 2000);

    // Refs for state tracking
    const isInitialLoad = useRef(true);
    const lastSavedData = useRef(null);
    const isServerUpdate = useRef(false);
    const fetchInProgress = useRef(false);
    const hasInitialized = useRef(false);
    const componentId = useRef(Math.random().toString(36).substring(7));

    // Fetch settings data
    const fetchSettingsData = useCallback(async () => {
        if (!currentUser || fetchInProgress.current) {
            console.log(`⏸️ [${componentId.current}] Skipping fetch - no user or fetch in progress`);
            return;
        }

        fetchInProgress.current = true;
        setIsLoading(true);
        setHasLoadError(false);

        try {
            console.log(`📥 [${componentId.current}] Fetching settings data...`);
            const data = await getSettingsData();

            // Normalize data with proper defaults
            const normalizedData = {
                socials: data.socials || [],
                socialPosition: data.socialPosition ?? 0,
                supportBanner: data.supportBanner ?? 0,
                supportBannerStatus: data.supportBannerStatus ?? false,
                sensitiveStatus: data.sensitiveStatus ?? false,
                sensitivetype: data.sensitivetype ?? 3,
                metaData: data.metaData || { title: '', description: '' },
            };

            // Mark as server update and store reference
            isServerUpdate.current = true;
            setSettings(normalizedData);
            lastSavedData.current = JSON.stringify(normalizedData);
            hasInitialized.current = true;

            console.log(`✅ [${componentId.current}] Settings data loaded from server`);

            // Reset server update flag after a brief delay
            setTimeout(() => {
                isServerUpdate.current = false;
            }, 150);

        } catch (error) {
            console.error(`❌ [${componentId.current}] Failed to fetch settings:`, error);
            setHasLoadError(true);
            toast.error('Failed to load settings');
        } finally {
            setIsLoading(false);
            fetchInProgress.current = false;
        }
    }, [currentUser]);

    // Save settings
    const saveSettings = useCallback(async (dataToSave) => {
        if (!currentUser || !dataToSave || fetchInProgress.current) return;

        // Check if data actually changed from last saved state
        const currentDataString = JSON.stringify(dataToSave);
        if (currentDataString === lastSavedData.current) {
            console.log(`🔄 [${componentId.current}] No changes detected, skipping save`);
            return;
        }

        setIsSaving(true);

        try {
            console.log(`💾 [${componentId.current}] Saving settings data...`);

            const result = await updateSettingsData(dataToSave);

            // Update the last saved data reference
            lastSavedData.current = currentDataString;

            toast.success('Settings saved!');
            console.log(`✅ [${componentId.current}] Settings saved:`, result.updatedFields);

        } catch (error) {
            console.error(`❌ [${componentId.current}] Save settings error:`, error);
            toast.error(error.message || 'Failed to save settings');

            // Reload data on error to sync state
            if (!fetchInProgress.current) {
                await fetchSettingsData();
            }
        } finally {
            setIsSaving(false);
        }
    }, [currentUser, fetchSettingsData]);

    // Update settings function
    const updateSettings = useCallback((fieldOrData, value) => {
        // Don't update during server updates or fetches
        if (isServerUpdate.current || fetchInProgress.current) {
            console.log(`🔄 [${componentId.current}] Server update/fetch in progress, skipping client update`);
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
                    console.log(`🔄 [${componentId.current}] No actual changes in object update, skipping`);
                    return prev;
                }

                newSettings = { ...prev, ...fieldOrData };
            } else {
                // Check if the field value actually changed
                if (JSON.stringify(prev[fieldOrData]) === JSON.stringify(value)) {
                    console.log(`🔄 [${componentId.current}] No change for field:`, fieldOrData, 'skipping');
                    return prev;
                }

                newSettings = { ...prev, [fieldOrData]: value };
            }

            console.log(`🔄 [${componentId.current}] Settings updated:`, fieldOrData);
            return newSettings;
        });
    }, []);

    // Initial data fetch - wait for session to load
    useEffect(() => {
        if (isSessionLoading) {
            console.log(`⏸️ [${componentId.current}] Waiting for session to load...`);
            return;
        }

        if (currentUser && !hasInitialized.current) {
            console.log(`🚀 [${componentId.current}] Initializing settings page...`);
            fetchSettingsData();
        }

        // Cleanup on user logout
        if (!currentUser && !isSessionLoading) {
            console.log(`👋 [${componentId.current}] User logged out, clearing data`);
            setSettings(null);
            hasInitialized.current = false;
            isInitialLoad.current = true;
            lastSavedData.current = null;
        }
    }, [currentUser, isSessionLoading, fetchSettingsData]);

    // Auto-save on debounced changes
    useEffect(() => {
        // Guard 1: Don't save until we've initialized
        if (!hasInitialized.current || debouncedSettings === null) {
            return;
        }

        // Guard 2: Don't save on initial load
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            console.log(`🔄 [${componentId.current}] Initial load complete, ready for user changes`);
            return;
        }

        // Guard 3: Don't save if this update came from the server
        if (isServerUpdate.current) {
            console.log(`🔄 [${componentId.current}] Skipping save - server update detected`);
            return;
        }

        // Guard 4: Don't save if fetch is in progress
        if (fetchInProgress.current) {
            console.log(`🔄 [${componentId.current}] Skipping save - fetch in progress`);
            return;
        }

        // If we get here, it's a real user change that needs saving
        console.log(`💾 [${componentId.current}] User change detected, saving settings...`);
        saveSettings(debouncedSettings);

    }, [debouncedSettings, saveSettings]);

    // Context value
    const value = useMemo(() => ({
        settings,
        updateSettings,
        isSaving,
        isLoading,
        hasLoadError,
        refreshData: fetchSettingsData
    }), [settings, updateSettings, isSaving, isLoading, hasLoadError, fetchSettingsData]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}