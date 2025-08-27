"use client"
import Image from "next/image";
import SocialCard from "./mini components/SocialCard";
import { useState, useMemo, useContext } from "react";
import React from "react";
import Position from "../elements/Position";
import AddIconModal from "../elements/AddIconModal";
import EditIconModal from "../elements/EditIconModal";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation";
import { SettingsContext } from "../SettingsContext";

export const SocialContext = React.createContext();

export default function SocialSetting() {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const { settings, updateSettings } = useContext(SettingsContext);
    
    const [addIconModalOpen, setAddIconModalOpen] = useState(false);
    const [settingIconModalOpen, setSettingIconModalOpen] = useState({
        status: false,
        type: 0,
        operation: 0,
        active: false
    });

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.settings.social_icons.title'),
            cardTitle: t('dashboard.settings.social_icons.card_title'),
            cardSubtitle: t('dashboard.settings.social_icons.card_subtitle'),
            addIconButton: t('dashboard.settings.social_icons.add_icon_button'),
            dragAndDropHelper: t('dashboard.settings.social_icons.drag_and_drop_helper'),
            positionTitle: t('dashboard.settings.social_icons.position_title'),
            positionSubtitle: t('dashboard.settings.social_icons.position_subtitle'),
            altIcon: t('dashboard.settings.social_icons.alt_icon'),
        };
    }, [t, isInitialized]);

    // ✅ FIXED: Get socials from centralized settings state
    const socialsArray = settings?.socials || [];

    // ✅ FIXED: Update socials through centralized state with better logging
    const setSocialsArray = (newSocials) => {
        console.log('🔄 Updating socials array:', newSocials);
        
        if (typeof newSocials === 'function') {
            // Handle functional updates
            const updatedSocials = newSocials(socialsArray);
            console.log('🔄 Functional update - Old:', socialsArray, 'New:', updatedSocials);
            
            // Only update if there's actually a change
            if (JSON.stringify(socialsArray) !== JSON.stringify(updatedSocials)) {
                updateSettings('socials', updatedSocials);
            }
        } else {
            // Handle direct updates
            console.log('🔄 Direct update - Old:', socialsArray, 'New:', newSocials);
            
            // Only update if there's actually a change
            if (JSON.stringify(socialsArray) !== JSON.stringify(newSocials)) {
                updateSettings('socials', newSocials);
            }
        }
    };

    if (!isInitialized || !currentUser || !settings) {
        return (
            <div className="w-full my-4 px-2 animate-pulse" id="Settings--SocialLinks">
                <div className="flex items-center gap-3 py-4">
                    <div className="h-6 w-6 bg-gray-200 rounded-md"></div>
                    <div className="h-7 w-32 bg-gray-200 rounded-md"></div>
                </div>
                <div className="p-5 bg-gray-200 rounded-lg">
                    <div className="h-6 w-24 bg-gray-200 rounded-md"></div>
                    <div className="h-4 w-full bg-gray-200 rounded-md mt-2"></div>
                    <div className="h-10 w-28 bg-gray-300 rounded-3xl my-7"></div>
                </div>
            </div>
        );
    }

    return (
        <SocialContext.Provider value={{ 
            socialsArray, 
            setSocialsArray, 
            setSettingIconModalOpen, 
            setAddIconModalOpen, 
            settingIconModalOpen,
            currentUser
        }}>
            <div className="w-full my-4 px-2" id="Settings--SocialLinks">
                <div className="flex items-center gap-3 py-4">
                    <Image
                        src={"https://linktree.sirv.com/Images/icons/social.svg"}
                        alt={translations.altIcon}
                        height={24}
                        width={24}
                    />
                    <span className="text-xl font-semibold">{translations.title}</span>
                </div>
                <div className="p-5 bg-white rounded-lg">
                    <div className="grid gap-1">
                        <span className="font-semibold">{translations.cardTitle}</span>
                        <span className="opacity-90 sm:text-base text-sm">{translations.cardSubtitle}</span>
                    </div>
                    <div className="w-fit rounded-3xl bg-btnPrimary hover:bg-btnPrimaryAlt text-white py-3 px-4 my-7 cursor-pointer active:scale-90 select-none" onClick={()=>setAddIconModalOpen(true)}>
                        {translations.addIconButton}
                    </div>
                    {socialsArray.length > 0 && <div>
                        <SocialCard array={socialsArray} />
                        <p className="my-4 opacity-60 text-sm">{translations.dragAndDropHelper}</p>
                        <div className="grid gap-1 text-sm mt-5">
                            <span className="font-semibold">{translations.positionTitle}</span>
                            <span className="opacity-90">{translations.positionSubtitle}</span>
                        </div>
                        <Position />
                    </div>}
                </div>
                {addIconModalOpen && <AddIconModal />}
                {settingIconModalOpen.status && <EditIconModal />}
            </div>
        </SocialContext.Provider>
    );
}