// Fixed BgDiv.jsx - Complete support for Color/Gradient/Image/Video backgrounds

"use client"
import React, { useContext, useMemo } from "react";
import Image from "next/image";
import { HouseContext } from "../House";
import { useTranslation } from "@/lib/translation/useTranslation";

// Import all theme components
import LakeWhite from "../elements/themes/LakeWhite";
import LakeBlack from "../elements/themes/LakeBlack";
import PebbleBlue from "../elements/themes/PebbleBlue";
import PebbleYellow from "../elements/themes/PebbleYellow";
import PebblePink from "../elements/themes/PebblePink";
import BreezePink from "../elements/themes/BreezePink";
import BreezeOrange from "../elements/themes/BreezeOrange";
import BreezeGreen from "../elements/themes/BreezeGreen";
import Confetti from "../elements/themes/Confetti";
import CloudRed from "../elements/themes/CloudRed";
import CloudGreen from "../elements/themes/CloudGreen";
import CloudBlue from "../elements/themes/CloudBlue";
import Rainbow from "../elements/themes/Rainbow";
import StarryNight from "../elements/themes/StarryNight";
import MatrixBG from "../elements/themes/Matrix";
import Mario from "../elements/themes/Mario";
import Blocks3D from "../elements/themes/3DBlocks";
import CustomTheme from "../elements/themes/CustomTheme";
import SnowFall from "../elements/themes/SnowFall";

export const BgContext = React.createContext(null);

