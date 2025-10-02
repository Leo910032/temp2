// app/[userId]/components/ProfilePic.jsx - Enhanced for banner overlay
"use client"
import Image from "next/image";
import { useContext } from "react";
import { HouseContext } from "../House";
import Head from "next/head";

export default function ProfilePic() {
    const { userData } = useContext(HouseContext);
    const {
        avatarUrl = "",
        displayName = "",
        bannerType = 'None'
    } = userData;

    // Add extra styling when banner is active for better visibility
    const hasBanner = bannerType !== 'None';
    const profileContainerClass = hasBanner
        ? `min-h-[5rem] w-[5rem] sm:min-h-[6rem] sm:w-[6rem] mb-2 rounded-full overflow-hidden grid place-items-center pointer-events-none select-none shadow-xl border-4 border-white ${
            avatarUrl ? '' : 'bg-white'
        }`
        : `min-h-[5rem] w-[5rem] sm:min-h-[6rem] sm:w-[6rem] mb-2 rounded-full overflow-hidden grid place-items-center pointer-events-none select-none ${
            avatarUrl ? '' : 'bg-white '
        }`;

    return (
        <>
            <Head>
                {/* Meta tags are better handled in `generateMetadata` on the server */}
            </Head>
            <div className={profileContainerClass}>
                {avatarUrl ? (
                    <Image
                        key={avatarUrl}
                        src={avatarUrl}
                        alt="Profile Picture"
                        width={100}
                        height={100}
                        className="w-full h-full object-cover"
                        priority
                    />
                ) : (
                    <span key="no-avatar" className={`text-3xl font-semibold uppercase ${hasBanner ? 'text-gray-700' : ''}`}>
                        {displayName?.[0] || 'U'}
                    </span>
                )}
            </div>
        </>
    );
}

