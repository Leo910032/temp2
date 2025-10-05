/**
 * Enhanced AppearanceContext with Smart Caching
 * 
 * This provides:
 * 1. Instant loading from cache when returning to the page
 * 2. Automatic debounced saving
 * 3. Change detection to prevent unnecessary saves
 * 4. Memory cleanup and cache management
 * 5. Error handling and retry logic
 */

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDashboard } from '@/app/dashboard/DashboardContext';
import { useDebounce } from '@/LocalHooks/useDebounce';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import { AppearanceService } from '@/lib/services/serviceAppearance/client/appearanceService.js';
import { APPEARANCE_FEATURES } from '@/lib/services/constants';

// Global cache object - persists across component mounts
const appearanceCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for appearance data
const MAX_CACHE_ENTRIES = 20; // Reasonable limit for appearance cache

// Cache cleanup utility
function cleanupOldCacheEntries() {
    const now = Date.now();
    const entries = Array.from(appearanceCache.entries());
    
    // Remove expired entries
    const expiredKeys = entries
        .filter(([_, data]) => now - data.timestamp > CACHE_DURATION)
        .map(([key]) => key);
    
    expiredKeys.forEach(key => appearanceCache.delete(key));
    
    // If still too many entries, remove oldest ones
    if (appearanceCache.size > MAX_CACHE_ENTRIES) {
        const sortedEntries = entries
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
            .slice(0, appearanceCache.size - MAX_CACHE_ENTRIES);
        
        sortedEntries.forEach(([key]) => appearanceCache.delete(key));
    }
    
    console.log(`🧹 Appearance cache cleanup: ${expiredKeys.length} expired entries removed, ${appearanceCache.size} entries remaining`);
}

// Create the context
const AppearanceContext = createContext(null);

// Custom hook to use the context
export function useAppearance() {
    const context = useContext(AppearanceContext);
    if (!context) {
        throw new Error('useAppearance must be used within an AppearanceProvider');
    }
    return context;
}

