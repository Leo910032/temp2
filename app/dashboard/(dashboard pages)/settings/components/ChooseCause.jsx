"use client"

import { SupportGroups } from "@/lib/SupportGroups";
import { useContext, useEffect, useState, useMemo } from "react";
import { SupportContext } from "./SupportBanner";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function ChooseCause() {
    const { t, isInitialized } = useTranslation();
    const { chosenGroup, setChosenGroup } = useContext(SupportContext);

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            chooseCauseLabel: t('dashboard.settings.support_banner.choose_cause_label'),
            linkInfo: t('dashboard.settings.support_banner.link_info'),
            linkText: t('dashboard.settings.support_banner.link_text'),
            altLogo: t('dashboard.settings.support_banner.alt_logo'),
        };
    }, [t, isInitialized]);
    
    // Create a new array with translated text when translations are ready
    const translatedChoices = useMemo(() => {
        if (!isInitialized) return [];
        return SupportGroups.map(group => ({
            ...group, // Keep original type, linkTo, etc.
            // Overwrite display properties with translated versions
            caption: t(`dashboard.settings.support_banner.causes.${group.type}.caption`),
            cardTitle: t(`dashboard.settings.support_banner.causes.${group.type}.card_title`),
            cardMessage: t(`dashboard.settings.support_banner.causes.${group.type}.card_message`),
        }));
    }, [isInitialized, t]);

    // Find the details of the currently selected cause from the translated list
    const selectedCauseDetails = useMemo(() => 
        translatedChoices.find(cause => cause.type == chosenGroup),
    [chosenGroup, translatedChoices]);
    
    if (!isInitialized) {
        return (
            <div className="animate-pulse">
                <div className="m-3 my-4">
                    <div className="h-12 w-full bg-gray-200 rounded-md"></div>
                </div>
                <div className="w-full flex p-5 gap-4 rounded-lg bg-gray-200">
                    <div className="rounded-full h-24 w-24 bg-gray-300"></div>
                    <div className="flex-1 text-sm space-y-2">
                        <div className="h-5 w-3/4 bg-gray-300 rounded-md"></div>
                        <div className="h-4 w-full bg-gray-300 rounded-md"></div>
                        <div className="h-4 w-10/12 bg-gray-300 rounded-md"></div>
                        <div className="h-4 w-1/2 bg-gray-300 rounded-md mt-2"></div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="">
            <div className="m-3 my-4">
                <div className="rounded-md relative focus-within:ring-2 focus-within:ring-black transition duration-75 ease-out hover:shadow-[inset_0_0_0_2px_#e0e2d9] hover:focus-within:shadow-none cursor-pointer bg-black bg-opacity-5">
                    <div className="flex rounded-[10px] leading-[48px] border-solid border-2 border-transparent">
                        <div className="flex w-full items-center bg-chalk rounded-sm px-3">
                            <div className="relative grow">
                                <select 
                                    className="placeholder-transparent peer px-0 text-sm leading-[48px] placeholder:leading-[48px] rounded-xl block py-5 w-full bg-chalk text-black transition duration-75 ease-out !outline-none bg-transparent pb-2"
                                    value={chosenGroup !== null ? chosenGroup : ""}
                                    onChange={(e)=>setChosenGroup(e.target.value)}
                                >
                                    {translatedChoices.map((opt)=>(
                                        <option value={opt.type} key={opt.type}>
                                            {opt.caption}
                                        </option>
                                    ))}
                                </select>
                                <label
                                    className="absolute pointer-events-none text-sm text-concrete transition-all transform scale-[0.85] left-1 font-semibold origin-[0] top-1 opacity-50 max-w-[calc(100%-16px)] truncate"
                                >
                                    {translations.chooseCauseLabel}
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {selectedCauseDetails && <div className="w-full flex sm:flex-row flex-col sm:items-start items-center p-5 gap-4 rounded-lg bg-black bg-opacity-90">
                <div className="rounded-full overflow-hidden h-fit w-fit grid place-items-center">
                    <Image src={"https://linktree.sirv.com/Images/icons/logo.gif"} alt={translations.altLogo} className="object-contain h-full" height={150} width={150} />
                </div>
                <div className="text-white text-sm">
                    <p className="font-semibold sm:text-left text-center">{selectedCauseDetails.cardTitle}</p>
                    <p className="text-white my-1 mr-2 sm:text-left text-center">{selectedCauseDetails.cardMessage}</p>
                    <p className="mt-2 sm:text-left text-center">
                        <span className="opacity-40">{translations.linkInfo}</span>{' '}
                        <Link href={selectedCauseDetails.linkTo} target="_blank" rel="noopener noreferrer" className="text-purple-600 underline">
                            {translations.linkText}
                        </Link>
                    </p>
                </div>
            </div>}
        </div>
    );
}