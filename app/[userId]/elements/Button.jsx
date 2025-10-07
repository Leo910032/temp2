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
import { trackClick } from '@/lib/services/analyticsService';
import "./style/3d.css";


// --- Helper Functions ---
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex = "") => {
    if (typeof hex !== 'string') return null;
    let normalized = hex.startsWith("#") ? hex.slice(1) : hex;
    if (normalized.length === 3) {
        normalized = normalized.split("").map((char) => char + char).join("");
    }
    if (normalized.length !== 6) return null;
    const intVal = parseInt(normalized, 16);
    return { r: (intVal >> 16) & 255, g: (intVal >> 8) & 255, b: intVal & 255 };
};

const toRgba = (hex = "#000000", alpha = 1) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const adjustLuminance = (hex = "", level = 50) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return "#000000";
    const normalizedLevel = clamp(level, 0, 100);
    const amount = (normalizedLevel - 50) / 50;
    const mix = (comp, target) => clamp(Math.round(comp + (target - comp) * Math.abs(amount)), 0, 255);
    const target = amount > 0 ? 255 : 0;
    return `#${((1 << 24) + (mix(rgb.r, target) << 16) + (mix(rgb.g, target) << 8) + mix(rgb.b, target)).toString(16).slice(1)}`;
};

const buildLuminanceBoxShadow = (borderColor = "#000000", level = 50, range = 20) => {
    const normalizedRange = clamp(range, 0, 50);
    const luminanceHex = adjustLuminance(borderColor, level);
    const alpha = clamp(0.25 + level / 200, 0.25, 0.85);
    const blurRadius = Math.max(4, normalizedRange);
    const spreadRadius = Math.max(2, Math.round(normalizedRange / 2));
    const overlayAlpha = clamp(0.08 + level / 400, 0.05, 0.35);

    return {
        backgroundOverlay: toRgba(borderColor, overlayAlpha),
        boxShadow: `0 0 ${blurRadius}px ${spreadRadius}px ${toRgba(luminanceHex, alpha)}`
    };
};

