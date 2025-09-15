/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
"use client";

import React, { Suspense, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useSearchParams, useRouter } from 'next/navigation';

// ✅ STEP 1: Import the new Provider and Context Hooks
import { AnalyticsProvider, useAnalytics } from "./AnalyticsContext";
import { useDashboard } from '../../DashboardContext';
import { ANALYTICS_FEATURES } from '@/lib/services/constants';

// Import all your analytics components
import AnalyticsHeader from "./components/AnalyticsHeader";
import PeriodNavigation from "./components/PeriodNavigation";
import OverviewCards from "./components/OverviewCards";
import PerformanceChart from "./components/PerformanceChart";
import TopClickedLinks from "./components/TopClickedLinks";
import TrafficSourcesChart from "./components/TrafficSourcesChart";

// --- Reusable Sub-components for UI states ---

const LoadingState = ({ message }) => (
    <div className="flex-1 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
        <span className="ml-3 text-sm">{message}</span>
    </div>
);

const SubscriptionUpgradeRequired = () => {
    const { t } = useTranslation();
    const { subscriptionLevel } = useDashboard();
    return (
        <div className="flex-1 flex items-center justify-center h-full p-8">
            <div className="max-w-2xl mx-auto text-center">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-3xl p-8 shadow-lg border border-blue-200">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        {t('analytics.upgrade.title', 'Unlock Analytics')}
                    </h1>
                    <p className="text-lg text-gray-600 mb-6">
                        Advanced analytics are a premium feature. Please upgrade your plan to access detailed insights.
                    </p>
                    <div className="inline-flex items-center px-4 py-2 bg-white rounded-full shadow-sm border mb-6">
                        <span className="text-sm text-gray-500 mr-2">Current plan:</span>
                        <span className="font-semibold text-gray-900 capitalize">
                            {subscriptionLevel || 'Unknown'}
                        </span>
                    </div>
                    <div>
                        <button className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                            {t('analytics.upgrade.cta', 'Upgrade Plan')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Content ---
function AnalyticsContent() {
    const { currentUser } = useAuth();
    const router = useRouter();

    const { permissions, isLoading: isSessionLoading } = useDashboard();
    const { analyticsData, isLoading: isAnalyticsLoading } = useAnalytics();

    const [selectedPeriod, setSelectedPeriod] = useState('all');
    
    const searchParams = useSearchParams();
    const impersonationContext = useMemo(() => {
        const isImpersonating = searchParams.get('impersonate') === 'true';
        const targetUserId = searchParams.get('userId');
        const displayName = searchParams.get('displayName');

        if (isImpersonating && targetUserId) {
            return { targetUserId, displayName };
        }
        return null;
    }, [searchParams]);
    
    const stopImpersonation = useCallback(() => {
        router.push('/dashboard/enterprise'); 
    }, [router]);

    // --- RENDER LOGIC ---
    if (isSessionLoading) {
        return <LoadingState message="Loading your session..." />;
    }

    if (!permissions[ANALYTICS_FEATURES.BASIC_ANALYTICS]) {
        return <SubscriptionUpgradeRequired />;
    }

    if (isAnalyticsLoading) {
        const loadingMessage = impersonationContext
            ? `Loading analytics for ${impersonationContext.displayName}...`
            : "Loading Analytics...";
        return <LoadingState message={loadingMessage} />;
    }
    
    return (
        <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto pb-20">
            <div className="p-4 space-y-6">
                
                {impersonationContext && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg shadow-sm">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center">
                                <div className="ml-3">
                                    <p className="text-sm font-bold text-blue-900">
                                        You are viewing analytics for: {impersonationContext.displayName || '...'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                                <button 
                                    onClick={stopImpersonation} 
                                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                    Stop Impersonating
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                <AnalyticsHeader 
                    analytics={analyticsData}
                    isImpersonating={!!impersonationContext}
                    username={impersonationContext?.displayName || currentUser?.displayName}
                />
                <PeriodNavigation 
                    selectedPeriod={selectedPeriod} 
                    setSelectedPeriod={setSelectedPeriod}
                />
                <OverviewCards 
                    analytics={analyticsData} 
                    selectedPeriod={selectedPeriod}
                />
                <PerformanceChart 
                    analytics={analyticsData} 
                    selectedPeriod={selectedPeriod}
                />
                <TopClickedLinks 
                    analytics={analyticsData}
                />
                <TrafficSourcesChart 
                    analytics={analyticsData} 
                />
            </div>
        </div>
    );
}

// --- Main Page Component (The Wrapper) ---
function AnalyticsPageWrapper() {
    const searchParams = useSearchParams();
    const isImpersonating = searchParams.get('impersonate') === 'true';
    const targetUserId = searchParams.get('userId');
    const impersonatedUserId = isImpersonating ? targetUserId : null;

    return (
        <AnalyticsProvider impersonatedUserId={impersonatedUserId}>
            <AnalyticsContent />
        </AnalyticsProvider>
    );
}

// Final export with Suspense Wrapper for useSearchParams
export default function AnalyticsPage() {
    return (
        <Suspense fallback={<LoadingState message="Loading page..." />}>
            <AnalyticsPageWrapper />
        </Suspense>
    );
}