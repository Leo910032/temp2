"use client"
import Image from "next/image";
import SupportSwitch from "../elements/SupportSwitch";
import React, { useMemo, useContext } from "react";
import ChooseCause from "./ChooseCause";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useSettings } from '../SettingsContext';


export const SupportContext = React.createContext();

export default function SupportBanner() {
    const { t, isInitialized } = useTranslation();
const { settings, updateSettings } = useSettings();


    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.settings.support_banner.title'),
            altIcon: t('dashboard.settings.support_banner.alt_icon')
        };
    }, [t, isInitialized]);

    // ✅ FIXED: Get support banner data from centralized settings state
    const showSupport = settings?.supportBannerStatus || false;
    const chosenGroup = settings?.supportBanner || 0;

    // ✅ FIXED: Update through centralized state
    const setShowSupport = (value) => {
        updateSettings('supportBannerStatus', value);
    };

    const setChosenGroup = (value) => {
        updateSettings('supportBanner', value);
    };

    if (!isInitialized || !settings) {
        return (
            <div className="w-full my-4 px-2 animate-pulse">
                <div className="flex items-center gap-3 py-4">
                    <div className="h-6 w-6 bg-gray-200 rounded"></div>
                    <div className="h-7 bg-gray-200 rounded w-40"></div>
                </div>
                <div className="p-5 bg-gray-200 rounded-lg">
                    <div className="h-5 bg-gray-300 rounded w-2/4 mb-3"></div>
                    <div className="h-4 bg-gray-300 rounded w-full"></div>
                </div>
            </div>
        );
    }

    return (
        <SupportContext.Provider value={{ showSupport, setShowSupport, chosenGroup, setChosenGroup }}>
            <div className="w-full my-4 px-2" id="Settings--SupportBanner">
                <div className="flex items-center gap-3 py-4">
                    <Image
                        src={"https://linktree.sirv.com/Images/icons/support.svg"}
                        alt={translations.altIcon}
                        height={24}
                        width={24}
                    />
                    <span className="text-xl font-semibold">{translations.title}</span>
                </div>
                <div className="p-5 bg-white rounded-lg">
                    <SupportSwitch />
                    {showSupport && <ChooseCause />}
                </div>
            </div>
        </SupportContext.Provider>
    );
}