const getButtonDecorations = (btnType) => {
    switch (btnType) {
        case 12:
            return (
                <>
                    <span className="w-full absolute top-6 translate-y-[1px]"><Image src={"https://linktree.sirv.com/Images/svg%20element/torn.svg"} alt="" width={1000} height={100} priority className="w-full scale-[-1]" /></span>
                    <span className="w-full absolute top-0 -translate-y-[6px]"><Image src={"https://linktree.sirv.com/Images/svg%20element/torn.svg"} alt="" width={1000} height={100} priority className="w-full" /></span>
                </>
            );
        case 13:
            return (
                <>
                    <span className="w-full absolute top-8 translate-y-[6px]"><Image src={"https://linktree.sirv.com/Images/svg%20element/jiggy.svg"} alt="" width={1000} height={100} priority className="w-full" /></span>
                    <span className="w-full absolute top-0 -translate-y-[19px]"><Image src={"https://linktree.sirv.com/Images/svg%20element/jiggy.svg"} alt="" width={1000} height={100} priority className="w-full scale-[-1]" /></span>
                </>
            );
        case 16:
            return (
                <>
                    <div className="h-2 w-2 border border-black bg-white absolute -top-1 -left-1"></div>
                    <div className="h-2 w-2 border border-black bg-white absolute -top-1 -right-1"></div>
                    <div className="h-2 w-2 border border-black bg-white absolute -bottom-1 -left-1"></div>
                    <div className="h-2 w-2 border border-black bg-white absolute -bottom-1 -right-1"></div>
                </>
            );
        default:
            return null;
    }
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
    const { userData } = useContext(HouseContext);
    const appearance = userData?.appearance || {};

    const {
        btnType = 0,
        btnShadowColor = '#000',
        btnFontColor = '#000',
        btnColor = '#fff',
        btnBorderColor = '#000000',
        btnOpacity = 100,
        btnLuminanceLevel = 50,
        btnLuminanceRange = 20,
        selectedTheme = 'Lake White',
        fontType = 0,
        themeTextColour = ''
    } = appearance;
    
    const { url, id: linkId, type: linkType } = linkData;

    const [modifierClass, setModifierClass] = useState("");
    const [modifierStyles, setModifierStyles] = useState({});
    const [specialElements, setSpecialElements] = useState(null);
    const [btnFontStyle, setBtnFontStyle] = useState({ color: btnFontColor });
    
    const lastStandardType = useRef(btnType < 18 ? btnType : 0);
    if (btnType < 18) {
        lastStandardType.current = btnType;
    }

    useEffect(() => {
        let newClasses = "";
        let newStyles = {};
        let newElements = null;
        let newFontStyle = { color: btnFontColor };

        const getShapeClass = () => {
            const typeForShape = (btnType >= 18) ? lastStandardType.current : btnType;
            if ([2, 5, 8, 11, 15].includes(typeForShape)) return 'rounded-3xl';
            if ([1, 4, 7, 10].includes(typeForShape)) return 'rounded-lg';
            if (typeForShape === 17) return 'rounded-l-3xl';
            return '';
        };
        const shapeClass = getShapeClass();
        
        switch (btnType) {
            case 0:
                newClasses = `bg-black ${shapeClass}`;
                newStyles = { backgroundColor: btnColor, color: btnFontColor };
                break;
            case 1:
                newClasses = `bg-black rounded-lg`;
                newStyles = { backgroundColor: btnColor, color: btnFontColor };
                break;
            case 2:
                newClasses = `bg-black rounded-3xl`;
                newStyles = { backgroundColor: btnColor, color: btnFontColor };
                break;
            case 3:
                newClasses = `border-2 ${shapeClass}`;
                newStyles = { backgroundColor: 'transparent', color: btnColor, borderColor: btnColor };
                break;
            case 4:
                newClasses = `border-2 rounded-lg`;
                newStyles = { backgroundColor: 'transparent', color: btnColor, borderColor: btnColor };
                break;
            case 5:
                newClasses = `border-2 rounded-3xl`;
                newStyles = { backgroundColor: 'transparent', color: btnColor, borderColor: btnColor };
                break;
            case 6:
                newClasses = `bg-white border border-black ${shapeClass}`;
                newStyles = { backgroundColor: btnColor, color: btnFontColor, filter: `drop-shadow(4px 4px 0px ${btnShadowColor})` };
                break;
            case 7:
                newClasses = `bg-white border border-black rounded-lg`;
                newStyles = { backgroundColor: btnColor, color: btnFontColor, filter: `drop-shadow(4px 4px 0px ${btnShadowColor})` };
                break;
            case 8:
                newClasses = `bg-white border border-black rounded-3xl`;
                newStyles = { backgroundColor: btnColor, color: btnFontColor, filter: `drop-shadow(4px 4px 0px ${btnShadowColor})` };
                break;
            case 9:
                newClasses = `bg-white shadow-[0_15px_30px_5px_rgb(0,0,0,0.5)] ${shapeClass}`;
                newStyles = { backgroundColor: btnColor, color: btnFontColor };
                break;
            case 10:
                newClasses = `bg-white rounded-lg shadow-[0_15px_30px_5px_rgb(0,0,0,0.5)]`;
                newStyles = { backgroundColor: btnColor, color: btnFontColor };
                break;
            case 11:
                newClasses = `bg-white rounded-3xl shadow-[0_15px_30px_5px_rgb(0,0,0,0.5)]`;
                newStyles = { backgroundColor: btnColor, color: btnFontColor };
                break;
            case 12: case 13: case 16:
                newClasses = `relative border border-black ${shapeClass}`;
                newStyles = { backgroundColor: btnColor };
                newFontStyle = { color: btnType === 12 || btnType === 13 ? '#ffffff' : btnFontColor };
                newElements = getButtonDecorations(btnType);
                break;
            case 14:
                newClasses = `border border-black relative grid place-items-center after:h-7 after:w-[107%] after:absolute after:border after:border-black ${shapeClass}`;
                newStyles = { backgroundColor: btnColor, color: btnFontColor };
                break;
            case 15:
                newClasses = `border border-black bg-black rounded-3xl`;
                newStyles = { backgroundColor: btnColor, color: btnFontColor };
                break;
            case 17:
                 newClasses = `border border-black bg-black rounded-l-3xl`;
                 newStyles = { backgroundColor: btnColor, color: btnFontColor };
                 break;
            case 18:
                newClasses = `border-2 ${shapeClass}`;
                newStyles = {
                    backgroundColor: toRgba(btnColor, btnOpacity / 100),
                    borderColor: btnBorderColor,
                    color: btnFontColor,
                };
                break;
            case 19:
                newClasses = `border-2 ${shapeClass}`;
                const shadow = buildLuminanceBoxShadow(btnBorderColor, btnLuminanceLevel, btnLuminanceRange);
                newStyles = {
                    backgroundColor: shadow.backgroundOverlay,
                    boxShadow: shadow.boxShadow,
                    borderColor: btnBorderColor,
                    color: btnFontColor,
                };
                break;
            default:
                newClasses = `bg-black ${shapeClass}`;
                newStyles = { backgroundColor: btnColor, color: btnFontColor };
                break;
        }

        setModifierClass(newClasses);
        setModifierStyles(newStyles);
        setSpecialElements(newElements);
        setBtnFontStyle(newFontStyle);

    }, [btnType, btnColor, btnFontColor, btnShadowColor, btnBorderColor, btnOpacity, btnLuminanceLevel, btnLuminanceRange, selectedTheme, themeTextColour]);
    
    // --- Render Logic ---
    const urlRef = useRef(null);
    const [isHovered, setIsHovered] = useState(false);
    const { t } = useTranslation();
    const copySuccessMessage = useMemo(() => t('public.links.copy_success', 'Link copied!'), [t]);
    const fontName = availableFonts_Classic[fontType] || availableFonts_Classic[0];
    
    const handleCopy = () => {
        if (!url) return;
        navigator.clipboard.writeText(makeValidUrl(url));
        toast.success(copySuccessMessage, {
            style: { border: '1px solid #6fc276', padding: '16px', color: '#6fc276' },
            iconTheme: { primary: '#6fc276', secondary: '#FFFAEE' },
        });
    };

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

    return (
        <div 
            className={`${modifierClass} userBtn relative justify-between items-center flex hover:scale-[1.025] md:w-[35rem] sm:w-[30rem] w-clamp transition-all duration-200`}
            style={modifierStyles}
        >
            {specialElements}
            
            <Link 
                href={makeValidUrl(url)} 
                target="_blank" 
                onClick={handleLinkClick}
                className="cursor-pointer flex gap-3 items-center min-h-10 py-3 px-3 flex-1 relative z-10"
            >
                <IconDiv url={url} />
                <ButtonText 
                    btnFontStyle={btnFontStyle} 
                    content={content} 
                    fontClass={fontName.class} 
                />
            </Link>
            
            <div 
                onClick={handleCopy} 
                className="absolute p-2 h-9 right-3 z-20 grid place-items-center aspect-square rounded-full border border-white group cursor-pointer bg-black text-white hover:scale-105 active:scale-90 transition-all duration-200"
            >
                <FaCopy className="rotate-10 group-hover:rotate-0 transition-transform duration-200" />
            </div>
        </div>
    );
}