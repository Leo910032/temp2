// app/dashboard/(dashboard pages)/appearance/components/MediaManager.jsx
"use client"

import React, { useMemo, useContext } from "react";
import { FaPlus, FaToggleOn, FaToggleOff } from "react-icons/fa6";
import { toast } from "react-hot-toast";
import { useTranslation } from "@/lib/translation/useTranslation";
import { AppearanceContext } from "../AppearanceContext";
import MediaCard from "../elements/MediaCard";
import { getMaxMediaItems } from "@/lib/services/constants";
import { useDashboard } from "@/app/dashboard/DashboardContext";
import { LinksService } from "@/lib/services/serviceLinks/client/LinksService";
import { generateRandomId } from "@/lib/utilities";

export default function MediaManager() {
    const { t, isInitialized } = useTranslation();
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);
    const { subscriptionLevel } = useDashboard();

    // Get user's subscription level and max items
    const userSubscriptionLevel = subscriptionLevel || 'base';
    const maxItems = getMaxMediaItems(userSubscriptionLevel);

    // Media state from appearance
    const mediaEnabled = appearance?.mediaEnabled || false;
    const mediaItems = appearance?.mediaItems || [];

    // 🔍 DEBUG: Log media state and permission checks
    console.log('🎬 [MediaManager] Debug Info:', {
        userSubscriptionLevel,
        maxItems,
        currentItemCount: mediaItems.length,
        mediaEnabled,
        canAddMore: mediaItems.length < maxItems,
        isSaving,
        buttonWillBeDisabled: isSaving || mediaItems.length >= maxItems
    });

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.appearance.media.title') || 'Media',
            description: t('dashboard.appearance.media.description') || 'Embed videos and images directly on your profile.',
            enabled: t('dashboard.appearance.media.enabled') || 'Enabled',
            disabled: t('dashboard.appearance.media.disabled') || 'Disabled',
            addItem: t('dashboard.appearance.media.add_item') || 'Add Media',
            maxReached: t('dashboard.appearance.media.max_reached') || 'Maximum media items reached',
            noItems: t('dashboard.appearance.media.no_items') || 'No media yet. Add your first media item to get started!',
        };
    }, [t, isInitialized]);

    // Toggle media enabled/disabled
    const handleToggleMedia = () => {
        updateAppearance('mediaEnabled', !mediaEnabled);
        toast.success(mediaEnabled ? 'Media disabled' : 'Media enabled');
    };

    // Add new media item
    const handleAddItem = async () => {
        if (mediaItems.length >= maxItems) {
            toast.error(`Maximum ${maxItems} media item${maxItems > 1 ? 's' : ''} allowed for your plan`);
            return;
        }

        const mediaItemId = `media_${Date.now()}`;

        const newItem = {
            id: mediaItemId,
            mediaType: 'video', // Default to video
            title: 'New Media Item',
            url: '',
            platform: 'youtube',
            description: '',
            order: mediaItems.length
        };

        const updatedItems = [...mediaItems, newItem];
        updateAppearance('mediaItems', updatedItems);

        // Also create the corresponding link item
        try {
            const links = await LinksService.getLinks();
            const existingLinks = links.links || [];

            const newLinkItem = {
                id: generateRandomId(),
                title: "Media",
                isActive: true,
                type: 4,
                mediaItemId: mediaItemId // Link to the media item
            };

            // Add the new link to the beginning of the list
            const updatedLinks = [newLinkItem, ...existingLinks];
            await LinksService.saveLinks(updatedLinks);

            toast.success('Media added to both appearance and links');
        } catch (error) {
            console.error('Error creating link item:', error);
            toast.error('Media added to appearance but failed to create link item');
        }
    };

    // Update a media item
    const handleUpdateItem = (itemId, updatedData) => {
        const updatedItems = mediaItems.map(item =>
            item.id === itemId ? { ...item, ...updatedData } : item
        );
        updateAppearance('mediaItems', updatedItems);
    };

    // Delete a media item
    const handleDeleteItem = async (itemId) => {
        const updatedItems = mediaItems
            .filter(item => item.id !== itemId)
            .map((item, index) => ({ ...item, order: index })); // Re-order
        updateAppearance('mediaItems', updatedItems);

        // Also delete the corresponding link item
        try {
            const links = await LinksService.getLinks();
            const existingLinks = links.links || [];

            // Find and remove the link item that references this media item
            const updatedLinks = existingLinks.filter(link =>
                !(link.type === 4 && link.mediaItemId === itemId)
            );

            if (updatedLinks.length !== existingLinks.length) {
                // A link was removed, save the updated links
                await LinksService.saveLinks(updatedLinks);
                toast.success('Media deleted from both appearance and links');
            } else {
                toast.success('Media deleted');
            }
        } catch (error) {
            console.error('Error deleting link item:', error);
            toast.success('Media deleted from appearance');
        }
    };

    if (!isInitialized) {
        return (
            <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6 animate-pulse">
                <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 w-full bg-gray-200 rounded mb-6"></div>
                <div className="h-32 w-full bg-gray-200 rounded"></div>
            </div>
        );
    }

    return (
        <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6">
            {/* Header with enable/disable toggle */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">{translations.title}</h3>
                    <button
                        onClick={handleToggleMedia}
                        disabled={isSaving}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            mediaEnabled
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {mediaEnabled ? <FaToggleOn className="text-xl" /> : <FaToggleOff className="text-xl" />}
                        <span className="text-sm font-medium">
                            {mediaEnabled ? translations.enabled : translations.disabled}
                        </span>
                    </button>
                </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-6">
                {translations.description}
            </p>

            {/* Media items list */}
            {mediaEnabled && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-700">
                            Media Items ({mediaItems.length}/{maxItems})
                        </h4>
                        <button
                            onClick={handleAddItem}
                            disabled={isSaving || mediaItems.length >= maxItems}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                mediaItems.length >= maxItems
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                            }`}
                        >
                            <FaPlus />
                            <span className="text-sm font-medium">{translations.addItem}</span>
                        </button>
                    </div>

                    {mediaItems.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <p className="text-gray-500">{translations.noItems}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {mediaItems
                                .sort((a, b) => a.order - b.order)
                                .map((item) => (
                                    <div key={item.id} id={`media-item-${item.id}`} className="scroll-mt-20">
                                        <MediaCard
                                            item={item}
                                            onUpdate={(updatedData) => handleUpdateItem(item.id, updatedData)}
                                            onDelete={() => handleDeleteItem(item.id)}
                                            disabled={isSaving}
                                        />
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            )}

            {/* Disabled state message */}
            {!mediaEnabled && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500">
                        Enable media to start adding videos and images to your profile.
                    </p>
                </div>
            )}
        </div>
    );
}
