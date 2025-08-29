"use client"
import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

// ✅ STEP 1: Import the new, correct Phase 3 services
import { 
    subscriptionService,
    analyticsService, // This will use your new EnhancedAnalyticsService
    ErrorHandler 
} from '@/lib/services/serviceEnterprise/client/enhanced-index';

// Import all your analytics components
import AnalyticsHeader from "./components/AnalyticsHeader";
import PeriodNavigation from "./components/PeriodNavigation";
import OverviewCards from "./components/OverviewCards";
import PerformanceChart from "./components/PerformanceChart";
import TopClickedLinks from "./components/TopClickedLinks";
import TrafficSourcesChart from "./components/TrafficSourcesChart";

// --- Reusable Sub-components for different UI states ---

const LoadingState = ({ message }) => (
    <div className="flex-1 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
        <span className="ml-3 text-sm">{message}</span>
    </div>
);

const ErrorState = ({ message, onRetry }) => (
    <div className="flex-1 flex items-center justify-center h-full text-center">
         <div className="max-w-md">
            <p className="text-red-500 mb-4">⚠️ {message}</p>
            <button onClick={onRetry} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Try Again
            </button>
        </div>
    </div>
);

const SubscriptionUpgradeRequired = ({ subscription }) => {
    const { t } = useTranslation();
    return (
        <div className="flex-1 flex items-center justify-center h-full p-8">
            <div className="max-w-2xl mx-auto text-center">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-3xl p-8 shadow-lg border border-blue-200">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        {t('analytics.upgrade.title') || 'Unlock Analytics'}
                    </h1>
                    <p className="text-lg text-gray-600 mb-6">
                        Advanced analytics are a premium feature. Please upgrade your plan to access detailed insights.
                    </p>
                    <div className="inline-flex items-center px-4 py-2 bg-white rounded-full shadow-sm border mb-6">
                        <span className="text-sm text-gray-500 mr-2">Current plan:</span>
                        <span className="font-semibold text-gray-900 capitalize">
                            {subscription?.subscriptionLevel || 'Unknown'}
                        </span>
                    </div>
                    <div>
                        <button className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                            {t('analytics.upgrade.cta') || 'Upgrade Plan'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Content Component (for using hooks) ---

function AnalyticsContent() {
    const { currentUser } = useAuth();
    const searchParams = useSearchParams();
        const router = useRouter(); // ✅ Make sure router is initialized at the top level of the component

    
    // ✅ STEP 2: Simplified and centralized state management
    const [pageState, setPageState] = useState({
        loading: true,
        error: null,
        hasAccess: false,
    });
    
    const [analyticsData, setAnalyticsData] = useState(null);
    const [subscriptionData, setSubscriptionData] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('all');
    const [impersonationContext, setImpersonationContext] = useState(null);
        const isImpersonating = !!impersonationContext;

 const fetchData = useCallback(async (period) => {
        if (!currentUser) return;
        setPageState({ loading: true, error: null, hasAccess: false });
        
        try {
            const sub = await subscriptionService().getStatus();
            setSubscriptionData(sub);
            const canViewAnalytics = await subscriptionService().canPerformOperation('view_analytics');
            if (!canViewAnalytics) {
                setPageState({ loading: false, error: null, hasAccess: false });
                return;
            }
            setPageState(prev => ({ ...prev, hasAccess: true }));

            let rawData;
            const impersonateUserId = searchParams.get('impersonate');
            const teamId = searchParams.get('team');

            if (impersonateUserId && teamId) {
                const result = await analyticsService().getImpersonatedAnalytics(impersonateUserId, teamId, period);
                rawData = result; 
                setImpersonationContext(result.impersonationContext);
                toast.success(`Now viewing analytics for ${result.impersonationContext.targetUserData.displayName}`);
            } else {
                rawData = await analyticsService().getUserAnalytics(period);
            }
            
            const processedData = {
                ...rawData,
                periods: {
                    all: { views: rawData.totalViews || 0, clicks: rawData.totalClicks || 0 },
                    month: { views: rawData.thisMonthViews || 0, clicks: rawData.thisMonthClicks || 0, previousViews: rawData.previousMonthViews || 0, previousClicks: rawData.previousMonthClicks || 0 },
                    week: { views: rawData.thisWeekViews || 0, clicks: rawData.thisWeekClicks || 0, previousViews: rawData.previousWeekViews || 0, previousClicks: rawData.previousWeekClicks || 0 }
                }
            };

            setAnalyticsData(processedData);
            setPageState({ loading: false, error: null, hasAccess: true });

        } catch (err) {
            const handledError = ErrorHandler.handle(err, 'fetchAnalyticsData');
            setPageState({ loading: false, error: handledError.message, hasAccess: false });
            if (searchParams.get('impersonate')) {
                toast.error(`Could not load analytics: ${handledError.message}`);
            }
        }
    }, [currentUser, searchParams]);
    // This effect runs on initial load and whenever the selected period changes
    useEffect(() => {
        fetchData(selectedPeriod);
    }, [fetchData, selectedPeriod]);
  const returnToEnterprise = useCallback(() => {
        router.push('/dashboard/enterprise');
    }, [router]);

       const stopImpersonation = useCallback(() => {
        // Both "Back to Team" and "Stop Impersonating" should go to the same place.
        router.push('/dashboard/enterprise'); 
    }, [router]);
    // --- RENDER LOGIC ---

    if (pageState.loading) {
        return <LoadingState message="Loading Analytics..." />;
    }

    if (pageState.error) {
        return <ErrorState message={pageState.error} onRetry={() => fetchData(selectedPeriod)} />;
    }

    if (!pageState.hasAccess) {
        return <SubscriptionUpgradeRequired subscription={subscriptionData} />;
    }
    
    // Main dashboard render
// This is the main return statement that uses the variables
    return (
        <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto pb-20">
            <div className="p-4 space-y-6">
                
                {/* Impersonation Banner */}
                {isImpersonating && impersonationContext && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg shadow-sm">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            {/* Left side: Icon and Text */}
                            <div className="flex items-center">
                                <div className="flex-shrink-0 text-blue-500">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-bold text-blue-900">
                                        You are viewing analytics for: {impersonationContext.targetUserData?.displayName || '...'}
                                    </p>
                                    <p className="text-xs text-blue-700">
                                        This is not your data. Any actions taken are logged for security.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Right side: Action Buttons */}
                            <div className="flex items-center space-x-2 flex-shrink-0">
                                {impersonationContext.fromEnterprise && (
                                    <button 
                                        onClick={returnToEnterprise} 
                                        className="px-3 py-1.5 text-xs font-medium bg-white text-blue-700 border border-blue-300 rounded-md hover:bg-blue-100 transition-colors">
                                        ← Back to Team
                                    </button>
                                )}
                                <button 
                                    onClick={stopImpersonation} 
                                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                                    Stop Impersonating
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* The rest of your components */}
                <AnalyticsHeader 
                    analytics={analyticsData}
                    isImpersonating={isImpersonating}
                    username={impersonationContext?.targetUserData?.displayName || currentUser?.displayName}
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
                <TopClickedLinks isConnected={!pageState.error} />
                <TrafficSourcesChart 
                    analytics={analyticsData} 
                    selectedPeriod={selectedPeriod}
                />
            </div>
        </div>
    );
}

// ✅ Final export with Suspense Wrapper for useSearchParams hook
export default function AnalyticsPage() {
    return (
        <Suspense fallback={<LoadingState message="Loading page..." />}>
            <AnalyticsContent />
        </Suspense>
    );
}