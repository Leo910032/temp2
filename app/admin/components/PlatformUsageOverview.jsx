// components/admin/PlatformUsageOverview.jsx - Enhanced with Business Card Scanning
"use client"

export default function PlatformUsageOverview({ stats }) {
    if (!stats) return null;

    const formatCurrency = (amount) => `$${(amount || 0).toFixed(4)}`;
    const formatNumber = (num) => (num || 0).toLocaleString();

    // Helper to render a feature's usage card
    const renderFeatureCard = (featureKey, label, icon) => {
        const featureStats = stats[featureKey];
        if (!featureStats) return null;

        const isFreeTierDepleted = (featureStats.usagePercentage || 0) >= 100;
        const colorClass = isFreeTierDepleted ? 'red' : 
                           (featureStats.usagePercentage || 0) >= 70 ? 'yellow' : 'green';

        return (
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-medium text-gray-800 flex items-center">
                        <span className="mr-2">{icon}</span>
                        {label}
                    </h4>
                    <div className="text-sm text-gray-600">
                        Free Tier: {formatNumber(featureStats.freeLimit || 0)} calls/month
                    </div>
                </div>
                
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Free Tier Usage</span>
                        <span className="text-sm text-gray-500">
                            {formatNumber(featureStats.totalCalls || 0)} / {formatNumber(featureStats.freeLimit || 0)} calls
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                            className={`h-3 rounded-full transition-all duration-300 bg-${colorClass}-500`}
                            style={{ width: `${Math.min(100, featureStats.usagePercentage || 0)}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Free Tier ({featureStats.usagePercentage?.toFixed(1) || 0}% used)</span>
                        <span>
                            {formatNumber(Math.max(0, (featureStats.freeLimit || 0) - (featureStats.totalCalls || 0)))} calls remaining
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className={`text-center p-3 bg-${colorClass}-50 border border-${colorClass}-200 rounded-lg`}>
                        <div className="text-lg font-bold text-red-600">{formatCurrency(featureStats.totalCost)}</div>
                        <div className="text-xs text-gray-600">Total Cost</div>
                        {(featureStats.paidCalls || 0) > 0 && (
                            <div className="text-xs text-red-500 mt-1">
                                {formatNumber(featureStats.paidCalls)} paid calls
                            </div>
                        )}
                    </div>
                    <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-lg font-bold text-blue-600">{formatNumber(featureStats.totalCalls)}</div>
                        <div className="text-xs text-gray-600">Total API Calls</div>
                        <div className="text-xs text-gray-500 mt-1">
                            {formatNumber(featureStats.freeCalls)} free
                        </div>
                    </div>
                    <div className="text-center p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="text-lg font-bold text-green-600">{formatNumber(featureStats.totalRuns)}</div>
                        <div className="text-xs text-gray-600">Total Runs</div>
                        <div className="text-xs text-gray-500 mt-1">
                            {featureStats.trend !== undefined && (
                                <span className={featureStats.trend >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {featureStats.trend >= 0 ? '↗️' : '↘️'} {Math.abs(featureStats.trend)}%
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="text-lg font-bold text-purple-600">{formatCurrency(featureStats.averageCostPerRun)}</div>
                        <div className="text-xs text-gray-600">Avg Cost/Run</div>
                    </div>
                </div>

                {/* Additional metrics for Business Card Scanning */}
                {featureKey === 'businessCardScan' && featureStats.successRate !== undefined && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="text-center p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                            <div className="text-lg font-bold text-indigo-600">{featureStats.successRate}%</div>
                            <div className="text-xs text-gray-600">Success Rate</div>
                        </div>
                        <div className="text-center p-3 bg-teal-50 border border-teal-200 rounded-lg">
                            <div className="text-lg font-bold text-teal-600">
                                {featureStats.averageProcessingTime ? 
                                    `${(featureStats.averageProcessingTime / 1000).toFixed(1)}s` : 'N/A'}
                            </div>
                            <div className="text-xs text-gray-600">Avg Processing Time</div>
                        </div>
                        <div className="text-center p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="text-lg font-bold text-amber-600 capitalize">{featureStats.currentTier || 'Unknown'}</div>
                            <div className="text-xs text-gray-600">Current Tier</div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">🌐 Platform API Usage (Last 30 Days)</h3>
            
            {/* Auto-Grouping API Section */}
            {renderFeatureCard('groupGeneration', 'Auto-Grouping API', '🤖')}

            {/* Places Search API Section */}
            {renderFeatureCard('placesSearch', 'Places Search API (Legacy)', '🔍')}

            {/* Places Autocomplete API Section */}
            {renderFeatureCard('placesAutocomplete', 'Places Autocomplete API', '📝')}

            {/* Places Details API Section */}
            {renderFeatureCard('placesDetails', 'Places Details API', '📋')}

            {/* Business Card Scanning API Section - NEW */}
            {renderFeatureCard('businessCardScan', 'Business Card Scanning API', '📇')}

            {/* Combined Platform Summary */}
            <div className="border-t pt-6">
                <h4 className="text-md font-medium text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">📊</span>
                    All APIs Combined Totals
                </h4>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.combined?.totalCost)}</div>
                        <div className="text-sm text-gray-600">Total Platform Cost</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{formatNumber(stats.combined?.totalApiCalls)}</div>
                        <div className="text-sm text-gray-600">Total API Calls</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{formatNumber(stats.combined?.totalRuns)}</div>
                        <div className="text-sm text-gray-600">Total Operations</div>
                    </div>
                </div>

                {/* Health Metrics */}
                {stats.healthMetrics && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="text-lg font-bold text-gray-700">
                                {(stats.healthMetrics.averageProcessingTime || 0).toFixed(0)}ms
                            </div>
                            <div className="text-xs text-gray-600">Avg Processing Time</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="text-lg font-bold text-gray-700">
                                {stats.healthMetrics.successRate || 0}%
                            </div>
                            <div className="text-xs text-gray-600">Success Rate</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="text-lg font-bold text-gray-700">
                                {(stats.healthMetrics.averageCacheHitRate || 0).toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-600">Avg Cache Hit Rate</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Cost Alerts */}
            {(stats.groupGeneration?.usagePercentage || 0) >= 80 || 
             (stats.placesSearch?.usagePercentage || 0) >= 80 ||
             (stats.placesAutocomplete?.usagePercentage || 0) >= 80 ||
             (stats.placesDetails?.usagePercentage || 0) >= 80 ||
             (stats.businessCardScan?.usagePercentage || 0) >= 80 // NEW
            ? (
                <div className="mt-6 space-y-3">
                    {/* Auto-Grouping Alert */}
                    {(stats.groupGeneration?.usagePercentage || 0) >= 80 && (
                        <div className={`p-4 rounded-lg border ${
                            stats.groupGeneration.usagePercentage >= 95 ? 'bg-red-50 border-red-200 text-red-800' :
                            stats.groupGeneration.usagePercentage >= 90 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                            'bg-blue-50 border-blue-200 text-blue-800'
                        }`}>
                            <div className="flex items-center">
                                <span className="text-lg mr-2">
                                    {stats.groupGeneration.usagePercentage >= 95 ? '🚨' : 
                                     stats.groupGeneration.usagePercentage >= 90 ? '⚠️' : 'ℹ️'}
                                </span>
                                <div>
                                    <div className="font-medium">
                                        Auto-Grouping API: {stats.groupGeneration.usagePercentage >= 95 ? 'Critical Usage' :
                                                            stats.groupGeneration.usagePercentage >= 90 ? 'High Usage' : 'Notice'}
                                    </div>
                                    <div className="text-sm mt-1">
                                        {formatNumber(Math.max(0, (stats.groupGeneration.freeLimit || 0) - (stats.groupGeneration.totalCalls || 0)))} free calls remaining.
                                        After that, each call costs $0.032.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Places Search (Legacy) Alert */}
                    {(stats.placesSearch?.usagePercentage || 0) >= 80 && (
                        <div className={`p-4 rounded-lg border ${
                            stats.placesSearch.usagePercentage >= 95 ? 'bg-red-50 border-red-200 text-red-800' :
                            stats.placesSearch.usagePercentage >= 90 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                            'bg-blue-50 border-blue-200 text-blue-800'
                        }`}>
                            <div className="flex items-center">
                                <span className="text-lg mr-2">
                                    {stats.placesSearch.usagePercentage >= 95 ? '🚨' : 
                                     stats.placesSearch.usagePercentage >= 90 ? '⚠️' : 'ℹ️'}
                                </span>
                                <div>
                                    <div className="font-medium">
                                        Places Search API (Legacy): {stats.placesSearch.usagePercentage >= 95 ? 'Critical Usage' :
                                                          stats.placesSearch.usagePercentage >= 90 ? 'High Usage' : 'Notice'}
                                    </div>
                                    <div className="text-sm mt-1">
                                        {formatNumber(Math.max(0, (stats.placesSearch.freeLimit || 0) - (stats.placesSearch.totalCalls || 0)))} free calls remaining.
                                        After that, each call costs $0.032.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Places Autocomplete Alert */}
                    {(stats.placesAutocomplete?.usagePercentage || 0) >= 80 && (
                        <div className={`p-4 rounded-lg border ${
                            stats.placesAutocomplete.usagePercentage >= 95 ? 'bg-red-50 border-red-200 text-red-800' :
                            stats.placesAutocomplete.usagePercentage >= 90 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                            'bg-blue-50 border-blue-200 text-blue-800'
                        }`}>
                            <div className="flex items-center">
                                <span className="text-lg mr-2">
                                    {stats.placesAutocomplete.usagePercentage >= 95 ? '🚨' : 
                                     stats.placesAutocomplete.usagePercentage >= 90 ? '⚠️' : 'ℹ️'}
                                </span>
                                <div>
                                    <div className="font-medium">
                                        Places Autocomplete API: {stats.placesAutocomplete.usagePercentage >= 95 ? 'Critical Usage' :
                                                              stats.placesAutocomplete.usagePercentage >= 90 ? 'High Usage' : 'Notice'}
                                    </div>
                                    <div className="text-sm mt-1">
                                        {formatNumber(Math.max(0, (stats.placesAutocomplete.freeLimit || 0) - (stats.placesAutocomplete.totalCalls || 0)))} free calls remaining.
                                        After that, each call costs $0.00283.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Places Details Alert */}
                    {(stats.placesDetails?.usagePercentage || 0) >= 80 && (
                        <div className={`p-4 rounded-lg border ${
                            stats.placesDetails.usagePercentage >= 95 ? 'bg-red-50 border-red-200 text-red-800' :
                            stats.placesDetails.usagePercentage >= 90 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                            'bg-blue-50 border-blue-200 text-blue-800'
                        }`}>
                            <div className="flex items-center">
                                <span className="text-lg mr-2">
                                    {stats.placesDetails.usagePercentage >= 95 ? '🚨' : 
                                     stats.placesDetails.usagePercentage >= 90 ? '⚠️' : 'ℹ️'}
                                </span>
                                <div>
                                    <div className="font-medium">
                                        Places Details API: {stats.placesDetails.usagePercentage >= 95 ? 'Critical Usage' :
                                                            stats.placesDetails.usagePercentage >= 90 ? 'High Usage' : 'Notice'}
                                    </div>
                                    <div className="text-sm mt-1">
                                        {formatNumber(Math.max(0, (stats.placesDetails.freeLimit || 0) - (stats.placesDetails.totalCalls || 0)))} free calls remaining.
                                        After that, each call costs $0.005 (excluding session-based free calls).
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Business Card Scanning Alert - NEW */}
                    {(stats.businessCardScan?.usagePercentage || 0) >= 80 && (
                        <div className={`p-4 rounded-lg border ${
                            stats.businessCardScan.usagePercentage >= 95 ? 'bg-red-50 border-red-200 text-red-800' :
                            stats.businessCardScan.usagePercentage >= 90 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                            'bg-blue-50 border-blue-200 text-blue-800'
                        }`}>
                            <div className="flex items-center">
                                <span className="text-lg mr-2">
                                    {stats.businessCardScan.usagePercentage >= 95 ? '🚨' : 
                                     stats.businessCardScan.usagePercentage >= 90 ? '⚠️' : 'ℹ️'}
                                </span>
                                <div>
                                    <div className="font-medium">
                                        Business Card Scanning API: {stats.businessCardScan.usagePercentage >= 95 ? 'Critical Usage' :
                                                                    stats.businessCardScan.usagePercentage >= 90 ? 'High Usage' : 'Notice'}
                                    </div>
                                    <div className="text-sm mt-1">
                                        {formatNumber(Math.max(0, (stats.businessCardScan.freeLimit || 0) - (stats.businessCardScan.totalCalls || 0)))} free scans remaining.
                                        Current tier: {stats.businessCardScan.currentTier || 'Unknown'}. 
                                        Next tier: {stats.businessCardScan.totalCalls > 1000 ? '$0.0015 per scan' : '$0.0015 per scan after 1,000'}.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="mt-6 p-4 rounded-lg border border-green-200 bg-green-50 text-green-800 flex items-center">
                    <span className="text-lg mr-2">✅</span>
                    All API usage is currently well within free limits.
                </div>
            )}

            {/* Top Users Section */}
            {stats.topUsers && stats.topUsers.length > 0 && (
                <div className="mt-6 border-t pt-6">
                    <h4 className="text-md font-medium text-gray-800 mb-4 flex items-center">
                        <span className="mr-2">👑</span>
                        Top API Users (by cost)
                    </h4>
                    <div className="space-y-2">
                        {stats.topUsers.slice(0, 3).map((user, index) => (
                            <div key={user.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                                    }`}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">User {user.userId.slice(-8)}</div>
                                        <div className="text-sm text-gray-600">
                                            {user.total.runs} total operations
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-red-600">{formatCurrency(user.total.cost)}</div>
                                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                        <div>Groups: {formatCurrency(user.groupGeneration.cost)}</div>
                                        <div>Search: {formatCurrency(user.placesSearch.cost)}</div>
                                        <div>Autocomplete: {formatCurrency(user.placesAutocomplete.cost)}</div>
                                        <div>Details: {formatCurrency(user.placesDetails.cost)}</div>
                                        <div>Card Scan: {formatCurrency(user.businessCardScan.cost)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}