"use client"
import { useMemo } from "react";
import DropDown from "./mini components/DropDown";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function Controller() {
    const { t, isInitialized } = useTranslation();

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            jumpTo: t('dashboard.settings.controls.jump_to'),
        };
    }, [t, isInitialized]);

    if (!isInitialized) {
        return (
            <div className="w-full h-[58px] sm:px-6 px-3 py-3 rounded-2xl bg-gray-200 mb-4 animate-pulse"></div>
        );
    }

    return (
        <div className="w-full sm:px-6 px-3 py-3 text-sm rounded-2xl border-b border-l border-r bg-white mb-4 sm:grid sm:grid-cols-2 sm:gap-0 gap-4 flex justify-between items-center sticky top-0 z-10">
            <span className="font-semibold">{translations.jumpTo}</span>
            <DropDown />
        </div>
    );
}