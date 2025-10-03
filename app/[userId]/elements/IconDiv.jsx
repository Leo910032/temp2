"use client"
import { baseUrlIcons } from "@/lib/BrandLinks";
import { makeValidUrl } from "@/lib/utilities";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function IconDiv({ url, unique }) {
    const [iconToDisplay, setIconToDisplay] = useState("https://linktree.sirv.com/Images/brands/tiktok.svg");

// After
function getRootNameFromUrl(url) {
    // 1. First, make sure we have a potentially valid URL string
    const potentiallyValidUrl = makeValidUrl(url);

    // 2. If the result is empty or invalid, return a default immediately
    if (!potentiallyValidUrl) {
        return 'default'; // Return a default name to prevent crashing
    }

    try {
        // 3. Now it's safer to try constructing the URL
        const urlObj = new URL(potentiallyValidUrl);
        const rootName = urlObj.hostname;
        return rootName;
    } catch (error) {
        // This will now only catch truly malformed URLs, not empty strings
        console.error("Could not parse URL:", potentiallyValidUrl, error.message);
        return 'default'; // Return a default on failure
    }
}

    function getIconUrlFromBaseUrl(baseUrl) {
        return baseUrlIcons[baseUrl.toLowerCase()] || 'https://linktree.sirv.com/Images/brands/link-svgrepo-com.svg';
    }
      
    useEffect(() => {
        const rootName = getRootNameFromUrl(url);
        setIconToDisplay(getIconUrlFromBaseUrl(rootName));
    }, [url]);

    return (
        <div className={`h-[2rem] w-fit ${unique === "Mario" ? "border-2 border-black" : "rounded-lg"} p-[2px] bg-white aspect-square`}>
            <Image src={iconToDisplay} alt="link Icon" height={50} width={50} className="object-fit h-full aspect-square" />
        </div>
    );
}