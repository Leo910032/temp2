// app/dashboard/(dashboard pages)/appearance/components/Banners.jsx
"use client"
import React, { useState, useMemo, useContext } from "react";
import BannerCard from "../elements/BannerCard";
import ColorPickerFlat from "../elements/ColorPickerFlat.jsx";
import GradientPicker from "../elements/GradientPicker.jsx";
import { useTranslation } from "@/lib/translation/useTranslation";
import { AppearanceContext } from "../AppearanceContext";

export const bannerContext = React.createContext();

export default function Banners() {
    const { t, isInitialized } = useTranslation();
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showGradientPicker, setShowGradientPicker] = useState(false);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            flatColour: t('dashboard.appearance.banners.flat_colour') || 'Flat Color',
            gradient: t('dashboard.appearance.banners.gradient') || 'Gradient',
            image: t('dashboard.appearance.banners.image') || 'Image',
            video: t('dashboard.appearance.banners.video') || 'Video',
            none: t('dashboard.appearance.banners.none') || 'No Banner',
            corporate: t('dashboard.appearance.banners.corporate') || 'Corporate',
            creative: t('dashboard.appearance.banners.creative') || 'Creative',
            minimal: t('dashboard.appearance.banners.minimal') || 'Minimal',
        };
    }, [t, isInitialized]);

    // Generate dynamic gradient for banner preview
    const dynamicBannerGradient = useMemo(() => {
        if (!appearance) {
            return "linear-gradient(to right, #667eea, #764ba2)";
        }
        
        const gradientColorStart = appearance.bannerGradientStart || '#667eea';
        const gradientColorEnd = appearance.bannerGradientEnd || '#764ba2';
        const gradientDirection = appearance.bannerGradientDirection || 'to right';
        
        const gradient = `linear-gradient(${gradientDirection}, ${gradientColorStart}, ${gradientColorEnd})`;
        
        console.log("🎨 Banners: Generated dynamic banner gradient:", gradient);
        
        return gradient;
    }, [appearance]);

    // Check what banner type is currently selected
    const selectedBannerType = appearance?.bannerType;

    // Show appropriate picker based on selection
    const showGradientPickerUI = selectedBannerType === 'Gradient' && showGradientPicker;
    const showColorPickerUI = selectedBannerType === 'Color' && showColorPicker;

    // Handle banner color change
    const handleBannerColorChange = (color) => {
        console.log('🎨 Banners: Updating bannerColor to:', color);
        updateAppearance('bannerColor', color);
    };

    if (!isInitialized) {
        return (
            <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6 animate-pulse">
                <div className="grid sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] sm:gap-4 gap-2 w-full">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex-1 flex-col items-center flex">
                           <div className="h-[8rem] w-full bg-gray-200 rounded-lg"></div>
                           <div className="h-4 w-20 bg-gray-200 rounded-md mt-3"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <bannerContext.Provider value={{ setShowColorPicker, setShowGradientPicker }}>
            <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6">
                {/* Debug info in development */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-gray-500 mb-2 p-2 bg-yellow-50 rounded">
                        Debug - Current banner: {selectedBannerType} | Color: {appearance?.bannerColor}
                    </div>
                )}
                
                <div className="grid sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] sm:gap-4 gap-2 w-full">
                    {/* No Banner Option */}
                    <BannerCard 
                        identifier={"None"} 
                        text={translations.none}
                        isNone={true}
                    />
                    
                    {/* Color Banner */}
                    <BannerCard 
                        identifier={"Color"} 
                        text={translations.flatColour} 
                        colorValue={appearance?.bannerColor || "#3B82F6"}
                    />
                    
                    {/* Gradient Banner */}
                    <BannerCard 
                        identifier={"Gradient"} 
                        text={translations.gradient} 
                        backImg={dynamicBannerGradient} 
                    />
                    
                    {/* Image Banner */}
                    <BannerCard 
                        identifier={"Image"} 
                        text={translations.image}
                    />
                    
                    {/* Video Banner */}
                    <BannerCard 
                        identifier={"Video"} 
                        text={translations.video}
                    />
                    
                    {/* Preset Banners */}
                    <BannerCard 
                        identifier={"Corporate"} 
                        text={translations.corporate} 
                        backImg={'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'} 
                    />
                    
                    <BannerCard 
                        identifier={"Creative"} 
                        text={translations.creative} 
                        backImg={'linear-gradient(45deg, #f093fb 0%, #f5576c 100%)'} 
                    />
                    
                    <BannerCard 
                        identifier={"Minimal"} 
                        text={translations.minimal} 
                        backImg={'linear-gradient(to right, #ffecd2 0%, #fcb69f 100%)'} 
                    />
                </div>
                
                {/* Show appropriate picker based on selected banner type */}
                {showGradientPickerUI && (
                    <div className="mt-6">
                        <h4 className="text-sm font-semibold mb-3">Customize Banner Gradient</h4>
                        <BannerGradientPicker />
                    </div>
                )}
                
                {showColorPickerUI && (
                    <div className="mt-6">
                        <h4 className="text-sm font-semibold mb-3">Customize Banner Color</h4>
                        <ColorPickerFlat 
                            currentColor={appearance?.bannerColor || '#3B82F6'}
                            onColorChange={handleBannerColorChange}
                            disabled={isSaving}
                            fieldName="Banner Color"
                        />
                    </div>
                )}
            </div>
        </bannerContext.Provider>
    );
}

