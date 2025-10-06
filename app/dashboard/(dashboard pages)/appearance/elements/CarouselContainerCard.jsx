// app/dashboard/(dashboard pages)/appearance/elements/CarouselContainerCard.jsx
"use client"

import React, { useState, useEffect, useCallback } from "react";
import { FaPlus, FaToggleOn, FaToggleOff, FaEdit, FaSave, FaTimes, FaExternalLinkAlt, FaImages, FaVideo } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import CarouselItemCard from "./CarouselItemCard";
import CarouselPreview from "../components/CarouselPreview";
import { CAROUSEL_STYLES } from "@/lib/services/constants";
import ColorPickerFlat from "./ColorPickerFlat.jsx";
import { AppearanceService } from "@/lib/services/serviceAppearance/client/appearanceService.js";
import { LinksService } from "@/lib/services/serviceLinks/client/LinksService.js";

const BACKGROUND_TYPES = ['Color', 'Image', 'Video', 'Transparent'];

function formatStyleName(style) {
    return style.charAt(0).toUpperCase() + style.slice(1);
}

export default function CarouselContainerCard({ carousel, onUpdate, onDelete, disabled, highlightId }) {
    const router = useRouter();
    const [localData, setLocalData] = useState(carousel);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [isHighlighted, setIsHighlighted] = useState(false);
    const [isUploadingBackgroundImage, setIsUploadingBackgroundImage] = useState(false);
    const [isUploadingBackgroundVideo, setIsUploadingBackgroundVideo] = useState(false);

    useEffect(() => {
        setLocalData(carousel);
    }, [carousel]);

    const hasItems = Array.isArray(localData.items) && localData.items.length > 0;
    const backgroundType = localData.backgroundType || 'Color';
    const enableBlocked = !localData.enabled && !hasItems;

    const commitUpdate = useCallback((updates) => {
        setLocalData((prev) => {
            const updated = { ...prev, ...updates };
            onUpdate(updated);
            return updated;
        });
    }, [onUpdate]);

    const syncLinkActiveState = useCallback(async (enabled) => {
        try {
            const linksData = await LinksService.getLinks(true);
            const links = linksData?.links || [];
            let didChange = false;
            const updatedLinks = links.map(link => {
                if (link.type === 2 && link.carouselId === carousel.id) {
                    if (link.isActive !== enabled) {
                        didChange = true;
                        return { ...link, isActive: enabled };
                    }
                }
                return link;
            });

            if (didChange) {
                await LinksService.saveLinks(updatedLinks);
            }
        } catch (error) {
            console.error('Error synchronising carousel link state:', error);
        }
    }, [carousel.id]);

    // Highlight effect when navigated from links page
    useEffect(() => {
        if (highlightId && highlightId === carousel.id) {
            setIsHighlighted(true);
            const timer = setTimeout(() => setIsHighlighted(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [highlightId, carousel.id]);

    // Toggle carousel enabled/disabled
    const handleToggleEnabled = () => {
        const nextEnabled = !localData.enabled;
        if (nextEnabled && !hasItems) {
            toast.error('Add at least one carousel item before enabling.');
            return;
        }
        commitUpdate({ enabled: nextEnabled });
        syncLinkActiveState(nextEnabled);
        toast.success(nextEnabled ? 'Carousel enabled' : 'Carousel disabled');
    };

    // Update carousel title
    const handleSaveTitle = () => {
        if (!localData.title.trim()) {
            toast.error('Title cannot be empty');
            return;
        }
        const trimmedTitle = localData.title.trim();
        commitUpdate({ title: trimmedTitle });
        setIsEditingTitle(false);
        toast.success('Title updated');
    };

    const handleCancelTitle = () => {
        setLocalData(carousel);
        setIsEditingTitle(false);
    };

    // Add new item to this carousel
    const handleAddItem = () => {
        const newItem = {
            id: `carousel_item_${Date.now()}`,
            image: '',
            title: 'New Item',
            description: 'Click to edit this item',
            category: '',
            link: '',
            author: '',
            readTime: '',
            videoUrl: '',
            order: localData.items.length
        };

        const updatedItems = [...(localData.items || []), newItem];
        commitUpdate({ items: updatedItems });
        toast.success('Item added');
    };

    // Update an item within this carousel
    const handleUpdateItem = (itemId, updatedData) => {
        const updatedItems = (localData.items || []).map(item =>
            item.id === itemId ? { ...item, ...updatedData } : item
        );
        commitUpdate({ items: updatedItems });
    };

    // Delete an item from this carousel
    const handleDeleteItem = (itemId) => {
        const updatedItems = (localData.items || [])
            .filter(item => item.id !== itemId)
            .map((item, index) => ({ ...item, order: index }));

        const disabledDueToEmpty = localData.enabled && updatedItems.length === 0;
        commitUpdate({
            items: updatedItems,
            ...(disabledDueToEmpty ? { enabled: false } : {})
        });

        toast.success('Item removed');
        if (disabledDueToEmpty) {
            toast('Carousel disabled because it has no items.', {
                icon: 'ℹ️'
            });
            syncLinkActiveState(false);
        }
    };

    // Change carousel style
    const handleStyleChange = (style) => {
        if (localData.style === style) return;
        commitUpdate({ style });
        toast.success(`Style set to ${formatStyleName(style)}`);
    };

    const handleBackgroundTypeChange = (type) => {
        if (!BACKGROUND_TYPES.includes(type)) return;
        if (type === 'Color') {
            commitUpdate({
                backgroundType: 'Color',
                backgroundColor: localData.backgroundColor || '#FFFFFF',
                backgroundImage: '',
                backgroundVideo: ''
            });
            return;
        }

        if (type === 'Image') {
            commitUpdate({
                backgroundType: 'Image',
                backgroundVideo: ''
            });
        } else if (type === 'Video') {
            commitUpdate({
                backgroundType: 'Video',
                backgroundImage: ''
            });
        } else if (type === 'Transparent') {
            commitUpdate({
                backgroundType: 'Transparent',
                backgroundColor: 'transparent',
                backgroundImage: '',
                backgroundVideo: ''
            });
            return;
        }
    };

    const handleBackgroundColorChange = (color) => {
        commitUpdate({
            backgroundType: 'Color',
            backgroundColor: color,
            backgroundImage: '',
            backgroundVideo: ''
        });
    };

    const handleBackgroundImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            setIsUploadingBackgroundImage(true);
            const result = await AppearanceService.uploadCarouselBackgroundImage(file);
            if (result?.downloadURL) {
                commitUpdate({
                    backgroundType: 'Image',
                    backgroundImage: result.downloadURL,
                    backgroundVideo: ''
                });
                toast.success('Background image updated');
            }
        } catch (error) {
            console.error('Error uploading carousel background image:', error);
            toast.error(error.message || 'Failed to upload background image');
        } finally {
            setIsUploadingBackgroundImage(false);
            if (event.target) {
                event.target.value = '';
            }
        }
    };

    const handleBackgroundVideoUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            setIsUploadingBackgroundVideo(true);
            const result = await AppearanceService.uploadCarouselBackgroundVideo(file);
            if (result?.downloadURL) {
                commitUpdate({
                    backgroundType: 'Video',
                    backgroundVideo: result.downloadURL,
                    backgroundImage: ''
                });
                toast.success('Background video updated');
            }
        } catch (error) {
            console.error('Error uploading carousel background video:', error);
            toast.error(error.message || 'Failed to upload background video');
        } finally {
            setIsUploadingBackgroundVideo(false);
            if (event.target) {
                event.target.value = '';
            }
        }
    };

    const handleRemoveBackgroundAsset = (type) => {
        if (type === 'Image') {
            commitUpdate({
                backgroundImage: '',
                backgroundType: 'Color'
            });
            toast.success('Background image removed');
        } else if (type === 'Video') {
            commitUpdate({
                backgroundVideo: '',
                backgroundType: 'Color'
            });
            toast.success('Background video removed');
        }
    };

    // Navigate to linked link item
    const handleGoToLink = () => {
        router.push(`/dashboard#carousel-${carousel.id}`);
    };

    // Delete entire carousel
    const handleDeleteCarousel = () => {
        if (confirm('Are you sure you want to delete this entire carousel? This will also remove the link item.')) {
            onDelete();
        }
    };

    return (
        <div
            className={`w-full bg-white rounded-2xl p-6 border-2 transition-all ${
                isHighlighted
                    ? 'border-blue-500 shadow-lg shadow-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
            }`}
            id={`carousel-${carousel.id}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                    {isEditingTitle ? (
                        <div className="flex items-center gap-2 flex-1">
                            <input
                                type="text"
                                value={localData.title}
                                onChange={(e) => setLocalData({ ...localData, title: e.target.value })}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Carousel Title"
                                maxLength={50}
                            />
                            <button
                                onClick={handleSaveTitle}
                                className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200"
                            >
                                <FaSave />
                            </button>
                            <button
                                onClick={handleCancelTitle}
                                className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                            >
                                <FaTimes />
                            </button>
                        </div>
                    ) : (
                        <>
                            <h3 className="text-xl font-semibold">{localData.title}</h3>
                            <button
                                onClick={() => setIsEditingTitle(true)}
                                disabled={disabled}
                                className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                            >
                                <FaEdit />
                            </button>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Go to Link button */}
                    <button
                        onClick={handleGoToLink}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                    >
                        <FaExternalLinkAlt />
                        <span>Go to Link</span>
                    </button>

                    {/* Enable/Disable Toggle */}
                    <button
                        onClick={handleToggleEnabled}
                        disabled={disabled || enableBlocked}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            localData.enabled
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : enableBlocked
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {localData.enabled ? <FaToggleOn className="text-xl" /> : <FaToggleOff className="text-xl" />}
                        <span className="text-sm font-medium">
                            {localData.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </button>
                    {enableBlocked && (
                        <p className="text-xs text-gray-500 text-right">
                            Add carousel items to enable
                        </p>
                    )}

                    {/* Preview Toggle */}
                    {localData.items.length > 0 && (
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                            {showPreview ? 'Hide Preview' : 'Preview'}
                        </button>
                    )}
                </div>
            </div>

            {/* Preview */}
            {showPreview && localData.items.length > 0 && (
                <div className="mb-6">
                    <CarouselPreview
                        items={localData.items}
                        style={localData.style}
                        backgroundType={backgroundType}
                        backgroundColor={localData.backgroundColor}
                        backgroundImage={localData.backgroundImage}
                        backgroundVideo={localData.backgroundVideo}
                    />
                </div>
            )}

            {/* Style Selector */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                    Carousel Style
                </label>
                <div className="flex gap-3 flex-wrap">
                    {Object.values(CAROUSEL_STYLES).map((style) => (
                        <button
                            key={style}
                            onClick={() => handleStyleChange(style)}
                            disabled={disabled}
                            className={`px-4 py-2 rounded-lg border-2 transition-all capitalize ${
                                localData.style === style
                                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                            }`}
                        >
                            {formatStyleName(style)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Background Customization */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                    Carousel Background
                </label>

                <div className="flex flex-wrap gap-2 mb-4">
                    {BACKGROUND_TYPES.map((type) => (
                        <button
                            key={type}
                            onClick={() => handleBackgroundTypeChange(type)}
                            disabled={disabled}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                backgroundType === type
                                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {backgroundType === 'Color' && (
                    <ColorPickerFlat
                        currentColor={localData.backgroundColor || '#FFFFFF'}
                        onColorChange={handleBackgroundColorChange}
                        disabled={disabled}
                        fieldName="Carousel Background"
                    />
                )}

                {backgroundType === 'Image' && (
                    <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <FaImages /> Background Image
                            </span>
                            {localData.backgroundImage && (
                                <button
                                    onClick={() => handleRemoveBackgroundAsset('Image')}
                                    disabled={disabled}
                                    className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                        {localData.backgroundImage ? (
                            <div className="relative">
                                <img
                                    src={localData.backgroundImage}
                                    alt="Carousel background"
                                    className="w-full max-h-48 object-cover rounded-lg border"
                                />
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500">
                                Upload an image to use as the carousel background.
                            </p>
                        )}
                        <div>
                            <label className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer bg-white hover:bg-gray-100'}`}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleBackgroundImageUpload}
                                    disabled={disabled || isUploadingBackgroundImage}
                                    className="hidden"
                                />
                                {isUploadingBackgroundImage ? 'Uploading...' : 'Upload Image'}
                            </label>
                        </div>
                    </div>
                )}

                {backgroundType === 'Video' && (
                    <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <FaVideo /> Background Video
                            </span>
                            {localData.backgroundVideo && (
                                <button
                                    onClick={() => handleRemoveBackgroundAsset('Video')}
                                    disabled={disabled}
                                    className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                        {localData.backgroundVideo ? (
                            <video
                                src={localData.backgroundVideo}
                                controls
                                className="w-full max-h-48 rounded-lg border"
                            />
                        ) : (
                            <p className="text-xs text-gray-500">
                                Upload a video to use as the carousel background.
                            </p>
                        )}
                        <div>
                            <label className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer bg-white hover:bg-gray-100'}`}>
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={handleBackgroundVideoUpload}
                                    disabled={disabled || isUploadingBackgroundVideo}
                                    className="hidden"
                                />
                                {isUploadingBackgroundVideo ? 'Uploading...' : 'Upload Video'}
                            </label>
                        </div>
                    </div>
                )}

                {backgroundType === 'Transparent' && (
                    <div className="p-4 border rounded-lg bg-gray-50 text-sm text-gray-600">
                        Carousel background will be transparent and inherit the page background. Remove any uploaded media automatically.
                    </div>
                )}
            </div>

            {/* Items List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700">
                        Carousel Items ({localData.items.length})
                    </h4>
                    <button
                        onClick={handleAddItem}
                        disabled={disabled}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <FaPlus />
                        <span className="text-sm font-medium">Add Item</span>
                    </button>
                </div>

                {localData.items.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <p className="text-gray-500">No items yet. Add your first item to get started!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {localData.items
                            .sort((a, b) => a.order - b.order)
                            .map((item) => (
                                <CarouselItemCard
                                    key={item.id}
                                    item={item}
                                    onUpdate={(updatedData) => handleUpdateItem(item.id, updatedData)}
                                    onDelete={() => handleDeleteItem(item.id)}
                                    disabled={disabled}
                                />
                            ))}
                    </div>
                )}
            </div>

            {/* Delete Carousel Button */}
            <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                    onClick={handleDeleteCarousel}
                    disabled={disabled}
                    className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                >
                    Delete Entire Carousel
                </button>
            </div>
        </div>
    );
}
