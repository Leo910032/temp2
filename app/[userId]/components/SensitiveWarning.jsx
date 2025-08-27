// File: app/[userId]/components/SensitiveWarning.jsx

"use client"
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useContext, useMemo } from "react";
import { HouseContext } from "../House";
import { useTranslation } from "@/lib/translation/useTranslation";

export default function SensitiveWarning() {
    // Consume the centralized context from the parent <House> component.
    // This provides both the user data and the function to update the parent's state.
    const { userData, setShowSensitiveWarning } = useContext(HouseContext);
    const { sensitivetype } = userData;
    
    const router = useRouter();
    const { t, isInitialized } = useTranslation();

    // Memoize translations to prevent re-computation on every render.
    const translations = useMemo(() => {
        if (!isInitialized) return {}; // Return empty object if translations aren't ready
        return {
            title: t('public.sensitive_warning.title'),
            description: t('public.sensitive_warning.description'),
            continueButton: t('public.sensitive_warning.continue_button'),
            goBackButton: t('public.sensitive_warning.go_back_button'),
            // Age-specific buttons
            over18: t('public.sensitive_warning.age_buttons.over_18'),
            over21: t('public.sensitive_warning.age_buttons.over_21'),
            over25: t('public.sensitive_warning.age_buttons.over_25'),
            under18: t('public.sensitive_warning.age_buttons.under_18'),
            under21: t('public.sensitive_warning.age_buttons.under_21'),
            under25: t('public.sensitive_warning.age_buttons.under_25')
        };
    }, [t, isInitialized]);

    // Handler to navigate to the previous page.
    const handleBack = () => {
        router.back();
    }

    // Handler to update the parent state, hiding this warning and showing the profile.
    const handleProceed = () => { 
        setShowSensitiveWarning(false);
    }

    // Dynamically get the "Continue" button text based on the user's setting.
    const getContinueButtonText = () => {
        if (!isInitialized) return "Continue"; // Fallback text
        
        switch(sensitivetype) {
            case 1: return translations.over18;
            case 2: return translations.over21;
            case 3: return translations.over25;
            default: return translations.continueButton;
        }
    };

    // Dynamically get the "Go Back" button text based on the user's setting.
    const getGoBackButtonText = () => {
        if (!isInitialized) return "Go Back"; // Fallback text
        
        switch(sensitivetype) {
            case 1: return translations.under18;
            case 2: return translations.under21;
            case 3: return translations.under25;
            default: return translations.goBackButton;
        }
    };

    // Render a skeleton UI while translations are loading to prevent flicker.
    if (!isInitialized) {
        return (
            <div className="h-screen w-screen grid place-items-center p-5" style={{backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), linear-gradient(125deg, rgb(11, 175, 255), rgb(57, 224, 155) 50%, rgb(255, 194, 19))`}}>
                <main className="flex flex-col gap-4 text-white max-w-[40rem] w-full items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    <div className="h-6 w-48 bg-white bg-opacity-20 rounded animate-pulse"></div>
                    <div className="h-4 w-64 bg-white bg-opacity-20 rounded animate-pulse"></div>
                    <div className="my-4 w-full space-y-2">
                        <div className="h-12 w-full bg-white bg-opacity-20 rounded-xl animate-pulse"></div>
                        <div className="h-12 w-full bg-white bg-opacity-20 rounded-xl animate-pulse"></div>
                    </div>
                </main>
            </div>
        );
    }

    // Render the final component once translations are ready.
    return (
        <div className="h-screen w-screen grid place-items-center p-5" style={{backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), linear-gradient(125deg, rgb(11, 175, 255), rgb(57, 224, 155) 50%, rgb(255, 194, 19))`}}>
            <main className="flex flex-col gap-4 text-white max-w-[40rem] w-full items-center text-center">
                <Image
                    src={"https://linktree.sirv.com/Images/icons/close-eye.svg"}
                    alt={"Sensitive Content Warning Icon"}
                    width={30}
                    height={30}
                />
                <h1 className="font-bold sm:text-2xl text-xl">{translations.title}</h1>
                <p className="sm:text-xl">{translations.description}</p>

                <div className="my-4 w-full">
                    <button
                        className="p-3 font-semibold text-center hover:scale-105 active:scale-90 border border-white border-opacity-50 hover:border-opacity-100 w-full rounded-xl cursor-pointer transition-transform"
                        onClick={handleProceed}
                    >
                        {getContinueButtonText()}
                    </button>
                    <button
                        className="p-3 font-semibold text-center hover:scale-105 active:scale-90 w-full rounded-xl cursor-pointer transition-transform"
                        onClick={handleBack}
                    >
                        {getGoBackButtonText()}
                    </button>
                </div>
            </main>
        </div>
    );
}