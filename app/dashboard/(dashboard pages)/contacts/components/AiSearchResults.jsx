// app/dashboard/(dashboard pages)/contacts/components/AiSearchResults.jsx - WITH STREAMING SUPPORT
"use client"
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";

export default function AiSearchResults({ 
    results, 
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

    // Sort results by confidence score
    const sortedResults = useMemo(() => {
        if (!results) return [];
        return [...results].sort((a, b) => {
            const confidenceA = a.searchMetadata?.aiAnalysis?.confidenceScore || 0;
            const confidenceB = b.searchMetadata?.aiAnalysis?.confidenceScore || 0;
            return confidenceB - confidenceA;
        });
    }, [results]);

    // Handle streaming updates
    useEffect(() => {
        if (isStreaming && sortedResults.length > displayedResults.length) {
            // New results arrived via streaming
            setLoadingNewResults(true);
            
            // Add animation delay for smooth appearance
            const timer = setTimeout(() => {
                setDisplayedResults(sortedResults);
                setLoadingNewResults(false);
                
                // Auto-expand first card if it has AI insights
                if (sortedResults.length > 0 && sortedResults[0].searchMetadata?.aiAnalysis) {
                    setExpandedCards(new Set([sortedResults[0].id]));
                }
            }, 300);
            
            return () => clearTimeout(timer);
        } else if (!isStreaming) {
            // Not streaming, show all results immediately
            setDisplayedResults(sortedResults);
            
            // Auto-expand first card if it has AI insights
            if (sortedResults.length > 0 && sortedResults[0].searchMetadata?.aiAnalysis) {
                setExpandedCards(new Set([sortedResults[0].id]));
            }
        }
    }, [sortedResults, isStreaming, displayedResults.length]);

    const toggleExpanded = (contactId) => {
        const newExpanded = new Set(expandedCards);
        if (newExpanded.has(contactId)) {
            newExpanded.delete(contactId);
        } else {
            newExpanded.add(contactId);
        }
        setExpandedCards(newExpanded);
    };

    const getRelevanceColor = (score) => {
        if (!score) return 'text-gray-500';
        if (score >= 0.9) return 'text-green-600';
        if (score >= 0.8) return 'text-blue-600';
        if (score >= 0.7) return 'text-yellow-600';
        return 'text-orange-600';
    };
    
    const getRelevanceText = (score) => {
        if (!score) return 'Relevant';
        if (score >= 0.85) return 'Highly Relevant';
        if (score >= 0.75) return 'Relevant';
        return 'Possibly Relevant';
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric'
        });
    };

    return (
        <div className="space-y-4">
            {/* Results Header */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            {isStreaming ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                            ) : (
                                <span className="text-lg">🤖</span>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">
                                AI Search Results for "{query}"
                            </h3>
                            <p className="text-sm text-gray-600">
                                {isStreaming ? (
                                    `Processing contacts... Found ${displayedResults.length} so far`
                                ) : (
                                    `Found ${displayedResults.length} relevant contact${displayedResults.length !== 1 ? 's' : ''} using ${searchTier === 'business' ? 'AI-powered analysis' : 'semantic search'}`
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClearSearch}
                        className="px-3 py-1 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors text-sm"
                        disabled={isStreaming}
                    >
                        Clear Search
                    </button>
                </div>
                
                {/* Streaming Progress Indicator */}
                {isStreaming && streamingProgress && (
                    <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="animate-pulse w-2 h-2 bg-purple-600 rounded-full"></div>
                            <span className="text-sm font-medium text-purple-800">Live AI Analysis</span>
                        </div>
                        {streamingProgress.type === 'processing' && (
                            <div className="text-xs text-purple-600">
                                Analyzing: {streamingProgress.contactName} ({streamingProgress.processed}/{streamingProgress.total})
                            </div>
                        )}
                        {streamingProgress.percentage && (
                            <div className="w-full bg-purple-100 rounded-full h-2 mt-2">
                                <div 
                                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${streamingProgress.percentage}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* No Results */}
            {!isStreaming && displayedResults.length === 0 && (
                <div className="text-center py-8 bg-white rounded-lg border">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">🤷</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No matching contacts found</h3>
                    <p className="text-gray-500 mb-4">
                        Try adjusting your search terms or asking a different question.
                    </p>
                </div>
            )}

            {/* Results List */}
            <div className="space-y-3">
                {displayedResults.map((contact, index) => (
                    <AiSearchResultCard
                        key={contact.id}
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
                
                {/* Loading indicator for new streaming results */}
                {loadingNewResults && (
                    <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                            <div className="flex-1">
                                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Individual AI Search Result Card Component
function AiSearchResultCard({ 
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
    
    return (
        <div className={`bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 ${
            isNewResult ? 'animate-slide-in-from-top border-green-300 shadow-green-100' : ''
        }`}>
            {/* New Result Badge */}
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
                                    <span className={`text-xs font-medium ${getRelevanceColor(contact._vectorScore)}`}>
                                        {getRelevanceText(contact._vectorScore)}
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
                        
                        {/* AI Insights (Business tier) */}
                        {hasAiInsights && (
                            <div className="space-y-3">
                                {/* Confidence Score */}
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm font-medium text-gray-700">AI Confidence Score:</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-20 bg-gray-200 rounded-full h-2">
                                            <div 
                                                className={`h-2 rounded-full transition-all duration-300 ${
                                                    aiAnalysis.confidenceScore >= 8 ? 'bg-green-500' :
                                                    aiAnalysis.confidenceScore >= 6 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}
                                                style={{ width: `${(aiAnalysis.confidenceScore / 10) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900">
                                            {aiAnalysis.confidenceScore}/10
                                        </span>
                                    </div>
                                </div>

                                {/* Explanation */}
                                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                    <h4 className="text-sm font-semibold text-purple-800 mb-1">💡 Why this contact matches:</h4>
                                    <p className="text-sm text-purple-700">{aiAnalysis.matchExplanation}</p>
                                </div>

                                {/* Relevance Factors */}
                                {aiAnalysis.relevanceFactors && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <h4 className="text-sm font-semibold text-blue-800 mb-2">🔑 Key Relevance Factors:</h4>
                                        <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                                            {aiAnalysis.relevanceFactors.map((factor, i) => <li key={i}>{factor}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {/* Action Suggestions */}
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
}

// Add CSS for slide-in animation
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
`;

// Inject styles
if (typeof document !== 'undefined' && !document.querySelector('#ai-search-results-styles')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'ai-search-results-styles';
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}