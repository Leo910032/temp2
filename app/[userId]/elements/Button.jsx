"use client"
import { useContext, useEffect, useRef, useState, useMemo } from "react";
import { HouseContext } from "../House";
import { hexToRgba, makeValidUrl } from "@/lib/utilities";
import { getCompanyFromUrl } from "@/lib/BrandLinks";
import { availableFonts_Classic } from "@/lib/FontsList";
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from "react-hot-toast";
import { FaCopy } from "react-icons/fa6";
import Link from "next/link";
import Image from "next/image";
import IconDiv from "./IconDiv";
import ButtonText from "./ButtonText";
import "./style/3d.css";
import { trackClick } from '@/lib/services/analyticsService'; // ✅ IMPORT the new analytics service

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
    const {
        btnType = 0,
        btnShadowColor = '#000',
        btnFontColor = '#000',
        btnColor = '#fff',
        selectedTheme = 'Lake White',
        fontType = 0,
        themeTextColour = ''
    } = userData;
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

            default:
                newModifierClass = "bg-black";
                newModifierStyles.backgroundColor = btnColor;
                break;
        }

         
        setModifierClass(newModifierClass);
        setModifierStyles(newModifierStyles);
        setSpecialElements(newSpecialElements);
        setBtnFontStyle({ color: btnFontColor });

    }, [btnType, btnColor, btnFontColor, btnShadowColor, selectedTheme, themeTextColour, url]);

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