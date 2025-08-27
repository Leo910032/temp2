// app/dashboard/(dashboard pages)/appearance/components/Buttons.jsx - SERVER-SIDE VERSION
"use client"
import Image from "next/image";
import Button from "../elements/Button";
import ColorPicker from "../elements/ColorPicker";
import { updateThemeButton } from "@/lib/services/appearanceService"; // ✅ Updated import
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useMemo, useState } from "react"; // ✅ Added useState
import { toast } from "react-hot-toast"; // ✅ Added toast for feedback

export default function Buttons() {
    const { t, isInitialized } = useTranslation();
    const { currentUser } = useAuth();
    const [isUpdating, setIsUpdating] = useState(false); // ✅ Loading state

    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            fill: t('dashboard.appearance.buttons.fill'),
            outline: t('dashboard.appearance.buttons.outline'),
            hardShadow: t('dashboard.appearance.buttons.hard_shadow'),
            softShadow: t('dashboard.appearance.buttons.soft_shadow'),
            special: t('dashboard.appearance.buttons.special'),
            themeTextColour: t('dashboard.appearance.buttons.theme_text_colour'),
            buttonColour: t('dashboard.appearance.buttons.button_colour'),
            buttonFontColour: t('dashboard.appearance.buttons.button_font_colour'),
            shadowColour: t('dashboard.appearance.buttons.shadow_colour'),
            altDecorativeElement: t('dashboard.appearance.buttons.alt_decorative_element'),
            // ✅ Added error/success messages
            updateSuccess: t('dashboard.appearance.buttons.update_success') || 'Button style updated!',
            updateError: t('dashboard.appearance.buttons.update_error') || 'Failed to update button style',
            updating: t('dashboard.appearance.buttons.updating') || 'Updating...',
        };
    }, [t, isInitialized]);

    // ✅ Updated to use server-side service with proper error handling
    const handleUpdateTheme = async (type) => {
        if (!currentUser) {
            toast.error("Please log in to update your theme");
            return;
        }

        if (isUpdating) return; // Prevent multiple simultaneous updates

        setIsUpdating(true);
        
        try {
            await updateThemeButton(type);
            toast.success(translations.updateSuccess);
        } catch (error) {
            console.error("Failed to update button theme:", error);
            toast.error(error.message || translations.updateError);
        } finally {
            setIsUpdating(false);
        }
    }

    if (!isInitialized) {
        return (
            <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="mb-10">
                        <div className="h-5 w-24 bg-gray-200 rounded-md mb-5"></div>
                        <div className="flex gap-5">
                            <div className="h-10 flex-1 bg-gray-200 rounded-lg"></div>
                            <div className="h-10 flex-1 bg-gray-200 rounded-lg"></div>
                            <div className="h-10 flex-1 bg-gray-200 rounded-lg"></div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="w-full bg-white rounded-3xl my-3 flex flex-col p-6">
            {/* ✅ Show loading overlay when updating */}
            {isUpdating && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-3xl">
                    <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-600">{translations.updating}</span>
                    </div>
                </div>
            )}
            
            <section className="flex gap-5 text-sm flex-col mb-10">
                <span className="font-semibold">{translations.fill}</span>
                <div className="items-center flex gap-5">
                    <Button type={0} modifierClass={"bg-black"} onUpdate={handleUpdateTheme} disabled={isUpdating} />
                    <Button type={1} modifierClass={"bg-black rounded-lg"} onUpdate={handleUpdateTheme} disabled={isUpdating} />
                    <Button type={2} modifierClass={"bg-black rounded-3xl"} onUpdate={handleUpdateTheme} disabled={isUpdating} />
                </div>
            </section>
            <section className="flex gap-5 text-sm flex-col mb-10">
                <span className="font-semibold">{translations.outline}</span>
                <div className="items-center flex gap-5">
                    <Button type={3} modifierClass={"border border-black"} onUpdate={handleUpdateTheme} disabled={isUpdating} />
                    <Button type={4} modifierClass={"border border-black rounded-lg"} onUpdate={handleUpdateTheme} disabled={isUpdating} />
                    <Button type={5} modifierClass={"border border-black rounded-3xl"} onUpdate={handleUpdateTheme} disabled={isUpdating} />
                </div>
            </section>
            <section className="flex gap-5 text-sm flex-col mb-10">
                <span className="font-semibold">{translations.hardShadow}</span>
                <div className="items-center flex gap-5">
                    <Button type={6} modifierClass={"bg-white border border-black "} modifierStyles={{filter: `drop-shadow(4px 4px 0px black)`}} onUpdate={handleUpdateTheme} disabled={isUpdating} />
                    <Button type={7} modifierClass={"bg-white border border-black rounded-lg"} modifierStyles={{filter: `drop-shadow(4px 4px 0px black)`}} onUpdate={handleUpdateTheme} disabled={isUpdating} />
                    <Button type={8} modifierClass={"bg-white border border-black rounded-3xl"} modifierStyles={{filter: `drop-shadow(4px 4px 0px black)`}} onUpdate={handleUpdateTheme} disabled={isUpdating} />
                </div>
            </section>
            <section className="flex gap-5 text-sm flex-col mb-10">
                <span className="font-semibold">{translations.softShadow}</span>
   <div className="items-center flex gap-5">
    <Button type={9} modifierClass={"bg-white shadow-[0_15px_30px_5px_rgb(0,0,0,0.5)]"} onUpdate={handleUpdateTheme} disabled={isUpdating} />
    <Button type={10} modifierClass={"bg-white rounded-lg shadow-[0_15px_30px_5px_rgb(0,0,0,0.5)]"} onUpdate={handleUpdateTheme} disabled={isUpdating} />
    <Button type={11} modifierClass={"bg-white rounded-3xl shadow-[0_15px_30px_5px_rgb(0,0,0,0.5)]"} onUpdate={handleUpdateTheme} disabled={isUpdating} />
</div>
            </section>
            <section className="flex gap-5 text-sm flex-col mb-10">
                <span className="font-semibold">{translations.special}</span>
                <div className="items-center flex-wrap flex gap-5">
                    <div 
                        onClick={() => !isUpdating && handleUpdateTheme(12)} 
                        className={`min-w-[30%] h-10 relative border border-black bg-black ${
                            isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'
                        }`}
                    >
                        <span className="w-full absolute top-6 translate-y-[1px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/torn.svg"} alt={translations.altDecorativeElement} width={1000} height={100} priority className="w-full scale-[-1]" />
                        </span>
                        <span className="w-full absolute top-0 -translate-y-[6px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/torn.svg"} alt={translations.altDecorativeElement} width={1000} height={100} priority className="w-full" />
                        </span>
                    </div>
                    <div 
                        onClick={() => !isUpdating && handleUpdateTheme(13)} 
                        className={`min-w-[30%] h-10 relative border border-black bg-black ${
                            isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'
                        }`}
                    >
                        <span className="w-full absolute top-8 translate-y-[6px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/jiggy.svg"} alt={translations.altDecorativeElement} width={1000} height={100} priority className="w-full" />
                        </span>
                        <span className="w-full absolute top-0 -translate-y-[19px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/jiggy.svg"} alt={translations.altDecorativeElement} width={1000} height={100} priority className="w-full scale-[-1]" />
                        </span>
                    </div>
                    <Button type={14} modifierClass={"border border-black relative grid place-items-center after:h-7 after:w-[107%] after:absolute after:border after:border-black"} onUpdate={handleUpdateTheme} disabled={isUpdating} />
                    <Button type={15} modifierClass={"border border-black bg-black rounded-3xl"} onUpdate={handleUpdateTheme} disabled={isUpdating} />
                    <div 
                        onClick={() => !isUpdating && handleUpdateTheme(16)} 
                        className={`min-w-[30%] h-10 relative border border-black ${
                            isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'
                        }`}
                    >
                        <div className={"h-2 w-2 border border-black bg-white absolute -top-1 -left-1"}></div>
                        <div className={"h-2 w-2 border border-black bg-white absolute -top-1 -right-1"}></div>
                        <div className={"h-2 w-2 border border-black bg-white absolute -bottom-1 -left-1"}></div>
                        <div className={"h-2 w-2 border border-black bg-white absolute -bottom-1 -right-1"}></div>
                    </div>
                    <Button type={17} modifierClass={"border border-black bg-black rounded-l-3xl"} onUpdate={handleUpdateTheme} disabled={isUpdating} />
                </div>
            </section>
            <section className="flex text-sm flex-col mb-10">
                <span className="font-semibold mb-[-10px]">{translations.themeTextColour}</span>
                <ColorPicker colorFor={4} disabled={isUpdating} />
            </section>
            <section className="flex text-sm flex-col mb-10">
                <span className="font-semibold mb-[-10px]">{translations.buttonColour}</span>
                <ColorPicker colorFor={1} disabled={isUpdating} />
            </section>
            <section className="flex text-sm flex-col mb-10">
                <span className="font-semibold mb-[-10px]">{translations.buttonFontColour}</span>
                <ColorPicker colorFor={2} disabled={isUpdating} />
            </section>
            <section className="flex text-sm flex-col">
                <span className="font-semibold mb-[-10px]">{translations.shadowColour}</span>
                <ColorPicker colorFor={3} disabled={isUpdating} />
            </section>
        </div>
    );
}