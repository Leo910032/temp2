"use client"

import { FaPlus } from "react-icons/fa6";
import ProfileImageManager from "../elements/ProfileImageHandler";
import TextDetails from "../elements/TextDetails";
import CVManager from "../elements/CVManager"; // ADD THIS IMPORT
import Link from "next/link";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useMemo } from "react";

export default function ProfileCard() {
    const { t, isInitialized } = useTranslation();

    // PRE-COMPUTE TRANSLATIONS
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            addSocialIcons: t('dashboard.appearance.profile_card.add_social_icons')
        };
    }, [t, isInitialized]);

    // Loading skeleton for the entire card
    if (!isInitialized) {
        return (
            <div className="w-full h-[21rem] bg-gray-200 rounded-3xl my-3 animate-pulse">
                {/* This skeleton covers the whole card for a clean loading experience */}
            </div>
        )
    }

    return (
        <div className="w-full space-y-3">
            {/* Profile Image and Text */}
            <div className="w-full bg-white rounded-3xl flex flex-col">
                <ProfileImageManager />
                <TextDetails />

                <div className="w-full border-t px-6 py-4">
                    <Link href={"/dashboard/settings#Settings--SocialLinks"} className={`flex w-fit items-center gap-3 justify-center p-3 rounded-3xl cursor-pointer active:scale-95 active:opacity-60 active:translate-y-1 hover:scale-[1.005] text-btnPrimary font-semibold`}>
                        <FaPlus/>
                        <span>{translations.addSocialIcons}</span>
                    </Link>
                </div>
            </div>

            {/* CV Manager - Separate card */}
            <CVManager />
        </div>
    );
}