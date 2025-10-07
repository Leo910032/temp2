// Add this debug version of your Buttons component to see what's happening:

/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
"use client"

import React, { useContext, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import { useTranslation } from "@/lib/translation/useTranslation";
import { AppearanceContext } from "../AppearanceContext";
import Button from "../elements/Button";
import ColorPickerFlat from "../elements/ColorPickerFlat.jsx";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeHex = (hex = "") => {
    if (typeof hex !== "string") return null;
    const trimmed = hex.trim();
    if (!trimmed) return null;
    let normalized = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
    if (normalized.length === 3) {
        normalized = normalized.split("").map(char => char + char).join("");
    }
    if (normalized.length !== 6) return null;
    return normalized.toLowerCase();
};

const hexToRgb = (hex = "") => {
    const normalized = normalizeHex(hex);
    if (!normalized) return null;
    const intVal = parseInt(normalized, 16);
    return {
        r: (intVal >> 16) & 255,
        g: (intVal >> 8) & 255,
        b: intVal & 255
    };
};

const rgbToHex = (r, g, b) => {
    const safe = (value) => clamp(Math.round(Number.isFinite(value) ? value : 0), 0, 255);
    const toHex = (component) => component.toString(16).padStart(2, "0");
    return `#${toHex(safe(r))}${toHex(safe(g))}${toHex(safe(b))}`;
};

const hexToRgba = (hex = "", alpha = 1) => {
    const rgb = hexToRgb(hex);
    if (!rgb) {
        return `rgba(0, 0, 0, ${clamp(alpha, 0, 1)})`;
    }
    const safeAlpha = clamp(alpha, 0, 1);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
};

const mixChannel = (channel, target, amount) => {
    return Math.round(channel * (1 - amount) + target * amount);
};

const adjustLuminance = (hex = "", level = 50) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return "#000000";
    const normalizedLevel = clamp(level, 0, 100);
    const amount = Math.abs(normalizedLevel - 50) / 50;
    if (amount === 0) return `#${normalizeHex(hex)}`;

    const target = normalizedLevel >= 50 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
    const adjusted = {
        r: mixChannel(rgb.r, target.r, amount),
        g: mixChannel(rgb.g, target.g, amount),
        b: mixChannel(rgb.b, target.b, amount)
    };
    return rgbToHex(adjusted.r, adjusted.g, adjusted.b);
};

const getOpacityPreviewColor = (hex = "#000000", opacity = 100) => {
    const normalizedOpacity = clamp(opacity, 0, 100) / 100;
    return hexToRgba(hex, normalizedOpacity);
};

const toNumber = (value, fallback, min = -Infinity, max = Infinity) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return clamp(parsed, min, max);
};

const getLuminanceStyles = (borderColor = "#000000", level = 50, range = 20) => {
    const normalizedRange = clamp(range, 0, 50);
    const luminanceHex = adjustLuminance(borderColor, level);
    const alpha = clamp(0.25 + (level / 200), 0.25, 0.85);
    const blurRadius = Math.max(4, normalizedRange);
    const spreadRadius = Math.max(2, Math.round(normalizedRange / 2));

    return {
        shadowHex: luminanceHex,
        boxShadow: `0 0 ${blurRadius}px ${spreadRadius}px ${hexToRgba(luminanceHex, alpha)}`
    };
};

