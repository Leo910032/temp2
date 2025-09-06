"use client"

import React, { useEffect, useState, useMemo, useCallback, createContext, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useDebounce } from "@/LocalHooks/useDebounce";
import { generateRandomId } from "@/lib/utilities";
import { toast } from "react-hot-toast";
import AddBtn from "../general elements/addBtn";
import DraggableList from "./Drag";

// Create context to pass state down to child components
export const ManageLinksContent = createContext(null);

export default function ManageLinks() {
    const { currentUser } = useAuth();
    const { t, isInitialized } = useTranslation();
    
    // --- State Management ---
    const [data, setData] = useState([]); // Live data state for the UI
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    // --- Refs for Lifecycle Management ---
    const hasInitiallyLoaded = useRef(false);
    const lastSavedData = useRef(null); // Track what was last saved to prevent unnecessary saves
    const isServerUpdate = useRef(false); // Flag to distinguish server updates from user changes

    // Debounce state changes
    const debouncedData = useDebounce(data, 1500);

    // Memoize translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            addHeader: t('dashboard.links.add_header'),
            emptyStateTitle: t('dashboard.links.empty_state.title'),
            emptyStateSubtitle: t('dashboard.links.empty_state.subtitle'),
            linksSaved: t('dashboard.links.saved_success') || "Links saved!",
            savingError: t('dashboard.links.saved_error') || "Could not save links.",
            loadingError: t('dashboard.links.loading_error') || "Failed to load links."
        };
    }, [t, isInitialized]);

    // --- User Actions ---
    const addLinkItem = useCallback(() => {
        const newLink = { id: generateRandomId(), title: "", url: "", urlKind: "", isActive: true, type: 1 };
        setData(prevData => [newLink, ...prevData]);
    }, []);

    const addHeaderItem = useCallback(() => {
        const newHeader = { id: generateRandomId(), title: "", isActive: true, type: 0 };
        setData(prevData => [newHeader, ...prevData]);
    }, []);
    
    // --- Server-Side Data Fetching (Replaces real-time listener) ---
    const fetchLinksFromServer = useCallback(async () => {
        if (!currentUser) return;
        
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/user/links', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch links');
            }

            const result = await response.json();
            const fetchedLinks = result.links || [];
            
            // Mark this as a server update to prevent saving loop
            isServerUpdate.current = true;
            setData(fetchedLinks);
            lastSavedData.current = JSON.stringify(fetchedLinks);
            
            console.log('✅ Links loaded from server:', fetchedLinks.length);
            
        } catch (error) {
            console.error("Error fetching links:", error);
            toast.error(translations.loadingError);
        } finally {
            setIsLoading(false);
            hasInitiallyLoaded.current = true;
            // Reset the server update flag after a brief delay
            setTimeout(() => {
                isServerUpdate.current = false;
            }, 100);
        }
    }, [currentUser, translations.loadingError]);

    // --- API Call to Save Data ---
    const saveLinksToServer = useCallback(async (linksToSave) => {
        if (!currentUser) return;
        
        console.log('💾 Saving links to server...', linksToSave.length);
        setIsSaving(true);
        
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/user/links', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ links: linksToSave })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || translations.savingError);
            }

            // Update the last saved data reference
            lastSavedData.current = JSON.stringify(linksToSave);
            toast.success(translations.linksSaved);
            console.log('✅ Links saved successfully');
            
        } catch (error) {
            console.error("❌ Error saving links:", error);
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    }, [currentUser, translations.linksSaved, translations.savingError]);

    // ✅ MOVED: Context value memoization before any early returns
    const contextValue = useMemo(() => ({
        setData,
        data,
        refreshData: fetchLinksFromServer,
        isSaving
    }), [data, fetchLinksFromServer, isSaving]);

    // --- Initial Data Fetch ---
    useEffect(() => {
        if (currentUser && isInitialized) {
            fetchLinksFromServer();
        } else if (!currentUser) {
            setData([]);
            setIsLoading(false);
            hasInitiallyLoaded.current = false;
            lastSavedData.current = null;
        }
    }, [currentUser, isInitialized, fetchLinksFromServer]);

    // --- Auto-Save Effect (Fixed Logic) ---
    useEffect(() => {
        // Guard 1: Don't save until initial data is loaded
        if (!hasInitiallyLoaded.current) {
            console.log('🔄 Skipping save - initial data not loaded yet');
            return;
        }

        // Guard 2: Don't save if this update came from the server
        if (isServerUpdate.current) {
            console.log('🔄 Skipping save - server update detected');
            return;
        }

        // Guard 3: Check if data actually changed from last saved state
        const currentDataString = JSON.stringify(debouncedData);
        if (currentDataString === lastSavedData.current) {
            console.log('🔄 Skipping save - no changes detected');
            return;
        }

        // If we get here, it's a real user change that needs saving
        console.log('💾 User change detected, saving to server...');
        saveLinksToServer(debouncedData);
        
    }, [debouncedData, saveLinksToServer]);

    // --- Render Logic ---
    if (!isInitialized) {
        return (
            <div className="h-full flex-col gap-4 py-1 flex sm:px-2 px-1">
                <div className="h-12 bg-gray-200 rounded-3xl animate-pulse"></div>
                <div className="h-10 w-32 bg-gray-200 rounded-3xl animate-pulse mx-auto mt-3"></div>
            </div>
        );
    }

    return (
        <ManageLinksContent.Provider value={contextValue}>
            <div className="h-full flex-col gap-4 py-1 flex sm:px-2 px-1">
                <AddBtn onAddItem={addLinkItem} />
                
                <div className="flex items-center gap-3 justify-center rounded-3xl cursor-pointer active:scale-95 hover:scale-[1.005] border hover:bg-black/5 w-fit text-sm p-3 mt-3" onClick={addHeaderItem}>
                    <Image src={"https://linktree.sirv.com/Images/icons/add.svg"} alt="add header" height={15} width={15} />
                    <span>{translations.addHeader}</span>
                </div>
                
                {/* ✅ IMPROVED: Better saving indicator */}
                {isSaving && (
                    <div className="text-center text-sm text-blue-600 animate-pulse flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                        Saving links...
                    </div>
                )}

                {/* Loading state */}
                {isLoading && (
                    <div className="text-center text-gray-500 py-10 flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                        Loading links...
                    </div>
                )}
                
                {/* Links list */}
                {!isLoading && hasInitiallyLoaded.current && data.length > 0 && (
                    <DraggableList array={data} />
                )}

                {/* Empty state */}
                {!isLoading && hasInitiallyLoaded.current && data.length === 0 && (
                    <div className="p-6 flex-col gap-4 flex items-center justify-center opacity-30">
                        <Image src={"https://linktree.sirv.com/Images/logo-icon.svg"} alt="logo" height={100} width={100} className="opacity-50 sm:w-24 w-16" />
                        <span className="text-center sm:text-base text-sm max-w-[15rem] font-semibold">{translations.emptyStateTitle}</span>
                        <span className="text-center sm:text-base text-sm max-w-[15rem] opacity-70">{translations.emptyStateSubtitle}</span>
                    </div>
                )}
            </div>
        </ManageLinksContent.Provider>
    );
}