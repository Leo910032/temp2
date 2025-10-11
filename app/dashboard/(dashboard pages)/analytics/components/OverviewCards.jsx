/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
"use client"
import Image from "next/image";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useMemo } from "react";

export default function OverviewCards({ selectedPeriod, analytics }) {
    const { t } = useTranslation();

    // Calculate display data based on the actual analytics structure
    const displayData = useMemo(() => {
        console.log("📊 OverviewCards: Processing analytics data:", analytics);
        console.log("📊 OverviewCards: Selected period:", selectedPeriod);
        
        if (!analytics) {
            return { 
                views: 0, 
                clicks: 0, 
                previousViews: 0, 
                previousClicks: 0,
                periodLabel: t('analytics.period.all', 'Lifetime Overview')
            };
        }

        let views = 0;
        let clicks = 0;
        let previousViews = 0;
        let previousClicks = 0;
        let periodLabel = '';

        // Get current period data based on selected period
        switch (selectedPeriod) {
            case 'today':
                // For today, show current day data
                const today = new Date().toISOString().split('T')[0];
                views = analytics.dailyViews?.[today] || 0;
                clicks = analytics.dailyClicks?.[today] || 0;
                
                // Previous day for comparison
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayKey = yesterday.toISOString().split('T')[0];
                previousViews = analytics.dailyViews?.[yesterdayKey] || 0;
                previousClicks = analytics.dailyClicks?.[yesterdayKey] || 0;
                
                periodLabel = t('analytics.period.today', 'Today');
                break;
                
            case 'week':
                views = analytics.thisWeekViews || 0;
                clicks = analytics.thisWeekClicks || 0;
                
                // Calculate previous week data
                const now = new Date();
                const currentWeekNumber = Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);
                const previousWeekNumber = currentWeekNumber - 1;
                const currentYear = now.getFullYear();
                const previousWeekKey = `${currentYear}-W${String(previousWeekNumber).padStart(2, '0')}`;
                
                // Sum up previous week's daily data if weekly totals aren't available
                previousViews = analytics.weeklyViews?.[previousWeekKey] || 0;
                previousClicks = analytics.weeklyClicks?.[previousWeekKey] || 0;
                
                periodLabel = t('analytics.period.week', 'This Week');
                break;
                
            case 'month':
                views = analytics.thisMonthViews || 0;
                clicks = analytics.thisMonthClicks || 0;
                
                // Calculate previous month data
                const currentDate = new Date();
                const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
                const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
                
                previousViews = analytics.monthlyViews?.[previousMonthKey] || 0;
                previousClicks = analytics.monthlyClicks?.[previousMonthKey] || 0;
                
                periodLabel = t('analytics.period.month', 'This Month');
                break;
                
            case 'all':
            default:
                views = analytics.totalViews || 0;
                clicks = analytics.totalClicks || 0;
                // No previous period for "all time"
                previousViews = 0;
                previousClicks = 0;
                periodLabel = t('analytics.period.all', 'All Time');
                break;
        }

        const result = {
            views,
            clicks,
            previousViews,
            previousClicks,
            periodLabel
        };
        
        console.log("📊 OverviewCards: Final display data:", result);
        return result;
    }, [analytics, selectedPeriod, t]);

    // Change indicator function
    const getChangeIndicator = (current, previous) => {
        if (previous === 0 && current > 0) {
            return (
                <div className="flex items-center text-xs text-green-600">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    {t('analytics.overview.new', 'New!')}
                </div>
            );
        }
        if (previous === 0) return null;

        const change = ((current - previous) / previous) * 100;
        const isPositive = change >= 0;
        
        return (
            <div className={`flex items-center text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                <svg className={`w-3 h-3 mr-1 ${isPositive ? '' : 'transform rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {isPositive ? '+' : ''}{Math.abs(change).toFixed(0)}%
            </div>
        );
    };

    return (
        <div className="w-full"> 
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {displayData.periodLabel}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Views Card */}
                <div className="bg-white rounded-xl shadow-sm border p-4 relative transition-all duration-300 hover:shadow-md">
                    <div className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-blue-500"></div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-blue-100 p-1.5 rounded-md"> 
                            <Image src="https://linktree.sirv.com/Images/icons/analytics.svg" alt="views" width={20} height={20} />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-600">
                            {t('analytics.profile_views', 'Profile Views')}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-0.5">
                            {displayData.views.toLocaleString()}
                        </p>
                        <div className="mt-1.5 h-4">
                            {selectedPeriod !== 'all' && getChangeIndicator(displayData.views, displayData.previousViews)}
                        </div>
                    </div>
                </div>

                {/* Clicks Card */}
                <div className="bg-white rounded-xl shadow-sm border p-4 relative transition-all duration-300 hover:shadow-md">
                    <div className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-indigo-500"></div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-indigo-100 p-1.5 rounded-md">
                            <Image src="https://linktree.sirv.com/Images/icons/links.svg" alt="clicks" width={20} height={20} />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-600">
                            {t('analytics.link_clicks', 'Link Clicks')}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-0.5">
                            {displayData.clicks.toLocaleString()}
                        </p>
                        <div className="mt-1.5 h-4">
                            {selectedPeriod !== 'all' && getChangeIndicator(displayData.clicks, displayData.previousClicks)}
                        </div>
                    </div>
                </div>
            </div>
        
        </div>
    );
}