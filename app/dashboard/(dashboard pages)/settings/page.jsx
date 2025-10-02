// app/dashboard/(dashboard pages)/settings/page.jsx
"use client";

import React, { useState, useMemo } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { useDashboard } from '@/app/dashboard/DashboardContext';
import { SettingsProvider, useSettings } from './SettingsContext';

// Import components
import Controller from "./components/Controller";
import SEO from "./components/SEO";
import SensitiveMaterial from "./components/SensitiveMaterial";
import SocialSetting from "./components/SocialSetting";
import SupportBanner from "./components/SupportBanner";

// Wrapper component to provide context
export default function SettingsPageWrapper() {
    return (
        <SettingsProvider>
            <SettingsPage />
        </SettingsProvider>
    );
}

function SettingsPage() {
    const { t, isInitialized } = useTranslation();
    const { isLoading: isSessionLoading } = useDashboard();
    
    // Get everything from context
    const {
        settings,
        updateSettings,
        isSaving,
        isLoading,
        hasLoadError,
        refreshData
    } = useSettings();

    // Translations
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('settings.title') || 'Settings',
            subtitle: t('settings.subtitle') || 'Manage your profile and preferences',
            saving: t('common.saving') || 'Saving...',
            saved: t('common.saved') || 'Settings saved!',
            loading: t('common.loading') || 'Loading...',
            loadingSettings: t('settings.loading') || 'Loading settings...',
            loadingSession: t('common.loading_session') || 'Loading session...',
            tryAgain: t('common.try_again') || 'Try Again',
            loadError: t('settings.load_error') || 'Failed to load settings'
        };
    }, [t, isInitialized]);

    // Loading states
    if (isSessionLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                    <span>{translations.loadingSession}</span>
                </div>
            </div>
        );
    }

    if (!isInitialized) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="animate-pulse">Loading translations...</div>
            </div>
        );
    }

    if (isLoading || !settings) {
        return (
            <div className="flex items-center justify-center p-8 min-h-[400px]">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <span>{translations.loadingSettings}</span>
                </div>
            </div>
        );
    }

    if (hasLoadError) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{translations.loadError}</p>
                    <button 
                        onClick={() => refreshData()}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        {translations.tryAgain}
                    </button>
                </div>
            </div>
        );
    }

    // Main render
    return (
        <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto scroll-smooth">
            {/* Save indicator */}
            {isSaving && (
                <div className="fixed top-20 right-6 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {translations.saving}
                </div>
            )}
            
            <Controller />
            <SocialSetting />
            <SupportBanner />
            <SensitiveMaterial />
            <SEO />
        </div>
    );
}