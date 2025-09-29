/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/dashboard/(dashboard pages)/appearance/elements/ProfileImageHandler.jsx
"use client"
import { useContext, useRef, useState, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";
import { AppearanceContext } from "../AppearanceContext";
import { AppearanceService } from '@/lib/services/serviceAppearance/client/appearanceService.js';
import Image from "next/image";
import { FaCheck, FaX } from "react-icons/fa6";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function ProfileImageManager() {
    const { t, isInitialized } = useTranslation();

    // ✅ GET DATA FROM CONTEXT INSTEAD OF PROPS
    const { appearance, updateAppearance } = useContext(AppearanceContext);

    const [uploadedPhoto, setUploadedPhoto] = useState(null);
    const [uploadedPhotoPreview, setUploadedPhotoPreview] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const inputRef = useRef();
    const formRef = useRef();

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            pickImage: t('dashboard.appearance.profile.pick_image') || 'Pick an image',
            remove: t('dashboard.appearance.profile.remove_image') || 'Remove',
            altProfile: t('dashboard.appearance.profile.alt_profile') || 'Profile',
            errorSelectImage: t('dashboard.appearance.profile.error_select_image') || 'Please select a valid image',
            errorImageTooLarge: t('dashboard.appearance.profile.error_image_too_large') || 'Image too large (max 5MB)',
            errorNotAuth: t('dashboard.appearance.profile.error_not_authenticated') || 'Not authenticated',
            errorUploadFailed: t('dashboard.appearance.profile.error_upload_failed') || 'Upload failed',
            errorRemoveFailed: t('dashboard.appearance.profile.error_remove_failed') || 'Remove failed',
            toastUploading: t('dashboard.appearance.profile.toast_uploading') || 'Uploading image...',
            toastSuccess: t('dashboard.appearance.profile.toast_success') || 'Profile image updated!',
            toastRemoving: t('dashboard.appearance.profile.toast_removing') || 'Removing image...',
            toastRemoveSuccess: t('dashboard.appearance.profile.toast_remove_success') || 'Profile image removed',
        };
    }, [t, isInitialized]);

