// app/dashboard/(dashboard pages)/appearance/elements/BannerCard.jsx
"use client"

import React, { useContext, useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import { FaCheck, FaX, FaBan } from "react-icons/fa6";
import { toast } from "react-hot-toast";
import { useTranslation } from "@/lib/translation/useTranslation";

import { bannerContext } from "../components/Banners";
import { AppearanceContext } from "../AppearanceContext";

/**
 * BannerCard component for selecting different banner types
 * Supports: None, Color, Gradient, Image, Video, and preset banners
 */
export default function BannerCard({ 
    text, 
    identifier, 
    colorValue, 
    backImg, 
    isNone = false 
}) {
    const { t } = useTranslation();
    const { setShowColorPicker, setShowGradientPicker } = useContext(bannerContext);
    const { appearance, updateAppearance, isSaving, handleFileUpload } = useContext(AppearanceContext);

    // Local UI state for file upload
    const [uploadedFilePreview, setUploadedFilePreview] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [previewing, setPreviewing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    
    const isSelected = useMemo(() => appearance?.bannerType === identifier, [appearance, identifier]);

    // Cleanup object URL for file preview
    useEffect(() => {
        return () => {
            if (uploadedFilePreview) {
                URL.revokeObjectURL(uploadedFilePreview);
            }
        };
    }, [uploadedFilePreview]);

    // Handle file selection
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        const isImage = identifier === "Image";
        const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB for images, 50MB for videos
        const acceptedTypes = isImage 
            ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] 
            : ['video/mp4', 'video/webm'];

        if (selectedFile.size > maxSize) {
            toast.error(`${identifier} is too large (max ${isImage ? 10 : 50}MB)`);
            return;
        }
        if (!acceptedTypes.includes(selectedFile.type)) {
            toast.error(`Invalid file type. Please select a valid ${identifier.toLowerCase()}.`);
            return;
        }

        setUploadedFilePreview(URL.createObjectURL(selectedFile));
        setUploadedFile(selectedFile);
        setPreviewing(true);
    };

    // Handle banner selection
    const handleCardClick = () => {
        if (isSaving || isSelected) return;

        switch (identifier) {
            case "Image":
            case "Video":
                // Set the banner type immediately when clicking Image/Video
                updateAppearance('bannerType', identifier);
                fileInputRef.current?.click();
                break;
            case "Color":
                updateAppearance('bannerType', identifier);
                setShowColorPicker(true);
                setShowGradientPicker(false);
                break;
            case "Gradient":
                updateAppearance('bannerType', identifier);
                setShowGradientPicker(true);
                setShowColorPicker(false);
                break;
            default:
                // For "None" and preset banners
                updateAppearance('bannerType', identifier);
                setShowColorPicker(false);
                setShowGradientPicker(false);
                break;
        }
    };

    // Handle file upload confirmation
    const handleConfirmUpload = async () => {
        if (!uploadedFile) return;

        setIsUploading(true);
        const uploadType = identifier === 'Image' ? 'bannerImage' : 'bannerVideo';
        
        const uploadPromise = handleFileUpload(uploadedFile, uploadType);

        toast.promise(uploadPromise, {
            loading: 'Uploading banner...',
            success: (result) => {
                if(result.success) {
                    handleReset();
                    return 'Banner updated!';
                } else {
                    throw new Error(result.error?.message || 'Upload failed.');
                }
            },
            error: (err) => err.message || 'Upload failed.',
        });
        
        uploadPromise.finally(() => setIsUploading(false));
    };

    // Reset preview state
    const handleReset = () => {
        setUploadedFile(null);
        setPreviewing(false);
        if (uploadedFilePreview) {
            URL.revokeObjectURL(uploadedFilePreview);
            setUploadedFilePreview('');
        }
        if(fileInputRef.current) fileInputRef.current.value = "";
    };

    // Loading skeleton
    if (!appearance) {
        return (
            <div className="min-w-[8rem] flex-1 items-center flex flex-col animate-pulse">
                <div className="w-full h-[8rem] bg-gray-200 rounded-lg"></div>
                <div className="h-4 w-20 bg-gray-200 rounded-md mt-3"></div>
            </div>
        );
    }

    return (
        <>
            <div className={`min-w-[8rem] flex-1 items-center flex flex-col group ${isSaving ? 'pointer-events-none opacity-75' : ''}`}>
                <div 
                    className={`w-full h-[8rem] relative ${
                        !colorValue && !backImg && !isNone ? "border-dashed border-black" : ""
                    } border rounded-lg hover:scale-105 active:scale-90 grid place-items-center cursor-pointer overflow-hidden transition-transform duration-200`} 
                    onClick={handleCardClick}
                >
                    {/* Selection indicator */}
                    {isSelected && !isNone && (
                        <div className="h-full w-full absolute top-0 left-0 bg-black bg-opacity-50 grid place-items-center z-10 text-white text-2xl">
                            <FaCheck />
                        </div>
                    )}

                    {/* No Banner Option */}
                    {isNone && (
                        <div className="h-full w-full grid place-items-center bg-gray-100 relative">
                            <div className="text-center">
                                <FaBan className="text-2xl text-gray-400 mx-auto mb-2" />
                                <span className="text-xs text-gray-500">No Banner</span>
                            </div>
                            {isSelected && (
                                <div className="absolute inset-0 bg-green-500 bg-opacity-20 grid place-items-center">
                                    <FaCheck className="text-green-600 text-xl" />
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Color Banner */}
                    {colorValue && !isNone && (
                        <div 
                            className="h-full w-full" 
                            style={{ 
                                backgroundColor: identifier === "Color" && appearance?.bannerColor 
                                    ? appearance.bannerColor 
                                    : colorValue 
                            }}
                        ></div>
                    )}
                    
                    {/* Gradient/Preset Banners */}
                    {backImg && !isNone && (
                        <div 
                            className="h-full w-full bg-cover bg-no-repeat bg-center" 
                            style={{ 
                                backgroundImage: backImg.startsWith('linear-gradient') 
                                    ? backImg 
                                    : `url(${backImg})` 
                            }}
                        ></div>
                    )}
                    
                    {/* File Upload Banners */}
                    {!colorValue && !backImg && !isNone && (
                        <div className="h-full w-full grid place-items-center">
                            <input 
                                type="file" 
                                className="hidden" 
                                ref={fileInputRef} 
                                accept={identifier === 'Image' ? 'image/jpeg,image/png,image/gif,image/webp' : 'video/mp4,video/webm'}
                                onChange={handleFileChange} 
                            />
                            <div className="bg-black bg-opacity-10 rounded-lg p-3">
                                <Image 
                                    src={"https://linktree.sirv.com/Images/icons/image.svg"} 
                                    alt={"Upload Icon"} 
                                    height={24} 
                                    width={24} 
                                />
                            </div>
                        </div>
                    )}
                </div>
                <span className="py-2 text-sm font-medium text-center">{text}</span>
            </div>
            
            {/* Preview Modal for file uploads */}
            {previewing && (
                <div className="fixed top-0 left-0 h-screen w-screen grid place-items-center z-[999999999999999]">
                    <div className="absolute h-full w-full bg-black/25 backdrop-blur-sm" onClick={handleReset}></div>
                    <div className="relative z-10 sm:max-w-[40rem] w-11/12 p-4">
                        <div className="w-full scale-95 relative overflow-hidden place-items-center grid bg-white rounded-lg shadow-2xl">
                            {/* Banner preview with aspect ratio */}
                            <div className="w-full h-48 relative overflow-hidden">
                                {identifier === "Image" && (
                                    <Image 
                                        src={uploadedFilePreview} 
                                        alt="Banner Preview"
                                        fill
                                        style={{ objectFit: 'cover' }}
                                        sizes="(max-width: 768px) 100vw, 640px"
                                        priority 
                                    />
                                )}
                                {identifier === "Video" && (
                                    <video 
                                        className="w-full h-full object-cover" 
                                        controls 
                                        autoPlay 
                                        loop
                                        muted
                                        playsInline
                                        src={uploadedFilePreview}
                                    >
                                        Your browser does not support the video tag.
                                    </video>
                                )}
                                {isUploading && (
                                    <div className="absolute z-10 h-full w-full grid place-items-center bg-black/25">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Preview info */}
                            <div className="p-4 w-full">
                                <h3 className="font-semibold text-lg mb-2">Banner Preview</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    This will be displayed as your contact card banner
                                </p>
                                
                                {!isUploading && (
                                    <div className="flex items-center justify-center gap-4">
                                        <button 
                                            className="px-6 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 active:scale-95 transition-all flex items-center gap-2" 
                                            onClick={handleReset}
                                        >
                                            <FaX />
                                            Cancel
                                        </button>
                                        <button
                                            className="px-6 py-2 text-white bg-green-500 rounded-lg hover:bg-green-600 active:scale-95 transition-all flex items-center gap-2" 
                                            onClick={handleConfirmUpload}
                                        >
                                            <FaCheck />
                                            Use as Banner
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
