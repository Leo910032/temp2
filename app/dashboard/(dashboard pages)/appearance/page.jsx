// app/dashboard/(dashboard pages)/appearance/page.jsx - Updated with Banner Feature
"use client"
import React, { useMemo } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { APPEARANCE_FEATURES } from '@/lib/services/constants';

// Import the enhanced context
import { AppearanceProvider, useAppearance } from './AppearanceContext';

// Import components
import ProfileCard from './components/ProfileCard';
import Themes from './components/Themes';
import Banners from './components/Banners'; // 🆕 New Banner component
import CarouselManager from './components/CarouselManager'; // 🆕 New Carousel component
import Backgrounds from './components/Backgrounds';
import Buttons from './components/Buttons';
import FontsOptions from './components/FontsOptions';
import ChristmasAccessories from './components/ChristmasAccessories';

const UpgradePrompt = ({ feature, requiredTier }) => (
    <div className="p-6 text-center bg-white rounded-lg shadow-md border">
        <div className="text-lg font-semibold text-amber-600 mb-2">
            {feature}
        </div>
        <p className="text-gray-600 mb-4">
            This feature requires a {requiredTier} plan.
        </p>
        <button className="px-6 py-3 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors">
            Upgrade to {requiredTier}
        </button>
    </div>
);

