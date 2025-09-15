/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/dashboard/(dashboard pages)/appearance/components/ChristmasAccessories.jsx
"use client"

import React, { useContext, useMemo, useState } from "react";
import { useTranslation } from "@/lib/translation/useTranslation";
import AssestCardVideo from "../elements/AssestCardVideo";
import { AppearanceContext } from "../AppearanceContext";

export default function ChristmasAccessories() {
    const { t, isInitialized } = useTranslation();
    
    // ✅ STEP 1: Get data and functions from the context.
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);

    // Translations (no change needed here)
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            snowFall: t('dashboard.appearance.christmas.snow_fall') || 'Snow Fall',
        };
    }, [t, isInitialized]);

    // ✅ STEP 2: Simplify the click handler.
    // It no longer needs to be async or handle its own loading state.
    const handleAccessoryClick = (accessoryType) => {
        // Prevent clicking if a save is already in progress.
        if (isSaving) return;
        
        // Check if the clicked accessory is already active.
        const currentAccessory = appearance?.christmasAccessory;
        const newAccessory = currentAccessory === accessoryType ? null : accessoryType;

        // Tell the parent page about the change. The parent will handle saving.
        updateAppearance('christmasAccessory', newAccessory);
    };

    // ✅ STEP 3: Handle the loading state from the context.
    if (!appearance) {
        return (
            <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6 animate-pulse">
                <div className="grid sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] sm:gap-4 gap-2 w-full">
                    <div className="h-[10rem] bg-gray-200 rounded-lg"></div>
                </div>
            </div>
        );
    }

    return (
        <div className={`w-full bg-white rounded-3xl my-3 flex flex-col p-6 relative transition-opacity ${isSaving ? 'opacity-75' : ''}`}>
            <div className="grid sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] sm:gap-4 gap-2 w-full">
                <AssestCardVideo 
                    coverImg={"https://linktree.sirv.com/Images/Christmas/videoframe_1211.png"} 
                    src={"https://linktree.sirv.com/Images/Christmas/Snow_Falling_Animation_Black_and_Green_Screen_Background.mp4"} 
                    type={"video/mp4"} 
                    text={translations.snowFall}
                    onClick={() => handleAccessoryClick("Snow Fall")}
                    disabled={isSaving}
                    // ✅ Pass down a prop to show if it's selected
                    isSelected={appearance.christmasAccessory === "Snow Fall"}
                />
                {/* Add more Christmas accessories here */}
            </div>
        </div>
    );
}

// You had a duplicate `AssestCardVideo` component definition. 
// We should assume it lives in its own file. I have removed it from here.
// Make sure it is imported correctly from "../elements/AssestCardVideo".