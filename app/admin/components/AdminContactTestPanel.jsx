// components/admin/AdminContactTestPanel.jsx - Enhanced with Notes Testing
"use client"
import { useState, useEffect, useCallback } from 'react';
import { AdminServiceContacts } from '@/lib/services/serviceAdmin/client/adminServiceContacts';

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
    forceRandomLocation: false,
    // Note options
    includeNotes: true,
    noteScenario: 'mixed',
    noteComplexity: 'medium',
    noteProbability: 0.7,
    // NEW: Message options
    includeMessages: true,
    messageProbability: 1.0,
    forceExchangeForm: true
});
   
    // Enhanced generation scenarios with AI testing focus
    const GENERATION_SCENARIOS = {
        // ========================================================================
        // ADDED: Devil's Advocate Scenarios
        // ========================================================================
        devilsAdvocateTest: {
            name: "😈 Devil's Advocate Test (Hard Mode)",
            description: "Generates contacts with ambiguous, conflicting, and subtle notes to stress-test AI reasoning.",
            params: {
                count: 50,
                eventPercentage: 0.2,
                locationPercentage: 0.5,
                includeNotes: true,
                noteScenario: 'devilsAdvocate', // Use the specific scenario
                noteComplexity: 'strategic',
                noteProbability: 1.0,
                includeMessages: true,
                messageProbability: 1.0,
                forceExchangeForm: true
            },
            aiFeature: 'Advanced Reasoning',
            model: 'gemini-2.5-pro (recommended)'
        },
        devilsAdvocateMix: {
            name: "😈 Devil's Advocate (Realistic Mix)",
            description: "A realistic mix of normal contacts with a high percentage of challenging 'Devil's Advocate' notes.",
            params: {
                count: 100,
                eventPercentage: 0.4,
                locationPercentage: 0.7,
                includeNotes: true,
                noteScenario: 'devilsAdvocate', // Use the specific scenario
                noteComplexity: 'strategic',
                noteProbability: 0.5, // 50% will have challenging notes
                includeMessages: true,
                messageProbability: 0.8,
                forceExchangeForm: false
            },
            aiFeature: 'Mixed-Complexity Reasoning',
            model: 'gemini-2.5-flash / pro'
        },
        // ========================================================================
        
        // AI Tier Testing Scenarios
        proTierTest: {
            name: 'PRO Tier Test (Company Matching)',
            description: 'Test gemini-1.5-flash company matching with optimized notes',
            params: {
                count: 50,
                eventPercentage: 0.3,
                locationPercentage: 0.6,
                includeNotes: true,
                noteScenario: 'companyMatching',
                noteComplexity: 'pro',
                noteProbability: 0.8
            },
            aiFeature: 'Smart Company Matching',
            model: 'gemini-1.5-flash'
        },
        premiumTierTest: {
            name: 'PREMIUM Tier Test (Industry Detection)',
            description: 'Test industry detection AI with varied industry notes',
            params: {
                count: 75,
                eventPercentage: 0.5,
                locationPercentage: 0.7,
                includeNotes: true,
                noteScenario: 'industryDetection',
                noteComplexity: 'premium',
                noteProbability: 0.9
            },
            aiFeature: 'Industry Detection',
            model: 'gemini-1.5-flash'
        },
        businessTierTest: {
            name: 'BUSINESS Tier Test (Relationship Detection)',
            description: 'Test relationship detection with gemini-2.5-flash-lite',
            params: {
                count: 60,
                eventPercentage: 0.7,
                locationPercentage: 0.8,
                includeNotes: true,
                noteScenario: 'relationshipDetection',
                noteComplexity: 'business',
                noteProbability: 0.95
            },
            aiFeature: 'Relationship Detection',
            model: 'gemini-2.5-flash-lite'
        },
        enterpriseTierTest: {
            name: 'ENTERPRISE Tier Test (Strategic Analysis)',
            description: 'Test deep strategic analysis with gemini-2.5-pro',
            params: {
                count: 30,
                eventPercentage: 0.8,
                locationPercentage: 0.9,
                includeNotes: true,
                noteScenario: 'strategicAnalysis',
                noteComplexity: 'strategic',
                noteProbability: 1.0
            },
            aiFeature: 'Deep Strategic Analysis',
            model: 'gemini-2.5-pro'
        },
        
        // Original scenarios (enhanced with notes)
        realisticMix: {
            name: 'Realistic Mix',
            description: 'Balanced mix with varied note complexity for general testing',
            params: {
                    count: 100,
            eventPercentage: 0.4,
            locationPercentage: 0.7,
            includeNotes: true,
            noteScenario: 'mixed',
            noteComplexity: 'medium',
            noteProbability: 0.7,
            includeMessages: true,
            messageProbability: 0.8,
            forceExchangeForm: false // Mix of sources
            }
        },
        allEvents: {
            name: 'All Events',
            description: 'All contacts from events with high-value relationship notes',
            params: {
                  count: 100,
            eventPercentage: 0.4,
            locationPercentage: 0.7,
            includeNotes: true,
            noteScenario: 'mixed',
            noteComplexity: 'medium',
            noteProbability: 0.7,
            includeMessages: true,
            messageProbability: 0.8,
            forceExchangeForm: false // Mix of sources
            }
        },
        allRandom: {
            name: 'All Random',
            description: 'Random locations with basic notes for baseline testing',
            params: {
                count: 100,
            eventPercentage: 0.4,
            locationPercentage: 0.7,
            includeNotes: true,
            noteScenario: 'mixed',
            noteComplexity: 'medium',
            noteProbability: 0.7,
            includeMessages: true,
            messageProbability: 0.8,
            forceExchangeForm: false // Mix of sources
            }
        },
        noNotesBaseline: {
            name: 'No Notes Baseline',
            description: 'Contacts without notes for comparison testing',
            params: {
                  count: 100,
            eventPercentage: 0.4,
            locationPercentage: 0.7,
            includeNotes: true,
            noteScenario: 'mixed',
            noteComplexity: 'medium',
            noteProbability: 0.7,
            includeMessages: true,
            messageProbability: 0.8,
            forceExchangeForm: false // Mix of sources
            }
        }
    };

    const loadGenerationInfo = useCallback(async () => {
        if (!targetUser) return;

        try {
            setIsLoadingInfo(true);
            const info = await AdminServiceContacts.getGenerationInfo(targetUser.id);
            setGenerationInfo(info);
        } catch (error) {
            console.error('Error loading generation info:', error);
        } finally {
            setIsLoadingInfo(false);
        }
    }, [targetUser]);

    useEffect(() => {
        if (targetUser) {
            loadGenerationInfo();
        }
    }, [targetUser, loadGenerationInfo]);
