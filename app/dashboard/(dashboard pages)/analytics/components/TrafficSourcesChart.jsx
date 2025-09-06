// app/dashboard/(dashboard pages)/analytics/components/TrafficSourcesChart.jsx - FIXED
"use client"
import { useTranslation } from "@/lib/translation/useTranslation";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useState } from 'react';

export default function TrafficSourcesChart({ analytics }) {
    const { t } = useTranslation();
    const [showInfoModal, setShowInfoModal] = useState(false);

    // ✅ IMPROVED: Better debugging and guard clauses
    console.log('🚦 TrafficSourcesChart received analytics:', {
        hasAnalytics: !!analytics,
        hasTrafficSources: !!analytics?.trafficSources,
        trafficSourcesKeys: analytics?.trafficSources ? Object.keys(analytics.trafficSources) : [],
        trafficSourcesData: analytics?.trafficSources
    });

    // Guard clause if analytics data is not yet available
    if (!analytics) {
        console.log('🚦 No analytics data provided');
        return (
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-gray-900">
                            {t('analytics.traffic_sources') || 'Traffic Sources'}
                        </h2>
                        <InfoIcon onClick={() => setShowInfoModal(true)} />
                    </div>
                </div>
                <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                    Loading traffic sources...
                </div>
                {showInfoModal && (
                    <InfoModal onClose={() => setShowInfoModal(false)} />
                )}
            </div>
        );
    }

    // ✅ FIXED: More lenient check for traffic sources
    const trafficSources = analytics.trafficSources || {};
    const hasTrafficSources = Object.keys(trafficSources).length > 0;

    console.log('🚦 Traffic sources processing:', {
        trafficSources,
        hasTrafficSources,
        sourceCount: Object.keys(trafficSources).length
    });

    if (!hasTrafficSources) {
        console.log('🚦 No traffic sources found in analytics data');
        return (
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-gray-900">
                            {t('analytics.traffic_sources') || 'Traffic Sources'}
                        </h2>
                        <InfoIcon onClick={() => setShowInfoModal(true)} />
                    </div>
                </div>
                <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                    <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 opacity-50 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-sm">{t('analytics.no_traffic_data') || 'No traffic source data available yet.'}</p>
                        <p className="text-xs mt-1">Share your profile link to start tracking traffic sources!</p>
                    </div>
                </div>
                {showInfoModal && (
                    <InfoModal onClose={() => setShowInfoModal(false)} />
                )}
            </div>
        );
    }

    // Process traffic sources data
    const trafficData = Object.entries(trafficSources)
        .map(([source, data]) => {
            console.log(`🚦 Processing source: ${source}`, data);
            return {
                name: getSourceDisplayName(source),
                clicks: data?.clicks || 0,
                views: data?.views || 0,
                medium: data?.medium || 'unknown',
                source: source,
                lastClick: data?.lastClick || null,
                lastView: data?.lastView || null
            };
        })
        .filter(item => item.clicks > 0 || item.views > 0) // Only show sources with activity
        .sort((a, b) => (b.clicks + b.views) - (a.clicks + a.views));

    console.log('🚦 Processed traffic data:', trafficData);

    // Final check if we have any meaningful data
    if (trafficData.length === 0) {
        console.log('🚦 No meaningful traffic data after processing');
        return (
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-gray-900">
                            {t('analytics.traffic_sources') || 'Traffic Sources'}
                        </h2>
                        <InfoIcon onClick={() => setShowInfoModal(true)} />
                    </div>
                </div>
                <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                    <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 opacity-50 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-sm">Traffic sources found but no activity recorded yet.</p>
                        <p className="text-xs mt-1">Keep sharing your profile to generate traffic data!</p>
                    </div>
                </div>
                {showInfoModal && (
                    <InfoModal onClose={() => setShowInfoModal(false)} />
                )}
            </div>
        );
    }

    // Colors for different traffic sources
    const getSourceColor = (source, medium) => {
        if (medium === 'social') {
            switch (source) {
                case 'instagram': return '#E1306C';
                case 'tiktok': return '#000000';
                case 'twitter': return '#1DA1F2';
                case 'facebook': return '#4267B2';
                case 'linkedin': return '#0077B5';
                case 'youtube': return '#FF0000';
                case 'snapchat': return '#FFFC00';
                case 'discord': return '#5865F2';
                case 'reddit': return '#FF4500';
                case 'pinterest': return '#BD081C';
                default: return '#8B5CF6';
            }
        } else if (medium === 'search') {
            switch (source) {
                case 'google': return '#4285F4';
                case 'bing': return '#0078D4';
                case 'yahoo': return '#720E9E';
                case 'duckduckgo': return '#DE5833';
                default: return '#10B981';
            }
        } else if (medium === 'direct') {
            return '#6B7280';
        } else if (medium === 'email') {
            return '#F59E0B';
        } else if (medium === 'referral') {
            return '#EC4899';
        } else {
            return '#3B82F6';
        }
    };

    const COLORS = trafficData.map(item => getSourceColor(item.source, item.medium));

    return (
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {t('analytics.traffic_sources') || 'Traffic Sources'}
                    </h2>
                    <InfoIcon onClick={() => setShowInfoModal(true)} />
                </div>
                <div className="text-sm text-gray-500">
                    {trafficData.length} source{trafficData.length !== 1 ? 's' : ''}
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div>
                    <h3 className="text-lg font-medium text-gray-800 mb-4">
                        {t('analytics.source_distribution') || 'Source Distribution'}
                    </h3>
                    <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={trafficData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => percent > 5 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="views"
                                >
                                    {trafficData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value, name) => [value, name === 'clicks' ? 'Clicks' : 'Views']} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Bar Chart */}
                <div>
                    <h3 className="text-lg font-medium text-gray-800 mb-4">
                        {t('analytics.activity_by_source') || 'Activity by Source'}
                    </h3>
                    <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                            <BarChart data={trafficData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fontSize: 12 }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="views" fill="#3B82F6" name="Views" />
                                <Bar dataKey="clicks" fill="#8B5CF6" name="Clicks" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Traffic Sources Table */}
            <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">
                    {t('analytics.detailed_breakdown') || 'Detailed Breakdown'}
                </h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('analytics.source') || 'Source'}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('analytics.medium') || 'Medium'}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('analytics.views') || 'Views'}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('analytics.clicks') || 'Clicks'}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('analytics.conversion_rate') || 'CTR'}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('analytics.last_activity') || 'Last Activity'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {trafficData.map((source, index) => (
                                <tr key={source.source} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div 
                                                className="w-3 h-3 rounded-full mr-3"
                                                style={{ backgroundColor: COLORS[index] }}
                                            ></div>
                                            <span className="text-sm font-medium text-gray-900 capitalize">
                                                {getSourceIcon(source.source)} {source.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getMediumBadgeClass(source.medium)}`}>
                                            {source.medium}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                        {source.views}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                        {source.clicks}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {source.views > 0 ? ((source.clicks / source.views) * 100).toFixed(1) : 0}%
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {source.lastView ? formatDate(source.lastView) : 'N/A'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info Modal */}
            {showInfoModal && (
                <InfoModal onClose={() => setShowInfoModal(false)} />
            )}
        </div>
    );
}

// ✅ Info Icon Component
const InfoIcon = ({ onClick }) => {
    const { t } = useTranslation();
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-200 flex items-center justify-center text-xs font-bold cursor-pointer"
                title={t('analytics.info.click_for_more') || 'Click for more info'}
            >
                i
            </button>
            
            {/* Hover Tooltip */}
            {isHovered && (
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {t('analytics.info.click_for_more') || 'Click for more info'}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
                </div>
            )}
        </div>
    );
};

// ✅ Info Modal Component (keeping the same as before)
const InfoModal = ({ onClose }) => {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-900">
                        {t('analytics.info.traffic_sources_explained') || 'How Traffic Sources Work'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-600 text-sm leading-relaxed">
                        Traffic sources help you understand where your visitors come from. This data shows you which platforms drive the most engagement to your profile.
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
                    >
                        {t('common.close') || 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper function to safely format dates
function formatDate(dateValue) {
    try {
        if (!dateValue) return 'N/A';
        
        // If it's already a Date object
        if (dateValue instanceof Date) {
            return dateValue.toLocaleDateString();
        }
        
        // If it's a Firestore Timestamp with toDate() method
        if (dateValue && typeof dateValue.toDate === 'function') {
            return dateValue.toDate().toLocaleDateString();
        }
        
        // If it's a string date
        if (typeof dateValue === 'string') {
            return new Date(dateValue).toLocaleDateString();
        }
        
        // If it's a number (timestamp)
        if (typeof dateValue === 'number') {
            return new Date(dateValue).toLocaleDateString();
        }
        
        // Fallback
        return 'N/A';
    } catch (error) {
        console.error('Error formatting date:', error, dateValue);
        return 'N/A';
    }
}

// Helper functions
function getSourceDisplayName(source) {
    const displayNames = {
        'instagram': 'Instagram',
        'tiktok': 'TikTok',
        'twitter': 'Twitter',
        'facebook': 'Facebook',
        'linkedin': 'LinkedIn',
        'youtube': 'YouTube',
        'snapchat': 'Snapchat',
        'discord': 'Discord',
        'reddit': 'Reddit',
        'pinterest': 'Pinterest',
        'google': 'Google',
        'bing': 'Bing',
        'yahoo': 'Yahoo',
        'duckduckgo': 'DuckDuckGo',
        'direct': 'Direct',
        'email': 'Email',
        'localhost': 'Local Development',
        'unknown': 'Unknown'
    };
    return displayNames[source] || source.charAt(0).toUpperCase() + source.slice(1);
}

function getSourceIcon(source) {
    const icons = {
        'instagram': '📸',
        'tiktok': '🎵',
        'twitter': '🐦',
        'facebook': '👤',
        'linkedin': '💼',
        'youtube': '📺',
        'snapchat': '👻',
        'discord': '🎮',
        'reddit': '🤖',
        'pinterest': '📌',
        'google': '🔍',
        'bing': '🔍',
        'yahoo': '🔍',
        'duckduckgo': '🔍',
        'direct': '🔗',
        'email': '📧',
        'localhost': '🏠',
        'unknown': '❓'
    };
    return icons[source] || '🌐';
}

function getMediumBadgeClass(medium) {
    switch (medium) {
        case 'social':
            return 'bg-purple-100 text-purple-800';
        case 'search':
            return 'bg-green-100 text-green-800';
        case 'direct':
            return 'bg-gray-100 text-gray-800';
        case 'email':
            return 'bg-yellow-100 text-yellow-800';
        case 'referral':
            return 'bg-pink-100 text-pink-800';
        default:
            return 'bg-blue-100 text-blue-800';
    }
}