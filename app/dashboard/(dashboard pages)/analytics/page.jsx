// app/dashboard/(dashboard pages)/analytics/page.jsx
"use client"
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { getUserSubscription, canAccessAnalytics, getUpgradeMessage, FEATURES } from "@/lib/services/subscriptionService";

// Import impersonation service
import { getImpersonatedAnalytics } from "@/lib/services/serviceEnterprise/client/optimizedEnterpriseService";

// Import components
import AnalyticsHeader from "./components/AnalyticsHeader";
import PeriodNavigation from "./components/PeriodNavigation";
import OverviewCards from "./components/OverviewCards";
import PerformanceChart from "./components/PerformanceChart";
import LinkAnalyticsChart from "./components/LinkAnalyticsChart";
import TrafficSourcesChart from "./components/TrafficSourcesChart";

export default function AnalyticsPage() {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const searchParams = useSearchParams();
    
    const [analytics, setAnalytics] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('all');
    const [subscriptionLoading, setSubscriptionLoading] = useState(true);
    
    // Impersonation state
    const [impersonationContext, setImpersonationContext] = useState(null);
    const [isImpersonating, setIsImpersonating] = useState(false);
    
    // Toast tracking to prevent infinite toasts
    const [hasShownToast, setHasShownToast] = useState(false);

    // Extract impersonation parameters from URL (only run once)
    useEffect(() => {
        const impersonateUserId = searchParams.get('impersonate');
        const teamId = searchParams.get('team');
        const fromEnterprise = searchParams.get('from') === 'enterprise';
        const period = searchParams.get('period') || 'all';

        if (impersonateUserId && teamId) {
            setIsImpersonating(true);
            setImpersonationContext({
                targetUserId: impersonateUserId,
                teamId,
                fromEnterprise,
                period
            });
            setSelectedPeriod(period);
        }
    }, [searchParams]);

    // Check subscription status (only run when currentUser changes)
    useEffect(() => {
        const checkSubscription = async () => {
            if (!currentUser) return;

            setSubscriptionLoading(true);
            try {
                const subscriptionData = await getUserSubscription();
                setSubscription(subscriptionData);
            } catch (err) {
                console.error("Failed to fetch subscription data:", err);
                setError("Failed to load subscription information");
            } finally {
                setSubscriptionLoading(false);
            }
        };

        checkSubscription();
    }, [currentUser]);

    // Helper function to map periods
    const mapPeriodToAPI = useCallback((period) => {
        const periodMap = {
            'all': '1y',
            'year': '1y', 
            'month': '30d',
            'week': '7d'
        };
        return periodMap[period] || '30d';
    }, []);

    // Fetch analytics with proper dependencies
    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!currentUser || !subscription) return;

            // Check if user can access analytics
            if (!canAccessAnalytics(subscription.accountType)) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            
            try {
                let data;
                
                // Use impersonation API if impersonating
                if (isImpersonating && impersonationContext) {
                    console.log('Fetching impersonated analytics for:', impersonationContext.targetUserId);
                    
                    const result = await getImpersonatedAnalytics(
                        impersonationContext.targetUserId,
                        impersonationContext.teamId,
                        mapPeriodToAPI(selectedPeriod)
                    );
                    
                    // The service now returns a clean { success, impersonationContext, analytics } object
                    data = result.analytics;

                    // Update context with data from the API response (like username)
                    setImpersonationContext(prev => ({ ...prev, ...result.impersonationContext }));

                } else {
                    // Regular analytics API
                    console.log('Fetching regular analytics');
                    const token = await currentUser.getIdToken();
                    const response = await fetch('/api/user/analytics', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        
                        if (errorData.code === 'SUBSCRIPTION_REQUIRED') {
                            setError({ type: 'subscription', message: errorData.error });
                            return;
                        }
                        
                        throw new Error(errorData.error || `Error: ${response.status}`);
                    }
                    
                    data = await response.json();
                }
                
                setAnalytics(data);

            } catch (err) {
                console.error("Failed to fetch analytics data:", err);
                
                if (isImpersonating) {
                    toast.error(`Failed to load analytics: ${err.message}`);
                    setError({ type: 'impersonation', message: err.message, canReturnToEnterprise: impersonationContext?.fromEnterprise });
                } else {
                    setError({ type: 'general', message: err.message });
                }
            } finally {
                setLoading(false);
            }
        };

        if (subscription) {
            fetchAnalytics();
        }
    }, [currentUser, subscription, isImpersonating, impersonationContext?.targetUserId, impersonationContext?.teamId, selectedPeriod, mapPeriodToAPI]);

    const returnToEnterprise = useCallback(() => {
        window.location.href = '/dashboard/enterprise';
    }, []);

    const stopImpersonation = useCallback(() => {
        const url = new URL(window.location);
        url.searchParams.delete('impersonate');
        url.searchParams.delete('team');
        url.searchParams.delete('from');
        url.searchParams.delete('period');
        window.location.href = url.toString();
    }, []);

    // Loading states - styled to match old layout
    if (subscriptionLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                <span className="ml-3 text-sm">Checking subscription...</span>
            </div>
        );
    }

    if (subscription && !canAccessAnalytics(subscription.accountType)) {
        return <SubscriptionUpgradeRequired subscription={subscription} error={error} />;
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                <span className="ml-3 text-sm">
                    {isImpersonating ? 'Loading User Analytics...' : 'Loading Analytics...'}
                </span>
            </div>
        );
    }
    
    // Error states - styled to match old layout
    if (error) {
        if (error.type === 'subscription') {
            return <SubscriptionUpgradeRequired subscription={subscription} error={error} />;
        }
        
        if (error.type === 'impersonation') {
            return (
                <div className="flex-1 flex items-center justify-center h-full p-8">
                    <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-red-200 p-6 text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics Access Failed</h3>
                        <p className="text-gray-600 mb-6">{error.message}</p>
                        <div className="space-y-3">
                            {error.canReturnToEnterprise && (
                                <button onClick={returnToEnterprise} className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                                    Return to Team Management
                                </button>
                            )}
                            <button onClick={stopImpersonation} className="w-full px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors">
                                View Your Own Analytics
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="flex-1 flex items-center justify-center h-full text-center">
                 <div className="max-w-md">
                    <p className="text-red-500 mb-4">⚠️ {error.message || error}</p>
                    <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }
    
    // ✅ CORRECTED: Main analytics dashboard layout
    return (
        <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto pb-20">
            <div className="p-4 space-y-6">
                
                {/* Impersonation Banner */}
                {isImpersonating && impersonationContext && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0 h-5 w-5 text-blue-600">
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-blue-900">
                                        Viewing Analytics for: User
                                    </div>
                                    <div className="text-xs text-blue-700">
                                        Team Management • Period: {selectedPeriod} • {impersonationContext.targetUserId}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                {impersonationContext.fromEnterprise && (
                                    <button onClick={returnToEnterprise} className="px-3 py-1 text-xs font-medium text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded">
                                        ← Back to Team
                                    </button>
                                )}
                                <button onClick={stopImpersonation} className="px-3 py-1 text-xs font-medium text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded">
                                    View My Analytics
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Components */}
                <AnalyticsHeader 
                    analytics={analytics} 
                    isImpersonating={isImpersonating} 
                    selectedPeriod={selectedPeriod}
                    username={isImpersonating ? impersonationContext.targetUserData?.displayName : currentUser?.displayName}
                    isConnected={!error}
                />
                <PeriodNavigation 
                    selectedPeriod={selectedPeriod} 
    setSelectedPeriod={setSelectedPeriod}  // ✅ Correct prop name
                />
                <OverviewCards 
                    analytics={analytics} 
                    selectedPeriod={selectedPeriod}
                />
                <PerformanceChart 
                    analytics={analytics} 
                    selectedPeriod={selectedPeriod}
                />
                <LinkAnalyticsChart 
                    analytics={analytics} 
                    selectedPeriod={selectedPeriod}
                    isConnected={!error}
                />
                <TrafficSourcesChart 
                    analytics={analytics} 
                    selectedPeriod={selectedPeriod}
                />
            </div>
        </div>
    );
}

// ✅ Corrected: SubscriptionUpgradeRequired component with the new, better styling
function SubscriptionUpgradeRequired({ subscription, error }) {
    const { t } = useTranslation();

    return (
        <div className="flex-1 flex items-center justify-center h-full p-8">
            <div className="max-w-2xl mx-auto text-center">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-3xl p-8 shadow-lg border border-blue-200">
                    <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>

                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        {t('analytics.upgrade.title') || 'Unlock Analytics'}
                    </h1>

                    <p className="text-lg text-gray-600 mb-6">
                        {getUpgradeMessage(FEATURES.ANALYTICS)}
                    </p>

                    <div className="inline-flex items-center px-4 py-2 bg-white rounded-full shadow-sm border mb-6">
                        <span className="text-sm text-gray-500 mr-2">Current plan:</span>
                        <span className="font-semibold text-gray-900 capitalize">
                            {subscription?.accountType || 'Base'}
                        </span>
                    </div>

                    <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            {t('analytics.upgrade.features_title') || 'Pro Analytics Features'}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                            {[
                                'Real-time visitor tracking', 'Link click analytics',
                                'Traffic source insights', 'Performance charts',
                                'Historical data', 'Export capabilities'
                            ].map((feature) => (
                                <div key={feature} className="flex items-center">
                                    <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-sm text-gray-700">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md">
                            {t('analytics.upgrade.cta') || 'Upgrade to Pro'}
                        </button>
                        <button onClick={() => window.history.back()} className="px-8 py-3 bg-white text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors duration-200 border border-gray-300">
                            {t('common.go_back') || 'Go Back'}
                        </button>
                    </div>

                    {error && error.type === 'subscription' && (
                        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{error.message}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}