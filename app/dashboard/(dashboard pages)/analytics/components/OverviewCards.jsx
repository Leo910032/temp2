//app/dashboard/(dashboard pages)/analytics/components/OverviewCards.jsx - FIXED
"use client"
import Image from "next/image";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useMemo } from "react";

export default function OverviewCards({ selectedPeriod, analytics, isConnected }) {
    const { t } = useTranslation();

    // ✅ FIXED: Better date key generation logic
    const getDateKeysForPeriod = (period) => {
        const today = new Date();
        const dates = [];
        let numDays = 0;

        switch (period) {
            case 'today':
                numDays = 1;
                break;
            case 'week':
                numDays = 7;
                break;
            case 'month':
                numDays = 30;
                break;
            default:
                return []; // For 'all' period, we don't need date keys
        }

        // Generate date keys for the specified number of days (including today)
        for (let i = 0; i < numDays; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            dates.push(dateKey);
        }
        
        console.log(`📊 Generated ${dates.length} date keys for ${period}:`, dates);
        return dates;
    };

    // ✅ FIXED: Improved calculation logic with debugging
    const currentPeriodData = useMemo(() => {
        if (!analytics) {
            return { 
                views: 0, 
                clicks: 0, 
                previousViews: 0, 
                previousClicks: 0, 
                periodLabel: t('analytics.period.today') || 'Today' 
            };
        }

        const dailyViews = analytics.dailyViews || {};
        const dailyClicks = analytics.dailyClicks || {};
        
        console.log('📊 Analytics data available:', {
            totalViews: analytics.totalViews,
            totalClicks: analytics.totalClicks,
            dailyViewsKeys: Object.keys(dailyViews),
            dailyClicksKeys: Object.keys(dailyClicks),
            selectedPeriod
        });

        let currentViews = 0;
        let currentClicks = 0;
        let previousViews = 0;
        let previousClicks = 0;
        let periodLabel = t('analytics.period.all_time') || 'All Time';

        if (selectedPeriod === 'all') {
            currentViews = analytics.totalViews || 0;
            currentClicks = analytics.totalClicks || 0;
            periodLabel = t('analytics.period.all_time') || 'All Time';
            
            console.log('📊 All time data:', { currentViews, currentClicks });
        } else {
            // Get date keys for current period
            const currentPeriodKeys = getDateKeysForPeriod(selectedPeriod);
            
            // ✅ FIXED: Calculate current period totals
            currentPeriodKeys.forEach(dateKey => {
                const viewsForDate = dailyViews[dateKey] || 0;
                const clicksForDate = dailyClicks[dateKey] || 0;
                currentViews += viewsForDate;
                currentClicks += clicksForDate;
                
                if (viewsForDate > 0 || clicksForDate > 0) {
                    console.log(`📊 ${dateKey}: ${viewsForDate} views, ${clicksForDate} clicks`);
                }
            });

            // ✅ FIXED: Calculate previous period for comparison
            const today = new Date();
            let periodLength = 0;
            
            switch (selectedPeriod) {
                case 'today':
                    periodLength = 1;
                    break;
                case 'week':
                    periodLength = 7;
                    break;
                case 'month':
                    periodLength = 30;
                    break;
            }

            // Generate previous period keys
            const previousPeriodKeys = [];
            for (let i = periodLength; i < periodLength * 2; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateKey = date.toISOString().split('T')[0];
                previousPeriodKeys.push(dateKey);
            }

            // Calculate previous period totals
            previousPeriodKeys.forEach(dateKey => {
                previousViews += dailyViews[dateKey] || 0;
                previousClicks += dailyClicks[dateKey] || 0;
            });

            // Set period label
            const periodLabels = {
                today: t('analytics.period.today') || 'Today',
                week: t('analytics.period.week') || 'This Week',
                month: t('analytics.period.month') || 'This Month'
            };
            periodLabel = periodLabels[selectedPeriod] || selectedPeriod;

            console.log(`📊 ${selectedPeriod} calculation:`, {
                currentViews,
                currentClicks,
                previousViews,
                previousClicks,
                currentPeriodKeys,
                previousPeriodKeys
            });
        }

        return { 
            views: currentViews, 
            clicks: currentClicks, 
            previousViews, 
            previousClicks, 
            periodLabel 
        };
    }, [analytics, selectedPeriod, t]);

    // ✅ IMPROVED: Better change indicator calculation
    const getChangeIndicator = (current, previous) => {
        if (previous === 0 && current === 0) return null;
        if (previous === 0 && current > 0) {
            return (
                <div className="flex items-center text-xs text-green-600">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    New!
                </div>
            );
        }

        const change = ((current - previous) / previous) * 100;
        const isPositive = change >= 0;
        
        return (
            <div className={`flex items-center text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                <svg className={`w-3 h-3 mr-1 ${isPositive ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {isPositive ? '+' : ''}{Math.abs(change).toFixed(1)}%
            </div>
        );
    };

    // ✅ ADDED: Debug info for development
    if (process.env.NODE_ENV === 'development') {
        console.log('📊 OverviewCards render:', {
            selectedPeriod,
            currentPeriodData,
            analyticsKeys: analytics ? Object.keys(analytics) : 'null'
        });
    }

    return (
        <div className="w-full"> 
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {currentPeriodData.periodLabel} Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Views Card */}
                <div className="bg-white rounded-xl shadow-sm border p-4 relative transition-all duration-300 hover:shadow-md">
                    <div className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-blue-500"></div>

                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-blue-100 p-1.5 rounded-md"> 
                            <Image 
                                src="https://linktree.sirv.com/Images/icons/analytics.svg"
                                alt="views"
                                width={20}
                                height={20}
                            />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-600">
                            {t('analytics.profile_views') || 'Profile Views'}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-0.5 transition-all duration-500">
                            {currentPeriodData.views.toLocaleString()}
                        </p>
                        <div className="mt-1.5">
                            {selectedPeriod !== 'all' && getChangeIndicator(currentPeriodData.views, currentPeriodData.previousViews)}
                        </div>
                    </div>
                </div>

                {/* Clicks Card */}
                <div className="bg-white rounded-xl shadow-sm border p-4 relative transition-all duration-300 hover:shadow-md">
                    <div className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-indigo-500"></div>

                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-indigo-100 p-1.5 rounded-md">
                            <Image 
                                src="https://linktree.sirv.com/Images/icons/links.svg"
                                alt="clicks"
                                width={20}
                                height={20}
                            />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-600">
                            {t('analytics.link_clicks') || 'Link Clicks'}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-0.5 transition-all duration-500">
                            {currentPeriodData.clicks.toLocaleString()}
                        </p>
                        <div className="mt-1.5">
                            {selectedPeriod !== 'all' && getChangeIndicator(currentPeriodData.clicks, currentPeriodData.previousClicks)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}