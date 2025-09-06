"use client"
import Image from 'next/image';
import React, { useMemo, useContext } from 'react';
import AgeRestriction from '../elements/AgeRestriction';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/lib/translation/useTranslation';
import { SettingsContext } from '../SettingsContext';

export default function SensitiveMaterial() {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const { settings, updateSettings } = useContext(SettingsContext);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.settings.sensitive_material.title'),
            altIcon: t('dashboard.settings.sensitive_material.alt_icon'),
            description: t('dashboard.settings.sensitive_material.description'),
        };
    }, [t, isInitialized]);

    // ✅ FIXED: Get sensitive material data from centralized settings state
    const containsSensitiveMaterial = settings?.sensitiveStatus || false;

    // ✅ FIXED: Update through centralized state
    const handleCheckboxChange = (event) => {
        updateSettings('sensitiveStatus', event.target.checked);
    };

    if (!isInitialized || !currentUser || !settings) {
        return (
            <div className="w-full my-4 px-2 animate-pulse">
                <div className="flex items-center gap-3 py-4">
                    <div className="h-6 w-6 bg-gray-200 rounded-md"></div>
                    <div className="h-7 w-44 bg-gray-200 rounded-md"></div>
                </div>
                <div className="p-5 bg-gray-200 rounded-lg flex justify-between items-center">
                    <div className="h-4 w-3/4 bg-gray-300 rounded-md"></div>
                    <div className="w-14 h-6 bg-gray-300 rounded-full"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full my-4 px-2" id="Settings--SensitiveMaterial">
            <div className="flex items-center gap-3 py-4">
                <Image
                    src={"https://linktree.sirv.com/Images/icons/sensitive.svg"}
                    alt={translations.altIcon}
                    height={24}
                    width={24}
                />
                <span className="text-xl font-semibold">{translations.title}</span>
            </div>
            <div className="p-5 bg-white rounded-lg">
                <div className='flex gap-3 items-center justify-between w-full'>
                    <span className='opacity-70 sm:text-[.965rem] text-sm'>{translations.description}</span>
                    <div>
                        <label className="cursor-pointer relative flex justify-between items-center group p-2 text-xl">
                            <input 
                                type="checkbox" 
                                onChange={handleCheckboxChange} 
                                checked={containsSensitiveMaterial} 
                                className="absolute left-1/2 -translate-x-1/2 w-full h-full peer appearance-none rounded-md" 
                            />
                            <span className="cursor-pointer w-9 h-6 flex items-center flex-shrink-0 ml-4 p-1 bg-gray-400 rounded-full duration-300 ease-in-out peer-checked:bg-green-400 after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow-md after:duration-300 peer-checked:after:translate-x-3 group-hover:after:translate-x-[2px]"></span>
                        </label>
                    </div>
                </div>
                {containsSensitiveMaterial && <AgeRestriction />}
            </div>
        </div>
    );
}