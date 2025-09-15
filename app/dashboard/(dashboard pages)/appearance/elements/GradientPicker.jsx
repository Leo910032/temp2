/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/dashboard/(dashboard pages)/appearance/elements/GradientPicker.jsx - API VERSION
"use client"

import { useAuth } from "@/contexts/AuthContext";
import { updateThemeButton } from "@/lib/services/serviceAppearance/client/appearanceService.js"; // ✅ NEW PATH
import { useContext, useState, useMemo } from "react";
import { AppearanceContext } from "../AppearanceContext";
import { toast } from "react-hot-toast";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function GradientPicker() {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const { appearance, updateAppearance } = useContext(AppearanceContext);
    const [isUpdating, setIsUpdating] = useState(false);

    // Pre-compute translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            gradientDown: t('dashboard.appearance.gradient_picker.gradient_down') || 'Gradient down',
            gradientUp: t('dashboard.appearance.gradient_picker.gradient_up') || 'Gradient up',
            errorNotAuth: t('dashboard.appearance.gradient_picker.error_not_authenticated') || 'Please log in to update gradients',
            errorUpdateFailed: t('dashboard.appearance.gradient_picker.error_update_failed') || 'Failed to update gradient',
            updating: t('dashboard.appearance.gradient_picker.updating') || 'Updating gradient...',
            success: t('dashboard.appearance.gradient_picker.success') || 'Gradient updated!'
        };
    }, [t, isInitialized]);

    // Get current gradient direction from context (0 = down, 1 = up)
    const currentDirection = appearance?.gradientDirection || 0;

    const handleUpdateGradient = async (direction) => {
        if (!currentUser) {
            toast.error(translations.errorNotAuth);
            return;
        }

        if (isUpdating || direction === currentDirection) {
            return; // Prevent multiple updates or unnecessary updates
        }

        setIsUpdating(true);
        
        try {
            // ✅ OPTIMISTIC UPDATE: Update context immediately
            updateAppearance('gradientDirection', direction);
            
            // Update on server
            await updateThemeGradientDirection(direction);
            
            console.log(`✅ Gradient direction updated to: ${direction}`);
            toast.success(translations.success, {
                duration: 2000,
                icon: '🎨'
            });
            
        } catch (error) {
            console.error("Failed to update gradient direction:", error);
            
            // ✅ REVERT: Restore previous value on error
            updateAppearance('gradientDirection', currentDirection);
            
            toast.error(error.message || translations.errorUpdateFailed);
        } finally {
            setIsUpdating(false);
        }
    };

    // Don't render if not authenticated or appearance data not loaded
    if (!currentUser || !isInitialized || !appearance) {
        return null;
    }

    return (
        <div className={`my-4 grid gap-3 relative ${isUpdating ? 'opacity-75 pointer-events-none' : ''}`}>
            {/* Loading overlay */}
            {isUpdating && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                    <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-600">{translations.updating}</span>
                    </div>
                </div>
            )}
            
            {/* Gradient Down Option */}
            <div 
                className={`cursor-pointer flex items-center gap-3 w-fit transition-all duration-200 ${
                    isUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'
                }`} 
                onClick={() => !isUpdating && handleUpdateGradient(0)}
            >
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 border transition-all duration-200 ${
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
                    isUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'
                }`} 
                onClick={() => !isUpdating && handleUpdateGradient(1)}
            >
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 border transition-all duration-200 ${
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
    );
}