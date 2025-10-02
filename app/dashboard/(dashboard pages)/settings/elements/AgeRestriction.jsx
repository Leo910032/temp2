"use client";

import { useDashboard } from '@/app/dashboard/DashboardContext';
import { useEffect, useState, useMemo, useContext } from "react";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useSettings } from '../SettingsContext';


export default function AgeRestriction() {
    const { t, isInitialized } = useTranslation();
const { currentUser } = useDashboard();
const { settings, updateSettings } = useSettings();

    const [pick, setPick] = useState(3);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            selectOne: t('dashboard.settings.sensitive_material.select_one'),
            age18: t('dashboard.settings.sensitive_material.age_18_plus'),
            age21: t('dashboard.settings.sensitive_material.age_21_plus'),
            age25: t('dashboard.settings.sensitive_material.age_25_plus'),
            sensitiveContent: t('dashboard.settings.sensitive_material.sensitive_content'),
        };
    }, [t, isInitialized]);

    // ✅ FIXED: Get sensitive type from centralized settings state
    useEffect(() => {
        if (settings?.sensitivetype !== undefined) {
            setPick(settings.sensitivetype);
        }
    }, [settings?.sensitivetype]);

    // ✅ FIXED: Update through centralized state
    const handlePickChange = (newPick) => {
        setPick(newPick);
        updateSettings('sensitivetype', newPick);
    };

    if (!isInitialized || !settings) {
        return (
            <div className="my-5 grid gap-4 animate-pulse">
                <div className="h-5 w-1/3 bg-gray-200 rounded-md"></div>
                <div className="h-6 w-1/4 bg-gray-200 rounded-md"></div>
                <div className="h-6 w-1/4 bg-gray-200 rounded-md"></div>
                <div className="h-6 w-1/4 bg-gray-200 rounded-md"></div>
                <div className="h-6 w-1/2 bg-gray-200 rounded-md"></div>
            </div>
        );
    }

    return (
        <div className="my-5 grid gap-4">
            <span className="text-sm font-semibold">{translations.selectOne}</span>
            <div className="cursor-pointer flex items-center gap-3 w-fit" onClick={() => handlePickChange(0)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 0 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <span className="text-sm">{translations.age18}</span>
            </div>
            <div className="cursor-pointer flex gap-3 w-fit" onClick={() => handlePickChange(1)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 1 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <span className="text-sm">{translations.age21}</span>
            </div>
            <div className="cursor-pointer flex gap-3 w-fit" onClick={() => handlePickChange(2)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 2 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <span className="text-sm">{translations.age25}</span>
            </div>
            <div className="cursor-pointer flex gap-3 w-fit" onClick={() => handlePickChange(3)}>
                <div className={`hover:scale-105 active:scale-95 h-6 w-6 bg-black rounded-full relative grid place-items-center bg-opacity-0 ${pick === 3 ? "after:absolute after:h-2 after:w-2 bg-opacity-100 after:bg-white after:rounded-full" : "border"} `}></div>
                <span className="text-sm">{translations.sensitiveContent}</span>
            </div>
        </div>
    );
}