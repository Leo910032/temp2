// app/admin/components/AdminVectorContactTestPanel.jsx - REFACTORED VERSION
// Follows admin service architecture pattern with proper separation of concerns
"use client"
import { useState, useEffect, useCallback } from 'react';
import { AdminServiceVector } from '@/lib/services/serviceAdmin/client/adminServiceVector';

export default function AdminVectorContactTestPanel({ targetUser }) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationInfo, setGenerationInfo] = useState(null);
    const [vectorInfo, setVectorInfo] = useState(null);
    const [isLoadingInfo, setIsLoadingInfo] = useState(true);
    const [selectedScenario, setSelectedScenario] = useState('vectorOptimized');
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    const [customOptions, setCustomOptions] = useState({
        count: 30,
        eventPercentage: 0.6,
        locationPercentage: 0.8,
        forceEventLocation: false,
        forceRandomLocation: false,
        // Vector-specific options
        enableVectorStorage: true,
        forceVectorCreation: true,
        vectorOptimizationLevel: 'premium',
        // Enhanced note options for better vectors
        includeNotes: true,
        noteScenario: 'vectorOptimized',
        noteComplexity: 'premium',
        noteProbability: 0.95,
        // Message options
        includeMessages: true,
        messageProbability: 0.8,
        forceExchangeForm: true
    });

    // Vector-optimized generation scenarios
    const VECTOR_GENERATION_SCENARIOS = {
        vectorOptimized: {
            name: 'Vector-Optimized Premium',
            description: 'Generate contacts with rich notes optimized for semantic search and vector storage. Perfect for testing premium AI features.',
            params: {
                count: 30,
                eventPercentage: 0.7,
                locationPercentage: 0.9,
                enableVectorStorage: true,
                forceVectorCreation: true,
                vectorOptimizationLevel: 'premium',
                includeNotes: true,
                noteScenario: 'vectorOptimized',
                noteComplexity: 'premium',
                noteProbability: 0.95,
                includeMessages: true,
                messageProbability: 0.9,
                forceExchangeForm: true
            },
            aiFeature: 'Semantic Search + Vector Storage',
            model: 'gemini-2.5-pro + Pinecone',
            tier: 'premium+'
        },
        
        businessIntelligence: {
            name: 'Business Intelligence Test',
            description: 'Contacts with business-focused notes for testing enterprise-level semantic search and relationship mapping.',
            params: {
                count: 40,
                eventPercentage: 0.8,
                locationPercentage: 0.85,
                enableVectorStorage: true,
                forceVectorCreation: true,
                vectorOptimizationLevel: 'business',
                includeNotes: true,
                noteScenario: 'businessIntelligence',
                noteComplexity: 'business',
                noteProbability: 1.0,
                includeMessages: true,
                messageProbability: 0.7,
                forceExchangeForm: false
            },
            aiFeature: 'Business Intelligence + Relationship Mapping',
            model: 'gemini-2.5-flash + Pinecone',
            tier: 'business+'
        },

        semanticSearchStress: {
            name: 'Semantic Search Stress Test',
            description: 'High-volume generation with complex, nuanced notes to stress-test vector search performance and accuracy.',
            params: {
                count: 100,
                eventPercentage: 0.5,
                locationPercentage: 0.7,
                enableVectorStorage: true,
                forceVectorCreation: true,
                vectorOptimizationLevel: 'enterprise',
                includeNotes: true,
                noteScenario: 'semanticSearchStress',
                noteComplexity: 'strategic',
                noteProbability: 0.9,
                includeMessages: true,
                messageProbability: 0.6,
                forceExchangeForm: false
            },
            aiFeature: 'High-Volume Semantic Search',
            model: 'gemini-2.5-pro + Pinecone',
            tier: 'enterprise'
        },

        vectorPerformance: {
            name: 'Vector Performance Benchmark',
            description: 'Generate contacts specifically designed to test vector storage, retrieval speed, and search accuracy.',
            params: {
                count: 50,
                eventPercentage: 0.6,
                locationPercentage: 0.8,
                enableVectorStorage: true,
                forceVectorCreation: true,
                vectorOptimizationLevel: 'premium',
                includeNotes: true,
                noteScenario: 'vectorPerformance',
                noteComplexity: 'premium',
                noteProbability: 1.0,
                includeMessages: true,
                messageProbability: 0.5,
                forceExchangeForm: true
            },
            aiFeature: 'Vector Performance Testing',
            model: 'gemini-2.5-flash + Pinecone',
            tier: 'premium+'
        },

        mixedTierTest: {
            name: 'Mixed Tier Compatibility',
            description: 'Generate contacts that work across different subscription tiers for compatibility testing.',
            params: {
                count: 60,
                eventPercentage: 0.4,
                locationPercentage: 0.7,
                enableVectorStorage: true,
                forceVectorCreation: false, // Only create vectors for eligible tiers
                vectorOptimizationLevel: 'auto',
                includeNotes: true,
                noteScenario: 'mixed',
                noteComplexity: 'medium',
                noteProbability: 0.7,
                includeMessages: true,
                messageProbability: 0.8,
                forceExchangeForm: false
            },
            aiFeature: 'Cross-Tier Compatibility',
            model: 'Adaptive based on tier',
            tier: 'all'
        }
    };

