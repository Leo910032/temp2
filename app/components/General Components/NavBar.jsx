/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
"use client";
import { useTranslation } from "@/lib/translation/useTranslation";
import { isAdmin } from "@/lib/adminAuth";
import { getAppearanceData } from "@/lib/services/serviceAppearance/client/appearanceService.js";
import { useDashboard } from '../../dashboard/DashboardContext';
import { fireApp } from "@/important/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import ProfileCard from "../NavComponents/ProfileCard";
import ShareCard from "../NavComponents/ShareCard";
import LanguageSwitcher from "../LanguageSwitcher/LanguageSwitcher";

export const NavContext = React.createContext();

let globalNavDataCache = null;

export default function NavBar() {
    const router = usePathname();
    const { t, isInitialized } = useTranslation();
    
    // GET EVERYTHING FROM THE DASHBOARD PROVIDER
    const { currentUser, isLoading: isSessionLoading } = useDashboard();
    
    // State specific to the NavBar's appearance data
    const [activePage, setActivePage] = useState(0);
    const [profilePicture, setProfilePicture] = useState(null);
    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [myLink, setMyLink] = useState("");
    const [showProfileCard, setShowProfileCard] = useState(false);
    const [showShareCard, setShowShareCard] = useState(false);
    const [isAppearanceLoading, setIsAppearanceLoading] = useState(true);

    const profileCardRef = useRef(null);
    const shareCardRef = useRef(null);
    
    // Combined loading state for the entire navbar
    const isLoading = isSessionLoading || isAppearanceLoading;

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            links: t('dashboard.navigation.links'),
            appearance: t('dashboard.navigation.appearance'),
            analytics: t('dashboard.navigation.analytics'),
            settings: t('dashboard.navigation.settings'),
            contacts: t('dashboard.navigation.contacts'),
            admin: t('dashboard.navigation.admin') || 'Admin Panel'
        };
    }, [t, isInitialized]);

    // Check if user is admin
    const userIsAdmin = useMemo(() => {
        if (!currentUser?.email) return false;
        return isAdmin(currentUser.email);
    }, [currentUser?.email]);

    const updateNavbarState = useCallback((data) => {
        console.log("NavBar: Updating state with:", data);

        const newUsername = data.username || "";
        const newDisplayName = data.displayName || newUsername;
        const avatarUrl = data.avatarUrl || "";

        setUsername(newUsername);
        setDisplayName(newDisplayName);

        // Create myLink with the correct domain
        const newMyLink = newUsername ? `http://localhost:3001/${newUsername}` : "";
        setMyLink(newMyLink);

        // Set profile picture with key for proper React reconciliation
        if (avatarUrl) {
            setProfilePicture(
                <Image
                    key={avatarUrl}
                    src={avatarUrl}
                    alt="profile"
                    height={1000}
                    width={1000}
                    className="min-w-full h-full object-cover"
                    priority
                />
            );
        } else {
            setProfilePicture(
                <div key="no-avatar" className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                    <span className="text-3xl font-semibold uppercase">
                        {newDisplayName ? newDisplayName.charAt(0) : (currentUser?.email ? currentUser.email.charAt(0) : 'U')}
                    </span>
                </div>
            );
        }
    }, [currentUser?.email]);

    const fetchAppearanceData = useCallback(async (forceRefresh = false) => {
        if (!currentUser) {
            console.log('NavBar: No currentUser available');
            return;
        }
        
        // Check cache first
        if (globalNavDataCache && !forceRefresh) {
            console.log('NavBar: Using cached navbar data');
            updateNavbarState(globalNavDataCache);
            setIsAppearanceLoading(false);
            return;
        }
        
        setIsAppearanceLoading(true);
        try {
            console.log('NavBar: Fetching fresh appearance data...');
            const appearanceData = await getAppearanceData();

            const username = appearanceData.username || "";
            const displayName = appearanceData.displayName || username || "";
            const avatarUrl = appearanceData.avatarUrl || "";

            if (!username) {
                console.error('NavBar: No username found in appearance data!');
                const fallbackUsername = currentUser.uid;
                globalNavDataCache = {
                    username: fallbackUsername,
                    displayName: displayName || fallbackUsername,
                    avatarUrl: avatarUrl
                };
            } else {
                globalNavDataCache = {
                    username,
                    displayName,
                    avatarUrl
                };
            }

            updateNavbarState(globalNavDataCache);
            console.log('NavBar: User data loaded and cached successfully');
            
        } catch (error) {
            console.error('NavBar: Failed to fetch user data:', error);
            
            // Fallback handling
            const fallbackUsername = currentUser.uid;
            const fallbackDisplayName = currentUser.displayName || currentUser.email?.split('@')[0] || fallbackUsername;
            
            setUsername(fallbackUsername);
            setDisplayName(fallbackDisplayName);
            setMyLink(fallbackUsername ? `http://localhost:3001/${fallbackUsername}` : "");
            
            setProfilePicture(
                <div className="h-[95%] aspect-square w-[95%] rounded-full bg-gray-300 border grid place-items-center">
                    <span className="text-3xl font-semibold uppercase">
                        {fallbackDisplayName ? fallbackDisplayName.charAt(0) : 'U'}
                    </span>
                </div>
            );
        } finally {
            setIsAppearanceLoading(false);
        }
    }, [currentUser, updateNavbarState]);

    // Context value for children
    const contextValue = useMemo(() => ({
        username,
        displayName,
        myLink,
        profilePicture,
        showProfileCard,
        setShowProfileCard,
        showShareCard,
        setShowShareCard,
        currentUser,
        isLoading,
        refreshUserData: () => fetchAppearanceData(true)
    }), [username, displayName, myLink, profilePicture, showProfileCard, showShareCard, currentUser, isLoading, fetchAppearanceData]);

    // Load navbar appearance data when user is ready
    useEffect(() => {
        if (currentUser && isInitialized) {
            if (globalNavDataCache) {
                updateNavbarState(globalNavDataCache);
                setIsAppearanceLoading(false);
            } else {
                fetchAppearanceData();
            }
        } else if (!currentUser) {
            // This logic is now simpler, as the provider handles resetting session data
            globalNavDataCache = null;
            setIsAppearanceLoading(true); // Reset loading state for next user
        }
    }, [currentUser, isInitialized, fetchAppearanceData, updateNavbarState]);

    // Real-time listener for profile picture updates
    useEffect(() => {
        if (!currentUser?.uid) return;

        console.log('🔄 NavBar: Setting up real-time listener for avatarUrl changes');

        const userDocRef = doc(fireApp, "users", currentUser.uid);
        const unsubscribe = onSnapshot(userDocRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    const profile = userData.profile || {};
                    const newAvatarUrl = profile.avatarUrl || '';

                    // Only update if avatarUrl changed
                    if (globalNavDataCache && globalNavDataCache.avatarUrl !== newAvatarUrl) {
                        console.log('✅ NavBar: avatarUrl changed, updating profile picture');

                        // Update cache
                        globalNavDataCache = {
                            ...globalNavDataCache,
                            avatarUrl: newAvatarUrl
                        };

                        // Update navbar state
                        updateNavbarState(globalNavDataCache);
                    }
                }
            },
            (error) => {
                console.error('❌ NavBar: Error in real-time listener:', error);
            }
        );

        return () => {
            console.log('🧹 NavBar: Cleaning up real-time listener');
            unsubscribe();
        };
    }, [currentUser?.uid, updateNavbarState]);

    const handleShowProfileCard = () => {
        if (isLoading || !username) {
            console.warn("Profile button clicked but data is not ready or username is empty.");
            return;
        }
        setShowProfileCard(prev => !prev);
        setShowShareCard(false);
    };

    const handleShowShareCard = () => {
        console.log("Share button clicked. Debug info:", {
            isLoading,
            username,
            myLink,
            canProceed: !isLoading && username && myLink
        });
        
        if (isLoading) {
            console.warn("Share button clicked but data is still loading. Cannot toggle ShareCard.");
            return;
        }
        
        if (!username) {
            console.warn("Share button clicked but username is empty. Cannot toggle ShareCard.");
            return;
        }
        
        if (!myLink) {
            console.warn("Share button clicked but myLink is empty. Cannot toggle ShareCard.");
            return;
        }
        
        const newState = !showShareCard;
        console.log("All data ready. Toggling ShareCard visibility to:", newState);
        setShowShareCard(newState);
        setShowProfileCard(false);
    };

    // Handle clicks outside cards
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showProfileCard &&
                profileCardRef.current &&
                !profileCardRef.current.contains(event.target) &&
                !event.target.closest('#profile-button')) {
                setShowProfileCard(false);
            }
            if (showShareCard &&
                shareCardRef.current &&
                !shareCardRef.current.contains(event.target) &&
                !event.target.closest('#share-button')) {
                setShowShareCard(false);
            }
        };
        if (showProfileCard || showShareCard) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showProfileCard, showShareCard]);

    // Set active page based on route
    useEffect(() => {
        switch (router) {
            case "/dashboard": setActivePage(0); break;
            case "/dashboard/appearance": setActivePage(1); break;
            case "/dashboard/analytics": setActivePage(2); break;
            case "/dashboard/contacts": setActivePage(3); break;
            case "/dashboard/settings": setActivePage(4); break;
            case "/admin":
            case "/admin/users":
            case "/admin/analytics": setActivePage(5); break;
            default: setActivePage(0); break;
        }
    }, [router]);

    // The DashboardProvider already handles the case where there is no user,
    // so this check might become redundant, but it's safe to keep.
    if (!currentUser) {
        return <div className="w-full h-[68px]" />; // Placeholder for logged-out state
    }

    return (
        <NavContext.Provider value={contextValue}>
            <div className="w-full justify-between flex items-center rounded-[3rem] py-3 sticky top-0 z-[9999999999] px-3 mx-auto bg-white border backdrop-blur-lg">
                <div className="flex items-center gap-8">
                    <Link href={'/dashboard'} className="ml-3">
                        <Image src={"https://linktree.sirv.com/Images/logo-icon.svg"} alt="logo" height={23} width={23} className="" priority />
                    </Link>
                    <div className="hidden md:flex items-center gap-6">
                        <Link href={'/dashboard'} className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 0 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                            <Image src={"https://linktree.sirv.com/Images/icons/links.svg"} alt="links" height={16} width={16} />
                            {translations.links}
                        </Link>
                        <Link href={'/dashboard/appearance'} className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 1 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                            <Image src={"https://linktree.sirv.com/Images/icons/appearance.svg"} alt="links" height={16} width={16} />
                            {translations.appearance}
                        </Link>
                        <Link href={'/dashboard/analytics'} className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 2 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                            <Image src={"https://linktree.sirv.com/Images/icons/analytics.svg"} alt="analytics" height={16} width={16} />
                            {translations.analytics}
                        </Link>
                        <Link href={'/dashboard/contacts'} className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 3 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {translations.contacts}
                        </Link>
                        <Link href={'/dashboard/settings'} className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 4 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                            <Image src={"https://linktree.sirv.com/Images/icons/setting.svg"} alt="settings" height={16} width={16} />
                            {translations.settings}
                        </Link>
                        {/* Admin Panel Button - Desktop Version */}
                        {userIsAdmin && (
                            <Link href={'/admin'} className={`flex items-center gap-2 px-2 py-2 active:scale-90 active:opacity-40 hover:bg-red-100 hover:bg-opacity-75 rounded-lg text-sm font-semibold border border-red-200 ${activePage === 5 ? "bg-red-100 text-red-700 opacity-100" : "text-red-600 hover:text-red-700"}`}>
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
                    {/* Admin Panel Button - Mobile Version */}
                    {userIsAdmin && (
                        <Link href={'/admin'} className="p-2 flex items-center relative gap-2 rounded-full border border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 active:scale-90 overflow-hidden md:hidden">
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </Link>
                    )}
                    <button
                        id="share-button"
                        className="p-3 flex items-center relative gap-2 rounded-3xl border cursor-pointer hover:bg-gray-100 active:scale-90 overflow-hidden disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={handleShowShareCard}
                        disabled={isLoading}
                    >
                        <Image src={"https://linktree.sirv.com/Images/icons/share.svg"} alt="share" height={15} width={15} />
                    </button>
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
            {/* Mobile Navigation - Bottom bar */}
            <div className="flex justify-between py-2 px-4 m-2 rounded-xl bg-white sm:hidden">
                <Link href={'/dashboard'} className={`flex items-center flex-1 justify-center gap-2 px-3 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 0 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                    <Image src={"https://linktree.sirv.com/Images/icons/links.svg"} alt="links" height={16} width={16} />
                    {translations.links}
                </Link>
                <Link href={'/dashboard/appearance'} className={`flex items-center flex-1 justify-center gap-2 px-3 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 1 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                    <Image src={"https://linktree.sirv.com/Images/icons/appearance.svg"} alt="appearance" height={16} width={16} />
                    {translations.appearance}
                </Link>
                <Link href={'/dashboard/contacts'} className={`flex items-center flex-1 justify-center gap-2 px-3 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 3 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                    <Image src={"https://linktree.sirv.com/Images/icons/contacts.svg"} alt="contacts" height={16} width={16} />
                    {translations.contacts}
                </Link>
                <Link href={'/dashboard/settings'} className={`flex items-center flex-1 justify-center gap-2 px-3 py-2 active:scale-90 active:opacity-40 hover:bg-black hover:bg-opacity-[0.075] rounded-lg text-sm font-semibold ${activePage === 4 ? "opacity-100" : "opacity-50 hover:opacity-70"}`}>
                    <Image src={"https://linktree.sirv.com/Images/icons/setting.svg"} alt="settings" height={16} width={16} />
                    {translations.settings}
                </Link>
            </div>
        </NavContext.Provider>
    );
}