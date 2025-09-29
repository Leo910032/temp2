// app/[userId]/components/UserInfo.jsx - Enhanced for banner overlay
"use client"
import { filterProperly } from "@/lib/utilities";
import { useContext } from "react";
import { HouseContext } from "../House";

export default function UserInfo() {
    const { userData } = useContext(HouseContext);
    const { 
        displayName = "", 
        bio = "", 
        themeFontColor = "", 
        themeTextColour = "", 
        sensitiveStatus = false,
        bannerType = 'None'
    } = userData;

    const filteredDisplayName = sensitiveStatus ? displayName : filterProperly(displayName);
    const filteredBio = sensitiveStatus ? bio : filterProperly(bio);
    const displayColor = themeFontColor === "#000" ? themeTextColour : themeFontColor;
    
    // Add text shadow and better contrast when banner is active
    const hasBanner = bannerType !== 'None';
    const textShadowStyle = hasBanner ? {
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.7), 0 1px 2px rgba(0, 0, 0, 0.8)',
        fontWeight: '600'
    } : {};

    const nameStyle = {
        color: displayColor,
        ...textShadowStyle
    };

    const bioStyle = {
        color: displayColor,
        ...textShadowStyle,
        fontWeight: hasBanner ? '500' : 'normal'
    };

    return (
        <>
            {filteredDisplayName.length > 0 && 
                <span 
                    style={nameStyle} 
                    className={`font-semibold text-lg py-2 text-center ${hasBanner ? 'text-white' : ''}`}
                >
                    {displayName.split(" ").length > 1 ? filteredDisplayName : `@${filteredDisplayName}`}
                </span>
            }
            {filteredBio.length > 0 && 
                <span 
                    style={bioStyle} 
                    className={`opacity-90 text-center text-base max-w-[85%] ${hasBanner ? 'text-white' : ''}`}
                >
                    {filteredBio}
                </span>
            }
        </>
    );
}