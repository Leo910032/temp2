// app/dashboard/(dashboard pages)/appearance/components/VideoEmbedManager.jsx
"use client"

import React, { useMemo, useContext } from "react";
import { FaPlus, FaToggleOn, FaToggleOff } from "react-icons/fa6";
import { toast } from "react-hot-toast";
import { useTranslation } from "@/lib/translation/useTranslation";
import { AppearanceContext } from "../AppearanceContext";
import VideoEmbedCard from "../elements/VideoEmbedCard";
import { getMaxVideoEmbedItems } from "@/lib/services/constants";
import { useDashboard } from "@/app/dashboard/DashboardContext";
import { LinksService } from "@/lib/services/serviceLinks/client/LinksService";
import { generateRandomId } from "@/lib/utilities";

export default function VideoEmbedManager() {
    const { t, isInitialized } = useTranslation();
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);
    const { subscriptionLevel } = useDashboard();

    // Get user's subscription level and max items
    const userSubscriptionLevel = subscriptionLevel || 'base';
    const maxItems = getMaxVideoEmbedItems(userSubscriptionLevel);

    // Video embed state from appearance
    const videoEmbedEnabled = appearance?.videoEmbedEnabled || false;
    const videoEmbedItems = appearance?.videoEmbedItems || [];

    // 🔍 DEBUG: Log video embed state and permission checks
    console.log('🎬 [VideoEmbedManager] Debug Info:', {
        userSubscriptionLevel,
        maxItems,
        currentItemCount: videoEmbedItems.length,
        videoEmbedEnabled,
        canAddMore: videoEmbedItems.length < maxItems,
        isSaving,
        buttonWillBeDisabled: isSaving || videoEmbedItems.length >= maxItems
    });

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.appearance.video_embed.title') || 'Video Embed',
            description: t('dashboard.appearance.video_embed.description') || 'Embed videos from YouTube or Vimeo directly on your profile.',
            enabled: t('dashboard.appearance.video_embed.enabled') || 'Enabled',
            disabled: t('dashboard.appearance.video_embed.disabled') || 'Disabled',
            addItem: t('dashboard.appearance.video_embed.add_item') || 'Add Video',
            maxReached: t('dashboard.appearance.video_embed.max_reached') || 'Maximum videos reached',
            noItems: t('dashboard.appearance.video_embed.no_items') || 'No videos yet. Add your first video to get started!',
        };
    }, [t, isInitialized]);

    // Toggle video embed enabled/disabled
    const handleToggleVideoEmbed = () => {
        updateAppearance('videoEmbedEnabled', !videoEmbedEnabled);
        toast.success(videoEmbedEnabled ? 'Video embed disabled' : 'Video embed enabled');
    };

    // Add new video embed item
    const handleAddItem = async () => {
        if (videoEmbedItems.length >= maxItems) {
            toast.error(`Maximum ${maxItems} video${maxItems > 1 ? 's' : ''} allowed for your plan`);
            return;
        }

        const videoEmbedItemId = `video_embed_${Date.now()}`;

        const newItem = {
            id: videoEmbedItemId,
            title: 'New Video',
            url: '',
            platform: 'youtube',
            description: '',
            order: videoEmbedItems.length
        };

        const updatedItems = [...videoEmbedItems, newItem];
        updateAppearance('videoEmbedItems', updatedItems);

        // Also create the corresponding link item
        try {
            const links = await LinksService.getLinks();
            const existingLinks = links.links || [];

            const newLinkItem = {
                id: generateRandomId(),
                title: "Video Embed",
                isActive: true,
                type: 4,
                videoEmbedItemId: videoEmbedItemId // Link to the video embed item
            };

            // Add the new link to the beginning of the list
            const updatedLinks = [newLinkItem, ...existingLinks];
            await LinksService.saveLinks(updatedLinks);

            toast.success('Video embed added to both appearance and links');
        } catch (error) {
            console.error('Error creating link item:', error);
            toast.error('Video added to appearance but failed to create link item');
        }
    };

    // Update a video embed item
    const handleUpdateItem = (itemId, updatedData) => {
        const updatedItems = videoEmbedItems.map(item =>
            item.id === itemId ? { ...item, ...updatedData } : item
        );
        updateAppearance('videoEmbedItems', updatedItems);
    };

    // Delete a video embed item
    const handleDeleteItem = async (itemId) => {
        const updatedItems = videoEmbedItems
            .filter(item => item.id !== itemId)
            .map((item, index) => ({ ...item, order: index })); // Re-order
        updateAppearance('videoEmbedItems', updatedItems);

        // Also delete the corresponding link item
        try {
            const links = await LinksService.getLinks();
            const existingLinks = links.links || [];

            // Find and remove the link item that references this video embed item
            const updatedLinks = existingLinks.filter(link =>
                !(link.type === 4 && link.videoEmbedItemId === itemId)
            );

            if (updatedLinks.length !== existingLinks.length) {
                // A link was removed, save the updated links
                await LinksService.saveLinks(updatedLinks);
                toast.success('Video deleted from both appearance and links');
            } else {
                toast.success('Video deleted');
            }
        } catch (error) {
            console.error('Error deleting link item:', error);
            toast.success('Video deleted from appearance');
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
                        onClick={handleToggleVideoEmbed}
                        disabled={isSaving}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            videoEmbedEnabled
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {videoEmbedEnabled ? <FaToggleOn className="text-xl" /> : <FaToggleOff className="text-xl" />}
                        <span className="text-sm font-medium">
                            {videoEmbedEnabled ? translations.enabled : translations.disabled}
                        </span>
                    </button>
                </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-6">
                {translations.description}
            </p>

            {/* Video embed items list */}
            {videoEmbedEnabled && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-700">
                            Video Embeds ({videoEmbedItems.length}/{maxItems})
                        </h4>
                        <button
                            onClick={handleAddItem}
                            disabled={isSaving || videoEmbedItems.length >= maxItems}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                videoEmbedItems.length >= maxItems
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                            }`}
                        >
                            <FaPlus />
                            <span className="text-sm font-medium">{translations.addItem}</span>
                        </button>
                    </div>

                    {videoEmbedItems.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <p className="text-gray-500">{translations.noItems}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {videoEmbedItems
                                .sort((a, b) => a.order - b.order)
                                .map((item) => (
                                    <div key={item.id} id={`video-item-${item.id}`} className="scroll-mt-20">
                                        <VideoEmbedCard
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
            {!videoEmbedEnabled && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500">
                        Enable video embed to start adding videos to your profile.
                    </p>
                </div>
            )}
        </div>
    );
}
