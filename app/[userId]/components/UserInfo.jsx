"use client"
import { filterProperly } from "@/lib/utilities";
import { useContext } from "react";
import { HouseContext } from "../House";

export default function UserInfo() {
    const { userData } = useContext(HouseContext);
    const { displayName = "", bio = "", themeFontColor = "", themeTextColour = "", sensitiveStatus = false } = userData;

    const filteredDisplayName = sensitiveStatus ? displayName : filterProperly(displayName);
    const filteredBio = sensitiveStatus ? bio : filterProperly(bio);
    const displayColor = themeFontColor === "#000" ? themeTextColour : themeFontColor;

    return (
        <>
            {filteredDisplayName.length > 0 && 
                <span style={{ color: displayColor }} className="font-semibold text-lg py-2 text-center">
                    {displayName.split(" ").length > 1 ? filteredDisplayName : `@${filteredDisplayName}`}
                </span>
            }
            {filteredBio.length > 0 && 
                <span style={{ color: displayColor }} className="opacity-80 text-center text-base max-w-[85%]">
                    {filteredBio}
                </span>
            }
        </>
    );
}