"use client"
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDashboard } from "@/app/dashboard/DashboardContext.js";

export default function MyLinkDiv() {
    const { currentUser, isLoading } = useDashboard(); // Use your existing dashboard context
    const [myUrl, setMyUrl] = useState("");
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (myUrl) {
            navigator.clipboard.writeText(myUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    useEffect(() => {
        // Use the user data that's already loaded in your dashboard context
        if (!isLoading && currentUser && currentUser.username) {
            setMyUrl(`https://mylinks.fabiconcept.online/${currentUser.username}`);
        } else if (!isLoading && !currentUser) {
            setMyUrl(""); // Clear URL if user logs out
        }
    }, [currentUser, isLoading]);

    // Show nothing while loading
    if (isLoading) {
        return null;
    }

    // No changes to the JSX are needed, it will render when myUrl is set
    return (
        <>
            {myUrl && <div className="w-full p-3 rounded-3xl border-b bg-white mb-4 flex justify-between items-center sticky top-0 z-10">
                <span className="text-sm flex">
                    <span className="font-semibold sm:block hidden">
                        Your Linktree is live:
                    </span>
                    <Link
                        href={`${myUrl}`}
                        target="_blank"
                        className="underline ml-2 w-[10rem] truncate"
                    >{myUrl}</Link>
                </span>
                <div
                    className={`font-semibold sm:text-base text-sm py-3 px-4 rounded-3xl border cursor-pointer hover:bg-black hover:bg-opacity-5 active:scale-90 ${copied ? "text-green-600" : ""}`}
                    onClick={handleCopy}
                >
                    {copied ? "Copied!" : "Copy URL"}
                </div>
            </div>}
        </>
    );
}