// Load generation and vector info using AdminServiceVector
const loadGenerationAndVectorInfo = useCallback(async () => {
    if (!targetUser) return;

    try {
        setIsLoadingInfo(true);

        // Use AdminServiceVector to fetch both generation and vector info
        const info = await AdminServiceVector.fetchGenerationAndVectorInfo(targetUser.id);

        setGenerationInfo(info.generation);
        setVectorInfo(info.vector);

    } catch (error) {
        console.error('Error loading info:', error);
    } finally {
        setIsLoadingInfo(false);
    }
}, [targetUser]);

useEffect(() => {
    if (targetUser) {
        loadGenerationAndVectorInfo();
    }
}, [targetUser, loadGenerationAndVectorInfo]);


    const handleQuickGenerate = async (scenario) => {
        setIsGenerating(true);

        try {
            const scenarioConfig = VECTOR_GENERATION_SCENARIOS[scenario];
            // Use AdminServiceVector instead of onGenerate prop
            await AdminServiceVector.generateVectorContacts(targetUser.id, scenarioConfig.params);
            await loadGenerationAndVectorInfo();
        } catch (error) {
            console.error('Generation error:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCustomGenerate = async () => {
        setIsGenerating(true);

        try {
            // Use AdminServiceVector instead of onGenerate prop
            await AdminServiceVector.generateVectorContacts(targetUser.id, customOptions);
            await loadGenerationAndVectorInfo();
        } catch (error) {
            console.error('Generation error:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleScenarioGenerate = async () => {
        await handleQuickGenerate(selectedScenario);
    };

    const handleCleanup = async () => {
        setIsGenerating(true);

        try {
            // Use AdminServiceVector for cleanup
            await AdminServiceVector.cleanupVectorTestData(targetUser.id);
            await loadGenerationAndVectorInfo();
        } catch (error) {
            console.error('Cleanup error:', error);
        } finally {
            setIsGenerating(false);
        }
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

    const hasVectorSupport = vectorInfo?.hasVectorSupport || false;
    const subscriptionTier = vectorInfo?.subscriptionTier || 'base';

    return (
        <div className="space-y-6">
            {/* Target User Info with Vector Status */}
            <div className={`rounded-lg p-4 border-2 ${
                hasVectorSupport 
                    ? 'bg-purple-50 border-purple-200' 
                    : 'bg-orange-50 border-orange-200'
            }`}>
                <h4 className="text-sm font-semibold mb-2 flex items-center">
                    <span className="mr-2">🎯</span>
                    Target User: {targetUser.displayName} (@{targetUser.username})
                </h4>
                <div className="text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <span className="text-gray-600">Account Type:</span>{' '}
                            <span className={`font-medium px-2 py-1 rounded text-xs ml-1 ${
                                subscriptionTier === 'enterprise' ? 'bg-yellow-100 text-yellow-800' :
                                subscriptionTier === 'business' ? 'bg-purple-100 text-purple-800' :
                                subscriptionTier === 'premium' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                            }`}>
                                {subscriptionTier}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-600">Vector Support:</span>{' '}
                            <span className={`font-medium px-2 py-1 rounded text-xs ml-1 ${
                                hasVectorSupport 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                            }`}>
                                {hasVectorSupport ? 'Enabled' : 'Not Available'}
                            </span>
                        </div>
                    </div>
                    
                    {vectorInfo && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div>
                                    <div className="font-medium text-purple-600">{vectorInfo.vectorsStored || 0}</div>
                                    <div className="text-gray-600">Vectors Stored</div>
                                </div>
                                <div>
                                    <div className="font-medium text-blue-600">{vectorInfo.totalContacts || 0}</div>
                                    <div className="text-gray-600">Total Contacts</div>
                                </div>
                                <div>
                                    <div className="font-medium text-green-600">
                                        {vectorInfo.vectorPercentage ? `${vectorInfo.vectorPercentage.toFixed(1)}%` : '0%'}
                                    </div>
                                    <div className="text-gray-600">Vector Coverage</div>
                                </div>
                                <div>
                                    <div className="font-medium text-indigo-600">
                                        {vectorInfo.pineconeIndexStatus || 'unknown'}
                                    </div>
                                    <div className="text-gray-600">Index Status</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Warning for non-vector users */}
            {!hasVectorSupport && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                        <span className="text-yellow-600 mr-2 text-lg">⚠️</span>
                        <div>
                            <h4 className="font-medium text-yellow-800">Limited Vector Features</h4>
                            <p className="text-sm text-yellow-700 mt-1">
                                This user has a {subscriptionTier} subscription. Vector storage and semantic search 
                                require Premium tier or higher. Generated contacts will be stored in Firestore only.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Current Stats with Vector Info */}
            {(generationInfo?.currentStats || vectorInfo) && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <span className="mr-2">📊</span>
                        Current Statistics & Vector Status
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                                {generationInfo?.currentStats?.totalContacts || 0}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">Total Contacts</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                                {vectorInfo?.vectorsStored || 0}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">Vectors Stored</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                                {generationInfo?.currentStats?.withLocation || 0}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">With Location</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-amber-600">
                                {generationInfo?.currentStats?.withNotes || 0}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">With Notes</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">
                                {generationInfo?.currentStats?.bySource?.admin_test || 0}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">Test Data</div>
                        </div>
                    </div>

                    {/* Vector Performance Metrics */}
                    {hasVectorSupport && vectorInfo && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="text-xs font-medium text-gray-600 mb-2">Vector Performance:</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white p-2 rounded border">
                                    <div className="text-sm font-bold text-purple-600">
                                        {vectorInfo.vectorDimensions || 0}
                                    </div>
                                    <div className="text-xs text-gray-600">Dimensions</div>
                                </div>
                                <div className="bg-white p-2 rounded border">
                                    <div className="text-sm font-bold text-indigo-600">
                                        {vectorInfo.lastVectorUpdate ? 'Recent' : 'None'}
                                    </div>
                                    <div className="text-xs text-gray-600">Last Update</div>
                                </div>
                                <div className="bg-white p-2 rounded border">
                                    <div className="text-sm font-bold text-blue-600">
                                        {vectorInfo.contactsWithRichData || 0}
                                    </div>
                                    <div className="text-xs text-gray-600">Rich Data</div>
                                </div>
                                <div className="bg-white p-2 rounded border">
                                    <div className="text-sm font-bold text-green-600">
                                        {vectorInfo.indexName ? 'Ready' : 'N/A'}
                                    </div>
                                    <div className="text-xs text-gray-600">Index</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Test Data Cleanup */}
                    {generationInfo?.testDataInfo?.totalTestContacts > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    <p>
                                        <span className="font-semibold">
                                            {generationInfo.testDataInfo.totalTestContacts}
                                        </span> test contacts found.
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Includes {generationInfo.testDataInfo.testContactsWithMessages || 0} with vectors.
                                    </p>
                                </div>
                                <button
                                    onClick={handleCleanup}
                                    disabled={isGenerating}
                                    className="px-4 py-2 text-sm font-semibold text-red-700 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isGenerating ? 'Cleaning...' : 'Cleanup All Test Data'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Vector-Optimized Scenario Generation */}
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <h4 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">🔮</span>
                    Vector-Optimized Scenarios
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                    Generate contacts specifically designed for testing semantic search, vector storage, 
                    and premium AI features. These scenarios create rich, searchable contact data.
                </p>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="vector-scenario-select" className="block text-sm font-medium text-gray-700 mb-1">
                            Select Vector Scenario
                        </label>
                        <select
                            id="vector-scenario-select"
                            value={selectedScenario}
                            onChange={(e) => setSelectedScenario(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                        >
                            {Object.entries(VECTOR_GENERATION_SCENARIOS).map(([key, scenario]) => (
                                <option key={key} value={key}>
                                    {scenario.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Scenario Details */}
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-md p-3 text-sm border border-purple-200">
                        <p className="font-semibold text-purple-900">
                            {VECTOR_GENERATION_SCENARIOS[selectedScenario].name}
                        </p>
                        <p className="text-xs text-purple-700 mt-1">
                            {VECTOR_GENERATION_SCENARIOS[selectedScenario].description}
                        </p>
                        <div className="mt-2 text-xs flex flex-wrap items-center gap-2">
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-medium">
                                {VECTOR_GENERATION_SCENARIOS[selectedScenario].aiFeature}
                            </span>
                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                                {VECTOR_GENERATION_SCENARIOS[selectedScenario].model}
                            </span>
                            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
                                Tier: {VECTOR_GENERATION_SCENARIOS[selectedScenario].tier}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleScenarioGenerate}
                        disabled={isGenerating}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? 'Generating...' : `Generate ${VECTOR_GENERATION_SCENARIOS[selectedScenario].params.count} Vector-Optimized Contacts`}
                    </button>
                </div>
            </div>

            {/* Advanced Vector Configuration */}
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full text-left text-base font-semibold text-gray-800 flex justify-between items-center"
                >
                    <span className="flex items-center">
                        <span className="mr-2">⚙️</span>
                        Advanced Vector Configuration
                    </span>
                    <span className={`transform transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}>
                        ▼
                    </span>
                </button>
                
                {showAdvanced && (
                    <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        {/* Left Column - Basic Settings */}
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="vector-count" className="block text-sm font-medium text-gray-700">
                                    Contact Count
                                </label>
                                <input 
                                    type="number" 
                                    id="vector-count" 
                                    min="1" 
                                    max="200"
                                    value={customOptions.count} 
                                    onChange={e => setCustomOptions({...customOptions, count: parseInt(e.target.value) || 0})} 
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" 
                                />
                            </div>

                            <div>
                                <label htmlFor="vector-event-percentage" className="block text-sm font-medium text-gray-700">
                                    Event % ({Math.round(customOptions.eventPercentage * 100)}%)
                                </label>
                                <input 
                                    type="range" 
                                    id="vector-event-percentage" 
                                    min="0" 
                                    max="1" 
                                    step="0.05" 
                                    value={customOptions.eventPercentage} 
                                    onChange={e => setCustomOptions({...customOptions, eventPercentage: parseFloat(e.target.value)})} 
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                                />
                            </div>
                            
                            <div>
                                <label htmlFor="vector-location-percentage" className="block text-sm font-medium text-gray-700">
                                    Location % ({Math.round(customOptions.locationPercentage * 100)}%)
                                </label>
                                <input 
                                    type="range" 
                                    id="vector-location-percentage" 
                                    min="0" 
                                    max="1" 
                                    step="0.05" 
                                    value={customOptions.locationPercentage} 
                                    onChange={e => setCustomOptions({...customOptions, locationPercentage: parseFloat(e.target.value)})} 
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                                />
                            </div>
                        </div>

                        {/* Right Column - Vector Settings */}
                        <div className="space-y-4">
                            {/* Vector Storage Settings */}
                            <div className="border border-purple-200 rounded-lg p-3 bg-purple-50">
                                <div className="flex items-center mb-3">
                                    <input 
                                        id="enable-vector-storage" 
                                        type="checkbox" 
                                        checked={customOptions.enableVectorStorage} 
                                        onChange={e => setCustomOptions({...customOptions, enableVectorStorage: e.target.checked})} 
                                        className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" 
                                    />
                                    <label htmlFor="enable-vector-storage" className="ml-2 block text-sm font-medium text-purple-900">
                                        Enable Vector Storage (Pinecone)
                                    </label>
                                </div>
                                
                                {customOptions.enableVectorStorage && (
                                    <>
                                        <div className="mb-3">
                                            <label htmlFor="vector-optimization" className="block text-sm font-medium text-purple-700">
                                                Vector Optimization Level
                                            </label>
                                            <select 
                                                id="vector-optimization" 
                                                value={customOptions.vectorOptimizationLevel} 
                                                onChange={e => setCustomOptions({...customOptions, vectorOptimizationLevel: e.target.value})} 
                                                className="mt-1 block w-full p-2 border border-purple-300 rounded-md shadow-sm bg-white"
                                            >
                                                <option value="auto">Auto (Based on User Tier)</option>
                                                <option value="premium">Premium (Standard Vectors)</option>
                                                <option value="business">Business (Enhanced Vectors)</option>
                                                <option value="enterprise">Enterprise (Full Optimization)</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center">
                                            <input 
                                                id="force-vector-creation" 
                                                type="checkbox" 
                                                checked={customOptions.forceVectorCreation} 
                                                onChange={e => setCustomOptions({...customOptions, forceVectorCreation: e.target.checked})} 
                                                className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" 
                                            />
                                            <label htmlFor="force-vector-creation" className="ml-2 block text-sm text-purple-800">
                                                Force Vector Creation (Override tier limits)
                                            </label>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Enhanced Notes for Vectors */}
                            <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                                <div className="flex items-center mb-3">
                                    <input 
                                        id="vector-include-notes" 
                                        type="checkbox" 
                                        checked={customOptions.includeNotes} 
                                        onChange={e => setCustomOptions({...customOptions, includeNotes: e.target.checked})} 
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                                    />
                                    <label htmlFor="vector-include-notes" className="ml-2 block text-sm font-medium text-blue-900">
                                        Include Vector-Optimized Notes
                                    </label>
                                </div>

                                {customOptions.includeNotes && (
                                    <>
                                        <div className="mb-2">
                                            <label htmlFor="vector-note-prob" className="block text-sm font-medium text-blue-700">
                                                Note Probability ({Math.round(customOptions.noteProbability * 100)}%)
                                            </label>
                                            <input 
                                                type="range" 
                                                id="vector-note-prob" 
                                                min="0" 
                                                max="1" 
                                                step="0.05" 
                                                value={customOptions.noteProbability} 
                                                onChange={e => setCustomOptions({...customOptions, noteProbability: parseFloat(e.target.value)})} 
                                                className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer" 
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="vector-note-scenario" className="block text-sm font-medium text-blue-700">
                                                Note Scenario (Vector-Optimized)
                                            </label>
                                            <select 
                                                id="vector-note-scenario" 
                                                value={customOptions.noteScenario} 
                                                onChange={e => setCustomOptions({...customOptions, noteScenario: e.target.value})} 
                                                className="mt-1 block w-full p-2 border border-blue-300 rounded-md shadow-sm bg-white"
                                            >
                                                <option value="vectorOptimized">Vector-Optimized (Rich Semantic Content)</option>
                                                <option value="businessIntelligence">Business Intelligence</option>
                                                <option value="semanticSearchStress">Semantic Search Stress Test</option>
                                                <option value="vectorPerformance">Vector Performance Test</option>
                                                <option value="mixed">Mixed (Standard Notes)</option>
                                                <option value="companyMatching">Company Matching</option>
                                                <option value="industryDetection">Industry Detection</option>
                                                <option value="relationshipDetection">Relationship Detection</option>
                                                <option value="strategicAnalysis">Strategic Analysis</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div className="md:col-span-2 mt-4">
                            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200 mb-4">
                                <h5 className="font-medium text-purple-900 mb-2">Expected Results:</h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                        <div className="font-bold text-purple-600">{customOptions.count}</div>
                                        <div className="text-xs text-gray-600">Total Contacts</div>
                                    </div>
                                    <div>
                                        <div className="font-bold text-blue-600">
                                            {customOptions.enableVectorStorage && hasVectorSupport ? customOptions.count : 0}
                                        </div>
                                        <div className="text-xs text-gray-600">Vectors Created</div>
                                    </div>
                                    <div>
                                        <div className="font-bold text-green-600">
                                            {Math.round(customOptions.count * customOptions.noteProbability)}
                                        </div>
                                        <div className="text-xs text-gray-600">With Rich Notes</div>
                                    </div>
                                    <div>
                                        <div className="font-bold text-amber-600">
                                            {Math.round(customOptions.count * customOptions.eventPercentage)}
                                        </div>
                                        <div className="text-xs text-gray-600">From Events</div>
                                    </div>
                                </div>
                                
                                {customOptions.enableVectorStorage && !hasVectorSupport && (
                                    <div className="mt-3 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
                                       <strong>Note:</strong> Vector storage is enabled but user&apos;s tier ({subscriptionTier}) doesn&apos;t support it. 
Contacts will be created but vectors will be skipped.
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleCustomGenerate}
                                disabled={isGenerating}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? 'Generating...' : `Generate ${customOptions.count} Vector-Enhanced Contacts`}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}