// Cache status debug panel for development
const CacheDebugPanel = ({ cacheInfo, appearance }) => {
    if (process.env.NODE_ENV !== 'development') return null;

    return (
        <div className="fixed bottom-4 left-4 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-xs z-50 max-w-xs">
            <div className="font-bold mb-2 text-gray-800">Appearance Cache</div>
            <div className="space-y-1 text-gray-600">
                <div>Source: {cacheInfo.isFromCache ? '💾 Cache' : '🔄 Fresh'}</div>
                <div>Entries: {cacheInfo.totalCacheEntries}</div>
                <div>Key: {cacheInfo.currentCacheKey?.replace('appearance_', '...') || 'None'}</div>
                {appearance?._meta && (
                    <>
                        <div>Fetched: {Math.round((Date.now() - appearance._meta.fetchedAt) / 1000)}s ago</div>
                        {appearance._meta.lastModified && (
                            <div>Modified: {Math.round((Date.now() - appearance._meta.lastModified) / 1000)}s ago</div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// Main content component that uses the context
function AppearanceContent() {
    const { t, isInitialized } = useTranslation();
    const {
        appearance,
        isSaving,
        isLoading,
        hasLoadError,
        refreshData,
        permissions,
        cacheInfo
    } = useAppearance();

    // Handle hash navigation on mount and when hash changes
    React.useEffect(() => {
        const handleHashNavigation = () => {
            const hash = window.location.hash;
            if (hash) {
                const elementId = hash.substring(1); // Remove the '#'
                setTimeout(() => {
                    const element = document.getElementById(elementId);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 100);
            }
        };

        // Run on mount
        handleHashNavigation();

        // Listen for hash changes
        window.addEventListener('hashchange', handleHashNavigation);

        return () => {
            window.removeEventListener('hashchange', handleHashNavigation);
        };
    }, []);

    // Pre-compute translations
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            profile: t('dashboard.appearance.headings.profile') || 'Profile',
            themes: t('dashboard.appearance.headings.themes') || 'Themes',
            customAppearance: t('dashboard.appearance.headings.custom_appearance') || 'Custom Appearance',
            customAppearanceDesc: t('dashboard.appearance.custom_appearance_description') || 'Customize your contact card with these advanced options.',
            banners: t('dashboard.appearance.headings.banners') || 'Banner', // 🆕 New banner heading
            carousel: t('dashboard.appearance.headings.carousel') || 'Content Carousel', // 🆕 New carousel heading
            backgrounds: t('dashboard.appearance.headings.backgrounds') || 'Backgrounds',
            christmas: t('dashboard.appearance.headings.christmas') || 'Christmas Accessories',
            buttons: t('dashboard.appearance.headings.buttons') || 'Buttons',
            fonts: t('dashboard.appearance.headings.fonts') || 'Fonts',
            newBadge: t('dashboard.appearance.new_badge') || 'NEW',
            saving: t('common.saving') || "Saving...",
        };
    }, [t, isInitialized]);

    const canUseCustomButtons = permissions[APPEARANCE_FEATURES.CUSTOM_BUTTONS];
    const canUseCustomFonts = permissions[APPEARANCE_FEATURES.CUSTOM_FONTS];
    const canUseCustomBackground = permissions[APPEARANCE_FEATURES.CUSTOM_BACKGROUND];
    const canUseCustomBanner = permissions[APPEARANCE_FEATURES.CUSTOM_BACKGROUND]; // 🆕 Reuse background permission for banners
    const canUseCarousel = permissions[APPEARANCE_FEATURES.CUSTOM_CAROUSEL]; // 🆕 Carousel permission (Pro & Premium)

    // 🔍 DEBUG: Log permission checks
    console.log('🎨 [AppearancePage] Carousel Permission Debug:', {
        featureKey: APPEARANCE_FEATURES.CUSTOM_CAROUSEL,
        canUseCarousel,
        allPermissions: permissions,
        permissionKeys: Object.keys(permissions)
    });

    // Loading states
    if (!isInitialized) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 text-center">
                    <div className="animate-pulse">Loading translations...</div>
                </div>
            </div>
        );
    }

    if (isLoading && !appearance) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <div className="text-gray-500">
                        {cacheInfo.isFromCache ? 'Loading from cache...' : 'Loading appearance settings...'}
                    </div>
                </div>
            </div>
        );
    }

    if (!appearance && hasLoadError) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto">
                <div className="p-6 text-center">
                    <div className="text-red-500 mb-4">Failed to load appearance settings</div>
                    <button 
                        onClick={() => refreshData()}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // Permission check
    if (!permissions[APPEARANCE_FEATURES.CAN_UPDATE_APPEARANCE]) {
        return (
            <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto items-center justify-center">
                <div className="p-6 text-center bg-white rounded-lg shadow-md">
                    <div className="text-xl font-semibold text-amber-600 mb-4">
                        Appearance Customization
                    </div>
                    <p className="text-gray-600 mb-6">This feature is not included in your current plan.</p>
                    <button className="px-6 py-3 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors">
                        Upgrade Your Plan
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto pr-2">
            {/* Saving indicator */}
            {isSaving && (
                <div className="fixed top-20 right-6 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="font-medium">{translations.saving}</span>
                </div>
            )}

            {/* Cache status indicator in development */}
            {process.env.NODE_ENV === 'development' && cacheInfo.isFromCache && (
                <div className="mx-4 mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-lg">
                    <div className="text-sm text-yellow-800">
                        📋 Showing cached data - changes will save automatically
                    </div>
                </div>
            )}
            
            <div className="py-4">
                <h2 className="text-lg font-semibold my-4">{translations.profile}</h2>
                <ProfileCard />
            </div>
            
            <div className="py-4">
                <h2 className="text-lg font-semibold my-4">{translations.themes}</h2>
                <Themes />
            </div>
            
            <div className="py-4">
                <h2 className="text-lg font-semibold my-4">{translations.customAppearance}</h2>
                <p className="py-3 sm:text-base text-sm text-gray-600">
                    {translations.customAppearanceDesc}
                </p>
            </div>

            {/* 🆕 NEW BANNER SECTION */}
            <div className="py-4">
                <h2 className="text-lg font-semibold my-4">
                    {translations.banners}
                    <span className="py-1 px-3 rounded bg-blue-500 text-white font-medium text-sm ml-2">
                        {translations.newBadge}
                    </span>
                </h2>
                <p className="py-3 sm:text-base text-sm text-gray-600">
                    Add a professional banner to the top of your contact card. Choose from colors, gradients, images, or videos.
                </p>
                {canUseCustomBanner ? <Banners /> : <UpgradePrompt feature="Custom Banners" requiredTier="Premium" />}
            </div>

            {/* 🆕 NEW CAROUSEL SECTION */}
            <div id="carousel" className="py-4 scroll-mt-20">
                <h2 className="text-lg font-semibold my-4">
                    {translations.carousel}
                    <span className="py-1 px-3 rounded bg-purple-500 text-white font-medium text-sm ml-2">
                        {translations.newBadge}
                    </span>
                </h2>
                {canUseCarousel ? <CarouselManager /> : <UpgradePrompt feature="Content Carousel" requiredTier="Pro" />}
            </div>

            <div className="py-4">
                <h2 className="text-lg font-semibold my-4">{translations.backgrounds}</h2>
                {canUseCustomBackground ? <Backgrounds /> : <UpgradePrompt feature="Custom Backgrounds" requiredTier="Premium" />}
            </div>
            
            <div className="py-4">
                <h2 className="text-lg font-semibold my-4">
                    {translations.christmas} 
                    <span className="py-1 px-3 rounded bg-green-500 text-white font-medium text-sm ml-2">
                        {translations.newBadge}
                    </span>
                </h2>
                <ChristmasAccessories />
            </div>
            
            <div className="py-4">
                <h2 className="text-lg font-semibold my-4">{translations.buttons}</h2>
                {canUseCustomButtons ? <Buttons /> : <UpgradePrompt feature="Custom Buttons" requiredTier="Pro" />}
            </div>
            
            <div className="py-4">
                <h2 className="text-lg font-semibold my-4">{translations.fonts}</h2>
                {canUseCustomFonts ? <FontsOptions /> : <UpgradePrompt feature="Custom Fonts" requiredTier="Pro" />}
            </div>

            {/* Development cache debug panel */}
            <CacheDebugPanel 
                cacheInfo={cacheInfo}
                appearance={appearance}
            />
        </div>
    );
}

// Main page component wrapped with provider
export default function AppearancePage() {
    return (
        <AppearanceProvider>
            <AppearanceContent />
        </AppearanceProvider>
    );
}