// components/admin/StatsCards.jsx
"use client"

export default function StatsCards({ stats, apiStats }) {
    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const formatCurrency = (amount) => `$${(amount || 0).toFixed(4)}`;

    return (
        <div className="space-y-6 mb-6">
            {/* User Statistics */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">👥 User Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                        <div className="text-sm text-gray-600">Total Users</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-2xl font-bold text-green-600">{formatNumber(stats.totalViews)}</div>
                        <div className="text-sm text-gray-600">Total Views</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-2xl font-bold text-purple-600">{formatNumber(stats.totalClicks)}</div>
                        <div className="text-sm text-gray-600">Total Clicks</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-2xl font-bold text-orange-600">{stats.activeToday}</div>
                        <div className="text-sm text-gray-600">Active Today</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-2xl font-bold text-indigo-600">{stats.withAnalytics}</div>
                        <div className="text-sm text-gray-600">With Analytics</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-2xl font-bold text-red-600">{stats.sensitiveContent}</div>
                        <div className="text-sm text-gray-600">Sensitive Content</div>
                    </div>
                </div>
            </div>

            {/* API Usage Statistics */}
            {apiStats && (
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 API Usage Statistics (Last 30 Days)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        {/* Auto-Grouping API */}
                        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-lg">🤖</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                    (apiStats.groupGeneration?.usagePercentage || 0) >= 80 ? 'bg-red-100 text-red-800' :
                                    (apiStats.groupGeneration?.usagePercentage || 0) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                }`}>
                                    {(apiStats.groupGeneration?.usagePercentage || 0).toFixed(1)}%
                                </span>
                            </div>
                            <div className="text-xl font-bold text-blue-600">
                                {formatNumber(apiStats.groupGeneration?.totalRuns || 0)}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">Auto-Grouping Runs</div>
                            <div className="text-xs text-red-500 font-medium">
                                {formatCurrency(apiStats.groupGeneration?.totalCost || 0)}
                            </div>
                        </div>

                        {/* Places Search API */}
                        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-lg">🔍</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                    (apiStats.placesSearch?.usagePercentage || 0) >= 80 ? 'bg-red-100 text-red-800' :
                                    (apiStats.placesSearch?.usagePercentage || 0) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                }`}>
                                    {(apiStats.placesSearch?.usagePercentage || 0).toFixed(1)}%
                                </span>
                            </div>
                            <div className="text-xl font-bold text-orange-600">
                                {formatNumber(apiStats.placesSearch?.totalRuns || 0)}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">Places Searches</div>
                            <div className="text-xs text-red-500 font-medium">
                                {formatCurrency(apiStats.placesSearch?.totalCost || 0)}
                            </div>
                        </div>

                        {/* Places Autocomplete API */}
                        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-lg">📝</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                    (apiStats.placesAutocomplete?.usagePercentage || 0) >= 80 ? 'bg-red-100 text-red-800' :
                                    (apiStats.placesAutocomplete?.usagePercentage || 0) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                }`}>
                                    {(apiStats.placesAutocomplete?.usagePercentage || 0).toFixed(1)}%
                                </span>
                            </div>
                            <div className="text-xl font-bold text-purple-600">
                                {formatNumber(apiStats.placesAutocomplete?.totalRuns || 0)}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">Autocomplete Requests</div>
                            <div className="text-xs text-red-500 font-medium">
                                {formatCurrency(apiStats.placesAutocomplete?.totalCost || 0)}
                            </div>
                        </div>

                        {/* Places Details API */}
                        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-teal-500">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-lg">📋</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                    (apiStats.placesDetails?.usagePercentage || 0) >= 80 ? 'bg-red-100 text-red-800' :
                                    (apiStats.placesDetails?.usagePercentage || 0) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                }`}>
                                    {(apiStats.placesDetails?.usagePercentage || 0).toFixed(1)}%
                                </span>
                            </div>
                            <div className="text-xl font-bold text-teal-600">
                                {formatNumber(apiStats.placesDetails?.totalRuns || 0)}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">Places Details</div>
                            <div className="text-xs text-red-500 font-medium">
                                {formatCurrency(apiStats.placesDetails?.totalCost || 0)}
                            </div>
                        </div>

                        {/* Business Card Scanning API */}
                        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-lg">📇</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                    (apiStats.businessCardScan?.usagePercentage || 0) >= 80 ? 'bg-red-100 text-red-800' :
                                    (apiStats.businessCardScan?.usagePercentage || 0) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                }`}>
                                    {(apiStats.businessCardScan?.usagePercentage || 0).toFixed(1)}%
                                </span>
                            </div>
                            <div className="text-xl font-bold text-indigo-600">
                                {formatNumber(apiStats.businessCardScan?.totalRuns || 0)}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">Card Scans</div>
                            <div className="text-xs text-red-500 font-medium">
                                {formatCurrency(apiStats.businessCardScan?.totalCost || 0)}
                            </div>
                        </div>
                    </div>

                    {/* Combined API Totals */}
                    <div className="mt-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 border border-gray-200">
                        <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center">
                            <span className="mr-2">📊</span>
                            Combined API Totals (Last 30 Days)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-white rounded-lg shadow">
                                <div className="text-2xl font-bold text-red-600">
                                    {formatCurrency(apiStats.combined?.totalCost || 0)}
                                </div>
                                <div className="text-sm text-gray-600">Total Cost</div>
                            </div>
                            <div className="text-center p-4 bg-white rounded-lg shadow">
                                <div className="text-2xl font-bold text-blue-600">
                                    {formatNumber(apiStats.combined?.totalApiCalls || 0)}
                                </div>
                                <div className="text-sm text-gray-600">Total API Calls</div>
                            </div>
                            <div className="text-center p-4 bg-white rounded-lg shadow">
                                <div className="text-2xl font-bold text-green-600">
                                    {formatNumber(apiStats.combined?.totalRuns || 0)}
                                </div>
                                <div className="text-sm text-gray-600">Total Operations</div>
                            </div>
                            <div className="text-center p-4 bg-white rounded-lg shadow">
                                <div className="text-2xl font-bold text-purple-600">
                                    {formatCurrency(apiStats.combined?.averageCostPerRun || 0)}
                                </div>
                                <div className="text-sm text-gray-600">Avg Cost/Operation</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}