export default function Buttons() {
    const { t, isInitialized } = useTranslation();
    
    // Get all necessary data and functions from the centralized context.
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);
    
    // State to control visibility of color pickers
    const [showColorPickers, setShowColorPickers] = useState({
        theme: false,
        button: false,
        buttonFont: false,
        border: false,
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
            borderColour: t('dashboard.appearance.buttons.border_colour') || 'Border Colour',
            advanced: t('dashboard.appearance.buttons.advanced_styles') || 'Advanced Styles',
            opacityLabel: t('dashboard.appearance.buttons.opacity') || 'Opacity',
            luminanceLevel: t('dashboard.appearance.buttons.luminance_level') || 'Luminance Level',
            luminanceRange: t('dashboard.appearance.buttons.luminance_range') || 'Luminance Range',
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
            case 'border':
                fieldName = 'btnBorderColor';
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
        btnBorderColor: appearance?.btnBorderColor,
        btnOpacity: appearance?.btnOpacity,
        btnLuminanceLevel: appearance?.btnLuminanceLevel,
        btnLuminanceRange: appearance?.btnLuminanceRange,
        themeFontColor: appearance?.themeFontColor,
        btnType: appearance?.btnType
    });

    // Render a skeleton loader if the context data isn't ready yet.
    const btnType = toNumber(appearance?.btnType, 0);
    const btnBorderColor = appearance?.btnBorderColor ?? '#000000';
    const btnOpacityValue = toNumber(appearance?.btnOpacity, 100, 0, 100);
    const btnLuminanceLevel = toNumber(appearance?.btnLuminanceLevel, 50, 0, 100);
    const btnLuminanceRange = toNumber(appearance?.btnLuminanceRange, 20, 0, 50);
    const baseButtonColor = appearance?.btnColor || '#000000';

    const opacityPreviewColor = useMemo(
        () => getOpacityPreviewColor(baseButtonColor, btnOpacityValue),
        [baseButtonColor, btnOpacityValue]
    );

    const luminanceDerivedStyles = useMemo(
        () => getLuminanceStyles(btnBorderColor, btnLuminanceLevel, btnLuminanceRange),
        [btnBorderColor, btnLuminanceLevel, btnLuminanceRange]
    );

    const luminancePreviewBackground = useMemo(() => {
        const baseAlpha = clamp(0.08 + (btnLuminanceLevel / 400), 0.05, 0.35);
        return hexToRgba(btnBorderColor, baseAlpha);
    }, [btnBorderColor, btnLuminanceLevel]);

    const createSliderHandler = useCallback(
        (field, min, max) => (event) => {
            if (isSaving) return;
            const rawValue = Number(
                event?.target?.value ?? (typeof event?.detail?.value !== 'undefined' ? event.detail.value : NaN)
            );
            if (!Number.isFinite(rawValue)) return;
            const numericValue = clamp(rawValue, min, max);
            updateAppearance(field, numericValue);
        },
        [isSaving, updateAppearance]
    );

    const handleOpacityChange = useMemo(
        () => createSliderHandler('btnOpacity', 0, 100),
        [createSliderHandler]
    );

    const handleLuminanceLevelChange = useMemo(
        () => createSliderHandler('btnLuminanceLevel', 0, 100),
        [createSliderHandler]
    );

    const handleLuminanceRangeChange = useMemo(
        () => createSliderHandler('btnLuminanceRange', 0, 50),
        [createSliderHandler]
    );

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
                        <div><strong>Button Border Color:</strong> {appearance.btnBorderColor || 'undefined'}</div>
                        <div><strong>Button Opacity:</strong> {appearance.btnOpacity ?? 'undefined'}</div>
                        <div><strong>Luminance Level:</strong> {appearance.btnLuminanceLevel ?? 'undefined'}</div>
                        <div><strong>Luminance Range:</strong> {appearance.btnLuminanceRange ?? 'undefined'}</div>
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

            <section className="flex gap-5 text-sm flex-col mb-10">
                <span className="font-semibold">{translations.advanced}</span>
                <div className="items-center flex flex-wrap gap-5">
                    <Button
                        type={18}
                        modifierClass={"rounded-3xl border"}
                        modifierStyles={{
                            backgroundColor: opacityPreviewColor,
                            borderColor: btnBorderColor,
                            borderWidth: '2px',
                            transition: 'background-color 150ms ease, border-color 150ms ease'
                        }}
                        onUpdate={handleUpdateTheme}
                        disabled={isSaving}
                    />
                    <Button
                        type={19}
                        modifierClass={"rounded-3xl border"}
                        modifierStyles={{
                            backgroundColor: luminancePreviewBackground,
                            borderColor: btnBorderColor,
                            borderWidth: '2px',
                            boxShadow: luminanceDerivedStyles.boxShadow,
                            transition: 'box-shadow 150ms ease, border-color 150ms ease, background-color 150ms ease'
                        }}
                        onUpdate={handleUpdateTheme}
                        disabled={isSaving}
                    />
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
                    <span className="font-semibold">{translations.borderColour}</span>
                    <div className="flex items-center gap-3">
                        <div 
                            className="w-8 h-8 rounded border-2 cursor-pointer"
                            style={{ backgroundColor: appearance.btnBorderColor || '#000000' }}
                            title={appearance.btnBorderColor || '#000000'}
                        ></div>
                        <button
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            onClick={() => toggleColorPicker('border')}
                        >
                            {showColorPickers.border ? 'Hide' : 'Customize'}
                        </button>
                    </div>
                </div>
                {showColorPickers.border && (
                    <div className="mt-2">
                        <ColorPickerFlat 
                            currentColor={appearance.btnBorderColor || '#000000'}
                            onColorChange={(color) => {
                                console.log('🎨 Border color picker callback:', color);
                                handleColorUpdate('border', color);
                            }}
                            disabled={isSaving}
                            fieldName="Border Color"
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

            {btnType === 18 && (
                <section className="flex text-sm flex-col mt-10 mb-10">
                    <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold">{translations.opacityLabel}</span>
                        <span className="text-xs text-gray-500">{btnOpacityValue}%</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={btnOpacityValue}
                        aria-label={translations.opacityLabel}
                        onChange={handleOpacityChange}
                        onInput={handleOpacityChange}
                        className="w-full accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                        <span>0%</span>
                        <span>100%</span>
                    </div>
                </section>
            )}

            {btnType === 19 && (
                <section className="flex text-sm flex-col mt-2 gap-8">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold">{translations.luminanceLevel}</span>
                            <span className="text-xs text-gray-500">{btnLuminanceLevel}</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={btnLuminanceLevel}
                            aria-label={translations.luminanceLevel}
                            onChange={handleLuminanceLevelChange}
                            onInput={handleLuminanceLevelChange}
                            className="w-full accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                            <span>0</span>
                            <span>100</span>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold">{translations.luminanceRange}</span>
                            <span className="text-xs text-gray-500">{btnLuminanceRange}px</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={50}
                            step={1}
                            value={btnLuminanceRange}
                            aria-label={translations.luminanceRange}
                            onChange={handleLuminanceRangeChange}
                            onInput={handleLuminanceRangeChange}
                            className="w-full accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                            <span>0px</span>
                            <span>50px</span>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