const updateProfilePictureElement = useMemo(() => {
    if (!appearance) return null;
    
    const photoUrl = appearance.profilePhoto || '';
    const name = appearance.displayName || appearance.username || '';
    
    if (photoUrl) {
        return (
            <Image
                src={photoUrl}
                alt={translations.altProfile}
                height={1000}
                width={1000}
                className="min-w-full h-full object-cover"
                priority
            />
        );
    } else {
        const initial = name?.[0] || 'U';
        return (
            <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                <span className="text-3xl font-semibold uppercase">{initial}</span>
            </div>
        );
    }
}, [appearance, translations.altProfile]);
    // Handle file selection
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
        
        if (!selectedFile.type.startsWith('image/')) {
            toast.error(translations.errorSelectImage);
            return;
        }
        
        if (selectedFile.size > 5 * 1024 * 1024) {
            toast.error(translations.errorImageTooLarge);
            return;
        }
        
        const previewURL = URL.createObjectURL(selectedFile);
        setUploadedPhotoPreview(previewURL);
        setUploadedPhoto(selectedFile);
        setPreviewing(true);
    };

    // ✅ HANDLE IMAGE UPLOAD WITH CONTEXT UPDATES
    const handleUploadPhoto = async () => {
        if (!uploadedPhoto) {
            toast.error(translations.errorSelectImage);
            return;
        }

        setIsLoading(true);
        try {
            // ✅ CALL THE SERVICE
            const result = await AppearanceService.uploadProfileImage(uploadedPhoto);
            
            // ✅ UPDATE THE CONTEXT (which updates the whole page)
            updateAppearance('profilePhoto', result.downloadURL);

            handleReset();
            toast.success(translations.toastSuccess);
            
        } catch (error) {
            console.error("Upload error:", error);
            toast.error(error.message || translations.errorUploadFailed);
        } finally {
            setIsLoading(false);
        }
    };

    // ✅ HANDLE IMAGE REMOVAL WITH CONTEXT UPDATES
    const handleRemoveProfilePicture = async () => {
        if (isRemoving) return;
        
        setIsRemoving(true);
        try {
            // ✅ CALL THE SERVICE
            await AppearanceService.removeProfileImage();
            
            // ✅ UPDATE THE CONTEXT
            updateAppearance('profilePhoto', '');

            toast.success(translations.toastRemoveSuccess);
            
        } catch (error) {
            console.error("Remove error:", error);
            toast.error(error.message || translations.errorRemoveFailed);
        } finally {
            setIsRemoving(false);
        }
    };

    // Reset preview state
    const handleReset = () => {
        if (isLoading) return;
        
        if (formRef.current) formRef.current.reset();
        setUploadedPhoto(null);
        setPreviewing(false);
        
        if (uploadedPhotoPreview) {
            URL.revokeObjectURL(uploadedPhotoPreview);
            setUploadedPhotoPreview('');
        }
    };

    // Cleanup preview URL
    useEffect(() => {
        return () => {
            if (uploadedPhotoPreview) {
                URL.revokeObjectURL(uploadedPhotoPreview);
            }
        };
    }, [uploadedPhotoPreview]);

    // ✅ LOADING SKELETON BASED ON CONTEXT AVAILABILITY
    if (!isInitialized || !appearance) {
        return (
            <div className="flex w-full p-6 items-center gap-4 animate-pulse">
                <div className="h-[6rem] w-[6rem] rounded-full bg-gray-200"></div>
                <div className="flex-1 grid gap-2">
                    <div className="h-12 rounded-3xl bg-gray-200"></div>
                    <div className="h-12 rounded-3xl bg-gray-200"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full p-6 items-center gap-4">
            <div 
                className="h-[6rem] w-[6rem] cursor-pointer rounded-full grid place-items-center border overflow-hidden hover:opacity-80 transition-opacity" 
                onClick={() => inputRef.current?.click()}
            >
                {/* ✅ USE MEMOIZED PROFILE PICTURE ELEMENT */}
                {updateProfilePictureElement}
            </div>
            
            <div className="flex-1 grid gap-2 relative">
                <input 
                    type="file" 
                    className="absolute opacity-0 pointer-events-none" 
                    ref={inputRef} 
                    accept="image/*" 
                    onChange={handleFileChange} 
                />
                
                <button 
                    className={`flex items-center gap-3 justify-center p-3 rounded-3xl transition-all duration-200 ${
                        isLoading || isRemoving
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-btnPrimary hover:bg-btnPrimaryAlt hover:scale-[1.005] active:scale-95 active:opacity-60 cursor-pointer'
                    } text-white w-full`} 
                    onClick={() => inputRef.current?.click()}
                    disabled={isLoading || isRemoving}
                >
                    {isLoading ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            {translations.toastUploading}
                        </>
                    ) : (
                        translations.pickImage
                    )}
                </button>
                
                <button 
                    className={`flex items-center gap-3 justify-center p-3 rounded-3xl border transition-all duration-200 ${
                        isLoading || isRemoving
                            ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 hover:border-gray-400 hover:scale-[1.005] active:scale-95 active:opacity-60 cursor-pointer'
                    } w-full`}
                    onClick={handleRemoveProfilePicture}
                    disabled={isLoading || isRemoving}
                >
                    {isRemoving ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                            {translations.toastRemoving}
                        </>
                    ) : (
                        translations.remove
                    )}
                </button>
            </div>

            {/* Preview Modal */}
            {previewing && (
                <div className="fixed top-0 left-0 h-screen w-screen grid place-items-center z-[999999999999999]">
                    <div 
                        className="absolute h-full w-full bg-black bg-opacity-[0.25] backdrop-blur-[1px] top-0 left-0 p-2" 
                        onClick={handleReset}
                    ></div>
                    <form ref={formRef} className="relative z-10 sm:max-w-[30rem] max-w-18 max-h-[80vh] overflow-hidden p-4">
                        <div className="w-full scale-[0.95] relative rounded-full overflow-hidden place-items-center grid aspect-square bg-white">
                            <Image 
                                src={uploadedPhotoPreview} 
                                alt={translations.altProfile} 
                                height={1000} 
                                width={1000} 
                                priority 
                                className="min-w-[10rem] w-full object-cover min-h-full" 
                            />
                            {isLoading && (
                                <div className="absolute z-10 h-full w-full scale-110 grid place-items-center bg-black bg-opacity-[0.25] mix-blend-screen">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                                </div>
                            )}
                        </div>
                        {!isLoading && (
                            <>
                                <div 
                                    className="absolute top-2 right-2 rounded-full p-2 hover:bg-red-500 active:scale-90 bg-black text-white text-sm cursor-pointer" 
                                    onClick={handleReset}
                                >
                                    <FaX />
                                </div>
                                <div 
                                    className="p-3 text-lg text-white bg-btnPrimary w-fit rounded-full mx-auto active:bg-btnPrimaryAlt active:scale-90 hover:scale-110 cursor-pointer my-3" 
                                    onClick={handleUploadPhoto}
                                >
                                    <FaCheck />
                                </div>
                            </>
                        )}
                    </form>
                </div>
            )}
        </div>
    );
}