// components/admin/AdminContactTestPanel.jsx
"use client"
import { useState, useEffect } from 'react';

export default function AdminContactTestPanel({ targetUser, onGenerate, onCleanup, loading }) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationInfo, setGenerationInfo] = useState(null);
    const [isLoadingInfo, setIsLoadingInfo] = useState(true);
    const [selectedScenario, setSelectedScenario] = useState('realisticMix');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [customOptions, setCustomOptions] = useState({
        count: 50,
        eventPercentage: 0.4,
        locationPercentage: 0.7,
        forceEventLocation: false,
        forceRandomLocation: false
    });

    // API-based generation scenarios
    const GENERATION_SCENARIOS = {
        autoGroupingTest: {
            name: 'Auto-Grouping Test',
            description: 'Optimized for testing automatic group generation by company, location, and events',
            params: {
                count: 75,
                eventPercentage: 0.6,
                locationPercentage: 0.8
            }
        },
        eventNetworking: {
            name: 'Event Networking',
            description: 'Simulates heavy event networking with most contacts from conferences',
            params: {
                count: 60,
                eventPercentage: 0.8,
                locationPercentage: 0.9
            }
        },
        techHubSpread: {
            name: 'Tech Hub Spread',
            description: 'Contacts spread across different tech hubs for location testing',
            params: {
                count: 50,
                eventPercentage: 0.2,
                locationPercentage: 0.9
            }
        },
        realisticMix: {
            name: 'Realistic Mix',
            description: 'Balanced mix that simulates real-world contact collection',
            params: {
                count: 100,
                eventPercentage: 0.4,
                locationPercentage: 0.7
            }
        },
        allEvents: {
            name: 'All Events',
            description: 'All contacts from events (perfect for event grouping tests)',
            params: {
                count: 40,
                forceEventLocation: true,
                locationPercentage: 1.0
            }
        },
        allRandom: {
            name: 'All Random',
            description: 'All contacts from random locations (no events)',
            params: {
                count: 30,
                forceRandomLocation: true,
                eventPercentage: 0
            }
        }
    };

    useEffect(() => {
        if (targetUser) {
            loadGenerationInfo();
        }
    }, [targetUser]);

    const loadGenerationInfo = async () => {
        if (!targetUser) return;

        try {
            setIsLoadingInfo(true);
            const response = await fetch(`/api/admin/generate-contacts?userId=${targetUser.id}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const info = await response.json();
            setGenerationInfo(info);
        } catch (error) {
            console.error('Error loading generation info:', error);
        } finally {
            setIsLoadingInfo(false);
        }
    };

    const handleQuickGenerate = async (scenario, customCount = null) => {
        setIsGenerating(true);

        try {
            const scenarioConfig = GENERATION_SCENARIOS[scenario];
            const options = customCount
                ? { ...scenarioConfig.params, count: customCount }
                : scenarioConfig.params;

            const result = await onGenerate(options);
            await loadGenerationInfo(); // Refresh stats

        } catch (error) {
            console.error('Generation error:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCustomGenerate = async () => {
        setIsGenerating(true);

        try {
            const result = await onGenerate(customOptions);
            await loadGenerationInfo();
        } catch (error) {
            console.error('Generation error:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleScenarioGenerate = async () => {
        await handleQuickGenerate(selectedScenario);
    };

    if (isLoadingInfo) {
        return (
            <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Target User Info */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                    <span className="mr-2">🎯</span>
                    Target User: {targetUser.displayName} (@{targetUser.username})
                </h4>
                <div className="text-sm text-blue-800">
                    Account Type: <span className="font-medium">{targetUser.accountType || 'base'}</span> • 
                    Email: <span className="font-medium">{targetUser.email}</span>
                </div>
            </div>

            {/* Current Stats */}
            {generationInfo?.currentStats && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <span className="mr-2">📊</span>
                        Current Contact Statistics
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                                {generationInfo.currentStats.totalContacts}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">Total Contacts</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                                {generationInfo.currentStats.withLocation}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">With Location</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                                {generationInfo.currentStats.fromEvents}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">From Events</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">
                                {generationInfo.currentStats.bySource.admin_test || 0}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">Test Data</div>
                        </div>
                    </div>
                    
                    {/* Test Data Cleanup Button */}
                    {generationInfo.testDataInfo?.totalTestContacts > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    <span className="font-medium text-red-600">{generationInfo.testDataInfo.totalTestContacts}</span> test contacts found
                                    {generationInfo.testDataInfo.lastTestGeneration && (
                                        <span className="text-gray-500 ml-2">
                                            (Last: {new Date(generationInfo.testDataInfo.lastTestGeneration).toLocaleDateString()})
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={onCleanup}
                                    disabled={loading}
                                    className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                    {loading ? '🗑️ Cleaning...' : '🗑️ Delete Test Data'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!showAdvanced ? (
                // Simple Mode - Quick Actions
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 flex items-center">
                            <span className="mr-2">⚡</span>
                            Quick Actions
                        </h4>
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            Advanced Mode
                        </button>
                    </div>
                    
                    {/* Quick Generation Buttons */}
                    <div className="grid gap-3">
                        <button
                            onClick={() => handleQuickGenerate('autoGroupingTest')}
                            disabled={isGenerating || loading}
                            className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-xl hover:from-purple-100 hover:to-purple-150 disabled:opacity-50 transition-all duration-200 group"
                        >
                            <div className="text-left">
                                <div className="font-semibold text-purple-900">🎯 Auto-Grouping Test</div>
                                <div className="text-sm text-purple-700">75 contacts optimized for testing group features</div>
                            </div>
                            <div className="text-purple-600 group-hover:scale-110 transition-transform">▶️</div>
                        </button>

                        <button
                            onClick={() => handleQuickGenerate('eventNetworking')}
                            disabled={isGenerating || loading}
                            className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-150 disabled:opacity-50 transition-all duration-200 group"
                        >
                            <div className="text-left">
                                <div className="font-semibold text-blue-900">🏢 Event Networking</div>
                                <div className="text-sm text-blue-700">60 contacts mostly from tech conferences</div>
                            </div>
                            <div className="text-blue-600 group-hover:scale-110 transition-transform">▶️</div>
                        </button>

                        <button
                            onClick={() => handleQuickGenerate('realisticMix')}
                            disabled={isGenerating || loading}
                            className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl hover:from-green-100 hover:to-green-150 disabled:opacity-50 transition-all duration-200 group"
                        >
                            <div className="text-left">
                                <div className="font-semibold text-green-900">⚖️ Realistic Mix</div>
                                <div className="text-sm text-green-700">100 contacts with balanced distribution</div>
                            </div>
                            <div className="text-green-600 group-hover:scale-110 transition-transform">▶️</div>
                        </button>

                        {/* Quick Size Variants */}
                        <div className="grid grid-cols-3 gap-2 pt-2">
                            <button
                                onClick={() => handleQuickGenerate('realisticMix', 25)}
                                disabled={isGenerating || loading}
                                className="p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 text-sm font-medium text-gray-700 transition-colors"
                            >
                                Small (25)
                            </button>
                            <button
                                onClick={() => handleQuickGenerate('realisticMix', 100)}
                                disabled={isGenerating || loading}
                                className="p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 text-sm font-medium text-gray-700 transition-colors"
                            >
                                Medium (100)
                            </button>
                            <button
                                onClick={() => handleQuickGenerate('realisticMix', 200)}
                                disabled={isGenerating || loading}
                                className="p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 text-sm font-medium text-gray-700 transition-colors"
                            >
                                Large (200)
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                // Advanced Mode - Full Control
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 flex items-center">
                            <span className="mr-2">🛠️</span>
                            Advanced Generation Options
                        </h4>
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            Simple Mode
                        </button>
                    </div>

                    {/* Scenario Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            📋 Predefined Scenario
                        </label>
                        <select
                            value={selectedScenario}
                            onChange={(e) => setSelectedScenario(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                            {Object.entries(GENERATION_SCENARIOS).map(([key, scenario]) => (
                                <option key={key} value={key}>
                                    {scenario.name} - {scenario.description}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={handleScenarioGenerate}
                            disabled={isGenerating || loading}
                            className="mt-3 w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                        >
                            {isGenerating || loading ? '⏳ Generating...' : '🚀 Run Selected Scenario'}
                        </button>
                    </div>

                    <div className="border-t pt-6">
                        <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                            <span className="mr-2">🛠️</span>
                            Custom Generation Options
                        </h4>
                        
                        {/* Contact Count */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Number of Contacts: <span className="font-bold text-blue-600">{customOptions.count}</span>
                            </label>
                            <input
                                type="range"
                                min="5"
                                max="300"
                                step="5"
                                value={customOptions.count}
                                onChange={(e) => setCustomOptions(prev => ({ 
                                    ...prev, 
                                    count: parseInt(e.target.value) 
                                }))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>5</span>
                                <span>300</span>
                            </div>
                        </div>

                        {/* Event Percentage */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Event Contacts: <span className="font-bold text-purple-600">{Math.round(customOptions.eventPercentage * 100)}%</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={customOptions.eventPercentage}
                                onChange={(e) => setCustomOptions(prev => ({ 
                                    ...prev, 
                                    eventPercentage: parseFloat(e.target.value) 
                                }))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>0% (Random locations)</span>
                                <span>100% (All from events)</span>
                            </div>
                        </div>

                        {/* Location Percentage */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                With Location Data: <span className="font-bold text-green-600">{Math.round(customOptions.locationPercentage * 100)}%</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={customOptions.locationPercentage}
                                onChange={(e) => setCustomOptions(prev => ({ 
                                    ...prev, 
                                    locationPercentage: parseFloat(e.target.value) 
                                }))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>0% (No location)</span>
                                <span>100% (All with location)</span>
                            </div>
                        </div>

                        {/* Force Options */}
                        <div className="mb-6 space-y-2">
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={customOptions.forceEventLocation}
                                    onChange={(e) => setCustomOptions(prev => ({ 
                                        ...prev, 
                                        forceEventLocation: e.target.checked,
                                        forceRandomLocation: false // Mutual exclusive
                                    }))}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">🏢 Force all contacts to be from events</span>
                            </label>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={customOptions.forceRandomLocation}
                                    onChange={(e) => setCustomOptions(prev => ({ 
                                        ...prev, 
                                        forceRandomLocation: e.target.checked,
                                        forceEventLocation: false // Mutual exclusive
                                    }))}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span className="text-sm text-gray-700">📍 Force all contacts to have random locations</span>
                            </label>
                        </div>

                        <button
                            onClick={handleCustomGenerate}
                            disabled={isGenerating || loading}
                            className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 disabled:opacity-50 font-medium transition-colors"
                        >
                            {isGenerating || loading ? '⏳ Generating Custom Contacts...' : '🎯 Generate Custom Contacts'}
                        </button>
                    </div>
                </div>
            )}

            {/* Available Data Info */}
            {generationInfo && (
                <div className="pt-4 border-t">
                    <details className="text-sm">
                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium flex items-center">
                            <span className="mr-2">📊</span>
                            Available Test Data 
                            <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded-full">
                                {generationInfo.generationOptions?.availableEvents} events, {generationInfo.generationOptions?.availableCompanies} companies
                            </span>
                        </summary>
                        <div className="mt-3 space-y-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-lg">
                            <div>
                                <strong className="text-gray-800">📅 Sample Events:</strong><br />
                                {generationInfo.availableEvents?.slice(0, 6).join(', ')}
                                {generationInfo.availableEvents?.length > 6 && ` and ${generationInfo.availableEvents.length - 6} more...`}
                            </div>
                            <div>
                                <strong className="text-gray-800">🏢 Sample Companies:</strong><br />
                                {generationInfo.sampleCompanies?.slice(0, 10).join(', ')}
                                {generationInfo.sampleCompanies?.length > 10 && ` and ${generationInfo.sampleCompanies.length - 10} more...`}
                            </div>
                        </div>
                    </details>
                </div>
            )}

            {/* Usage Tips */}
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                <h5 className="text-sm font-semibold text-amber-900 mb-2 flex items-center">
                    <span className="mr-2">💡</span>
                    Admin Testing Tips
                </h5>
                <ul className="text-xs text-amber-800 space-y-1">
                    <li>• Generate test data for specific users to test their subscription features</li>
                    <li>• Use different scenarios to test various contact management features</li>
                    <li>• Monitor the test data counter and use cleanup when needed</li>
                    <li>• Check user analytics after generation to see impact</li>
                    <li>• Test both event and location-based grouping scenarios</li>
                </ul>
            </div>
        </div>
    );
}