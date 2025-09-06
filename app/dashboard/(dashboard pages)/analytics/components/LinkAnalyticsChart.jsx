// app/dashboard/(dashboard pages)/analytics/components/LinkAnalyticsChart.jsx - FIXED
"use client"
import { useTranslation } from "@/lib/translation/useTranslation";
import { baseUrlIcons } from "@/lib/BrandLinks";
import { makeValidUrl } from "@/lib/utilities";
import Image from "next/image";
import { useMemo } from "react";

export default function LinkAnalyticsChart({ analytics, isConnected, selectedPeriod = 'all' }) {
    const { t } = useTranslation();
    
    console.log("🔍 LinkAnalyticsChart received:", {
        hasAnalytics: !!analytics,
        hasTopLinks: !!analytics?.topLinks,
        topLinksLength: analytics?.topLinks?.length || 0,
        selectedPeriod
    });

    // ✅ Process link data using the server-provided topLinks array
    const processedLinks = useMemo(() => {
        if (!analytics?.topLinks || !Array.isArray(analytics.topLinks)) {
            console.log("❌ No topLinks data found");
            return [];
        }

        return analytics.topLinks
            .filter(link => link.totalClicks > 0) // Only show links with clicks
            .map(link => {
                // Get appropriate click count based on selected period
                let periodClicks = link.totalClicks;
                let periodLabel = 'Total';

                switch (selectedPeriod) {
                    case 'today':
                        periodClicks = link.todayClicks || 0;
                        periodLabel = 'Today';
                        break;
                    case 'week':
                        periodClicks = link.weekClicks || 0;
                        periodLabel = 'This Week';
                        break;
                    case 'month':
                        periodClicks = link.monthClicks || 0;
                        periodLabel = 'This Month';
                        break;
                    default:
                        periodClicks = link.totalClicks || 0;
                        periodLabel = 'All Time';
                }

                return {
                    ...link,
                    periodClicks,
                    periodLabel,
                    displayTitle: truncateTitle(link.title || 'Untitled Link', 25),
                    icon: getLinkIcon(link.url, link.type)
                };
            })
            .filter(link => selectedPeriod === 'all' ? link.totalClicks > 0 : link.periodClicks > 0)
            .sort((a, b) => (b.periodClicks || 0) - (a.periodClicks || 0))
            .slice(0, 10); // Show top 10 links
    }, [analytics?.topLinks, selectedPeriod]);

    console.log("📊 Processed links:", processedLinks.length, "links for period:", selectedPeriod);

    // If no links with clicks
    if (!processedLinks.length) {
        return (
            <div className="mb-8">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">
                            {t('analytics.link_performance') || 'Link Performance'}
                        </h2>
                        {isConnected && (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                                <div className="animate-pulse bg-green-500 w-2 h-2 rounded-full"></div>
                                <span>{t('analytics.real_time_updates') || 'Real-time updates'}</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                        </div>
                        
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {selectedPeriod === 'all' ? 'No links with clicks yet' : `No clicks ${getPeriodDisplayName(selectedPeriod)}`}
                        </h3>
                        <p className="text-gray-600 mb-6">
                            {selectedPeriod === 'all' 
                                ? 'Share your profile to start getting clicks on your links!' 
                                : `Try selecting a different time period or share your profile more.`
                            }
                        </p>

                        {/* Show total available links */}
                        {analytics?.topLinks?.length > 0 && (
                            <div className="bg-blue-50 rounded-lg p-4 inline-block">
                                <p className="text-sm text-blue-700">
                                    <strong>{analytics.topLinks.length}</strong> links available • 
                                    <strong> {analytics.topLinks.reduce((sum, link) => sum + (link.totalClicks || 0), 0)}</strong> total clicks
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Prepare chart data
    const maxClicks = Math.max(...processedLinks.map(link => link.periodClicks));
    const totalPeriodClicks = processedLinks.reduce((sum, link) => sum + link.periodClicks, 0);

    // Chart colors
    const colors = [
        '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', 
        '#EF4444', '#EC4899', '#14B8A6', '#F97316',
        '#6366F1', '#84CC16'
    ];

    return (
        <div className="mb-8">
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {t('analytics.link_performance') || 'Link Performance'} 
                        <span className="text-sm font-normal text-gray-500 ml-2">
                            ({getPeriodDisplayName(selectedPeriod)})
                        </span>
                    </h2>
                    {isConnected && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                            <div className="animate-pulse bg-green-500 w-2 h-2 rounded-full"></div>
                            <span>{t('analytics.real_time_updates') || 'Real-time updates'}</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* Bar Chart Section */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-800 mb-4">
                            {t('analytics.clicks_by_link') || 'Clicks by Link'}
                        </h3>
                        <div className="space-y-4">
                            {processedLinks.map((link, index) => (
                                <div key={link.linkId} className="group">
                                    {/* Link Header */}
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            {/* Link Icon */}
                                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                                <Image 
                                                    src={link.icon}
                                                    alt={getLinkTypeString(link.type) || 'link'}
                                                    width={16}
                                                    height={16}
                                                    className="object-contain"
                                                />
                                            </div>
                                            
                                            {/* Link Info */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-gray-900 truncate">
                                                        {link.displayTitle}
                                                    </span>
                                                    {getLinkTypeBadge(link.type)}
                                                </div>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {link.url}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* Click Count */}
                                        <div className="text-right ml-4 flex-shrink-0">
                                            <span className="text-lg font-bold text-gray-900">
                                                {link.periodClicks.toLocaleString()}
                                            </span>
                                            <p className="text-xs text-gray-500">clicks</p>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                                        <div 
                                            className="h-full rounded-full transition-all duration-1000 ease-out"
                                            style={{ 
                                                backgroundColor: colors[index % colors.length],
                                                width: maxClicks > 0 ? `${(link.periodClicks / maxClicks) * 100}%` : '0%'
                                            }}
                                        ></div>
                                    </div>

                                    {/* Stats Row */}
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <div className="flex items-center gap-4">
                                            <span>{((link.periodClicks / totalPeriodClicks) * 100).toFixed(1)}% of total</span>
                                            {link.lastClicked && (
                                                <span>Last clicked: {formatDate(link.lastClicked)}</span>
                                            )}
                                        </div>
                                        <span className="capitalize">{getLinkTypeString(link.type) || 'Custom'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Performance Insights Section */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-800 mb-4">
                            {t('analytics.performance_insights') || 'Performance Insights'}
                        </h3>
                        
                        {/* Top Performers */}
                        <div className="space-y-4">
                            {processedLinks.slice(0, 5).map((link, index) => (
                                <div key={link.linkId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                    {/* Rank Badge */}
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                        index === 0 ? 'bg-yellow-500' :
                                        index === 1 ? 'bg-gray-400' :
                                        index === 2 ? 'bg-amber-600' :
                                        'bg-blue-500'
                                    }`}>
                                        {index === 0 ? '🥇' : 
                                         index === 1 ? '🥈' : 
                                         index === 2 ? '🥉' : 
                                         `#${index + 1}`}
                                    </div>

                                    {/* Link Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-900 truncate">
                                                {link.displayTitle}
                                            </span>
                                            <span className="text-sm font-bold text-gray-900 ml-2">
                                                {link.periodClicks}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                            <div 
                                                className="h-full rounded-full transition-all duration-1000"
                                                style={{ 
                                                    backgroundColor: colors[index % colors.length],
                                                    width: `${(link.periodClicks / totalPeriodClicks) * 100}%`
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Period Stats */}
                        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                            <h4 className="text-sm font-semibold text-blue-900 mb-3">
                                {getPeriodDisplayName(selectedPeriod)} Summary
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <p className="text-lg font-bold text-blue-700">
                                        {processedLinks.length}
                                    </p>
                                    <p className="text-xs text-blue-600">Active Links</p>
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-blue-700">
                                        {totalPeriodClicks.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-blue-600">Total Clicks</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Stats Footer */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">
                                {analytics.topLinks?.length || 0}
                            </p>
                            <p className="text-sm text-gray-600">Total Links</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">
                                {processedLinks.length}
                            </p>
                            <p className="text-sm text-gray-600">Active Links</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-purple-600">
                                {totalPeriodClicks.toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">{getPeriodDisplayName(selectedPeriod)} Clicks</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-orange-600">
                                {processedLinks.length > 0 ? Math.round(totalPeriodClicks / processedLinks.length) : 0}
                            </p>
                            <p className="text-sm text-gray-600">Avg per Link</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ✅ Helper Functions

function truncateTitle(title, maxLength) {
    if (!title) return 'Untitled Link';
    return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
}

function getLinkIcon(url, type) {
    if (!url) return 'https://linktree.sirv.com/Images/brands/link-svgrepo-com.svg';
    
    try {
        const urlObj = new URL(makeValidUrl(url));
        const hostname = urlObj.hostname.toLowerCase();
        
        // Check if we have a specific icon for this domain
        const icon = baseUrlIcons[hostname];
        if (icon) return icon;
        
        // Default link icon
        return 'https://linktree.sirv.com/Images/brands/link-svgrepo-com.svg';
    } catch (error) {
        return 'https://linktree.sirv.com/Images/brands/link-svgrepo-com.svg';
    }
}

// ✅ FIXED: Handle both string and number types
function getLinkTypeString(type) {
    // Handle both string and number types
    if (type === null || type === undefined) return 'custom';
    
    // If it's a number, convert to string based on your link type mapping
    if (typeof type === 'number') {
        const typeMap = {
            0: 'header',
            1: 'link', 
            2: 'social',
            3: 'video',
            4: 'music',
            5: 'file'
        };
        return typeMap[type] || 'custom';
    }
    
    // If it's already a string, return it
    if (typeof type === 'string') {
        return type.toLowerCase();
    }
    
    return 'custom';
}

// ✅ FIXED: Safe type badge function
function getLinkTypeBadge(type) {
    const typeString = getLinkTypeString(type);
    
    if (!typeString || typeString === 'custom' || typeString === 'link') {
        return null;
    }
    
    const colors = {
        'social': 'bg-purple-100 text-purple-800',
        'video': 'bg-red-100 text-red-800',
        'music': 'bg-green-100 text-green-800',
        'file': 'bg-blue-100 text-blue-800',
        'header': 'bg-gray-100 text-gray-800',
    };
    
    const colorClass = colors[typeString] || 'bg-gray-100 text-gray-800';
    
    return (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
            {typeString.charAt(0).toUpperCase() + typeString.slice(1)}
        </span>
    );
}

function getPeriodDisplayName(period) {
    const names = {
        today: 'Today',
        week: 'This Week',
        month: 'This Month',
        all: 'All Time'
    };
    return names[period] || 'All Time';
}

function formatDate(dateValue) {
    try {
        if (!dateValue) return 'N/A';
        
        // Handle different date formats
        if (dateValue instanceof Date) {
            return dateValue.toLocaleDateString();
        }
        
        if (typeof dateValue === 'string') {
            return new Date(dateValue).toLocaleDateString();
        }
        
        if (dateValue && typeof dateValue.toDate === 'function') {
            return dateValue.toDate().toLocaleDateString();
        }
        
        return 'N/A';
    } catch (error) {
        return 'N/A';
    }
}