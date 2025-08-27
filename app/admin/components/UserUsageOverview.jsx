// components/admin/UserUsageOverview.jsx - Enhanced with Business Card Scanning
"use client"
import { useState } from 'react';

export default function UserUsageOverview({ usageLogs, userId }) {
    const [expandedLogId, setExpandedLogId] = useState(null);
    const [filterFeature, setFilterFeature] = useState('all');

    if (!usageLogs || usageLogs.length === 0) {
        return (
            <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-3">📊 Usage Overview (Last 30 Days)</h5>
                <p className="text-sm text-gray-500 text-center py-4">No API usage recorded for this user in the last 30 days.</p>
            </div>
        );
    }

    // Categorize logs by feature
    const logsByFeature = usageLogs.reduce((acc, log) => {
        const feature = log.feature || 'unknown';
        acc[feature] = acc[feature] || [];
        acc[feature].push(log);
        return acc;
    }, {});

    // Initialize featureStats with all known features
    const featureStats = {
        autoGroupGeneration: {
            totalCost: 0, totalApiCalls: 0, totalRuns: 0, logs: logsByFeature.autoGroupGeneration || []
        },
        placesSearch: {
            totalCost: 0, totalApiCalls: 0, totalRuns: 0, logs: logsByFeature.placesSearch || []
        },
        placesAutocomplete: {
            totalCost: 0, totalApiCalls: 0, totalRuns: 0, logs: logsByFeature.placesAutocomplete || []
        },
        placesDetails: {
            totalCost: 0, totalApiCalls: 0, totalRuns: 0, logs: logsByFeature.placesDetails || []
        },
        businessCardScan: { // NEW
            totalCost: 0, totalApiCalls: 0, totalRuns: 0, logs: logsByFeature.businessCardScan || []
        }
    };

    // Calculate totals for each feature
    usageLogs.forEach(log => {
        const featureType = log.feature;
        if (featureStats[featureType]) {
            featureStats[featureType].totalCost += log.cost || 0;
            featureStats[featureType].totalApiCalls += log.apiCalls || log.visionApiCalls || log.scansProcessed || 0;
            featureStats[featureType].totalRuns += 1;
        }
    });

    const userStats = {
        totalCost: (featureStats.autoGroupGeneration.totalCost + 
                    featureStats.placesSearch.totalCost + 
                    featureStats.placesAutocomplete.totalCost +
                    featureStats.placesDetails.totalCost +
                    featureStats.businessCardScan.totalCost), // NEW
        totalApiCalls: (featureStats.autoGroupGeneration.totalApiCalls + 
                        featureStats.placesSearch.totalApiCalls + 
                        featureStats.placesAutocomplete.totalApiCalls +
                        featureStats.placesDetails.totalApiCalls +
                        featureStats.businessCardScan.totalApiCalls), // NEW
        totalRuns: usageLogs.length
    };

    // Filter logs based on selection
    const filteredLogs = filterFeature === 'all' ? usageLogs : 
                         featureStats[filterFeature]?.logs || [];

    const toggleExpanded = (logId) => {
        setExpandedLogId(expandedLogId === logId ? null : logId);
    };

    const formatTimestamp = (timestamp) => {
        try {
            return new Date(timestamp).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short'
            });
        } catch (e) {
            return timestamp;
        }
    };

    const formatDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    const getFeatureIcon = (feature) => {
        switch (feature) {
            case 'autoGroupGeneration': return '🤖';
            case 'placesSearch': return '🔍';
            case 'placesAutocomplete': return '📝';
            case 'placesDetails': return '📋';
            case 'businessCardScan': return '📇'; // NEW
            default: return '❓';
        }
    };

    const getFeatureLabel = (feature) => {
        switch (feature) {
            case 'autoGroupGeneration': return 'Auto-Grouping';
            case 'placesSearch': return 'Places Search';
            case 'placesAutocomplete': return 'Places Autocomplete';
            case 'placesDetails': return 'Places Details';
            case 'businessCardScan': return 'Business Card Scanning'; // NEW
            default: return 'Unknown';
        }
    };

    return (
        <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-gray-900">📊 API Usage Overview (Last 30 Days)</h5>
                
                {/* Feature Filter */}
                <select 
                    value={filterFeature}
                    onChange={(e) => setFilterFeature(e.target.value)}
                    className="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white"
                >
                    <option value="all">All Features</option>
                    <option value="autoGroupGeneration">🤖 Auto-Grouping</option>
                    <option value="placesSearch">🔍 Places Search (Legacy)</option>
                    <option value="placesAutocomplete">📝 Places Autocomplete</option>
                    <option value="placesDetails">📋 Places Details</option>
                    <option value="businessCardScan">📇 Business Card Scanning</option> {/* NEW */}
                </select>
            </div>

            {/* Feature Breakdown Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Auto-Grouping Stats */}
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h6 className="text-sm font-medium text-gray-700 flex items-center">
                            <span className="mr-1">🤖</span>
                            Auto-Grouping
                        </h6>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {featureStats.autoGroupGeneration.totalRuns} runs
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-sm font-bold text-red-600">
                                ${featureStats.autoGroupGeneration.totalCost.toFixed(4)}
                            </div>
                            <div className="text-xs text-gray-500">Cost</div>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-blue-600">
                                {featureStats.autoGroupGeneration.totalApiCalls}
                            </div>
                            <div className="text-xs text-gray-500">API Calls</div>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-green-600">
                                {featureStats.autoGroupGeneration.totalRuns > 0 ? 
                                    (featureStats.autoGroupGeneration.totalCost / featureStats.autoGroupGeneration.totalRuns).toFixed(4) : '0.0000'}
                            </div>
                            <div className="text-xs text-gray-500">Avg/Run</div>
                        </div>
                    </div>
                </div>

                {/* Places Search (Legacy) Stats */}
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h6 className="text-sm font-medium text-gray-700 flex items-center">
                            <span className="mr-1">🔍</span>
                            Places Search (Legacy)
                        </h6>
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                            {featureStats.placesSearch.totalRuns} searches
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-sm font-bold text-red-600">
                                ${featureStats.placesSearch.totalCost.toFixed(4)}
                            </div>
                            <div className="text-xs text-gray-500">Cost</div>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-blue-600">
                                {featureStats.placesSearch.totalApiCalls}
                            </div>
                            <div className="text-xs text-gray-500">API Calls</div>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-green-600">
                                {featureStats.placesSearch.totalRuns > 0 ? 
                                    (featureStats.placesSearch.totalCost / featureStats.placesSearch.totalRuns).toFixed(4) : '0.0000'}
                            </div>
                            <div className="text-xs text-gray-500">Avg/Search</div>
                        </div>
                    </div>
                </div>

                {/* Places Autocomplete Stats */}
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h6 className="text-sm font-medium text-gray-700 flex items-center">
                            <span className="mr-1">📝</span>
                            Places Autocomplete
                        </h6>
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            {featureStats.placesAutocomplete.totalRuns} requests
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-sm font-bold text-red-600">
                                ${featureStats.placesAutocomplete.totalCost.toFixed(4)}
                            </div>
                            <div className="text-xs text-gray-500">Cost</div>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-blue-600">
                                {featureStats.placesAutocomplete.totalApiCalls}
                            </div>
                            <div className="text-xs text-gray-500">API Calls</div>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-green-600">
                                {featureStats.placesAutocomplete.totalRuns > 0 ? 
                                    (featureStats.placesAutocomplete.totalCost / featureStats.placesAutocomplete.totalRuns).toFixed(4) : '0.0000'}
                            </div>
                            <div className="text-xs text-gray-500">Avg/Req</div>
                        </div>
                    </div>
                </div>

                {/* Places Details Stats */}
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h6 className="text-sm font-medium text-gray-700 flex items-center">
                            <span className="mr-1">📋</span>
                            Places Details
                        </h6>
                        <span className="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded">
                            {featureStats.placesDetails.totalRuns} requests
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-sm font-bold text-red-600">
                                ${featureStats.placesDetails.totalCost.toFixed(4)}
                            </div>
                            <div className="text-xs text-gray-500">Cost</div>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-blue-600">
                                {featureStats.placesDetails.totalApiCalls}
                            </div>
                            <div className="text-xs text-gray-500">API Calls</div>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-green-600">
                                {featureStats.placesDetails.totalRuns > 0 ? 
                                    (featureStats.placesDetails.totalCost / featureStats.placesDetails.totalRuns).toFixed(4) : '0.0000'}
                            </div>
                            <div className="text-xs text-gray-500">Avg/Req</div>
                        </div>
                    </div>
                </div>

                {/* Business Card Scanning Stats - NEW */}
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h6 className="text-sm font-medium text-gray-700 flex items-center">
                            <span className="mr-1">📇</span>
                            Business Card Scanning
                        </h6>
                        <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                            {featureStats.businessCardScan.totalRuns} scans
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-sm font-bold text-red-600">
                                ${featureStats.businessCardScan.totalCost.toFixed(4)}
                            </div>
                            <div className="text-xs text-gray-500">Cost</div>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-blue-600">
                                {featureStats.businessCardScan.totalApiCalls}
                            </div>
                            <div className="text-xs text-gray-500">Vision API Calls</div>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-green-600">
                                {featureStats.businessCardScan.totalRuns > 0 ? 
                                    (featureStats.businessCardScan.totalCost / featureStats.businessCardScan.totalRuns).toFixed(4) : '0.0000'}
                            </div>
                            <div className="text-xs text-gray-500">Avg/Scan</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Combined Totals */}
            <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-white rounded-lg border border-gray-200">
                <div className="text-center">
                    <div className="text-lg font-bold text-red-600">${userStats.totalCost.toFixed(4)}</div>
                    <div className="text-xs text-gray-600">Total Cost</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{userStats.totalApiCalls}</div>
                    <div className="text-xs text-gray-600">Total API Calls</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{userStats.totalRuns}</div>
                    <div className="text-xs text-gray-600">Total Operations</div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="border-t pt-3">
                <div className="text-sm font-medium text-gray-700 mb-2">
                    Recent Activity 
                    {filterFeature !== 'all' && (
                        <span className="ml-2 text-xs text-gray-500">
                            (Filtered: {getFeatureLabel(filterFeature)})
                        </span>
                    )}
                </div>
                <div className="max-h-80 overflow-y-auto space-y-2">
                    {filteredLogs.map(log => (
                        <div key={log.id} className="bg-white rounded border border-gray-200 overflow-hidden">
                            <div 
                                className="text-xs p-3 cursor-pointer hover:bg-gray-50 transition-colors flex justify-between items-center"
                                onClick={() => toggleExpanded(log.id)}
                            >
                                <div className="flex items-center space-x-2">
                                    <svg 
                                        className={`w-3 h-3 text-gray-400 transform transition-transform ${
                                            expandedLogId === log.id ? 'rotate-90' : ''
                                        }`} 
                                        fill="currentColor" 
                                        viewBox="0 0 20 20"
                                    >
                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-lg">{getFeatureIcon(log.feature)}</span>
                                    <span className={`font-semibold ${log.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                                        {log.status.toUpperCase()}
                                    </span>
                                    <span className="text-gray-500">
                                        {formatTimestamp(log.timestamp)}
                                    </span>
                                    {log.searchStrategy && (
                                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                            {log.searchStrategy}
                                        </span>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="font-medium">${(log.cost || 0).toFixed(4)}</div>
                                    <div className="text-gray-500">{log.apiCalls || log.visionApiCalls || log.scansProcessed || 0} calls</div>
                                </div>
                            </div>

                            {expandedLogId === log.id && (
                                <div className="border-t border-gray-200 bg-gray-50 p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                        <div className="space-y-2">
                                            <h6 className="font-semibold text-gray-800 text-sm mb-2">📋 Basic Information</h6>
                                            
                                            <div className="flex justify-between py-1 border-b border-gray-200">
                                                <span className="text-gray-600">Feature:</span>
                                                <span className="font-medium flex items-center">
                                                    {getFeatureIcon(log.feature)} {getFeatureLabel(log.feature)}
                                                </span>
                                            </div>

                                            <div className="flex justify-between py-1 border-b border-gray-200">
                                                <span className="text-gray-600">Status:</span>
                                                <span className={`font-medium px-2 py-1 rounded text-xs ${
                                                    log.status === 'success' 
                                                        ? 'bg-green-100 text-green-800' 
                                                        : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {log.status}
                                                </span>
                                            </div>

                                            {log.searchStrategy && (
                                                <div className="flex justify-between py-1 border-b border-gray-200">
                                                    <span className="text-gray-600">Search Strategy:</span>
                                                    <span className="font-medium text-purple-600">{log.searchStrategy}</span>
                                                </div>
                                            )}

                                            {(log.query || log.placeId) && (
                                                <div className="flex justify-between py-1 border-b border-gray-200">
                                                    <span className="text-gray-600">{log.feature === 'placesDetails' ? 'Place ID:' : 'Query:'}</span>
                                                    <span className="font-medium text-right text-xs max-w-32 truncate">
                                                        &quot;{log.query || log.placeId}&quot;
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex justify-between py-1 border-b border-gray-200">
                                                <span className="text-gray-600">Subscription:</span>
                                                <span className={`font-medium px-2 py-1 rounded text-xs ${
                                                    (log.subscriptionAtTimeOfRun || log.tierAtTimeOfScan) === 'business' ? 'bg-yellow-100 text-yellow-800' :
                                                    (log.subscriptionAtTimeOfRun || log.tierAtTimeOfScan) === 'premium' ? 'bg-purple-100 text-purple-800' :
                                                    (log.subscriptionAtTimeOfRun || log.tierAtTimeOfScan) === 'pro' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {log.subscriptionAtTimeOfRun || log.tierAtTimeOfScan || 'base'}
                                                </span>
                                            </div>

                                            <div className="flex justify-between py-1 border-b border-gray-200">
                                                <span className="text-gray-600">Timestamp:</span>
                                                <span className="font-medium text-right text-xs">
                                                    {formatTimestamp(log.timestamp)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <h6 className="font-semibold text-gray-800 text-sm mb-2">⚡ Performance & Cost</h6>
                                            
                                            <div className="flex justify-between py-1 border-b border-gray-200">
                                                <span className="text-gray-600">Total Cost:</span>
                                                <span className="font-medium text-red-600">${(log.cost || 0).toFixed(4)}</span>
                                            </div>

                                            <div className="flex justify-between py-1 border-b border-gray-200">
                                                <span className="text-gray-600">API Calls:</span>
                                                <span className="font-medium text-blue-600">{log.apiCalls || log.visionApiCalls || log.scansProcessed || 0}</span>
                                            </div>

                                            <div className="flex justify-between py-1 border-b border-gray-200">
                                                <span className="text-gray-600">Cache Hit Rate:</span>
                                                <span className="font-medium text-green-600">{log.cacheHitRate || 0}%</span>
                                            </div>

                                            <div className="flex justify-between py-1 border-b border-gray-200">
                                                <span className="text-gray-600">Processing Time:</span>
                                                <span className="font-medium">{formatDuration(log.processingTimeMs || 0)}</span>
                                            </div>

                                            <div className="flex justify-between py-1 border-b border-gray-200">
                                                <span className="text-gray-600">Avg Time/Call:</span>
                                                <span className="font-medium">
                                                    {log.avgTimePerCallMs ? formatDuration(log.avgTimePerCallMs) : 'N/A'}
                                                </span>
                                            </div>

                                            {/* Business Card Scanning specific metrics */}
                                            {log.feature === 'businessCardScan' && (
                                                <>
                                                    <div className="flex justify-between py-1 border-b border-gray-200">
                                                        <span className="text-gray-600">Vision API Tier:</span>
                                                        <span className="font-medium text-indigo-600 capitalize">
                                                            {log.tierAtTimeOfScan || 'Unknown'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between py-1 border-b border-gray-200">
                                                        <span className="text-gray-600">Monthly Scans After:</span>
                                                        <span className="font-medium text-purple-600">
                                                            {log.monthlyScansAfterThis || 'N/A'}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {log.details && (
                                            <div className="space-y-2 md:col-span-2">
                                                <h6 className="font-semibold text-gray-800 text-sm mb-2">📊 Results</h6>
                                                
                                                {log.feature === 'autoGroupGeneration' && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="flex justify-between py-1 border-b border-gray-200">
                                                            <span className="text-gray-600">Contacts Processed:</span>
                                                            <span className="font-medium text-blue-600">{log.details.contactsProcessed || 0}</span>
                                                        </div>
                                                        <div className="flex justify-between py-1 border-b border-gray-200">
                                                            <span className="text-gray-600">Groups Created:</span>
                                                            <span className="font-medium text-green-600">{log.details.groupsCreated || 0}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {log.feature === 'placesSearch' && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="flex justify-between py-1 border-b border-gray-200">
                                                            <span className="text-gray-600">Results Found:</span>
                                                            <span className="font-medium text-blue-600">{log.details.resultsFound || 0}</span>
                                                        </div>
                                                        <div className="flex justify-between py-1 border-b border-gray-200">
                                                            <span className="text-gray-600">Results Returned:</span>
                                                            <span className="font-medium text-green-600">{log.details.resultsReturned || 0}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {(log.feature === 'placesAutocomplete' || log.feature === 'placesDetails') && log.details && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {log.feature === 'placesAutocomplete' && (
                                                            <div className="flex justify-between py-1 border-b border-gray-200">
                                                                <span className="text-gray-600">Predictions:</span>
                                                                <span className="font-medium text-blue-600">{log.details.predictionsCount || 0}</span>
                                                            </div>
                                                        )}
                                                        {log.details.wasFromCache !== undefined && (
                                                            <div className="flex justify-between py-1 border-b border-gray-200">
                                                                <span className="text-gray-600">From Cache:</span>
                                                                <span className={`font-medium ${log.details.wasFromCache ? 'text-green-600' : 'text-orange-600'}`}>
                                                                    {log.details.wasFromCache ? 'Yes' : 'No'}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {log.details.sessionTokenUsed && (
                                                            <div className="flex justify-between py-1 border-b border-gray-200 col-span-2">
                                                                <span className="text-gray-600">Session Token:</span>
                                                                <span className="font-medium text-right text-xs max-w-32 truncate">
                                                                    {log.details.sessionTokenUsed}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Business Card Scanning specific results */}
                                                {log.feature === 'businessCardScan' && log.details && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="flex justify-between py-1 border-b border-gray-200">
                                                            <span className="text-gray-600">Fields Found:</span>
                                                            <span className="font-medium text-blue-600">{log.details.fieldsFound || 0}</span>
                                                        </div>
                                                        <div className="flex justify-between py-1 border-b border-gray-200">
                                                            <span className="text-gray-600">Fields with Data:</span>
                                                            <span className="font-medium text-green-600">{log.details.fieldsWithData || 0}</span>
                                                        </div>
                                                        <div className="flex justify-between py-1 border-b border-gray-200">
                                                            <span className="text-gray-600">Processing Method:</span>
                                                            <span className="font-medium text-purple-600">
                                                                {log.details.processingMethod === 'qr_and_vision' ? 'QR + Vision' :
                                                                 log.details.processingMethod === 'google_vision_only' ? 'Vision Only' :
                                                                 log.details.processingMethod || 'Unknown'}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between py-1 border-b border-gray-200">
                                                            <span className="text-gray-600">Had QR Code:</span>
                                                            <span className={`font-medium ${log.details.hasQRCode ? 'text-green-600' : 'text-gray-600'}`}>
                                                                {log.details.hasQRCode ? 'Yes' : 'No'}
                                                            </span>
                                                        </div>
                                                        {log.details.textExtracted !== undefined && (
                                                            <div className="flex justify-between py-1 border-b border-gray-200 col-span-2">
                                                                <span className="text-gray-600">Text Extracted:</span>
                                                                <span className="font-medium text-indigo-600">
                                                                    {log.details.textExtracted} characters
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {log.details.contactsProcessed > 0 && log.feature === 'autoGroupGeneration' && (
                                                    <div className="mt-3 p-2 bg-white rounded border">
                                                        <div className="text-xs text-gray-600 mb-1">Success Rate</div>
                                                        <div className="flex items-center">
                                                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                                <div 
                                                                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                                                    style={{ 
                                                                        width: `${((log.details.groupsCreated || 0) / (log.details.contactsProcessed || 1)) * 100}%` 
                                                                    }}
                                                                ></div>
                                                            </div>
                                                            <span className="ml-2 text-xs font-medium">
                                                                {(((log.details.groupsCreated || 0) / (log.details.contactsProcessed || 1)) * 100).toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {log.status === 'error' && log.errorDetails && (
                                            <div className="space-y-2 md:col-span-2">
                                                <h6 className="font-semibold text-red-800 text-sm mb-2">❌ Error Details</h6>
                                                <div className="bg-red-50 border border-red-200 rounded p-3">
                                                    <div className="text-xs">
                                                        <div className="font-medium text-red-800 mb-1">Error Message:</div>
                                                        <div className="text-red-700 mb-2">{log.errorDetails.message}</div>
                                                        {log.errorDetails.stack && (
                                                            <details className="mt-2">
                                                                <summary className="cursor-pointer text-red-600 hover:text-red-800">
                                                                    Stack Trace
                                                                </summary>
                                                                <pre className="mt-1 text-xs text-red-600 bg-red-100 p-2 rounded overflow-x-auto">
                                                                    {log.errorDetails.stack}
                                                                </pre>
                                                            </details>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="md:col-span-2 mt-4">
                                            <details className="text-xs">
                                                <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">
                                                    🔧 Raw Data (Debug)
                                                </summary>
                                                <pre className="mt-2 text-xs text-gray-600 bg-gray-100 p-3 rounded overflow-x-auto border">
                                                    {JSON.stringify(log, null, 2)}
                                                </pre>
                                            </details>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}