// Fixed Backgrounds.jsx - Now passes correct props to ColorPickerFlat

"use client"
import React, { useState, useMemo, useContext } from "react";
import BackgroundCard from "../elements/BackgroundCard";
import ColorPickerFlat from "../elements/ColorPickerFlat.jsx";
import GradientPicker from "../elements/GradientPicker.jsx";
import { useTranslation } from "@/lib/translation/useTranslation";
import { AppearanceContext } from "../AppearanceContext";

export const backgroundContext = React.createContext();

export default function Backgrounds() {
    const { t, isInitialized } = useTranslation();
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);
    const [isGradient, setIsGradient] = useState(false);
    const [isColor, setIsColor] = useState(false);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            flatColour: t('dashboard.appearance.backgrounds.flat_colour'),
            gradient: t('dashboard.appearance.backgrounds.gradient'),
            image: t('dashboard.appearance.backgrounds.image'),
            video: t('dashboard.appearance.backgrounds.video'),
            polka: t('dashboard.appearance.backgrounds.polka'),
            stripe: t('dashboard.appearance.backgrounds.stripe'),
            waves: t('dashboard.appearance.backgrounds.waves'),
            zigZag: t('dashboard.appearance.backgrounds.zig_zag'),
        };
    }, [t, isInitialized]);

    // Generate dynamic gradient from user's appearance data
    const dynamicGradient = useMemo(() => {
        if (!appearance) {
            console.log("🔍 Backgrounds: No appearance data yet, using fallback gradient");
            return "linear-gradient(to top, #3d444b, #686d73)";
        }
        
        const gradientColorStart = appearance.gradientColorStart || '#FFFFFF';
        const gradientColorEnd = appearance.gradientColorEnd || '#000000';
        const gradientDirection = appearance.gradientDirection || 0;
        
        const direction = gradientDirection === 0 ? 'to bottom' : 'to top';
        const gradient = `linear-gradient(${direction}, ${gradientColorStart}, ${gradientColorEnd})`;
        
        console.log("🎨 Backgrounds: Generated dynamic gradient:", gradient);
        console.log("🎨 Appearance data:", { gradientColorStart, gradientColorEnd, gradientDirection });
        
        return gradient;
    }, [appearance]);

    // Check what background type is currently selected
    const selectedBackgroundType = appearance?.backgroundType;

    // Show appropriate picker based on selection
    const showGradientPicker = selectedBackgroundType === 'Gradient';
    const showColorPicker = selectedBackgroundType === 'Color';

    // Handle background color change
    const handleBackgroundColorChange = (color) => {
        console.log('🎨 Backgrounds: Updating backgroundColor to:', color);
        updateAppearance('backgroundColor', color);
    };

    // Get safe background color (only valid hex colors, not URLs)
    const getSafeBackgroundColor = () => {
        const bgColor = appearance?.backgroundColor || '#FFFFFF';
        // Check if it's a URL (contains http or firebasestorage)
        if (bgColor.includes('http') || bgColor.includes('firebasestorage')) {
            return '#FFFFFF'; // Return default color if it's a URL
        }
        // Validate it's a hex color
        if (!/^#[0-9A-Fa-f]{6}$/.test(bgColor)) {
            return '#FFFFFF';
        }
        return bgColor;
    };

    if (!isInitialized) {
        return (
            <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6 animate-pulse">
                <div className="grid sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] sm:gap-4 gap-2 w-full">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex-1 flex-col items-center flex">
                           <div className="h-[13rem] w-full bg-gray-200 rounded-lg"></div>
                           <div className="h-4 w-20 bg-gray-200 rounded-md mt-3"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <backgroundContext.Provider value={{ setIsGradient, setIsColor }}>
            <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6">
                {/* Debug info in development */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-gray-500 mb-2 p-2 bg-yellow-50 rounded">
                        Debug - Current gradient: {dynamicGradient} | Selected: {selectedBackgroundType}
                    </div>
                )}
                
                <div className="grid sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] sm:gap-4 gap-2 w-full">
                    <BackgroundCard identifier={"Color"} text={translations.flatColour} colorValue={getSafeBackgroundColor()} />
                    <BackgroundCard 
                        identifier={"Gradient"} 
                        text={translations.gradient} 
                        backImg={dynamicGradient} 
                    />
                    <BackgroundCard identifier={"Image"} text={translations.image} />
                    <BackgroundCard identifier={"Video"} text={translations.video} />
                    <BackgroundCard identifier={"Polka"} text={translations.polka} backImg={'url("https://linktree.sirv.com/Images/gif/selector-polka.51162b39945eaa9c181a.gif")'} />
                    <BackgroundCard identifier={"Stripe"} text={translations.stripe} backImg={'url("https://linktree.sirv.com/Images/gif/selector-stripe.19d28e1aac1e5a38452e.gif")'} />
                    <BackgroundCard identifier={"Waves"} text={translations.waves} backImg={'url("https://linktree.sirv.com/Images/gif/selector-waves.5cf0a8a65908cd433192.gif")'} />
                    <BackgroundCard identifier={"Zig Zag"} text={translations.zigZag} backImg={'url("https://linktree.sirv.com/Images/gif/selector-zigzag.0bfe34b10dd92cad79b9.gif")'} />
                </div>
                
                {/* Show appropriate picker based on selected background type */}
                {showGradientPicker && <GradientPicker />}
                {showColorPicker && (
                    <ColorPickerFlat
                        currentColor={getSafeBackgroundColor()}
                        onColorChange={handleBackgroundColorChange}
                        disabled={isSaving}
                        fieldName="Background Color"
                    />
                )}
            </div>
        </backgroundContext.Provider>
    );
}