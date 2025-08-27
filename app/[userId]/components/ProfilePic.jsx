"use client"
import Image from "next/image";
import { useContext } from "react";
import { HouseContext } from "../House";
import Head from "next/head";

export default function ProfilePic() {
    const { userData } = useContext(HouseContext);
    const { profilePhoto = "", displayName = "" } = userData;

    return (
        <>
            <Head>
                {/* Meta tags are better handled in `generateMetadata` on the server */}
            </Head>
            <div className={`min-h-[5rem] w-[5rem] sm:min-h-[6rem] sm:w-[6rem] mb-2 rounded-full overflow-hidden grid place-items-center pointer-events-none select-none ${
                profilePhoto ? '' : 'bg-white border'
            }`}>
                {profilePhoto ? (
                    <Image
                        src={profilePhoto}
                        alt="Profile Picture"
                        width={100}
                        height={100}
                        className="w-full h-full object-cover"
                        priority
                    />
                ) : (
                    <span className="text-3xl font-semibold uppercase">
                        {displayName?.[0] || 'U'}
                    </span>
                )}
            </div>
        </>
    );
}