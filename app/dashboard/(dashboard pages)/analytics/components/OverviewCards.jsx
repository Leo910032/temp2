"use client"
import Image from "next/image";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useMemo } from "react";

// ✅ This component is now much simpler. It only displays data.
export default function OverviewCards({ selectedPeriod, analytics }) {
    const { t } = useTranslation();

    // ✅ STEP 1: Use useMemo to select the correct pre-calculated data. No more loops!
 const displayData = useMemo(() => {
    // ✅ FIX: Provide a default value for periodLabel
    const periodLabel = t(`analytics.period.${selectedPeriod}`, { defaultValue: `Overview for ${selectedPeriod}` });

    if (!analytics || !analytics.periods) {
        return { 
            views: 0, 
            clicks: 0, 
            previousViews: 0, 
            previousClicks: 0,
            periodLabel: t('analytics.period.all', { defaultValue: 'Lifetime Overview' }) // Default to lifetime
        };
    }

    const periodKey = selectedPeriod === 'year' ? 'all' : selectedPeriod;
    const currentPeriodData = analytics.periods[periodKey] || analytics.periods.all;
    
    return {
        views: currentPeriodData.views || 0,
        clicks: currentPeriodData.clicks || 0,
        previousViews: currentPeriodData.previousViews || 0,
        previousClicks: currentPeriodData.previousClicks || 0,
        periodLabel: periodLabel
    };
}, [analytics, selectedPeriod, t]);


    // ✅ The change indicator function remains the same, as it's pure presentation logic.
    const getChangeIndicator = (current, previous) => {
        if (previous === 0 && current > 0) {
            return (
                <div className="flex items-center text-xs text-green-600">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    New!
                </div>
            );
        }
        if (previous === 0) return null;

        const change = ((current - previous) / previous) * 100;
        const isPositive = change >= 0;
        
        return (
            <div className={`flex items-center text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                <svg className={`w-3 h-3 mr-1 ${isPositive ? '' : 'transform rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                {isPositive ? '+' : ''}{Math.abs(change).toFixed(0)}%
            </div>
        );
    };

    // ✅ The JSX is cleaner, using the simplified `displayData` object.
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
                            {t('analytics.profile_views') || 'Profile Views'}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-0.5">
                            {displayData.views.toLocaleString()}
                        </p>
                        <div className="mt-1.5 h-4"> {/* Added fixed height for layout consistency */}
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
                            {t('analytics.link_clicks') || 'Link Clicks'}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-0.5">
                            {displayData.clicks.toLocaleString()}
                        </p>
                        <div className="mt-1.5 h-4"> {/* Added fixed height for layout consistency */}
                            {selectedPeriod !== 'all' && getChangeIndicator(displayData.clicks, displayData.previousClicks)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}