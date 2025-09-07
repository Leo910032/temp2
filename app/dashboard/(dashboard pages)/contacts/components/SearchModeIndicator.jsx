// Create: app/dashboard/(dashboard pages)/contacts/components/SearchModeIndicator.jsx
// This component clearly shows users which AI jobs are running
"use client"
import { useState } from 'react';

export default function SearchModeIndicator({ 
    searchMode, 
    isSearching, 
    subscriptionLevel,
    onModeChange 
}) {
    const [showDetails, setShowDetails] = useState(false);

    const getModeInfo = () => {
        if (searchMode === 'standard') {
            return {
                title: 'Standard Search',
                subtitle: 'Keyword matching',
                color: 'gray',
                icon: '📝',
                jobs: ['Database keyword search']
            };
        }

        // Semantic search mode
        const canUseAI = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);
        const hasFullAI = ['business', 'enterprise'].includes(subscriptionLevel);

        if (!canUseAI) {
            return {
                title: 'AI Search (Locked)',
                subtitle: 'Requires Premium+',
                color: 'red',
                icon: '🔒',
                jobs: ['Upgrade required']
            };
        }

        if (hasFullAI) {
            return {
                title: 'AI-Powered Search',
                subtitle: 'Librarian + Researcher',
                color: 'purple',
                icon: '🧠',
                jobs: [
                    'Job #1: AI Librarian (Vector embeddings)',
                    'Job #2: AI Researcher (Result analysis)'
                ]
            };
        }

        // Premium tier
        return {
            title: 'Semantic Search',
            subtitle: 'AI Librarian only',
            color: 'blue',
            icon: '📚',
            jobs: [
                'Job #1: AI Librarian (Vector embeddings)',
                'Job #2: Basic results (upgrade for AI insights)'
            ]
        };
    };

    const modeInfo = getModeInfo();
    const colorClasses = {
        gray: 'bg-gray-100 text-gray-700 border-gray-300',
        blue: 'bg-blue-100 text-blue-700 border-blue-300',
        purple: 'bg-purple-100 text-purple-700 border-purple-300',
        red: 'bg-red-100 text-red-700 border-red-300'
    };

    return (
        <div className="relative">
            {/* Main Mode Indicator */}
            <div 
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${colorClasses[modeInfo.color]} ${showDetails ? 'rounded-b-none' : ''}`}
                onClick={() => setShowDetails(!showDetails)}
            >
                <span className="text-lg">{modeInfo.icon}</span>
                <div className="text-sm">
                    <div className="font-medium">{modeInfo.title}</div>
                    <div className="text-xs opacity-75">{modeInfo.subtitle}</div>
                </div>
                
                {/* Loading Indicator */}
                {isSearching && (
                    <div className="ml-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    </div>
                )}

                {/* Details Toggle */}
                <svg 
                    className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {/* Detailed Breakdown */}
            {showDetails && (
                <div className={`absolute top-full left-0 right-0 z-10 border border-t-0 rounded-b-lg p-3 bg-white shadow-lg ${colorClasses[modeInfo.color]} bg-opacity-50`}>
                    <div className="space-y-2">
                        <div className="text-xs font-medium mb-2">Search Process:</div>
                        {modeInfo.jobs.map((job, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                                <div className={`w-2 h-2 rounded-full ${
                                    job.includes('upgrade') || job.includes('Locked') 
                                        ? 'bg-red-400' 
                                        : job.includes('Basic results')
                                        ? 'bg-yellow-400'
                                        : 'bg-green-400'
                                }`}></div>
                                <span>{job}</span>
                            </div>
                        ))}

                        {/* Mode Switch Buttons */}
                        <div className="pt-2 mt-2 border-t border-current border-opacity-20">
                            <div className="flex gap-1">
                                <button
                                    onClick={() => {
                                        onModeChange('standard');
                                        setShowDetails(false);
                                    }}
                                    className={`px-2 py-1 text-xs rounded ${
                                        searchMode === 'standard' 
                                            ? 'bg-white bg-opacity-50 font-medium' 
                                            : 'hover:bg-white hover:bg-opacity-25'
                                    }`}
                                >
                                    Standard
                                </button>
                                <button
                                    onClick={() => {
                                        onModeChange('semantic');
                                        setShowDetails(false);
                                    }}
                                    className={`px-2 py-1 text-xs rounded ${
                                        searchMode === 'semantic' 
                                            ? 'bg-white bg-opacity-50 font-medium' 
                                            : 'hover:bg-white hover:bg-opacity-25'
                                    }`}
                                    disabled={!['premium', 'business', 'enterprise'].includes(subscriptionLevel)}
                                >
                                    AI Search
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Real-time search progress component
export function SearchProgressIndicator({ stage, isSearching }) {
    if (!isSearching) return null;

    const stages = {
        'embedding': {
            title: 'Job #1: AI Librarian',
            description: 'Converting your query to vector embedding...',
            icon: '📚',
            progress: 25
        },
        'vector_search': {
            title: 'Job #1: AI Librarian', 
            description: 'Searching vector database for similar contacts...',
            icon: '📚',
            progress: 50
        },
        'ai_analysis': {
            title: 'Job #2: AI Researcher',
            description: 'Analyzing results and generating insights...',
            icon: '🧠',
            progress: 75
        },
        'complete': {
            title: 'Complete',
            description: 'Preparing results...',
            icon: '✅',
            progress: 100
        }
    };

    const currentStage = stages[stage] || stages.embedding;

    return (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border p-4 max-w-sm">
            <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{currentStage.icon}</span>
                <div>
                    <div className="font-medium text-sm">{currentStage.title}</div>
                    <div className="text-xs text-gray-600">{currentStage.description}</div>
                </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${currentStage.progress}%` }}
                ></div>
            </div>
            
            <div className="text-xs text-gray-500 text-center">
                {currentStage.progress}% complete
            </div>
        </div>
    );
}