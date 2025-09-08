// app/dashboard/(dashboard pages)/contacts/components/AiSearchResults.jsx - FIXED VERSION
"use client"
import React from 'react';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";

export default function AiSearchResults({ 
    results, // This prop will now be the single source of truth
    query, 
    searchTier, 
    onClearSearch, 
    onContactAction, 
    groups = [],
    isStreaming = false,
    streamingProgress = null
}) {
    const { t } = useTranslation();
    const [expandedCards, setExpandedCards] = useState(new Set());
    const [displayedResults, setDisplayedResults] = useState([]);
    const [loadingNewResults, setLoadingNewResults] = useState(false);
    const [selectedSimilarityFilter, setSelectedSimilarityFilter] = useState('all');
    
    const lastQueryRef = useRef('');
    const lastResultsHashRef = useRef('');
    const filterInitializedRef = useRef(false);
    
    const getResultsHash = useCallback((resultsCount, query) => {
        return `${query}-${resultsCount}`;
    }, []);

    useEffect(() => {
        if (query !== lastQueryRef.current) {
            console.log('Query changed, resetting state:', { from: lastQueryRef.current, to: query });
            filterInitializedRef.current = false;
            setSelectedSimilarityFilter('all');
            setExpandedCards(new Set());
            setDisplayedResults([]);
            lastQueryRef.current = query;
            lastResultsHashRef.current = '';
        }
    }, [query]);

   // CORRECTED: Use the `results` prop as the single source of truth for categorization.
    const categorizedResults = useMemo(() => {
        const categories = {
            high: [],
            medium: [],
            low: []
        };

        if (!Array.isArray(results)) {
            return categories;
        }
        
        // Logic now correctly depends on the `results` prop which gets streamed updates
        results.forEach(contact => {
            if (!contact) return;
            
            const tier = contact.similarityTier || contact.searchMetadata?.similarityTier;
            
            if (tier === 'high') {
                categories.high.push(contact);
            } else if (tier === 'medium') {
                categories.medium.push(contact);
            } else if (tier === 'low' || tier === 'filtered') { // Group low and filtered together for display
                categories.low.push(contact);
            }
        });

        return categories;
    }, [results]); // Dependency is now correctly just `results`
    // Fixed: Stable filter initialization with proper guards
  
    useEffect(() => {
        const currentHash = getResultsHash(
            (results || []).length,
            query
        );
        
        const hashChanged = currentHash !== lastResultsHashRef.current;
        const hasResults = (results || []).length > 0;
        
        if (!filterInitializedRef.current && hashChanged && hasResults) {
            console.log('Initializing filter for new results:', currentHash);
            
            const counts = {
                high: categorizedResults.high.length,
                medium: categorizedResults.medium.length,
                low: categorizedResults.low.length
            };
            
            const defaultCategory = ['high', 'medium', 'low'].find(cat => counts[cat] > 0) || 'all';
            
            setSelectedSimilarityFilter(defaultCategory);
            
            filterInitializedRef.current = true;
            lastResultsHashRef.current = currentHash;
        }
    }, [categorizedResults, results, query, getResultsHash]);

    // Fixed: Optimized filtered results with stable dependencies
   const filteredResults = useMemo(() => {
        if (selectedSimilarityFilter === 'all') {
            return [...categorizedResults.high, ...categorizedResults.medium, ...categorizedResults.low];
        }
        return categorizedResults[selectedSimilarityFilter] || [];
    }, [categorizedResults, selectedSimilarityFilter]);
    // Fixed: Optimized sorted results 
    const sortedResults = useMemo(() => {
        return [...filteredResults].sort((a, b) => {
            const scoreA = a.searchMetadata?.hybridScore || a._vectorScore || 0;
            const scoreB = b.searchMetadata?.hybridScore || b._vectorScore || 0;
            return scoreB - scoreA;
        });
    }, [filteredResults]);

    // This useEffect now correctly updates the displayed list as `sortedResults` changes
    useEffect(() => {
        if (!Array.isArray(sortedResults)) return;

        // Immediately update displayed results to reflect changes from streaming
        setDisplayedResults([...sortedResults]);

        // Auto-expand the first result when the list initially populates
        if (sortedResults.length > 0 && expandedCards.size === 0) {
            const firstWithInsights = sortedResults.find(r => r.searchMetadata?.aiAnalysis);
            if (firstWithInsights) {
                setExpandedCards(new Set([firstWithInsights.id]));
            }
        }
    }, [sortedResults]); // Correctly depends on the derived sorted list
    const toggleExpanded = useCallback((contactId) => {
        setExpandedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(contactId)) {
                newSet.delete(contactId);
            } else {
                newSet.add(contactId);
            }
            return newSet;
        });
    }, []);

    // Fixed: Memoize utility functions to prevent recreations
    const getRelevanceColor = useCallback((score) => {
        if (!score) return 'text-gray-500';
        if (score >= 0.9) return 'text-green-600';
        if (score >= 0.8) return 'text-blue-600';
        if (score >= 0.7) return 'text-yellow-600';
        return 'text-orange-600';
    }, []);
    
    const getRelevanceText = useCallback((score) => {
        if (!score) return 'Relevant';
        if (score >= 0.85) return 'Highly Relevant';
        if (score >= 0.75) return 'Relevant';
        return 'Possibly Relevant';
    }, []);

    const formatDate = useCallback((dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric'
        });
    }, []);

    return (
        <div className="space-y-6">
            {/* Results Header */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            {isStreaming ? (
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                            ) : (
                                <span className="text-2xl">🤖</span>
                            )}
                        </div>
                        
                        <div className="flex flex-col">
                            <h3 className="text-lg font-semibold text-gray-900">
                                AI Search Results for "{query}"
                            </h3>
                            <p className="text-sm text-gray-600">
                                Found {categorizedResults.high.length + categorizedResults.medium.length + categorizedResults.low.length} relevant contacts using {searchTier === 'business' ? 'AI-powered analysis' : 'semantic search'}
                            </p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onClearSearch}
                        className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Clear Search
                    </button>
                </div>
                
                {/* Streaming Progress Indicator */}
                {isStreaming && streamingProgress && (
                    <div className="mt-4 p-3 bg-white rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="animate-pulse w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span className="text-sm font-medium text-purple-700">Live AI Analysis</span>
                        </div>
                        {streamingProgress.type === 'processing' && (
                            <div className="text-sm text-gray-600">
                                Analyzing: {streamingProgress.contactName} ({streamingProgress.processed}/{streamingProgress.total})
                            </div>
                        )}
                        {streamingProgress.percentage && (
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                <div 
                                    className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                                    style={{ width: `${streamingProgress.percentage}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Similarity Filter Navigation */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">Filter by similarity:</span>
                    <div className="flex flex-wrap gap-2">
                        <SimilarityFilterButton 
                            type="high" 
                            count={categorizedResults.high.length} 
                            isSelected={selectedSimilarityFilter === 'high'} 
                            onClick={() => setSelectedSimilarityFilter('high')}
                        />
                        <SimilarityFilterButton 
                            type="medium" 
                            count={categorizedResults.medium.length} 
                            isSelected={selectedSimilarityFilter === 'medium'} 
                            onClick={() => setSelectedSimilarityFilter('medium')}
                        />
                        <SimilarityFilterButton 
                            type="low" 
                            count={categorizedResults.low.length} 
                            isSelected={selectedSimilarityFilter === 'low'} 
                            onClick={() => setSelectedSimilarityFilter('low')}
                        />
                        <SimilarityFilterButton 
                            type="all" 
                            count={categorizedResults.high.length + categorizedResults.medium.length + categorizedResults.low.length} 
                            isSelected={selectedSimilarityFilter === 'all'} 
                            onClick={() => setSelectedSimilarityFilter('all')}
                        />
                    </div>
                </div>
            </div>

            {/* No Results */}
            {!isStreaming && displayedResults.length === 0 && (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-4xl mb-2">
                        🤷
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found in this similarity level</h3>
                    <p className="text-gray-600">
                        Try selecting a different similarity filter or clearing the search.
                    </p>
                </div>
            )}

            {/* Results List */}
            <div className="space-y-4">
                {displayedResults.map((contact, index) => (
                    <AiSearchResultCard 
                        key={`${contact.id}-${index}`} // Fixed: Stable key
                        contact={contact}
                        index={index}
                        searchTier={searchTier}
                        isExpanded={expandedCards.has(contact.id)}
                        onToggleExpanded={() => toggleExpanded(contact.id)}
                        onContactAction={onContactAction}
                        getRelevanceColor={getRelevanceColor}
                        getRelevanceText={getRelevanceText}
                        formatDate={formatDate}
                        groups={groups}
                        isNewResult={isStreaming && index === displayedResults.length - 1}
                    />
                ))}
                
                {loadingNewResults && (
                    <div className="flex justify-center py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                            <span className="text-sm">Loading new results...</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Fixed: Memoized filter button to prevent unnecessary re-renders
const SimilarityFilterButton = React.memo(function SimilarityFilterButton({ type, count, isSelected, onClick }) {
    const getButtonConfig = (type) => {
        switch (type) {
            case 'high':
                return {
                    label: 'High Similarity',
                    color: 'green',
                    icon: '🎯',
                    bgClass: isSelected ? 'bg-green-500' : 'bg-green-100',
                    textClass: isSelected ? 'text-white' : 'text-green-700',
                    borderClass: 'border-green-300',
                    hoverClass: 'hover:bg-green-200'
                };
            case 'medium':
                return {
                    label: 'Medium Similarity',
                    color: 'yellow',
                    icon: '⚡',
                    bgClass: isSelected ? 'bg-yellow-500' : 'bg-yellow-100',
                    textClass: isSelected ? 'text-white' : 'text-yellow-700',
                    borderClass: 'border-yellow-300',
                    hoverClass: 'hover:bg-yellow-200'
                };
            case 'low':
                return {
                    label: 'Low Similarity',
                    color: 'orange',
                    icon: '🔍',
                    bgClass: isSelected ? 'bg-orange-500' : 'bg-orange-100',
                    textClass: isSelected ? 'text-white' : 'text-orange-700',
                    borderClass: 'border-orange-300',
                    hoverClass: 'hover:bg-orange-200'
                };
            case 'all':
                return {
                    label: 'All Results',
                    color: 'blue',
                    icon: '📊',
                    bgClass: isSelected ? 'bg-blue-500' : 'bg-blue-100',
                    textClass: isSelected ? 'text-white' : 'text-blue-700',
                    borderClass: 'border-blue-300',
                    hoverClass: 'hover:bg-blue-200'
                };
        }
    };

    const config = getButtonConfig(type);

    return (
        <button
            onClick={onClick}
            disabled={count === 0}
            className={`
                relative px-4 py-2 rounded-lg border transition-all duration-300 transform
                ${config.bgClass} ${config.textClass} ${config.borderClass}
                ${!isSelected && count > 0 ? config.hoverClass : ''}
                ${isSelected ? 'scale-105 shadow-lg' : 'hover:scale-102'}
                ${count === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
                flex items-center gap-2 text-sm font-medium
            `}
        >
            <span className="text-base">{config.icon}</span>
            <span>{config.label}</span>
            <span className={`
                px-2 py-0.5 rounded-full text-xs font-bold
                ${isSelected ? 'bg-white bg-opacity-30' : 'bg-white bg-opacity-60'}
            `}>
                {count}
            </span>
            
            {/* Selection indicator */}
            {isSelected && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-current rounded-full"></div>
                </div>
            )}
        </button>
    );
});

// Fixed: Memoized card component to prevent unnecessary re-renders
const AiSearchResultCard = React.memo(function AiSearchResultCard({ 
    contact, 
    index, 
    searchTier, 
    isExpanded, 
    onToggleExpanded, 
    onContactAction,
    getRelevanceColor,
    getRelevanceText,
    formatDate,
    groups,
    isNewResult = false
}) {
    const contactGroups = groups.filter(group => group.contactIds && group.contactIds.includes(contact.id));
    
    const hasAiInsights = searchTier === 'business' && contact.searchMetadata?.aiAnalysis;
    const aiAnalysis = contact.searchMetadata?.aiAnalysis;
    const vectorScore = contact._vectorScore || contact.searchMetadata?.vectorSimilarity || 0;
    
    return (
        <div className={`bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 ${
            isNewResult ? 'animate-slide-in-from-top border-green-300 shadow-green-100' : ''
        }`}>
            {isNewResult && (
                <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-t-lg text-center font-medium border-b border-green-200">
                    ✨ New Result
                </div>
            )}
            
            {/* Card Header */}
            <div className="p-4 cursor-pointer" onClick={onToggleExpanded}>
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                            {index + 1}
                        </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-sm truncate">{contact.name || 'No Name'}</h3>
                                <p className="text-xs text-gray-500 truncate">{contact.email || 'No Email'}</p>
                                {contact.company && <p className="text-xs text-blue-600 truncate mt-1">{contact.company}</p>}
                                
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`text-xs font-medium ${getRelevanceColor(vectorScore)}`}>
                                        {getRelevanceText(vectorScore)}
                                    </span>
                                    {hasAiInsights && (
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                            AI Enhanced
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="ml-2">
                                <svg className={`w-4 h-4 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>

                        {/* AI Insights Preview */}
                        {hasAiInsights && !isExpanded && (
                            <div className="mt-2 p-2 bg-purple-50 rounded text-xs">
                                <div className="flex items-center gap-1 mb-1">
                                    <span className="text-lg">💡</span>
                                    <span className="font-medium text-purple-700">AI Insight:</span>
                                    <span className="ml-auto text-purple-600 font-medium">
                                        Confidence: {aiAnalysis.confidenceScore}/10
                                    </span>
                                </div>
                                <p className="text-purple-600 line-clamp-2">
                                    {aiAnalysis.matchExplanation}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-gray-100">
                    <div className="p-4 space-y-4">
                        
                        {/* AI Analysis Results */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-700">AI Analysis Results:</span>
                            <div className="flex items-center gap-4">
                                {/* AI Confidence */}
                                {hasAiInsights && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-600">AI Confidence:</span>
                                        <div className="w-16 bg-gray-200 rounded-full h-2">
                                            <div 
                                                className={`h-2 rounded-full transition-all duration-300 ${
                                                    aiAnalysis.confidenceScore >= 8 ? 'bg-green-500' :
                                                    aiAnalysis.confidenceScore >= 6 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}
                                                style={{ width: `${(aiAnalysis.confidenceScore / 10) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs font-bold text-gray-900">
                                            {aiAnalysis.confidenceScore}/10
                                        </span>
                                    </div>
                                )}
                                
                                {/* Similarity Score */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-600">Similarity:</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                        vectorScore >= 0.75 ? 'bg-green-100 text-green-700' :
                                        vectorScore >= 0.60 ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-orange-100 text-orange-700'
                                    }`}>
                                        {(vectorScore * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* AI Insights (Business tier) */}
                        {hasAiInsights && (
                            <div className="space-y-3">
                                {/* Explanation */}
                                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                    <h4 className="text-sm font-semibold text-purple-800 mb-1">💡 Why this contact matches:</h4>
                                    <p className="text-sm text-purple-700">{aiAnalysis.matchExplanation}</p>
                                </div>

                                {/* Key Relevance Factors */}
                                {aiAnalysis.relevanceFactors && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <h4 className="text-sm font-semibold text-blue-800 mb-2">🔑 Key Relevance Factors:</h4>
                                        <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                                            {aiAnalysis.relevanceFactors.map((factor, i) => <li key={i}>{factor}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {/* Actionable Suggestions */}
                                {aiAnalysis.actionSuggestions && (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <h4 className="text-sm font-semibold text-green-800 mb-2">🚀 Actionable Suggestions:</h4>
                                        <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                                            {aiAnalysis.actionSuggestions.map((suggestion, i) => <li key={i}>{suggestion}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {contact.notes && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <h4 className="text-sm font-semibold text-yellow-800 mb-2">📝 Notes:</h4>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{contact.notes}</p>
                            </div>
                        )}
                        
                        {contact.message && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <h4 className="text-sm font-semibold text-gray-800 mb-2">💬 Message:</h4>
                                <p className="text-sm text-gray-700 italic">"{contact.message}"</p>
                            </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                            <span>Added {formatDate(contact.submittedAt)}</span>
                            <span className="capitalize">{contact.source?.replace('_', ' ') || 'Manual'}</span>
                            {hasAiInsights && (
                                <span className="text-purple-600">Enhanced with AI</span>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="p-4 border-t border-gray-100">
                        <div className="grid grid-cols-3 gap-2">
                            <button className="px-3 py-2 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                                Email
                            </button>
                            <button className="px-3 py-2 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors">
                                Call
                            </button>
                            <button className="px-3 py-2 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors">
                                View
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

// CSS for animations (unchanged)
const styles = `
@keyframes slide-in-from-top {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-in-from-top {
  animation: slide-in-from-top 0.5s ease-out;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hover\\:scale-102:hover {
  transform: scale(1.02);
}
`;

// Inject styles (unchanged)
if (typeof document !== 'undefined' && !document.querySelector('#ai-search-results-styles')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'ai-search-results-styles';
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}