// app/dashboard/(dashboard pages)/analytics/components/TopClickedLinks.jsx
"use client"
import Image from "next/image";
import { useTranslation } from "@/lib/translation/useTranslation";
import { baseUrlIcons } from "@/lib/BrandLinks";
import { makeValidUrl } from "@/lib/utilities";

export default function TopClickedLinks({ analytics, isConnected }) {
    const { t } = useTranslation();

    if (!analytics?.topLinks?.length) {
        return null;
    }

    // Function to get the root domain from URL (same as in IconDiv.jsx)
  // Before
// After
function getRootNameFromUrl(url) {
    // 1. First, make sure we have a potentially valid URL string
    const potentiallyValidUrl = makeValidUrl(url);

    // 2. If the result is empty or invalid, return a default immediately
    if (!potentiallyValidUrl) {
        return 'default'; // Return a default name to prevent crashing
    }

    try {
        // 3. Now it's safer to try constructing the URL
        const urlObj = new URL(potentiallyValidUrl);
        const rootName = urlObj.hostname;
        return rootName;
    } catch (error) {
        // This will now only catch truly malformed URLs, not empty strings
        console.error("Could not parse URL:", potentiallyValidUrl, error.message);
        return 'default'; // Return a default on failure
    }
}

    // Function to get icon URL from base URL (same as in IconDiv.jsx)
    function getIconUrlFromBaseUrl(baseUrl) {
        return baseUrlIcons[baseUrl.toLowerCase()] || 'https://linktree.sirv.com/Images/brands/link-svgrepo-com.svg';
    }

    // Get link icon using the same logic as the public profile
    const getLinkIcon = (url) => {
        if (!url) return 'https://linktree.sirv.com/Images/brands/link-svgrepo-com.svg';
        const rootName = getRootNameFromUrl(url);
        return getIconUrlFromBaseUrl(rootName);
    };

    // Get link type color
    const getLinkTypeColor = (type) => {
        switch (type?.toLowerCase()) {
            case 'instagram':
                return 'bg-gradient-to-r from-purple-500 to-pink-500';
            case 'twitter':
                return 'bg-blue-400';
            case 'tiktok':
                return 'bg-black';
            case 'youtube':
                return 'bg-red-500';
            case 'spotify':
                return 'bg-green-500';
            case 'social':
                return 'bg-purple-500';
            case 'video':
                return 'bg-red-400';
            case 'music':
                return 'bg-indigo-500';
            default:
                return 'bg-gray-500';
        }
    };

    return (
        <div className="mb-8">
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-20">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {t('analytics.top_clicked_links') || 'Top Clicked Links'}
                    </h2>
                    {isConnected && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                            <div className="animate-pulse bg-green-500 w-2 h-2 rounded-full"></div>
                            <span>{t('analytics.real_time_updates') || 'Real-time updates'}</span>
                        </div>
                    )}
                </div>
                
                <div className="space-y-4">
                    {analytics.topLinks.map((link, index) => (
                        <div key={link.linkId} className="group flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:shadow-md">
                            <div className="flex items-center space-x-4 flex-1 min-w-0">
                                {/* Rank Badge */}
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
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

                                {/* Link Icon - Using the same system as public profile */}
                                <div className="flex-shrink-0 h-10 w-10 rounded-lg p-1 bg-white border">
                                    <Image 
                                        src={getLinkIcon(link.url)}
                                        alt={link.type || 'link'}
                                        width={32}
                                        height={32}
                                        className="object-fit h-full w-full"
                                    />
                                </div>

                                {/* Link Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-medium text-gray-900 truncate">
                                            {link.title || t('analytics.untitled_link') || 'Untitled Link'}
                                        </p>
                                        {link.type && (
                                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full text-white ${getLinkTypeColor(link.type)}`}>
                                                {link.type}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 truncate">
                                        {link.url}
                                    </p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                        <span>
                                            {t('analytics.created')}: {new Date(link.createdAt).toLocaleDateString()}
                                        </span>
                                        {link.lastClicked && (
                                            <span>
                                                {t('analytics.last_clicked')}: {new Date(link.lastClicked).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Click Statistics */}
                            <div className="flex items-center space-x-6 text-right">
                                <div className="hidden sm:block">
                                    <p className="text-sm text-gray-500">
                                        {t('analytics.today')}
                                    </p>
                                    <p className="text-lg font-semibold text-blue-600">
                                        {link.todayClicks || 0}
                                    </p>
                                </div>
                                <div className="hidden md:block">
                                    <p className="text-sm text-gray-500">
                                        {t('analytics.this_week')}
                                    </p>
                                    <p className="text-lg font-semibold text-indigo-600">
                                        {link.weekClicks || 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">
                                        {t('analytics.total')}
                                    </p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {link.totalClicks || 0}
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center space-x-2 ml-4">
                                <button
                                    onClick={() => window.open(link.url, '_blank')}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                                    title={t('analytics.visit_link') || 'Visit Link'}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </button>
                                <button
                                    onClick={(event) => {
                                        navigator.clipboard.writeText(link.url);
                                        // Optional: Show a brief success message
                                        const button = event.currentTarget;
                                        const originalTitle = button.title;
                                        button.title = t('analytics.copied', 'Copied!');
                                        setTimeout(() => {
                                            button.title = originalTitle;
                                        }, 1000);
                                    }}
                                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                                    title={t('analytics.copy_link') || 'Copy Link'}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Show More Button */}
                {analytics.topLinks.length > 5 && (
                    <div className="mt-6 text-center">
                        <button className="px-6 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200 font-medium">
                            {t('analytics.show_all_links') || 'Show All Links'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}