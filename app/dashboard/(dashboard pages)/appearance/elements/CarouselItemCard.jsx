// app/dashboard/(dashboard pages)/appearance/elements/CarouselItemCard.jsx
"use client"

import React, { useState, useRef } from "react";
import Image from "next/image";
import { FaTrash, FaEdit, FaSave, FaTimes, FaImage, FaPlay, FaGripVertical } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { AppearanceService } from "@/lib/services/serviceAppearance/client/appearanceService";

export default function CarouselItemCard({ item, onUpdate, onDelete, disabled }) {
    const [isEditing, setIsEditing] = useState(false);
    const [localData, setLocalData] = useState(item);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const fileInputRef = useRef(null);

    // Handle field changes
    const handleChange = (field, value) => {
        setLocalData(prev => ({ ...prev, [field]: value }));
    };

    // Handle image upload
    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            toast.error('Image too large (max 5MB)');
            return;
        }

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        setIsUploadingImage(true);

        try {
            // Use AppearanceService to upload (handles auth token automatically)
            const result = await AppearanceService.uploadCarouselImage(file);

            // Update local data with uploaded image URL
            handleChange('image', result.downloadURL);
            toast.success('Image uploaded successfully');
        } catch (error) {
            console.error('Image upload error:', error);
            toast.error(error.message || 'Failed to upload image');
        } finally {
            setIsUploadingImage(false);
        }
    };

    // Save changes
    const handleSave = () => {
        // Validate required fields
        if (!localData.title.trim()) {
            toast.error('Title is required');
            return;
        }

        onUpdate(localData);
        setIsEditing(false);
        toast.success('Item updated');
    };

    // Cancel editing
    const handleCancel = () => {
        setLocalData(item); // Reset to original data
        setIsEditing(false);
    };

    // Delete item
    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this carousel item?')) {
            onDelete();
        }
    };

    return (
        <div className="border-2 border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 transition-colors">
            {/* Header with drag handle and actions */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <FaGripVertical className="text-gray-400 cursor-grab" />
                    <h5 className="font-semibold text-gray-800">
                        {isEditing ? 'Editing Item' : localData.title || 'Untitled'}
                    </h5>
                </div>

                <div className="flex items-center gap-2">
                    {!isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(true)}
                                disabled={disabled}
                                className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                                title="Edit"
                            >
                                <FaEdit />
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={disabled}
                                className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                                title="Delete"
                            >
                                <FaTrash />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleSave}
                                disabled={disabled}
                                className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors"
                                title="Save"
                            >
                                <FaSave />
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={disabled}
                                className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                                title="Cancel"
                            >
                                <FaTimes />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column - Image */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Image
                        </label>
                        <div className="relative w-full h-40 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50 hover:border-gray-400 transition-colors">
                            {localData.image ? (
                                <Image
                                    src={localData.image}
                                    alt={localData.title}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                    <FaImage className="text-4xl" />
                                </div>
                            )}

                            {isUploadingImage && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                </div>
                            )}

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploadingImage}
                                className="absolute bottom-2 right-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                                Upload
                            </button>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                        />
                    </div>

                    {/* Right Column - Details */}
                    <div className="space-y-3">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title *
                            </label>
                            <input
                                type="text"
                                value={localData.title}
                                onChange={(e) => handleChange('title', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Best tools used in UX/UI Designers"
                                maxLength={100}
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Category
                            </label>
                            <input
                                type="text"
                                value={localData.category}
                                onChange={(e) => handleChange('category', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Career, Design, Tech..."
                                maxLength={50}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                value={localData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                placeholder="A brief summary of the content..."
                                rows={3}
                                maxLength={200}
                            />
                        </div>
                    </div>

                    {/* Full Width - Additional Fields */}
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Link URL */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Link URL
                            </label>
                            <input
                                type="url"
                                value={localData.link}
                                onChange={(e) => handleChange('link', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="https://example.com/article"
                            />
                        </div>

                        {/* Author */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Author
                            </label>
                            <input
                                type="text"
                                value={localData.author}
                                onChange={(e) => handleChange('author', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Olivia"
                                maxLength={50}
                            />
                        </div>

                        {/* Read Time */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Read Time
                            </label>
                            <input
                                type="text"
                                value={localData.readTime}
                                onChange={(e) => handleChange('readTime', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="3 MIN READ"
                                maxLength={20}
                            />
                        </div>
                    </div>

                    {/* Video URL (optional - shows play icon) */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <FaPlay className="text-blue-600" />
                            Video URL (optional - displays play icon on card)
                        </label>
                        <input
                            type="url"
                            value={localData.videoUrl}
                            onChange={(e) => handleChange('videoUrl', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="https://youtube.com/watch?v=..."
                        />
                    </div>
                </div>
            ) : (
                // Preview Mode
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Image Preview */}
                    <div className="relative w-full h-40 bg-gray-100 rounded-lg overflow-hidden">
                        {localData.image ? (
                            <>
                                <Image
                                    src={localData.image}
                                    alt={localData.title}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                />
                                {localData.videoUrl && (
                                    <div className="absolute top-2 left-2 bg-white bg-opacity-90 rounded-full p-2">
                                        <FaPlay className="text-blue-600" />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                <FaImage className="text-4xl" />
                            </div>
                        )}
                    </div>

                    {/* Details Preview */}
                    <div className="space-y-2">
                        {localData.category && (
                            <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                {localData.category}
                            </span>
                        )}
                        <h4 className="font-semibold text-gray-900">{localData.title}</h4>
                        {localData.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">{localData.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                            {localData.author && <span>{localData.author}</span>}
                            {localData.readTime && <span>• {localData.readTime}</span>}
                        </div>
                        {localData.link && (
                            <a
                                href={localData.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                            >
                                {localData.link.substring(0, 50)}...
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
