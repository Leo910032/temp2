// app/components/NavComponents/MobileBottomBar.jsx
"use client";
import Image from "next/image";
import Link from "next/link";
import { useMapVisibility } from '@/app/dashboard/MapVisibilityContext';

export default function MobileBottomBar({ activePage, translations }) {
    const { isMapOpen } = useMapVisibility();

    return (
        <div className={`fixed bottom-0 left-0 right-0 z-[9999999] md:hidden transition-transform duration-300 ${isMapOpen ? 'translate-y-full' : 'translate-y-0'}`}>
            <div className="flex justify-around items-center py-3 px-2 m-2 rounded-2xl bg-white border shadow-lg backdrop-blur-lg">
                {/* Links */}
                <Link
                    href={'/dashboard'}
                    className={`flex items-center justify-center p-3 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-xl transition-all ${activePage === 0 ? "opacity-100 bg-black bg-opacity-5" : "opacity-50 hover:opacity-70"}`}
                    aria-label={translations.links}
                >
                    <Image
                        src={"https://linktree.sirv.com/Images/icons/links.svg"}
                        alt="links"
                        height={22}
                        width={22}
                    />
                </Link>

                {/* Appearance */}
                <Link
                    href={'/dashboard/appearance'}
                    className={`flex items-center justify-center p-3 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-xl transition-all ${activePage === 1 ? "opacity-100 bg-black bg-opacity-5" : "opacity-50 hover:opacity-70"}`}
                    aria-label={translations.appearance}
                >
                    <Image
                        src={"https://linktree.sirv.com/Images/icons/appearance.svg"}
                        alt="appearance"
                        height={22}
                        width={22}
                    />
                </Link>

                {/* Analytics */}
                <Link
                    href={'/dashboard/analytics'}
                    className={`flex items-center justify-center p-3 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-xl transition-all ${activePage === 2 ? "opacity-100 bg-black bg-opacity-5" : "opacity-50 hover:opacity-70"}`}
                    aria-label={translations.analytics}
                >
                    <Image
                        src={"https://linktree.sirv.com/Images/icons/analytics.svg"}
                        alt="analytics"
                        height={22}
                        width={22}
                    />
                </Link>

                {/* Contacts */}
                <Link
                    href={'/dashboard/contacts'}
                    className={`flex items-center justify-center p-3 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-xl transition-all ${activePage === 3 ? "opacity-100 bg-black bg-opacity-5" : "opacity-50 hover:opacity-70"}`}
                    aria-label={translations.contacts}
                >
                    <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </Link>

                {/* Settings */}
                <Link
                    href={'/dashboard/settings'}
                    className={`flex items-center justify-center p-3 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-xl transition-all ${activePage === 4 ? "opacity-100 bg-black bg-opacity-5" : "opacity-50 hover:opacity-70"}`}
                    aria-label={translations.settings}
                >
                    <Image
                        src={"https://linktree.sirv.com/Images/icons/setting.svg"}
                        alt="settings"
                        height={22}
                        width={22}
                    />
                </Link>
            </div>
        </div>
    );
}
