// app/dashboard/(dashboard pages)/appearance/components/CarouselManager.jsx
"use client"

import React, { useState, useMemo, useContext } from "react";
import { FaPlus, FaToggleOn, FaToggleOff } from "react-icons/fa6";
import { toast } from "react-hot-toast";
import { useTranslation } from "@/lib/translation/useTranslation";
import { AppearanceContext } from "../AppearanceContext";
import CarouselItemCard from "../elements/CarouselItemCard";
import CarouselPreview from "./CarouselPreview";
import { getMaxCarouselItems, CAROUSEL_STYLES } from "@/lib/services/constants";
import { useDashboard } from "@/app/dashboard/DashboardContext";

export default function CarouselManager() {
    const { t, isInitialized } = useTranslation();
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);
    const { subscriptionLevel } = useDashboard(); // ✅ FIX: Get subscriptionLevel from DashboardContext
    const [showPreview, setShowPreview] = useState(false);

    // Get user's subscription level and max items
    const userSubscriptionLevel = subscriptionLevel || 'base';
    const maxItems = getMaxCarouselItems(userSubscriptionLevel);

    // Carousel state from appearance
    const carouselEnabled = appearance?.carouselEnabled || false;
    const carouselItems = appearance?.carouselItems || [];
    const carouselStyle = appearance?.carouselStyle || CAROUSEL_STYLES.MODERN;

    // 🔍 DEBUG: Log carousel state and permission checks
    console.log('🎠 [CarouselManager] Debug Info:', {
        userSubscriptionLevel,
        maxItems,
        currentItemCount: carouselItems.length,
        carouselEnabled,
        canAddMore: carouselItems.length < maxItems,
        isSaving,
        buttonWillBeDisabled: isSaving || carouselItems.length >= maxItems
    });

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.appearance.carousel.title') || 'Content Carousel',
            description: t('dashboard.appearance.carousel.description') || 'Showcase featured content, articles, or highlights on your profile.',
            enabled: t('dashboard.appearance.carousel.enabled') || 'Enabled',
            disabled: t('dashboard.appearance.carousel.disabled') || 'Disabled',
            addItem: t('dashboard.appearance.carousel.add_item') || 'Add Item',
            maxReached: t('dashboard.appearance.carousel.max_reached') || 'Maximum items reached',
            styleLabel: t('dashboard.appearance.carousel.style') || 'Carousel Style',
            preview: t('dashboard.appearance.carousel.preview') || 'Preview',
            noItems: t('dashboard.appearance.carousel.no_items') || 'No carousel items yet. Add your first item to get started!',
        };
    }, [t, isInitialized]);

    // Toggle carousel enabled/disabled
    const handleToggleCarousel = () => {
        updateAppearance('carouselEnabled', !carouselEnabled);
        toast.success(carouselEnabled ? 'Carousel disabled' : 'Carousel enabled');
    };

    // Add new carousel item
    const handleAddItem = () => {
        if (carouselItems.length >= maxItems) {
            toast.error(`Maximum ${maxItems} items allowed for your plan`);
            return;
        }

        const newItem = {
            id: `carousel_${Date.now()}`,
            image: '',
            title: 'New Item',
            description: 'Click to edit this carousel item',
            category: 'Label',
            link: '',
            author: '',
            readTime: '',
            videoUrl: '',
            order: carouselItems.length
        };

        const updatedItems = [...carouselItems, newItem];
        updateAppearance('carouselItems', updatedItems);
        toast.success('Carousel item added');
    };

    // Update a carousel item
    const handleUpdateItem = (itemId, updatedData) => {
        const updatedItems = carouselItems.map(item =>
            item.id === itemId ? { ...item, ...updatedData } : item
        );
        updateAppearance('carouselItems', updatedItems);
    };

    // Delete a carousel item
    const handleDeleteItem = (itemId) => {
        const updatedItems = carouselItems
            .filter(item => item.id !== itemId)
            .map((item, index) => ({ ...item, order: index })); // Re-order
        updateAppearance('carouselItems', updatedItems);
        toast.success('Item deleted');
    };

    // Reorder items (for drag-and-drop)
    const handleReorderItems = (reorderedItems) => {
        const itemsWithOrder = reorderedItems.map((item, index) => ({
            ...item,
            order: index
        }));
        updateAppearance('carouselItems', itemsWithOrder);
    };

    // Change carousel style
    const handleStyleChange = (style) => {
        updateAppearance('carouselStyle', style);
        toast.success('Style updated');
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
                        onClick={handleToggleCarousel}
                        disabled={isSaving}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            carouselEnabled
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {carouselEnabled ? <FaToggleOn className="text-xl" /> : <FaToggleOff className="text-xl" />}
                        <span className="text-sm font-medium">
                            {carouselEnabled ? translations.enabled : translations.disabled}
                        </span>
                    </button>
                </div>

                {carouselEnabled && (
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                        {showPreview ? 'Hide Preview' : translations.preview}
                    </button>
                )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-6">
                {translations.description}
            </p>

            {/* Preview */}
            {showPreview && carouselEnabled && carouselItems.length > 0 && (
                <div className="mb-6">
                    <CarouselPreview items={carouselItems} style={carouselStyle} />
                </div>
            )}

            {/* Style selector (only show if carousel is enabled) */}
            {carouselEnabled && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        {translations.styleLabel}
                    </label>
                    <div className="flex gap-3 flex-wrap">
                        {Object.values(CAROUSEL_STYLES).map((style) => (
                            <button
                                key={style}
                                onClick={() => handleStyleChange(style)}
                                disabled={isSaving}
                                className={`px-4 py-2 rounded-lg border-2 transition-all capitalize ${
                                    carouselStyle === style
                                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                }`}
                            >
                                {style}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Carousel items list */}
            {carouselEnabled && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-700">
                            Carousel Items ({carouselItems.length}/{maxItems})
                        </h4>
                        <button
                            onClick={handleAddItem}
                            disabled={isSaving || carouselItems.length >= maxItems}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                carouselItems.length >= maxItems
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            <FaPlus />
                            <span className="text-sm font-medium">{translations.addItem}</span>
                        </button>
                    </div>

                    {carouselItems.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <p className="text-gray-500">{translations.noItems}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {carouselItems
                                .sort((a, b) => a.order - b.order)
                                .map((item) => (
                                    <CarouselItemCard
                                        key={item.id}
                                        item={item}
                                        onUpdate={(updatedData) => handleUpdateItem(item.id, updatedData)}
                                        onDelete={() => handleDeleteItem(item.id)}
                                        disabled={isSaving}
                                    />
                                ))}
                        </div>
                    )}
                </div>
            )}

            {/* Disabled state message */}
            {!carouselEnabled && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500">
                        Enable the carousel to start adding content items to your profile.
                    </p>
                </div>
            )}
        </div>
    );
}
