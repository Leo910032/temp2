/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/dashboard/(dashboard pages)/appearance/components/FontsGallery.jsx
"use client"

import React, { useContext } from 'react';
import { FaX } from 'react-icons/fa6';
import { AppearanceContext } from '../AppearanceContext';
import { availableFonts_Classic } from '@/lib/FontsList';
import { toast } from 'react-hot-toast';

export default function FontsGallery({ setOpenFontGallery }) {
    // ✅ Get data and the update function from the context.
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);

    // ✅ The click handler is now simple and synchronous.
    const handleFontClick = (fontIndex) => {
        if (isSaving) {
            toast.error("Please wait for the current save to complete.");
            return;
        }

        // Tell the parent page that the font has changed.
        updateAppearance('fontType', fontIndex);

        // Close the modal. The parent page will handle the debounced save.
        setOpenFontGallery(false);
    };

    return (
        <div className="fixed top-0 left-0 h-screen w-screen z-[9999999999999] grid place-items-center">
            <div 
                className="absolute h-full w-full bg-black/25 backdrop-blur-sm"
                onClick={() => setOpenFontGallery(false)}
            ></div>
            <div className="sm:max-w-2xl w-11/12 bg-white rounded-xl relative py-6 flex flex-col gap-4">
                <div 
                    className="absolute top-4 right-4 text-gray-500 hover:bg-gray-100 p-2 rounded-full cursor-pointer"
                    onClick={() => setOpenFontGallery(false)}
                >
                    <FaX />
                </div>
                <div className="w-full text-center">
                    <span className="font-semibold text-2xl">Fonts</span>
                </div>
                <div className="w-11/12 mx-auto grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
                    {availableFonts_Classic.map((font, index) => (
                        <div 
                            key={index} 
                            className={`py-6 px-4 rounded-lg text-center font-medium border text-sm transition-all ${
                                isSaving
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'cursor-pointer hover:bg-gray-100 active:scale-95'
                            } ${
                                appearance?.fontType === index
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200'
                            }`}
                            onClick={() => handleFontClick(index)}
                        >
                            <span className={font.class}>{font.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}