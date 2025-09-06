"use client"
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "@/lib/translation/useTranslation"; // Fixed import path
import LanguageSwitcher from "../LanguageSwitcher/LanguageSwitcher";
import { useMemo } from "react"; // Add useMemo import

export default function LandingNav() {
    const { t, isInitialized } = useTranslation();

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            login: t('navigation.login')
        };
    }, [t, isInitialized]);

    // LOADING STATE - Show skeleton while translations load
    if (!isInitialized) {
        return (
            <div className="w-[96%] justify-between flex items-center rounded-[3rem] py-3 absolute sm:top-4 top-2 z-[9999999999] mdpx-12 sm:px-6 px-3 mx-auto bg-white bg-opacity-[0.1] border backdrop-blur-xl hover:glow-white">
                <Link href={"/"}>
                    <Image src={"https://linktree.sirv.com/Images/logo-icon.svg"} alt="logo" height={25} width={25} className="filter invert" priority />
                </Link>

                <div className="flex items-center gap-3">
                    {/* Language switcher skeleton */}
                    <div className="h-8 w-8 bg-white bg-opacity-20 rounded animate-pulse"></div>
                    {/* Login button skeleton */}
                    <div className="h-10 w-16 bg-white bg-opacity-20 rounded-3xl animate-pulse"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-[96%] justify-between flex items-center rounded-[3rem] py-3 absolute sm:top-4 top-2 z-[9999999999] mdpx-12 sm:px-6 px-3 mx-auto bg-white bg-opacity-[0.1] border backdrop-blur-xl hover:glow-white">
            <Link href={"/"}>
                <Image src={"https://firebasestorage.googleapis.com/v0/b/lintre-ffa96.firebasestorage.app/o/Logo%2Fimage-removebg-preview.png?alt=media&token=4ac6b2d0-463e-4ed7-952a-2fed14985fc0"} alt="logo" height={70} width={70} className="filter invert" priority />
            </Link>

            <div className="flex items-center gap-3">
                <LanguageSwitcher />
                <Link href={'/login'} className="p-3 sm:px-6 px-3 bg-themeGreen flex items-center gap-2 rounded-3xl cursor-pointer hover:scale-105 hover:bg-gray-100 active:scale-90">
                    {translations.login}
                </Link>
            </div>
        </div>
    );
}




