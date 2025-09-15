/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/dashboard/(dashboard pages)/appearance/elements/ThemeCard.jsx
"use client"

import React, { useContext, useMemo } from "react";
import Image from "next/image";
import { useTranslation } from "@/lib/translation/useTranslation";
import { AppearanceContext } from "../AppearanceContext";
import { FaCheck } from "react-icons/fa6";

export default function ThemeCard({ type, pic, text }) {
    // ✅ STEP 1: Get data and functions from the context.
    // No more useAuth, no more direct API calls.
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);
    const { t, isInitialized } = useTranslation();

    // The component's own "name" is either the text prop or "Custom".
    const themeName = text || "Custom";

    // ✅ STEP 2: Determine if this card is the selected one by comparing with context.
    const isSelectedTheme = appearance?.selectedTheme === themeName;

    // --- Translations (Simplified) ---
    // We only need the translations relevant to this component.
    const displayName = useMemo(() => {
        if (!isInitialized) return themeName;
        // A simpler way to handle translation keys.
        const translationKey = `dashboard.appearance.themes.${themeName.toLowerCase().replace(/ /g, '_')}`;
        return t(translationKey, themeName); // Fallback to the English name
    }, [t, isInitialized, themeName]);

    // ✅ STEP 3: The click handler is now incredibly simple.
    const handleUpdateTheme = () => {
        // If it's already selected or currently saving, do nothing.
        if (isSelectedTheme || isSaving) return;

        // Tell the parent page what changed. The parent will handle saving.
        updateAppearance('selectedTheme', themeName);
    };

    // --- Render Logic ---
    
    // Skeleton loader if the parent context isn't ready yet.
    if (!appearance) {
        return (
            <div className="min-w-[8rem] flex-1 items-center flex flex-col animate-pulse">
                <div className="w-full h-[13rem] bg-gray-200 rounded-lg"></div>
                <div className="h-4 w-16 bg-gray-200 rounded-md mt-3"></div>
            </div>
        );
    }

    // Determine the card's visual style
    const isCustomCard = type !== 1;

    return (
        <div className={`min-w-[8rem] flex-1 items-center flex flex-col group ${isSaving ? 'pointer-events-none opacity-75' : ''}`}>
            <div 
                className={`w-full h-[13rem] rounded-lg relative grid place-items-center cursor-pointer overflow-hidden transition-all duration-200 ${
                    isSaving 
                        ? 'cursor-not-allowed' 
                        : 'group-hover:scale-105 group-active:scale-90'
                } ${isCustomCard ? 'border border-dashed border-black group-hover:bg-black/5' : 'border'}`}
                onClick={handleUpdateTheme}
            >
                {isCustomCard ? (
                    <span className="uppercase max-w-[5rem] sm:text-xl text-base text-center font-semibold">
                        {t('dashboard.appearance.themes.create_your_own', 'Create Your Own')}
                    </span>
                ) : (
                    <Image 
                        src={pic} 
                        alt={`${displayName} theme preview`} 
                        height={256} // Use smaller, more specific sizes for performance
                        width={160}
                        className="min-w-full h-full object-cover" 
                        priority={isSelectedTheme}
                    />
                )}
                
                {/* Selection indicator */}
                {isSelectedTheme && (
                    <div className="h-full w-full absolute top-0 left-0 bg-black bg-opacity-50 grid place-items-center z-10 text-white text-3xl">
                        <FaCheck />
                    </div>
                )}
            </div>
            <span className="py-3 text-sm font-medium">{displayName}</span>
        </div>
    );
}