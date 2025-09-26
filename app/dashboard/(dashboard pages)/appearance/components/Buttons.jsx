// Add this debug version of your Buttons component to see what's happening:

/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
"use client"

import React, { useContext, useMemo, useState } from "react";
import Image from "next/image";
import { useTranslation } from "@/lib/translation/useTranslation";
import { AppearanceContext } from "../AppearanceContext";
import Button from "../elements/Button";
import ColorPickerFlat from "../elements/ColorPickerFlat.jsx";

export default function Buttons() {
    const { t, isInitialized } = useTranslation();
    
    // Get all necessary data and functions from the centralized context.
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);
    
    // State to control visibility of color pickers
    const [showColorPickers, setShowColorPickers] = useState({
        theme: false,
        button: false,
        buttonFont: false,
        shadow: false
    });

    // Memoize translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            fill: t('dashboard.appearance.buttons.fill') || 'Fill',
            outline: t('dashboard.appearance.buttons.outline') || 'Outline',
            hardShadow: t('dashboard.appearance.buttons.hard_shadow') || 'Hard Shadow',
            softShadow: t('dashboard.appearance.buttons.soft_shadow') || 'Soft Shadow',
            special: t('dashboard.appearance.buttons.special') || 'Special',
            themeTextColour: t('dashboard.appearance.buttons.theme_text_colour') || 'Theme Text Colour',
            buttonColour: t('dashboard.appearance.buttons.button_colour') || 'Button Colour',
            buttonFontColour: t('dashboard.appearance.buttons.button_font_colour') || 'Button Font Colour',
            shadowColour: t('dashboard.appearance.buttons.shadow_colour') || 'Shadow Colour',
            altDecorativeElement: t('dashboard.appearance.buttons.alt_decorative_element') || 'Decorative Element',
        };
    }, [t, isInitialized]);

    // This simplified handler just calls the update function from the context.
    const handleUpdateTheme = (type) => {
        if (isSaving) return;
        console.log('🔘 Button type update:', type);
        updateAppearance('btnType', type);
    };

    // Toggle function for color picker visibility
    const toggleColorPicker = (colorType) => {
        setShowColorPickers(prev => ({
            ...prev,
            [colorType]: !prev[colorType]
        }));
    };

    // ✅ ENHANCED: Color update handlers with detailed logging
    const handleColorUpdate = (colorType, color) => {
        if (isSaving) return;
        
        console.log('🎨 Color update attempt:', { colorType, color, isSaving });
        
        let fieldName;
        switch(colorType) {
            case 'theme':
                fieldName = 'themeFontColor';
                break;
            case 'button':
                fieldName = 'btnColor';
                break;
            case 'buttonFont':
                fieldName = 'btnFontColor';
                break;
            case 'shadow':
                fieldName = 'btnShadowColor';
                break;
            default:
                console.warn('❌ Unknown color type:', colorType);
                return;
        }
        
        console.log(`🔄 Updating ${fieldName} to:`, color);
        updateAppearance(fieldName, color);
    };

    // Debug: Log current appearance values
    console.log('🎯 Current appearance values:', {
        btnColor: appearance?.btnColor,
        btnFontColor: appearance?.btnFontColor,
        btnShadowColor: appearance?.btnShadowColor,
        themeFontColor: appearance?.themeFontColor,
        btnType: appearance?.btnType
    });

    // Render a skeleton loader if the context data isn't ready yet.
    if (!appearance) {
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
        );
    }

    return (
        <div className={`w-full bg-white rounded-3xl my-3 flex flex-col p-6 transition-opacity ${isSaving ? 'opacity-75' : ''}`}>
            
            {/* ✅ DEBUG PANEL - Remove this after fixing */}
            {process.env.NODE_ENV === 'development' && (
                <div className="mb-4 p-4 bg-yellow-50 rounded-lg border">
                    <h3 className="font-bold text-sm mb-2">🐛 Button Colors Debug</h3>
                    <div className="text-xs space-y-1">
                        <div><strong>Theme Font Color:</strong> {appearance.themeFontColor || 'undefined'}</div>
                        <div><strong>Button Color:</strong> {appearance.btnColor || 'undefined'}</div>
                        <div><strong>Button Font Color:</strong> {appearance.btnFontColor || 'undefined'}</div>
                        <div><strong>Button Shadow Color:</strong> {appearance.btnShadowColor || 'undefined'}</div>
                        <div><strong>Button Type:</strong> {appearance.btnType ?? 'undefined'}</div>
                        <div><strong>Is Saving:</strong> {isSaving ? 'YES' : 'NO'}</div>
                    </div>
                </div>
            )}
            
            <section className="flex gap-5 text-sm flex-col mb-10">
                <span className="font-semibold">{translations.fill}</span>
                <div className="items-center flex gap-5">
                    <Button type={0} modifierClass={"bg-black"} onUpdate={handleUpdateTheme} disabled={isSaving} />
                    <Button type={1} modifierClass={"bg-black rounded-lg"} onUpdate={handleUpdateTheme} disabled={isSaving} />
                    <Button type={2} modifierClass={"bg-black rounded-3xl"} onUpdate={handleUpdateTheme} disabled={isSaving} />
                </div>
            </section>

            <section className="flex gap-5 text-sm flex-col mb-10">
                <span className="font-semibold">{translations.outline}</span>
                <div className="items-center flex gap-5">
                    <Button type={3} modifierClass={"border border-black"} onUpdate={handleUpdateTheme} disabled={isSaving} />
                    <Button type={4} modifierClass={"border border-black rounded-lg"} onUpdate={handleUpdateTheme} disabled={isSaving} />
                    <Button type={5} modifierClass={"border border-black rounded-3xl"} onUpdate={handleUpdateTheme} disabled={isSaving} />
                </div>
            </section>

            <section className="flex gap-5 text-sm flex-col mb-10">
                <span className="font-semibold">{translations.hardShadow}</span>
                <div className="items-center flex gap-5">
                    <Button type={6} modifierClass={"bg-white border border-black"} modifierStyles={{filter: `drop-shadow(4px 4px 0px black)`}} onUpdate={handleUpdateTheme} disabled={isSaving} />
                    <Button type={7} modifierClass={"bg-white border border-black rounded-lg"} modifierStyles={{filter: `drop-shadow(4px 4px 0px black)`}} onUpdate={handleUpdateTheme} disabled={isSaving} />
                    <Button type={8} modifierClass={"bg-white border border-black rounded-3xl"} modifierStyles={{filter: `drop-shadow(4px 4px 0px black)`}} onUpdate={handleUpdateTheme} disabled={isSaving} />
                </div>
            </section>

            <section className="flex gap-5 text-sm flex-col mb-10">
                <span className="font-semibold">{translations.softShadow}</span>
                <div className="items-center flex gap-5">
                    <Button type={9} modifierClass={"bg-white shadow-[0_15px_30px_5px_rgb(0,0,0,0.5)]"} onUpdate={handleUpdateTheme} disabled={isSaving} />
                    <Button type={10} modifierClass={"bg-white rounded-lg shadow-[0_15px_30px_5px_rgb(0,0,0,0.5)]"} onUpdate={handleUpdateTheme} disabled={isSaving} />
                    <Button type={11} modifierClass={"bg-white rounded-3xl shadow-[0_15px_30px_5px_rgb(0,0,0,0.5)]"} onUpdate={handleUpdateTheme} disabled={isSaving} />
                </div>
            </section>

            <section className="flex gap-5 text-sm flex-col mb-10">
                <span className="font-semibold">{translations.special}</span>
                <div className="items-center flex-wrap flex gap-5">
                    <div 
                        onClick={() => handleUpdateTheme(12)} 
                        className={`min-w-[30%] h-10 relative border border-black bg-black ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
                    >
                        <span className="w-full absolute top-6 translate-y-[1px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/torn.svg"} alt={translations.altDecorativeElement} width={1000} height={100} priority className="w-full scale-[-1]" />
                        </span>
                        <span className="w-full absolute top-0 -translate-y-[6px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/torn.svg"} alt={translations.altDecorativeElement} width={1000} height={100} priority className="w-full" />
                        </span>
                    </div>
                    <div 
                        onClick={() => handleUpdateTheme(13)} 
                        className={`min-w-[30%] h-10 relative border border-black bg-black ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
                    >
                        <span className="w-full absolute top-8 translate-y-[6px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/jiggy.svg"} alt={translations.altDecorativeElement} width={1000} height={100} priority className="w-full" />
                        </span>
                        <span className="w-full absolute top-0 -translate-y-[19px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/jiggy.svg"} alt={translations.altDecorativeElement} width={1000} height={100} priority className="w-full scale-[-1]" />
                        </span>
                    </div>
                    <Button type={14} modifierClass={"border border-black relative grid place-items-center after:h-7 after:w-[107%] after:absolute after:border after:border-black"} onUpdate={handleUpdateTheme} disabled={isSaving} />
                    <Button type={15} modifierClass={"border border-black bg-black rounded-3xl"} onUpdate={handleUpdateTheme} disabled={isSaving} />
                    <div 
                        onClick={() => handleUpdateTheme(16)} 
                        className={`min-w-[30%] h-10 relative border border-black ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
                    >
                        <div className={"h-2 w-2 border border-black bg-white absolute -top-1 -left-1"}></div>
                        <div className={"h-2 w-2 border border-black bg-white absolute -top-1 -right-1"}></div>
                        <div className={"h-2 w-2 border border-black bg-white absolute -bottom-1 -left-1"}></div>
                        <div className={"h-2 w-2 border border-black bg-white absolute -bottom-1 -right-1"}></div>
                    </div>
                    <Button type={17} modifierClass={"border border-black bg-black rounded-l-3xl"} onUpdate={handleUpdateTheme} disabled={isSaving} />
                </div>
            </section>

            {/* Color Selection Sections - Initially Hidden */}
            <section className="flex text-sm flex-col mb-10">
                <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{translations.themeTextColour}</span>
                    <div className="flex items-center gap-3">
                        <div 
                            className="w-8 h-8 rounded border-2 cursor-pointer"
                            style={{ backgroundColor: appearance.themeFontColor || '#000000' }}
                            title={appearance.themeFontColor || '#000000'}
                        ></div>
                        <button
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            onClick={() => toggleColorPicker('theme')}
                        >
                            {showColorPickers.theme ? 'Hide' : 'Customize'}
                        </button>
                    </div>
                </div>
                {showColorPickers.theme && (
                    <div className="mt-2">
                        <ColorPickerFlat 
                            currentColor={appearance.themeFontColor || '#000000'}
                            onColorChange={(color) => {
                                console.log('🎨 Theme color picker callback:', color);
                                handleColorUpdate('theme', color);
                            }}
                            disabled={isSaving}
                            fieldName="Theme Font Color"
                        />
                    </div>
                )}
            </section>

            <section className="flex text-sm flex-col mb-10">
                <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{translations.buttonColour}</span>
                    <div className="flex items-center gap-3">
                        <div 
                            className="w-8 h-8 rounded border-2 cursor-pointer"
                            style={{ backgroundColor: appearance.btnColor || '#000000' }}
                            title={appearance.btnColor || '#000000'}
                        ></div>
                        <button
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            onClick={() => toggleColorPicker('button')}
                        >
                            {showColorPickers.button ? 'Hide' : 'Customize'}
                        </button>
                    </div>
                </div>
                {showColorPickers.button && (
                    <div className="mt-2">
                        <ColorPickerFlat 
                            currentColor={appearance.btnColor || '#000000'}
                            onColorChange={(color) => {
                                console.log('🎨 Button color picker callback:', color);
                                handleColorUpdate('button', color);
                            }}
                            disabled={isSaving}
                            fieldName="Button Color"
                        />
                    </div>
                )}
            </section>

            <section className="flex text-sm flex-col mb-10">
                <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{translations.buttonFontColour}</span>
                    <div className="flex items-center gap-3">
                        <div 
                            className="w-8 h-8 rounded border-2 cursor-pointer"
                            style={{ backgroundColor: appearance.btnFontColor || '#FFFFFF' }}
                            title={appearance.btnFontColor || '#FFFFFF'}
                        ></div>
                        <button
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            onClick={() => toggleColorPicker('buttonFont')}
                        >
                            {showColorPickers.buttonFont ? 'Hide' : 'Customize'}
                        </button>
                    </div>
                </div>
                {showColorPickers.buttonFont && (
                    <div className="mt-2">
                        <ColorPickerFlat 
                            currentColor={appearance.btnFontColor || '#FFFFFF'}
                            onColorChange={(color) => {
                                console.log('🎨 Button font color picker callback:', color);
                                handleColorUpdate('buttonFont', color);
                            }}
                            disabled={isSaving}
                            fieldName="Button Font Color"
                        />
                    </div>
                )}
            </section>

            <section className="flex text-sm flex-col">
                <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{translations.shadowColour}</span>
                    <div className="flex items-center gap-3">
                        <div 
                            className="w-8 h-8 rounded border-2 cursor-pointer"
                            style={{ backgroundColor: appearance.btnShadowColor || '#dcdbdb' }}
                            title={appearance.btnShadowColor || '#dcdbdb'}
                        ></div>
                        <button
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            onClick={() => toggleColorPicker('shadow')}
                        >
                            {showColorPickers.shadow ? 'Hide' : 'Customize'}
                        </button>
                    </div>
                </div>
                {showColorPickers.shadow && (
                    <div className="mt-2">
                        <ColorPickerFlat 
                            currentColor={appearance.btnShadowColor || '#dcdbdb'}
                            onColorChange={(color) => {
                                console.log('🎨 Shadow color picker callback:', color);
                                handleColorUpdate('shadow', color);
                            }}
                            disabled={isSaving}
                            fieldName="Button Shadow Color"
                        />
                    </div>
                )}
            </section>
        </div>
    );
}