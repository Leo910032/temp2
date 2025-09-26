/**
 * THIS FILE HAS BEEN REFACTORED 
 * Updated to work with the new user document structure in 'users' collection
 */
// app/[userId]/House.jsx - Updated for new document structure
"use client"
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { fireApp } from "@/important/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import ProfilePic from "./components/ProfilePic";
import UserInfo from "./components/UserInfo";
import BgDiv from "./components/BgDiv";
import MyLinks from "./components/MyLinks";
import SupportBanner from "./components/SupportBanner";
import PublicLanguageSwitcher from "./components/PublicLanguageSwitcher";
import SensitiveWarning from "./components/SensitiveWarning";
import { trackView } from '@/lib/services/analyticsService';
import AssetLayer from "./components/AssetLayer";

// Import contact exchange components
import ExchangeButton from "./components/ExchangeButton";

export const HouseContext = React.createContext(null);

export default function House({ initialUserData, scanToken = null, scanAvailable = false }) {
    // Initialize state with server-fetched data
    const [userData, setUserData] = useState(initialUserData);
    const [showSensitiveWarning, setShowSensitiveWarning] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const [viewTracked, setViewTracked] = useState(false);
    const updateInProgress = useRef(false);

    // Profile verification status for contact exchange
    const [profileVerificationStatus, setProfileVerificationStatus] = useState({
        verified: false,
        loading: true,
        error: null
    });

    // Check for preview mode once on component mount
    const isPreviewMode = useMemo(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            return params.get('preview') === 'true';
        }
        return false;
    }, []);

    // ✅ Updated to work with new document structure
    const shouldShowContactExchange = useMemo(() => {
        // Don't show in preview mode
        if (isPreviewMode) return false;
        
        // Check if user has contact exchange enabled (from settings object)
        const settings = userData?.settings || {};
        const contactExchangeEnabled = settings.contactExchangeEnabled !== false; // Default to true
        
        // Check if user has basic contact info (from profile object)
        const profile = userData?.profile || {};
        const hasContactInfo = profile.displayName || userData?.email;
        
        return contactExchangeEnabled && hasContactInfo;
    }, [isPreviewMode, userData?.settings?.contactExchangeEnabled, userData?.profile?.displayName, userData?.email]);

    // ✅ Updated to check sensitive content from new structure
    useEffect(() => {
        // Check for sensitive content warning from settings
        const settings = userData?.settings || {};
        setShowSensitiveWarning(settings.sensitiveStatus || false);
    }, [userData?.settings?.sensitiveStatus]);

  // app/[userId]/House.jsx

// ... (imports and component setup) ...

  // In your House.jsx, update the flattenedData object in the real-time listener:

