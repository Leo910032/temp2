/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/dashboard/(dashboard pages)/appearance/elements/GradientPicker.jsx - Enhanced with Color Selection
"use client"

import { useAuth } from "@/contexts/AuthContext";
import { useContext, useState, useMemo } from "react";
import { AppearanceContext } from "../AppearanceContext";
import { toast } from "react-hot-toast";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function GradientPicker() {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showColorPickers, setShowColorPickers] = useState(false);

    // Pre-compute translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            gradientDown: t('dashboard.appearance.gradient_picker.gradient_down') || 'Gradient down',
            gradientUp: t('dashboard.appearance.gradient_picker.gradient_up') || 'Gradient up',
            startColor: t('dashboard.appearance.gradient_picker.start_color') || 'Start Color',
            endColor: t('dashboard.appearance.gradient_picker.end_color') || 'End Color',
            customizeColors: t('dashboard.appearance.gradient_picker.customize_colors') || 'Customize Colors',
            errorNotAuth: t('dashboard.appearance.gradient_picker.error_not_authenticated') || 'Please log in to update gradients',
            errorUpdateFailed: t('dashboard.appearance.gradient_picker.error_update_failed') || 'Failed to update gradient',
            updating: t('dashboard.appearance.gradient_picker.updating') || 'Updating gradient...',
            success: t('dashboard.appearance.gradient_picker.success') || 'Gradient updated!'
        };
    }, [t, isInitialized]);

    // Get current gradient settings from context with defaults
    const currentDirection = appearance?.gradientDirection || 0;
    const gradientColorStart = appearance?.gradientColorStart || '#FFFFFF';
    const gradientColorEnd = appearance?.gradientColorEnd || '#000000';

    // Common gradient presets
    const gradientPresets = [
        { name: 'Classic', start: '#FFFFFF', end: '#000000' },
        { name: 'Sunset', start: '#FF6B6B', end: '#FFE66D' },
        { name: 'Ocean', start: '#74B9FF', end: '#0984E3' },
        { name: 'Forest', start: '#A8E6CF', end: '#00B894' },
        { name: 'Purple', start: '#E17CEE', end: '#6C5CE7' },
        { name: 'Fire', start: '#FD79A8', end: '#E84393' },
        { name: 'Sky', start: '#DDA0DD', end: '#87CEEB' },
        { name: 'Night', start: '#2C3E50', end: '#000000' },
    ];

    const handleUpdateGradient = async (direction) => {
        if (!currentUser || isUpdating || direction === currentDirection) {
            return;
        }

        setIsUpdating(true);
        
        try {
            updateAppearance('gradientDirection', direction);
            console.log(`✅ Gradient direction updated to: ${direction}`);
            
        } catch (error) {
            console.error("Failed to update gradient direction:", error);
            updateAppearance('gradientDirection', currentDirection);
            toast.error(error.message || translations.errorUpdateFailed);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleColorChange = (colorType, color) => {
        if (!currentUser) return;
        
        const field = colorType === 'start' ? 'gradientColorStart' : 'gradientColorEnd';
        updateAppearance(field, color);
    };

    const handlePresetSelect = (preset) => {
        if (!currentUser) return;
        
        updateAppearance({
            gradientColorStart: preset.start,
            gradientColorEnd: preset.end
        });
        
        toast.success(`${preset.name} gradient applied!`, {
            duration: 2000,
            icon: '🎨'
        });
    };

    // Generate current gradient style
    const currentGradientStyle = {
        backgroundImage: `linear-gradient(${currentDirection === 0 ? 'to bottom' : 'to top'}, ${gradientColorStart}, ${gradientColorEnd})`
    };

    // Don't render if not authenticated or appearance data not loaded
    if (!currentUser || !isInitialized || !appearance) {
        return null;
    }

    const showLoading = isUpdating || isSaving;

    return (
        <div className={`my-4 grid gap-4 relative ${showLoading ? 'opacity-75 pointer-events-none' : ''}`}>
            {/* Loading overlay */}
            {showLoading && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                    <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-600">{translations.updating}</span>
                    </div>
                </div>
            )}

            {/* Current Gradient Preview */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div 
                    className="h-16 w-24 rounded-lg border shadow-sm"
                    style={currentGradientStyle}
                ></div>
                <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">Current Gradient</div>
                    <div className="text-xs text-gray-500">
                        {currentDirection === 0 ? 'Gradient Down' : 'Gradient Up'} • {gradientColorStart} to {gradientColorEnd}
                    </div>
                </div>
                <button
                    className="px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    onClick={() => setShowColorPickers(!showColorPickers)}
                >
                    {showColorPickers ? 'Hide' : 'Customize'}
                </button>
            </div>
                {/* Color Customization Panel */}
            {showColorPickers && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                    <div className="text-sm font-medium text-gray-700">Gradient Colors</div>
                    
                    {/* Gradient Presets */}
                    <div className="space-y-2">
                        <div className="text-xs text-gray-600">Quick Presets:</div>
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                            {gradientPresets.map((preset) => (
                                <button
                                    key={preset.name}
                                    className="h-8 w-full rounded border hover:scale-105 active:scale-95 transition-transform shadow-sm"
                                    style={{
                                        backgroundImage: `linear-gradient(${currentDirection === 0 ? 'to bottom' : 'to top'}, ${preset.start}, ${preset.end})`
                                    }}
                                    onClick={() => handlePresetSelect(preset)}
                                    title={preset.name}
                                ></button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Color Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-600">
                                {translations.startColor}
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={gradientColorStart}
                                    onChange={(e) => handleColorChange('start', e.target.value)}
                                    className="h-10 w-16 rounded border cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={gradientColorStart}
                                    onChange={(e) => handleColorChange('start', e.target.value)}
                                    className="flex-1 px-3 py-2 text-xs border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="#FFFFFF"
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-600">
                                {translations.endColor}
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={gradientColorEnd}
                                    onChange={(e) => handleColorChange('end', e.target.value)}
                                    className="h-10 w-16 rounded border cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={gradientColorEnd}
                                    onChange={(e) => handleColorChange('end', e.target.value)}
                                    className="flex-1 px-3 py-2 text-xs border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="#000000"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Direction Selection */}
            <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700">Gradient Direction</div>
                
                {/* Gradient Down Option */}
                <div 
                    className={`cursor-pointer flex items-center gap-3 w-fit transition-all duration-200 ${
                        showLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'
                    }`} 
                    onClick={() => !showLoading && handleUpdateGradient(0)}
                >
                    <div className={`h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 border transition-all duration-200 ${
                        currentDirection === 0 
                            ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-blue-600 after:rounded-full border-blue-600" 
                            : "border-gray-300 hover:border-gray-400"
                    }`}></div>
                    <div className="flex items-center text-sm">
                        <div 
                            className="h-8 w-8 rounded-lg mr-3 border" 
                            style={{ backgroundImage: 'linear-gradient(to bottom, #fff, rgba(0, 0, 0, 0.75))' }}
                        ></div>
                        <span className={`transition-colors duration-200 ${
                            currentDirection === 0 ? 'text-blue-600 font-medium' : 'opacity-80'
                        }`}>
                            {translations.gradientDown}
                        </span>
                    </div>
                </div>
                
                {/* Gradient Up Option */}
                <div 
                    className={`cursor-pointer flex gap-3 w-fit transition-all duration-200 ${
                        showLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'
                    }`} 
                    onClick={() => !showLoading && handleUpdateGradient(1)}
                >
                    <div className={`h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 border transition-all duration-200 ${
                        currentDirection === 1 
                            ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-blue-600 after:rounded-full border-blue-600" 
                            : "border-gray-300 hover:border-gray-400"
                        }`}></div>
                    <div className="flex items-center text-sm">
                        <div 
                            className="h-8 w-8 rounded-lg mr-3 border" 
                            style={{ backgroundImage: 'linear-gradient(to top, #fff, rgba(0, 0, 0, 0.75))' }}
                        ></div>                
                        <span className={`transition-colors duration-200 ${
                            currentDirection === 1 ? 'text-blue-600 font-medium' : 'opacity-80'
                        }`}>
                            {translations.gradientUp}
                        </span>
                    </div>
                </div>
            </div>

        
        </div>
    );
}