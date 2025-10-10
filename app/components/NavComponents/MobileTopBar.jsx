// app/components/NavComponents/MobileTopBar.jsx
"use client";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "../LanguageSwitcher/LanguageSwitcher";

export default function MobileTopBar({
    isLoading,
    profilePicture,
    userIsAdmin,
    handleShowShareCard,
    handleShowProfileCard,
    profileCardRef,
    shareCardRef,
    ProfileCard,
    ShareCard
}) {
    return (
        <div className="w-full justify-between flex items-center rounded-[3rem] py-3 sticky top-0 z-[9999999999] px-3 mx-auto bg-white border backdrop-blur-lg md:hidden">
            <div className="flex items-center gap-3">
                <Link href={'/dashboard'} className="ml-1">
                    <Image
                        src={"https://linktree.sirv.com/Images/logo-icon.svg"}
                        alt="logo"
                        height={23}
                        width={23}
                        priority
                    />
                </Link>
            </div>

            <div className="flex items-center gap-3">
                {/* LANGUAGE SWITCHER */}
                <LanguageSwitcher />

                {/* Admin Panel Button - Mobile Version */}
                {userIsAdmin && (
                    <Link
                        href={'/admin'}
                        className="p-2 flex items-center relative gap-2 rounded-full border border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 active:scale-90 overflow-hidden"
                    >
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </Link>
                )}

                {/* Share Button */}
                <button
                    id="share-button"
                    className="p-3 flex items-center relative gap-2 rounded-3xl border cursor-pointer hover:bg-gray-100 active:scale-90 overflow-hidden disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleShowShareCard}
                    disabled={isLoading}
                >
                    <Image
                        src={"https://linktree.sirv.com/Images/icons/share.svg"}
                        alt="share"
                        height={15}
                        width={15}
                    />
                </button>

                {/* Profile Button */}
                <div className="relative">
                    <button
                        id="profile-button"
                        className="grid place-items-center relative rounded-full border h-[2.5rem] w-[2.5rem] cursor-pointer hover:scale-110 active:scale-95 overflow-hidden disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={handleShowProfileCard}
                        disabled={isLoading}
                    >
                        <div className="absolute z-10 w-full h-full sm:block hidden"></div>
                        {isLoading ? (
                            <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-200 animate-pulse"></div>
                        ) : (
                            profilePicture
                        )}
                    </button>
                    <div ref={profileCardRef}>
                        <ProfileCard />
                    </div>
                    <div ref={shareCardRef}>
                        <ShareCard />
                    </div>
                </div>
            </div>
        </div>
    );
}
