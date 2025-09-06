// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/RulesGenerateTab.jsx
// Rules-based group generation tab (fast, no cost tracking)

"use client"
import { useState, useEffect } from 'react'; // ✅ STEP 1: Import useEffect
import { ContactServiceFactory } from '@/lib/services/serviceContact/client/factories/ContactServiceFactory';

export default function RulesGenerateTab({
    contacts = [],
    formState = { rulesOptions: {} },
    updateFormState,
    subscriptionLevel = 'base',
    onGenerateRulesGroups,
    isGenerating = false
}) {
    const [processingTime, setProcessingTime] = useState(null);
    const [lastResult, setLastResult] = useState(null);
    
    const rulesService = ContactServiceFactory.getRulesGroupService();
    const availableOptions = rulesService.getAvailableRulesOptions(subscriptionLevel);
    const featureDescriptions = rulesService.getRulesFeatureDescriptions();
    const comparison = rulesService.getFeatureComparison();

    const updateRulesOptions = (updates) => {
        if (updateFormState) {
            updateFormState({
                rulesOptions: {
                    ...formState.rulesOptions,
                    ...updates
                }
            });
        }
    };

    // ✅ STEP 2: Move the logic into a useEffect hook
    useEffect(() => {
        // Initialize options only if they haven't been set yet.
        if (!formState.rulesOptions || Object.keys(formState.rulesOptions).length === 0) {
            updateRulesOptions({
                groupByCompany: true,
                groupByTime: true,
                groupByLocation: false,
                groupByEvents: false,
                minGroupSize: 2,
                maxGroups: 15
            });
        }
    }, [formState.rulesOptions, updateFormState]); // Dependency array ensures this runs only when needed


    const handleGenerateRules = async () => {
        if (!onGenerateRulesGroups) {
            console.error('onGenerateRulesGroups handler not provided');
            return;
        }

        const startTime = Date.now();
        setLastResult(null);
        setProcessingTime(null);

        const currentOptions = formState.rulesOptions || {};
        console.log('[RulesGenerateTab] Generating with options:', currentOptions);

        try {
            const result = await onGenerateRulesGroups(currentOptions);
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            setProcessingTime(duration);
            setLastResult(result);
            
            console.log('[RulesGenerateTab] Generation completed:', { duration, result });
        } catch (error) {
            console.error('Rules generation failed:', error);
            setLastResult({ success: false, error: error.message });
        }
    };

    if (!availableOptions.groupByCompany && availableOptions.upgradeRequired) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upgrade Required</h3>
                <p className="text-gray-600 mb-4">
                    Rules-based group generation requires a Pro subscription or higher.
                </p>
                <div className="text-sm text-gray-500 mb-6">
                    Current plan: <span className="font-medium capitalize">{subscriptionLevel}</span> → Required: <span className="font-medium">Pro</span>
                </div>
                <button className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                    Upgrade to Pro
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Introduction */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Rules-Based Group Generation</h3>
                <p className="text-gray-600 mb-4">
                    Fast, immediate contact grouping using smart pattern recognition. No AI processing or usage costs.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                        <div className="font-semibold text-green-600">Speed</div>
                        <div className="text-gray-600">1-5 seconds</div>
                    </div>
                    <div className="text-center">
                        <div className="font-semibold text-green-600">Cost</div>
                        <div className="text-gray-600">Free</div>
                    </div>
                    <div className="text-center">
                        <div className="font-semibold text-green-600">Processing</div>
                        <div className="text-gray-600">Immediate</div>
                    </div>
                    <div className="text-center">
                        <div className="font-semibold text-green-600">Quality</div>
                        <div className="text-gray-600">Pattern-based</div>
                    </div>
                </div>
            </div>

            {/* Processing Time Display */}
            {processingTime && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-green-900 flex items-center">
                                ⚡ Generation Complete
                            </div>
                            <div className="text-sm text-green-700">
                                Rules-based processing completed
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-semibold text-green-900">
                                {processingTime < 1000 ? `${processingTime}ms` : `${(processingTime/1000).toFixed(1)}s`}
                            </div>
                            <div className="text-xs text-green-600">
                                {lastResult?.groups?.length || 0} groups created
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rules Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Grouping Methods</h4>
                    
                    {Object.entries(featureDescriptions).map(([key, feature]) => (
                        <div key={key} className="space-y-2">
                            <label className="flex items-start">
                                <input
                                    type="checkbox"
                                    checked={formState.rulesOptions?.[key] || false}
                                    onChange={(e) => updateRulesOptions({ [key]: e.target.checked })}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500 mt-1"
                                    disabled={!availableOptions[key] || isGenerating}
                                />
                                <div className="ml-3">
                                    <div className="text-sm font-medium text-gray-700 flex items-center">
                                        {feature.name}
                                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                            {feature.speed}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {feature.description}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        Method: {feature.method} • Accuracy: {feature.accuracy}
                                    </div>
                                </div>
                            </label>
                        </div>
                    ))}
                </div>

                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Options</h4>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Minimum Group Size
                        </label>
                        <input
                            type="number"
                            min={availableOptions.minGroupSize?.min || 2}
                            max={availableOptions.minGroupSize?.max || 10}
                            value={formState.rulesOptions?.minGroupSize || 2}
                            onChange={(e) => updateRulesOptions({ minGroupSize: parseInt(e.target.value) || 2 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            disabled={isGenerating}
                        />
                        <div className="text-xs text-gray-500 mt-1">
                            Groups with fewer contacts will be filtered out
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Maximum Groups
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={availableOptions.maxGroups || 20}
                            value={formState.rulesOptions?.maxGroups || 15}
                            onChange={(e) => updateRulesOptions({ maxGroups: parseInt(e.target.value) || 15 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            disabled={isGenerating}
                        />
                        <div className="text-xs text-gray-500 mt-1">
                            Limit the total number of groups created
                        </div>
                    </div>

                    {/* Estimated Processing Time */}
                    <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-sm font-medium text-gray-700 mb-1">
                            Estimated Processing Time
                        </div>
                        <div className="text-lg font-semibold text-gray-900">
                            {rulesService.estimateProcessingTime(contacts.length)}
                        </div>
                        <div className="text-xs text-gray-500">
                            Based on {contacts.length} contacts
                        </div>
                    </div>
                </div>
            </div>

            {/* Comparison with AI */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-3">Rules vs AI Comparison</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <div className="font-medium text-blue-800 mb-2">Rules-Based (This Tab)</div>
                        <ul className="space-y-1 text-blue-700">
                            <li>• {comparison.processing.rules}</li>
                            <li>• {comparison.cost.rules}</li>
                            <li>• {comparison.subscription.rules}</li>
                            <li>• {comparison.groupQuality.rules}</li>
                        </ul>
                    </div>
                    <div>
                        <div className="font-medium text-purple-800 mb-2">AI-Enhanced</div>
                        <ul className="space-y-1 text-purple-700">
                            <li>• {comparison.processing.ai}</li>
                            <li>• {comparison.cost.ai}</li>
                            <li>• {comparison.subscription.ai}</li>
                            <li>• {comparison.groupQuality.ai}</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Generate Button */}
            <div className="flex justify-center">
                <button
                    onClick={handleGenerateRules}
                    disabled={isGenerating || contacts.length < 2}
                    className="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    {isGenerating ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>Generating...</span>
                        </>
                    ) : (
                        <>
                            <span className="text-lg">⚡</span>
                            <div className="text-left">
                                <div>Generate Rules-Based Groups</div>
                                <div className="text-xs opacity-90">
                                    Free • Immediate Results
                                </div>
                            </div>
                        </>
                    )}
                </button>
            </div>

            {contacts.length < 2 && (
                <div className="text-center text-sm text-gray-500">
                    You need at least 2 contacts to use group generation
                </div>
            )}
        </div>
    );
}