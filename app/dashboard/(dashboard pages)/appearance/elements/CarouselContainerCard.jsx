// app/dashboard/(dashboard pages)/appearance/elements/CarouselContainerCard.jsx
"use client"

import React, { useState, useEffect } from "react";
import { FaPlus, FaToggleOn, FaToggleOff, FaEdit, FaSave, FaTimes, FaExternalLinkAlt } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import CarouselItemCard from "./CarouselItemCard";
import CarouselPreview from "../components/CarouselPreview";
import { CAROUSEL_STYLES } from "@/lib/services/constants";

export default function CarouselContainerCard({ carousel, onUpdate, onDelete, disabled, highlightId }) {
    const router = useRouter();
    const [localData, setLocalData] = useState(carousel);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [isHighlighted, setIsHighlighted] = useState(false);

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
        const updatedCarousel = { ...localData, enabled: !localData.enabled };
        setLocalData(updatedCarousel);
        onUpdate(updatedCarousel);
        toast.success(updatedCarousel.enabled ? 'Carousel enabled' : 'Carousel disabled');
    };

    // Update carousel title
    const handleSaveTitle = () => {
        if (!localData.title.trim()) {
            toast.error('Title cannot be empty');
            return;
        }
        onUpdate(localData);
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

        const updatedItems = [...localData.items, newItem];
        const updatedCarousel = { ...localData, items: updatedItems };
        setLocalData(updatedCarousel);
        onUpdate(updatedCarousel);
        toast.success('Item added');
    };

    // Update an item within this carousel
    const handleUpdateItem = (itemId, updatedData) => {
        const updatedItems = localData.items.map(item =>
            item.id === itemId ? { ...item, ...updatedData } : item
        );
        const updatedCarousel = { ...localData, items: updatedItems };
        setLocalData(updatedCarousel);
        onUpdate(updatedCarousel);
    };

    // Delete an item from this carousel
    const handleDeleteItem = (itemId) => {
        const updatedItems = localData.items
            .filter(item => item.id !== itemId)
            .map((item, index) => ({ ...item, order: index }));
        const updatedCarousel = { ...localData, items: updatedItems };
        setLocalData(updatedCarousel);
        onUpdate(updatedCarousel);
    };

    // Change carousel style
    const handleStyleChange = (style) => {
        const updatedCarousel = { ...localData, style };
        setLocalData(updatedCarousel);
        onUpdate(updatedCarousel);
        toast.success('Style updated');
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
                        disabled={disabled}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            localData.enabled
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {localData.enabled ? <FaToggleOn className="text-xl" /> : <FaToggleOff className="text-xl" />}
                        <span className="text-sm font-medium">
                            {localData.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </button>

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
                    <CarouselPreview items={localData.items} style={localData.style} />
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
                            {style}
                        </button>
                    ))}
                </div>
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
