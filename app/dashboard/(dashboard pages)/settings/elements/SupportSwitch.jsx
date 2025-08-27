"use client"

import { useContext, useMemo } from "react";
import { SupportContext } from "../components/SupportBanner";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function SupportSwitch() {
    const { t, isInitialized } = useTranslation();
    const { showSupport, setShowSupport } = useContext(SupportContext);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.settings.support_banner.switch_title'),
            description: t('dashboard.settings.support_banner.switch_description'),
        };
    }, [t, isInitialized]);

    const handleCheckboxChange = (event) => {
        const checkedStatus = event.target.checked;
        setShowSupport(checkedStatus);
    };

    if (!isInitialized) {
        return (
            <section className="flex gap-3 animate-pulse">
                <div className="flex flex-col gap-2 flex-1">
                    <div className="h-5 w-1/3 bg-gray-200 rounded-md"></div>
                    <div className="h-4 w-full bg-gray-200 rounded-md"></div>
                    <div className="h-4 w-10/12 bg-gray-200 rounded-md"></div>
                </div>
                <div className="w-14 h-6 bg-gray-200 rounded-full"></div>
            </section>
        );
    }

    return (
        <section className="flex gap-3">
            <div className="flex flex-col gap-2">
                <span className="font-semibold">{translations.title}</span>
                <span className="opacity-70 sm:text-base text-sm">{translations.description}</span>
            </div>
            <div>
                <label className="cursor-pointer relative flex justify-between items-center group p-2 text-xl">
                    <input type="checkbox" onChange={handleCheckboxChange} checked={showSupport} className="absolute left-1/2 -translate-x-1/2 w-full h-full peer appearance-none rounded-md" />
                    <span className="cursor-pointer w-9 h-6 flex items-center flex-shrink-0 ml-4 p-1 bg-gray-400 rounded-full duration-300 ease-in-out peer-checked:bg-green-400 after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow-md after:duration-300 peer-checked:after:translate-x-3 group-hover:after:translate-x-[2px]"></span>
                </label>
            </div>
        </section>
    );
}