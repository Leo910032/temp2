// Fixed ColorPickerFlat.jsx - Now supports any color field via props

"use client"
import { useAuth } from "@/contexts/AuthContext";
import { useContext, useState, useMemo } from "react";
import { AppearanceContext } from "../AppearanceContext";
import { toast } from "react-hot-toast";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function ColorPickerFlat({ 
    currentColor, 
    onColorChange, 
    disabled = false,
    fieldName = "color" // For display purposes
}) {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const [isUpdating, setIsUpdating] = useState(false);

    // Pre-compute translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            colorPresets: t('dashboard.appearance.color_picker.color_presets') || 'Color Presets',
            customColor: t('dashboard.appearance.color_picker.custom_color') || 'Custom Color',
            errorNotAuth: t('dashboard.appearance.color_picker.error_not_authenticated') || 'Please log in to update colors',
            updating: t('dashboard.appearance.color_picker.updating') || 'Updating color...',
        };
    }, [t, isInitialized]);

    // Color presets - versatile colors for buttons, backgrounds, etc.
    const colorPresets = [
        { name: 'White', color: '#FFFFFF' },
        { name: 'Light Gray', color: '#F5F5F5' },
        { name: 'Dark Gray', color: '#374151' },
        { name: 'Black', color: '#000000' },
        { name: 'Navy', color: '#1E3A8A' },
        { name: 'Blue', color: '#3B82F6' },
        { name: 'Light Blue', color: '#93C5FD' },
        { name: 'Teal', color: '#14B8A6' },
        { name: 'Green', color: '#10B981' },
        { name: 'Light Green', color: '#86EFAC' },
        { name: 'Yellow', color: '#F59E0B' },
        { name: 'Orange', color: '#EA580C' },
        { name: 'Red', color: '#DC2626' },
        { name: 'Pink', color: '#EC4899' },
        { name: 'Purple', color: '#8B5CF6' },
        { name: 'Indigo', color: '#6366F1' },
    ];

    const handleColorChange = (color) => {
        if (!currentUser) {
            toast.error(translations.errorNotAuth);
            return;
        }
        
        if (disabled) return;
        
        console.log(`🎨 ColorPickerFlat: Updating ${fieldName} to:`, color);
        
        // Call the parent's color change handler
        if (onColorChange) {
            onColorChange(color);
        }
    };

    const handlePresetSelect = (preset) => {
        if (!currentUser || disabled) return;
        
        handleColorChange(preset.color);
        
        toast.success(`${preset.name} applied!`, {
            duration: 1500,
            icon: '🎨'
        });
    };

    // Don't render if not authenticated
    if (!currentUser || !isInitialized) {
        return null;
    }

    const showLoading = isUpdating || disabled;

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

            {/* Current Color Preview */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div 
                    className="h-16 w-24 rounded-lg border shadow-sm"
                    style={{ backgroundColor: currentColor || '#FFFFFF' }}
                ></div>
                <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">Current {fieldName}</div>
                    <div className="text-xs text-gray-500">
                        {currentColor || '#FFFFFF'}
                    </div>
                </div>
            </div>

            {/* Color Presets */}
            <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700">{translations.colorPresets}</div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {colorPresets.map((preset) => (
                        <button
                            key={preset.name}
                            className={`h-10 w-full rounded border shadow-sm hover:scale-105 active:scale-95 transition-transform ${
                                currentColor === preset.color ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            style={{ backgroundColor: preset.color }}
                            onClick={() => handlePresetSelect(preset)}
                            title={preset.name}
                            disabled={disabled}
                        >
                            {currentColor === preset.color && (
                                <div className="text-white text-xs font-bold drop-shadow-md">
                                    ✓
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Color Input */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                <div className="text-sm font-medium text-gray-700">{translations.customColor}</div>
                
                <div className="flex items-center gap-3">
                    <input
                        type="color"
                        value={currentColor || '#FFFFFF'}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="h-12 w-20 rounded border cursor-pointer disabled:cursor-not-allowed"
                        title="Pick a custom color"
                        disabled={disabled}
                    />
                    <input
                        type="text"
                        value={currentColor || '#FFFFFF'}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="#FFFFFF"
                        pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                        disabled={disabled}
                    />
                </div>
                
                <div className="text-xs text-gray-500">
                    Enter a hex color code (e.g., #FF5733) or use the color picker
                </div>
            </div>
        </div>
    );
}