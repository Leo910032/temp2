"use client"

import { useContext, useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { HouseContext } from "../House";
import { useTranslatedSupportGroups } from "@/lib/SupportGroups";
import { useTranslation } from "@/lib/translation/useTranslation";

/**
 * Renders the support banner at the bottom of the public profile page.
 * This component is now "presentational" - it receives all its data from the
 * parent `House` component via context, and does not perform its own data fetching.
 */
export default function SupportBanner() {
    // 1. Get all necessary data and functions from context and hooks.
    const { userData } = useContext(HouseContext);
    const { t, isInitialized } = useTranslation();
    const translatedSupportGroups = useTranslatedSupportGroups();
    
    // 2. Manage local UI state (the banner's expanded/collapsed view).
    const [expanded, setExpanded] = useState(false);

    // 3. Destructure data from the context with default fallbacks to prevent errors.
    const {
        supportBanner = 0,
        supportBannerStatus = false,
        selectedTheme = "",
        themeTextColour = ""
    } = userData || {}; // Use `|| {}` as a safeguard if context is ever null.

    // 4. Pre-compute translations for performance.
    const translations = useMemo(() => ({
        actNow: isInitialized ? t('public.support_banner.act_now') : 'Act Now'
    }), [t, isInitialized]);
    
    // 5. Use an effect for UI animations, like the initial expansion.
    // This effect now depends on `supportBannerStatus` from the context.
    useEffect(() => {
        if (supportBannerStatus) {
            // Wait 1 second before expanding the banner for a smooth entrance.
            const timer = setTimeout(() => {
                setExpanded(true);
            }, 1000);
            
            // Cleanup the timer if the component unmounts.
            return () => clearTimeout(timer);
        }
    }, [supportBannerStatus]);

    // 6. Derive computed values based on the data.
    const currentSupportGroup = translatedSupportGroups[supportBanner] || translatedSupportGroups[0];
    const bannerStyle = {
        color: selectedTheme === "Matrix" ? themeTextColour : "",
        backgroundColor: selectedTheme === "Matrix" ? '#000905' : "",
    };

    // 7. Render Guard: If the banner is disabled or translations are not ready, render nothing.
    // This prevents layout shifts and unnecessary rendering.
    if (!supportBannerStatus || !isInitialized) {
        return null;
    }
    
    // 8. Render the component JSX with the processed data.
    return (
        <div className="fixed bottom-0 w-screen left-0 z-[100]">
            <div 
                className="py-4 px-6 bg-black absolute left-0 w-full bottom-0 text-white banner flex flex-col items-center border-t border-t-green-400/50 shadow-xl" 
                style={bannerStyle}
            >
                <div 
                    className={`filter invert ${expanded ? "" : "rotate-180"} top-6 absolute right-6 cursor-pointer transition-transform duration-300`}
                    onClick={() => setExpanded(!expanded)}
                >
                    <Image
                        src={"https://linktree.sirv.com/Images/icons/arr.svg"}
                        alt="Toggle banner"
                        height={15}
                        width={15}
                    />
                </div>

                {/* Collapsed View */}
                {!expanded && (
                    <div onClick={() => setExpanded(true)} className="w-full text-center cursor-pointer">
                        <span className="font-semibold max-w-[20rem]">{currentSupportGroup.title}</span>
                    </div>
                )}
                
                {/* Expanded View */}
                <div className={`flex flex-col text-center w-full gap-5 pt-2 items-center overflow-hidden transition-all duration-500 ease-in-out ${
                    expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}>
                    <div className="h-fit aspect-square rounded-full overflow-hidden">
                        <Image src={"https://linktree.sirv.com/Images/icons/logo.gif"} alt="logo" height={60} width={60} />
                    </div>
                    <span className="font-semibold max-w-[20rem]">{currentSupportGroup.title}</span>
                    <span className="text-sm max-w-[20rem]">{currentSupportGroup.message}</span>
                    <Link
                        href={currentSupportGroup.linkTo}
                        target="_blank"
                        className="sm:max-w-[30rem] w-full p-3 bg-white text-black font-semibold rounded-2xl uppercase hover:scale-105 active:scale-95 mt-2 transition-transform"
                    >
                        {translations.actNow}
                    </Link>
                </div>
            </div>
        </div>
    );
}