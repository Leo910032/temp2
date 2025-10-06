/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
"use client"

import React, { useContext, useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import { FaCheck, FaX } from "react-icons/fa6";
import { toast } from "react-hot-toast";
import { useTranslation } from "@/lib/translation/useTranslation";

import { backgroundContext } from "../components/Backgrounds";
import { AppearanceContext } from "../AppearanceContext";

/**
 * A "dumb" presentational component for displaying and selecting a single background option.
 * It receives all its data and logic via context and props.
 */
export default function BackgroundCard({ text, identifier, colorValue, backImg }) {
    const { t } = useTranslation();
  
    // --- CONTEXT CONSUMPTION ---
    const { setIsGradient } = useContext(backgroundContext);
    const { appearance, updateAppearance, isSaving, handleFileUpload } = useContext(AppearanceContext);

    // --- LOCAL UI STATE ---
    // State for managing the file preview modal
    const [uploadedFilePreview, setUploadedFilePreview] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [previewing, setPreviewing] = useState(false);
    const [isUploading, setIsUploading] = useState(false); // Local uploading state for this card's spinner
    const fileInputRef = useRef(null);
    
    const isSelected = useMemo(() => appearance?.backgroundType === identifier, [appearance, identifier]);

    // --- EFFECTS ---
    useEffect(() => {
        // Inform the parent <Backgrounds> component if the "Gradient" type is selected from the context
        if (isSelected && identifier === "Gradient") {
            setIsGradient(true);
        }
    }, [isSelected, identifier, setIsGradient]);

    // Cleanup the object URL for the file preview to prevent memory leaks
    useEffect(() => {
        return () => {
            if (uploadedFilePreview) {
                URL.revokeObjectURL(uploadedFilePreview);
            }
        };
    }, [uploadedFilePreview]);


    // --- EVENT HANDLERS ---

    /**
     * Handles the user selecting a file from their computer.
     * Validates the file and sets up the local state for the preview modal.
     */
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        const isImage = identifier === "Image";
        const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB for images, 50MB for videos
        const acceptedTypes = isImage ? ['image/jpeg', 'image/png', 'image/gif'] : ['video/mp4', 'video/webm'];

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

    /**
     * Handles the click event on the main card.
     * For file-based backgrounds, it triggers the file input.
     * For simple backgrounds, it updates the context directly.
     */
    const handleCardClick = () => {
        if (isSaving || isSelected) return;

        switch (identifier) {
            case "Image":
            case "Video":
                fileInputRef.current?.click();
                break;
            default:
                // For simple types like "Flat Colour", update the context immediately.
                // The parent AppearancePage will handle the debounced save.
                updateAppearance('backgroundType', identifier);
                break;
        }
    };

    /**
     * Called when the user confirms the upload in the preview modal.
     * It uses the `handleFileUpload` function passed down from the parent context.
     */
    const handleConfirmUpload = async () => {
        if (!uploadedFile) return;

        setIsUploading(true);
        const uploadType = identifier === 'Image' ? 'backgroundImage' : 'backgroundVideo';
        
        // This promise will be handled by react-hot-toast
        const uploadPromise = handleFileUpload(uploadedFile, uploadType);

        toast.promise(uploadPromise, {
            loading: 'Uploading...',
            success: (result) => {
                if(result.success) {
                    handleReset(); // Reset local state only on success
                    return 'Background updated!';
                } else {
                    // This allows the error to be caught by the toast's error handler
                    throw new Error(result.error?.message || 'Upload failed.');
                }
            },
            error: (err) => err.message || 'Upload failed.',
        });
        
        // We set isUploading to false after the promise settles, regardless of outcome
        uploadPromise.finally(() => setIsUploading(false));
    };

    /**
     * Resets the local state of the preview modal.
     */
    const handleReset = () => {
        setUploadedFile(null);
        setPreviewing(false);
        if (uploadedFilePreview) {
            URL.revokeObjectURL(uploadedFilePreview);
            setUploadedFilePreview('');
        }
        if(fileInputRef.current) fileInputRef.current.value = "";
    };

    // --- RENDER LOGIC ---

    // Show a skeleton loader if the parent context hasn't loaded the appearance data yet.
    if (!appearance) {
        return (
            <div className="min-w-[8rem] flex-1 items-center flex flex-col animate-pulse">
                <div className="w-full h-[13rem] bg-gray-200 rounded-lg"></div>
                <div className="h-4 w-20 bg-gray-200 rounded-md mt-3"></div>
            </div>
        );
    }
    
    return (
        <>
            <div className={`min-w-[8rem] flex-1 items-center flex flex-col group ${isSaving ? 'pointer-events-none opacity-75' : ''}`}>
                <div 
                    className={`w-full h-[13rem] relative ${
                        !colorValue && !backImg ? "border-dashed border-black" : ""
                    } border rounded-lg hover:scale-105 active:scale-90 grid place-items-center cursor-pointer overflow-hidden transition-transform duration-200`} 
                    onClick={handleCardClick}
                >
                    {isSelected && (
                        <div className="h-full w-full absolute top-0 left-0 bg-black bg-opacity-50 grid place-items-center z-10 text-white text-3xl">
                            <FaCheck />
                        </div>
                    )}
                    
                   {colorValue ? (
    <div 
        className="h-full w-full" 
        style={{ 
            backgroundColor: identifier === "Color" && appearance?.backgroundColor 
                ? appearance.backgroundColor 
                : colorValue 
        }}
    ></div>
) : backImg ? (
    <div className="h-full w-full bg-cover bg-no-repeat bg-center" style={{ backgroundImage: backImg }}></div>
) : (
                        <div className="h-full w-full grid place-items-center">
                            <input 
                                type="file" 
                                className="hidden" 
                                ref={fileInputRef} 
                                accept={identifier === 'Image' ? 'image/jpeg,image/png,image/gif' : 'video/mp4,video/webm'}
                                onChange={handleFileChange} 
                            />
                            <div className="bg-black bg-opacity-10 rounded-lg p-2">
                                <Image 
                                    src={"https://linktree.sirv.com/Images/icons/image.svg"} 
                                    alt={"Upload Icon"} 
                                    height={27} 
                                    width={27} 
                                />
                            </div>
                        </div>
                    )}
                </div>
                <span className="py-3 text-sm font-medium">{text}</span>
            </div>
            
            {/* Preview Modal */}
            {previewing && (
                <div className="fixed top-0 left-0 h-screen w-screen grid place-items-center z-[999999999999999]">
                    <div className="absolute h-full w-full bg-black/25 backdrop-blur-sm" onClick={handleReset}></div>
                    <div className="relative z-10 sm:max-w-[30rem] w-11/12 p-4">
                        <div className="w-full scale-95 relative overflow-hidden place-items-center grid aspect-square bg-white rounded-lg shadow-2xl">
                            {identifier === "Image" && (
                                <Image 
                                    src={uploadedFilePreview} 
                                    alt="Preview"
                                    fill // ✅ REPLACES layout="fill"
                                    style={{ objectFit: 'contain' }} // ✅ REPLACES objectFit="contain"
                                    sizes="(max-width: 768px) 90vw, 480px"
                                    priority 
                                />
                            )}
                            {identifier === "Video" && (
                                <video 
                                    className="w-full h-full object-contain" 
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
                        {!isUploading && (
                            <div className="flex items-center justify-center gap-4 mt-4">
                                <button 
                                    className="p-3 text-lg text-white bg-red-500 w-fit rounded-full active:bg-red-600 active:scale-90 hover:scale-110 cursor-pointer" 
                                    onClick={handleReset}
                                >
                                    <FaX />
                                </button>
                                <button
                                    className="p-3 text-lg text-white bg-green-500 w-fit rounded-full active:bg-green-600 active:scale-90 hover:scale-110 cursor-pointer" 
                                    onClick={handleConfirmUpload}
                                >
                                    <FaCheck />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
