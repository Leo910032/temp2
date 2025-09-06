// app/dashboard/(dashboard pages)/appearance/elements/ThemeCard.jsx - FIXED VERSION
"use client"
import { useAuth } from "@/contexts/AuthContext";
import { updateTheme, updateThemeTextColour } from "@/lib/services/appearanceService";
import { useTranslation } from "@/lib/translation/useTranslation";
import { AppearanceContext } from "../AppearanceContext";
import Image from "next/image";
import { useEffect, useState, useMemo, useContext } from "react"; // ✅ Add useContext
import { FaCheck } from "react-icons/fa6";
import { toast } from "react-hot-toast";

export default function ThemeCard({ type, pic, text }) {
    const { currentUser } = useAuth();
    const { t, isInitialized } = useTranslation();
    const { appearance, updateAppearance } = useContext(AppearanceContext); // ✅ Get data from context
    const [themeColor, setThemeColor] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);

    const specialThemes = ["New Mario", "Matrix"];

    // Pre-compute translations for theme names and messages
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            // Theme names (for display)
            custom: t('dashboard.appearance.themes.custom') || 'Custom',
            matrix: t('dashboard.appearance.themes.matrix') || 'Matrix',
            newMario: t('dashboard.appearance.themes.new_mario') || 'New Mario',
            pebbleBlue: t('dashboard.appearance.themes.pebble_blue') || 'Pebble Blue',
            lakeWhite: t('dashboard.appearance.themes.lake_white') || 'Lake White',
            lakeBlack: t('dashboard.appearance.themes.lake_black') || 'Lake Black',
            starryNight: t('dashboard.appearance.themes.starry_night') || 'Starry Night',
            rainbow: t('dashboard.appearance.themes.rainbow') || 'Rainbow',
            confetti: t('dashboard.appearance.themes.confetti') || 'Confetti',
            blocks3d: t('dashboard.appearance.themes.blocks_3d') || '3D Blocks',
            cloudRed: t('dashboard.appearance.themes.cloud_red') || 'Cloud Red',
            cloudGreen: t('dashboard.appearance.themes.cloud_green') || 'Cloud Green',
            cloudBlue: t('dashboard.appearance.themes.cloud_blue') || 'Cloud Blue',
            breezePink: t('dashboard.appearance.themes.breeze_pink') || 'Breeze Pink',
            breezeOrange: t('dashboard.appearance.themes.breeze_orange') || 'Breeze Orange',
            breezeGreen: t('dashboard.appearance.themes.breeze_green') || 'Breeze Green',
            pebbleYellow: t('dashboard.appearance.themes.pebble_yellow') || 'Pebble Yellow',
            pebblePink: t('dashboard.appearance.themes.pebble_pink') || 'Pebble Pink',
            // Messages
            updateSuccess: t('dashboard.appearance.themes.update_success') || 'Theme updated successfully!',
            updateError: t('dashboard.appearance.themes.update_error') || 'Failed to update theme',
            updating: t('dashboard.appearance.themes.updating') || 'Updating theme...',
            createYourOwn: t('dashboard.appearance.themes.create_your_own') || 'Create Your Own'
        };
    }, [t, isInitialized]);

    // Get translated theme name for display
    const getTranslatedThemeName = (themeName) => {
        const themeMap = {
            'Custom': translations.custom,
            'Matrix': translations.matrix,
            'New Mario': translations.newMario,
            'Pebble Blue': translations.pebbleBlue,
            'Lake White': translations.lakeWhite,
            'Lake Black': translations.lakeBlack,
            'Starry Night': translations.starryNight,
            'Rainbow': translations.rainbow,
            'Confetti': translations.confetti,
            '3D Blocks': translations.blocks3d,
            'Cloud Red': translations.cloudRed,
            'Cloud Green': translations.cloudGreen,
            'Cloud Blue': translations.cloudBlue,
            'Breeze Pink': translations.breezePink,
            'Breeze Orange': translations.breezeOrange,
            'Breeze Green': translations.breezeGreen,
            'Pebble Yellow': translations.pebbleYellow,
            'Pebble Pink': translations.pebblePink,
        };
        return themeMap[themeName] || themeName;
    };

    // ✅ FIXED: Get selection state from context instead of API call
    const themeName = text || "Custom";
    const isSelectedTheme = appearance?.selectedTheme === themeName;

    const handleUpdateTheme = async () => {
        if (!currentUser || isUpdating || !isInitialized) return;
        
        setIsUpdating(true);
        const displayName = getTranslatedThemeName(themeName);
        
        try {
            // ✅ OPTIMISTIC UPDATE: Update UI immediately
            updateAppearance('selectedTheme', themeName);
            if (themeColor) {
                updateAppearance('themeFontColor', themeColor);
            }
            
            // Show loading toast
            const loadingToast = toast.loading(translations.updating);
            
            // Update theme on server
            await updateTheme(themeName, themeColor);
            
            // Update text color for special themes
            if (specialThemes.includes(themeName) && themeColor) {
                await updateThemeTextColour(themeColor);
                updateAppearance('themeTextColour', themeColor);
            }
            
            // Dismiss loading toast and show success
            toast.dismiss(loadingToast);
            toast.success(`${translations.updateSuccess}`, {
                duration: 3000,
                icon: '🎨',
            });
            
        } catch (error) {
            console.error("Failed to update theme:", error);
            
            // ✅ ROLLBACK: Revert optimistic update on error
            if (appearance?.selectedTheme) {
                updateAppearance('selectedTheme', appearance.selectedTheme);
            }
            
            toast.error(error.message || translations.updateError, {
                duration: 4000,
                icon: '❌',
            });
        } finally {
            setIsUpdating(false);
        }
    };

    // Set theme-specific colors when this theme is selected
    useEffect(() => {
        if (!isSelectedTheme) return;
        
        switch (text) {
            case 'Lake Black':
            case 'Starry Night':
            case '3D Blocks':
                setThemeColor("#fff");
                break;
            case 'Matrix':
                setThemeColor("#0f0");
                break;
            case 'New Mario':
                setThemeColor("#000");
                break;
            default:
                setThemeColor("#000");
                break;
        }
    }, [text, isSelectedTheme]);

    // ✅ IMPROVED: Don't render if context data not available
    if (!currentUser || !isInitialized || !appearance) {
        return (
            <div className="min-w-[8rem] flex-1 items-center flex flex-col animate-pulse">
                <div className="w-full h-[13rem] bg-gray-200 rounded-lg"></div>
                <div className="h-4 w-16 bg-gray-200 rounded-md mt-3"></div>
            </div>
        );
    }

    const displayName = getTranslatedThemeName(themeName);

    return (
        <div className={`min-w-[8rem] flex-1 items-center flex flex-col group ${isUpdating ? 'pointer-events-none' : ''}`}>
            {type !== 1 ? (
                // Custom theme card
                <>
                    <div 
                        className={`w-full h-[13rem] border border-dashed rounded-lg relative border-black grid place-items-center cursor-pointer transition-all duration-200 ${
                            isUpdating 
                                ? 'opacity-50 cursor-not-allowed' 
                                : 'group-hover:bg-black group-hover:bg-opacity-[0.05] hover:scale-105 active:scale-95'
                        }`}
                        onClick={handleUpdateTheme}
                    >
                        <span className="uppercase max-w-[5rem] sm:text-xl text-base text-center font-semibold">
                            {translations.createYourOwn}
                        </span>
                        
                        {/* Selection indicator */}
                        {isSelectedTheme && (
                            <div className="h-full w-full absolute top-0 left-0 bg-black bg-opacity-[0.5] grid place-items-center z-10 text-white text-xl">
                                <FaCheck />
                            </div>
                        )}
                        
                        {/* Loading indicator */}
                        {isUpdating && (
                            <div className="h-full w-full absolute top-0 left-0 bg-white bg-opacity-75 grid place-items-center z-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        )}
                    </div>
                    <span className="py-3 text-sm font-medium">{displayName}</span>
                </>
            ) : (
                // Preset theme card
                <>
                    <div 
                        className={`w-full h-[13rem] border rounded-lg relative grid place-items-center cursor-pointer overflow-hidden transition-all duration-200 ${
                            isUpdating 
                                ? 'opacity-50 cursor-not-allowed' 
                                : 'group-hover:scale-105 group-active:scale-90'
                        }`}
                        onClick={handleUpdateTheme}
                    >
                        <Image 
                            src={pic} 
                            alt={`${displayName} theme preview`} 
                            height={1000} 
                            width={1000} 
                            className="min-w-full h-full object-cover" 
                            priority={isSelectedTheme} // Prioritize loading for selected theme
                        />
                        
                        {/* Selection indicator */}
                        {isSelectedTheme && (
                            <div className="h-full w-full absolute top-0 left-0 bg-black bg-opacity-[0.5] grid place-items-center z-10 text-white text-xl">
                                <FaCheck />
                            </div>
                        )}
                        
                        {/* Loading indicator */}
                        {isUpdating && (
                            <div className="h-full w-full absolute top-0 left-0 bg-white bg-opacity-75 grid place-items-center z-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        )}
                    </div>
                    <span className="py-3 text-sm font-medium">{displayName}</span>
                </>
            )}
        </div>
    );
}