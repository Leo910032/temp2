// app/dashboard/(dashboard pages)/contacts/components/SearchBar.jsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { CONTACT_FEATURES } from '@/lib/services/constants';
import { useTranslation } from '@/lib/translation/useTranslation';
import { SemanticSearchService } from '@/lib/services/serviceContact/client/services/SemanticSearchService';

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
    const { t } = useTranslation();
    const [cacheCleared, setCacheCleared] = useState(false);

    // Search history state
    const [searchHistory, setSearchHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const historyRef = useRef(null);

    // Load search history on mount and when switching to semantic mode
    useEffect(() => {
        if (searchMode === 'semantic') {
            const history = SemanticSearchService.getSearchHistory();
            setSearchHistory(history);
        }
    }, [searchMode]);

    // Close history dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (historyRef.current && !historyRef.current.contains(event.target)) {
                setShowHistory(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle selecting a search from history
    const handleSelectHistoryItem = (query) => {
        setAiSearchQuery(query);
        setShowHistory(false);
        handleEnhancedSearch(query, true);
    };

    // Handle clearing entire history
    const handleClearHistory = () => {
        SemanticSearchService.clearSearchHistory();
        setSearchHistory([]);
        setShowHistory(false);
    };

    // Handle removing a single item from history
    const handleRemoveHistoryItem = (query, e) => {
        e.stopPropagation(); // Prevent triggering the search
        SemanticSearchService.removeFromHistory(query);
        const updatedHistory = searchHistory.filter(item => item.query !== query);
        setSearchHistory(updatedHistory);
    };

    // Format timestamp for display
    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);

        if (diffInHours < 1) return 'Just now';
        if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
        if (diffInHours < 48) return 'Yesterday';
        return date.toLocaleDateString();
    };

    // Handle clearing the semantic search cache
    const handleClearCache = () => {
        SemanticSearchService.clearSearchCache();
        setCacheCleared(true);
        console.log('🗑️ Semantic search cache cleared');

        // Show confirmation message for 3 seconds
        setTimeout(() => {
            setCacheCleared(false);
        }, 3000);
    };

    const translations = {
        title: t('contacts.search.title') || 'Search Contacts',
        standardMode: t('contacts.search.standard_mode') || 'Standard',
        aiMode: t('contacts.search.ai_mode') || 'AI Search',
        searchPlaceholder: t('contacts.search.placeholder') || 'Search contacts by name, email, or company...',
        semanticPlaceholder: t('contacts.search.semantic_placeholder') || "Ask about your network: 'who knows React?' or 'marketing experts'",
        searchButton: t('common.search') || 'Search',
        searching: t('contacts.search.searching') || 'Searching...',
        enhancedTitle: t('contacts.search.enhanced_title') || 'Enhanced AI Search',
        semanticTitle: t('contacts.search.semantic_title') || 'Semantic Search',
        enhancedDescription: t('contacts.search.enhanced_description') || 'AI analyzes your contacts semantically and provides intelligent insights about why each contact matches your query.',
        semanticDescription: t('contacts.search.semantic_description') || 'Semantic search finds contacts based on meaning, not just keywords. Upgrade to Business for AI-powered insights.',
        tryExamples: t('contacts.search.try_examples') || 'Try these examples:',
        exampleSuggestions: t('contacts.search.examples')
    };

    const exampleSuggestions = Array.isArray(translations.exampleSuggestions)
        ? translations.exampleSuggestions
        : [
            'React developers',
            'startup founders',
            'marketing professionals',
            'based in California'
        ];

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
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow mb-4 sm:mb-6 space-y-3 sm:space-y-4">
            {/* Search Header with Mode Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">{translations.title}</h3>

                {canUseSemanticSearch && (
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                            onClick={() => {
                                setSearchMode('standard');
                                setAiSearchQuery('');
                            }}
                            className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                                searchMode === 'standard'
                                    ? 'bg-blue-100 text-blue-700 font-medium'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {translations.standardMode}
                        </button>
                        <button
                            onClick={() => setSearchMode('semantic')}
                            className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors flex items-center justify-center gap-1 ${
                                searchMode === 'semantic'
                                    ? 'bg-purple-100 text-purple-700 font-medium'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            <span>🤖</span>
                            <span className="hidden sm:inline">{translations.aiMode}</span>
                            <span className="sm:hidden">IA</span>
                        </button>

                        {/* Clear Cache Button - Only show in semantic mode */}
                        {searchMode === 'semantic' && (
                            <button
                                onClick={handleClearCache}
                                className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all flex items-center gap-1 ${
                                    cacheCleared
                                        ? 'bg-green-100 text-green-700 font-medium'
                                        : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                }`}
                                title="Clear cached search results for fresh comparison"
                            >
                                {cacheCleared ? (
                                    <>
                                        <span>✓</span>
                                        <span className="hidden sm:inline">Cleared</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🗑️</span>
                                        <span className="hidden sm:inline">Clear Cache</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Main Search Input */}
            <div className="relative" ref={historyRef}>
                <input
                    type="text"
                    placeholder={
                        searchMode === 'semantic'
                            ? translations.semanticPlaceholder
                            : translations.searchPlaceholder
                    }
                    value={searchMode === 'semantic' ? aiSearchQuery : searchTerm}
                    onChange={(e) => {
                        if (searchMode === 'semantic') {
                            setAiSearchQuery(e.target.value);
                        }
                    }}
                    onKeyPress={handleKeyPress}
                    onFocus={() => {
                        if (searchMode === 'semantic' && searchHistory.length > 0) {
                            setShowHistory(true);
                        }
                    }}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pl-10 sm:pl-12 pr-20 sm:pr-24 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm sm:text-base"
                    disabled={isAiSearching}
                />

                {/* Search Icon */}
                <div className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2">
                    {isAiSearching ? (
                        <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-blue-600"></div>
                    ) : (
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    )}
                </div>

                {/* History Icon - Show next to search icon when there's history */}
                {searchMode === 'semantic' && searchHistory.length > 0 && !aiSearchQuery && (
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="absolute left-10 sm:left-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-purple-600 transition-colors"
                        title="Search history"
                    >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                )}

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
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 sm:px-4 py-1.5 bg-blue-600 text-white text-xs sm:text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    <span className="hidden sm:inline">
                        {isAiSearching ? translations.searching : translations.searchButton}
                    </span>
                    <span className="sm:hidden">
                        {isAiSearching ? '...' : '🔍'}
                    </span>
                </button>

                {/* SEARCH HISTORY DROPDOWN */}
                {searchMode === 'semantic' && showHistory && searchHistory.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700">Recent Searches</span>
                            </div>
                            <button
                                onClick={handleClearHistory}
                                className="text-xs text-red-600 hover:text-red-700 hover:underline"
                            >
                                Clear All
                            </button>
                        </div>

                        {/* History Items */}
                        <div className="divide-y divide-gray-100">
                            {searchHistory.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSelectHistoryItem(item.query)}
                                    className="w-full flex items-center justify-between p-3 hover:bg-purple-50 transition-colors group text-left"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-900 truncate">{item.query}</span>
                                            {item.searchCount > 1 && (
                                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                                    {item.searchCount}x
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-gray-500">{formatTimestamp(item.timestamp)}</span>
                                            <span className="text-xs text-gray-400">•</span>
                                            <span className="text-xs text-gray-500">{item.resultsCount} results</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleRemoveHistoryItem(item.query, e)}
                                        className="ml-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove from history"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* AI Search Feature Explanation */}
            {searchMode === 'semantic' && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-3 sm:p-4 rounded-lg border border-purple-200">
                    <div className="space-y-2 sm:space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-base sm:text-lg">🤖</span>
                            <h4 className="text-sm sm:text-base font-semibold text-purple-800">
                                {canUseFullAiSearch ? translations.enhancedTitle : translations.semanticTitle}
                            </h4>
                        </div>

                        <div className="text-xs sm:text-sm text-purple-700">
                            {canUseFullAiSearch ? (
                                <p>{translations.enhancedDescription}</p>
                            ) : (
                                <p>{translations.semanticDescription}</p>
                            )}
                        </div>

                        {/* Quick Examples */}
                        {(!aiSearchQuery || aiSearchQuery.length === 0) && (
                            <div className="pt-2 border-t border-purple-200">
                                <div className="text-xs text-purple-600 mb-1.5 sm:mb-2">{translations.tryExamples}</div>
                                <div className="flex flex-wrap gap-1 sm:gap-1.5">
                                    {exampleSuggestions.map((example, index) => (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                setAiSearchQuery(example);
                                                handleEnhancedSearch(example, true);
                                            }}
                                            className="px-2 py-1 text-xs bg-white border border-purple-300 rounded-full hover:bg-purple-50 text-purple-700 transition-colors"
                                        >
                                            &quot;{example}&quot;
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