// Banner-specific gradient picker component
function BannerGradientPicker() {
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);
    const [showCustomColors, setShowCustomColors] = useState(false);

    // Banner gradient presets
    const bannerGradientPresets = [
        { name: 'Professional Blue', start: '#667eea', end: '#764ba2', direction: 'to right' },
        { name: 'Sunset Orange', start: '#ff9a9e', end: '#fad0c4', direction: 'to right' },
        { name: 'Ocean Breeze', start: '#a8edea', end: '#fed6e3', direction: 'to right' },
        { name: 'Purple Haze', start: '#d299c2', end: '#fef9d7', direction: 'to right' },
        { name: 'Corporate Gray', start: '#bdc3c7', end: '#2c3e50', direction: 'to right' },
        { name: 'Green Energy', start: '#56ab2f', end: '#a8e6cf', direction: 'to right' },
        { name: 'Deep Space', start: '#000046', end: '#1cb5e0', direction: 'to right' },
        { name: 'Rose Gold', start: '#f7797d', end: '#fbd786', direction: 'to right' },
    ];

    const currentStart = appearance?.bannerGradientStart || '#667eea';
    const currentEnd = appearance?.bannerGradientEnd || '#764ba2';
    const currentDirection = appearance?.bannerGradientDirection || 'to right';

    const handlePresetSelect = (preset) => {
        updateAppearance({
            bannerGradientStart: preset.start,
            bannerGradientEnd: preset.end,
            bannerGradientDirection: preset.direction
        });
    };

    const handleColorChange = (colorType, color) => {
        const field = colorType === 'start' ? 'bannerGradientStart' : 'bannerGradientEnd';
        updateAppearance(field, color);
    };

    const handleDirectionChange = (direction) => {
        updateAppearance('bannerGradientDirection', direction);
    };

    return (
        <div className="space-y-4">
            {/* Current Gradient Preview */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div 
                    className="h-16 w-32 rounded-lg border shadow-sm"
                    style={{ 
                        backgroundImage: `linear-gradient(${currentDirection}, ${currentStart}, ${currentEnd})`
                    }}
                ></div>
                <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">Current Banner Gradient</div>
                    <div className="text-xs text-gray-500">
                        {currentStart} → {currentEnd}
                    </div>
                </div>
                <button
                    className="px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={() => setShowCustomColors(!showCustomColors)}
                >
                    {showCustomColors ? 'Hide' : 'Customize'}
                </button>
            </div>

            {/* Gradient Presets */}
            <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Quick Presets</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {bannerGradientPresets.map((preset) => (
                        <button
                            key={preset.name}
                            className="h-12 w-full rounded border hover:scale-105 transition-transform shadow-sm"
                            style={{
                                backgroundImage: `linear-gradient(${preset.direction}, ${preset.start}, ${preset.end})`
                            }}
                            onClick={() => handlePresetSelect(preset)}
                            title={preset.name}
                        ></button>
                    ))}
                </div>
            </div>

            {/* Direction Options */}
            <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Gradient Direction</div>
                <div className="flex gap-2 flex-wrap">
                    {[
                        { label: 'Left to Right', value: 'to right' },
                        { label: 'Top to Bottom', value: 'to bottom' },
                        { label: 'Diagonal ↘', value: '135deg' },
                        { label: 'Diagonal ↙', value: '45deg' },
                    ].map((direction) => (
                        <button
                            key={direction.value}
                            className={`px-3 py-2 text-xs border rounded transition-colors ${
                                currentDirection === direction.value
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                            }`}
                            onClick={() => handleDirectionChange(direction.value)}
                        >
                            {direction.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Color Controls */}
            {showCustomColors && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600">Start Color</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={currentStart}
                                onChange={(e) => handleColorChange('start', e.target.value)}
                                className="h-10 w-16 rounded border cursor-pointer"
                                disabled={isSaving}
                            />
                            <input
                                type="text"
                                value={currentStart}
                                onChange={(e) => handleColorChange('start', e.target.value)}
                                className="flex-1 px-3 py-2 text-xs border rounded focus:ring-2 focus:ring-blue-500"
                                placeholder="#667eea"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600">End Color</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={currentEnd}
                                onChange={(e) => handleColorChange('end', e.target.value)}
                                className="h-10 w-16 rounded border cursor-pointer"
                                disabled={isSaving}
                            />
                            <input
                                type="text"
                                value={currentEnd}
                                onChange={(e) => handleColorChange('end', e.target.value)}
                                className="flex-1 px-3 py-2 text-xs border rounded focus:ring-2 focus:ring-blue-500"
                                placeholder="#764ba2"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}