export function AppearanceProvider({ children }) {
    const { permissions, isLoading: isSessionLoading, currentUser } = useDashboard();
    const { t, isInitialized } = useTranslation();
    
    // Core state
    const [appearance, setAppearance] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoadError, setHasLoadError] = useState(false);
    const [isFromCache, setIsFromCache] = useState(false);
    
    // Refs for managing state
    const isInitialLoad = useRef(true);
    const componentId = useRef(Math.random().toString(36).substring(7));
    const cacheKeyRef = useRef(null);
    const lastSavedHashRef = useRef(null);
    const isListenerUpdate = useRef(false);
    
    // Debounced appearance for auto-save
    const debouncedAppearance = useDebounce(appearance, 500);

    // Pre-compute translations
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            saving: t('common.saving') || "Saving...",
            saved: t('common.saved') || "Appearance saved!",
            error: t('common.error') || "Failed to save settings.",
            loadingError: t('common.loading_error') || "Failed to load appearance data"
        };
    }, [t, isInitialized]);

    // Helper: Create hash for change detection
    const createAppearanceHash = useCallback((data) => {
        if (!data) return null;
        
        const { 
            links, socials, createdAt, email, uid, username, lastLogin, 
            emailVerified, onboardingCompleted, isTestUser, testUserIndex,
            sensitiveStatus, sensitivetype, supportBannerStatus, supportBanner,
            metaData, socialPosition, _meta,
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

    // Fetch appearance data with caching
    const fetchAppearanceData = useCallback(async (forceRefresh = false) => {
        if (!currentUser) return;
        
        const cacheKey = `appearance_${currentUser.uid}`;
        cacheKeyRef.current = cacheKey;
        
        console.log(`[AppearanceProvider] 🚀 Initializing for user: ${currentUser.uid}`);

        // Step 1: Check cache first for instant loading
        const cachedEntry = appearanceCache.get(cacheKey);
        const now = Date.now();
        
        if (cachedEntry && !forceRefresh && (now - cachedEntry.timestamp < CACHE_DURATION)) {
            console.log(`[AppearanceProvider] ⚡ Loading from cache (${Math.round((now - cachedEntry.timestamp) / 1000)}s old)`);
            setAppearance(cachedEntry.data);
            lastSavedHashRef.current = createAppearanceHash(cachedEntry.data);
            setIsFromCache(true);
            setIsLoading(false);
            setHasLoadError(false);
            return;
        }

        // Step 2: Fetch fresh data
        if (cachedEntry && forceRefresh) {
            console.log(`[AppearanceProvider] 🔄 Force refresh requested`);
        } else if (cachedEntry) {
            console.log(`[AppearanceProvider] 🕒 Cache expired, fetching fresh data`);
        } else {
            console.log(`[AppearanceProvider] 🆕 No cache found, fetching fresh data`);
        }
        
        setIsLoading(true);
        setHasLoadError(false);
        setIsFromCache(false);
        
        try {
            console.log(`📥 [${componentId.current}] Fetching fresh appearance data from server...`);
            
            const data = await AppearanceService.getAppearanceData();
            
            // Add metadata
            const enhancedData = {
                ...data,
                _meta: {
                    fetchedAt: Date.now(),
                    fromCache: false,
                    cacheKey
                }
            };
            
            // Update cache
            appearanceCache.set(cacheKey, {
                data: enhancedData,
                timestamp: Date.now()
            });
            
            setAppearance(enhancedData);
            lastSavedHashRef.current = createAppearanceHash(enhancedData);
            
            console.log(`✅ [${componentId.current}] Appearance data loaded and cached`);
            
        } catch (error) {
            console.error(`❌ [${componentId.current}] Failed to fetch appearance data:`, error);
            setHasLoadError(true);
            toast.error(error.message || translations.loadingError);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, createAppearanceHash, translations.loadingError]);

    // Save appearance data
    const saveAppearance = useCallback(async (dataToSave) => {
        if (!dataToSave || isSaving || !currentUser) return;

        const currentDataHash = createAppearanceHash(dataToSave);
        if (currentDataHash === lastSavedHashRef.current) {
            console.log(`🔄 [${componentId.current}] No changes detected, skipping save`);
            return;
        }

        setIsSaving(true);
        console.log(`💾 [${componentId.current}] Saving appearance data...`);
        console.log(`📊 [${componentId.current}] Current hash:`, currentDataHash?.substring(0, 100));
        console.log(`📊 [${componentId.current}] Last saved hash:`, lastSavedHashRef.current?.substring(0, 100));
        
        try {
            // Only send the fields that have actually changed
            const initialData = JSON.parse(lastSavedHashRef.current || '{}');
            const changedData = {};
            for (const key in dataToSave) {
                if (key === '_meta') continue; // Skip metadata
                if (JSON.stringify(dataToSave[key]) !== JSON.stringify(initialData[key])) {
                    changedData[key] = dataToSave[key];
                }
            }
            
            if (Object.keys(changedData).length === 0) {
                setIsSaving(false);
                return; // No real changes found
            }

            await AppearanceService.updateAppearanceData(changedData);
            
            // Update hash and cache after successful save
            lastSavedHashRef.current = currentDataHash;
            if (cacheKeyRef.current) {
                appearanceCache.set(cacheKeyRef.current, {
                    data: dataToSave,
                    timestamp: Date.now()
                });
            }
            
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
    }, [isSaving, createAppearanceHash, translations.saved, translations.error, currentUser]);

    // Update appearance function for child components
    const updateAppearance = useCallback((fieldOrData, value) => {
        // Clear listener flag when user makes manual updates
        isListenerUpdate.current = false;

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

            // Update metadata
            newAppearance._meta = {
                ...prev._meta,
                lastModified: Date.now(),
                fromCache: false
            };

            // Update cache immediately for responsiveness
            if (cacheKeyRef.current) {
                appearanceCache.set(cacheKeyRef.current, {
                    data: newAppearance,
                    timestamp: Date.now()
                });
            }

            return newAppearance;
        });
    }, []);

    // File upload handler
    const handleFileUpload = useCallback(async (file, uploadType) => {
        console.log(`[AppearanceProvider] Handling upload for type: ${uploadType}`);
        
        try {
            const result = await AppearanceService.uploadFile(file, uploadType);

            const updateKey = uploadType === 'backgroundImage' ? 'backgroundImage' : 'backgroundVideo';
            updateAppearance({
                [updateKey]: result.downloadURL,
                backgroundType: uploadType === 'backgroundImage' ? 'Image' : 'Video'
            });

            toast.success('Background updated successfully!');
            return { success: true };
        } catch (error) {
            console.error(`[AppearanceProvider] Upload error for ${uploadType}:`, error);
            toast.error(error.message || 'Upload failed.');
            return { success: false, error };
        }
    }, [updateAppearance]);

  // ... inside the AppearanceProvider component

// Initial data fetch and real-time listener setup
useEffect(() => {
    // ✅ FIX: Copy the ref value to a local variable
    const id = componentId.current;

    if (!currentUser || !isInitialized || isSessionLoading) {
        // Reset cache when user changes
        if (!currentUser && !isSessionLoading) {
            console.log(`👋 [${id}] User logged out, clearing state`);
            setAppearance(null);
            setIsLoading(false);
            setIsFromCache(false);
            setHasLoadError(false);
            isInitialLoad.current = true;
            cacheKeyRef.current = null;
            lastSavedHashRef.current = null;
        }
        return;
    }

    // Initial fetch
    const cacheKey = `appearance_${currentUser.uid}`;
    cacheKeyRef.current = cacheKey;

    console.log(`[AppearanceProvider] 🚀 Initializing for user: ${currentUser.uid}`);

    // Check cache first for instant loading
    const cachedEntry = appearanceCache.get(cacheKey);
    const now = Date.now();

    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_DURATION)) {
        console.log(`[AppearanceProvider] ⚡ Loading from cache (${Math.round((now - cachedEntry.timestamp) / 1000)}s old)`);
        setAppearance(cachedEntry.data);
        lastSavedHashRef.current = createAppearanceHash(cachedEntry.data);
        setIsFromCache(true);
        setIsLoading(false);
        setHasLoadError(false);
    } else {
        // Fetch fresh data
        console.log(`[AppearanceProvider] 🆕 No cache or cache expired, fetching fresh data`);
        fetchAppearanceData(false);
    }

    // Set up real-time listener for appearance data changes
    console.log(`📡 [${id}] Setting up real-time listener for appearance data`);
    const unsubscribe = AppearanceService.listenToAppearanceData(
        currentUser.uid,
        (updatedAppearance) => {
            console.log(`📡 [${id}] Received appearance update from listener`, updatedAppearance);

            // Mark as listener update to prevent save loop
            isListenerUpdate.current = true;

            // Update state with fresh data
            const enhancedData = {
                ...updatedAppearance,
                _meta: {
                    fetchedAt: Date.now(),
                    fromCache: false,
                    cacheKey,
                    fromListener: true
                }
            };

            setAppearance(enhancedData);
            lastSavedHashRef.current = createAppearanceHash(enhancedData);

            // Update cache
            appearanceCache.set(cacheKey, {
                data: enhancedData,
                timestamp: Date.now()
            });

            // Reset listener flag after a short delay
            setTimeout(() => {
                isListenerUpdate.current = false;
            }, 100);
        }
    );

    // Cleanup listener on unmount
    return () => {
        // ✅ FIX: Use the local variable in the cleanup function
        console.log(`📡 [${id}] Cleaning up real-time listener`);
        unsubscribe();
    };
}, [currentUser, isInitialized, isSessionLoading, fetchAppearanceData, createAppearanceHash]);

// ... rest of the component
    // Debounced auto-save effect
    useEffect(() => {
        if (debouncedAppearance === null) return;

        if (isInitialLoad.current) {
            if (appearance !== null && lastSavedHashRef.current !== null) {
                isInitialLoad.current = false;
                console.log(`🎯 [${componentId.current}] Initial data load complete, enabling auto-save`);
            }
            return;
        }

        // Skip save if this was triggered by a listener update
        console.log(`🔍 [${componentId.current}] Debounce check - isListenerUpdate: ${isListenerUpdate.current}`);
        if (isListenerUpdate.current) {
            console.log(`⏭️ [${componentId.current}] Debounced save skipped (listener update)`);
            return;
        }

        console.log(`⏰ [${componentId.current}] Debounced save triggered - proceeding to save`);
        saveAppearance(debouncedAppearance);
    }, [debouncedAppearance, saveAppearance, appearance]);

    // Periodic cache cleanup
    useEffect(() => {
        const cleanupInterval = setInterval(cleanupOldCacheEntries, 2 * 60 * 1000); // Every 2 minutes
        return () => clearInterval(cleanupInterval);
    }, []);

    // Enhanced context value with cache information
    const contextValue = useMemo(() => ({
        appearance,
        updateAppearance,
        isSaving,
        handleFileUpload,
        isLoading,
        hasLoadError,
        refreshData: () => fetchAppearanceData(true),
        isDataLoaded: !!appearance && !isLoading,
        permissions,
        cacheInfo: {
            isFromCache,
            totalCacheEntries: appearanceCache.size,
            currentCacheKey: cacheKeyRef.current,
            lastModified: appearance?._meta?.lastModified
        }
    }), [
        appearance, updateAppearance, isSaving, isLoading, hasLoadError, 
        fetchAppearanceData, permissions, handleFileUpload, isFromCache
    ]);

    return (
        <AppearanceContext.Provider value={contextValue}>
            {children}
        </AppearanceContext.Provider>
    );
}

// Utility functions for cache management
export function clearAppearanceCache(userId = null) {
    if (userId) {
        const cacheKey = `appearance_${userId}`;
        const deleted = appearanceCache.delete(cacheKey);
        console.log(`🗑️ Cleared appearance cache for user ${userId}:`, deleted ? 'success' : 'not found');
        return deleted;
    } else {
        const size = appearanceCache.size;
        appearanceCache.clear();
        console.log(`🗑️ Cleared entire appearance cache (${size} entries)`);
        return size;
    }
}

export function getAppearanceCacheInfo() {
    const entries = Array.from(appearanceCache.entries()).map(([key, data]) => ({
        key,
        age: Math.round((Date.now() - data.timestamp) / 1000),
        hasData: !!data.data
    }));
    
    return {
        totalEntries: appearanceCache.size,
        entries
    };
}

// Export the context for backward compatibility
export { AppearanceContext };