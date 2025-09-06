// app/dashboard/(dashboard pages)/contacts/components/SubscriptionBanner.jsx
import React from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";

export default function SubscriptionBanner({ subscriptionStatus, onUpgradeClick }) {
    const { t } = useTranslation();

    if (!subscriptionStatus) return null;

    const { subscriptionLevel, canCreateAdvancedGroups, canUseEventDetection, canShareWithTeam } = subscriptionStatus;

    // Don't show banner for Business users (they have everything)
    if (subscriptionLevel === 'business') return null;

    // Show different banners based on subscription level
    const getBannerConfig = () => {
        switch (subscriptionLevel) {
            case 'pro':
                return {
                    type: 'upgrade',
                    title: '🚀 Unlock Advanced Contact Features',
                    description: 'Upgrade to Premium for location-based grouping, event detection, and team sharing.',
                    buttonText: 'Upgrade to Premium',
                    bgColor: 'bg-gradient-to-r from-purple-500 to-indigo-600',
                    features: [
                        '📍 Location-based smart groups',
                        '🎯 Automatic event detection', 
                        '👥 Team contact sharing',
                        '🗺️ Advanced map visualization'
                    ]
                };
            case 'premium':
                return {
                    type: 'business',
                    title: '💼 Get Business Features',
                    description: 'Upgrade to Business for higher API limits and priority support.',
                    buttonText: 'Upgrade to Business',
                    bgColor: 'bg-gradient-to-r from-indigo-500 to-purple-600',
                    features: [
                        '⚡ Higher API limits (20 vs 15)',
                        '💰 Larger cost budget ($0.20 vs $0.15)',
                        '🎯 Priority customer support',
                        '📊 Advanced analytics'
                    ]
                };
            default:
                return null;
        }
    };

    const bannerConfig = getBannerConfig();
    if (!bannerConfig) return null;

    return (
        <div className={`${bannerConfig.bgColor} rounded-xl p-4 mb-4 text-white shadow-lg`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{bannerConfig.title}</h3>
                    <p className="text-sm opacity-90 mb-3">{bannerConfig.description}</p>
                    
                    {/* Features grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {bannerConfig.features.map((feature, index) => (
                            <div key={index} className="flex items-center text-sm opacity-90">
                                <span className="mr-2">✨</span>
                                <span>{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 lg:flex-col">
                    <button
                        onClick={onUpgradeClick}
                        className="px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-md"
                    >
                        {bannerConfig.buttonText}
                    </button>
                    
                    {/* Current plan badge */}
                    <div className="flex items-center justify-center px-3 py-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <span className="text-sm font-medium">
                            Current: {subscriptionLevel.toUpperCase()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Feature limitation banner for specific features
export function FeatureLimitationBanner({ feature, subscriptionLevel, requiredLevel, onUpgradeClick }) {
    const { t } = useTranslation();

    const getFeatureConfig = () => {
        switch (feature) {
            case 'advanced_groups':
                return {
                    icon: '📍',
                    title: 'Location & Event Groups',
                    description: 'Create smart groups based on location proximity and event attendance'
                };
            case 'event_detection':
                return {
                    icon: '🎯',
                    title: 'Automatic Event Detection',
                    description: 'Automatically find events near your contacts and create event-based groups'
                };
            case 'team_sharing':
                return {
                    icon: '👥',
                    title: 'Team Contact Sharing',
                    description: 'Share contacts with team members and collaborate on contact management'
                };
            default:
                return null;
        }
    };

    const config = getFeatureConfig();
    if (!config) return null;

    return (
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
                <div className="text-2xl">{config.icon}</div>
                <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{config.title}</h4>
                    <p className="text-sm text-gray-600 mb-3">{config.description}</p>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">
                            Requires: <span className="font-semibold">{requiredLevel.toUpperCase()}</span>
                        </span>
                        <button
                            onClick={onUpgradeClick}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Upgrade Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Usage statistics banner showing current plan limits
export function UsageStatsBanner({ subscriptionStatus, contactStats, groupStats }) {
    const { t } = useTranslation();

    if (!subscriptionStatus || subscriptionStatus.subscriptionLevel === 'business') return null;

    const { subscriptionLevel, groupOptions } = subscriptionStatus;
    const maxGroups = groupOptions?.maxGroups || 0;
    const currentGroups = groupStats?.total || 0;
    const maxApiCalls = groupOptions?.maxApiCalls || 0;
    const costBudget = groupOptions?.costBudget || 0;

    const usagePercentage = maxGroups > 0 ? Math.round((currentGroups / maxGroups) * 100) : 0;
    const isNearLimit = usagePercentage >= 80;

    return (
        <div className={`rounded-lg p-4 mb-4 border ${
            isNearLimit 
                ? 'bg-orange-50 border-orange-200' 
                : 'bg-gray-50 border-gray-200'
        }`}>
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">
                    📊 {subscriptionLevel.toUpperCase()} Plan Usage
                </h4>
                {isNearLimit && (
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                        Near Limit
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Groups Usage */}
                <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Groups</span>
                        <span className="text-xs text-gray-500">{currentGroups}/{maxGroups}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                            className={`h-2 rounded-full ${
                                isNearLimit ? 'bg-orange-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                        ></div>
                    </div>
                </div>

                {/* API Calls Allowance */}
                <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">API Calls</span>
                        <span className="text-xs text-gray-500">
                            {maxApiCalls > 0 ? `${maxApiCalls}/session` : 'None'}
                        </span>
                    </div>
                    <div className="text-xs text-gray-600">
                        {maxApiCalls > 0 ? 'For location & event detection' : 'Upgrade for API features'}
                    </div>
                </div>

                {/* Cost Budget */}
                <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Cost Budget</span>
                        <span className="text-xs text-gray-500">
                            ${costBudget.toFixed(2)}/session
                        </span>
                    </div>
                    <div className="text-xs text-gray-600">
                        {costBudget > 0 ? 'Per auto-grouping session' : 'Upgrade for paid features'}
                    </div>
                </div>
            </div>

            {/* Plan-specific tips */}
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">💡</span>
                    <div>
                        <p className="text-sm text-blue-800 font-medium mb-1">
                            {subscriptionLevel === 'pro' ? 'Pro Plan Tips' : 'Premium Plan Tips'}
                        </p>
                        <p className="text-xs text-blue-700">
                            {subscriptionLevel === 'pro' 
                                ? 'You can create unlimited company and time-based groups for free. Upgrade to Premium for location and event detection.'
                                : 'You have access to all grouping features with API limits. Upgrade to Business for higher limits and priority support.'
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}