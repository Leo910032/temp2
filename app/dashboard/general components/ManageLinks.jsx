//app/dashboard/general components/ManageLinks.jsx
/**
 * THIS FILE HAS BEEN REFACTORED 
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
import { LinksService } from '@/lib/services/serviceLinks/client/LinksService.js';
import { AppearanceService } from '@/lib/services/serviceAppearance/client/appearanceService.js';
import { APPEARANCE_FEATURES, getMaxVideoEmbedItems, getMaxCarouselItems } from '@/lib/services/constants';

export const ManageLinksContent = createContext(null);

export default function ManageLinks() {
    const { t, isInitialized } = useTranslation();
    const { currentUser, isLoading: isSessionLoading, subscriptionLevel, permissions } = useDashboard(); // Get global session and subscription info
    
    // Page-specific state
    const [data, setData] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingLinks, setIsLoadingLinks] = useState(true);
    const [syncState, setSyncState] = useState('idle'); // 'idle', 'loading_cache', 'syncing_server'

    const hasInitiallyLoaded = useRef(false);
    const lastSavedData = useRef(null);
    const isServerUpdate = useRef(false);
    const unsubscribeRef = useRef(null);
    const debouncedData = useDebounce(data, 1500);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            addHeader: t('dashboard.links.add_header'),
            addCarousel: t('dashboard.links.add_carousel') || "Add Carousel",
            addCV: t('dashboard.links.add_cv') || "Add CV / Document",
            addVideoEmbed: t('dashboard.links.add_video_embed') || "Add Video Embed",
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
            isActive: false, // ✅ Start as inactive to avoid validation issues
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

    const addCarouselItem = useCallback(async () => {
        // Check subscription permission
        const canUseCarousel = permissions[APPEARANCE_FEATURES.CUSTOM_CAROUSEL];

        if (!canUseCarousel) {
            // Show upgrade prompt for users without permission
            const requiredTier = subscriptionLevel === 'base' ? 'Pro' : 'Pro';
            toast.error(`Upgrade to ${requiredTier} to use Content Carousel feature`, {
                duration: 4000,
                style: {
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontWeight: 'bold',
                }
            });
            return;
        }

        // Get max carousels for user's subscription level
        const maxCarousels = getMaxCarouselItems(subscriptionLevel);

        // Count existing carousel links
        const existingCarousels = data.filter(item => item.type === 2);

        if (existingCarousels.length >= maxCarousels) {
            toast.error(`Maximum ${maxCarousels} carousel link${maxCarousels > 1 ? 's' : ''} reached for ${subscriptionLevel} plan`, {
                duration: 4000,
                style: {
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontWeight: 'bold',
                }
            });
            return;
        }

        // Create a unique ID for the carousel item that will be created in appearance
        const carouselItemId = `carousel_${Date.now()}`;

        // Create the link item
        const newCarousel = {
            id: generateRandomId(),
            title: "Content Carousel",
            isActive: true,
            type: 2,
            carouselItemId: carouselItemId // Link to the carousel item in appearance
        };

        // Add to links
        setData(prevData => [newCarousel, ...prevData]);

        // Also create the corresponding carousel item in appearance
        try {
            const appearance = await AppearanceService.getAppearanceData();
            const carouselItems = appearance.carouselItems || [];

            const newCarouselItem = {
                id: carouselItemId,
                image: '',
                title: 'New Item',
                description: 'Click to edit this carousel item',
                category: '',
                link: '',
                author: '',
                readTime: '',
                videoUrl: '',
                order: carouselItems.length
            };

            await AppearanceService.updateAppearanceData({
                carouselItems: [...carouselItems, newCarouselItem],
                carouselEnabled: true // Auto-enable when adding first carousel
            });

            toast.success("Carousel link added - go to Appearance to configure carousel");
        } catch (error) {
            console.error("Error creating carousel item:", error);
            toast.error("Carousel link added but failed to create carousel item slot");
        }
    }, [data, permissions, subscriptionLevel]);

    const addCVItem = useCallback(async () => {
        // Create a unique ID for the CV item that will be created in appearance
        const cvItemId = `cv_${Date.now()}`;

        // Create the link item
        const newCV = {
            id: generateRandomId(),
            title: "CV / Document",
            isActive: true,
            type: 3,
            cvItemId: cvItemId // Link to the CV item in appearance
        };

        // Add to links
        setData(prevData => [newCV, ...prevData]);

        // Also create the corresponding CV item in appearance
        try {
            const appearance = await AppearanceService.getAppearanceData();
            const cvItems = appearance.cvItems || [];

            const newCvItem = {
                id: cvItemId,
                url: '',
                fileName: '',
                displayTitle: 'New CV Document',
                uploadDate: null,
                fileSize: 0,
                fileType: '',
                order: cvItems.length
            };

            await AppearanceService.updateAppearanceData({
                cvItems: [...cvItems, newCvItem]
            });

            toast.success("CV item added - go to Appearance to upload document");
        } catch (error) {
            console.error("Error creating CV item:", error);
            toast.error("CV link added but failed to create document slot");
        }
}, []); // <-- Dependency array is now empty

    const addVideoEmbedItem = useCallback(async () => {
        // Check subscription permission
        const canUseVideoEmbed = permissions[APPEARANCE_FEATURES.CUSTOM_VIDEO_EMBED];

        if (!canUseVideoEmbed) {
            // Show upgrade prompt for users without permission
            const requiredTier = subscriptionLevel === 'base' ? 'Pro' : 'Pro';
            toast.error(`Upgrade to ${requiredTier} to use Video Embed feature`, {
                duration: 4000,
                style: {
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontWeight: 'bold',
                }
            });
            return;
        }

        // Get max video embeds for user's subscription level
        const maxVideoEmbeds = getMaxVideoEmbedItems(subscriptionLevel);

        // Count existing video embed links
        const existingVideoEmbeds = data.filter(item => item.type === 4);

        if (existingVideoEmbeds.length >= maxVideoEmbeds) {
            toast.error(`Maximum ${maxVideoEmbeds} video embed link${maxVideoEmbeds > 1 ? 's' : ''} reached for ${subscriptionLevel} plan`, {
                duration: 4000,
                style: {
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontWeight: 'bold',
                }
            });
            return;
        }

        // Create a unique ID for the video embed item that will be created in appearance
        const videoEmbedItemId = `video_embed_${Date.now()}`;

        // Create the link item
        const newVideoEmbed = {
            id: generateRandomId(),
            title: "Video Embed",
            isActive: true,
            type: 4,
            videoEmbedItemId: videoEmbedItemId // Link to the video embed item in appearance
        };

        // Add to links
        setData(prevData => [newVideoEmbed, ...prevData]);

        // Also create the corresponding video embed item in appearance
        try {
            const appearance = await AppearanceService.getAppearanceData();
            const videoEmbedItems = appearance.videoEmbedItems || [];

            const newVideoItem = {
                id: videoEmbedItemId,
                title: 'New Video',
                url: '',
                platform: 'youtube',
                description: '',
                order: videoEmbedItems.length
            };

            await AppearanceService.updateAppearanceData({
                videoEmbedItems: [...videoEmbedItems, newVideoItem],
                videoEmbedEnabled: true // Auto-enable when adding first video
            });

            toast.success("Video embed link added - go to Appearance to configure video");
        } catch (error) {
            console.error("Error creating video embed item:", error);
            toast.error("Video link added but failed to create video item slot");
        }
    }, [data, permissions, subscriptionLevel]);

    // ✅ ENHANCED API CALLS with caching and sync
   
// ✅ ENHANCED API CALLS with proper caching
const fetchLinksFromServer = useCallback(async (forceRefresh = false) => {
    if (!currentUser) return;
    
    setIsLoadingLinks(true);
    try {
        const result = await LinksService.getLinks(forceRefresh);
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

    
useEffect(() => {
    if (!currentUser || !isInitialized) return;

    // Subscribe to links updates from LinksService
    const unsubscribe = LinksService.subscribe((updatedLinks) => {
        console.log('📡 ManageLinks: Received links update from service', updatedLinks.length, 'links');
        console.log('📡 ManageLinks: Updated links data:', updatedLinks);
        
        // Always update with fresh server data
        isServerUpdate.current = true;
        setData(updatedLinks);
        lastSavedData.current = JSON.stringify(updatedLinks);
        setTimeout(() => { isServerUpdate.current = false; }, 100);
    });

    unsubscribeRef.current = unsubscribe;

    // ✅ FIXED: Try to load from cache first, only fetch if no cache
    console.log('🔄 ManageLinks: Initializing - checking cache first');
    const cachedLinks = LinksService.getCachedLinks();
    
    if (cachedLinks) {
        console.log('📦 ManageLinks: Found cached links, using cache');
        isServerUpdate.current = true;
        setData(cachedLinks);
        lastSavedData.current = JSON.stringify(cachedLinks);
        hasInitiallyLoaded.current = true;
        setIsLoadingLinks(false);
        setTimeout(() => { isServerUpdate.current = false; }, 100);
    } else {
        console.log('🌐 ManageLinks: No cache found, fetching from server');
        fetchLinksFromServer(false); // Don't force refresh, use normal cache logic
    }

    // Cleanup subscription on unmount
    return () => {
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }
    };
}, [currentUser, isInitialized, fetchLinksFromServer]);

    // Context value for child components
    const contextValue = useMemo(() => ({
        setData,
        data,
        refreshData: fetchLinksFromServer,
        isSaving,
        // Add helper methods for child components
        updateSingleLink: async (linkId, updates) => {
            try {
                await LinksService.updateLink(linkId, updates);
            } catch (error) {
                console.error("Error updating single link:", error);
                toast.error("Failed to update link");
            }
        },
        // Add force refresh helper for debugging
        forceRefresh: async () => {
            console.log('🔄 ManageLinks: Force refreshing from database');
            LinksService.invalidateCache();
            await fetchLinksFromServer();
        }
    }), [data, fetchLinksFromServer, isSaving]);

    // ✅ ENHANCED DEBOUNCED SAVE with better sync
    useEffect(() => {
        if (!hasInitiallyLoaded.current || isServerUpdate.current) return;
        
        const currentDataString = JSON.stringify(debouncedData);
        if (currentDataString === lastSavedData.current) return;
        
        // Optimistic update - immediately mark as saving
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

                <div className="flex items-center gap-3 justify-center rounded-3xl cursor-pointer active:scale-95 hover:scale-[1.005] border border-purple-300 bg-purple-50 hover:bg-purple-100 w-fit text-sm p-3" onClick={addCarouselItem}>
                    <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                    <span className="text-purple-700 font-medium">{translations.addCarousel}</span>
                </div>

                <div className="flex items-center gap-3 justify-center rounded-3xl cursor-pointer active:scale-95 hover:scale-[1.005] border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 w-fit text-sm p-3" onClick={addCVItem}>
                    <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    <span className="text-indigo-700 font-medium">{translations.addCV}</span>
                </div>

                <div className="flex items-center gap-3 justify-center rounded-3xl cursor-pointer active:scale-95 hover:scale-[1.005] border border-red-300 bg-red-50 hover:bg-red-100 w-fit text-sm p-3" onClick={addVideoEmbedItem}>
                    <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                    <span className="text-red-700 font-medium">{translations.addVideoEmbed}</span>
                </div>
                
                {/* Improved saving indicator */}
                {isSaving && (
                    <div className="text-center text-sm text-blue-600 animate-pulse flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                        Saving links...
                    </div>
                )}

                {/* ✅ Add sync indicator for when data is being updated from server */}
                {isServerUpdate.current && (
                    <div className="text-center text-xs text-green-600 opacity-70">
                        Syncing with server...
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