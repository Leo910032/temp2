// app/admin/components/ApiUsageStats.jsx
// Display AI and API usage statistics from the analytics service
"use client"
import { getCostStatus, ADMIN_COST_THRESHOLDS, AI_PROVIDER_PRICING, THIRD_PARTY_API_PRICING } from '@/lib/services/serviceAdmin/constants/adminConstants';

export default function ApiUsageStats({ apiUsage }) {
    if (!apiUsage) return null;

    const formatCurrency = (amount) => `$${(amount || 0).toFixed(4)}`;
    const formatNumber = (num) => (num || 0).toLocaleString();
    const formatPercentage = (num) => `${(num || 0).toFixed(2)}%`;

    const { ai, api, combined, month } = apiUsage;

    // Debug: Log the data structure
    console.log('[ApiUsageStats] apiUsage data:', {
        hasAi: !!ai,
        hasApi: !!api,
        aiTopProviders: ai?.topProviders?.length || 0,
        apiTopProviders: api?.topProviders?.length || 0,
        aiProviderNames: ai?.topProviders?.map(p => p.name) || [],
        apiProviderNames: api?.topProviders?.map(p => p.name) || []
    });

    // Get cost status using centralized thresholds
    const costStatus = getCostStatus(combined.totalCost, 'PLATFORM');

    // Calculate free tier costs and percentages
    const calculateFreeTierData = () => {
        const freeTierData = [];
        let totalFreeTierSavings = 0;

        // Process AI providers
        if (ai?.topProviders) {
            ai.topProviders.forEach(provider => {
                // First try to match by provider name directly (it's the key)
                let providerKey = provider.name;

                // If not found, try to match by display name (fallback)
                if (!AI_PROVIDER_PRICING[providerKey]) {
                    providerKey = Object.keys(AI_PROVIDER_PRICING).find(
                        key => AI_PROVIDER_PRICING[key].displayName === provider.name
                    );
                }

                if (providerKey && AI_PROVIDER_PRICING[providerKey]?.freeTier?.enabled) {
                    const freeTier = AI_PROVIDER_PRICING[providerKey].freeTier;
                    const providerCost = provider.cost || 0;

                    // Calculate how much of the free tier is used (based on cost as proxy)
                    const freeTierValue = freeTier.limit * (AI_PROVIDER_PRICING[providerKey].estimatedCostPerOperation || 0);
                    const percentUsed = Math.min(100, (providerCost / freeTierValue) * 100);
                    const percentRemaining = Math.max(0, 100 - percentUsed);

                    // Calculate savings (amount that would have been paid without free tier)
                    const savings = Math.min(providerCost, freeTierValue);
                    totalFreeTierSavings += savings;

                    freeTierData.push({
                        name: AI_PROVIDER_PRICING[providerKey].displayName,
                        type: 'AI',
                        percentRemaining,
                        percentUsed,
                        freeTierLimit: `${freeTier.limit} ${freeTier.unit}`,
                        currentUsage: formatNumber(provider.apiCalls),
                        description: freeTier.description
                    });
                }
            });
        }

        // Process Third-Party API features (not providers!)
        // For services like Google Maps that have multiple APIs with different pricing,
        // we need to check individual features (endpoints) not the generic provider name
        if (api?.topFeatures) {
            console.log('[ApiUsageStats] Processing API features for free tier:', api.topFeatures.map(f => f.name));

            api.topFeatures.forEach(feature => {
                // Try to match by feature name directly (it's the key in pricing config)
                let featureKey = feature.name;

                console.log(`[ApiUsageStats] Checking feature: ${feature.name}`);

                // If not found, try to match by display name (fallback)
                if (!THIRD_PARTY_API_PRICING[featureKey]) {
                    console.log(`[ApiUsageStats] Feature ${featureKey} not found in THIRD_PARTY_API_PRICING, trying displayName match...`);
                    featureKey = Object.keys(THIRD_PARTY_API_PRICING).find(
                        key => THIRD_PARTY_API_PRICING[key].displayName === feature.name
                    );
                    console.log(`[ApiUsageStats] DisplayName match result: ${featureKey}`);
                }

                if (featureKey && THIRD_PARTY_API_PRICING[featureKey]?.freeTier?.enabled) {
                    console.log(`[ApiUsageStats] Found free tier for ${featureKey}`);
                    const freeTier = THIRD_PARTY_API_PRICING[featureKey].freeTier;
                    const featureCost = feature.cost || 0;

                    // For USD/month free tier, use direct cost comparison
                    if (freeTier.unit === 'USD/month') {
                        const freeTierValue = freeTier.limit;
                        const percentUsed = Math.min(100, (featureCost / freeTierValue) * 100);
                        const percentRemaining = Math.max(0, 100 - percentUsed);

                        // Calculate savings
                        const savings = Math.min(featureCost, freeTierValue);
                        totalFreeTierSavings += savings;

                        freeTierData.push({
                            name: THIRD_PARTY_API_PRICING[featureKey].displayName,
                            type: 'API',
                            percentRemaining,
                            percentUsed,
                            freeTierLimit: `$${freeTier.limit} ${freeTier.unit}`,
                            currentUsage: formatCurrency(featureCost),
                            description: freeTier.description
                        });
                    } else if (freeTier.unit === 'units/month') {
                        // For units/month, compare actual unit count (API calls)
                        const unitsUsed = feature.apiCalls || 0;
                        const freeUnitsLimit = freeTier.limit;
                        const costPerUnit = THIRD_PARTY_API_PRICING[featureKey].costPerRequest || 0;

                        // Calculate percentage based on units, not cost
                        const percentUsed = Math.min(100, (unitsUsed / freeUnitsLimit) * 100);
                        const percentRemaining = Math.max(0, 100 - percentUsed);

                        // Calculate savings: if within free tier, save ALL cost; otherwise save cost of free units
                        let savings = 0;
                        if (unitsUsed <= freeUnitsLimit) {
                            // Fully within free tier - all usage is free!
                            savings = featureCost;
                        } else {
                            // Exceeded free tier - only free units portion is saved
                            savings = freeUnitsLimit * costPerUnit;
                        }
                        totalFreeTierSavings += savings;

                        freeTierData.push({
                            name: THIRD_PARTY_API_PRICING[featureKey].displayName,
                            type: 'API',
                            percentRemaining,
                            percentUsed,
                            freeTierLimit: `${freeTier.limit} ${freeTier.unit}`,
                            currentUsage: formatNumber(unitsUsed),
                            description: freeTier.description
                        });
                    }
                }
            });
        }

        // Also process Third-Party API providers (for single-provider APIs like google_vision_ocr)
        // This handles cases where the provider itself has free tier, not individual features
        if (api?.topProviders) {
            console.log('[ApiUsageStats] Processing API providers for free tier:', api.topProviders.map(p => p.name));

            api.topProviders.forEach(provider => {
                // Try to match by provider name directly
                let providerKey = provider.name;

                console.log(`[ApiUsageStats] Checking provider: ${provider.name}`);

                // If not found, try to match by display name (fallback)
                if (!THIRD_PARTY_API_PRICING[providerKey]) {
                    console.log(`[ApiUsageStats] Provider ${providerKey} not found in THIRD_PARTY_API_PRICING, trying displayName match...`);
                    providerKey = Object.keys(THIRD_PARTY_API_PRICING).find(
                        key => THIRD_PARTY_API_PRICING[key].displayName === provider.name
                    );
                    console.log(`[ApiUsageStats] DisplayName match result: ${providerKey}`);
                }

                if (providerKey && THIRD_PARTY_API_PRICING[providerKey]?.freeTier?.enabled) {
                    console.log(`[ApiUsageStats] Found free tier for provider ${providerKey}`);
                    const freeTier = THIRD_PARTY_API_PRICING[providerKey].freeTier;
                    const providerCost = provider.cost || 0;

                    // For units/month free tier (like Google Vision 1000 units/month)
                    if (freeTier.unit === 'units/month') {
                        const unitsUsed = provider.apiCalls || 0;
                        const freeUnitsLimit = freeTier.limit;
                        const costPerUnit = THIRD_PARTY_API_PRICING[providerKey].costPerRequest || 0;

                        // Calculate percentage based on units
                        const percentUsed = Math.min(100, (unitsUsed / freeUnitsLimit) * 100);
                        const percentRemaining = Math.max(0, 100 - percentUsed);

                        // Calculate savings: if within free tier, save ALL cost
                        let savings = 0;
                        if (unitsUsed <= freeUnitsLimit) {
                            savings = providerCost; // All usage is free!
                        } else {
                            savings = freeUnitsLimit * costPerUnit; // Only free portion
                        }
                        totalFreeTierSavings += savings;

                        freeTierData.push({
                            name: THIRD_PARTY_API_PRICING[providerKey].displayName,
                            type: 'API',
                            percentRemaining,
                            percentUsed,
                            freeTierLimit: `${freeTier.limit} ${freeTier.unit}`,
                            currentUsage: formatNumber(unitsUsed),
                            description: freeTier.description
                        });
                    }
                    // For USD/month or requests/day, handle similarly
                    else if (freeTier.unit === 'USD/month') {
                        const freeTierValue = freeTier.limit;
                        const percentUsed = Math.min(100, (providerCost / freeTierValue) * 100);
                        const percentRemaining = Math.max(0, 100 - percentUsed);

                        const savings = Math.min(providerCost, freeTierValue);
                        totalFreeTierSavings += savings;

                        freeTierData.push({
                            name: THIRD_PARTY_API_PRICING[providerKey].displayName,
                            type: 'API',
                            percentRemaining,
                            percentUsed,
                            freeTierLimit: `$${freeTier.limit} ${freeTier.unit}`,
                            currentUsage: formatCurrency(providerCost),
                            description: freeTier.description
                        });
                    }
                }
            });
        }

        const costWithFreeTier = combined.totalCost - totalFreeTierSavings;

        return {
            freeTierData,
            totalFreeTierSavings,
            costWithFreeTier: Math.max(0, costWithFreeTier)
        };
    };

    const { freeTierData, totalFreeTierSavings, costWithFreeTier } = calculateFreeTierData();

    // Debug: Log free tier data
    console.log('[ApiUsageStats] Free tier data calculated:', {
        freeTierDataCount: freeTierData.length,
        totalSavings: totalFreeTierSavings,
        costWithFreeTier,
        freeTierData
    });

    // Helper to render usage type card
    const renderUsageCard = (usageData, title, icon, color) => {
        if (!usageData) return null;

        return (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <span className="mr-2">{icon}</span>
                    {title}
                </h4>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className={`text-center p-4 bg-${color}-50 border border-${color}-200 rounded-lg`}>
                        <div className="text-2xl font-bold text-red-600">{formatCurrency(usageData.totalCost)}</div>
                        <div className="text-sm text-gray-600">Total Cost</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{formatNumber(usageData.totalApiCalls)}</div>
                        <div className="text-sm text-gray-600">API Calls</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{formatNumber(usageData.totalRuns)}</div>
                        <div className="text-sm text-gray-600">Operations</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{formatNumber(usageData.userCount)}</div>
                        <div className="text-sm text-gray-600">Active Users</div>
                    </div>
                </div>

                {/* Efficiency Metrics */}
                {(usageData.efficiency || usageData.costPerApiCall || usageData.costPerRun) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {usageData.efficiency !== undefined && (
                            <div className="text-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="text-lg font-bold text-gray-700">{formatPercentage(usageData.efficiency * 100)}</div>
                                <div className="text-xs text-gray-600">Efficiency Rate</div>
                                <div className="text-xs text-gray-500 mt-1">Runs / API Calls</div>
                            </div>
                        )}
                        {usageData.costPerApiCall !== undefined && (
                            <div className="text-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="text-lg font-bold text-gray-700">{formatCurrency(usageData.costPerApiCall)}</div>
                                <div className="text-xs text-gray-600">Cost per API Call</div>
                            </div>
                        )}
                        {usageData.costPerRun !== undefined && (
                            <div className="text-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="text-lg font-bold text-gray-700">{formatCurrency(usageData.costPerRun)}</div>
                                <div className="text-xs text-gray-600">Cost per Operation</div>
                            </div>
                        )}
                    </div>
                )}

                {/* Top Features */}
                {usageData.topFeatures && usageData.topFeatures.length > 0 && (
                    <div className="mb-6">
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Top Features by Cost</h5>
                        <div className="space-y-2">
                            {usageData.topFeatures.map((feature, index) => (
                                <div key={feature.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                            index === 0 ? 'bg-yellow-400 text-gray-900' :
                                            index === 1 ? 'bg-gray-300 text-gray-700' :
                                            index === 2 ? 'bg-orange-400 text-gray-900' :
                                            'bg-blue-200 text-gray-700'
                                        }`}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900">{feature.name}</div>
                                            <div className="text-xs text-gray-600">
                                                {formatNumber(feature.apiCalls)} calls · {formatNumber(feature.billableRuns)} billable runs
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-red-600">{formatCurrency(feature.cost)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Top Providers */}
                {usageData.topProviders && usageData.topProviders.length > 0 && (
                    <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Top Providers by Cost</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {usageData.topProviders.map((provider, index) => (
                                <div key={provider.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <div className="font-medium text-gray-900">{provider.name}</div>
                                        <div className="text-xs text-gray-600">
                                            {formatNumber(provider.apiCalls)} calls
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-red-600">{formatCurrency(provider.cost)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div>
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow p-6 mb-6 text-white">
                <h3 className="text-2xl font-bold mb-2">🌐 Platform API Usage (Last 30 Days)</h3>
                <p className="text-blue-100 text-sm">Month: {month}</p>
            </div>

            {/* Combined Totals - Hero Section */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <span className="mr-2">📊</span>
                    All APIs Combined Totals
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg">
                        <div className="text-3xl font-bold text-red-600">{formatCurrency(combined.totalCost)}</div>
                        <div className="text-sm text-gray-600">Total Platform Cost</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg">
                        <div className="text-3xl font-bold text-emerald-600">{formatCurrency(costWithFreeTier)}</div>
                        <div className="text-sm text-gray-600">Cost with Free Tier</div>
                        <div className="text-xs text-emerald-700 mt-1">Saves {formatCurrency(totalFreeTierSavings)}</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
                        <div className="text-3xl font-bold text-blue-600">{formatNumber(combined.totalApiCalls)}</div>
                        <div className="text-sm text-gray-600">Total API Calls</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg">
                        <div className="text-3xl font-bold text-green-600">{formatNumber(combined.totalOperations)}</div>
                        <div className="text-sm text-gray-600">Total Operations</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg">
                        <div className="text-3xl font-bold text-purple-600">{formatCurrency(combined.averageCostPerOperation)}</div>
                        <div className="text-sm text-gray-600">Avg Cost/Operation</div>
                    </div>
                </div>

                {/* Status Indicator - Using centralized thresholds */}
                <div className={`mt-4 p-4 rounded-lg border flex items-center justify-between ${
                    costStatus.level === 'none' ? 'border-green-200 bg-green-50 text-green-800' :
                    costStatus.level === 'low' ? 'border-blue-200 bg-blue-50 text-blue-800' :
                    costStatus.level === 'medium' ? 'border-yellow-200 bg-yellow-50 text-yellow-800' :
                    costStatus.level === 'high' ? 'border-orange-200 bg-orange-50 text-orange-800' :
                    'border-red-200 bg-red-50 text-red-800'
                }`}>
                    <div className="flex items-center">
                        <span className="text-lg mr-2">{costStatus.icon}</span>
                        <div>
                            <div className="font-medium">{costStatus.message}</div>
                            <div className="text-xs mt-1 opacity-75">
                                Current: {formatCurrency(combined.totalCost)} |
                                Thresholds: Low &lt; ${ADMIN_COST_THRESHOLDS.PLATFORM.LOW} |
                                Medium &lt; ${ADMIN_COST_THRESHOLDS.PLATFORM.MEDIUM} |
                                High &lt; ${ADMIN_COST_THRESHOLDS.PLATFORM.HIGH}
                            </div>
                        </div>
                    </div>
                    {costStatus.level !== 'none' && costStatus.level !== 'low' && (
                        <div className="text-xs font-medium px-3 py-1 rounded-full bg-white bg-opacity-50">
                            {costStatus.level.toUpperCase()}
                        </div>
                    )}
                </div>

                {/* Free Tier Usage Table */}
                {freeTierData.length > 0 && (
                    <div className="mt-6">
                        <h5 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                            <span className="mr-2">🎁</span>
                            Free Tier Usage Status
                        </h5>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Free Tier Limit</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Usage</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {freeTierData.map((item, index) => {
                                        const statusColor =
                                            item.percentRemaining > 75 ? 'text-green-600 bg-green-50 border-green-200' :
                                            item.percentRemaining > 50 ? 'text-blue-600 bg-blue-50 border-blue-200' :
                                            item.percentRemaining > 25 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                                            item.percentRemaining > 10 ? 'text-orange-600 bg-orange-50 border-orange-200' :
                                            'text-red-600 bg-red-50 border-red-200';

                                        return (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                                        item.type === 'AI' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'
                                                    }`}>
                                                        {item.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{item.freeTierLimit}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{item.currentUsage}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                                                            <div
                                                                className={`h-2 rounded-full ${
                                                                    item.percentRemaining > 75 ? 'bg-green-500' :
                                                                    item.percentRemaining > 50 ? 'bg-blue-500' :
                                                                    item.percentRemaining > 25 ? 'bg-yellow-500' :
                                                                    item.percentRemaining > 10 ? 'bg-orange-500' :
                                                                    'bg-red-500'
                                                                }`}
                                                                style={{ width: `${item.percentRemaining}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-700">{formatPercentage(item.percentRemaining)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColor}`}>
                                                        {item.percentRemaining > 75 ? '✅ Excellent' :
                                                         item.percentRemaining > 50 ? '👍 Good' :
                                                         item.percentRemaining > 25 ? '⚠️ Monitor' :
                                                         item.percentRemaining > 10 ? '🔶 Low' :
                                                         '🔴 Critical'}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 text-xs text-gray-500 italic">
                            💡 Free tier percentages show remaining allocation. Lower percentages indicate approaching paid usage.
                        </div>
                    </div>
                )}
            </div>

            {/* AI Usage Section */}
            {renderUsageCard(ai, 'AI Usage (OpenAI, Anthropic, etc.)', '🤖', 'indigo')}

            {/* API Usage Section */}
            {renderUsageCard(api, 'Third-Party API Usage (Google Maps, Pinecone, etc.)', '🔌', 'teal')}
        </div>
    );
}
