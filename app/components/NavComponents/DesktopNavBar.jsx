// app/components/NavComponents/DesktopNavBar.jsx
"use client";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "../LanguageSwitcher/LanguageSwitcher";

export default function DesktopNavBar({
    activePage,
    translations,
    userIsAdmin,
    isLoading,
    profilePicture,
    handleShowShareCard,
    handleShowProfileCard,
    profileCardRef,
    shareCardRef,
    ProfileCard,
    ShareCard
}) {
    return (
        <div className="w-full justify-between flex items-center rounded-[3rem] py-3 sticky top-0 z-[9999999999] px-3 mx-auto bg-white border backdrop-blur-lg hidden md:flex">
            <div className="flex items-center gap-8">
                <Link href={'/dashboard'} className="ml-3">
                    <Image
                        src={"https://linktree.sirv.com/Images/logo-icon.svg"}
                        alt="logo"
                        height={23}
                        width={23}
                        priority
                    />
                </Link>
                <div className="flex items-center gap-6">
                    {/* Links */}
                    <Link
                        href={'/dashboard'}
                        className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 0 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}
                    >
                        <Image
                            src={"https://linktree.sirv.com/Images/icons/links.svg"}
                            alt="links"
                            height={16}
                            width={16}
                        />
                        {translations.links}
                    </Link>

                    {/* Appearance */}
                    <Link
                        href={'/dashboard/appearance'}
                        className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 1 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}
                    >
                        <Image
                            src={"https://linktree.sirv.com/Images/icons/appearance.svg"}
                            alt="appearance"
                            height={16}
                            width={16}
                        />
                        {translations.appearance}
                    </Link>

                    {/* Analytics */}
                    <Link
                        href={'/dashboard/analytics'}
                        className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 2 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}
                    >
                        <Image
                            src={"https://linktree.sirv.com/Images/icons/analytics.svg"}
                            alt="analytics"
                            height={16}
                            width={16}
                        />
                        {translations.analytics}
                    </Link>

                    {/* Contacts */}
                    <Link
                        href={'/dashboard/contacts'}
                        className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 3 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {translations.contacts}
                    </Link>

                    {/* Settings */}
                    <Link
                        href={'/dashboard/settings'}
                        className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 4 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}
                    >
                        <Image
                            src={"https://linktree.sirv.com/Images/icons/setting.svg"}
                            alt="settings"
                            height={16}
                            width={16}
                        />
                        {translations.settings}
                    </Link>

                    {/* Admin Panel Button - Desktop Version */}
                    {userIsAdmin && (
                        <Link
                            href={'/admin'}
                            className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-red-100 hover:bg-opacity-75 rounded-lg text-sm font-semibold border border-red-200 ${activePage === 5 ? "bg-red-100 text-red-700 opacity-100" : "text-red-600 hover:text-red-700"}`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            {translations.admin}
                        </Link>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* LANGUAGE SWITCHER */}
                <LanguageSwitcher />

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
