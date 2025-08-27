"use client"
import { useMemo, useContext } from "react";
import { useTranslation } from "@/lib/translation/useTranslation";
import SelectFonts from "../elements/SelectFonts";
import { AppearanceContext } from "../AppearanceContext";

export default function FontsOptions() {
    const { appearance } = useContext(AppearanceContext);
    const { t, isInitialized } = useTranslation();

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            fontLabel: t('dashboard.appearance.fonts.font_label') || "Fonts"
        };
    }, [t, isInitialized]);

    if (!isInitialized || !appearance) {
        return (
            <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6 animate-pulse">
                <div className="h-5 w-12 bg-gray-200 rounded-md mb-2"></div>
                <div className="h-16 bg-gray-200 rounded-lg"></div>
            </div>
        );
    }

    return (
        <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6">
            <h3 className="font-semibold text-sm mb-2">{translations.fontLabel}</h3>
            <SelectFonts />
        </div>
    );
}