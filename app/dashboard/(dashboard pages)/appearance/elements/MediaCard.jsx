// app/dashboard/(dashboard pages)/appearance/elements/MediaCard.jsx
"use client"

import React, { useState, useEffect } from "react";
import { FaTrash, FaEdit, FaSave, FaTimes, FaGripVertical, FaExternalLinkAlt, FaImage, FaVideo } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LinksService } from '@/lib/services/serviceLinks/client/LinksService.js';
import { AppearanceService } from '@/lib/services/serviceAppearance/client/appearanceService.js';

export default function MediaCard({ item, onUpdate, onDelete, disabled }) {
    const [isEditing, setIsEditing] = useState(false);
    const [localData, setLocalData] = useState(item);
    const [linkedLinkItem, setLinkedLinkItem] = useState(null);
    const [isHighlighted, setIsHighlighted] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const router = useRouter();

    // Find the link item that's linked to this media
    useEffect(() => {
        const findLinkedItem = async () => {
            try {
                const links = await LinksService.getLinks();
                const linkedItem = links.links?.find(link =>
                    link.type === 4 && link.mediaItemId === item.id
                );
                setLinkedLinkItem(linkedItem);
            } catch (error) {
                console.error('Error finding linked item:', error);
            }
        };

        findLinkedItem();

        // Subscribe to links changes to keep it updated
        const unsubscribe = LinksService.subscribe((updatedLinks) => {
            const linkedItem = updatedLinks.find(link =>
                link.type === 4 && link.mediaItemId === item.id
            );
            setLinkedLinkItem(linkedItem);
        });

        return () => unsubscribe();
    }, [item.id]);

    // Check for highlight parameter in URL hash
    useEffect(() => {
        const hash = window.location.hash;
        if (hash === `#media-item-${item.id}`) {
            setIsHighlighted(true);
            // Remove highlight after 3 seconds
            setTimeout(() => {
                setIsHighlighted(false);
                // Clear the hash
                window.history.replaceState(null, '', window.location.pathname);
            }, 3000);
        }
    }, [item.id]);

    // Sync localData with item prop when item changes (but only when not editing to avoid conflicts)
    useEffect(() => {
        if (!isEditing) {
            setLocalData(item);
        }
    }, [item, isEditing]);

    // Handle field changes
    const handleChange = (field, value) => {
        setLocalData(prev => ({ ...prev, [field]: value }));
    };

    // Handle media type change
    const handleMediaTypeChange = (newMediaType) => {
        setLocalData(prev => ({
            ...prev,
            mediaType: newMediaType,
            // Reset type-specific fields when switching
            ...(newMediaType === 'video' ? {
                platform: 'youtube',
                imageUrl: '',
                link: ''
            } : {
                platform: '',
                imageUrl: prev.url || '',
                link: ''
            })
        }));
    };

    // Handle image upload
    const handleImageUpload = async (file) => {
        if (!file) return;

        setIsUploading(true);
        try {
            const result = await AppearanceService.uploadFile(file, 'carouselImage');
            if (result.downloadURL) {
                handleChange('imageUrl', result.downloadURL);
                handleChange('url', result.downloadURL);
                toast.success('Image uploaded successfully');
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            toast.error('Failed to upload image');
        } finally {
            setIsUploading(false);
        }
    };

    // Extract video ID from various URL formats
    const extractVideoId = (url, platform) => {
        if (!url) return null;

        try {
            if (platform === 'youtube') {
                // Handle youtube.com/watch?v=VIDEO_ID
                const watchMatch = url.match(/[?&]v=([^&]+)/);
                if (watchMatch) return watchMatch[1];

                // Handle youtu.be/VIDEO_ID
                const shortMatch = url.match(/youtu\.be\/([^?]+)/);
                if (shortMatch) return shortMatch[1];

                // Handle youtube.com/embed/VIDEO_ID
                const embedMatch = url.match(/youtube\.com\/embed\/([^?]+)/);
                if (embedMatch) return embedMatch[1];
            } else if (platform === 'vimeo') {
                // Handle vimeo.com/VIDEO_ID
                const match = url.match(/vimeo\.com\/(\d+)/);
                if (match) return match[1];
            }
        } catch (error) {
            console.error('Error extracting video ID:', error);
        }

        return null;
    };

    // Generate embed URL
    const getEmbedUrl = () => {
        if (localData.mediaType !== 'video') return null;

        const videoId = extractVideoId(localData.url, localData.platform);
        if (!videoId) return null;

        if (localData.platform === 'youtube') {
            return `https://www.youtube.com/embed/${videoId}`;
        } else if (localData.platform === 'vimeo') {
            return `https://player.vimeo.com/video/${videoId}`;
        }

        return null;
    };

    // Save changes
    const handleSave = () => {
        // Validate based on media type
        if (localData.mediaType === 'video') {
            if (!localData.url?.trim()) {
                toast.error('Video URL is required');
                return;
            }

            if (!localData.platform) {
                toast.error('Please select a platform');
                return;
            }

            // Validate that we can extract a video ID
            const videoId = extractVideoId(localData.url, localData.platform);
            if (!videoId) {
                toast.error(`Invalid ${localData.platform} URL format`);
                return;
            }
        } else if (localData.mediaType === 'image') {
            if (!localData.imageUrl?.trim() && !localData.url?.trim()) {
                toast.error('Image URL is required');
                return;
            }
        }

        onUpdate(localData);
        setIsEditing(false);
        toast.success('Media updated');
    };

    // Cancel editing
    const handleCancel = () => {
        setLocalData(item); // Reset to original data
        setIsEditing(false);
    };

    // Delete item
    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this media item?')) {
            onDelete();
        }
    };

    // Navigate to linked item in links page
    const handleGoToLinkedItem = () => {
        if (linkedLinkItem) {
            router.push(`/dashboard#media-link-${linkedLinkItem.id}`);

            // After navigation, scroll to the highlighted item with retry mechanism
            const scrollToTarget = (attempts = 0) => {
                if (attempts > 10) return; // Give up after 10 attempts

                const targetElement = document.getElementById(`media-link-${linkedLinkItem.id}`);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    // Element not found, try again after a short delay
                    setTimeout(() => scrollToTarget(attempts + 1), 200);
                }
            };

            setTimeout(() => scrollToTarget(), 500);
        }
    };

    const embedUrl = getEmbedUrl();
    const displayImageUrl = localData.imageUrl || localData.url;

    return (
        <div className={`border-2 rounded-lg p-4 bg-white transition-all duration-300 ${
            isHighlighted
                ? 'border-amber-400 ring-4 ring-amber-400 shadow-xl scale-[1.02]'
                : 'border-gray-200 hover:border-gray-300'
        }`}>
            {/* Header with drag handle and actions */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <FaGripVertical className="text-gray-400 cursor-grab" />
                    <h5 className="font-semibold text-gray-800">
                        {isEditing ? 'Editing Media' : localData.title || 'Media'}
                    </h5>
                    {/* Show media type badge */}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${
                        localData.mediaType === 'video'
                            ? 'bg-red-100 text-red-700 border-red-300'
                            : 'bg-blue-100 text-blue-700 border-blue-300'
                    }`}>
                        {localData.mediaType === 'video' ? <FaVideo className="w-2.5 h-2.5" /> : <FaImage className="w-2.5 h-2.5" />}
                        {localData.mediaType === 'video' ? 'Video' : 'Image'}
                    </span>
                    {/* Show link indicator if linked to a link item */}
                    {linkedLinkItem && (
                        <span className='text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold border border-green-300 flex items-center gap-1'>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                            </svg>
                            Linked to Links Page
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Button to go to linked item */}
                    {linkedLinkItem && !isEditing && (
                        <button
                            onClick={handleGoToLinkedItem}
                            disabled={disabled}
                            className="px-3 py-2 bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors flex items-center gap-2 text-sm font-medium"
                            title="Go to Links Page"
                        >
                            <FaExternalLinkAlt className="text-xs" />
                            Go to Link
                        </button>
                    )}
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
                                disabled={disabled || isUploading}
                                className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors"
                                title="Save"
                            >
                                <FaSave />
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={disabled || isUploading}
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
                    {/* Left Column - Media Preview */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Preview
                        </label>
                        <div className="relative w-full aspect-video border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                            {localData.mediaType === 'video' && embedUrl ? (
                                <iframe
                                    src={embedUrl}
                                    className="absolute inset-0 w-full h-full"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            ) : localData.mediaType === 'image' && displayImageUrl ? (
                                <Image
                                    src={displayImageUrl}
                                    alt={localData.title || 'Media preview'}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                    <div className="text-center">
                                        {localData.mediaType === 'video' ? (
                                            <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                        <p className="text-sm">No {localData.mediaType} preview</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Details */}
                    <div className="space-y-3">
                        {/* Media Type Selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Media Type *
                            </label>
                            <select
                                value={localData.mediaType}
                                onChange={(e) => handleMediaTypeChange(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="video">Video</option>
                                <option value="image">Image</option>
                            </select>
                        </div>

                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title (optional)
                            </label>
                            <input
                                type="text"
                                value={localData.title}
                                onChange={(e) => handleChange('title', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="My Media"
                                maxLength={100}
                            />
                        </div>

                        {/* Conditional fields based on media type */}
                        {localData.mediaType === 'video' ? (
                            <>
                                {/* Platform */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Platform *
                                    </label>
                                    <select
                                        value={localData.platform}
                                        onChange={(e) => handleChange('platform', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select platform</option>
                                        <option value="youtube">YouTube</option>
                                        <option value="vimeo">Vimeo</option>
                                    </select>
                                </div>

                                {/* Video URL */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Video URL *
                                    </label>
                                    <input
                                        type="url"
                                        value={localData.url}
                                        onChange={(e) => handleChange('url', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="https://www.youtube.com/watch?v=..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        {localData.platform === 'youtube' && 'Supported: youtube.com/watch?v=..., youtu.be/...'}
                                        {localData.platform === 'vimeo' && 'Supported: vimeo.com/...'}
                                        {!localData.platform && 'Select a platform first'}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Image Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Image *
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleImageUpload(file);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        disabled={isUploading}
                                    />
                                    {isUploading && (
                                        <p className="text-xs text-blue-600 mt-1">Uploading image...</p>
                                    )}
                                    {displayImageUrl && !isUploading && (
                                        <p className="text-xs text-green-600 mt-1">✓ Image uploaded</p>
                                    )}
                                </div>

                                {/* Optional Link */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Link (optional)
                                    </label>
                                    <input
                                        type="url"
                                        value={localData.link || ''}
                                        onChange={(e) => handleChange('link', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="https://example.com"
                                    />
                                </div>
                            </>
                        )}

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description (optional)
                            </label>
                            <textarea
                                value={localData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                placeholder="Brief description..."
                                rows={3}
                                maxLength={200}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                // Preview Mode
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Media Preview */}
                    <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
                        {localData.mediaType === 'video' && embedUrl ? (
                            <iframe
                                src={embedUrl}
                                className="absolute inset-0 w-full h-full"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        ) : localData.mediaType === 'image' && displayImageUrl ? (
                            <Image
                                src={displayImageUrl}
                                alt={localData.title || 'Media'}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    {localData.mediaType === 'video' ? (
                                        <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    <p className="text-sm">No {localData.mediaType}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Details Preview */}
                    <div className="space-y-2">
                        {localData.platform && localData.mediaType === 'video' && (
                            <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded capitalize">
                                {localData.platform}
                            </span>
                        )}
                        <h4 className="font-semibold text-gray-900">{localData.title || 'Media'}</h4>
                        {localData.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">{localData.description}</p>
                        )}
                        {localData.mediaType === 'video' && localData.url && (
                            <a
                                href={localData.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline block truncate"
                            >
                                {localData.url}
                            </a>
                        )}
                        {localData.mediaType === 'image' && localData.link && (
                            <a
                                href={localData.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline block truncate"
                            >
                                {localData.link}
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
