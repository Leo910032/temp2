"use client"
import React, { useState, useContext } from "react";
import { AppearanceContext } from "../AppearanceContext";
import { availableFonts_Classic } from "@/lib/FontsList";
import FontsGallery from "../components/FontsGallery";

export default function SelectFonts() {
    const { appearance } = useContext(AppearanceContext);
    const [openFontGallery, setOpenFontGallery] = useState(false);

    // ✅ FIXED: Use array index directly instead of treating fontType as ID
    // appearance.fontType should be the array index (0-based)
    const fontIndex = appearance?.fontType || 0;
    
    // ✅ ENSURE INDEX IS VALID: Prevent out-of-bounds access
    const validIndex = Math.max(0, Math.min(fontIndex, availableFonts_Classic.length - 1));
    const selectedFont = availableFonts_Classic[validIndex];
    
    // ✅ DEBUG: Log current selection
    console.log(`🔤 SelectFonts: fontType=${appearance?.fontType}, using index=${validIndex}, font=${selectedFont?.name}`);
    
    return (
        <>
            <div 
                className={`${selectedFont?.class || 'font-sans'} w-full my-2 group rounded-lg py-5 px-4 border shadow-sm flex items-center gap-4 cursor-pointer hover:bg-gray-50 active:scale-95 transition-all`} 
                onClick={() => setOpenFontGallery(true)}
            >
                <span className="p-3 rounded-md bg-gray-100 text-xl font-semibold">
                    Aa
                </span>
                <span className="font-semibold flex-1 truncate">
                    {selectedFont?.name || 'Default Font'}
                </span>
                
                {/* ✅ DEBUG INFO: Show current index (remove in production) */}
                <span className="text-xs text-gray-400 hidden">
                    idx: {validIndex}
                </span>
            </div>
            
            {openFontGallery && <FontsGallery setOpenFontGallery={setOpenFontGallery} />}
        </>
    );
}