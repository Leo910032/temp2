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

// Create a new context specific to background properties
export const BgContext = React.createContext(null);

export default function BgDiv() {
    // 1. Consume the main HouseContext to get all user data
    const { userData } = useContext(HouseContext);
    const { t, isInitialized } = useTranslation();

    // 2. Destructure all needed properties from the centralized userData object
    const {
        profilePhoto,
        displayName,
        selectedTheme,
        backgroundType,
        gradientDirection,
        backgroundColor,
        backgroundImage,
        backgroundVideo,
        themeTextColour,
    } = userData;

    // 3. Memoize translations to prevent re-calculation on every render
    const translations = useMemo(() => ({
        altProfile: isInitialized ? t('dashboard.appearance.profile.alt_profile') : 'Profile'
    }), [t, isInitialized]);

    // 4. Memoize the background picture element to avoid re-creating it if its dependencies haven't changed
    const backgroundPicture = useMemo(() => {
        if (profilePhoto) {
            // Using 'fill' and 'object-cover' is more robust for responsive backgrounds
            return <Image src={profilePhoto} alt={translations.altProfile} fill className="object-cover scale-[1.25]" priority />;
        }
        // Fallback for users without a profile picture
        return (
            <div className="h-full w-full bg-gray-300 grid place-items-center">
                <span className="text-5xl font-semibold uppercase">{displayName?.[0] || 'U'}</span>
            </div>
        );
    }, [profilePhoto, displayName, translations.altProfile]);

    // 5. Memoize the context value for the BgContext Provider
    // This ensures child components of BgContext only re-render when these specific values change
    const contextValue = useMemo(() => ({
        bgTheme: backgroundType,
        bgColor: backgroundColor,
        gradientDirection,
        bgImage: backgroundImage,
        bgVideo: backgroundVideo
    }), [backgroundType, backgroundColor, gradientDirection, backgroundImage, backgroundVideo]);

    // 6. Provide a loading skeleton while translations are initializing
    if (!isInitialized) {
        return <div className="fixed inset-0 h-full w-full bg-gray-200 animate-pulse -z-10"></div>;
    }

    // 7. Render the appropriate theme component based on `selectedTheme`
    //    The BgContext.Provider makes custom background properties available to the CustomTheme component
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
            {selectedTheme === "Custom" && <CustomTheme />}
            {selectedTheme === "Snow Fall" && <SnowFall />}
        </BgContext.Provider>
    );
}