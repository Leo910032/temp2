"use client"
import { useContext, useMemo } from "react";
import { HouseContext } from "../House";
import Button from "../elements/Button";
import Socials from "../elements/Socials";
import { filterProperly } from "@/lib/utilities";
import CVButton from '../elements/CVButton'; // ADD THIS IMPORT

export default function MyLinks() {
    const { userData } = useContext(HouseContext);
    const {
        links = [],
        socials = [],
        socialPosition = 0,
        supportBannerStatus = false,
        themeFontColor = "",
        themeTextColour = "",
        sensitiveStatus = false
    } = userData;

    // ✅ IMPROVED: Better memoization of filtered links
    const displayLinks = useMemo(() => {
        return links.filter((link) => link.isActive !== false);
    }, [links]);

    // ✅ IMPROVED: Better memoization of active socials
    const activeSocials = useMemo(() => {
        return socials.filter((social) => social.active === true);
    }, [socials]);

    // ✅ IMPROVED: Memoize display color
    const displayColor = useMemo(() => {
        return themeFontColor === "#000" ? themeTextColour : themeFontColor;
    }, [themeFontColor, themeTextColour]);

    // ✅ ADDED: Debug logging
    console.log('🔄 MyLinks render:', {
        linksCount: displayLinks.length,
        socialsCount: activeSocials.length,
        socialPosition,
        supportBannerStatus
    });

    return (
        <div className={`flex flex-col gap-4 my-4 w-full px-5 py-1 items-center max-h-fit ${
            supportBannerStatus ? "pb-12" : ""
        }`}>
            {/* ✅ FIXED: Better conditional rendering for top socials */}
            {socialPosition === 0 && activeSocials.length > 0 && (
                <div className="w-full flex justify-center">
                    <Socials />
                </div>
            )}
            
            {/* ✅ IMPROVED: Better key for links */}
            {displayLinks.map((link) => {
                if (link.type === 0) { // Header type
                    return (
                        <span 
                            key={`header-${link.id}`} 
                            style={{ color: displayColor }} 
                            className="mx-auto font-semibold text-sm mt-2"
                        >
                            {sensitiveStatus ? link.title : filterProperly(link.title)}
                        </span>
                    );
                } else { // Button type
                    return (
                        <Button
                            key={`button-${link.id}`}
                            linkData={link}
                            content={sensitiveStatus ? link.title : filterProperly(link.title)}
                        />
                    );
                }
            })}
            {userData?.cvDocument && (
    <CVButton 
        cvDocument={userData.cvDocument}
        userData={userData}
    />
)}
            
            {/* ✅ FIXED: Better conditional rendering for bottom socials */}
            {socialPosition === 1 && activeSocials.length > 0 && (
                <div className="w-full flex justify-center">
                    <Socials />
                </div>
            )}
        </div>
        
    );
}