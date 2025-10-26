// app/components/General Components/NavBar.jsx
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
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import ProfileCard from "../NavComponents/ProfileCard";
import ShareCard from "../NavComponents/ShareCard";
import DesktopNavBar from "../NavComponents/DesktopNavBar";
import MobileTopBar from "../NavComponents/MobileTopBar";
import MobileBottomBar from "../NavComponents/MobileBottomBar";

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


    // ✅ CHANGE: Use NEXT_PUBLIC_APP_URL instead of NEXT_PUBLIC_BASE_URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    const newMyLink = newUsername ? `${baseUrl}/${newUsername}` : "";
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
            // ✅ CHANGE: Use NEXT_PUBLIC_APP_URL instead of NEXT_PUBLIC_BASE_URL
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
            setMyLink(fallbackUsername ? `${baseUrl}/${fallbackUsername}` : "");
                
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
            // Check if click is inside the ShareCard or ProfileCard content
            const isInsideShareCard = shareCardRef.current && shareCardRef.current.contains(event.target);
            const isInsideProfileCard = profileCardRef.current && profileCardRef.current.contains(event.target);
            const isShareButton = event.target.closest('#share-button');
            const isProfileButton = event.target.closest('#profile-button');

            if (showProfileCard &&
                !isInsideProfileCard &&
                !isProfileButton) {
                setShowProfileCard(false);
            }
            if (showShareCard &&
                !isInsideShareCard &&
                !isShareButton) {
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
            {/* Desktop Navigation */}
            <DesktopNavBar
                activePage={activePage}
                translations={translations}
                userIsAdmin={userIsAdmin}
                isLoading={isLoading}
                profilePicture={profilePicture}
                handleShowShareCard={handleShowShareCard}
                handleShowProfileCard={handleShowProfileCard}
                profileCardRef={profileCardRef}
                shareCardRef={shareCardRef}
                ProfileCard={ProfileCard}
                ShareCard={ShareCard}
            />

            {/* Mobile Top Bar */}
            <MobileTopBar
                isLoading={isLoading}
                profilePicture={profilePicture}
                userIsAdmin={userIsAdmin}
                handleShowShareCard={handleShowShareCard}
                handleShowProfileCard={handleShowProfileCard}
                profileCardRef={profileCardRef}
                shareCardRef={shareCardRef}
                ProfileCard={ProfileCard}
                ShareCard={ShareCard}
            />

            {/* Mobile Bottom Bar */}
            <MobileBottomBar
                activePage={activePage}
                translations={translations}
            />
        </NavContext.Provider>
    );
}
