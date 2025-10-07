// app/dashboard/(dashboard pages)/appearance/elements/CarouselItemCard.jsx

"use client"

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FaTrash, FaEdit, FaSave, FaTimes, FaImage, FaPlay, FaGripVertical, FaVideo } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { AppearanceService } from "@/lib/services/serviceAppearance/client/appearanceService";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MEDIA_TYPES = {
    IMAGE: "image",
    VIDEO: "video"
};

const normalizeItem = (rawItem = {}) => {
    const fallbackImage = typeof rawItem.image === "string" ? rawItem.image : "";
    const fallbackVideo = typeof rawItem.videoUrl === "string" ? rawItem.videoUrl : "";
    const rawMediaType = typeof rawItem.mediaType === "string" ? rawItem.mediaType.toLowerCase() : "";

    let mediaType = rawMediaType === MEDIA_TYPES.VIDEO
        ? MEDIA_TYPES.VIDEO
        : rawMediaType === MEDIA_TYPES.IMAGE
            ? MEDIA_TYPES.IMAGE
            : "";

    let mediaUrl = typeof rawItem.mediaUrl === "string" ? rawItem.mediaUrl : "";

    if (!mediaType) {
        if (fallbackVideo && !fallbackImage) {
            mediaType = MEDIA_TYPES.VIDEO;
        } else if (fallbackImage) {
            mediaType = MEDIA_TYPES.IMAGE;
        } else if (fallbackVideo) {
            mediaType = MEDIA_TYPES.VIDEO;
        } else {
            mediaType = MEDIA_TYPES.IMAGE;
        }
    }

    if (!mediaUrl) {
        mediaUrl = mediaType === MEDIA_TYPES.VIDEO ? fallbackVideo : fallbackImage;
    }

    if (typeof mediaUrl !== "string") {
        mediaUrl = "";
    }

    return {
        ...rawItem,
        mediaType,
        mediaUrl,
        image: mediaType === MEDIA_TYPES.IMAGE ? (mediaUrl || fallbackImage || "") : "",
        videoUrl: mediaType === MEDIA_TYPES.VIDEO ? (mediaUrl || fallbackVideo || "") : ""
    };
};

