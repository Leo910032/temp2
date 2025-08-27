// components/ContactsMap/SmartGroupSuggestions.jsx
import React from 'react';

export function SmartGroupSuggestions({
    isLoaded,
    suggestedGroups,
    showAutoGroupSuggestions,
    setShowAutoGroupSuggestions,
    acceptAutoGroup,
    dismissAutoGroup
}) {
    if (!isLoaded || suggestedGroups.length === 0) return null;

    return (
        <div className="absolute top-4 right-4 z-30 max-w-sm">
            <div className="bg-white rounded-lg shadow-lg border border-purple-200 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-gray-900">Smart Groups</h4>
                            <p className="text-xs text-gray-500">AI-detected clusters</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAutoGroupSuggestions(!showAutoGroupSuggestions)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                        <svg className={`w-4 h-4 transition-transform ${showAutoGroupSuggestions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                {showAutoGroupSuggestions && (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                        {suggestedGroups.slice(0, 3).map(suggestion => (
                            <div key={suggestion.id} className="border border-gray-100 rounded-lg p-3 bg-gradient-to-br from-gray-50 to-white">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                        <h5 className="font-medium text-sm text-gray-900 truncate">
                                            {suggestion.name}
                                        </h5>
                                        <p className="text-xs text-gray-600 mt-1">
                                            {suggestion.description}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={() => acceptAutoGroup(suggestion)}
                                        className="flex-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-medium"
                                    >
                                        Create Group
                                    </button>
                                    <button
                                        onClick={() => dismissAutoGroup(suggestion.id)}
                                        className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 transition-colors"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}