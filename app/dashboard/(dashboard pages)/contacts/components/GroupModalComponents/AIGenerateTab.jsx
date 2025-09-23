// /////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Updated AIGenerateTab.jsx - Remove local usage hook and use parent's data

"use client"
import { useState, useEffect } from 'react';
import { ContactServiceFactory } from '@/lib/services/serviceContact/client/factories/ContactServiceFactory';
import { getAIFeaturesForLevel } from '@/lib/services/serviceContact/client/constants/contactConstants';

export default function AIGenerateTab({
    contacts = [],
    formState = { aiOptions: {} },
    updateFormState,
    subscriptionLevel = 'base',
    availableFeatures = [],
    backgroundJobId,
    onGenerateAIGroups,
    onShowJobProgress,
    lastGenerationResult = null,
    // NEW: Receive usage info from parent instead of fetching locally
    usageInfo = null,
    usageLoading = false,
    onRefreshUsage = null // Optional callback to trigger parent refresh
}) {
    // Existing state - REMOVED usageInfo local state
    const [costEstimate, setCostEstimate] = useState(null);
    const [estimating, setEstimating] = useState(false);
    
    // Track actual cost after generation
    const [actualCost, setActualCost] = useState(null);
    const [showActualCost, setShowActualCost] = useState(false);
    
    const availableAiFeatures = getAIFeaturesForLevel(subscriptionLevel);

    const updateAIOptions = (updates) => {
        if (updateFormState) {
            updateFormState({
                aiOptions: {
                    ...formState.aiOptions,
                    ...updates
                }
            });
        }
    };

    // Set Enterprise defaults
    useEffect(() => {
        if (subscriptionLevel === 'enterprise' && !formState.aiOptions?.useDeepAnalysis) {
            updateAIOptions({ useDeepAnalysis: true });
        }
    }, [subscriptionLevel]);

    // Initialize AI options
    useEffect(() => {
        if (!formState.aiOptions || Object.keys(formState.aiOptions).length === 0) {
            console.log('[AIGenerateTab] Initializing AI options state with defaults.');
            updateAIOptions({
                groupByCompany: true,
                groupByTime: true,
                groupByLocation: false,
                groupByEvents: false,
                minGroupSize: 2,
                maxGroups: 10,
                useSmartCompanyMatching: false,
                useIndustryDetection: false,
                useRelationshipDetection: false,
                useDeepAnalysis: subscriptionLevel === 'enterprise'
            });
        }
    }, [subscriptionLevel]);

    // UPDATED: Cost estimation only - no usage info fetching
    useEffect(() => {
        async function estimateCost() {
            if (!subscriptionLevel || !formState.aiOptions) return;
            
            setEstimating(true);
            try {
                console.log('[AIGenerateTab] Estimating cost for:', { subscriptionLevel, aiOptions: formState.aiOptions });
                
                const aicostService = ContactServiceFactory.getAICostService();
                const estimate = await aicostService.estimateOperationCost(subscriptionLevel, formState.aiOptions);
                
                console.log('[AIGenerateTab] Got estimate:', estimate);
                setCostEstimate(estimate);
                
                // NO LONGER FETCHING USAGE INFO HERE - using parent's data
            } catch (error) {
                console.error('[AIGenerateTab] Cost estimation failed:', error);
                setCostEstimate(null);
            } finally {
                setEstimating(false);
            }
        }
        
        estimateCost();
    }, [subscriptionLevel, formState.aiOptions]);

    // Handle actual cost display when generation completes
    useEffect(() => {
        if (lastGenerationResult && lastGenerationResult.actualCost !== undefined) {
            setActualCost(lastGenerationResult.actualCost);
            setShowActualCost(true);
            
            // Auto-hide after 10 seconds
            const timer = setTimeout(() => {
                setShowActualCost(false);
            }, 10000);
            
            return () => clearTimeout(timer);
        }
    }, [lastGenerationResult]);

    const handleGenerateGroups = async () => {
        if (!onGenerateAIGroups) {
            console.error('onGenerateAIGroups handler not provided');
            return;
        }

        // Hide any previous actual cost display
        setShowActualCost(false);
        setActualCost(null);

        const currentOptions = formState.aiOptions || {};
        console.log('[AIGenerateTab] Raw options from form state before sending:', JSON.stringify(currentOptions, null, 2));

        const finalOptions = {
            groupByCompany: currentOptions.groupByCompany || false,
            groupByTime: currentOptions.groupByTime || false,
            groupByLocation: currentOptions.groupByLocation || false,
            groupByEvents: currentOptions.groupByEvents || false,
            minGroupSize: currentOptions.minGroupSize || 2,
            maxGroups: currentOptions.maxGroups || 10,
            useDeepAnalysis: currentOptions.useDeepAnalysis || false,
            useSmartCompanyMatching: !!(currentOptions.useSmartCompanyMatching && availableAiFeatures.smartCompanyMatching),
            useIndustryDetection: !!(currentOptions.useIndustryDetection && availableAiFeatures.industryDetection),
            useRelationshipDetection: !!(currentOptions.useRelationshipDetection && availableAiFeatures.relationshipDetection),
        };
        
        console.log('[AIGenerateTab] Final sanitized options being sent to parent:', JSON.stringify(finalOptions, null, 2));
        try {
            await onGenerateAIGroups(finalOptions);
            
            // NEW: Trigger parent usage refresh after generation starts
            if (onRefreshUsage) {
                console.log('[AIGenerateTab] Triggering parent usage refresh');
                onRefreshUsage();
            }
        } catch (error) {
            console.error('AI generation failed in tab:', error);
        }
    };

    return (
        <div className="space-y-6">
            <AIIntroduction subscriptionLevel={subscriptionLevel} />
            
            {/* Enterprise Badge */}
            {subscriptionLevel === 'enterprise' && (
                <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-full">
                        Enterprise
                    </span>
                    <span className="text-sm text-gray-600">
                        Unlimited AI operations with premium models
                    </span>
                </div>
            )}
            
            {/* Actual Cost Display (shows after generation) */}
            {showActualCost && actualCost !== null && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-green-900 flex items-center">
                                ✅ Generation Complete
                                <button 
                                    onClick={() => setShowActualCost(false)}
                                    className="ml-2 text-green-600 hover:text-green-800"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="text-sm text-green-700">
                                Actual cost for this operation
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-semibold text-green-900">
                                {formatCost(actualCost)}
                            </div>
                            <div className="text-xs text-green-600">
                                {costEstimate && (
                                    <span>
                                        Est. {formatCost(costEstimate.estimatedCost)}
                                        {Math.abs(actualCost - costEstimate.estimatedCost) < 0.0001 ? 
                                            ' ✓' : 
                                            ` (${actualCost > costEstimate.estimatedCost ? '+' : ''}${formatCost(actualCost - costEstimate.estimatedCost)})`
                                        }
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cost Estimation Display (shows before generation) */}
            {costEstimate && !showActualCost && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-blue-900 flex items-center">
                                Estimated Cost
                                <InfoTooltip content="Cost based on actual token usage from Google's Gemini API" />
                            </div>
                            <div className="text-sm text-blue-700">
                                {costEstimate.useDeepAnalysis ? 'Deep Analysis' : 'Standard Analysis'}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-semibold text-blue-900">
                                {estimating ? '...' : formatCost(costEstimate.estimatedCost)}
                            </div>
                            <div className="text-xs text-blue-600">
                                {(costEstimate.featuresEnabled?.length || 0)} features
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* UPDATED: Current Month Usage using parent's data */}
            {usageInfo && subscriptionLevel !== 'enterprise' && (
                <CurrentMonthUsageCard 
                    usageInfo={usageInfo} 
                    usageLoading={usageLoading}
                    onRefresh={onRefreshUsage}
                />
            )}
            
            {backgroundJobId && (
                <ActiveJobNotification onShowJobProgress={onShowJobProgress} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BasicOptions
                    aiOptions={formState.aiOptions || {}}
                    updateAIOptions={updateAIOptions}
                    backgroundJobId={backgroundJobId}
                />
                
                <AIFeatures
                    aiOptions={formState.aiOptions || {}}
                    updateAIOptions={updateAIOptions}
                    availableAiFeatures={availableAiFeatures}
                    subscriptionLevel={subscriptionLevel}
                    backgroundJobId={backgroundJobId}
                />
            </div>

            {/* Enterprise Deep Analysis Section */}
            {subscriptionLevel === 'enterprise' && (
                <div className="border-t pt-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h4 className="font-medium text-purple-900 mb-3">Enterprise Features</h4>
                        
                        <label className="flex items-start">
                            <input
                                type="checkbox"
                                checked={formState.aiOptions?.useDeepAnalysis || false}
                                onChange={(e) => updateAIOptions({ useDeepAnalysis: e.target.checked })}
                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 mt-1"
                                disabled={!!backgroundJobId}
                            />
                            <div className="ml-3">
                                <div className="text-sm font-medium text-purple-900 flex items-center">
                                    Deep Strategic Analysis
                                    <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                        Default
                                    </span>
                                </div>
                                <div className="text-xs text-purple-700 mt-1">
                                    Use our most advanced AI model for complex insights (~20x more powerful)
                                </div>
                            </div>
                        </label>
                        
                        {formState.aiOptions?.useDeepAnalysis && (
                            <div className="mt-3 text-xs text-purple-600 bg-purple-100 rounded p-2">
                                Deep Analysis provides superior relationship detection and strategic insights.
                                Cost: ~$0.035 per operation vs ~$0.001 for standard analysis.
                            </div>
                        )}
                    </div>
                </div>
            )}

            <GenerateButton
                contacts={contacts}
                onGenerate={handleGenerateGroups}
                disabled={!!backgroundJobId || (contacts?.length || 0) < 5}
                costEstimate={costEstimate}
            />
            
            {(contacts?.length || 0) < 5 && <MinContactsWarning />}
        </div>
    );
}

// UPDATED: CurrentMonthUsageCard with refresh button
function CurrentMonthUsageCard({ usageInfo, usageLoading, onRefresh }) {
    const currentMonth = usageInfo?.currentMonth;
    const usage = currentMonth?.usage;
    const limits = currentMonth?.limits;
    
    if (!currentMonth || !usage || !limits) {
        return null;
    }

    return (
        <div className="bg-gray-50 border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">This Month's Usage</h4>
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        disabled={usageLoading}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                        title="Refresh usage info"
                    >
                        <svg 
                            className={`w-4 h-4 ${usageLoading ? 'animate-spin' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                )}
            </div>
            
            <div className="space-y-1">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cost:</span>
                    <span className="font-medium">
                        {formatCost(usage.totalCost)} 
                        / {formatCost(limits.maxCost)}
                    </span>
                </div>
                
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Runs:</span>
                    <span className="font-medium">
                        {usage.totalRuns || 0} 
                        / {limits.maxRuns || 0}
                    </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ 
                            width: `${Math.min(currentMonth.percentageUsed || 0, 100)}%` 
                        }}
                    ></div>
                </div>
            </div>
        </div>
    );
}

// Rest of the existing components remain the same...
function AIIntroduction({ subscriptionLevel }) {
    return (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered Group Generation</h3>
            <p className="text-gray-600 mb-4">
                Let our AI analyze your contacts and create intelligent groups. This process runs in the background so you can continue using the app.
            </p>
        </div>
    );
}

function ActiveJobNotification({ onShowJobProgress }) {
    return (
        <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
            <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div>
                    <div className="font-medium text-blue-900">AI Analysis Running</div>
                    <div className="text-sm text-blue-700">
                        Group generation is running in the background. You can close this modal and continue using the app.
                    </div>
                </div>
                {onShowJobProgress && (
                    <button
                        onClick={onShowJobProgress}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                        View Progress
                    </button>
                )}
            </div>
        </div>
    );
}

// ... (rest of components stay the same)

function BasicOptions({ aiOptions = {}, updateAIOptions, backgroundJobId }) {
    const options = [
        {
            key: 'groupByCompany',
            label: 'Group by Company',
            description: 'Groups contacts from the same organization'
        },
        {
            key: 'groupByTime',
            label: 'Group by Time/Events',
            description: 'Groups contacts added around the same time'
        },
        {
            key: 'groupByLocation',
            label: 'Group by Location',
            description: 'Groups contacts from similar locations'
        }
    ];

    return (
        <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Basic Grouping Options</h4>
            
            {options.map(option => (
                <CheckboxOption
                    key={option.key}
                    checked={aiOptions[option.key] || false}
                    onChange={(checked) => updateAIOptions({ [option.key]: checked })}
                    label={option.label}
                    description={option.description}
                    disabled={!!backgroundJobId}
                />
            ))}

            <NumberInput
                label="Minimum Group Size"
                value={aiOptions.minGroupSize || 3}
                onChange={(value) => updateAIOptions({ minGroupSize: parseInt(value) || 3 })}
                min={2}
                max={10}
                disabled={!!backgroundJobId}
            />

            <NumberInput
                label="Maximum Groups"
                value={aiOptions.maxGroups || 10}
                onChange={(value) => updateAIOptions({ maxGroups: parseInt(value) || 10 })}
                min={1}
                max={20}
                disabled={!!backgroundJobId}
            />
        </div>
    );
}

function AIFeatures({ aiOptions = {}, updateAIOptions, availableAiFeatures = {}, subscriptionLevel, backgroundJobId }) {
    const features = [
        { key: 'useSmartCompanyMatching', feature: 'smartCompanyMatching', label: 'Smart Company Matching', description: 'Groups variants like "Microsoft Corp" and "Microsoft Inc"' },
        { key: 'useIndustryDetection', feature: 'industryDetection', label: 'Industry Detection', description: 'Groups contacts by business domain (Tech, Healthcare, etc.)' },
        { key: 'useRelationshipDetection', feature: 'relationshipDetection', label: 'Relationship Detection', description: 'Finds business relationships and partnerships' }
    ];

    const availableFeatureCount = Object.values(availableAiFeatures).filter(v => v === true).length;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">AI Features</h4>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                    {subscriptionLevel?.toUpperCase() || 'BASE'}
                </span>
            </div>

            {features.map(feature => {
                const isAvailable = !!availableAiFeatures[feature.feature];
                return (
                    <CheckboxOption
                        key={feature.key}
                        checked={(aiOptions[feature.key] || false) && isAvailable}
                        onChange={(checked) => updateAIOptions({ [feature.key]: checked })}
                        label={feature.label}
                        description={feature.description}
                        disabled={!isAvailable || !!backgroundJobId}
                    />
                );
            })}

            {availableFeatureCount <= 1 && subscriptionLevel !== 'enterprise' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="text-sm text-yellow-800">
                        Upgrade to Business or Enterprise for more AI features!
                    </div>
                </div>
            )}
        </div>
    );
}

function CheckboxOption({ checked, onChange, label, description, disabled }) {
    return (
        <label className="flex items-center gap-2">
            <input 
                type="checkbox" 
                checked={checked || false}
                onChange={(e) => onChange && onChange(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                disabled={disabled}
            />
            <div>
                <div className="text-sm text-gray-700">{label}</div>
                <div className="text-xs text-gray-500">{description}</div>
            </div>
        </label>
    );
}

function NumberInput({ label, value, onChange, min, max, disabled }) {
    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <input 
                type="number" 
                min={min}
                max={max}
                value={value || min}
                onChange={(e) => onChange && onChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={disabled}
            />
        </div>
    );
}

function GenerateButton({ contacts = [], onGenerate, disabled, costEstimate }) {
    return (
        <div className="flex justify-center mt-6">
            <button 
                onClick={onGenerate}
                disabled={disabled}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
                <span className="text-lg">🚀</span>
                <div className="text-left">
                    <div>Generate Smart Groups</div>
                    {costEstimate && (
                        <div className="text-xs opacity-90">
                            Est. {formatCost(costEstimate.estimatedCost)}
                        </div>
                    )}
                </div>
            </button>
        </div>
    );
}

function MinContactsWarning() {
    return (
        <div className="text-center text-sm text-gray-500 mt-2">
            You need at least 5 contacts to use AI grouping
        </div>
    );
}

function InfoTooltip({ content }) {
    return (
        <div className="relative group ml-1">
            <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                {content}
            </div>
        </div>
    );
}

function formatCost(cost) {
    if (cost === undefined || cost === null || isNaN(cost)) {
        return 'Calculating...';
    }
    
    if (cost === 0) return 'Free';
    if (cost === -1) return 'Unlimited';
    
    if (cost < 0.001) {
        return `$${(cost * 1000000).toFixed(1)}μ`;
    } else if (cost < 0.01) {
        return `$${cost.toFixed(6)}`;
    } else {
        return `$${cost.toFixed(4)}`;
    }
}