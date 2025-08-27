"use client"
import { useContext, useEffect, useState, useMemo } from "react";
import { FaCheck, FaX } from "react-icons/fa6";
import { AppearanceContext } from "../AppearanceContext";
import { useDebounce } from "@/LocalHooks/useDebounce";
import { availableFonts_Classic } from "@/lib/FontsList";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function FontsGallery({ setOpenFontGallery }) {
    const { appearance, updateAppearance } = useContext(AppearanceContext);
    const { t, isInitialized } = useTranslation();

    // ✅ FIXED: Use array index instead of fontType ID
    const [selectedFontIndex, setSelectedFontIndex] = useState(appearance?.fontType || 0);
    const [fontList, setFontList] = useState(availableFonts_Classic);
    const [searchParam, setSearchParam] = useState("");
    const debouncedSearch = useDebounce(searchParam, 300);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.appearance.fonts_gallery.title'),
            searchPlaceholder: t('dashboard.appearance.fonts_gallery.search_placeholder'),
            classicSection: t('dashboard.appearance.fonts_gallery.classic_section'),
            selectedStatus: t('dashboard.appearance.fonts_gallery.selected_status'),
            noFontsFound: t('dashboard.appearance.fonts_gallery.no_fonts_found'),
            saveButton: t('dashboard.appearance.fonts_gallery.save_button'),
        };
    }, [t, isInitialized]);

    // ✅ FIXED: Initialize selected font index when appearance loads
    useEffect(() => {
        if (appearance?.fontType !== undefined) {
            setSelectedFontIndex(appearance.fontType);
        }
    }, [appearance?.fontType]);
    
    // Effect for filtering the font list based on search
    useEffect(() => {
        if (debouncedSearch) {
            const filtered = availableFonts_Classic.filter(font => 
                font.name.toLowerCase().includes(debouncedSearch.toLowerCase())
            );
            setFontList(filtered);
        } else {
            setFontList(availableFonts_Classic);
        }
    }, [debouncedSearch]);

    // ✅ FIXED: Handle font selection by array index
    const handleFontSelect = (fontIndex) => {
        setSelectedFontIndex(fontIndex);
    };

    // ✅ FIXED: Save using array index
    const handleSave = () => {
        if (selectedFontIndex !== appearance?.fontType) {
            // Update using array index (0-based)
            updateAppearance('fontType', selectedFontIndex);
            console.log(`🔤 Font updated to index ${selectedFontIndex}: ${availableFonts_Classic[selectedFontIndex]?.name}`);
        }
        setOpenFontGallery(false);
    };

    if (!isInitialized || !appearance) {
        return (
            <div className="fixed inset-0 bg-white/50 grid place-items-center z-[9999]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 h-screen w-screen grid place-items-center z-[9999]">
            <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={() => setOpenFontGallery(false)}></div>

            <div className="relative flex flex-col gap-3 sm:h-[41.5rem] h-[90vh] sm:w-[31.90rem] w-[90vw] bg-white rounded-3xl shadow-lg p-5">
                <div className="flex items-center justify-center font-semibold text-center relative py-2">
                    {translations.title}
                    <button className="absolute right-0 p-2" onClick={() => setOpenFontGallery(false)}>
                        <FaX className="text-sm" />
                    </button>
                </div>
                
                <input
                    type="text"
                    className="w-full px-4 py-3 text-base outline-none bg-gray-100 rounded-lg border-2 border-transparent focus:border-blue-500"
                    placeholder={translations.searchPlaceholder}
                    value={searchParam}
                    onChange={(e) => setSearchParam(e.target.value)}
                />

                <div className="flex-1 overflow-y-auto pr-2">
                    <section className="flex flex-col gap-1">
                        {fontList.length > 0 && (
                            <span className="px-2 py-3 text-sm font-medium text-gray-500">
                                {translations.classicSection}
                            </span>
                        )}
                        
                        {/* ✅ FIXED: Use array index for comparison */}
                        {fontList.map((fontItem, index) => {
                            // Find the original index in the full array for selection comparison
                            const originalIndex = availableFonts_Classic.findIndex(f => f.id === fontItem.id);
                            const isSelected = selectedFontIndex === originalIndex;
                            
                            return (
                                <div 
                                    className={`${fontItem.class} select-none px-5 py-4 flex items-center justify-between cursor-pointer w-full rounded-xl transition-colors ${
                                        isSelected ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100"
                                    }`} 
                                    key={fontItem.id} 
                                    onClick={() => handleFontSelect(originalIndex)}
                                >
                                    <span className="font-semibold">
                                        {fontItem.name}
                                    </span>
                                    {isSelected && (
                                        <span className="flex items-center gap-2 text-sm font-semibold">
                                            <FaCheck />
                                            {translations.selectedStatus}
                                        </span>
                                    )}
                                </div>
                            );
                        })}

                        {fontList.length === 0 && (
                            <div className="w-full text-center text-gray-500 py-10">
                                {translations.noFontsFound}
                            </div>
                        )}
                    </section>
                </div>
                
                <button 
                    className="w-full p-4 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-transform" 
                    onClick={handleSave}
                >
                    {translations.saveButton}
                </button>
            </div>
        </div>
    );
}