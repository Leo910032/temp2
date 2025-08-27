"use client"
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserData } from "@/lib/fetch data/fetchUserData";

export default function MyLinkDiv() {
    const { currentUser } = useAuth(); // 1. Get user from the new Auth context
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
        async function fetchUserLink() {
            // 2. Only run the fetch if the user is authenticated
            if (!currentUser) {
                setMyUrl(""); // Clear URL if user logs out
                return;
            }

            try {
                // 3. Use currentUser.uid to fetch data
                const userData = await fetchUserData(currentUser.uid); 
                if (userData && userData.username) {
                    setMyUrl(`https://mylinks.fabiconcept.online/${userData.username}`);
                }
            } catch (error) {
                console.error("Failed to fetch user data for link:", error);
                setMyUrl("");
            }
        }

        fetchUserLink();
    }, [currentUser]); // 4. Add currentUser as a dependency

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