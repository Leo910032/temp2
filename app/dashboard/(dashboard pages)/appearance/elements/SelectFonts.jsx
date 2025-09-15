/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/dashboard/(dashboard pages)/appearance/elements/SelectFonts.jsx
"use client"

import React, { useState, useContext } from "react";
import { AppearanceContext } from "../AppearanceContext";
import { availableFonts_Classic } from "@/lib/FontsList";
import FontsGallery from "../components/FontsGallery";

export default function SelectFonts() {
    // ✅ Get appearance data from the context.
    const { appearance, isSaving } = useContext(AppearanceContext);

    // ✅ Local UI state ONLY for showing/hiding the modal.
    const [openFontGallery, setOpenFontGallery] = useState(false);

    // Derive the selected font directly from the context data.
    const fontIndex = appearance?.fontType || 0;
    const validIndex = Math.max(0, Math.min(fontIndex, availableFonts_Classic.length - 1));
    const selectedFont = availableFonts_Classic[validIndex];
    
    return (
        <>
            <div 
                className={`${selectedFont?.class || 'font-sans'} w-full my-2 group rounded-lg py-5 px-4 border shadow-sm flex items-center gap-4 transition-all ${
                    isSaving
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer hover:bg-gray-50 active:scale-95'
                }`} 
                onClick={() => !isSaving && setOpenFontGallery(true)}
            >
                <span className="p-3 rounded-md bg-gray-100 text-xl font-semibold">
                    Aa
                </span>
                <span className="font-semibold flex-1 truncate">
                    {selectedFont?.name || 'Default Font'}
                </span>
            </div>
            
            {/* The gallery is now controlled by local state, and it will handle its own logic. */}
            {openFontGallery && <FontsGallery setOpenFontGallery={setOpenFontGallery} />}
        </>
    );
}