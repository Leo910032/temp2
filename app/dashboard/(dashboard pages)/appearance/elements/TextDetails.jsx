// app/dashboard/(dashboard pages)/appearance/elements/TextDetails.jsx - FIXED VERSION
"use client"

import { useDebounce } from "@/LocalHooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";
import { updateDisplayName, updateBio } from "@/lib/services/appearanceService";
import { useEffect, useState, useMemo, useRef, useContext } from "react";
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from "react-hot-toast";
import { AppearanceContext } from "../AppearanceContext";

export default function TextDetails() {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const { appearance, updateAppearance } = useContext(AppearanceContext); // ✅ USE: Context instead of API calls
    
    const [displayName, setDisplayName] = useState("");
    const [myBio, setMyBio] = useState("");
    const [isUpdatingName, setIsUpdatingName] = useState(false);
    const [isUpdatingBio, setIsUpdatingBio] = useState(false);
    
    const debounceDisplayName = useDebounce(displayName, 1000);
    const debounceMyBio = useDebounce(myBio, 1000);
    
    const isInitialLoad = useRef(true);

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            profileTitle: t('dashboard.appearance.text_details.profile_title') || 'Profile Title',
            bio: t('dashboard.appearance.text_details.bio') || 'Bio',
            errorTooLong: t('dashboard.appearance.text_details.error_too_long') || 'Text too long',
            errorUpdateFailed: t('dashboard.appearance.text_details.error_update_failed') || 'Update failed',
        };
    }, [t, isInitialized]);

    // ✅ SYNC: Local state with context data (replaces fetchInitialData)
    useEffect(() => {
        if (appearance) {
            setDisplayName(appearance.displayName || '');
            setMyBio(appearance.bio || '');
        }
    }, [appearance]);

    // Handle display name updates
    const handleDisplayNameUpdate = async (name) => {
        if (!currentUser || isUpdatingName) return;
        
        // Client-side validation
        if (name.length > 100) {
            toast.error(translations.errorTooLong + ' (max 100 characters)');
            return;
        }

        // ✅ OPTIMISTIC UPDATE: Update context immediately
        updateAppearance('displayName', name);

        setIsUpdatingName(true);
        try {
            await updateDisplayName(name);
            console.log('✅ Display name updated successfully');
        } catch (error) {
            console.error("❌ Failed to update display name:", error);
            toast.error(error.message || translations.errorUpdateFailed);
            
            // ✅ REVERT: Restore previous value on error
            if (appearance) {
                setDisplayName(appearance.displayName || '');
                updateAppearance('displayName', appearance.displayName || '');
            }
        } finally {
            setIsUpdatingName(false);
        }
    };

    // Handle bio updates
    const handleBioUpdate = async (bio) => {
        if (!currentUser || isUpdatingBio) return;
        
        // Client-side validation
        if (bio.length > 500) {
            toast.error(translations.errorTooLong + ' (max 500 characters)');
            return;
        }

        // ✅ OPTIMISTIC UPDATE: Update context immediately
        updateAppearance('bio', bio);

        setIsUpdatingBio(true);
        try {
            await updateBio(bio);
            console.log('✅ Bio updated successfully');
        } catch (error) {
            console.error("❌ Failed to update bio:", error);
            toast.error(error.message || translations.errorUpdateFailed);
            
            // ✅ REVERT: Restore previous value on error
            if (appearance) {
                setMyBio(appearance.bio || '');
                updateAppearance('bio', appearance.bio || '');
            }
        } finally {
            setIsUpdatingBio(false);
        }
    };

    // Handle debounced display name updates
    useEffect(() => {
        // ✅ IMPROVED: Better initial load detection
        if (!appearance || isInitialLoad.current) {
            if (appearance) {
                isInitialLoad.current = false;
            }
            return;
        }
        
        // Only update if the value actually changed
        if (displayName !== appearance.displayName && displayName !== "") {
            handleDisplayNameUpdate(displayName);
        }
    }, [debounceDisplayName, appearance]);

    // Handle debounced bio updates
    useEffect(() => {
        if (!appearance || isInitialLoad.current) {
            return;
        }
        
        // Only update if the value actually changed
        if (myBio !== appearance.bio) {
            handleBioUpdate(myBio);
        }
    }, [debounceMyBio, appearance]);

    // ✅ LOADING: Show skeleton while context is loading
    if (!isInitialized || !currentUser || !appearance) {
        return (
            <div className="flex px-6 pb-6 pt-2 flex-col gap-2 animate-pulse">
                <div className="h-[58px] rounded-lg bg-gray-200"></div>
                <div className="h-[74px] rounded-lg bg-gray-200"></div>
            </div>
        );
    }

    return (
        <div className="flex px-6 pb-6 pt-2 flex-col gap-2">
            {/* Display Name Input */}
            <div className={`flex-1 relative pt-2 flex items-center rounded-lg bg-black bg-opacity-[0.05] focus-within:border-black focus-within:border-2 border border-transparent transition-opacity ${
                isUpdatingName ? 'opacity-75' : ''
            }`}>
                <input
                    type="text"
                    className="flex-1 px-4 placeholder-shown:px-3 py-4 sm:text-base text-sm font-semibold outline-none opacity-100 bg-transparent peer appearance-none"
                    placeholder=" "
                    onChange={(e) => setDisplayName(e.target.value)}
                    value={displayName}
                    maxLength={100}
                    disabled={isUpdatingName}
                />
                <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-sm text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-70 transition duration-[250] ease-linear">
                    {translations.profileTitle}
                </label>
                
                {/* Loading indicator for display name */}
                {isUpdatingName && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                )}
                
                {/* Character counter */}
                <div className="absolute right-3 bottom-1 text-xs text-gray-500">
                    {displayName.length}/100
                </div>
            </div>

            {/* Bio Textarea */}
            <div className={`flex-1 relative pt-2 flex items-center rounded-lg bg-black bg-opacity-[0.05] focus-within:border-black focus-within:border-[2px] border border-transparent transition-opacity ${
                isUpdatingBio ? 'opacity-75' : ''
            }`}>
                <textarea
                    className="flex-1 px-4 placeholder-shown:px-3 py-4 sm:text-md text-sm outline-none opacity-100 bg-transparent peer appearance-none resize-none"
                    cols="30"
                    rows="2"
                    onChange={(e) => setMyBio(e.target.value)}
                    value={myBio}
                    placeholder=" "
                    maxLength={500}
                    disabled={isUpdatingBio}
                ></textarea>
                <label className="absolute px-3 pointer-events-none top-[.25rem] left-1 text-sm text-main-green peer-placeholder-shown:top-2/4 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-slate-500 peer-placeholder-shown:left-0 opacity-70 transition duration-[250] ease-linear">
                    {translations.bio}
                </label>
                
                {/* Loading indicator for bio */}
                {isUpdatingBio && (
                    <div className="absolute right-10 top-4">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                )}
                
                {/* Character counter */}
                <div className="absolute right-3 bottom-1 text-xs text-gray-500">
                    {myBio.length}/500
                </div>
            </div>
        </div>
    );
}