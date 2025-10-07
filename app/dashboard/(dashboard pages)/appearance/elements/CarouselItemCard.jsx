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
            if (event?.target) {
                event.target.value = "";
            }
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
            if (event?.target) {
                event.target.value = "";
            }
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
    const displayTitle = localData.title && localData.title.trim() ? localData.title.trim() : "Untitled";
    const previewMediaLabel = previewMediaType === MEDIA_TYPES.VIDEO ? "Video" : "Image";

    return (
        <div className="w-full rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300 md:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <FaGripVertical className="mt-1 text-xl text-gray-300" />
                    <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            {isEditing ? "Editing item" : "Carousel item"}
                        </p>
                        <h5 className="truncate text-base font-semibold text-gray-900 sm:text-lg">
                            {displayTitle}
                        </h5>
                    </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    {!isEditing ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                disabled={disabled}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                title="Edit"
                            >
                                <FaEdit />
                                <span>Edit</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={disabled}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                title="Delete"
                            >
                                <FaTrash />
                                <span>Delete</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={disabled}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                title="Save"
                            >
                                <FaSave />
                                <span>Save</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={disabled}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                title="Cancel"
                            >
                                <FaTimes />
                                <span>Cancel</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isEditing ? (
                <div className="mt-5 space-y-6">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-start">
                        <div className="space-y-4 md:max-w-sm">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">
                                    Media
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleMediaTypeChange(MEDIA_TYPES.IMAGE)}
                                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                            !isVideoSelected
                                                ? "border border-blue-500 bg-blue-50 text-blue-600"
                                                : "border border-gray-300 text-gray-600 hover:border-blue-400"
                                        }`}
                                    >
                                        Image
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleMediaTypeChange(MEDIA_TYPES.VIDEO)}
                                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                            isVideoSelected
                                                ? "border border-blue-500 bg-blue-50 text-blue-600"
                                                : "border border-gray-300 text-gray-600 hover:border-blue-400"
                                        }`}
                                    >
                                        Video
                                    </button>
                                </div>
                            </div>

                            <div className="relative h-56 w-full overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-gray-400 sm:h-48">
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
                                            alt={displayTitle || "Carousel media"}
                                            fill
                                            style={{ objectFit: "cover" }}
                                            sizes="(max-width: 768px) 100vw, 50vw"
                                        />
                                    )
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
                                        {isVideoSelected ? (
                                            <>
                                                <FaVideo className="text-3xl" />
                                                <span className="text-xs font-medium">Upload a video</span>
                                            </>
                                        ) : (
                                            <>
                                                <FaImage className="text-3xl" />
                                                <span className="text-xs font-medium">Upload an image</span>
                                            </>
                                        )}
                                    </div>
                                )}

                                {isUploadingMedia && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={() =>
                                        (isVideoSelected
                                            ? videoInputRef.current?.click()
                                            : fileInputRef.current?.click())
                                    }
                                    disabled={disabled || isUploadingMedia}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {isUploadingMedia ? "Uploading..." : "Upload Media"}
                                </button>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                disabled={disabled || isUploadingImage}
                                className="hidden"
                            />
                            <input
                                ref={videoInputRef}
                                type="file"
                                accept="video/*"
                                onChange={handleVideoUpload}
                                disabled={disabled || isUploadingVideo}
                                className="hidden"
                            />
                            <p className="text-xs leading-relaxed text-gray-500">
                                {isVideoSelected
                                    ? "MP4, WEBM or MOV up to 50MB. Videos autoplay muted inside your carousel."
                                    : "JPEG, PNG or WEBP up to 5MB. Use bright imagery that highlights your content."}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Category
                                </label>
                                <input
                                    type="text"
                                    value={localData.category}
                                    onChange={(e) => handleFieldChange("category", e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    placeholder="News, Podcast, Product..."
                                    maxLength={30}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={localData.title}
                                    onChange={(e) => handleFieldChange("title", e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    placeholder="Enter a concise title"
                                    maxLength={80}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Description
                                </label>
                                <textarea
                                    value={localData.description}
                                    onChange={(e) => handleFieldChange("description", e.target.value)}
                                    className="min-h-[120px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    placeholder="A brief summary of the content..."
                                    rows={3}
                                    maxLength={200}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Link URL
                            </label>
                            <input
                                type="url"
                                value={localData.link}
                                onChange={(e) => handleFieldChange("link", e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="https://example.com/article"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Author
                            </label>
                            <input
                                type="text"
                                value={localData.author}
                                onChange={(e) => handleFieldChange("author", e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="Olivia"
                                maxLength={50}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Read Time
                            </label>
                            <input
                                type="text"
                                value={localData.readTime}
                                onChange={(e) => handleFieldChange("readTime", e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="3 MIN READ"
                                maxLength={20}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-6">
                    <div className="relative h-48 w-full overflow-hidden rounded-xl bg-gray-100 shadow-inner sm:h-40 sm:max-w-[200px]">
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
                                    <div className="absolute top-3 left-3 rounded-full bg-white/90 p-2 shadow-sm">
                                        <FaPlay className="text-blue-600" />
                                    </div>
                                </>
                            ) : (
                                <Image
                                    src={previewMediaUrl}
                                    alt={displayTitle || "Carousel media"}
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

                    <div className="flex flex-1 flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {localData.category && (
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                    {localData.category}
                                </span>
                            )}
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                                {previewMediaLabel}
                            </span>
                        </div>

                        <h4 className="text-lg font-semibold text-gray-900">{displayTitle}</h4>

                        {localData.description && (
                            <p className="text-sm leading-relaxed text-gray-600">{localData.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-gray-500">
                            {localData.author && <span>{localData.author}</span>}
                            {localData.author && localData.readTime && <span className="text-gray-400">•</span>}
                            {localData.readTime && <span>{localData.readTime}</span>}
                        </div>

                        {localData.link && (
                            <a
                                href={localData.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all text-sm font-medium text-blue-600 hover:underline"
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