export default function BgDiv() {
    const { userData } = useContext(HouseContext);
    const { t, isInitialized } = useTranslation();

    const {
        profilePhoto,
        displayName,
        selectedTheme,
        backgroundType,
        gradientDirection,
        gradientColorStart,
        gradientColorEnd,
        backgroundColor,
        backgroundImage,
        backgroundVideo,
        themeTextColour,
    } = userData;

    console.log('🎨 BgDiv: Processing theme data:', {
        selectedTheme,
        backgroundType,
        backgroundColor: backgroundColor?.substring(0, 50),
        backgroundImage: backgroundImage?.substring(0, 50),
        backgroundVideo: backgroundVideo?.substring(0, 50)
    });

    const translations = useMemo(() => ({
        altProfile: isInitialized ? t('dashboard.appearance.profile.alt_profile') : 'Profile'
    }), [t, isInitialized]);

    const gradientStyle = useMemo(() => {
        if (backgroundType === 'Gradient' && selectedTheme === 'Custom') {
            const direction = gradientDirection === 1 ? 'to top' : 'to bottom';
            const startColor = gradientColorStart || '#FFFFFF';
            const endColor = gradientColorEnd || '#000000';
            
            return {
                background: `linear-gradient(${direction}, ${startColor}, ${endColor})`,
                minHeight: '100vh',
                position: 'fixed',
                inset: 0,
                zIndex: -10
            };
        }
        return null;
    }, [backgroundType, gradientDirection, gradientColorStart, gradientColorEnd, selectedTheme]);

    const backgroundPicture = useMemo(() => {
        if (profilePhoto) {
            return <Image src={profilePhoto} alt={translations.altProfile} fill className="object-cover scale-[1.25]" priority sizes="100vw" />;
        }
        return (
            <div className="h-full w-full bg-gray-300 grid place-items-center">
                <span className="text-5xl font-semibold uppercase">{displayName?.[0] || 'U'}</span>
            </div>
        );
    }, [profilePhoto, displayName, translations.altProfile]);

    const contextValue = useMemo(() => ({
        bgTheme: backgroundType,
        bgColor: backgroundColor,
        gradientDirection,
        gradientColorStart,
        gradientColorEnd,
        bgImage: backgroundImage,
        bgVideo: backgroundVideo
    }), [backgroundType, backgroundColor, gradientDirection, gradientColorStart, gradientColorEnd, backgroundImage, backgroundVideo]);

    if (!isInitialized) {
        return <div className="fixed inset-0 h-full w-full bg-gray-200 animate-pulse -z-10"></div>;
    }

    // ✅ THEMES TAKE PRIORITY - Check for specific themes first
    if (selectedTheme === 'Custom') {
        console.log('🎨 BgDiv: Using Custom theme, background type:', backgroundType);
        
        // Handle Gradient background
        if (backgroundType === 'Gradient') {
            console.log('🎨 BgDiv: Rendering gradient background');
            return (
                <BgContext.Provider value={contextValue}>
                    <div style={gradientStyle}></div>
                </BgContext.Provider>
            );
        }

        // Handle flat Color background
        if (backgroundType === 'Color') {
            console.log('🎨 BgDiv: Rendering flat color background:', backgroundColor);
            const colorStyle = {
                backgroundColor: backgroundColor || '#FFFFFF',
                minHeight: '100vh',
                position: 'fixed',
                inset: 0,
                zIndex: -10
            };
            
            return (
                <BgContext.Provider value={contextValue}>
                    <div style={colorStyle}></div>
                </BgContext.Provider>
            );
        }

        // ✅ NEW: Handle Image background
       if (backgroundType === 'Image') {
    // ...
    return (
        <BgContext.Provider value={contextValue}>
            <div className="fixed inset-0 w-full h-full -z-10">
                {imageUrl && (
                    <Image 
                        src={imageUrl}
                        alt="Background"
                        fill
                        priority
                        className="object-cover"
                    />
                )}
            </div>
        </BgContext.Provider>
    );
}

        // ✅ NEW: Handle Video background
        if (backgroundType === 'Video') {
            const videoUrl = backgroundVideo || backgroundColor; // backgroundColor might contain the URL
            console.log('🎨 BgDiv: Rendering video background:', videoUrl?.substring(0, 50));
            
            return (
                <BgContext.Provider value={contextValue}>
                    <div className="fixed inset-0 w-full h-full -z-10">
                        {videoUrl && (
                            <video 
                                src={videoUrl}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>
                </BgContext.Provider>
            );
        }

        // Fallback to CustomTheme component for any other custom cases
        return (
            <BgContext.Provider value={contextValue}>
                <CustomTheme />
            </BgContext.Provider>
        );
    }

    // All other themes override background settings completely
    console.log('🎨 BgDiv: Rendering theme component:', selectedTheme);
    
    return (
        <BgContext.Provider value={contextValue}>
            {selectedTheme === "Lake White" && <LakeWhite backgroundPicture={backgroundPicture} />}
            {selectedTheme === "Lake Black" && <LakeBlack backgroundPicture={backgroundPicture} />}
            {selectedTheme === "Pebble Blue" && <PebbleBlue />}
            {selectedTheme === "Pebble Yellow" && <PebbleYellow />}
            {selectedTheme === "Pebble Pink" && <PebblePink />}
            {selectedTheme === "Breeze Pink" && <BreezePink />}
            {selectedTheme === "Breeze Orange" && <BreezeOrange />}
            {selectedTheme === "Breeze Green" && <BreezeGreen />}
            {selectedTheme === "Confetti" && <Confetti />}
            {selectedTheme === "Cloud Red" && <CloudRed />}
            {selectedTheme === "Cloud Green" && <CloudGreen />}
            {selectedTheme === "Cloud Blue" && <CloudBlue />}
            {selectedTheme === "Rainbow" && <Rainbow />}
            {selectedTheme === "Starry Night" && <StarryNight />}
            {selectedTheme === "3D Blocks" && <Blocks3D />}
            {selectedTheme === "Matrix" && <MatrixBG textColor={themeTextColour} />}
            {selectedTheme === "New Mario" && <Mario />}
            {selectedTheme === "Snow Fall" && <SnowFall />}
            
            {/* Fallback to default theme if no match */}
            {!["Lake White", "Lake Black", "Pebble Blue", "Pebble Yellow", "Pebble Pink", 
               "Breeze Pink", "Breeze Orange", "Breeze Green", "Confetti", "Cloud Red", 
               "Cloud Green", "Cloud Blue", "Rainbow", "Starry Night", "3D Blocks", 
               "Matrix", "New Mario", "Snow Fall", "Custom"].includes(selectedTheme) && 
               <LakeWhite backgroundPicture={backgroundPicture} />}
        </BgContext.Provider>
    );
}
