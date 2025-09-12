/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
"use client";

import React, { useEffect, useState, useMemo, useCallback, createContext, useRef } from "react";
import Image from "next/image";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useDebounce } from "@/LocalHooks/useDebounce";
import { generateRandomId } from "@/lib/utilities";
import { toast } from "react-hot-toast";
import AddBtn from "../general elements/addBtn";
import DraggableList from "./Drag";

// ✅ IMPORT THE NEW SERVICES AND CONTEXT
import { useDashboard } from '@/app/dashboard/DashboardContext.js';
import { LinksService } from '@/lib/services/client/link/serviceLinks/LinksService.js';

export const ManageLinksContent = createContext(null);

export default function ManageLinks() {
    const { t, isInitialized } = useTranslation();
    const { currentUser, isLoading: isSessionLoading } = useDashboard(); // Get global session
    
    // Page-specific state
    const [data, setData] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingLinks, setIsLoadingLinks] = useState(true);
    
    const hasInitiallyLoaded = useRef(false);
    const lastSavedData = useRef(null);
    const isServerUpdate = useRef(false);
    const debouncedData = useDebounce(data, 1500);

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

    const addLinkItem = useCallback(() => {
        const newLink = { 
            id: generateRandomId(), 
            title: "", 
            url: "", 
            urlKind: "", 
            isActive: true, 
            type: 1 
        };
        setData(prevData => [newLink, ...prevData]);
    }, []);

    const addHeaderItem = useCallback(() => {
        const newHeader = { 
            id: generateRandomId(), 
            title: "", 
            isActive: true, 
            type: 0 
        };
        setData(prevData => [newHeader, ...prevData]);
    }, []);

    // ✅ REFACTORED API CALLS to use the client-side service
    const fetchLinksFromServer = useCallback(async () => {
        if (!currentUser) return;
        
        setIsLoadingLinks(true);
        try {
            const result = await LinksService.getLinks();
            isServerUpdate.current = true;
            setData(result.links || []);
            lastSavedData.current = JSON.stringify(result.links || []);
        } catch (error) {
            console.error("Error fetching links:", error);
            toast.error(translations.loadingError);
        } finally {
            setIsLoadingLinks(false);
            hasInitiallyLoaded.current = true;
            setTimeout(() => { isServerUpdate.current = false; }, 100);
        }
    }, [currentUser, translations.loadingError]);

    const saveLinksToServer = useCallback(async (linksToSave) => {
        if (!currentUser) return;
        
        setIsSaving(true);
        try {
            await LinksService.saveLinks(linksToSave);
            lastSavedData.current = JSON.stringify(linksToSave);
            toast.success(translations.linksSaved);
        } catch (error) {
            console.error("Error saving links:", error);
            toast.error(error.message || translations.savingError);
        } finally {
            setIsSaving(false);
        }
    }, [currentUser, translations.linksSaved, translations.savingError]);

    // Context value for child components
    const contextValue = useMemo(() => ({
        setData,
        data,
        refreshData: fetchLinksFromServer,
        isSaving
    }), [data, fetchLinksFromServer, isSaving]);

    // Effects
    useEffect(() => {
        if (currentUser && isInitialized) {
            fetchLinksFromServer();
        }
    }, [currentUser, isInitialized, fetchLinksFromServer]);

    useEffect(() => {
        if (!hasInitiallyLoaded.current || isServerUpdate.current) return;
        const currentDataString = JSON.stringify(debouncedData);
        if (currentDataString === lastSavedData.current) return;
        saveLinksToServer(debouncedData);
    }, [debouncedData, saveLinksToServer]);

    // Combined loading state - wait for both session and links data
    if (isSessionLoading || isLoadingLinks) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <span className="ml-3 text-gray-600">Loading your links...</span>
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
                
                {/* Improved saving indicator */}
                {isSaving && (
                    <div className="text-center text-sm text-blue-600 animate-pulse flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                        Saving links...
                    </div>
                )}

                {/* Links list */}
                {hasInitiallyLoaded.current && data.length > 0 && (
                    <DraggableList array={data} />
                )}

                {/* Empty state */}
                {hasInitiallyLoaded.current && data.length === 0 && (
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