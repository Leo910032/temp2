// app/[userId]/elements/Socials.jsx - FIXED VERSION
"use client"
import { useContext } from "react";
import { SocialsList } from "@/lib/SocialsList";
import { isSuitableForWhiteText } from "@/lib/utilities";
import Image from "next/image";
import Link from "next/link";
import { HouseContext } from "../House";

export default function Socials() {
    // ✅ FIXED: Get data from context instead of props
    const { userData } = useContext(HouseContext);
    const { 
        socials = [], 
        themeFontColor = "#000" 
    } = userData;

    // ✅ FIXED: Add safety check for empty socials
    if (!socials || socials.length === 0) {
        console.log('🔄 No socials to display');
        return null;
    }

    // ✅ FIXED: Filter only active socials
    const activeSocials = socials.filter(social => social.active);

    if (activeSocials.length === 0) {
        console.log('🔄 No active socials to display');
        return null;
    }

    console.log('🔄 Rendering socials:', activeSocials.length, 'active socials');

    return (
        <div className="flex gap-2 justify-center flex-wrap max-w-full sArray">
            {activeSocials.map((social, index) => {
                // ✅ FIXED: Better error handling for social data
                const socialType = SocialsList[social.type];
                if (!socialType) {
                    console.warn('Unknown social type:', social.type);
                    return null;
                }

                // ✅ FIXED: Better URL construction with error handling
                let socialUrl;
                try {
                    if (socialType.valueType !== "url") {
                        socialUrl = `${socialType.baseUrl}${social.value}`;
                    } else {
                        socialUrl = social.value;
                    }
                } catch (error) {
                    console.error('Error constructing social URL:', error);
                    return null;
                }

                return (
                    <Link
                        key={`${social.id || social.type}-${index}`} // ✅ FIXED: Better key
                        href={socialUrl}
                        target="_blank"
                        rel="noopener noreferrer" // ✅ ADDED: Security improvement
                        className={`hover:scale-[1.25] active:scale-95 min-w-fit sIcon transition-transform duration-200 ${
                            isSuitableForWhiteText(themeFontColor) ? "filter invert" : ""
                        }`}
                    >
                        <Image 
                            src={socialType.icon} 
                            alt={socialType.title} 
                            width={40} 
                            height={40} 
                            style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.3))" }}
                            className="object-contain"
                        />
                    </Link>
                );
            })}
        </div>
    );
}