export default function CarouselItemCard({ item, onUpdate, onDelete, disabled }) {
    const [isEditing, setIsEditing] = useState(false);
    const [localData, setLocalData] = useState(() => normalizeItem(item));
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const fileInputRef = useRef(null);
    const videoInputRef = useRef(null);

    useEffect(() => {
        setLocalData(normalizeItem(item));
    }, [item]);

    const handleFieldChange = (field, value) => {
        setLocalData(prev => ({ ...prev, [field]: value }));
    };

    const handleMediaTypeChange = (type) => {
        if (!Object.values(MEDIA_TYPES).includes(type) || type === localData.mediaType) {
            return;
        }
        setLocalData(prev => ({
            ...prev,
            mediaType: type,
            mediaUrl: "",
            image: type === MEDIA_TYPES.IMAGE ? "" : "",
            videoUrl: type === MEDIA_TYPES.VIDEO ? "" : ""
        }));
    };

    const handleImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_IMAGE_SIZE) {
            toast.error("Image too large (max 5MB)");
            return;
        }

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }

        setIsUploadingImage(true);

        try {
            const result = await AppearanceService.uploadCarouselImage(file);
            setLocalData(prev => ({
                ...prev,
                mediaType: MEDIA_TYPES.IMAGE,
                mediaUrl: result.downloadURL,
                image: result.downloadURL,
                videoUrl: ""
            }));
            toast.success("Image uploaded successfully");
        } catch (error) {
            console.error("Image upload error:", error);
            toast.error(error.message || "Failed to upload image");
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleVideoUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_VIDEO_SIZE) {
            toast.error("Video too large (max 50MB)");
            return;
        }

        if (!file.type.startsWith("video/")) {
            toast.error("Please select a video file");
            return;
        }

        setIsUploadingVideo(true);

        try {
            const result = await AppearanceService.uploadCarouselVideo(file);
            setLocalData(prev => ({
                ...prev,
                mediaType: MEDIA_TYPES.VIDEO,
                mediaUrl: result.downloadURL,
                videoUrl: result.downloadURL,
                image: ""
            }));
            toast.success("Video uploaded successfully");
        } catch (error) {
            console.error("Video upload error:", error);
            toast.error(error.message || "Failed to upload video");
        } finally {
            setIsUploadingVideo(false);
        }
    };

    const handleSave = () => {
        const title = (localData.title || "").trim();
        if (!title) {
            toast.error("Title is required");
            return;
        }

        const mediaType = localData.mediaType === MEDIA_TYPES.VIDEO ? MEDIA_TYPES.VIDEO : MEDIA_TYPES.IMAGE;
        const mediaUrl = (localData.mediaUrl || "").trim();

        const payload = {
            ...localData,
            title,
            category: (localData.category || "").trim(),
            description: (localData.description || "").trim(),
            link: (localData.link || "").trim(),
            author: (localData.author || "").trim(),
            readTime: (localData.readTime || "").trim(),
            mediaType,
            mediaUrl,
            image: mediaType === MEDIA_TYPES.IMAGE ? mediaUrl : "",
            videoUrl: mediaType === MEDIA_TYPES.VIDEO ? mediaUrl : ""
        };

        onUpdate(payload);
        setIsEditing(false);
        toast.success("Item updated");
    };

    const handleCancel = () => {
        setLocalData(normalizeItem(item));
        setIsEditing(false);
    };

    const handleDelete = () => {
        if (confirm("Are you sure you want to delete this carousel item?")) {
            onDelete();
        }
    };

    const isVideoSelected = localData.mediaType === MEDIA_TYPES.VIDEO;
    const isUploadingMedia = isVideoSelected ? isUploadingVideo : isUploadingImage;
    const editingMediaUrl = localData.mediaUrl || (isVideoSelected ? localData.videoUrl : localData.image);
    const previewMediaType = isVideoSelected ? MEDIA_TYPES.VIDEO : MEDIA_TYPES.IMAGE;
    const previewMediaUrl = editingMediaUrl;

    return (
        <div className="border-2 border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <FaGripVertical className="text-gray-400 cursor-grab" />
                    <h5 className="font-semibold text-gray-800">
                        {isEditing ? "Editing Item" : localData.title || "Untitled"}
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

            {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700">
                                Media
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleMediaTypeChange(MEDIA_TYPES.IMAGE)}
                                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${isVideoSelected ? "border-gray-300 text-gray-600 hover:border-blue-400" : "border-blue-500 text-blue-600 bg-blue-50"}`}
                                >
                                    Image
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMediaTypeChange(MEDIA_TYPES.VIDEO)}
                                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${isVideoSelected ? "border-blue-500 text-blue-600 bg-blue-50" : "border-gray-300 text-gray-600 hover:border-blue-400"}`}
                                >
                                    Video
                                </button>
                            </div>
                        </div>

                        <div className="relative w-full h-40 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50 hover:border-gray-400 transition-colors">
                            {previewMediaUrl ? (
                                isVideoSelected ? (
                                    <video
                                        src={previewMediaUrl}
                                        className="absolute inset-0 h-full w-full object-cover"
                                        autoPlay
                                        loop
                                        muted
                                        controls
                                        playsInline
                                    />
                                ) : (
                                    <Image
                                        src={previewMediaUrl}
                                        alt={localData.title || "Carousel media"}
                                        fill
                                        style={{ objectFit: "cover" }}
                                        sizes="(max-width: 768px) 100vw, 50vw"
                                    />
                                )
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                    {isVideoSelected ? (
                                        <FaVideo className="text-4xl" />
                                    ) : (
                                        <FaImage className="text-4xl" />
                                    )}
                                </div>
                            )}

                            {isUploadingMedia && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                </div>
                            )}

                            <button
                                onClick={() => (isVideoSelected ? videoInputRef.current?.click() : fileInputRef.current?.click())}
                                disabled={isUploadingMedia}
                                className="absolute bottom-2 right-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-80"
                            >
                                Upload
                            </button>
                        </div>

                        <p className="text-xs text-gray-500">
                            {isVideoSelected
                                ? "MP4, WEBM or MOV up to 50MB. We’ll autoplay the video muted in your carousel."
                                : "JPEG, PNG, WEBP or GIF up to 5MB."}
                        </p>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                        />
                        <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            onChange={handleVideoUpload}
                            className="hidden"
                        />
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title *
                            </label>
                            <input
                                type="text"
                                value={localData.title}
                                onChange={(e) => handleFieldChange("title", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Best tools used in UX/UI Designers"
                                maxLength={100}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Category
                            </label>
                            <input
                                type="text"
                                value={localData.category}
                                onChange={(e) => handleFieldChange("category", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Career, Design, Tech..."
                                maxLength={50}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                value={localData.description}
                                onChange={(e) => handleFieldChange("description", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                placeholder="A brief summary of the content..."
                                rows={3}
                                maxLength={200}
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Link URL
                            </label>
                            <input
                                type="url"
                                value={localData.link}
                                onChange={(e) => handleFieldChange("link", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="https://example.com/article"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Author
                            </label>
                            <input
                                type="text"
                                value={localData.author}
                                onChange={(e) => handleFieldChange("author", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Olivia"
                                maxLength={50}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Read Time
                            </label>
                            <input
                                type="text"
                                value={localData.readTime}
                                onChange={(e) => handleFieldChange("readTime", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="3 MIN READ"
                                maxLength={20}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative w-full h-40 bg-gray-100 rounded-lg overflow-hidden">
                        {previewMediaUrl ? (
                            previewMediaType === MEDIA_TYPES.VIDEO ? (
                                <>
                                    <video
                                        src={previewMediaUrl}
                                        className="absolute inset-0 h-full w-full object-cover"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                    />
                                    <div className="absolute top-2 left-2 bg-white bg-opacity-90 rounded-full p-2">
                                        <FaPlay className="text-blue-600" />
                                    </div>
                                </>
                            ) : (
                                <Image
                                    src={previewMediaUrl}
                                    alt={localData.title || "Carousel media"}
                                    fill
                                    style={{ objectFit: "cover" }}
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                />
                            )
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                <FaImage className="text-4xl" />
                            </div>
                        )}
                    </div>

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