// ✅ Updated real-time listener to use 'users' collection and correct data structure
useEffect(() => {
    if (!userData?.uid) return;

    console.log('🔄 Setting up real-time listener for user:', userData.uid);
    
    const docRef = doc(fireApp, "users", userData.uid);
    const unsubscribe = onSnapshot(docRef, 
        (docSnap) => {
            if (docSnap.exists()) {
                const latestData = docSnap.data();
                
                // ✅ THE FIX: Read from the new nested objects, just like on the server.
                const profile = latestData.profile || {};
                const appearance = latestData.appearance || {};
                const settings = latestData.settings || {};

                // This flattened structure is for backward compatibility with your child components.
                const flattenedData = {
                    uid: userData.uid,
                    username: latestData.username,
                    email: latestData.email,
                    
                    // Profile data
                    displayName: profile.displayName || '',
                    bio: profile.bio || '',
                    profilePhoto: profile.avatarUrl || '', // Use avatarUrl from profile

                    // Content arrays
                    links: latestData.links || [],
                    socials: latestData.socials || [],
                    
                    // ✅ FIXED: Appearance data with ALL gradient fields
                    selectedTheme: appearance.selectedTheme || 'Lake White',
                    themeFontColor: appearance.themeFontColor || '#000000',
                    fontType: appearance.fontType || 0,
                    backgroundColor: appearance.backgroundColor || '#FFFFFF',
                    backgroundType: appearance.backgroundType || 'Color',
                    
                    // ✅ ADD THESE MISSING GRADIENT FIELDS:
                    gradientDirection: appearance.gradientDirection || 0,
                    gradientColorStart: appearance.gradientColorStart || '#FFFFFF',
                    gradientColorEnd: appearance.gradientColorEnd || '#000000',
                    
                    btnColor: appearance.btnColor || '#000000',
                    btnFontColor: appearance.btnFontColor || '#FFFFFF',
                    btnShadowColor: appearance.btnShadowColor || '#dcdbdb',
                    btnType: appearance.btnType || 0,
                    cvDocument: appearance.cvDocument || null,
                    christmasAccessory: appearance.christmasAccessory || null,

                    // Settings data
                    isPublic: settings.isPublic !== false,
                    sensitiveStatus: settings.sensitiveStatus || false,
                    sensitivetype: settings.sensitivetype || 0,
                    supportBanner: settings.supportBanner || '',
                    supportBannerStatus: settings.supportBannerStatus || false,
                    socialPosition: settings.socialPosition || 0,
                };
                
                console.log('🎨 House: Updated data with gradient fields:', {
                    backgroundType: flattenedData.backgroundType,
                    gradientDirection: flattenedData.gradientDirection,
                    gradientColorStart: flattenedData.gradientColorStart,
                    gradientColorEnd: flattenedData.gradientColorEnd
                });
                
                setUserData(flattenedData);
            } else {
                console.warn('❌ User document not found in real-time update');
            }
        },
        (error) => {
            console.error('❌ Real-time listener error:', error);
        }
    );

    return () => {
        console.log('🧹 Cleaning up real-time listener');
        unsubscribe();
    };
}, [userData?.uid]);
// ... (rest of the House.jsx component) ...
    // Effect for tracking the profile view event
    useEffect(() => {
        if (viewTracked) return;
        if (isPreviewMode) {
            console.log("📊 Analytics: View tracking skipped, PREVIEW MODE is active.");
            return;
        }
        if (userData?.uid && userData?.username) {
            const timer = setTimeout(() => {
                trackView(userData.uid, userData.username);
                setViewTracked(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [viewTracked, isPreviewMode, userData?.uid, userData?.username]);

    // Effect for online/offline status
    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); setRetryCount(0); };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Effect to verify profile early (before modal opens)
    useEffect(() => {
        const verifyProfileEarly = async () => {
            if (isPreviewMode || !shouldShowContactExchange) {
                setProfileVerificationStatus({ verified: false, loading: false, error: null });
                return;
            }

            try {
                console.log('🔍 House: Early profile verification for contact exchange');
                
                // Import the service dynamically to avoid SSR issues
                const { EnhancedExchangeService } = await import('@/lib/services/serviceContact/client/services/EnhancedExchangeService');
                const exchangeService = new EnhancedExchangeService();
                
                let verification;
                if (userData?.uid) {
                    verification = await exchangeService.verifyProfileByUserId(userData.uid);
                } else if (userData?.username) {
                    verification = await exchangeService.verifyProfileByUsername(userData.username);
                } else {
                    throw new Error('No profile identifier available');
                }

                setProfileVerificationStatus({
                    verified: verification.available,
                    loading: false,
                    error: null
                });

                console.log('✅ House: Profile verification completed:', verification.available);

            } catch (error) {
                console.error('❌ House: Profile verification failed:', error);
                setProfileVerificationStatus({
                    verified: false,
                    loading: false,
                    error: error.message
                });
            }
        };

        // Run verification after initial data is loaded
        if (userData?.uid || userData?.username) {
            verifyProfileEarly();
        }
    }, [userData?.uid, userData?.username, isPreviewMode, shouldShowContactExchange]);

    const contextValue = useMemo(() => ({
        userData,
        setShowSensitiveWarning,
        isOnline,
        retryCount
    }), [userData, isOnline, retryCount]);

    if (!userData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading user profile...</p>
                </div>
            </div>
        );
    }

    return (
        <HouseContext.Provider value={contextValue}>
            {!isOnline && (
                <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 z-50 text-sm">
                    ⚠️ Connection lost. Trying to reconnect... (Attempt {retryCount + 1})
                </div>
            )}
            
            <PublicLanguageSwitcher />
            
            {showSensitiveWarning ? (
                <SensitiveWarning />
            ) : (
                <>
                    <BgDiv />
                    <AssetLayer />

                    <div className="relative z-20 md:w-[50rem] w-full flex flex-col items-center h-full mx-auto">
                        <div className="flex flex-col items-center flex-1 overflow-auto py-6">
                            <ProfilePic />
                            <UserInfo />
                            <MyLinks />
                            
                            {/* Contact Exchange Section */}
                            {shouldShowContactExchange && (
                                <div className="w-full max-w-lg px-4 mt-6 space-y-3">
                                    {/* Section title */}
                                    <div className="text-center mb-4">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-1">
                                            🤝 Connect with Me
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            Exchange contact information quickly and easily
                                        </p>
                                        
                                        {/* Show scan availability status */}
                                        {scanAvailable && (
                                            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                </svg>
                                                Business card scanning enabled
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Contact Exchange Button */}
                                    <div className="space-y-3">
                                        <ExchangeButton 
                                            username={userData.username}
                                            userInfo={{
                                                userId: userData.uid,
                                                displayName: userData.displayName || userData.profile?.displayName,
                                                email: userData.email
                                            }}
                                            userId={userData.uid}
                                            scanToken={scanToken}
                                            scanAvailable={scanAvailable}
                                            preVerified={profileVerificationStatus.verified}
                                            verificationLoading={profileVerificationStatus.loading}
                                        />
                                    </div>

                                    {/* Information about business card scanning */}
                                    {scanAvailable && (
                                        <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-blue-800 text-sm mb-1">
                                                        ✨ AI-Powered Quick Fill
                                                    </h4>
                                                    <p className="text-blue-700 text-xs">
                                                        Simply scan your business card with your phone camera and watch as AI automatically fills out your contact information in seconds!
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <SupportBanner />
                </>
            )}
        </HouseContext.Provider>
    );
}