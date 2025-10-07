"use client"
import { useContext, useEffect, useRef, useState, useMemo } from "react";
import { HouseContext } from "../House";
import { makeValidUrl } from "@/lib/utilities";
import { getCompanyFromUrl } from "@/lib/BrandLinks";
import { availableFonts_Classic } from "@/lib/FontsList";
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from "react-hot-toast";
import { FaCopy } from "react-icons/fa6";
import Link from "next/link";
import Image from "next/image";
import IconDiv from "./IconDiv";
import ButtonText from "./ButtonText";
import { trackClick } from '@/lib/services/analyticsService'; // ✅ IMPORT the new analytics service
import "./style/3d.css";

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

const toRgba = (hex = "#000000", alpha = 1) => {
    const numericAlpha = Number(alpha);
    const safeAlpha = clamp(Number.isFinite(numericAlpha) ? numericAlpha : 1, 0, 1);
    const rgb = hexToRgb(hex);
    if (!rgb) {
        return `rgba(0, 0, 0, ${safeAlpha})`;
    }

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

const buildLuminanceBoxShadow = (borderColor = "#000000", level = 50, range = 20) => {
    const normalizedRange = clamp(range, 0, 50);
    const luminanceHex = adjustLuminance(borderColor, level);
    const alpha = clamp(0.25 + (level / 200), 0.25, 0.85);
    const blurRadius = Math.max(4, normalizedRange);
    const spreadRadius = Math.max(2, Math.round(normalizedRange / 2));
    const overlayAlpha = clamp(0.08 + (level / 400), 0.05, 0.35);

    return {
        backgroundOverlay: toRgba(borderColor, overlayAlpha),
        boxShadow: `0 0 ${blurRadius}px ${spreadRadius}px ${toRgba(luminanceHex, alpha)}`
    };
};

const ROUNDED_TYPES = new Set([1, 4, 7, 10]);
const PILL_TYPES = new Set([2, 5, 8, 11, 15]);
const LEFT_PILL_TYPES = new Set([17]);

const radiusPreferenceToClass = (preference) => {
    if (preference === undefined || preference === null) {
        return undefined;
    }

    if (typeof preference === 'number') {
        switch (preference) {
            case 0: return '';
            case 1: return 'rounded-lg';
            case 2: return 'rounded-3xl';
            default: return undefined;
        }
    }

    if (typeof preference === 'string') {
        const trimmed = preference.trim();
        if (!trimmed) {
            return undefined;
        }

        const normalized = trimmed.toLowerCase();

        const directMap = new Map([
            ['rounded-none', ''],
            ['rounded-0', ''],
            ['square', ''],
            ['sharp', ''],
            ['none', ''],
            ['rounded', 'rounded-lg'],
            ['rounded-md', 'rounded-lg'],
            ['rounded-lg', 'rounded-lg'],
            ['rounded-xl', 'rounded-lg'],
            ['round', 'rounded-lg'],
            ['rounded-3xl', 'rounded-3xl'],
            ['rounded-full', 'rounded-3xl'],
            ['pill', 'rounded-3xl'],
            ['full', 'rounded-3xl'],
            ['circle', 'rounded-3xl'],
            ['rounded-left', 'rounded-l-3xl'],
            ['rounded-l', 'rounded-l-3xl'],
            ['rounded-l-3xl', 'rounded-l-3xl'],
            ['left-pill', 'rounded-l-3xl'],
            ['left', 'rounded-l-3xl']
        ]);

        if (directMap.has(normalized)) {
            return directMap.get(normalized);
        }

        const numericCandidate = Number(normalized);
        if (Number.isFinite(numericCandidate)) {
            return radiusPreferenceToClass(numericCandidate);
        }

        if (normalized.startsWith('rounded-')) {
            return trimmed;
        }

        if (normalized.includes('pill') || normalized.includes('full') || normalized.includes('circle')) {
            return 'rounded-3xl';
        }

        if (normalized.includes('left')) {
            return 'rounded-l-3xl';
        }

        if (normalized.includes('round')) {
            return 'rounded-lg';
        }

        if (normalized.includes('square') || normalized.includes('sharp')) {
            return '';
        }

        return undefined;
    }

    if (typeof preference === 'object') {
        const candidateKeys = ['value', 'shape', 'radius', 'className', 'class'];
        for (const key of candidateKeys) {
            if (key in preference) {
                const derived = radiusPreferenceToClass(preference[key]);
                if (derived !== undefined) {
                    return derived;
                }
            }
        }
    }

    return undefined;
};

const determineBorderRadiusClass = (type, preference) => {
    const resolvedPreference = radiusPreferenceToClass(preference);
    if (resolvedPreference !== undefined) {
        return resolvedPreference;
    }

    if (type === 18 || type === 19) return 'rounded-3xl';
    if (PILL_TYPES.has(type)) return 'rounded-3xl';
    if (ROUNDED_TYPES.has(type)) return 'rounded-lg';
    if (LEFT_PILL_TYPES.has(type)) return 'rounded-l-3xl';

    return '';
};

// Special font component for the "New Mario" theme
const SuperFont = ({ text, isHovered }) => {
    const colors = ['#fff', '#fff', '#fff', '#fff', '#fff'];
    const coloredText = text.split('').map((char, index) => (
        <span
            className="md:text-2xl sm:text-xl text-lg drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] bg-transparent"
            key={index}
            style={{ color: isHovered ? "#3b82f6" : colors[index % colors.length] }}
        >
            {char}
        </span>
    ));
    return <div>{coloredText}</div>;
};
 

export default function Button({ linkData, content }) {
    // --- Data from Central Context ---
    const { userData } = useContext(HouseContext);

    const appearance = userData?.appearance || {};

    const {
        btnType = 0,
        btnShadowColor = '#000000',
        btnFontColor = '#000000',
        btnColor = '#ffffff',
        btnBorderColor = '#000000',
        btnOpacity = 100,
        btnLuminanceLevel = 50,
        btnLuminanceRange = 20,
        selectedTheme = 'Lake White',
        fontType = 0,
        themeFontColor = '#000000',
        themeTextColour: appearanceThemeTextColour,
        btnAdvancedRadius,
        btnRadiusPreference,
        btnRadiusStyle,
        btnCornerStyle,
        btnShape,
        buttonShape
    } = appearance;

    const themeTextColour = appearanceThemeTextColour ?? themeFontColor;

    const radiusPreferenceCandidates = [
        btnAdvancedRadius,
        btnRadiusPreference,
        btnRadiusStyle,
        btnCornerStyle,
        btnShape,
        buttonShape
    ];

    const advancedRadiusPreference =
        radiusPreferenceCandidates.find((value) => value !== undefined && value !== null) ?? null;

    const borderRadiusClass = determineBorderRadiusClass(btnType, advancedRadiusPreference);
    const { url, id: linkId, type: linkType } = linkData; // Destructure link data from props

  // State for styling and interaction
    const [modifierClass, setModifierClass] = useState("");
    const [modifierStyles, setModifierStyles] = useState({});
    const [specialElements, setSpecialElements] = useState(null);
    const [isHovered, setIsHovered] = useState(false);
    const urlRef = useRef(null);

    // Translations
    const { t, isInitialized } = useTranslation();
    const copySuccessMessage = useMemo(() => 
        isInitialized ? t('public.links.copy_success') : 'Link copied!',
        [isInitialized, t]
    );
        // Styling object for font color
    const [btnFontStyle, setBtnFontStyle] = useState({ color: "" });
    // ✅ FIXED: Moved handleCopy inside the component to access props and state
    const handleCopy = () => {
        if (!url) return;
        navigator.clipboard.writeText(makeValidUrl(url));
        toast.success(copySuccessMessage, {
            style: { border: '1px solid #6fc276', padding: '16px', color: '#6fc276' },
            iconTheme: { primary: '#6fc276', secondary: '#FFFAEE' },
        });
    };
       // ✅ NEW: Simplified click handler that calls the analytics service
    const handleLinkClick = () => {
        if (userData?.uid && linkId) {
            trackClick(userData.uid, {
                linkId: linkId,
                linkTitle: content,
                linkUrl: url,
                linkType: linkType || 'custom',
            });
        }
    };

    function getRootNameFromUrl(linkUrl) {
        try {
            return new URL(makeValidUrl(linkUrl)).hostname;
        } catch (error) {
            console.error("Invalid URL for parsing root name:", linkUrl, error);
            return '';
        }
    }

  // --- UNIFIED BUTTON STYLING SYSTEM (matches dashboard) ---
    useEffect(() => {
        // Handle special themes first
        if (selectedTheme === "3D Blocks") {
            setModifierClass("relative after:absolute after:h-2 after:w-[100.5%] after:bg-black bg-white after:-bottom-2 after:left-[1px] after:skew-x-[57deg] after:ml-[2px] before:absolute before:h-[107%] before:w-3 before:bg-[currentColor] before:top-[1px] before:border-2 before:border-black before:-right-3 before:skew-y-[30deg] before:grid before:grid-rows-2 border-2 border-black inset-2 ml-[-20px] btn");
            
            const getRootNameFromUrl = (linkUrl) => new URL(makeValidUrl(linkUrl)).hostname;
            const rootName = getRootNameFromUrl(url);
            let colors = ["#191414", "#14171A"];
            switch (String(getCompanyFromUrl(rootName)).toLowerCase()) {
                case 'tiktok': colors = ["#ff0050", "#00f2ea"]; break;
                case 'twitter': colors = ["#1DA1F2", "#657786"]; break;
                case 'spotify': colors = ["#1DB954", "#1DB954"]; break;
                case 'youtube': colors = ["#FF0000", "#FF0000"]; break;
                case 'instagram': colors = ["#E1306C", "#833AB4"]; break;
            }
            setModifierStyles({ backgroundColor: colors[0] || '', color: colors[1] || '' });
            setBtnFontStyle({ color: '#fff' });
            setSpecialElements(null);
            return;
        }

        // UNIFIED STYLING SYSTEM
        let newModifierClass = "";
        let newModifierStyles = {
            backgroundColor: btnColor,
            color: btnFontColor,
            borderColor: selectedTheme === "Matrix" ? themeTextColour : '#000'
        };
        let newSpecialElements = null;

        switch (btnType) {
            case 0: newModifierClass = "bg-black"; break;
            case 1: newModifierClass = "bg-black rounded-lg"; break;
            case 2: newModifierClass = "bg-black rounded-3xl"; break;
            case 3: newModifierClass = "border border-black"; newModifierStyles.backgroundColor = "transparent"; break;
            case 4: newModifierClass = "border border-black rounded-lg"; newModifierStyles.backgroundColor = "transparent"; break;
            case 5: newModifierClass = "border border-black rounded-3xl"; newModifierStyles.backgroundColor = "transparent"; break;
            case 6: newModifierClass = "bg-white border border-black"; newModifierStyles.filter = `drop-shadow(4px 4px 0px ${btnShadowColor})`; break;
            case 7: newModifierClass = "bg-white border border-black rounded-lg"; newModifierStyles.filter = `drop-shadow(4px 4px 0px ${btnShadowColor})`; break;
            case 8: newModifierClass = "bg-white border border-black rounded-3xl"; newModifierStyles.filter = `drop-shadow(4px 4px 0px ${btnShadowColor})`; break;
            case 9: newModifierClass = "bg-white shadow-[0_15px_30px_5px_rgb(0,0,0,0.5)]"; break;
            case 10: newModifierClass = "bg-white rounded-lg shadow-[0_15px_30px_5px_rgb(0,0,0,0.5)]"; break;
            case 11: newModifierClass = "bg-white rounded-3xl shadow-[0_15px_30px_5px_rgb(0,0,0,0.5)]"; break;

            // SPECIAL buttons (12-17)
            case 12:
                newModifierClass = "relative border border-black bg-black";
                newModifierStyles.backgroundColor = btnColor;
                newSpecialElements = (
                    <>
                        <span className="w-full absolute top-6 translate-y-[1px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/torn.svg"} alt="" width={1000} height={100} priority className="w-full scale-[-1]" />
                        </span>
                        <span className="w-full absolute top-0 -translate-y-[6px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/torn.svg"} alt="" width={1000} height={100} priority className="w-full" />
                        </span>
                    </>
                );
                setBtnFontStyle({ color: '#fff' });
                break;

            case 13:
                newModifierClass = "relative border border-black bg-black";
                newModifierStyles.backgroundColor = btnColor;
                newSpecialElements = (
                    <>
                        <span className="w-full absolute top-8 translate-y-[6px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/jiggy.svg"} alt="" width={1000} height={100} priority className="w-full" />
                        </span>
                        <span className="w-full absolute top-0 -translate-y-[19px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/jiggy.svg"} alt="" width={1000} height={100} priority className="w-full scale-[-1]" />
                        </span>
                    </>
                );
                setBtnFontStyle({ color: '#fff' });
                break;

            case 14:
                newModifierClass = "border border-black relative grid place-items-center after:h-7 after:w-[107%] after:absolute after:border after:border-black";
                newModifierStyles.backgroundColor = btnColor;
                break;

            case 15:
                newModifierClass = "border border-black bg-black rounded-3xl";
                newModifierStyles.backgroundColor = btnColor;
                break;

            case 16:
                newModifierClass = "relative border border-black";
                newModifierStyles.backgroundColor = btnColor;
                newSpecialElements = (
                    <>
                        <div className="h-2 w-2 border border-black bg-white absolute -top-1 -left-1"></div>
                        <div className="h-2 w-2 border border-black bg-white absolute -top-1 -right-1"></div>
                        <div className="h-2 w-2 border border-black bg-white absolute -bottom-1 -left-1"></div>
                        <div className="h-2 w-2 border border-black bg-white absolute -bottom-1 -right-1"></div>
                    </>
                );
                break;

            case 17:
                newModifierClass = "border border-black bg-black rounded-l-3xl";
                newModifierStyles.backgroundColor = btnColor;
                break;

            case 18: {
                const numericOpacity = Number(btnOpacity);
                const safeOpacity = Number.isFinite(numericOpacity) ? clamp(numericOpacity, 0, 100) : 100;
                const opacityAlpha = safeOpacity / 100;
                const advancedClassNames = ['border', borderRadiusClass].filter(Boolean).join(' ');
                newModifierClass = advancedClassNames || 'border';
                newModifierStyles = {
                    backgroundColor: toRgba(btnColor, opacityAlpha),
                    color: btnFontColor,
                    borderColor: btnBorderColor,
                    borderWidth: '2px',
                    transition: 'background-color 150ms ease, border-color 150ms ease, opacity 150ms ease'
                };
                break;
            }

            case 19: {
                const { backgroundOverlay, boxShadow } = buildLuminanceBoxShadow(
                    btnBorderColor,
                    btnLuminanceLevel,
                    btnLuminanceRange
                );
                const advancedClassNames = ['border', borderRadiusClass].filter(Boolean).join(' ');
                newModifierClass = advancedClassNames || 'border';
                newModifierStyles = {
                    backgroundColor: backgroundOverlay,
                    color: btnFontColor,
                    borderColor: btnBorderColor,
                    borderWidth: '2px',
                    boxShadow,
                    transition: 'box-shadow 150ms ease, border-color 150ms ease, background-color 150ms ease'
                };
                break;
            }

            default:
                newModifierClass = "bg-black";
                newModifierStyles.backgroundColor = btnColor;
                break;
        }

         
        setModifierClass(newModifierClass);
        setModifierStyles(newModifierStyles);
        setSpecialElements(newSpecialElements);
        setBtnFontStyle({ color: btnFontColor });

    }, [
        btnBorderColor,
        btnColor,
        btnFontColor,
        btnLuminanceLevel,
        btnLuminanceRange,
        btnOpacity,
        btnShadowColor,
        btnType,
        selectedTheme,
        themeTextColour,
        url,
        borderRadiusClass
    ]);

    // --- Render Logic ---
    const fontName = availableFonts_Classic[fontType] || availableFonts_Classic[0];

    // Special render for Mario theme
    if (selectedTheme === "New Mario") {
        return (
            <div className="userBtn relative overflow-hidden flex justify-between items-center h-16 md:w-[35rem] sm:w-[30rem] w-clamp">
                {Array(9).fill("").map((_, i) => (
                    <Image 
                        key={i} 
                        src={"https://linktree.sirv.com/Images/Scene/Mario/mario-brick.png"} 
                        alt="Mario Brick" 
                        width={650} 
                        height={660} 
                        className="h-16 w-auto object-contain hover:-translate-y-2 cursor-pointer" 
                        onClick={() => urlRef.current?.click()} 
                        onMouseEnter={() => setIsHovered(true)} 
                        onMouseLeave={() => setIsHovered(false)} 
                    />
                ))}
                <Link 
                    ref={urlRef} 
                    href={makeValidUrl(url)} 
                    target="_blank" 
                    className="absolute top-0 left-0 z-30 pointer-events-none cursor-pointer flex gap-3 items-center min-h-10 py-3 px-3 flex-1"
                >
                    <div className="grid place-items-center">
                        <Image 
                            src={"https://linktree.sirv.com/Images/Scene/Mario/mario-box.png"} 
                            alt="Mario Box" 
                            width={650} 
                            height={660} 
                            className={`h-12 w-auto object-contain hover:-translate-y-2 ${isHovered ? "rotate-2" : ""}`} 
                        />
                        <div className={`absolute ${isHovered ? "rotate-2" : ""}`}>
                            <IconDiv url={url} unique="Mario" />
                        </div>
                    </div>
                    <ButtonText content={<SuperFont text={content} isHovered={isHovered} />} fontClass="MariaFont" />
                </Link>
                <div 
                    onClick={handleCopy} 
                    className="absolute p-2 h-9 right-3 z-40 grid place-items-center aspect-square rounded-full border border-white group cursor-pointer bg-black text-white hover:scale-105 active:scale-90"
                >
                    <FaCopy className="rotate-10 group-hover:rotate-0" />
                </div>
            </div>
        );
    }

    // ✅ UNIFIED RENDER - matches dashboard styling system exactly
    return (
        <div 
            className={`${modifierClass} userBtn relative justify-between items-center flex hover:scale-[1.025] md:w-[35rem] sm:w-[30rem] w-clamp transition-all duration-200`}
            style={modifierStyles}
        >
            {/* Special elements for decorative buttons */}
            {specialElements}
            
            <Link 
                href={makeValidUrl(url)} 
                target="_blank" 
                onClick={handleLinkClick} // ✅ THIS IS THE FIX
                className="cursor-pointer flex gap-3 items-center min-h-10 py-3 px-3 flex-1 relative z-10"
            >
                <IconDiv url={url} />
                <ButtonText 
                    btnFontStyle={btnFontStyle} 
                    content={content} 
                    fontClass={fontName.class} 
                />
            </Link>
            
            {/* Copy button */}
            <div 
                onClick={handleCopy} 
                className="absolute p-2 h-9 right-3 z-20 grid place-items-center aspect-square rounded-full border border-white group cursor-pointer bg-black text-white hover:scale-105 active:scale-90 transition-all duration-200"
            >
                <FaCopy className="rotate-10 group-hover:rotate-0 transition-transform duration-200" />
            </div>
        </div>
    );
}
