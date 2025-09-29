// app/dashboard/(dashboard pages)/contacts/components/SearchBar.jsx
"use client";

import { CONTACT_FEATURES } from '@/lib/services/constants';

export default function SearchBar({
    searchMode,
    setSearchMode,
    searchTerm,
    aiSearchQuery,
    setAiSearchQuery,
    isAiSearching,
    handleEnhancedSearch,
    hasFeature
}) {
    const canUseSemanticSearch = hasFeature(CONTACT_FEATURES.PREMIUM_SEMANTIC_SEARCH);
    const canUseFullAiSearch = hasFeature(CONTACT_FEATURES.BUSINESS_AI_SEARCH);

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            if (searchMode === 'semantic') {
                handleEnhancedSearch(aiSearchQuery, true);
            } else {
                handleEnhancedSearch(searchTerm, false);
            }
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow mb-6 space-y-4">
            {/* Search Header with Mode Toggle */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Search Contacts</h3>
                
                {canUseSemanticSearch && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setSearchMode('standard');
                                setAiSearchQuery('');
                            }}
                            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                                searchMode === 'standard'
                                    ? 'bg-blue-100 text-blue-700 font-medium'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Standard
                        </button>
                        <button
                            onClick={() => setSearchMode('semantic')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1 ${
                                searchMode === 'semantic'
                                    ? 'bg-purple-100 text-purple-700 font-medium'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            <span>🤖</span>
                            AI Search
                        </button>
                    </div>
                )}
            </div>

            {/* Main Search Input */}
            <div className="relative">
                <input
                    type="text"
                    placeholder={
                        searchMode === 'semantic'
                            ? "Ask about your network: 'who knows React?' or 'marketing experts'"
                            : "Search contacts by name, email, or company..."
                    }
                    value={searchMode === 'semantic' ? aiSearchQuery : searchTerm}
                    onChange={(e) => {
                        if (searchMode === 'semantic') {
                            setAiSearchQuery(e.target.value);
                        }
                    }}
                    onKeyPress={handleKeyPress}
                    className="w-full px-4 py-3 pl-12 pr-24 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                    disabled={isAiSearching}
                />

                {/* Search Icon */}
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                    {isAiSearching ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    ) : (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    )}
                </div>

                {/* Search Button */}
                <button
                    onClick={() => {
                        if (searchMode === 'semantic') {
                            handleEnhancedSearch(aiSearchQuery, true);
                        } else {
                            handleEnhancedSearch(searchTerm, false);
                        }
                    }}
                    disabled={isAiSearching}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {isAiSearching ? 'Searching...' : 'Search'}
                </button>
            </div>

            {/* AI Search Feature Explanation */}
            {searchMode === 'semantic' && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🤖</span>
                            <h4 className="font-semibold text-purple-800">
                                {canUseFullAiSearch ? 'Enhanced AI Search' : 'Semantic Search'}
                            </h4>
                        </div>

                        <div className="text-sm text-purple-700">
                            {canUseFullAiSearch ? (
                                <p>
                                    AI analyzes your contacts semantically and provides intelligent insights
                                    about why each contact matches your query.
                                </p>
                            ) : (
                                <p>
                                    Semantic search finds contacts based on meaning, not just keywords.
                                    Upgrade to Business for AI-powered insights.
                                </p>
                            )}
                        </div>

                        {/* Quick Examples */}
                        {(!aiSearchQuery || aiSearchQuery.length === 0) && (
                            <div className="pt-2 border-t border-purple-200">
                                <div className="text-xs text-purple-600 mb-2">Try these examples:</div>
                                <div className="flex flex-wrap gap-1">
                                    {[
                                        "React developers",
                                        "startup founders",
                                        "marketing professionals",
                                        "based in California"
                                    ].map((example, index) => (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                setAiSearchQuery(example);
                                                handleEnhancedSearch(example, true);
                                            }}
                                            className="px-2 py-1 text-xs bg-white border border-purple-300 rounded-full hover:bg-purple-50 text-purple-700 transition-colors"
                                        >
                                            "{example}"
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}