const handleQuickGenerate = async (scenario, customCount = null) => {
        setIsGenerating(true);

        try {
            const scenarioConfig = GENERATION_SCENARIOS[scenario];
            const options = customCount
                ? { ...scenarioConfig.params, count: customCount }
                : scenarioConfig.params;

            const result = await onGenerate(options);
            await loadGenerationInfo();

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

            {/* Current Stats - Enhanced with Notes Info */}
            {generationInfo?.currentStats && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <span className="mr-2">📊</span>
                        Current Contact Statistics
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
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
                            <div className="text-2xl font-bold text-amber-600">
        {generationInfo.currentStats.withNotes || 0}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">With Notes</div>
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
                                    <p>
                                        <span className="font-semibold">{generationInfo.testDataInfo.totalTestContacts}</span> test contacts found.
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Generated by the admin panel for this user.
                                    </p>
                                </div>
                                <button
                                    onClick={onCleanup}
                                    disabled={loading || isGenerating}
                                    className="px-4 py-2 text-sm font-semibold text-red-700 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {loading ? 'Cleaning...' : 'Cleanup Test Data'}
                                </button>
                            </div>
</div>
)}
</div>
)}

code
Code
download
content_copy
expand_less

{/* Scenario-based Generation */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <h4 className="text-base font-semibold text-gray-800 mb-3">
                Scenario-based Generation
            </h4>
            <p className="text-sm text-gray-600 mb-4">
                Select a pre-defined scenario to generate a specific type of test data. These are optimized for testing AI features and common use cases.
            </p>

            <div className="space-y-4">
                <div>
                    <label htmlFor="scenario-select" className="block text-sm font-medium text-gray-700 mb-1">
                        Select Scenario
                    </label>
                    <select
                        id="scenario-select"
                        value={selectedScenario}
                        onChange={(e) => setSelectedScenario(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                        {Object.entries(GENERATION_SCENARIOS).map(([key, scenario]) => (
                            <option key={key} value={key}>
                                {scenario.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Scenario Details */}
                <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700 border border-gray-200">
                    <p className="font-semibold">{GENERATION_SCENARIOS[selectedScenario].name}</p>
                    <p className="text-xs text-gray-600 mt-1">{GENERATION_SCENARIOS[selectedScenario].description}</p>
                    {GENERATION_SCENARIOS[selectedScenario].aiFeature && (
                        <div className="mt-2 text-xs flex items-center space-x-4">
                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                                AI Feature: {GENERATION_SCENARIOS[selectedScenario].aiFeature}
                            </span>
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-medium">
                                Model: {GENERATION_SCENARIOS[selectedScenario].model}
                            </span>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleScenarioGenerate}
                    disabled={loading || isGenerating}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? 'Generating...' : `Generate ${GENERATION_SCENARIOS[selectedScenario].params.count} Contacts`}
                </button>
            </div>
        </div>

        {/* Advanced / Custom Generation */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full text-left text-base font-semibold text-gray-800 flex justify-between items-center"
            >
                Advanced / Custom Generation
                <span className={`transform transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </button>
            
            {showAdvanced && (
                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {/* Left Column */}
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="custom-count" className="block text-sm font-medium text-gray-700">Count</label>
                            <input type="number" id="custom-count" value={customOptions.count} onChange={e => setCustomOptions({...customOptions, count: parseInt(e.target.value) || 0})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label htmlFor="event-percentage" className="block text-sm font-medium text-gray-700">Event % ({Math.round(customOptions.eventPercentage * 100)}%)</label>
                            <input type="range" id="event-percentage" min="0" max="1" step="0.05" value={customOptions.eventPercentage} onChange={e => setCustomOptions({...customOptions, eventPercentage: parseFloat(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        
                        <div>
                            <label htmlFor="location-percentage" className="block text-sm font-medium text-gray-700">Location % ({Math.round(customOptions.locationPercentage * 100)}%)</label>
                            <input type="range" id="location-percentage" min="0" max="1" step="0.05" value={customOptions.locationPercentage} onChange={e => setCustomOptions({...customOptions, locationPercentage: parseFloat(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        </div>
                         <div className="flex items-center space-x-6 pt-2">
                            <div className="flex items-center">
                                <input id="force-event" type="checkbox" checked={customOptions.forceEventLocation} onChange={e => setCustomOptions({...customOptions, forceEventLocation: e.target.checked})} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                <label htmlFor="force-event" className="ml-2 block text-sm text-gray-900">Force Event</label>
                            </div>
                            <div className="flex items-center">
                                <input id="force-random" type="checkbox" checked={customOptions.forceRandomLocation} onChange={e => setCustomOptions({...customOptions, forceRandomLocation: e.target.checked})} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                <label htmlFor="force-random" className="ml-2 block text-sm text-gray-900">Force Random</label>
                            </div>
                        </div>
                    </div>

                 <div className="space-y-4">
    {/* Notes Section */}
    <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center pt-2 mb-3">
            <input 
                id="include-notes" 
                type="checkbox" 
                checked={customOptions.includeNotes} 
                onChange={e => setCustomOptions({...customOptions, includeNotes: e.target.checked})} 
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
            />
            <label htmlFor="include-notes" className="ml-2 block text-sm font-medium text-gray-900">Include Notes (AI Testing)</label>
        </div>
        {customOptions.includeNotes && (
            <>
                <div>
                    <label htmlFor="note-prob" className="block text-sm font-medium text-gray-700">Note Probability ({Math.round(customOptions.noteProbability * 100)}%)</label>
                    <input 
                        type="range" 
                        id="note-prob" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={customOptions.noteProbability} 
                        onChange={e => setCustomOptions({...customOptions, noteProbability: parseFloat(e.target.value)})} 
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                    />
                </div>
          
                                        <div>
                                            <label htmlFor="note-scenario" className="block text-sm font-medium text-gray-700">Note Scenario</label>
                                            <select 
                                                id="note-scenario" 
                                                value={customOptions.noteScenario} 
                                                onChange={e => setCustomOptions({...customOptions, noteScenario: e.target.value})} 
                                                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                                            >
                                                <option value="mixed">Mixed (Original Notes)</option>
                                                {/* ======================================================================== */}
                                                {/* ADDED: Devil's Advocate option in the dropdown */}
                                                {/* ======================================================================== */}
                                                <option value="devilsAdvocate">😈 Devil&apos;s Advocate (Hard Mode)</option>
                                                {/* ======================================================================== */}
                                                <option value="companyMatching">Company Matching</option>
                                                <option value="industryDetection">Industry Detection</option>
                                                <option value="relationshipDetection">Relationship Detection</option>
                                                <option value="strategicAnalysis">Strategic Analysis</option>
                                                <option value="general">General</option>
                                            </select>
                                        </div>
                                        <div></div>
                <div>
                    <label htmlFor="note-complexity" className="block text-sm font-medium text-gray-700">Note Complexity</label>
                    <select 
                        id="note-complexity" 
                        value={customOptions.noteComplexity} 
                        onChange={e => setCustomOptions({...customOptions, noteComplexity: e.target.value})} 
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                    >
                        <option value="medium">Medium</option>
                        <option value="pro">Pro</option>
                        <option value="premium">Premium</option>
                        <option value="business">Business</option>
                        <option value="strategic">Strategic</option>
                    </select>
                </div>
            </>
        )}
    </div>

    {/* Messages Section */}
    <div>
        <div className="flex items-center pt-2 mb-3">
            <input 
                id="include-messages" 
                type="checkbox" 
                checked={customOptions.includeMessages} 
                onChange={e => setCustomOptions({...customOptions, includeMessages: e.target.checked})} 
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
            />
            <label htmlFor="include-messages" className="ml-2 block text-sm font-medium text-gray-900">Include Messages</label>
        </div>
        {customOptions.includeMessages && (
            <>
                <div>
                    <label htmlFor="message-prob" className="block text-sm font-medium text-gray-700">Message Probability ({Math.round(customOptions.messageProbability * 100)}%)</label>
                    <input 
                        type="range" 
                        id="message-prob" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={customOptions.messageProbability} 
                        onChange={e => setCustomOptions({...customOptions, messageProbability: parseFloat(e.target.value)})} 
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                    />
                </div>
                
                <div className="flex items-center mt-3">
                    <input 
                        id="force-exchange-form" 
                        type="checkbox" 
                        checked={customOptions.forceExchangeForm} 
                        onChange={e => setCustomOptions({...customOptions, forceExchangeForm: e.target.checked})} 
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                    />
                    <label htmlFor="force-exchange-form" className="ml-2 block text-sm text-gray-900">
                        Force Exchange Form Source
                    </label>
                </div>
                
                                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-3">
                                    <p className="text-xs text-blue-800">
                                        <strong>Tip:</strong> Enable &ldquo;Force Exchange Form Source&rdquo; to ensure ALL contacts have messages.
                                        Otherwise, only some contacts will have messages based on random source assignment.
                                    </p>
                                </div>

                {/* Message Preview */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mt-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Expected Results:</p>
                    <p className="text-xs text-gray-600">
                        With current settings: <strong>{Math.round(customOptions.count * customOptions.messageProbability)}</strong> out of {customOptions.count} contacts will have messages.
                    </p>
                    {customOptions.forceExchangeForm && (
                        <p className="text-xs text-green-700 mt-1">
                            ✅ All contacts will be forced to &quot;exchange_form&quot; source to guarantee messages.
                        </p>
                    )}
                </div>
            </>
        )}
    </div>
</div>
                     {/* Generate Button */}
                    <div className="md:col-span-2 mt-4">
                        <button
                            onClick={handleCustomGenerate}
                            disabled={loading || isGenerating}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? 'Generating...' : `Generate ${customOptions.count} Custom Contacts`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
);

}