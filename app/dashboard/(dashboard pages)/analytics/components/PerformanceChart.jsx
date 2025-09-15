/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
"use client";
import { useMemo } from "react";
import { useTranslation } from "@/lib/translation/useTranslation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- Helper Functions (Simplified and more robust) ---

const generateDailyData = (dailyViews = {}, dailyClicks = {}, days) => {
    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        
        data.push({
            name: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
            views: dailyViews[dateKey] || 0,
            clicks: dailyClicks[dateKey] || 0,
        });
    }
    return data;
};

const generateWeeklyData = (dailyViews = {}, dailyClicks = {}, weeks) => {
    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = weeks - 1; i >= 0; i--) {
        let weekViews = 0;
        let weekClicks = 0;
        const weekDates = [];

        for (let j = 0; j < 7; j++) {
            const date = new Date(today);
            date.setDate(today.getDate() - (i * 7) - j);
            const dateKey = date.toISOString().split('T')[0];
            weekViews += dailyViews[dateKey] || 0;
            weekClicks += dailyClicks[dateKey] || 0;
            if (j === 0 || j === 6) weekDates.push(date);
        }

        const weekEnd = weekDates[0];
        const weekStart = weekDates[1];

        data.push({
            name: `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
            views: weekViews,
            clicks: weekClicks,
        });
    }
    return data;
};

const generateMonthlyData = (dailyViews = {}, dailyClicks = {}) => {
    const monthlyAggregates = {};
    const allDates = [...new Set([...Object.keys(dailyViews), ...Object.keys(dailyClicks)])];

    allDates.forEach(dateKey => {
        if (!dateKey.match(/^\d{4}-\d{2}-\d{2}$/)) return;
        const monthKey = dateKey.substring(0, 7);
        if (!monthlyAggregates[monthKey]) {
            monthlyAggregates[monthKey] = { views: 0, clicks: 0 };
        }
        monthlyAggregates[monthKey].views += dailyViews[dateKey] || 0;
        monthlyAggregates[monthKey].clicks += dailyClicks[dateKey] || 0;
    });

    return Object.keys(monthlyAggregates).sort().map(monthKey => {
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return {
            name: date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
            ...monthlyAggregates[monthKey]
        };
    });
};

export default function PerformanceChart({ analytics, selectedPeriod = 'week' }) {
    const { t } = useTranslation();

    const chartData = useMemo(() => {
        console.log("📊 PerformanceChart: Re-calculating chart data. Analytics prop:", analytics);
        if (!analytics || !analytics.dailyViews || !analytics.dailyClicks) {
            return [];
        }

        switch (selectedPeriod) {
            case 'today': // 'today' now correctly shows the last 7 days for context
            case 'week':
                return generateDailyData(analytics.dailyViews, analytics.dailyClicks, 7);
            case 'month':
                return generateWeeklyData(analytics.dailyViews, analytics.dailyClicks, 4);
            case 'all':
                return generateMonthlyData(analytics.dailyViews, analytics.dailyClicks);
            default:
                return [];
        }
    }, [analytics, selectedPeriod]);

    // ✅ THE FIX IS HERE: The `hasData` check must depend on `chartData`.
    const hasData = useMemo(() => {
        return chartData.length > 0 && chartData.some(item => item.views > 0 || item.clicks > 0);
    }, [chartData]); // This hook now correctly re-runs whenever chartData is recalculated.
        
    const getChartTitle = () => {
        const titles = {
            today: t('analytics.performance_today', "Today's Performance (7-day view)"),
            week: t('analytics.performance_week', 'Weekly Performance (daily)'),
            month: t('analytics.performance_month', 'Monthly Performance (weekly)'),
            all: t('analytics.performance_all_time', 'All-Time Performance (monthly)')
        };
        return titles[selectedPeriod] || titles.week;
    };

    // Get appropriate empty state message
    const getEmptyStateMessage = () => {
        const messages = {
            today: 'No activity recorded in the last 7 days.',
            week: 'No data to display for the last 7 days.',
            month: 'No data to display for the last month.',
            all: 'No historical data available yet.'
        };
        return messages[selectedPeriod] || messages.week;
    };

    return (
        <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">
                    {getChartTitle()}
                </h2>
                {selectedPeriod === 'all' && chartData.length > 0 && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        📊 {chartData.length} months with data
                    </span>
                )}
            </div>
            
            <div className="w-full h-64">
                {!hasData ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">{getEmptyStateMessage()}</p>
                        <p className="text-xs mt-1">Share your profile to get views and clicks!</p>
                        {selectedPeriod === 'all' && (
                            <div className="mt-2 text-xs text-gray-400">
                                <p>Debug info:</p>
                                <p>Chart data length: {chartData.length}</p>
                                <p>Analytics available: {analytics ? 'Yes' : 'No'}</p>
                                {analytics && (
                                    <p>Daily views keys: {Object.keys(analytics.dailyViews || {}).length}</p>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartData}
                            margin={{ top: 10, right: 20, left: -10, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                                dataKey="name" 
                                stroke="#6b7280" 
                                tick={{ fontSize: 12, fill: '#6b7280' }}
                                axisLine={false}
                                tickLine={false}
                                angle={selectedPeriod === 'month' ? -45 : 0}
                                textAnchor={selectedPeriod === 'month' ? 'end' : 'middle'}
                                height={selectedPeriod === 'month' ? 60 : 30}
                            />
                            <YAxis 
                                stroke="#6b7280" 
                                tick={{ fontSize: 12, fill: '#6b7280' }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '0.5rem',
                                    fontSize: '12px',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                }}
                                formatter={(value, name) => [
                                    value.toLocaleString(),
                                    name === 'views' ? (t('analytics.views') || 'Views') : (t('analytics.clicks') || 'Clicks')
                                ]}
                                labelFormatter={(label) => {
                                    if (selectedPeriod === 'month') return `Week: ${label}`;
                                    if (selectedPeriod === 'all') return `Month: ${label}`;
                                    return `Date: ${label}`;
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                            <Line 
                                type="monotone" 
                                dataKey="views" 
                                stroke="#3b82f6" 
                                strokeWidth={2} 
                                name={t('analytics.profile_views') || "Profile Views"}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="clicks" 
                                stroke="#8b5cf6" 
                                strokeWidth={2} 
                                name={t('analytics.link_clicks') || "Link Clicks"}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
            
            {/* Data summary for the selected period */}
            {hasData && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="text-center">
                            <span className="text-gray-500">Total Views</span>
                            <div className="font-semibold text-blue-600">
                                {chartData.reduce((sum, item) => sum + item.views, 0).toLocaleString()}
                            </div>
                        </div>
                        <div className="text-center">
                            <span className="text-gray-500">Total Clicks</span>
                            <div className="font-semibold text-purple-600">
                                {chartData.reduce((sum, item) => sum + item.clicks, 0).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}