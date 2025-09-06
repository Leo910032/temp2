"use client"
import React, { useState, useMemo } from "react";
import BackgroundCard from "../elements/BackgroundCard";
import ColorPicker from "../elements/ColorPicker";
import GradientPicker from "../elements/GradientPicker";
import { useTranslation } from "@/lib/translation/useTranslation";

export const backgroundContext = React.createContext();

export default function Backgrounds() {
    const { t, isInitialized } = useTranslation();
    const [isGradient, setIsGradient] = useState(false);

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
        <backgroundContext.Provider value={{ setIsGradient }}>
            <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6">
                <div className="grid sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] sm:gap-4 gap-2 w-full">
                    <BackgroundCard identifier={"Flat Colour"} text={translations.flatColour} colorValue={"#3d444b"} />
                    <BackgroundCard identifier={"Gradient"} text={translations.gradient} backImg={"linear-gradient(to top, #3d444b, #686d73)"} />
                    <BackgroundCard identifier={"Image"} text={translations.image} />
                    <BackgroundCard identifier={"Video"} text={translations.video} />
                    <BackgroundCard identifier={"Polka"} text={translations.polka} backImg={'url("https://linktree.sirv.com/Images/gif/selector-polka.51162b39945eaa9c181a.gif")'} />
                    <BackgroundCard identifier={"Stripe"} text={translations.stripe} backImg={'url("https://linktree.sirv.com/Images/gif/selector-stripe.19d28e1aac1e5a38452e.gif")'} />
                    <BackgroundCard identifier={"Waves"} text={translations.waves} backImg={'url("https://linktree.sirv.com/Images/gif/selector-waves.5cf0a8a65908cd433192.gif")'} />
                    <BackgroundCard identifier={"Zig Zag"} text={translations.zigZag} backImg={'url("https://linktree.sirv.com/Images/gif/selector-zigzag.0bfe34b10dd92cad79b9.gif")'} />
                </div>
                {isGradient && <GradientPicker />}
                {/* ✅ FIXED: Always pass valid colorFor prop for background color */}
                <ColorPicker colorFor={0} />
            </div>
        </backgroundContext.Provider>
    );
}