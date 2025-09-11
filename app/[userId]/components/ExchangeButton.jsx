// app/[userId]/components/ExchangeButton.jsx - Updated with scan token support
"use client"
import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translation/useTranslation';
import ExchangeModal from './ExchangeModal';
import { collection, doc, onSnapshot } from "firebase/firestore";
import { fireApp } from "@/important/firebase";
import { fetchUserData } from "@/lib/fetch data/fetchUserData";
import { hexToRgba } from "@/lib/utilities";
import { availableFonts_Classic } from "@/lib/FontsList";
import Image from "next/image";

export default function ExchangeButton({ 
    username, 
    userInfo, 
    fastLookupUsed, 
    userId, 
    scanToken = null, // NEW: Secure scan token from server
    scanAvailable = false // NEW: Whether scanning is available
}) {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Theme state - COMPLETE THEME SUPPORT like Button.jsx
    const [btnType, setBtnType] = useState(0);
    const [btnShadowColor, setBtnShadowColor] = useState('');
    const [btnFontColor, setBtnFontColor] = useState('');
    const [btnColor, setBtnColor] = useState('');
    const [selectedTheme, setSelectedTheme] = useState('');
    const [themeTextColour, setThemeTextColour] = useState("");
    const [selectedFontClass, setSelectedFontClass] = useState("");
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        async function fetchThemeData() {
            try {
                console.log("🔍 ExchangeButton: Fetching theme data for userId:", userId);
                
                const currentUser = await fetchUserData(userId);
                if (!currentUser) {
                    console.warn("❌ ExchangeButton: No current user found");
                    return;
                }

                console.log("✅ ExchangeButton: Current user found:", currentUser);

                const collectionRef = collection(fireApp, "AccountData");
                const docRef = doc(collectionRef, currentUser);

                const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        console.log("📊 ExchangeButton: Theme data received:", {
                            btnType: data.btnType,
                            btnColor: data.btnColor,
                            btnFontColor: data.btnFontColor,
                            selectedTheme: data.selectedTheme,
                            fontType: data.fontType
                        });
                        
                        setBtnType(data.btnType || 0);
                        setBtnShadowColor(data.btnShadowColor || "#000");
                        setBtnFontColor(data.btnFontColor || "#000");
                        setBtnColor(data.btnColor || "#fff");
                        setSelectedTheme(data.selectedTheme || '');
                        setThemeTextColour(data.themeFontColor || "");
                        
                        // Set font class
                        const fontName = availableFonts_Classic[data.fontType ? data.fontType - 1 : 0];
                        setSelectedFontClass(fontName?.class || '');
                    } else {
                        console.warn("❌ ExchangeButton: Document does not exist");
                    }
                });

                return () => unsubscribe();
            } catch (error) {
                console.error("❌ ExchangeButton: Error fetching theme data:", error);
            }
        }

        if (userId) {
            fetchThemeData();
        } else {
            console.warn("⚠️ ExchangeButton: No userId provided");
        }
    }, [userId]);

    // Button styling functions (same as before)
    const getButtonClasses = () => {
        let baseClasses = "userBtn relative justify-between items-center flex hover:scale-[1.025] w-full";
        
        if (selectedTheme === "3D Blocks") {
            return `${baseClasses} relative after:absolute after:h-2 after:w-[100.5%] after:bg-black bg-white after:-bottom-2 after:left-[1px] after:skew-x-[57deg] after:ml-[2px] before:absolute before:h-[107%] before:w-3 before:bg-[currentColor] before:top-[1px] before:border-2 before:border-black before:-right-3 before:skew-y-[30deg] before:grid before:grid-rows-2 border-2 border-black inset-2 ml-[-20px] btn`;
        }
        
        if (selectedTheme === "New Mario") {
            return "userBtn relative overflow-x-hidden overflow-y-hidden flex justify-between items-center h-16 w-full";
        }
        
        switch (btnType) {
            case 0: 
                return `${baseClasses}`;
            case 1: 
                return `${baseClasses} rounded-lg`;
            case 2: 
                return `${baseClasses} rounded-3xl`;
            case 3: 
                return `${baseClasses} border border-black bg-opacity-0`;
            case 4: 
                return `${baseClasses} border border-black rounded-lg bg-opacity-0`;
            case 5: 
                return `${baseClasses} border border-black rounded-3xl bg-opacity-0`;
            case 6: 
                return `${baseClasses} bg-white border border-black`;
            case 7: 
                return `${baseClasses} bg-white border border-black rounded-lg`;
            case 8:
                return `${baseClasses} bg-white border border-black rounded-3xl`;
            case 9: 
                return `${baseClasses} bg-white`;
            case 10: 
                return `${baseClasses} bg-white rounded-lg`;
            case 11: 
                return `${baseClasses} bg-white rounded-3xl`;
            case 12:
                return `${baseClasses} relative border border-black bg-black`;
            case 13:
                return `${baseClasses} relative border border-black bg-black`;
            case 14:
                return `${baseClasses} border border-black relative after:-translate-y-1/2 after:-translate-x-1/2 after:top-1/2 after:left-1/2 after:h-[88%] after:w-[104%] after:absolute after:border after:border-black after:mix-blend-difference`;
            case 15: 
                return `${baseClasses} border border-black bg-black rounded-3xl`;
            case 16:
                return `${baseClasses} relative border border-black bg-black`;
            default:
                return baseClasses;
        }
    };

    const getButtonStyles = () => {
        if (selectedTheme === "3D Blocks") {
            return {
                color: "#fff",
                backgroundColor: "#191414" 
            };
        }
        
        if (selectedTheme === "New Mario") {
            return {
                color: "#fff",
                backgroundColor: "transparent",
                backgroundImage: `url('https://linktree.sirv.com/Images/Scene/Mario/mario-brick.png')`,
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center"
            };
        }
        
        let styles = {
            color: btnFontColor || "#000",
            backgroundColor: btnColor || "#fff"
        };

        switch (btnType) {
            case 6:
            case 7:
            case 8:
                styles.boxShadow = `4px 4px 0 0 ${hexToRgba(btnShadowColor)}`;
                break;
            case 9:
            case 10:
            case 11:
                styles.boxShadow = `0 4px 4px 0 ${hexToRgba(btnShadowColor, 0.16)}`;
                break;
            case 12:
            case 13:
            case 15:
            case 16:
                styles.color = "#fff";
                styles.backgroundColor = btnColor || "#000";
                break;
        }

        if (selectedTheme === "Matrix") {
            styles.borderColor = themeTextColour;
        }

        return styles;
    };

    const getSpecialElements = () => {
        switch (btnType) {
            case 12:
                return (
                    <>
                        <span className="w-full absolute left-0 bottom-0 translate-y-[6px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/torn.svg"} alt="ele" width={1000} height={100} priority className="w-full scale-[-1]" />
                        </span>
                        <span className="w-full absolute left-0 top-0 -translate-y-[6px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/torn.svg"} alt="ele" width={1000} height={1000} priority className="w-full" />
                        </span>
                    </>
                );
            case 13:
                return (
                    <>
                        <span className="w-full absolute left-0 bottom-0 translate-y-[4px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/jiggy.svg"} alt="ele" width={1000} height={8} priority className="w-full" />
                        </span>
                        <span className="w-full absolute left-0 top-0 -translate-y-[3px]">
                            <Image src={"https://linktree.sirv.com/Images/svg%20element/jiggy.svg"} alt="ele" width={1000} height={8} priority className="w-full scale-[-1]" />
                        </span>
                    </>
                );
            case 16:
                return (
                    <>
                        <div className={"h-2 w-2 border border-black bg-white absolute -top-1 -left-1"}></div>
                        <div className={"h-2 w-2 border border-black bg-white absolute -top-1 -right-1"}></div>
                        <div className={"h-2 w-2 border border-black bg-white absolute -bottom-1 -left-1"}></div>
                        <div className={"h-2 w-2 border border-black bg-white absolute -bottom-1 -right-1"}></div>
                    </>
                );
            default:
                return null;
        }
    };

    const getFontStyle = () => {
        if (selectedTheme === "3D Blocks") {
            return { color: "#fff" };
        }
        
        if (selectedTheme === "New Mario") {
            return { color: "#fff" };
        }
        
        switch (btnType) {
            case 12:
            case 13:
            case 15:
            case 16:
                return { color: "#fff" };
            default:
                return { color: btnFontColor || "#000" };
        }
    };

    const specialElements = getSpecialElements();
    const fontStyle = getFontStyle();

    // NEW: Enhanced button text with scan capability indicator
    const getButtonText = () => {
        const baseText = t('exchange.button_text') || 'Exchange Contact';
        const shortText = t('exchange.button_text_short') || 'Exchange';
        
        if (scanAvailable) {
            return {
                desktop: `📇 ${baseText}`,
                mobile: `📇 ${shortText}`
            };
        }
        
        return {
            desktop: baseText,
            mobile: shortText
        };
    };

    const buttonText = getButtonText();

    return (
        <>
            {/* Debug info in development */}
            {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-500 mb-1">
                    ExchangeButton Debug: Type={btnType}, ScanToken={!!scanToken}, ScanAvailable={scanAvailable}
                </div>
            )}
            
            {/* Mario Theme Rendering */}
            {selectedTheme === "New Mario" ? (
                <div className={getButtonClasses()}>         
                    {/* Mario brick background */}
                    {Array(4).fill("").map((_, brick_index) => (
                        <Image
                            key={brick_index}
                            src="https://linktree.sirv.com/Images/Scene/Mario/mario-brick.png"
                            alt="Mario Brick"
                            width={650}
                            height={660}
                            onClick={() => setIsModalOpen(true)}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                            className="h-16 w-1/4 object-cover hover:-translate-y-2 cursor-pointer transition-transform"
                        />
                    ))}
                    
                    {/* Mario box with enhanced icon */}
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-30">
                        <div className="relative">
                            <Image
                                src="https://linktree.sirv.com/Images/Scene/Mario/mario-box.png"
                                alt="Mario Box"
                                width={650}
                                height={660}
                                className={`h-8 w-auto object-contain hover:-translate-y-2 hover:rotate-2 transition-all cursor-pointer ${isHovered ? "rotate-2" : ""}`}
                                onClick={() => setIsModalOpen(true)}
                            />
                            {/* Enhanced Exchange icon */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                {scanAvailable ? (
                                    <svg className="w-4 h-4 text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4 text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Button text overlay */}
                    <div 
                        className="absolute top-0 left-0 z-20 w-full h-full flex items-center justify-center cursor-pointer"
                        onClick={() => setIsModalOpen(true)}
                        style={{ 
                            paddingLeft: '3rem' // Space for the box
                        }}
                    >
                        <div className={`${selectedFontClass}`} style={fontStyle}>
                            {/* Desktop text */}
                            <span className={`hidden md:block md:text-2xl sm:text-xl text-lg drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] font-semibold ${isHovered ? "text-blue-500" : "text-white"}`}>
                                {buttonText.desktop}
                            </span>
                            
                            {/* Mobile text */}
                            <span className={`block md:hidden text-sm drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] font-semibold ${isHovered ? "text-blue-500" : "text-white"}`}>
                                {buttonText.mobile}
                            </span>
                        </div>
                    </div>
                </div>
            ) : selectedTheme === "3D Blocks" ? (
                <div className="userBtn relative justify-between items-center flex hover:scale-[1.025] w-full">
                    <div
                        onClick={() => setIsModalOpen(true)}
                        className={getButtonClasses()}
                        style={{...getButtonStyles(), borderColor: selectedTheme === "Matrix" ? `${themeTextColour}` : ""}}
                    >
                        <div className="cursor-pointer flex gap-3 items-center min-h-10 py-3 px-3 flex-1">
                            {specialElements}
                            
                            {/* Enhanced Exchange Icon */}
                            {scanAvailable ? (
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                            )}
                            
                            <div className={`${selectedFontClass} font-semibold truncate max-w-[90%] flex-1`} style={fontStyle}>
                                {/* Desktop text */}
                                <span className="hidden md:block">
                                    {buttonText.desktop}
                                </span>
                                
                                {/* Mobile text */}
                                <span className="block md:hidden text-sm">
                                    {buttonText.mobile}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    className={getButtonClasses()}
                    style={{...getButtonStyles(), borderColor: selectedTheme === "Matrix" ? `${themeTextColour}` : ""}}
                >
                    <div
                        onClick={() => setIsModalOpen(true)}
                        className="cursor-pointer flex gap-3 items-center min-h-10 py-3 px-3 flex-1"
                    >
                        {specialElements}
                        
                        {/* Enhanced Exchange Icon */}
                        {scanAvailable ? (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                        )}
                        
                        <div className={`${selectedFontClass} font-semibold truncate max-w-[90%] flex-1`} style={fontStyle}>
                            {/* Desktop text */}
                            <span className="hidden md:block">
                                {buttonText.desktop}
                            </span>
                            
                            {/* Mobile text */}
                            <span className="block md:hidden text-sm">
                                {buttonText.mobile}
                            </span>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Enhanced ExchangeModal with scan token support */}
            <ExchangeModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                profileOwnerUsername={username}
                profileOwnerId={userInfo?.userId || userId}
                scanToken={scanToken} // NEW: Pass the secure scan token
            />
        </>
    );
}